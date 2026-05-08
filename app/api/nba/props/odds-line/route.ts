import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

interface BookOdds {
  book: string;
  over: number | null;
  under: number | null;
  odd_id_over?: string | null;
  odd_id_under?: string | null;
  link_over?: string | null;
  link_under?: string | null;
  sgp_over?: string | null;
  sgp_under?: string | null;
}

interface OddsLineResponse {
  line: number;
  best: {
    book: string;
    over: number | null;
    under: number | null;
    links?: {
      mobile?: string | null;
      desktop?: string | null;
    };
  } | null;
  books: BookOdds[];
  book_count: number;
  updated_at: number;
}

// Structure of individual odd entry in Redis
interface RedisOddEntry {
  id?: string;
  odd_id?: string;
  odds_id?: string;
  oddsblaze_id?: string;
  history_id?: string;
  player_id: string;
  player?: string;
  side: "over" | "under" | "yes" | "no" | "ml";
  line?: number | null;
  price: string | number;
  price_decimal?: number;
  link?: string;
  mobile_link?: string;
  sgp?: string;
  updated?: string;
}

// Odds blob is a hash of "player|side|line" -> odd entry
type RedisOddsBlob = Record<string, RedisOddEntry>;

const KNOWN_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm", "betmgm-michigan",
  "caesars", "pointsbet", "bet365", "pinnacle", "circa", "hard-rock",
  "bally-bet", "betrivers", "unibet", "wynnbet", "espnbet", "fanatics",
  "betparx", "thescore", "prophetx", "superbook", "si-sportsbook", "fliff",
];

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
    case "betmgm_michigan":
    case "betmgm-michigan":
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
  if (normalized === "hard-rock") candidates.add("hardrock");
  if (normalized === "bally-bet") {
    candidates.add("ballybet");
    candidates.add("bally_bet");
  }
  if (normalized === "betrivers") {
    candidates.add("bet-rivers");
    candidates.add("bet_rivers");
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

function isBinaryPlayerMarket(market: string): boolean {
  const key = market.toLowerCase();
  return key.includes("double_double") || key.includes("triple_double");
}

function getMarketCandidates(market: string): string[] {
  const lower = market.toLowerCase();
  if (lower === "player_double_double" || lower === "double_double") {
    return ["player_double_double", "double_double"];
  }
  if (lower === "player_triple_double" || lower === "triple_double") {
    return ["player_triple_double", "triple_double"];
  }
  return [market];
}

// =============================================================================
// VALIDATION
// =============================================================================

const QuerySchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  market: z.string().min(1, "market is required"),
  player_id: z.string().min(1, "player_id is required"),
  line: z.coerce.number({ invalid_type_error: "line must be a number" }),
  include_sgp: z.coerce.boolean().optional().default(false),
  sport: z.enum(["nba", "wnba"]).optional(),
});

// =============================================================================
// HELPERS
// =============================================================================

