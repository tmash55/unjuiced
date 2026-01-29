import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { sportsbooksNew as SPORTSBOOKS_META } from "@/lib/data/sportsbooks";
import { redis } from "@/lib/redis";

// =============================================================================
// TYPES
// =============================================================================

interface SgpOddsRequest {
  betslip_id: string;
  sportsbooks?: string[]; // Optional: specific books to fetch, defaults to all SGP books
  force_refresh?: boolean; // Force refresh even if cache is fresh
}

// Cached SGP quote from Redis (short TTL to dedupe requests)
interface CachedSgpQuote {
  odds: SgpBookOdds;
  timestamp: number;
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

// Betslip item structure from joined query
interface BetslipItemWithFavorite {
  id: string;
  favorite?: {
    id?: string;
    event_id?: string | null;
    books_snapshot?: Record<string, { sgp?: string }>;
  } | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ODDSBLAZE_API_KEY = process.env.ODDSBLAZE_API_KEY;
const SGP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (database cache)
const SGP_REDIS_CACHE_TTL_SECONDS = 8; // 8 seconds (Redis dedup cache)

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
 * Generate Redis cache key for SGP quote
 */
function getSgpCacheKey(bookId: string, legsHash: string): string {
  return `sgp:${bookId}:${legsHash}`;
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
): Promise<{ odds: SgpBookOdds; fromCache: boolean; legsHash: string }> {
  const legsHash = generateLegsHash(sgpTokens);
  const cacheKey = getSgpCacheKey(bookId, legsHash);

  if (!ODDSBLAZE_API_KEY) {
    console.error("[SGP API] ODDSBLAZE_API_KEY is not set in environment variables");
    return { 
      odds: { error: "API key not configured - check ODDSBLAZE_API_KEY env var" },
      fromCache: false,
      legsHash,
    };
  }

  if (sgpTokens.length === 0) {
    return { 
      odds: { error: "No SGP tokens available for this book" },
      fromCache: false,
      legsHash,
    };
  }

  // Some legs might be missing SGP tokens for this book
  if (sgpTokens.length < 2) {
    return { 
      odds: { error: "Not enough legs have odds at this book" },
      fromCache: false,
      legsHash,
    };
  }

  // Check Redis cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = await redis.get<CachedSgpQuote>(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < SGP_REDIS_CACHE_TTL_SECONDS * 1000) {
        console.log(`[SGP API] Cache hit for ${bookId} (hash: ${legsHash})`);
        return { odds: cached.odds, fromCache: true, legsHash };
      }
    } catch (e) {
      // Redis error - continue to fetch from vendor
      console.warn(`[SGP API] Redis get error for ${bookId}:`, e);
    }
  }

  try {
    // URL format: https://{sportsbook_id}.sgp.oddsblaze.com/?key=YOUR_KEY
    const oddsBlazeBookId = getOddsBlazeBookId(bookId);
    const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;
    
    console.log(`[SGP API] Fetching odds for ${bookId} -> ${oddsBlazeBookId} with ${sgpTokens.length} tokens (hash: ${legsHash})`);
    
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
        return { 
          odds: { error: "Invalid API key - verify ODDSBLAZE_API_KEY" },
          fromCache: false,
          legsHash,
        };
      }
      return { 
        odds: { error: `API error: ${response.status}` },
        fromCache: false,
        legsHash,
      };
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return { 
        odds: { error: data.error || data.message },
        fromCache: false,
        legsHash,
      };
    }

    if (!data.price) {
      return { 
        odds: { error: "No price available for this combination" },
        fromCache: false,
        legsHash,
      };
    }

    const odds: SgpBookOdds = {
      price: data.price,
      links: data.links,
      limits: data.limits,
    };

    // Cache the result in Redis
    try {
      const cacheData: CachedSgpQuote = { odds, timestamp: Date.now() };
      await redis.set(cacheKey, cacheData, { ex: SGP_REDIS_CACHE_TTL_SECONDS });
    } catch (e) {
      console.warn(`[SGP API] Redis set error for ${bookId}:`, e);
    }

    return { odds, fromCache: false, legsHash };
  } catch (error) {
    console.error(`[SGP API] Fetch error for ${bookId}:`, error);
    return { 
      odds: { error: "Failed to fetch odds" },
      fromCache: false,
      legsHash,
    };
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

    const items = (betslip.items || []) as BetslipItemWithFavorite[];
    
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

    // Fetch odds from OddsBlaze in parallel (with Redis deduplication)
    const oddsPromises = Array.from(bookTokensMap.entries()).map(
      async ([bookId, tokens]) => {
        const result = await fetchOddsBlazeOdds(bookId, tokens, force_refresh);
        return { bookId, ...result };
      }
    );

    const oddsResults = await Promise.all(oddsPromises);
    
    // Build the odds cache object and track cache statistics
    const newOddsCache: SgpOddsCache = {};
    let redisCacheHits = 0;
    let vendorCalls = 0;
    
    for (const result of oddsResults) {
      newOddsCache[result.bookId] = result.odds;
      if (result.fromCache) {
        redisCacheHits++;
      } else {
        vendorCalls++;
      }
    }

    // Also include books that didn't have enough tokens
    for (const bookId of booksToFetch) {
      if (!bookTokensMap.has(bookId) && !newOddsCache[bookId]) {
        newOddsCache[bookId] = { error: "Not all legs available at this book" };
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
