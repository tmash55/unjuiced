import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import {
  SSEBookSelections,
  SSESelection,
  getBookOddsKey,
  normalizeFavoriteOddsKey,
  normalizePlayerName,
} from "@/lib/odds/types";
import { redis } from "@/lib/redis";

export interface SgpTokenLegInput {
  favorite_id?: string | null;
  sport?: string | null;
  event_id?: string | null;
  market?: string | null;
  odds_key?: string | null;
  player_id?: string | null;
  player_name?: string | null;
  line?: number | null;
  side?: string | null;
  sgp_tokens?: Record<string, string | null | undefined> | null;
  books_snapshot?: Record<string, { sgp?: string | null } | null | undefined> | null;
}

export interface ResolvedSgpLeg extends SgpTokenLegInput {
  event_id: string;
  market: string;
  side: string;
  line: number | null;
  sgp_tokens: Record<string, string>;
}

export interface SgpTokenCoverageBook {
  tokens: number;
  has_all_legs: boolean;
  missing_leg_ids: string[];
}

export interface SgpTokenCoverage {
  total_legs: number;
  by_book: Record<string, SgpTokenCoverageBook>;
  full_support_books: string[];
  partial_support_books: string[];
}

export interface ResolveSgpTokensResult {
  legs: ResolvedSgpLeg[];
  coverage: SgpTokenCoverage;
}

export interface BuildBookTokenMapResult {
  bookTokensMap: Map<string, string[]>;
  bookLegsCount: Map<string, number>;
}

type BookSelectionsByBook = Record<string, SSEBookSelections>;
type MarketSelectionCache = Map<string, Promise<BookSelectionsByBook>>;

const LINE_TOLERANCE = 0.001;

export function getSgpSupportingBooks(): string[] {
  return Object.entries(SPORTSBOOKS_META)
    .filter(([, meta]) => meta.sgp === true && meta.isActive === true)
    .map(([id]) => id);
}

function tokenizePlayerName(name: string): string[] {
  return normalizePlayerName(name)
    .replace(/[^a-z0-9_]/g, "_")
    .split("_")
    .filter(Boolean);
}

function playerNamesMatch(
  legPlayerName: string | null | undefined,
  selectionPlayerName: string | null | undefined
): boolean {
  const legPlayer = normalizePlayerName(legPlayerName || "");
  if (!legPlayer) return true;

  const selectionPlayer = normalizePlayerName(selectionPlayerName || "");
  if (!selectionPlayer) return false;
  if (selectionPlayer.includes(legPlayer) || legPlayer.includes(selectionPlayer)) return true;

  const legTokens = tokenizePlayerName(legPlayerName || "");
  const selectionTokens = tokenizePlayerName(selectionPlayerName || "");
  if (legTokens.length === 0 || selectionTokens.length === 0) return false;

  return legTokens.every((token) => selectionTokens.includes(token));
}

function normalizeBookList(books?: string[]): string[] {
  const sgpBooks = new Set(getSgpSupportingBooks());
  const requestedBooks = books?.length ? books : Array.from(sgpBooks);
  return Array.from(new Set(requestedBooks.filter((bookId) => sgpBooks.has(bookId))));
}

function getLegId(leg: SgpTokenLegInput, index: number): string {
  return leg.favorite_id || `${leg.event_id || "unknown"}:${leg.market || "unknown"}:${index}`;
}

function collectSavedTokens(
  leg: SgpTokenLegInput,
  booksToFetch: string[]
): Record<string, string> {
  const tokens: Record<string, string> = {};

  for (const bookId of booksToFetch) {
    const liveToken = leg.sgp_tokens?.[bookId];
    const snapshotToken = leg.books_snapshot?.[bookId]?.sgp;
    const token = liveToken || snapshotToken;
    if (token) tokens[bookId] = token;
  }

  return tokens;
}

async function getBookSelectionsForOddsKey(
  oddsKey: string,
  booksToFetch: string[],
  cache: MarketSelectionCache
): Promise<BookSelectionsByBook> {
  const cached = cache.get(oddsKey);
  if (cached) return cached;

  const promise = (async () => {
    const [, sport, eventId, market] = oddsKey.split(":");
    if (!sport || !eventId || !market || booksToFetch.length === 0) return {};

    const bookKeys = booksToFetch.map((bookId) => getBookOddsKey(sport, eventId, market, bookId));
    const bookDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...bookKeys);
    const bookSelections: BookSelectionsByBook = {};

    bookKeys.forEach((key, index) => {
      const bookId = key.split(":").pop();
      const raw = bookDataRaw[index];
      if (!bookId || !raw || !booksToFetch.includes(bookId)) return;

      try {
        bookSelections[bookId] = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (error) {
        console.warn("[SGP Tokens] Failed to parse Redis odds payload", { bookId, oddsKey, error });
      }
    });

    return bookSelections;
  })();

  cache.set(oddsKey, promise);
  return promise;
}

