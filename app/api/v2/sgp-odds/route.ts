import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import { redis } from "@/lib/redis";
import { fetchSgpQuote } from "@/lib/sgp/quote-service";

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
    event_id?: string | null;
    odds_key?: string | null;
    player_name?: string | null;
    line?: number | null;
    side?: string | null;
    books_snapshot?: Record<string, { sgp?: string }>;
  } | null;
}

// SSE/live odds selection format
interface SSESelection {
  player: string;
  line: number;
  side: string;
  price: string;
  price_decimal: number;
  link?: string;
  sgp?: string;
  locked?: boolean;
  market?: string; // Market type for matching
}

type SSEBookSelections = Record<string, SSESelection>;

// =============================================================================
// CONSTANTS
// =============================================================================

const SGP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (database cache)

// Get all sportsbooks that support SGP (only books with sgp: true in sportsbooks.ts)
const SGP_SUPPORTING_BOOKS = Object.entries(SPORTSBOOKS_META)
  .filter(([_, meta]) => meta.sgp === true && meta.isActive === true)
  .map(([id]) => id);

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
 * Normalize player name for matching
 */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scan Redis keys with pattern
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0");

  return keys;
}

/**
 * Fetch live SGP tokens from Redis for a favorite
 * Falls back to books_snapshot if live data unavailable
 */
