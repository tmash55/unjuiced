import { Redis } from "@upstash/redis";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import { fetchSgpQuote } from "@/lib/sgp/quote-service";
import { type SSEBookSelections, type SSESelection } from "@/lib/odds/types";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";

const SCAN_COUNT = 1500;
const MAX_SCAN_ITERATIONS = 60;
const MGET_CHUNK_SIZE = 300;
const DEFAULT_SPORT = "nba";
const DEFAULT_TARGET_LINE = 9.5;
const DEFAULT_MAX_CANDIDATES = 30;
const DEFAULT_MAX_ROWS = 24;
const DEFAULT_CONCURRENCY = 10;
const SHEET_CACHE_TTL_SECONDS = 120;

const REDIS_SHEET_DATA_KEY = "dashboard:triple-double-sheet:data";
const REDIS_SHEET_TIMESTAMP_KEY = "dashboard:triple-double-sheet:timestamp";
const commandEndpoint = getRedisCommandEndpoint();
const redis = new Redis({
  url: commandEndpoint.url || process.env.UPSTASH_REDIS_REST_URL!,
  token: commandEndpoint.token || process.env.UPSTASH_REDIS_REST_TOKEN!,
});
let cacheDisabled = false;
let cacheDisableLogged = false;

const DEFAULT_SHEET_BOOKS: string[] = ["draftkings", "fanduel", "betmgm", "caesars", "thescore"];

const BASE_MARKETS = {
  points: "player_points",
  rebounds: "player_rebounds",
  assists: "player_assists",
} as const;

const TD_MARKETS = ["player_triple_double", "triple_double"];

type BaseLegKey = keyof typeof BASE_MARKETS;

interface EventMeta {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
}

interface BookLegTokens {
  points?: string;
  rebounds?: string;
  assists?: string;
}

interface BookTdPrice {
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
}

interface SheetCandidate {
  key: string;
  eventId: string;
  playerId: string;
  player: string;
  team: string | null;
  matchup: string;
  startTime: string;
  legsByBook: Record<string, BookLegTokens>;
  tdByBook: Record<string, BookTdPrice>;
}

interface ComboQuote {
  combo: "ra" | "pra";
  book: string;
  price: number | null;
  priceFormatted: string | null;
  link: string | null;
  mobileLink: string | null;
  error?: string;
  source: string;
  fromCache: boolean;
  stale: boolean;
}