function selectionMatchesLeg(
  selection: SSESelection,
  leg: SgpTokenLegInput,
  requireExactLine: boolean
): boolean {
  if (selection.locked || !selection.sgp) return false;
  if ((selection.side || "").toLowerCase() !== (leg.side || "").toLowerCase()) return false;

  if (requireExactLine && leg.line !== null && leg.line !== undefined) {
    const selectionLine = Number(selection.line);
    const legLine = Number(leg.line);
    if (!Number.isFinite(selectionLine) || !Number.isFinite(legLine)) return false;
    if (Math.abs(selectionLine - legLine) > LINE_TOLERANCE) return false;
  }

  const legPlayerId = String(leg.player_id || "").trim().toLowerCase();
  const selectionPlayerId = String(selection.player_id || "").trim().toLowerCase();
  if (legPlayerId && selectionPlayerId && legPlayerId === selectionPlayerId) return true;

  return playerNamesMatch(leg.player_name, selection.player);
}

async function resolveLegTokens(
  leg: SgpTokenLegInput,
  booksToFetch: string[],
  cache: MarketSelectionCache,
  requireExactLine: boolean,
  loggerPrefix: string
): Promise<ResolvedSgpLeg> {
  const sgpTokens = collectSavedTokens(leg, booksToFetch);
  const oddsKey = normalizeFavoriteOddsKey({
    oddsKey: leg.odds_key,
    sport: leg.sport,
    eventId: leg.event_id,
    market: leg.market,
  });

  if (oddsKey) {
    try {
      const bookSelections = await getBookSelectionsForOddsKey(oddsKey, booksToFetch, cache);

      for (const [bookId, selections] of Object.entries(bookSelections)) {
        for (const selection of Object.values(selections)) {
          if (!selectionMatchesLeg(selection, leg, requireExactLine)) continue;
          sgpTokens[bookId] = selection.sgp!;
          break;
        }
      }
    } catch (error) {
      console.warn(`${loggerPrefix} Failed to hydrate SGP tokens`, {
        favoriteId: leg.favorite_id,
        eventId: leg.event_id,
        market: leg.market,
        error,
      });
    }
  }

  return {
    ...leg,
    event_id: leg.event_id || "",
    market: leg.market || "",
    side: (leg.side || "").toLowerCase(),
    line: leg.line ?? null,
    sgp_tokens: sgpTokens,
  };
}

function buildCoverage(legs: ResolvedSgpLeg[], booksToFetch: string[]): SgpTokenCoverage {
  const byBook: Record<string, SgpTokenCoverageBook> = {};
  const fullSupportBooks: string[] = [];
  const partialSupportBooks: string[] = [];
  const totalLegs = legs.length;

  for (const bookId of booksToFetch) {
    const missingLegIds: string[] = [];
    let tokens = 0;

    legs.forEach((leg, index) => {
      if (leg.sgp_tokens[bookId]) {
        tokens += 1;
      } else {
        missingLegIds.push(getLegId(leg, index));
      }
    });

    const hasAllLegs = totalLegs > 0 && tokens === totalLegs;
    if (hasAllLegs) fullSupportBooks.push(bookId);
    if (tokens > 0 && !hasAllLegs) partialSupportBooks.push(bookId);

    byBook[bookId] = {
      tokens,
      has_all_legs: hasAllLegs,
      missing_leg_ids: missingLegIds,
    };
  }

  return {
    total_legs: totalLegs,
    by_book: byBook,
    full_support_books: fullSupportBooks,
    partial_support_books: partialSupportBooks,
  };
}

export async function resolveSgpTokensForLegs(
  legs: SgpTokenLegInput[],
  options: {
    books?: string[];
    requireExactLine?: boolean;
    loggerPrefix?: string;
  } = {}
): Promise<ResolveSgpTokensResult> {
  const booksToFetch = normalizeBookList(options.books);
  const cache: MarketSelectionCache = new Map();
  const requireExactLine = options.requireExactLine ?? true;
  const loggerPrefix = options.loggerPrefix || "[SGP Tokens]";

  const resolvedLegs = await Promise.all(
    legs.map((leg) => resolveLegTokens(leg, booksToFetch, cache, requireExactLine, loggerPrefix))
  );

  return {
    legs: resolvedLegs,
    coverage: buildCoverage(resolvedLegs, booksToFetch),
  };
}

export function buildBookTokenMap(
  legs: ResolvedSgpLeg[],
  booksToFetch: string[],
  options: { minTokens?: number } = {}
): BuildBookTokenMapResult {
  const minTokens = options.minTokens ?? 2;
  const bookTokensMap = new Map<string, string[]>();
  const bookLegsCount = new Map<string, number>();

  for (const bookId of booksToFetch) {
    const tokens = legs
      .map((leg) => leg.sgp_tokens[bookId])
      .filter((token): token is string => Boolean(token));

    bookLegsCount.set(bookId, tokens.length);
    if (tokens.length >= minTokens) {
      bookTokensMap.set(bookId, tokens);
    }
  }

  return { bookTokensMap, bookLegsCount };
}

export function formatCoverageForLog(coverage: SgpTokenCoverage, limit = 8): string {
  const summary = Object.entries(coverage.by_book)
    .filter(([, bookCoverage]) => bookCoverage.tokens > 0)
    .sort(([, a], [, b]) => b.tokens - a.tokens)
    .slice(0, limit)
    .map(([bookId, bookCoverage]) => `${bookId}:${bookCoverage.tokens}/${coverage.total_legs}`);

  return summary.join(", ") || "none";
}