async function fetchLiveSgpTokens(
  favorite: BetslipItemWithFavorite['favorite'],
  booksToFetch: string[]
): Promise<Record<string, string>> {
  const tokens: Record<string, string> = {};
  
  if (!favorite?.odds_key) {
    // Fallback to saved snapshot
    if (favorite?.books_snapshot) {
      for (const bookId of booksToFetch) {
        const sgp = favorite.books_snapshot[bookId]?.sgp;
        if (sgp) tokens[bookId] = sgp;
      }
    }
    return tokens;
  }
  
  // Try to fetch live data from Redis
  try {
    // Get all book keys for this market
    const bookPattern = `${favorite.odds_key}:*`;
    const bookKeys = await scanKeys(bookPattern);
    
    if (bookKeys.length === 0) {
      // No live data - fall back to snapshot
      if (favorite?.books_snapshot) {
        for (const bookId of booksToFetch) {
          const sgp = favorite.books_snapshot[bookId]?.sgp;
          if (sgp) tokens[bookId] = sgp;
        }
      }
      return tokens;
    }
    
    // Fetch all book data
    const bookDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...bookKeys);
    
    // Build book → selections map
    const bookSelections: Record<string, SSEBookSelections> = {};
    bookKeys.forEach((key, i) => {
      const book = key.split(":").pop()!;
      const data = bookDataRaw[i];
      if (data && booksToFetch.includes(book)) {
        bookSelections[book] = typeof data === "string" ? JSON.parse(data) : data;
      }
    });
    
    // Find matching selection for each book
    const normalizedPlayer = normalizePlayerName(favorite.player_name || "");
    // Extract market from odds_key (format: odds:{sport}:{eventId}:{market})
    const favoriteMarket = favorite.odds_key?.split(':')[3] || null;
    
    console.log(`[SGP API] Looking for: player="${favorite.player_name}", line=${favorite.line}, side=${favorite.side}, market=${favoriteMarket}`);
    
    for (const [book, selections] of Object.entries(bookSelections)) {
      let matchFound = false;
      let bestCandidate: { sel: SSESelection; lineDiff: number } | null = null;
      
      for (const sel of Object.values(selections) as SSESelection[]) {
        // Match by player name
        const selPlayerNormalized = normalizePlayerName(sel.player);
        if (!selPlayerNormalized.includes(normalizedPlayer) && !normalizedPlayer.includes(selPlayerNormalized)) {
          continue;
        }
        
        // Match by side
        if (sel.side !== favorite.side) {
          continue;
        }
        
        // Match by market if available (important for players with multiple props)
        if (favoriteMarket && sel.market && sel.market !== favoriteMarket) {
          continue;
        }
        
        // Must have SGP token
        if (!sel.sgp) {
          continue;
        }
        
        // Calculate line difference (prefer exact match, then closest)
        const lineDiff = (favorite.line !== null && favorite.line !== undefined)
          ? Math.abs(sel.line - favorite.line)
          : 0;
        
        // Exact line match - use immediately
        if (lineDiff === 0) {
          bestCandidate = { sel, lineDiff: 0 };
          break;
        }
        
        // Track closest line match as fallback (within ±3 of saved line)
        if (lineDiff <= 3 && (!bestCandidate || lineDiff < bestCandidate.lineDiff)) {
          bestCandidate = { sel, lineDiff };
        }
      }
      
      if (bestCandidate) {
        tokens[book] = bestCandidate.sel.sgp!;
        matchFound = true;
        console.log(`[SGP API] ✓ Found token for ${book}: searched="${favorite.player_name}" matched="${bestCandidate.sel.player}", line=${bestCandidate.sel.line} (saved=${favorite.line}, diff=${bestCandidate.lineDiff}), side=${bestCandidate.sel.side}, token=${bestCandidate.sel.sgp?.substring(0, 40)}...`);
      }
      
      if (!matchFound && Object.keys(selections).length > 0) {
        console.log(`[SGP API] ✗ No match for ${book} (searched="${favorite.player_name}", checked ${Object.keys(selections).length} selections)`);
      }
    }
    
    // Fall back to snapshot for any books not found in live data
    if (favorite?.books_snapshot) {
      for (const bookId of booksToFetch) {
        if (!tokens[bookId]) {
          const sgp = favorite.books_snapshot[bookId]?.sgp;
          if (sgp) tokens[bookId] = sgp;
        }
      }
    }
    
    return tokens;
  } catch (error) {
    console.warn("[SGP API] Failed to fetch live SGP tokens:", error);
    // Fallback to saved snapshot
    if (favorite?.books_snapshot) {
      for (const bookId of booksToFetch) {
        const sgp = favorite.books_snapshot[bookId]?.sgp;
        if (sgp) tokens[bookId] = sgp;
      }
    }
    return tokens;
  }
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

    if (cachedOdds && cacheIsFresh && !force_refresh) {
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

    // Collect SGP tokens for each book AND compute global legs hash
    const bookTokensMap = new Map<string, string[]>();
    
    // Collect all favorite IDs to compute betslip legs hash
    // This helps frontend detect when legs were added/removed
    const favoriteIds = items
      .map(item => item.favorite?.id)
      .filter(Boolean)
      .sort() as string[];
    const betslipLegsHash = generateLegsHash(favoriteIds);
    
    // Fetch LIVE SGP tokens for each favorite (not just from database snapshot)
    // This ensures we have current tokens even if they weren't saved originally
    const totalLegs = items.length;
    console.log(`[SGP API] Fetching live SGP tokens for ${totalLegs} legs...`);
    
    const liveSgpTokensByFavorite = await Promise.all(
      items.map(async (item) => {
        const tokens = await fetchLiveSgpTokens(item.favorite, booksToFetch);
        return { favoriteId: item.favorite?.id, tokens };
      })
    );
    
    // Track how many legs each book supports (before filtering)
    const bookLegsCount = new Map<string, number>();
    
    // Build bookTokensMap from live tokens
    for (const bookId of booksToFetch) {
      const tokens: string[] = [];
      
      for (const { tokens: favTokens } of liveSgpTokensByFavorite) {
        const sgpToken = favTokens[bookId];
        if (sgpToken) {
          tokens.push(sgpToken);
        }
      }
      
      // Track legs count for all books
      bookLegsCount.set(bookId, tokens.length);
      
      // Only include books that have at least 2 SGP tokens
      if (tokens.length >= 2) {
        bookTokensMap.set(bookId, tokens);
      }
    }
    
    console.log(`[SGP API] Found tokens for books: ${Array.from(bookTokensMap.keys()).join(', ')}`);
    
    // If no books have tokens from live data, fall back to database snapshot
    if (bookTokensMap.size === 0) {
      console.log(`[SGP API] No live tokens found, falling back to database snapshot`);
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
    }

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
    });
  } catch (error) {
    console.error("[SGP API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