function findBestOdds(books: BookOdds[]): BookOdds | null {
  if (books.length === 0) return null;
  
  // Sort by over price descending (higher/better odds first)
  // If no over, sort by under price descending
  const sorted = [...books].sort((a, b) => {
    const aPrice = a.over ?? a.under ?? -Infinity;
    const bPrice = b.over ?? b.under ?? -Infinity;
    return bPrice - aPrice;
  });
  
  return sorted[0];
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query params
    const query = QuerySchema.safeParse({
      event_id: searchParams.get("event_id"),
      market: searchParams.get("market"),
      player_id: searchParams.get("player_id"),
      line: searchParams.get("line"),
      include_sgp: searchParams.get("include_sgp"),
      sport: searchParams.get("sport") ?? undefined,
    });
    
    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query params", details: query.error.flatten() },
        { status: 400 }
      );
    }
    
    const routeSport = request.nextUrl.pathname.includes("/wnba/") ? "wnba" : "nba";
    const { event_id, market, player_id: rawPlayerId, line, include_sgp } = query.data;
    const sport = query.data.sport ?? routeSport;
    const binaryMarket = isBinaryPlayerMarket(market);
    const marketCandidates = getMarketCandidates(market);
    
    // Extract player UUID from sel_key if it includes side/line (e.g., "uuid:over:20.5" -> "uuid")
    const player_id = rawPlayerId.includes(':') ? rawPlayerId.split(':')[0] : rawPlayerId;
    
    // Step 1: Get all books that have this line from booksidx SET
    const booksToFetchByMarket = new Map<string, Set<string>>();
    for (const candidateMarket of marketCandidates) {
      const booksKey = `booksidx:${sport}:${event_id}:${candidateMarket}:${player_id}:${line}`;
      const booksRaw = await redis.smembers(booksKey);
      const books = new Set((booksRaw || []).map(String));
      if (books.size > 0) booksToFetchByMarket.set(candidateMarket, books);
    }
    
    if (booksToFetchByMarket.size === 0) {
      const indexMembers = await redis.smembers(`odds_idx:${sport}:${event_id}`);
      for (const raw of indexMembers || []) {
        const value = String(raw);
        const [indexedMarket, indexedBook] = value.split(":");
        if (marketCandidates.includes(indexedMarket) && indexedBook) {
          if (!booksToFetchByMarket.has(indexedMarket)) {
            booksToFetchByMarket.set(indexedMarket, new Set());
          }
          for (const candidate of getBookKeyCandidates(indexedBook)) {
            booksToFetchByMarket.get(indexedMarket)!.add(candidate);
          }
        }
      }
    }

    // Binary Yes/No markets are often missing booksidx/linesidx because they
    // behave like moneyline selections. Probe known books before giving up.
    if (booksToFetchByMarket.size === 0 && binaryMarket) {
      for (const candidateMarket of marketCandidates) {
        const books = new Set<string>();
        for (const book of KNOWN_BOOKS) {
          for (const candidate of getBookKeyCandidates(book)) {
            books.add(candidate);
          }
        }
        booksToFetchByMarket.set(candidateMarket, books);
      }
    }

    if (booksToFetchByMarket.size === 0) {
      console.log(`[odds-line] No books found for market candidates: ${marketCandidates.join(", ")}`);
      return NextResponse.json({
        line,
        best: null,
        books: [],
        book_count: 0,
        updated_at: Date.now(),
      } as OddsLineResponse);
    }
    
    // Step 2: Fetch odds blobs for all books in parallel
    const oddsRequests = Array.from(booksToFetchByMarket.entries()).flatMap(
      ([candidateMarket, books]) =>
        Array.from(books).map((book) => ({ candidateMarket, book })),
    );
    const seenOddsKeys = new Set<string>();
    const oddsPromises = oddsRequests
      .filter(({ candidateMarket, book }) => {
        const oddsKey = `odds:${sport}:${event_id}:${candidateMarket}:${book}`;
        if (seenOddsKeys.has(oddsKey)) return false;
        seenOddsKeys.add(oddsKey);
        return true;
      })
      .map(async ({ candidateMarket, book }) => {
      const oddsKey = `odds:${sport}:${event_id}:${candidateMarket}:${book}`;
      const oddsBlob = await redis.get<RedisOddsBlob>(oddsKey);
      return { book: normalizeBookId(book), market: candidateMarket, oddsBlob };
    });
    
    const oddsResults = await Promise.all(oddsPromises);
    
    // Step 3: Build book odds list
    const bookOddsByBook = new Map<string, BookOdds>();
    let latestTimestamp = 0;
    
    const parsePrice = (p: string | number | undefined): number | null => {
      if (p === undefined || p === null) return null;
      const num = typeof p === 'string' ? parseInt(p, 10) : p;
      return isNaN(num) ? null : num;
    };

    const getOddId = (entry: RedisOddEntry | null | undefined): string | null =>
      entry?.odd_id ??
      entry?.odds_id ??
      entry?.oddsblaze_id ??
      entry?.history_id ??
      entry?.id ??
      null;
    
    const resolveEntrySide = (
      side: RedisOddEntry["side"],
      key: string,
    ): "over" | "under" | null => {
      if (side === "over" || side === "yes") return "over";
      if (side === "under" || side === "no") return "under";
      if (side === "ml") {
        const normalizedKey = key.toLowerCase();
        return normalizedKey.includes("|no|") || normalizedKey.endsWith("|no")
          ? "under"
          : "over";
      }
      return null;
    };

    for (const { book, oddsBlob } of oddsResults) {
      if (!oddsBlob || typeof oddsBlob !== 'object') continue;
      
      // Find over and under odds for this player and line
      // Keys are formatted as "player_name|side|line" e.g. "dyson_daniels|over|3.5"
      let overOdd: RedisOddEntry | null = null;
      let underOdd: RedisOddEntry | null = null;
      
      for (const [key, entry] of Object.entries(oddsBlob)) {
        // Skip non-object entries (like metadata fields)
        if (!entry || typeof entry !== 'object' || !entry.player_id) continue;
        
        // Match by player_id and line
        const entryLine = typeof entry.line === "number" ? entry.line : null;
        const lineMatches =
          binaryMarket ||
          entryLine === line;
        if (entry.player_id === player_id && lineMatches) {
          const resolvedSide = resolveEntrySide(entry.side, key);
          if (resolvedSide === "over") {
            overOdd = entry;
          } else if (resolvedSide === "under") {
            underOdd = entry;
          }
        }
      }
      
      // Only add if we found at least one side
      if (overOdd || underOdd) {
        const bookOdds: BookOdds = {
          book,
          over: parsePrice(overOdd?.price),
          under: parsePrice(underOdd?.price),
          odd_id_over: getOddId(overOdd),
          odd_id_under: getOddId(underOdd),
          link_over: overOdd?.link ?? overOdd?.mobile_link ?? null,
          link_under: underOdd?.link ?? underOdd?.mobile_link ?? null,
        };
        
        // Include SGP tokens if requested
        if (include_sgp) {
          bookOdds.sgp_over = overOdd?.sgp ?? null;
          bookOdds.sgp_under = underOdd?.sgp ?? null;
        }
        
        const existing = bookOddsByBook.get(book);
        if (!existing) {
          bookOddsByBook.set(book, bookOdds);
        } else {
          const existingOver = existing.over ?? -Infinity;
          const nextOver = bookOdds.over ?? -Infinity;
          if (nextOver > existingOver) {
            existing.over = bookOdds.over;
            existing.odd_id_over = bookOdds.odd_id_over;
            existing.link_over = bookOdds.link_over;
            existing.sgp_over = bookOdds.sgp_over;
          }
          const existingUnder = existing.under ?? -Infinity;
          const nextUnder = bookOdds.under ?? -Infinity;
          if (nextUnder > existingUnder) {
            existing.under = bookOdds.under;
            existing.odd_id_under = bookOdds.odd_id_under;
            existing.link_under = bookOdds.link_under;
            existing.sgp_under = bookOdds.sgp_under;
          }
        }
        
        // Update timestamp from entry
        const entryTime = overOdd?.updated || underOdd?.updated;
        if (entryTime) {
          const ts = new Date(entryTime).getTime();
          if (ts > latestTimestamp) latestTimestamp = ts;
        }
      }
    }
    const bookOddsList = Array.from(bookOddsByBook.values());
    
    // Sort by best over odds (higher is better)
    bookOddsList.sort((a, b) => {
      const aPrice = a.over ?? a.under ?? -Infinity;
      const bPrice = b.over ?? b.under ?? -Infinity;
      return bPrice - aPrice;
    });
    
    const best = findBestOdds(bookOddsList);
    
    const responseTime = Date.now() - startTime;
    console.log(`[odds-line:${sport}] ${event_id}/${market}/${player_id}/${line}: ${bookOddsList.length} books in ${responseTime}ms`);
    
    return NextResponse.json({
      line,
      best: best ? {
        book: best.book,
        over: best.over,
        under: best.under,
        links: {
          desktop: best.link_over ?? best.link_under,
          mobile: best.link_over ?? best.link_under,
        },
      } : null,
      books: bookOddsList,
      book_count: bookOddsList.length,
      updated_at: latestTimestamp || Date.now(),
    } as OddsLineResponse, {
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=30",
      },
    });
    
  } catch (error) {
    console.error("[odds-line] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
