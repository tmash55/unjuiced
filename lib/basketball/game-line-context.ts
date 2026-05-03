import { redis } from "@/lib/redis";

const BOOK_PRIORITY = ["pinnacle", "draftkings", "fanduel"] as const;
const TOTAL_MARKETS = ["total_points", "game_total"] as const;

type Sport = "nba" | "wnba";

type GameLineRow = {
  event_id?: string | null;
  team_name?: string | null;
  team_abbr?: string | null;
};

type RedisSelection = {
  player?: string | null;
  side?: string | null;
  line?: number | string | null;
  price?: string | number | null;
  main?: boolean | null;
};

type BookSelections = Record<string, RedisSelection | string>;

export type GameLineContext = {
  spread: number | null;
  total: number | null;
  spreadBook: string | null;
  totalBook: string | null;
};

function parseSelections(value: unknown): BookSelections | null {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as BookSelections;
  } catch {
    return null;
  }
}

function parseSelection(value: RedisSelection | string): RedisSelection | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RedisSelection;
  } catch {
    return null;
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function selectionMatchesTeam(selectionKey: string, selection: RedisSelection, row: GameLineRow) {
  const teamName = normalizeName(row.team_name);
  const teamAbbr = normalizeName(row.team_abbr);
  const selectionName = normalizeName(selection.player);
  const keyName = normalizeName(selectionKey.split("|")[0]);

  if (!teamName && !teamAbbr) return false;
  return (
    (!!teamName && (
      selectionName === teamName ||
      keyName === teamName ||
      selectionName.endsWith(teamName) ||
      keyName.endsWith(teamName)
    )) ||
    (!!teamAbbr && (selectionName === teamAbbr || keyName === teamAbbr))
  );
}

function priceDistanceFromPick(selection: RedisSelection): number {
  const price = typeof selection.price === "string"
    ? Number(selection.price.replace("+", ""))
    : Number(selection.price);
  if (!Number.isFinite(price)) return Number.POSITIVE_INFINITY;

  // Main spread/total prices usually live near -110. When a book does not mark
  // the main line, this keeps us away from alternate lines priced like +900.
  return Math.abs(price - -110);
}

function pickDisplaySelection(candidates: RedisSelection[]): RedisSelection | null {
  if (candidates.length === 0) return null;
  const main = candidates.filter((selection) => selection.main === true);
  const pool = main.length > 0 ? main : candidates;

  return [...pool].sort((a, b) => {
    const priceDiff = priceDistanceFromPick(a) - priceDistanceFromPick(b);
    if (priceDiff !== 0) return priceDiff;
    const aLine = Math.abs(toNumber(a.line) ?? Number.POSITIVE_INFINITY);
    const bLine = Math.abs(toNumber(b.line) ?? Number.POSITIVE_INFINITY);
    return aLine - bLine;
  })[0] ?? null;
}

function getSpreadForRow(bookSelections: BookSelections | null, row: GameLineRow): number | null {
  if (!bookSelections) return null;

  const candidates: RedisSelection[] = [];
  for (const [selectionKey, rawSelection] of Object.entries(bookSelections)) {
    const selection = parseSelection(rawSelection);
    if (!selection || selection.side !== "spread") continue;
    if (!selectionMatchesTeam(selectionKey, selection, row)) continue;
    candidates.push(selection);
  }

  return toNumber(pickDisplaySelection(candidates)?.line);
}

function getTotal(bookSelections: BookSelections | null): number | null {
  if (!bookSelections) return null;

  const candidates: RedisSelection[] = [];
  for (const [, rawSelection] of Object.entries(bookSelections)) {
    const selection = parseSelection(rawSelection);
    if (!selection || selection.side !== "over") continue;
    candidates.push(selection);
  }

  return toNumber(pickDisplaySelection(candidates)?.line);
}

export async function fetchGameLineContextsForRows(
  sport: Sport,
  rows: GameLineRow[]
): Promise<Map<string, GameLineContext>> {
  const eventIds = [...new Set(rows.map((row) => row.event_id).filter(Boolean))] as string[];
  const result = new Map<string, GameLineContext>();

  if (eventIds.length === 0) return result;

  const keys = eventIds.flatMap((eventId) => [
    ...BOOK_PRIORITY.map((book) => `odds:${sport}:${eventId}:game_spread:${book}`),
    ...BOOK_PRIORITY.flatMap((book) =>
      TOTAL_MARKETS.map((market) => `odds:${sport}:${eventId}:${market}:${book}`)
    ),
  ]);

  const values = await redis.mget<(BookSelections | string | null)[]>(...keys);
  const eventBooks = new Map<string, {
    spreads: Partial<Record<(typeof BOOK_PRIORITY)[number], BookSelections | null>>;
    totals: Partial<Record<(typeof BOOK_PRIORITY)[number], BookSelections | null>>;
  }>();

  eventIds.forEach((eventId) => {
    eventBooks.set(eventId, { spreads: {}, totals: {} });
  });

  keys.forEach((key, index) => {
    const [, , eventId, market, book] = key.split(":");
    const entry = eventBooks.get(eventId);
    if (!entry || !BOOK_PRIORITY.includes(book as (typeof BOOK_PRIORITY)[number])) return;

    const parsed = parseSelections(values[index]);
    if (market === "game_spread") {
      entry.spreads[book as (typeof BOOK_PRIORITY)[number]] = parsed;
      return;
    }

    if (TOTAL_MARKETS.includes(market as (typeof TOTAL_MARKETS)[number]) && !entry.totals[book as (typeof BOOK_PRIORITY)[number]]) {
      entry.totals[book as (typeof BOOK_PRIORITY)[number]] = parsed;
    }
  });

  for (const row of rows) {
    if (!row.event_id) continue;

    const books = eventBooks.get(row.event_id);
    if (!books) continue;

    let spread: number | null = null;
    let spreadBook: string | null = null;
    for (const book of BOOK_PRIORITY) {
      spread = getSpreadForRow(books.spreads[book] ?? null, row);
      if (spread !== null) {
        spreadBook = book;
        break;
      }
    }

    let total: number | null = null;
    let totalBook: string | null = null;
    for (const book of BOOK_PRIORITY) {
      total = getTotal(books.totals[book] ?? null);
      if (total !== null) {
        totalBook = book;
        break;
      }
    }

    result.set(`${row.event_id}:${normalizeName(row.team_name) || normalizeName(row.team_abbr)}`, {
      spread,
      total,
      spreadBook,
      totalBook,
    });
  }

  return result;
}

export function getGameLineContextKey(row: GameLineRow): string {
  return `${row.event_id ?? ""}:${normalizeName(row.team_name) || normalizeName(row.team_abbr)}`;
}
