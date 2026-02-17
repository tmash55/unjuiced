import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getCachedData, setCachedData } from "@/lib/redis";
import type {
  LineHistoryApiRequest,
  LineHistoryApiResponse,
  LineHistoryBookData,
  LineHistoryContext,
  LineHistoryPoint,
} from "@/lib/odds/line-history";

const ODDSBLAZE_API_KEY = process.env.ODDSBLAZE_API_KEY;
const ODDSBLAZE_HISTORY_ENDPOINT = "https://historical.oddsblaze.com/";
const HISTORY_CACHE_TTL_SECONDS = 180;
const HISTORY_NEGATIVE_CACHE_TTL_SECONDS = 90;
const REQUEST_TIMEOUT_MS = 6000;
const MAX_ID_ATTEMPTS = 24;

interface VendorHistorySelection {
  name?: string;
  line?: number | string | null;
}

interface VendorHistorySnapshot {
  price?: string | number | null;
  timestamp?: number | string | null;
}

interface VendorHistoryEntry {
  price?: string | number | null;
  timestamp?: number | string | null;
}

interface VendorHistoricalOdds {
  updated?: string | null;
  id?: string;
  market?: string;
  name?: string;
  selection?: VendorHistorySelection;
  olv?: VendorHistorySnapshot;
  clv?: VendorHistorySnapshot;
  entries?: VendorHistoryEntry[];
}

interface HistoryIdCandidate {
  id: string;
  market: string;
  selection: string;
}

const BOOK_NAME_OVERRIDES: Record<string, string[]> = {
  espn: ["ESPNBet", "ESPN BET"],
  "hard-rock": ["Hard Rock", "Hard-Rock"],
  "bally-bet": ["Bally Bet", "Bally-Bet"],
  betmgm: ["BetMGM"],
  fanduel: ["FanDuel"],
  draftkings: ["DraftKings"],
};

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCaseFromKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLineValue(line?: number | null): string {
  if (line == null || Number.isNaN(line)) return "";
  if (Number.isInteger(line)) return String(line);
  return String(line).replace(/\.?0+$/, "");
}

function formatSignedLine(line?: number | null): string {
  if (line == null || Number.isNaN(line)) return "";
  const value = formatLineValue(line);
  if (!value) return "";
  return Number(line) > 0 ? `+${value}` : value;
}

