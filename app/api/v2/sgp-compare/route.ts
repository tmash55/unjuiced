import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import { redis } from "@/lib/redis";

// =============================================================================
// TYPES
// =============================================================================

interface SgpLeg {
  favorite_id: string;
  player_name?: string;
  event_id: string;
  market: string;
  line: number | null;
  side: string;
  sgp_tokens: Record<string, string>; // bookId -> token
}

interface SgpCompareRequest {
  legs: SgpLeg[];
  sportsbooks?: string[]; // Optional: specific books to fetch
}

interface SgpBookOdds {
  price?: string;
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
  legs_supported?: number;
  total_legs?: number;
  has_all_legs?: boolean;
}

interface SgpOddsCache {
  [bookId: string]: SgpBookOdds;
}

interface OddsBlazeResponse {
  price?: string;
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
  message?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ODDSBLAZE_API_KEY = process.env.ODDSBLAZE_API_KEY;
const SGP_REDIS_CACHE_TTL_SECONDS = 8;

// Map our book IDs to OddsBlaze's expected subdomain IDs
const ODDSBLAZE_BOOK_ID_MAP: Record<string, string> = {
  'draftkings': 'draftkings',
  'fanduel': 'fanduel',
  'betmgm': 'betmgm',
  'caesars': 'caesars',
  'bet365': 'bet365',
  'betrivers': 'betrivers',
  'betparx': 'betparx',
  'pointsbet': 'pointsbet',
  'espn': 'espnbet',
  'fanatics': 'fanatics',
  'fliff': 'fliff',
  'hard-rock': 'hard-rock',
  'bally-bet': 'bally-bet',
  'thescore': 'thescore',
  'prophetx': 'prophetx',
  'pinnacle': 'pinnacle',
  'wynnbet': 'wynnbet',
};

// SGP-supporting books from config
const SGP_SUPPORTING_BOOKS = Object.entries(SPORTSBOOKS_META)
  .filter(([_, meta]) => meta.sgp === true && meta.isActive === true)
  .map(([id]) => id);

function getOddsBlazeBookId(bookId: string): string {
  return ODDSBLAZE_BOOK_ID_MAP[bookId] || bookId;
}

function generateLegsHash(tokens: string[]): string {
  return tokens.sort().join('|');
}

// =============================================================================
// HELPERS
// =============================================================================

async function fetchOddsFromOddsBlaze(
  bookId: string,
  sgpTokens: string[],
  legsHash: string
): Promise<{ odds: SgpBookOdds; fromCache: boolean; legsHash: string }> {
  if (!ODDSBLAZE_API_KEY) {
    return { odds: { error: "API key not configured" }, fromCache: false, legsHash };
  }

  if (sgpTokens.length < 2) {
    return { odds: { error: "Not enough legs with SGP support" }, fromCache: false, legsHash };
  }

  // Check for duplicate tokens (indicates upstream data quality issue)
  const uniqueTokens = new Set(sgpTokens);
  if (uniqueTokens.size !== sgpTokens.length) {
    console.warn(`[SGP Compare] ⚠️ Skipping ${bookId}: duplicate tokens detected`);
    return { odds: { error: "Duplicate selections detected" }, fromCache: false, legsHash };
  }

  // Check Redis cache first
  const cacheKey = `sgp:compare:${bookId}:${legsHash}`;
  
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return { odds: parsed, fromCache: true, legsHash };
    }
  } catch (e) {
    console.warn("[SGP Compare] Redis cache read error:", e);
  }

  // Fetch from OddsBlaze
  try {
    const oddsBlazeBookId = getOddsBlazeBookId(bookId);
    const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sgpTokens),
    });

    if (!response.ok) {
      return { odds: { error: `API error: ${response.status}` }, fromCache: false, legsHash };
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return { odds: { error: data.error || data.message }, fromCache: false, legsHash };
    }

    const odds: SgpBookOdds = {
      price: data.price,
      links: data.links,
      limits: data.limits,
    };

    // Cache the result
    try {
      await redis.set(cacheKey, JSON.stringify(odds), { ex: SGP_REDIS_CACHE_TTL_SECONDS });
    } catch (e) {
      console.warn("[SGP Compare] Redis cache write error:", e);
    }

    return { odds, fromCache: false, legsHash };
  } catch (error) {
    console.error(`[SGP Compare] Error fetching ${bookId}:`, error);
    return { odds: { error: "Failed to fetch odds" }, fromCache: false, legsHash };
  }
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check (optional - allow unauthenticated for now)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Parse request
    const body = await request.json() as SgpCompareRequest;
    const { legs, sportsbooks } = body;

    if (!legs || legs.length < 2) {
      return NextResponse.json(
        { error: "At least 2 legs required" },
        { status: 400 }
      );
    }

    const totalLegs = legs.length;
    console.log(`[SGP Compare] Processing ${totalLegs} legs for compare`);

    // Determine which books to fetch
    const booksToFetch = sportsbooks?.length
      ? sportsbooks.filter(b => SGP_SUPPORTING_BOOKS.includes(b))
      : SGP_SUPPORTING_BOOKS;

    // Build token map for each book
    const bookTokensMap = new Map<string, string[]>();
    const bookLegsCount = new Map<string, number>();

    for (const bookId of booksToFetch) {
      const tokens: string[] = [];
      
      for (const leg of legs) {
        const sgpToken = leg.sgp_tokens[bookId];
        if (sgpToken) {
          tokens.push(sgpToken);
        }
      }

      bookLegsCount.set(bookId, tokens.length);

      // Only include books that have at least 2 SGP tokens
      if (tokens.length >= 2) {
        bookTokensMap.set(bookId, tokens);
      }
    }

    console.log(`[SGP Compare] Found tokens for books: ${Array.from(bookTokensMap.keys()).join(', ')}`);

    if (bookTokensMap.size === 0) {
      return NextResponse.json({
        odds: {},
        total_legs: totalLegs,
        books_fetched: [],
        error: "No sportsbooks have SGP tokens for these legs",
      });
    }

    // Group books by their token hash to avoid duplicate API calls
    const tokenHashToBooks = new Map<string, string[]>();
    const bookToTokenHash = new Map<string, string>();

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      const hash = generateLegsHash(tokens);
      bookToTokenHash.set(bookId, hash);

      const existing = tokenHashToBooks.get(hash) || [];
      existing.push(bookId);
      tokenHashToBooks.set(hash, existing);
    }

    // Fetch odds for each unique token hash
    const fetchPromises: Promise<{
      bookId: string;
      odds: SgpBookOdds;
      fromCache: boolean;
      legsHash: string;
    }>[] = [];

    const fetchedHashes = new Set<string>();

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      const hash = bookToTokenHash.get(bookId)!;

      // Only fetch once per unique hash
      if (fetchedHashes.has(hash)) continue;
      fetchedHashes.add(hash);

      fetchPromises.push(
        fetchOddsFromOddsBlaze(bookId, tokens, hash).then(result => ({
          bookId,
          ...result,
        }))
      );
    }

    const oddsResults = await Promise.all(fetchPromises);

    // Build results map
    const fetchedOddsMap = new Map<string, SgpBookOdds>();
    for (const result of oddsResults) {
      const hash = bookToTokenHash.get(result.bookId)!;
      fetchedOddsMap.set(hash, result.odds);
    }

    // Build the final odds cache - copy results to all books with matching token hashes
    const oddsCache: SgpOddsCache = {};

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      const hash = bookToTokenHash.get(bookId)!;
      const odds = fetchedOddsMap.get(hash);
      const legsSupported = bookLegsCount.get(bookId) || tokens.length;
      const hasAllLegs = legsSupported === totalLegs;

      if (odds) {
        oddsCache[bookId] = {
          ...odds,
          legs_supported: legsSupported,
          total_legs: totalLegs,
          has_all_legs: hasAllLegs,
        };
      }
    }

    // Include books that didn't have enough tokens
    for (const bookId of booksToFetch) {
      if (!bookTokensMap.has(bookId) && !oddsCache[bookId]) {
        const legsSupported = bookLegsCount.get(bookId) || 0;
        oddsCache[bookId] = {
          error: "Not all legs available at this book",
          legs_supported: legsSupported,
          total_legs: totalLegs,
          has_all_legs: false,
        };
      }
    }

    console.log(`[SGP Compare] Completed: ${oddsResults.length} API calls for ${bookTokensMap.size} books`);

    return NextResponse.json({
      odds: oddsCache,
      total_legs: totalLegs,
      books_fetched: Array.from(bookTokensMap.keys()),
    });
  } catch (error) {
    console.error("[SGP Compare] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
