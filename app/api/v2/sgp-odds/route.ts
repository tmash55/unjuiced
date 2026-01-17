import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";

// =============================================================================
// TYPES
// =============================================================================

interface SgpOddsRequest {
  betslip_id: string;
  sportsbooks?: string[]; // Optional: specific books to fetch, defaults to all SGP books
  force_refresh?: boolean; // Force refresh even if cache is fresh
}

interface SgpBookOdds {
  price: string; // American odds string e.g., "+425"
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string; // Error message if this book doesn't support the combo
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
const SGP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Log API key status on startup (masked)
if (!ODDSBLAZE_API_KEY) {
  console.warn("[SGP API] Warning: ODDSBLAZE_API_KEY environment variable is not set");
} else {
  console.log(`[SGP API] API key configured (length: ${ODDSBLAZE_API_KEY.length}, starts with: ${ODDSBLAZE_API_KEY.slice(0, 4)}...)`);
}

// Map our book IDs to OddsBlaze's expected subdomain IDs
// OddsBlaze uses specific subdomain formats that may differ from our IDs
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
  'hard-rock': 'hard-rock',      // OddsBlaze uses 'hard-rock' with hyphen
  'bally-bet': 'bally-bet',
  'thescore': 'thescore',
  'prophetx': 'prophetx',
  'pinnacle': 'pinnacle',
  'wynnbet': 'wynnbet',
};

// Convert our book ID to OddsBlaze's expected format
function getOddsBlazeBookId(bookId: string): string {
  // Use mapped ID if available, otherwise use as-is
  return ODDSBLAZE_BOOK_ID_MAP[bookId] || bookId;
}

// Get all sportsbooks that support SGP (only books with sgp: true in sportsbooks.ts)
const SGP_SUPPORTING_BOOKS = Object.entries(SPORTSBOOKS_META)
  .filter(([_, meta]) => meta.sgp === true && meta.isActive === true)
  .map(([id]) => id);

console.log("[SGP API] SGP-supporting books:", SGP_SUPPORTING_BOOKS);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Classify bet type based on event IDs
 */
function classifyBetType(items: Array<{ favorite?: { event_id?: string | null } | null }>): 'individual' | 'parlay' | 'sgp' | 'sgp_plus' {
  if (items.length === 0 || items.length === 1) return 'individual';
  
  // Group legs by event_id
  const eventGroups = new Map<string, number>();
  items.forEach(item => {
    const eventId = item.favorite?.event_id || 'unknown';
    eventGroups.set(eventId, (eventGroups.get(eventId) || 0) + 1);
  });
  
  const groupSizes = Array.from(eventGroups.values());
  const sgpGroups = groupSizes.filter(size => size >= 2); // Groups with 2+ legs
  const singleLegGroups = groupSizes.filter(size => size === 1);
  
  // All legs from same game = SGP
  if (eventGroups.size === 1 && items.length >= 2) {
    return 'sgp';
  }
  
  // Has at least one SGP group + other legs = SGP+
  if (sgpGroups.length >= 1 && (sgpGroups.length >= 2 || singleLegGroups.length >= 1)) {
    return 'sgp_plus';
  }
  
  // Multiple games, no SGP groups = Regular Parlay
  return 'parlay';
}

/**
 * Fetch SGP odds from OddsBlaze for a single sportsbook
 */