function parseAmericanPrice(price: unknown): number | null {
  if (typeof price === "number" && Number.isFinite(price)) return Math.round(price);
  if (typeof price !== "string") return null;
  const normalized = price
    .replace(/\u2212/g, "-")
    .replace(/[^\d+-]/g, "")
    .trim();
  const parsed = parseInt(normalized.replace("+", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEpoch(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function isMoneylineMarket(context: LineHistoryContext): boolean {
  const combined = `${context.market || ""} ${context.marketDisplay || ""}`.toLowerCase();
  return combined.includes("moneyline") || combined.includes("money line");
}

function isSpreadMarket(context: LineHistoryContext): boolean {
  const combined = `${context.market || ""} ${context.marketDisplay || ""}`.toLowerCase();
  return (
    combined.includes("spread") ||
    combined.includes("run line") ||
    combined.includes("puck line") ||
    combined.includes("handicap")
  );
}

function isTotalMarket(context: LineHistoryContext): boolean {
  const combined = `${context.market || ""} ${context.marketDisplay || ""}`.toLowerCase();
  return (
    combined.includes("total") ||
    combined.includes("goals") ||
    combined.includes("rounds")
  );
}

function bookNameCandidates(bookId: string): string[] {
  const metaName = getSportsbookById(bookId)?.name;
  const fromOverrides = BOOK_NAME_OVERRIDES[bookId] || [];
  const fromId = toTitleCaseFromKey(bookId);
  const all = [metaName, ...fromOverrides, fromId, bookId];
  return Array.from(new Set(all.filter(Boolean).map((value) => normalizeSpace(String(value)))));
}

function marketNameCandidates(context: LineHistoryContext): string[] {
  const candidates = new Set<string>();
  const marketLabel = context.market ? formatMarketLabel(context.market) : "";
  const prettyKey = context.market ? toTitleCaseFromKey(context.market) : "";

  if (context.marketDisplay) candidates.add(normalizeSpace(context.marketDisplay));
  if (marketLabel) candidates.add(normalizeSpace(marketLabel));
  if (prettyKey) candidates.add(normalizeSpace(prettyKey));

  const marketKey = (context.market || "").toLowerCase();
  const sport = (context.sport || "").toLowerCase();

  if (marketKey === "game_spread" || marketKey.includes("spread")) {
    candidates.add("Spread");
    if (sport === "mlb" || sport === "ncaabaseball") candidates.add("Run Line");
    if (sport === "nhl") candidates.add("Puck Line");
  }

  if (marketKey === "game_total" || marketKey.includes("total")) {
    candidates.add("Total");
    candidates.add("Game Total");
    if (sport.startsWith("soccer_")) {
      candidates.add("Total Goals");
      candidates.add("Match Goals");
    }
  }

  if (marketKey === "game_moneyline" || marketKey.includes("moneyline")) {
    candidates.add("Moneyline");
    if (sport.startsWith("soccer_")) {
      candidates.add("Match Result");
      candidates.add("Match Winner");
    }
    if (sport === "ufc") candidates.add("Fight Winner");
  }

  return Array.from(candidates).filter(Boolean);
}

function selectionNameCandidates(context: LineHistoryContext): string[] {
  const selectionCandidates = new Set<string>();
  const baseCandidates = [
    context.selectionName,
    context.team,
    context.playerName,
    context.homeTeam,
    context.awayTeam,
  ]
    .filter(Boolean)
    .map((value) => normalizeSpace(String(value)));

  baseCandidates.forEach((base) => selectionCandidates.add(base));

  const side = context.side || "over";
  const line = context.line ?? null;
  const lineValue = formatLineValue(line);
  const signedLine = formatSignedLine(line);
  const sideWord =
    side === "over" ? "Over" : side === "under" ? "Under" : side === "yes" ? "Yes" : side === "no" ? "No" : "";

  if (isMoneylineMarket(context)) {
    baseCandidates.forEach((base) => selectionCandidates.add(base));
  } else if (isSpreadMarket(context)) {
    if (lineValue) {
      baseCandidates.forEach((base) => {
        if (signedLine) selectionCandidates.add(`${base} ${signedLine}`);
        selectionCandidates.add(`${base} ${lineValue}`);
      });
    }
    if (lineValue && (side === "over" || side === "under")) {
      selectionCandidates.add(`${sideWord} ${lineValue}`);
    }
  } else if (isTotalMarket(context)) {
    if (lineValue && sideWord) {
      selectionCandidates.add(`${sideWord} ${lineValue}`);
      baseCandidates.forEach((base) => selectionCandidates.add(`${base} ${sideWord} ${lineValue}`));
    }
  } else {
    if (lineValue && sideWord) {
      selectionCandidates.add(`${sideWord} ${lineValue}`);
      baseCandidates.forEach((base) => selectionCandidates.add(`${base} ${sideWord} ${lineValue}`));
    }
  }

  return Array.from(selectionCandidates).filter(Boolean);
}

function buildHistoryIdCandidates(context: LineHistoryContext, bookId: string): HistoryIdCandidate[] {
  const books = bookNameCandidates(bookId);
  const markets = marketNameCandidates(context);
  const selections = selectionNameCandidates(context);
  const eventId = context.eventId;

  const candidates: HistoryIdCandidate[] = [];
  const seen = new Set<string>();

  for (const bookName of books) {
    for (const marketName of markets) {
      for (const selectionName of selections) {
        if (!selectionName || !marketName) continue;
        const id = `${bookName}#${eventId}#${marketName}#${selectionName}`;
        if (seen.has(id)) continue;
        seen.add(id);
        candidates.push({ id, market: marketName, selection: selectionName });
        if (candidates.length >= MAX_ID_ATTEMPTS) return candidates;
      }
    }
  }

  return candidates;
}

async function fetchHistoricalById(id: string): Promise<VendorHistoricalOdds | null> {
  if (!ODDSBLAZE_API_KEY) return null;

  const params = new URLSearchParams({
    key: ODDSBLAZE_API_KEY,
    id,
    price: "american",
    time_series: "true",
    locked: "false",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${ODDSBLAZE_HISTORY_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const json = await response.json();
    const payload = Array.isArray(json) ? json[0] : json?.data || json?.result || json;
    if (!payload || typeof payload !== "object") return null;
    if (payload.error) return null;
    return payload as VendorHistoricalOdds;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildBookHistoryFromVendor(
  context: LineHistoryContext,
  bookId: string,
  bookName: string,
  raw: VendorHistoricalOdds,
  resolvedId: string
): LineHistoryBookData {
  const entries: LineHistoryPoint[] = (raw.entries || [])
    .map((entry) => ({
      price: parseAmericanPrice(entry.price) ?? NaN,
      timestamp: parseEpoch(entry.timestamp) ?? NaN,
    }))
    .filter((entry) => Number.isFinite(entry.price) && Number.isFinite(entry.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const olvPrice = parseAmericanPrice(raw.olv?.price);
  const olvTime = parseEpoch(raw.olv?.timestamp);
  const clvPrice = parseAmericanPrice(raw.clv?.price);
  const clvTime = parseEpoch(raw.clv?.timestamp);

  if (entries.length === 0) {
    if (olvPrice != null && olvTime != null) entries.push({ price: olvPrice, timestamp: olvTime });
    if (clvPrice != null && clvTime != null && clvTime !== olvTime) entries.push({ price: clvPrice, timestamp: clvTime });
  }

  return {
    bookId,
    bookName,
    status: entries.length > 0 || olvPrice != null || clvPrice != null ? "ok" : "not_found",
    message: entries.length > 0 || olvPrice != null || clvPrice != null ? undefined : "No historical prices found for this selection.",
    oddsId: raw.id || resolvedId,
    market: raw.market || context.marketDisplay || context.market,
    selection: raw.name || raw.selection?.name || context.selectionName || null,
    updated: raw.updated || null,
    olv: {
      price: olvPrice,
      timestamp: olvTime,
    },
    clv: {
      price: clvPrice,
      timestamp: clvTime,
    },
    currentPrice: context.currentPricesByBook?.[bookId] ?? clvPrice ?? null,
    entries,
    source: "vendor",
  };
}

function buildCacheKey(context: LineHistoryContext, bookId: string): string {
  const raw = [
    context.source,
    context.sport,
    context.eventId,
    context.market,
    context.marketDisplay || "",
    context.selectionName || "",
    context.playerName || "",
    context.team || "",
    context.homeTeam || "",
    context.awayTeam || "",
    context.side || "",
    context.line ?? "",
    bookId,
  ]
    .join("|")
    .toLowerCase();
  const digest = createHash("sha1").update(raw).digest("hex");
  return `odds_history:v1:${digest}`;
}

async function fetchBookHistory(context: LineHistoryContext, bookId: string): Promise<LineHistoryBookData> {
  const cacheKey = buildCacheKey(context, bookId);
  const cached = await getCachedData<LineHistoryBookData>(cacheKey);
  if (cached) {
    return { ...cached, source: "cache" };
  }

  const bookName = getSportsbookById(bookId)?.name || bookId;
  if (!ODDSBLAZE_API_KEY) {
    return {
      bookId,
      bookName,
      status: "error",
      message: "ODDSBLAZE_API_KEY is not configured.",
      olv: { price: null, timestamp: null },
      clv: { price: null, timestamp: null },
      currentPrice: context.currentPricesByBook?.[bookId] ?? null,
      entries: [],
      source: "vendor",
    };
  }

  // Try the exact odd_id first if available (most reliable)
  const directOddId = context.oddIdsByBook?.[bookId];
  if (directOddId) {
    console.log(`[line-history] Trying direct odd_id for ${bookId}: ${directOddId}`);
    const payload = await fetchHistoricalById(directOddId);
    if (payload) {
      console.log(`[line-history] Direct odd_id HIT for ${bookId}, entries: ${payload.entries?.length ?? 0}`);
      const result = buildBookHistoryFromVendor(context, bookId, bookName, payload, directOddId);
      const ttl = result.status === "ok" ? HISTORY_CACHE_TTL_SECONDS : HISTORY_NEGATIVE_CACHE_TTL_SECONDS;
      await setCachedData(cacheKey, result, ttl);
      return result;
    }
    console.log(`[line-history] Direct odd_id MISS for ${bookId}`);
  }

  // Fall back to candidate generation
  const idCandidates = buildHistoryIdCandidates(context, bookId);
  for (const candidate of idCandidates) {
    const payload = await fetchHistoricalById(candidate.id);
    if (!payload) continue;

    console.log(`[line-history] Candidate HIT for ${bookId}: ${candidate.id}, entries: ${payload.entries?.length ?? 0}`);
    const result = buildBookHistoryFromVendor(context, bookId, bookName, payload, candidate.id);
    const ttl = result.status === "ok" ? HISTORY_CACHE_TTL_SECONDS : HISTORY_NEGATIVE_CACHE_TTL_SECONDS;
    await setCachedData(cacheKey, result, ttl);
    return result;
  }

  const notFound: LineHistoryBookData = {
    bookId,
    bookName,
    status: "not_found",
    message: "Could not match an OddsBlaze historical ID for this selection.",
    olv: { price: null, timestamp: null },
    clv: { price: null, timestamp: null },
    currentPrice: context.currentPricesByBook?.[bookId] ?? null,
    entries: [],
    source: "vendor",
  };
  await setCachedData(cacheKey, notFound, HISTORY_NEGATIVE_CACHE_TTL_SECONDS);
  return notFound;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LineHistoryApiRequest;
    const context = body?.context;
    const books = Array.isArray(body?.books) ? body.books : [];

    if (!context?.sport || !context?.eventId || !context?.market) {
      return NextResponse.json({ error: "Missing required context fields." }, { status: 400 });
    }

    const uniqueBooks = Array.from(new Set(books.filter(Boolean)));
    if (uniqueBooks.length === 0) {
      return NextResponse.json({ books: [] satisfies LineHistoryBookData[] } satisfies LineHistoryApiResponse);
    }

    const bookResults = await Promise.all(uniqueBooks.map((bookId) => fetchBookHistory(context, bookId)));
    return NextResponse.json({ books: bookResults } satisfies LineHistoryApiResponse, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    });
  } catch (error) {
    console.error("[/api/v2/odds/line-history] Error:", error);
    return NextResponse.json({ error: "Failed to load line history." }, { status: 500 });
  }
}
