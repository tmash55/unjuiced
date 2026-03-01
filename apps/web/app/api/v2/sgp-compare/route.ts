import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import { fetchSgpQuote } from "@/lib/sgp/quote-service";

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

// SGP-supporting books from config
const SGP_SUPPORTING_BOOKS = Object.entries(SPORTSBOOKS_META)
  .filter(([_, meta]) => meta.sgp === true && meta.isActive === true)
  .map(([id]) => id);

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check (optional - allow unauthenticated for now)
    const supabase = await createClient();
    await supabase.auth.getUser();

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

    // Fetch each book independently - odds are book-specific and should
    // never be shared across books even when token arrays match.
    const fetchPromises: Promise<{
      bookId: string;
      odds: SgpBookOdds;
      fromCache: boolean;
      source: string;
    }>[] = [];

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      fetchPromises.push(
        fetchSgpQuote(bookId, tokens, {
          allowStaleOnRateLimit: true,
          allowStaleOnLockTimeout: true,
        }).then(result => ({
          bookId,
          odds: result.odds,
          fromCache: result.fromCache,
          source: result.source,
        }))
      );
    }

    const oddsResults = await Promise.all(fetchPromises);
    const resultByBook = new Map(oddsResults.map((result) => [result.bookId, result]));

    // Build the final odds cache
    const oddsCache: SgpOddsCache = {};

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      const result = resultByBook.get(bookId);
      const odds = result?.odds;
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

    const vendorCalls = oddsResults.filter((result) => result.source === "vendor").length;
    const cacheHits = oddsResults.filter((result) => result.fromCache).length;

    console.log(
      `[SGP Compare] Completed: ${vendorCalls} vendor calls, ${cacheHits} cache hits, ${bookTokensMap.size} books requested`
    );

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