async function fetchOddsBlazeOdds(
  bookId: string,
  sgpTokens: string[]
): Promise<SgpBookOdds> {
  if (!ODDSBLAZE_API_KEY) {
    console.error("[SGP API] ODDSBLAZE_API_KEY is not set in environment variables");
    return { error: "API key not configured - check ODDSBLAZE_API_KEY env var" };
  }

  if (sgpTokens.length === 0) {
    return { error: "No SGP tokens available for this book" };
  }

  // Some legs might be missing SGP tokens for this book
  if (sgpTokens.length < 2) {
    return { error: "Not enough legs have odds at this book" };
  }

  try {
    // URL format: https://{sportsbook_id}.sgp.oddsblaze.com/?key=YOUR_KEY
    const oddsBlazeBookId = getOddsBlazeBookId(bookId);
    const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;
    
    console.log(`[SGP API] Fetching odds for ${bookId} -> ${oddsBlazeBookId} with ${sgpTokens.length} tokens`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sgpTokens),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SGP API] OddsBlaze error for ${bookId}:`, response.status, errorText);
      
      // Check for specific error types
      if (errorText.includes("Invalid key")) {
        return { error: "Invalid API key - verify ODDSBLAZE_API_KEY" };
      }
      return { error: `API error: ${response.status}` };
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return { error: data.error || data.message };
    }

    if (!data.price) {
      return { error: "No price available for this combination" };
    }

    return {
      price: data.price,
      links: data.links,
      limits: data.limits,
    };
  } catch (error) {
    console.error(`[SGP API] Fetch error for ${bookId}:`, error);
    return { error: "Failed to fetch odds" };
  }
}

// =============================================================================
// API HANDLER
// =============================================================================

/**
 * POST /api/v2/sgp-odds
 * 
 * Fetch SGP/SGP+ odds from OddsBlaze and cache in the database.
 * 
 * Request body:
 * {
 *   betslip_id: string,
 *   sportsbooks?: string[],  // Optional: specific books to fetch
 *   force_refresh?: boolean  // Force refresh even if cache is fresh
 * }
 * 
 * Response:
 * {
 *   odds: { [bookId]: { price, links?, error? } },
 *   bet_type: 'sgp' | 'sgp_plus' | 'parlay' | 'individual',
 *   updated_at: string,
 *   from_cache: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SgpOddsRequest = await request.json();
    const { betslip_id, sportsbooks, force_refresh = false } = body;

    if (!betslip_id) {
      return NextResponse.json(
        { error: "betslip_id is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch betslip with items
    const { data: betslip, error: betslipError } = await supabase
      .from("user_betslips")
      .select(`
        *,
        items:user_betslip_items(
          *,
          favorite:user_favorites(*)
        )
      `)
      .eq("id", betslip_id)
      .eq("user_id", user.id)
      .single();

    if (betslipError || !betslip) {
      console.error("[SGP API] Betslip fetch error:", betslipError);
      return NextResponse.json(
        { error: "Betslip not found" },
        { status: 404 }
      );
    }

    const items = betslip.items || [];
    
    // Classify bet type
    const betType = classifyBetType(items);

    // For individual bets or regular parlays, no API call needed
    if (betType === 'individual' || betType === 'parlay') {
      return NextResponse.json({
        odds: {},
        bet_type: betType,
        updated_at: null,
        from_cache: false,
        message: betType === 'individual' 
          ? "Single leg bets use existing odds" 
          : "Regular parlays use frontend calculation"
      });
    }

    // Check if we have fresh cached odds
    const cachedOdds = betslip.sgp_odds_cache as SgpOddsCache | null;
    const cacheTime = betslip.sgp_odds_updated_at 
      ? new Date(betslip.sgp_odds_updated_at).getTime() 
      : 0;
    const cacheAge = Date.now() - cacheTime;
    const cacheIsFresh = cacheAge < SGP_CACHE_TTL_MS;

    if (cachedOdds && cacheIsFresh && !force_refresh) {
      return NextResponse.json({
        odds: cachedOdds,
        bet_type: betType,
        updated_at: betslip.sgp_odds_updated_at,
        from_cache: true,
        cache_age_seconds: Math.round(cacheAge / 1000),
      });
    }

    // Determine which books to fetch
    const booksToFetch = sportsbooks?.length 
      ? sportsbooks.filter(b => SGP_SUPPORTING_BOOKS.includes(b))
      : SGP_SUPPORTING_BOOKS;

    // Collect SGP tokens for each book
    const bookTokensMap = new Map<string, string[]>();
    
    for (const bookId of booksToFetch) {
      const tokens: string[] = [];
      
      for (const item of items) {
        const favorite = item.favorite;
        if (!favorite?.books_snapshot) continue;
        
        const bookSnapshot = favorite.books_snapshot[bookId];
        if (bookSnapshot?.sgp) {
          tokens.push(bookSnapshot.sgp);
        }
      }
      
      // Only include books that have at least 2 SGP tokens
      if (tokens.length >= 2) {
        bookTokensMap.set(bookId, tokens);
      }
    }

    // Fetch odds from OddsBlaze in parallel
    const oddsPromises = Array.from(bookTokensMap.entries()).map(
      async ([bookId, tokens]) => {
        const result = await fetchOddsBlazeOdds(bookId, tokens);
        return [bookId, result] as [string, SgpBookOdds];
      }
    );

    const oddsResults = await Promise.all(oddsPromises);
    
    // Build the odds cache object
    const newOddsCache: SgpOddsCache = {};
    for (const [bookId, odds] of oddsResults) {
      newOddsCache[bookId] = odds;
    }

    // Also include books that didn't have enough tokens
    for (const bookId of booksToFetch) {
      if (!bookTokensMap.has(bookId) && !newOddsCache[bookId]) {
        newOddsCache[bookId] = { error: "Not all legs available at this book" };
      }
    }

    // Update the cache in the database
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("user_betslips")
      .update({
        sgp_odds_cache: newOddsCache,
        sgp_odds_updated_at: now,
        bet_type: betType,
      })
      .eq("id", betslip_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[SGP API] Cache update error:", updateError);
      // Don't fail the request, just log
    }

    return NextResponse.json({
      odds: newOddsCache,
      bet_type: betType,
      updated_at: now,
      from_cache: false,
      books_fetched: Array.from(bookTokensMap.keys()),
    });
  } catch (error) {
    console.error("[SGP API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