export interface SheetBestPrice {
  book: string;
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export interface TripleDoubleSheetRow {
  id: string;
  player: string;
  team: string | null;
  matchup: string;
  eventId: string;
  startTime: string;
  sgp_ra: SheetBestPrice | null;
  sgp_pra: SheetBestPrice | null;
  td: SheetBestPrice | null;
  hasAllThreeLegs: boolean;
  booksWithRa: number;
  booksWithPra: number;
}

export interface TripleDoubleSheetMeta {
  sport: string;
  targetLine: number;
  candidateCount: number;
  rowCount: number;
  books: string[];
  quoteStats: {
    totalRequests: number;
    vendorCalls: number;
    cacheHits: number;
    staleServed: number;
    errors: number;
  };
}

export interface TripleDoubleSheetData {
  rows: TripleDoubleSheetRow[];
  generatedAt: number;
  generatedAtIso: string;
  meta: TripleDoubleSheetMeta;
}

export interface TripleDoubleSheetComputeOptions {
  sport?: string;
  books?: string[];
  targetLine?: number;
  maxCandidates?: number;
  maxRows?: number;
  concurrency?: number;
}

function sanitizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function sanitizeLine(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
    case "bally_bet":
      return "bally-bet";
    case "bet-rivers":
    case "bet_rivers":
      return "betrivers";
    case "sportsinteraction":
      return "sports-interaction";
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

function getBookKeyCandidates(rawBook: string): string[] {
  const lower = rawBook.toLowerCase();
  const normalized = normalizeBookId(lower);
  const candidates = new Set<string>([lower, normalized]);

  candidates.add(lower.replace(/-/g, "_"));
  candidates.add(lower.replace(/_/g, "-"));
  candidates.add(normalized.replace(/-/g, "_"));
  candidates.add(normalized.replace(/_/g, "-"));

  if (normalized === "bally-bet") {
    candidates.add("ballybet");
    candidates.add("bally_bet");
  }
  if (normalized === "betrivers") {
    candidates.add("bet-rivers");
    candidates.add("bet_rivers");
  }
  if (normalized === "hard-rock") {
    candidates.add("hardrock");
  }
  if (normalized === "fanduelyourway") {
    candidates.add("fanduel-yourway");
    candidates.add("fanduel_yourway");
  }
  if (normalized === "betmgm") {
    candidates.add("betmgm-michigan");
    candidates.add("betmgm_michigan");
  }

  return [...candidates].filter(Boolean);
}

function parseOddsIndexMember(member: string): { market: string; book: string } | null {
  const sep = member.lastIndexOf(":");
  if (sep <= 0 || sep >= member.length - 1) return null;
  return {
    market: member.slice(0, sep),
    book: member.slice(sep + 1),
  };
}

function isSubscriberModeError(error: unknown): boolean {
  const message =
    (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return message.includes("subscriber mode");
}

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function parseAmericanOdds(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? Math.round(value) : parseInt(value.replace("+", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDisplayPlayer(raw: string): string {
  return raw
    .split("_")
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function resolveAllowedBooks(requested?: string[]): string[] {
  const allSgpBooks = Object.entries(SPORTSBOOKS_META)
    .filter(([_, meta]) => meta.sgp === true && meta.isActive === true)
    .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0))
    .map(([id]) => normalizeBookId(id));
  const sgpBooks = new Set(allSgpBooks);

  // Default to all active SGP books; keep a small hardcoded fallback only if metadata is empty.
  const desired = requested?.length
    ? requested
    : (allSgpBooks.length ? allSgpBooks : DEFAULT_SHEET_BOOKS);
  const filtered = desired
    .map(normalizeBookId)
    .filter((book) => sgpBooks.has(book));

  return filtered.length ? [...new Set(filtered)] : [...new Set(allSgpBooks)];
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  let iterations = 0;
  let resetAfterInvalidCursor = false;
  const seenCursors = new Set<number>();

  do {
    iterations += 1;
    if (seenCursors.has(cursor)) {
      console.warn(`[triple-double-sheet] Cursor cycle detected for ${pattern}, stopping at ${keys.length} keys`);
      break;
    }
    seenCursors.add(cursor);

    let result: [string, string[]];
    try {
      result = await redis.scan(cursor, {
        match: pattern,
        count: SCAN_COUNT,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isInvalidCursor = message.toLowerCase().includes("invalid cursor");
      if (isInvalidCursor && cursor !== 0 && !resetAfterInvalidCursor) {
        console.warn(`[triple-double-sheet] Invalid cursor for ${pattern}; resetting scan cursor to 0 once`);
        cursor = 0;
        resetAfterInvalidCursor = true;
        seenCursors.clear();
        continue;
      }
      throw error;
    }

    const nextCursor = Number(result[0]);
    if (!Number.isFinite(nextCursor)) {
      console.warn(`[triple-double-sheet] Non-numeric cursor for ${pattern}; stopping at ${keys.length} keys`);
      break;
    }

    cursor = nextCursor;
    keys.push(...result[1]);
    if (iterations >= MAX_SCAN_ITERATIONS) break;
  } while (cursor !== 0);

  return keys;
}

async function mgetChunked<T>(keys: string[]): Promise<Array<T | null>> {
  if (keys.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += MGET_CHUNK_SIZE) {
    chunks.push(keys.slice(i, i + MGET_CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((chunk) => redis.mget<(T | string | null)[]>(...chunk)));

  return results.flat().map((item) => {
    if (!item) return null;
    if (typeof item === "string") {
      try {
        return JSON.parse(item) as T;
      } catch {
        return null;
      }
    }
    return item as T;
  });
}

async function getActiveEventIds(sport: string): Promise<string[]> {
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    return activeSet.map(String);
  }

  const eventKeys = await scanKeys(`events:${sport}:*`);
  return eventKeys.map((key) => key.split(":")[2]).filter(Boolean);
}

async function getEventMetaMap(sport: string, eventIds: string[]): Promise<Map<string, EventMeta>> {
  const map = new Map<string, EventMeta>();
  if (eventIds.length === 0) return map;

  const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
  const rawEvents = await mgetChunked<Record<string, unknown>>(eventKeys);
  const now = Date.now();
  const LOOKAHEAD_MS = 36 * 60 * 60 * 1000;
  const LOOKBACK_MS = 60 * 60 * 1000;

  eventIds.forEach((eventId, idx) => {
    const event = rawEvents[idx];
    if (!event) return;

    const homeTeam = String(event.home_team || "");
    const awayTeam = String(event.away_team || "");
    const startTime = String(event.commence_time || event.start_time || "");
    const isLive = event.is_live === true;
    if (!homeTeam || !awayTeam || !startTime || isLive) return;

    const startMs = new Date(startTime).getTime();
    if (!Number.isFinite(startMs)) return;
    if (startMs < now - LOOKBACK_MS) return;
    if (startMs > now + LOOKAHEAD_MS) return;

    map.set(eventId, {
      eventId,
      homeTeam,
      awayTeam,
      startTime,
    });
  });

  return map;
}

function shouldUseTargetLine(selection: SSESelection, keyLine: string, targetLine: number): boolean {
  const selectionLine = Number.isFinite(selection.line) ? selection.line : parseFloat(keyLine);
  if (!Number.isFinite(selectionLine)) return false;
  return Math.abs(selectionLine - targetLine) < 0.01;
}

function ensureCandidate(
  map: Map<string, SheetCandidate>,
  eventMeta: EventMeta,
  playerKey: string,
  playerId: string,
  playerName: string,
  team: string | null
): SheetCandidate {
  const key = `${eventMeta.eventId}:${playerId || playerKey}`;
  let candidate = map.get(key);
  if (!candidate) {
    candidate = {
      key,
      eventId: eventMeta.eventId,
      playerId,
      player: playerName || formatDisplayPlayer(playerKey),
      team,
      matchup: `${eventMeta.awayTeam} @ ${eventMeta.homeTeam}`,
      startTime: eventMeta.startTime,
      legsByBook: {},
      tdByBook: {},
    };
    map.set(key, candidate);
  } else {
    if (!candidate.player && playerName) candidate.player = playerName;
    if (!candidate.team && team) candidate.team = team;
  }
  return candidate;
}

async function collectCandidatesForEvent(
  sport: string,
  eventMeta: EventMeta,
  allowedBooks: Set<string>,
  targetLine: number,
  out: Map<string, SheetCandidate>
): Promise<void> {
  const desiredMarkets = new Set<string>([
    BASE_MARKETS.points,
    BASE_MARKETS.rebounds,
    BASE_MARKETS.assists,
    ...TD_MARKETS,
  ]);

  const [rawIndexMembers, rawIndexedMarkets] = await Promise.all([
    redis.smembers(`odds_idx:${sport}:${eventMeta.eventId}`),
    redis.smembers(`markets_idx:${sport}:${eventMeta.eventId}`),
  ]);

  const keysToFetch = new Set<string>();
  const marketsToProbe = new Set<string>();

  for (const raw of rawIndexedMarkets || []) {
    const market = String(raw);
    if (desiredMarkets.has(market)) {
      marketsToProbe.add(market);
    }
  }

  for (const raw of rawIndexMembers || []) {
    const parsed = parseOddsIndexMember(String(raw));
    if (!parsed || !desiredMarkets.has(parsed.market)) continue;

    marketsToProbe.add(parsed.market);
    const normalizedBook = normalizeBookId(parsed.book);
    if (!allowedBooks.has(normalizedBook)) continue;

    for (const bookCandidate of getBookKeyCandidates(parsed.book)) {
      keysToFetch.add(`odds:${sport}:${eventMeta.eventId}:${parsed.market}:${bookCandidate}`);
    }
  }

  if (marketsToProbe.size === 0) {
    for (const market of desiredMarkets) {
      marketsToProbe.add(market);
    }
  }

  // Deterministic fallback to recover data when indexes are stale/incomplete.
  for (const market of marketsToProbe) {
    for (const allowedBook of allowedBooks) {
      for (const bookCandidate of getBookKeyCandidates(allowedBook)) {
        keysToFetch.add(`odds:${sport}:${eventMeta.eventId}:${market}:${bookCandidate}`);
      }
    }
  }

  const allKeys = [...keysToFetch];
  if (allKeys.length === 0) return;

  const allData = await mgetChunked<SSEBookSelections>(allKeys);

  allKeys.forEach((key, idx) => {
    const selections = allData[idx];
    if (!selections) return;

    const parts = key.split(":");
    const market = parts[3];
    const rawBook = parts[4] || "";
    const book = normalizeBookId(rawBook);
    if (!allowedBooks.has(book)) return;

    const baseLegByMarket: Record<string, BaseLegKey | undefined> = {
      [BASE_MARKETS.points]: "points",
      [BASE_MARKETS.rebounds]: "rebounds",
      [BASE_MARKETS.assists]: "assists",
    };

    const baseLeg = baseLegByMarket[market];

    if (baseLeg) {
      for (const [selectionKey, sel] of Object.entries(selections)) {
        if (!sel || sel.locked || !sel.sgp) continue;
        const [playerRaw, sideRaw, keyLine] = selectionKey.split("|");
        if (!playerRaw || !sideRaw || !keyLine) continue;
        if (sideRaw !== "over") continue;
        if (!shouldUseTargetLine(sel, keyLine, targetLine)) continue;

        const playerId = sel.player_id || playerRaw;
        const candidate = ensureCandidate(
          out,
          eventMeta,
          playerRaw,
          playerId,
          sel.player || formatDisplayPlayer(playerRaw),
          sel.team || null
        );

        if (!candidate.legsByBook[book]) candidate.legsByBook[book] = {};
        candidate.legsByBook[book][baseLeg] = sel.sgp;
      }
      return;
    }

    if (TD_MARKETS.includes(market)) {
      for (const [selectionKey, sel] of Object.entries(selections)) {
        if (!sel || sel.locked) continue;
        const [playerRaw, sideRaw] = selectionKey.split("|");
        if (!playerRaw || !sideRaw) continue;
        if (!["yes", "ml", "over"].includes(sideRaw)) continue;

        const price = parseAmericanOdds(sel.price);
        if (price === null) continue;

        const playerId = sel.player_id || playerRaw;
        const candidate = ensureCandidate(
          out,
          eventMeta,
          playerRaw,
          playerId,
          sel.player || formatDisplayPlayer(playerRaw),
          sel.team || null
        );

        const existing = candidate.tdByBook[book];
        if (!existing || price > existing.price) {
          candidate.tdByBook[book] = {
            price,
            priceFormatted: formatOdds(price),
            link: sel.link || null,
            mobileLink: sel.mobile_link || null,
          };
        }
      }
    }
  });
}

function countBooksWithLegs(candidate: SheetCandidate): { ra: number; pra: number } {
  let ra = 0;
  let pra = 0;
  for (const legs of Object.values(candidate.legsByBook)) {
    if (legs.rebounds && legs.assists) ra += 1;
    if (legs.points && legs.rebounds && legs.assists) pra += 1;
  }
  return { ra, pra };
}

function getBestTd(candidate: SheetCandidate): SheetBestPrice | null {
  let best: { book: string; value: BookTdPrice } | null = null;
  for (const [book, td] of Object.entries(candidate.tdByBook)) {
    if (!best || td.price > best.value.price) {
      best = { book, value: td };
    }
  }
  if (!best) return null;
  return {
    book: best.book,
    price: best.value.price,
    priceFormatted: best.value.priceFormatted,
    link: best.value.link,
    mobileLink: best.value.mobileLink,
  };
}

interface QuoteTask {
  candidateKey: string;
  combo: "ra" | "pra";
  book: string;
  tokens: string[];
}

function buildQuoteTasks(candidates: SheetCandidate[]): QuoteTask[] {
  const tasks: QuoteTask[] = [];
  for (const candidate of candidates) {
    for (const [book, legs] of Object.entries(candidate.legsByBook)) {
      if (legs.rebounds && legs.assists) {
        tasks.push({
          candidateKey: candidate.key,
          combo: "ra",
          book,
          tokens: [legs.rebounds, legs.assists],
        });
      }
      if (legs.points && legs.rebounds && legs.assists) {
        tasks.push({
          candidateKey: candidate.key,
          combo: "pra",
          book,
          tokens: [legs.points, legs.rebounds, legs.assists],
        });
      }
    }
  }
  return tasks;
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const safeConcurrency = Math.max(1, concurrency);
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(safeConcurrency, tasks.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  });

  await Promise.all(workers);
  return results;
}

function bestQuoteForCombo(quotes: ComboQuote[], combo: "ra" | "pra"): SheetBestPrice | null {
  const successful = quotes.filter(
    (quote) => quote.combo === combo && quote.price !== null && !quote.error
  );
  if (successful.length === 0) return null;

  successful.sort((a, b) => (b.price || 0) - (a.price || 0));
  const top = successful[0];
  if (top.price === null || !top.priceFormatted) return null;

  return {
    book: top.book,
    price: top.price,
    priceFormatted: top.priceFormatted,
    link: top.link,
    mobileLink: top.mobileLink,
    source: top.source,
    fromCache: top.fromCache,
    stale: top.stale,
  };
}

function sortRows(rows: TripleDoubleSheetRow[]): TripleDoubleSheetRow[] {
  return [...rows].sort((a, b) => {
    const aMax = Math.max(a.sgp_pra?.price || -999999, a.sgp_ra?.price || -999999, a.td?.price || -999999);
    const bMax = Math.max(b.sgp_pra?.price || -999999, b.sgp_ra?.price || -999999, b.td?.price || -999999);
    return bMax - aMax;
  });
}

export async function computeTripleDoubleSheet(
  options: TripleDoubleSheetComputeOptions = {}
): Promise<TripleDoubleSheetData> {
  const sport = (options.sport || DEFAULT_SPORT).toLowerCase();
  const targetLine = sanitizeLine(options.targetLine, DEFAULT_TARGET_LINE);
  const maxCandidates = sanitizePositiveInt(options.maxCandidates, DEFAULT_MAX_CANDIDATES);
  const maxRows = sanitizePositiveInt(options.maxRows, DEFAULT_MAX_ROWS);
  const concurrency = sanitizePositiveInt(options.concurrency, DEFAULT_CONCURRENCY);
  const books = resolveAllowedBooks(options.books);
  const bookSet = new Set(books);

  const eventIds = await getActiveEventIds(sport);
  const eventMetaMap = await getEventMetaMap(sport, eventIds);

  const candidates = new Map<string, SheetCandidate>();
  await Promise.all(
    Array.from(eventMetaMap.values()).map((eventMeta) =>
      collectCandidatesForEvent(sport, eventMeta, bookSet, targetLine, candidates)
    )
  );

  const shortlisted = Array.from(candidates.values())
    .filter((candidate) => {
      const counts = countBooksWithLegs(candidate);
      return counts.ra > 0 || counts.pra > 0;
    })
    .sort((a, b) => {
      const aTd = getBestTd(a)?.price || -999999;
      const bTd = getBestTd(b)?.price || -999999;
      if (bTd !== aTd) return bTd - aTd;
      const aCounts = countBooksWithLegs(a);
      const bCounts = countBooksWithLegs(b);
      return (bCounts.pra + bCounts.ra) - (aCounts.pra + aCounts.ra);
    })
    .slice(0, maxCandidates);

  const quoteTasks = buildQuoteTasks(shortlisted);
  const taskFns = quoteTasks.map((task) => async (): Promise<{ task: QuoteTask; quote: ComboQuote }> => {
    try {
      const result = await fetchSgpQuote(task.book, task.tokens, {
        allowStaleOnRateLimit: true,
        allowStaleOnLockTimeout: true,
      });

      const price = parseAmericanOdds(result.odds.price);
      return {
        task,
        quote: {
          combo: task.combo,
          book: task.book,
          price,
          priceFormatted: price !== null ? formatOdds(price) : null,
          link: result.odds.links?.desktop || null,
          mobileLink: result.odds.links?.mobile || null,
          error: result.odds.error,
          source: result.source,
          fromCache: result.fromCache,
          stale: result.stale,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[triple-double-sheet] quote task failed", {
        book: task.book,
        combo: task.combo,
        tokenCount: task.tokens.length,
        error: message,
      });
      return {
        task,
        quote: {
          combo: task.combo,
          book: task.book,
          price: null,
          priceFormatted: null,
          link: null,
          mobileLink: null,
          error: "quote_unavailable",
          source: "vendor",
          fromCache: false,
          stale: false,
        },
      };
    }
  });

  const quoteResults = quoteTasks.length
    ? await runWithConcurrency(taskFns, concurrency)
    : [];

  const quotesByCandidate = new Map<string, ComboQuote[]>();
  for (const result of quoteResults) {
    const list = quotesByCandidate.get(result.task.candidateKey) || [];
    list.push(result.quote);
    quotesByCandidate.set(result.task.candidateKey, list);
  }

  const rows: TripleDoubleSheetRow[] = shortlisted.map((candidate) => {
    const quotes = quotesByCandidate.get(candidate.key) || [];
    const counts = countBooksWithLegs(candidate);

    return {
      id: candidate.key,
      player: candidate.player,
      team: candidate.team,
      matchup: candidate.matchup,
      eventId: candidate.eventId,
      startTime: candidate.startTime,
      sgp_ra: bestQuoteForCombo(quotes, "ra"),
      sgp_pra: bestQuoteForCombo(quotes, "pra"),
      td: getBestTd(candidate),
      hasAllThreeLegs: counts.pra > 0,
      booksWithRa: counts.ra,
      booksWithPra: counts.pra,
    };
  });

  const sortedRows = sortRows(rows).slice(0, maxRows);
  const generatedAt = Date.now();
  const generatedAtIso = new Date(generatedAt).toISOString();

  const vendorCalls = quoteResults.filter((entry) => entry.quote.source === "vendor").length;
  const cacheHits = quoteResults.filter((entry) => entry.quote.fromCache).length;
  const staleServed = quoteResults.filter((entry) => entry.quote.stale).length;
  const errors = quoteResults.filter((entry) => !!entry.quote.error).length;

  const meta: TripleDoubleSheetMeta = {
    sport,
    targetLine,
    candidateCount: shortlisted.length,
    rowCount: sortedRows.length,
    books,
    quoteStats: {
      totalRequests: quoteResults.length,
      vendorCalls,
      cacheHits,
      staleServed,
      errors,
    },
  };

  return {
    rows: sortedRows,
    generatedAt,
    generatedAtIso,
    meta,
  };
}

export async function storeTripleDoubleSheet(data: TripleDoubleSheetData): Promise<void> {
  if (cacheDisabled) return;

  try {
    await Promise.all([
      redis.set(REDIS_SHEET_DATA_KEY, data, { ex: SHEET_CACHE_TTL_SECONDS }),
      redis.set(REDIS_SHEET_TIMESTAMP_KEY, data.generatedAt, { ex: SHEET_CACHE_TTL_SECONDS }),
    ]);
  } catch (error) {
    if (isSubscriberModeError(error)) {
      cacheDisabled = true;
      if (!cacheDisableLogged) {
        console.warn("[triple-double-sheet] Disabling Redis sheet cache writes due to subscriber-mode connection");
        cacheDisableLogged = true;
      }
      return;
    }
    throw error;
  }
}

export async function getTripleDoubleSheetCache(
  maxAgeMs: number = SHEET_CACHE_TTL_SECONDS * 1000
): Promise<TripleDoubleSheetData | null> {
  if (cacheDisabled) return null;

  let rawData: TripleDoubleSheetData | null = null;
  let rawTs: number | string | null = null;
  try {
    [rawData, rawTs] = await Promise.all([
      redis.get<TripleDoubleSheetData>(REDIS_SHEET_DATA_KEY),
      redis.get<number | string>(REDIS_SHEET_TIMESTAMP_KEY),
    ]);
  } catch (error) {
    if (isSubscriberModeError(error)) {
      cacheDisabled = true;
      if (!cacheDisableLogged) {
        console.warn("[triple-double-sheet] Disabling Redis sheet cache reads due to subscriber-mode connection");
        cacheDisableLogged = true;
      }
      return null;
    }
    throw error;
  }

  if (!rawData || rawTs === null || rawTs === undefined) return null;
  const ts = typeof rawTs === "string" ? parseInt(rawTs, 10) : Number(rawTs);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > maxAgeMs) return null;
  return rawData;
}
