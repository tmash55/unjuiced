import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { fetchSgpQuote } from "@/lib/sgp/quote-service";
import { normalizeFavoriteOddsKey } from "@/lib/odds/types";
import {
  buildBookTokenMap,
  formatCoverageForLog,
  getSgpSupportingBooks,
  resolveSgpTokensForLegs,
} from "@/lib/sgp/token-resolver";

// =============================================================================
// TYPES
// =============================================================================

interface SgpOddsRequest {
  betslip_id: string;
  sportsbooks?: string[]; // Optional: specific books to fetch, defaults to all SGP books
  force_refresh?: boolean; // Force refresh even if cache is fresh
}

interface SgpBookOdds {
  price?: string; // American odds string e.g., "+425" (omitted if error)
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string; // Error message if this book doesn't support the combo
  legs_supported?: number; // Number of legs this book has odds for
  total_legs?: number; // Total number of legs in the betslip
  has_all_legs?: boolean; // True if book has odds for all legs
}

interface SgpOddsCache {
  [bookId: string]: SgpBookOdds;
}

// Betslip item structure from joined query
interface BetslipItemWithFavorite {
  id: string;
  favorite?: {
    id?: string;
    sport?: string | null;
    event_id?: string | null;
    market?: string | null;
    odds_key?: string | null;
    player_name?: string | null;
    line?: number | null;
    side?: string | null;
    books_snapshot?: Record<string, { sgp?: string | null } | null>;
  } | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SGP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (database cache)

// Get all sportsbooks that support SGP (only books with sgp: true in sportsbooks.ts)
const SGP_SUPPORTING_BOOKS = getSgpSupportingBooks();

console.log("[SGP API] SGP-supporting books:", SGP_SUPPORTING_BOOKS);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a stable hash for a set of SGP tokens
 * Used for Redis caching to dedupe identical requests
 */
function generateLegsHash(tokens: string[]): string {
  // Sort tokens for consistent hash regardless of order
  const sorted = [...tokens].sort();
  // Simple djb2 hash
  let hash = 5381;
  const str = sorted.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to base36 for shorter string
  return (hash >>> 0).toString(36);
}

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
 * Includes Redis caching to dedupe identical requests across users
 */
async function fetchOddsBlazeOdds(
  bookId: string,
  sgpTokens: string[],
  forceRefresh: boolean = false
): Promise<{ odds: SgpBookOdds; fromCache: boolean; source: string }> {
  if (sgpTokens.length === 0) {
    return {
      odds: { error: "No SGP tokens available for this book" },
      fromCache: false,
      source: "vendor",
    };
  }

  const result = await fetchSgpQuote(bookId, sgpTokens, {
    forceRefresh: forceRefresh,
    allowStaleOnRateLimit: true,
    allowStaleOnLockTimeout: true,
  });

  return {
    odds: result.odds,
    fromCache: result.fromCache,
    source: result.source,
  };
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

    const items = (betslip.items || []) as BetslipItemWithFavorite[];
    const hasLegacyFavoriteOddsKey = items.some((item) => {
      const favorite = item.favorite;
      if (!favorite?.odds_key) return false;
      const normalizedOddsKey = normalizeFavoriteOddsKey({
        oddsKey: favorite.odds_key,
        sport: favorite.sport,
        eventId: favorite.event_id,
        market: favorite.market,
      });
      return Boolean(normalizedOddsKey && normalizedOddsKey !== favorite.odds_key);
    });
    
    // Classify bet type
    const betType = classifyBetType(items);

    // For individual bets or regular parlays, no SGP API call needed
    // But DO update bet_type in the database so frontend knows the classification
    // and doesn't keep re-fetching
    if (betType === 'individual' || betType === 'parlay') {
      // Update bet_type in DB so passive refresh knows not to re-fetch
      if (betslip.bet_type !== betType) {
        await supabase
          .from("user_betslips")
          .update({ bet_type: betType })
          .eq("id", betslip_id)
          .eq("user_id", user.id);
      }
      
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

    // Compute current legs hash to detect if betslip changed since last cache
    const currentFavoriteIds = items
      .map(item => item.favorite?.id)
      .filter(Boolean)
      .sort() as string[];
    const currentLegsHash = generateLegsHash(currentFavoriteIds);

    // Check if we have fresh cached odds
    const cachedOdds = betslip.sgp_odds_cache as SgpOddsCache | null;
    const cacheTime = betslip.sgp_odds_updated_at 
      ? new Date(betslip.sgp_odds_updated_at).getTime() 
      : 0;
    const cacheAge = Date.now() - cacheTime;
    const cacheIsFresh = cacheAge < SGP_CACHE_TTL_MS;

    if (cachedOdds && cacheIsFresh && !force_refresh && !hasLegacyFavoriteOddsKey) {
      return NextResponse.json({
        odds: cachedOdds,
        bet_type: betType,
        updated_at: betslip.sgp_odds_updated_at,
        from_cache: true,
        cache_age_seconds: Math.round(cacheAge / 1000),
        legs_hash: currentLegsHash,
      });
    }

    // Determine which books to fetch
    const booksToFetch = sportsbooks?.length 
      ? sportsbooks.filter(b => SGP_SUPPORTING_BOOKS.includes(b))
      : SGP_SUPPORTING_BOOKS;

    // Collect all favorite IDs to compute betslip legs hash
    // This helps frontend detect when legs were added/removed
    const favoriteIds = items
      .map(item => item.favorite?.id)
      .filter(Boolean)
      .sort() as string[];
    const betslipLegsHash = generateLegsHash(favoriteIds);
    
    // Resolve SGP tokens from saved snapshots plus current Redis odds data.
    const totalLegs = items.length;
    console.log(`[SGP API] Resolving SGP tokens for ${totalLegs} legs...`);

    const resolvedTokens = await resolveSgpTokensForLegs(
      items.map((item) => {
        const favorite = item.favorite;
        return {
          favorite_id: favorite?.id,
          sport: favorite?.sport,
          event_id: favorite?.event_id,
          market: favorite?.market,
          odds_key: favorite?.odds_key,
          player_name: favorite?.player_name,
          line: favorite?.line,
          side: favorite?.side,
          books_snapshot: favorite?.books_snapshot,
        };
      }),
      {
        books: booksToFetch,
        loggerPrefix: "[SGP API]",
      }
    );
    const { bookTokensMap, bookLegsCount } = buildBookTokenMap(
      resolvedTokens.legs,
      booksToFetch,
      { minTokens: 2 }
    );

    console.log(
      `[SGP API] Found tokens for books: ${formatCoverageForLog(resolvedTokens.coverage)}`
    );

    // Fetch each book independently. Odds are sportsbook-specific and
    // should not be reused across different books even with matching tokens.
    const oddsPromises: Promise<{
      bookId: string;
      odds: SgpBookOdds;
      fromCache: boolean;
      source: string;
    }>[] = [];

    for (const [bookId, tokens] of bookTokensMap.entries()) {
      oddsPromises.push(
        fetchOddsBlazeOdds(bookId, tokens, force_refresh).then(result => ({
          bookId,
          ...result,
        }))
      );
    }

    const oddsResults = await Promise.all(oddsPromises);
    const resultByBook = new Map(oddsResults.map((result) => [result.bookId, result]));

    // Build the odds cache object
    const newOddsCache: SgpOddsCache = {};
    const redisCacheHits = oddsResults.filter((result) => result.fromCache).length;
    const vendorCalls = oddsResults.filter((result) => result.source === "vendor").length;

    // Include legs_supported info for partial coverage detection
    for (const [bookId, tokens] of bookTokensMap.entries()) {
      const odds = resultByBook.get(bookId)?.odds;
      const legsSupported = bookLegsCount.get(bookId) || tokens.length;
      const hasAllLegs = legsSupported === totalLegs;
      
      if (odds) {
        newOddsCache[bookId] = {
          ...odds,
          legs_supported: legsSupported,
          total_legs: totalLegs,
          has_all_legs: hasAllLegs,
        };
      }
    }

    // Also include books that didn't have enough tokens
    for (const bookId of booksToFetch) {
      if (!bookTokensMap.has(bookId) && !newOddsCache[bookId]) {
        const legsSupported = bookLegsCount.get(bookId) || 0;
        newOddsCache[bookId] = { 
          error: "Not all legs available at this book",
          legs_supported: legsSupported,
          total_legs: totalLegs,
          has_all_legs: false,
        };
      }
    }

    // Update the cache in the database (with legs hash for staleness tracking)
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

    console.log(`[SGP API] Completed: ${redisCacheHits} Redis hits, ${vendorCalls} vendor calls, legs_hash: ${betslipLegsHash}`);

    return NextResponse.json({
      odds: newOddsCache,
      bet_type: betType,
      updated_at: now,
      from_cache: false,
      books_fetched: Array.from(bookTokensMap.keys()),
      legs_hash: betslipLegsHash,
      total_legs: totalLegs,
      cache_stats: {
        redis_hits: redisCacheHits,
        vendor_calls: vendorCalls,
      },
      diagnostics: {
        token_coverage: resolvedTokens.coverage.by_book,
        full_support_books: resolvedTokens.coverage.full_support_books,
        partial_support_books: resolvedTokens.coverage.partial_support_books,
      },
    });
  } catch (error) {
    console.error("[SGP API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
