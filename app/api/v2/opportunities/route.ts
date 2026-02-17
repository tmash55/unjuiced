export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { 
  normalizePlayerName, 
  getMarketDisplay,
  normalizeRawMarket,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import { getPreset, SHARP_PRESETS } from "@/lib/odds/presets";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// OPTIMIZATION: Cache settings balanced for freshness + efficiency
// Tiered TTLs: longer TTL for custom blends since configurations rarely change
const SPORT_CACHE_TTL_DEFAULT = 20;  // 20 seconds for default/preset requests
const SPORT_CACHE_TTL_CUSTOM = 30;   // 30 seconds for custom blend requests (1.5x longer)
const ENABLE_CACHE = true; // Set to false to disable caching for debugging

/**
 * Determine if this is a custom blend request (user-defined blend configuration)
 */
function isCustomBlendRequest(blend: { book: string; weight: number }[] | null): boolean {
  return blend !== null && blend.length > 0;
}

/**
 * Get the appropriate cache TTL based on request type
 */
function getCacheTTL(blend: { book: string; weight: number }[] | null): number {
  return isCustomBlendRequest(blend) ? SPORT_CACHE_TTL_CUSTOM : SPORT_CACHE_TTL_DEFAULT;
}
const SCAN_COUNT = 1000; // Higher = fewer round trips to Redis
const MGET_CHUNK_SIZE = 500; // Upstash limit per MGET

// Performance: Pre-warm hint for when SSE triggers a refetch
// If provided, skip full recalculation and just invalidate cache
const FAST_PATH_ENABLED = true;

// OPTIMIZATION: Track timing for monitoring
const TIMING_ENABLED = process.env.NODE_ENV === 'development';

/**
 * Generate a cache key for raw sport opportunities
 * Includes blend information since sharp odds depend on the preset
 */
function getSportCacheKey(
  sport: string, 
  markets: string[] | null, 
  minBooksPerSide: number, 
  marketType: string | null,
  blend: { book: string; weight: number }[] | null,
  useAverage: boolean,
  useNextBest: boolean
): string {
  const marketsKey = markets ? markets.sort().join(",") : "all";
  const typeKey = marketType || "all";
  // Include blend configuration in cache key - sharp odds depend on this
  const blendKey = blend 
    ? blend.map(b => `${b.book}:${b.weight}`).sort().join(",")
    : useNextBest 
      ? "nextbest"
      : useAverage 
        ? "average" 
        : "default";
  return `v2:sport:${sport}:${marketsKey}:${minBooksPerSide}:${typeKey}:${blendKey}`;
}

/**
 * Format multi-position strings like "GF" → "G/F", "FC" → "F/C", "PF" → "PF"
 * Common in basketball for players who play multiple positions
 */
function formatPosition(position: string | null): string | null {
  if (!position) return null;
  
  // Common multi-position combos that need a slash
  const multiPosPatterns = ["GF", "FG", "FC", "CF", "SF", "FS", "PG", "SG", "PF"];
  const upper = position.toUpperCase();
  
  // If it's exactly 2 characters and matches a multi-position pattern, add slash
  if (position.length === 2 && multiPosPatterns.includes(upper)) {
    return `${position[0]}/${position[1]}`;
  }
  
  return position;
}

// Supported sports (including soccer)
const VALID_SPORTS = new Set([
  "nba",
  "nfl",
  "nhl",
  "ncaab",
  "ncaaf",
  "mlb",
  "ncaabaseball",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

/**
 * Normalize book IDs to match our canonical sportsbook IDs (from sportsbooks.ts)
 */
function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
      return "bally-bet";
    case "sportsinteraction":
      return "sports-interaction";
    // FanDuel YourWay - matches sportsbooks.ts ID
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    // BetMGM Michigan is our preferred BetMGM source (US odds)
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

// Books to exclude from all calculations (regional variants, inactive books)
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana", 
  "hardrockindiana",
]);

// OPTIMIZATION: Known active books for pipeline construction (avoids wildcard scans)
const KNOWN_ACTIVE_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm", "caesars", "pointsbet", "bet365",
  "pinnacle", "circa", "hard-rock", "bally-bet", "betrivers", "unibet",
  "wynnbet", "espnbet", "fanatics", "betparx", "thescore", "prophetx",
  "superbook", "si-sportsbook", "betfred", "tipico", "fliff"
];

// Types
interface BookWeight {
  book: string;
  weight: number;
}

interface BookOffer {
  book: string;
  price: number;
  decimal: number;
  link: string | null;
  mobile_link: string | null;
  sgp: string | null;
  limits: { max: number } | null;
  included_in_average?: boolean;
  average_exclusion_reason?: string | null;
  odd_id?: string;
}

interface Opportunity {
  sport: string;
  event_id: string;
  event: {
    home_team: string;
    away_team: string;
    start_time: string;
  } | null;
  player: string;
  player_id: string | null;  // Player UUID from odds system (for hit rate profiles)
  team: string | null;
  position: string | null;
  market: string;
  market_display: string;
  line: number;
  side: "over" | "under";

  // Best odds
  best_book: string;
  best_price: string;              // Signed American odds (e.g. "+158", "-110")
  best_decimal: number;
  best_link: string | null;
  best_mobile_link: string | null; // Deep link for mobile apps

  // Sharp reference
  sharp_price: string | null;         // Signed American odds (e.g. "+108", "-143")
  sharp_decimal: number | null;
  sharp_books: string[];
  blend_complete: boolean;
  blend_weight_available: number;
  avg_book_count: number;             // Number of books used in average calculation (after RSI dedup)

  // Edge metrics
  edge: number | null;
  edge_pct: number | null;

  // Implied probabilities (for debugging and tooltips)
  best_implied: number | null;      // 1 / best_decimal
  sharp_implied: number | null;     // 1 / sharp_decimal
  
  // +EV metrics (properly devigged using both sides)
  true_probability: number | null;
  fair_decimal: number | null;      // 1 / true_probability
  fair_american: string | null;     // fair_decimal converted to American (signed, e.g. "+122")
  implied_edge: number | null;      // true_probability - best_implied
  ev: number | null;
  ev_pct: number | null;
  kelly_fraction: number | null;
  devig_method: "proper" | "estimated" | null;
  
  // Devig quality info
  overround: number | null;         // Total vig: (implied_over + implied_under) - 1
  
  // Market coverage: how many books exist on each side
  market_coverage: {
    n_books_over: number;
    n_books_under: number;
    two_way_devig_ready: boolean;   // Both sides have enough books (≥ minBooksPerSide)
  } | null;
  
  // Devig inputs: what was used to calculate fair odds
  devig_inputs: {
    source: "sharp_book" | "sharp_blend" | "market_average";
    aggregation: "single" | "mean" | "weighted";  // How books were combined
    over_books: string[];           // Which books contributed to over sharp
    under_books: string[];          // Which books contributed to under sharp
  } | null;

  // Opposite side info (for transparency and expandable rows)
  opposite_side: {
    side: "over" | "under";
    sharp_price: string | null;       // Signed American odds
    sharp_decimal: number | null;
    best_book: string | null;
    best_price: string | null;        // Signed American odds
    best_decimal: number | null;
    all_books: {
      book: string;
      price: number;
      decimal: number;
      link: string | null;
      mobile_link: string | null;     // Deep link for mobile apps
      sgp: string | null;
      limits: { max: number } | null;
      included_in_average?: boolean;
      average_exclusion_reason?: string | null;
      odd_id?: string;
    }[];
  } | null;

  // All books
  all_books: {
    book: string;
    price: number;
    decimal: number;
    link: string | null;
    mobile_link: string | null;       // Deep link for mobile apps
    sgp: string | null;
    limits: { max: number } | null;  // Betting limits when available (e.g., Pinnacle)
    included_in_average?: boolean;
    average_exclusion_reason?: string | null;
    odd_id?: string;
  }[];
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  total_scanned: number;
  total_after_filters: number;  // Count after filters but before limit - helps diagnose if limit is hiding results
  filters: {
    sports: string[];
    markets: string[] | null;
    min_odds: number;
    max_odds: number;
    min_edge: number;
    min_ev: number;
    preset: string | null;
    blend: BookWeight[] | null;
    require_full_blend: boolean;
    min_books_per_side: number;
    require_two_way: boolean;
  };
  timing_ms: number;
  cache_hit: boolean;  // Whether data came from cache
}

/**
 * GET /api/v2/opportunities
 * 
 * Unified endpoint for Edge Finder and +EV tool
 * Aggregates opportunities across multiple sports and markets
 * 
 * Query params:
 *   sports    - Comma-separated sports (default: "nba")
 *   markets   - Comma-separated markets (default: all)
 *   minOdds   - Minimum American odds (default: -500)
 *   maxOdds   - Maximum American odds (default: 500)
 *   minEdge   - Minimum edge % vs sharp (default: 0)
 *   minEV     - Minimum EV % (default: 0)
 *   blend     - Custom book weights (e.g., "pinnacle:0.6,circa:0.4")
 *   limit     - Max results (default: 100)
 *   sort      - Sort by "edge" or "ev" (default: "ev")
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;

    // Parse parameters
    const sportsParam = params.get("sports")?.toLowerCase().split(",").filter(Boolean) || ["nba"];
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));
    
    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    // SSE Fast-Path: If frontend provides "refresh" param, invalidate caches first
    // This ensures fresh data when SSE indicates updates
    const refreshHint = params.get("refresh");
    if (refreshHint === "true" || refreshHint === "1") {
      // Invalidate all sport caches to ensure fresh data
      sports.forEach(sport => invalidateSportCaches(sport));
      console.log(`[API] SSE refresh hint: invalidated caches for ${sports.join(", ")}`);
    }

    const markets = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    console.log(`[API] Markets filter:`, markets ? `${markets.length} markets: ${markets.slice(0, 5).join(", ")}${markets.length > 5 ? '...' : ''}` : 'none (all markets)');
    const minOdds = parseInt(params.get("minOdds") || "-500");
    const maxOdds = parseInt(params.get("maxOdds") || "10000");
    const minEdge = parseFloat(params.get("minEdge") || "0");
    const minEV = parseFloat(params.get("minEV") || "0");
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);
    const sortBy = params.get("sort") === "edge" ? "edge" : "ev";
    const requireFullBlend = params.get("requireFullBlend") === "true";
    const minBooksPerSide = Math.max(1, parseInt(params.get("minBooksPerSide") || "2"));
    const requireTwoWay = params.get("requireTwoWay") === "true";
    const marketType = params.get("marketType") as "player" | "game" | null;
    
    // Parse market lines filter (e.g., {"touchdowns": [0.5]} to only show "Anytime" touchdowns)
    let marketLines: Record<string, number[]> = {};
    const marketLinesParam = params.get("marketLines");
    if (marketLinesParam) {
      try {
        marketLines = JSON.parse(marketLinesParam);
      } catch (e) {
        console.warn("[/api/v2/opportunities] Invalid marketLines JSON:", marketLinesParam);
      }
    }

    // Parse blend - can be a preset ID or custom blend string
    const presetId = params.get("preset");
    const blendParam = params.get("blend");
    let blend: BookWeight[] | null = null;
    let presetName: string | null = null;

    // Track if user explicitly requested average or next_best
    let useAverage = false;
    let useNextBest = false;

    if (presetId) {
      // Use preset
      if (presetId === 'next_best') {
        // Special mode: compare to next-best book's price
        useNextBest = true;
        presetName = "Next Best";
      } else {
        const preset = getPreset(presetId);
        if (preset) {
          presetName = preset.name;
          if (preset.books.length > 0) {
            blend = preset.books;
          } else {
            // Empty books = average preset
            useAverage = true;
          }
        } else if (presetId !== 'average') {
          // Not a known preset, treat as a single-book blend (e.g., "draftkings")
          // This allows "Compare vs DraftKings" to work even without a defined preset
          blend = [{ book: presetId.toLowerCase(), weight: 1.0 }];
          presetName = presetId;
        }
      }
    } else if (blendParam) {
      // Use custom blend
      blend = parseBlend(blendParam);
    }
    // If neither, blend is null (default behavior: Pinnacle > Circa > average)

    // Fetch all sports in parallel (per-sport caching happens inside)
    const sportPromises = sports.map((sport) =>
      fetchSportOpportunitiesCached(sport, markets, blend, minBooksPerSide, useAverage, marketType, useNextBest)
    );
    const results = await Promise.all(sportPromises);
    
    // Track cache hits
    const cacheHit = results.some(r => r.cacheHit);

    // Merge all results
    let allOpportunities = results.flatMap(r => r.opportunities);
    const totalScanned = allOpportunities.length;

    // Only exclude opportunities where best book equals reference book in
    // true single-book comparison modes.
    // For multi-book custom blends, allow best book to be one of the blend inputs.
    const selfComparisonBooks = new Set<string>();
    if (blend && blend.length === 1) {
      selfComparisonBooks.add(blend[0].book.toLowerCase());
    } else if (!blend && presetId && presetId !== "average" && presetId !== "next_best") {
      selfComparisonBooks.add(presetId.toLowerCase());
    }

    // Apply filters
    allOpportunities = allOpportunities.filter((o) => {
      // Exclude only in single-book self-comparison modes
      if (selfComparisonBooks.size > 0 && selfComparisonBooks.has((o.best_book || "").toLowerCase())) return false;

      // Market type filter (player props vs game lines)
      // Player props have a player name, game lines don't (or have "game")
      if (marketType) {
        const isPlayerProp = o.player && o.player !== "" && o.player.toLowerCase() !== "game";
        if (marketType === "player" && !isPlayerProp) return false;
        if (marketType === "game" && isPlayerProp) return false;
      }

      // Market-specific line filter (e.g., {"touchdowns": [0.5]} to only show "Anytime" touchdowns)
      // This allows users to filter out 2+, 3+ touchdown lines and only show 0.5 (anytime)
      if (Object.keys(marketLines).length > 0) {
        // Normalize market key (lowercase, alphanumeric + hyphens only)
        const normalizedMarket = (o.market || "").toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Check if this market has specific line restrictions
        for (const [marketKey, allowedLines] of Object.entries(marketLines)) {
          const normalizedKey = marketKey.toLowerCase().replace(/[^a-z0-9-]/g, '');
          
          // If the opportunity's market matches the filtered market
          if (normalizedMarket.includes(normalizedKey) || normalizedKey.includes(normalizedMarket)) {
            // And we have specific lines selected for this market
            if (allowedLines && allowedLines.length > 0) {
              // Check if the opportunity's line is in the allowed lines
              if (!allowedLines.includes(o.line)) {
                return false;
              }
            }
          }
        }
      }

      // Odds range filter (parse the formatted price string back to number for comparison)
      const priceNum = parseInt(o.best_price.replace("+", ""), 10);
      if (priceNum < minOdds || priceNum > maxOdds) return false;

      // Edge filter
      if (minEdge > 0 && (o.edge_pct === null || o.edge_pct < minEdge)) return false;

      // EV filter
      if (minEV > 0 && (o.ev_pct === null || o.ev_pct < minEV)) return false;

      // Full blend filter
      if (requireFullBlend && !o.blend_complete) return false;

      // Two-way complete filter
      if (requireTwoWay && (!o.market_coverage || !o.market_coverage.two_way_devig_ready)) return false;

      return true;
    });

    // Sort - use stable sort with secondary keys to ensure consistent ordering
    // Primary: edge or ev (descending), Secondary: game start time (ascending), Tertiary: unique key
    const getUniqueKey = (opp: Opportunity) => 
      `${opp.event_id}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
    
    if (sortBy === "ev") {
      allOpportunities.sort((a, b) => {
        const evDiff = (b.ev_pct || 0) - (a.ev_pct || 0);
        if (evDiff !== 0) return evDiff;
        // Secondary: earlier games first
        const timeDiff = (new Date(a.event?.start_time || 0).getTime()) - (new Date(b.event?.start_time || 0).getTime());
        if (timeDiff !== 0) return timeDiff;
        // Tertiary: stable by unique key
        return getUniqueKey(a).localeCompare(getUniqueKey(b));
      });
    } else {
      allOpportunities.sort((a, b) => {
        const edgeDiff = (b.edge_pct || 0) - (a.edge_pct || 0);
        if (edgeDiff !== 0) return edgeDiff;
        // Secondary: earlier games first
        const timeDiff = (new Date(a.event?.start_time || 0).getTime()) - (new Date(b.event?.start_time || 0).getTime());
        if (timeDiff !== 0) return timeDiff;
        // Tertiary: stable by unique key
        return getUniqueKey(a).localeCompare(getUniqueKey(b));
      });
    }

    // Track count after filters but before limit
    const totalAfterFilters = allOpportunities.length;

    // Limit
    const opportunities = allOpportunities.slice(0, limit);

    const response: OpportunitiesResponse = {
      opportunities,
      count: opportunities.length,
      total_scanned: totalScanned,
      total_after_filters: totalAfterFilters,
      filters: {
        sports,
        markets,
        min_odds: minOdds,
        max_odds: maxOdds,
        min_edge: minEdge,
        min_ev: minEV,
        preset: presetName,
        blend,
        require_full_blend: requireFullBlend,
        min_books_per_side: minBooksPerSide,
        require_two_way: requireTwoWay,
      },
      timing_ms: Date.now() - startTime,
      cache_hit: cacheHit,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (error) {
    console.error("[/api/v2/opportunities] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", timing_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

/**
 * Parse blend parameter: "pinnacle:0.6,circa:0.4" -> [{ book, weight }]
 */
function parseBlend(blendStr: string | null): BookWeight[] | null {
  if (!blendStr) return null;

  const weights: BookWeight[] = [];
  const parts = blendStr.split(",");

  for (const part of parts) {
    const [book, weightStr] = part.split(":");
    const weight = parseFloat(weightStr);
    if (book && !isNaN(weight) && weight > 0 && weight <= 1) {
      weights.push({ book: book.toLowerCase(), weight });
    }
  }

  // Validate weights sum to ~1.0
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (weights.length === 0 || Math.abs(totalWeight - 1) > 0.01) {
    return null; // Invalid blend, fall back to default
  }

  return weights;
}

/**
 * Fetch opportunities for a single sport
 */
// Intermediate structure to collect both sides of a selection
interface SelectionPair {
  sport: string;
  eventId: string;
  event: { home_team: string; away_team: string; start_time: string } | null;
  player: string;          // Normalized key format (e.g., "andrew_ogletree")
  playerDisplay: string;   // Readable format (e.g., "Andrew Ogletree")
  playerId: string | null; // Player UUID from odds system
  team: string | null;
  position: string | null;
  market: string;
  marketDisplay: string;   // Human-readable market (e.g., "Player Points" instead of "player_points")
  line: number;
  over: {
    books: BookOffer[];
    best: { book: string; price: number; decimal: number; link: string | null; mobile_link: string | null } | null;
  };
  under: {
    books: BookOffer[];
    best: { book: string; price: number; decimal: number; link: string | null; mobile_link: string | null } | null;
  };
}

/**
 * Strip large fields from opportunity for caching
 * Reduces size significantly by removing the full all_books array
 * BUT ensures sharp/reference books are always included so they show in expanded view
 */
function stripForCache(opp: Opportunity): Opportunity {
  const allBooks = opp.all_books || [];
  const sharpBooks = opp.sharp_books || [];
  
  // Take top 5 books by odds
  const topBooks = allBooks.slice(0, 5);
  const topBookIds = new Set(topBooks.map(b => b.book));
  
  // Find any sharp books that aren't already in top 5
  const missingSharpBooks = allBooks.filter(
    b => sharpBooks.includes(b.book) && !topBookIds.has(b.book)
  );
  
  // Combine: top 5 + any missing sharp books (max 8 total to keep size reasonable)
  const keptBooks = [...topBooks, ...missingSharpBooks].slice(0, 8);
  
  return {
    ...opp,
    all_books: keptBooks,
  };
}

/**
 * Cached wrapper for fetchSportOpportunities
 * Caches raw opportunities per-sport with tiered TTL (default vs custom blend)
 */
async function fetchSportOpportunitiesCached(
  sport: string,
  markets: string[] | null,
  blend: BookWeight[] | null,
  minBooksPerSide: number,
  useAverage: boolean,
  marketType: string | null = null,
  useNextBest: boolean = false
): Promise<{ opportunities: Opportunity[]; cacheHit: boolean }> {
  const cacheKey = getSportCacheKey(sport, markets, minBooksPerSide, marketType, blend, useAverage, useNextBest);
  const cacheTTL = getCacheTTL(blend);
  
  if (ENABLE_CACHE) {
    try {
      const cached = await redis.get<{ opportunities: Opportunity[]; timestamp: number }>(cacheKey);
      // Use same TTL for read check as we do for write - ensures consistency
      if (cached && (Date.now() - cached.timestamp) < cacheTTL * 1000) {
        return { opportunities: cached.opportunities, cacheHit: true };
      }
    } catch (e) {
      // Cache read failed, continue without cache
      console.warn("[Cache] Read failed:", e);
    }
  }
  
  // Fetch fresh data
  const opportunities = await fetchSportOpportunities(sport, markets, blend, minBooksPerSide, useAverage, useNextBest);
  
  // Cache the results - limit count AND strip large fields to avoid size limits
  // Upstash has a 1MB limit per item
  // Use tiered TTL: longer for custom blends (configs rarely change)
  if (ENABLE_CACHE && opportunities.length > 0) {
    try {
      // Sort before caching to ensure consistent order when returned from cache
      const getKey = (o: Opportunity) => `${o.event_id}:${o.player}:${o.market}:${o.line}:${o.side}`;
      const sorted = [...opportunities].sort((a, b) => {
        const edgeDiff = (b.edge_pct || 0) - (a.edge_pct || 0);
        if (edgeDiff !== 0) return edgeDiff;
        const timeDiff = (new Date(a.event?.start_time || 0).getTime()) - (new Date(b.event?.start_time || 0).getTime());
        if (timeDiff !== 0) return timeDiff;
        return getKey(a).localeCompare(getKey(b));
      });
      const toCache = sorted.slice(0, 500).map(stripForCache); // Increased to 500 for more coverage
      await redis.set(cacheKey, { opportunities: toCache, timestamp: Date.now() }, { ex: cacheTTL });
    } catch (e) {
      // Cache write failed - likely size issue, ignore
      console.warn("[Cache] Write failed (size?):", e);
    }
  }
  
  return { opportunities, cacheHit: false };
}

async function fetchSportOpportunities(
  sport: string,
  markets: string[] | null,
  blend: BookWeight[] | null,
  minBooksPerSide: number,
  useAverage: boolean,
  useNextBest: boolean = false
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];
  // Map to collect both sides: key = "eventId:market:player:line"
  const pairMap = new Map<string, SelectionPair>();

  try {
    // Step 1: Get active events (small set, O(1) from SMEMBERS)
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];
    
    // Step 2: Get odds keys scoped to active events only (focused scans)
    const allOddsKeys = await getOddsKeysForEvents(sport, eventIds);
    if (allOddsKeys.length === 0) return [];

    // Filter keys to only active events and group by event+market
    const eventIdSet = new Set(eventIds);
    const filteredKeys: string[] = [];
    const keysByEventMarket = new Map<string, string[]>(); // "eventId:market" -> keys
    
    // Helper to check if market is allowed (supports composite keys like "nba:player_points")
    const isMarketAllowed = (market: string): boolean => {
      if (!markets) return true; // No filter = all allowed
      // Check composite key (sport-specific)
      if (markets.includes(`${sport}:${market}`)) return true;
      // Check plain key (global / backwards compat)
      if (markets.includes(market)) return true;
      return false;
    };
    
    let marketsSkipped = 0;
    for (const key of allOddsKeys) {
      const parts = key.split(":");
      // odds:sport:eventId:market:book
      const eventId = parts[2];
      const market = parts[3];
      const book = parts[4];
      
      if (!eventId || !market || !book) continue;
      if (!eventIdSet.has(eventId)) continue;
      if (!isMarketAllowed(market)) {
        marketsSkipped++;
        continue;
      }
      
      filteredKeys.push(key);
      const groupKey = `${eventId}:${market}`;
      if (!keysByEventMarket.has(groupKey)) {
        keysByEventMarket.set(groupKey, []);
      }
      keysByEventMarket.get(groupKey)!.push(key);
    }
    
    if (markets) {
      console.log(`[API] Market filter: kept ${filteredKeys.length} keys, skipped ${marketsSkipped} due to market filter`);
    }
    
    if (filteredKeys.length === 0) return [];

    // OPTIMIZATION: Batch fetch ALL odds data in parallel chunks
    const MGET_CHUNK_SIZE = 500; // Upstash limit per request
    const chunks: string[][] = [];
    for (let i = 0; i < filteredKeys.length; i += MGET_CHUNK_SIZE) {
      chunks.push(filteredKeys.slice(i, i + MGET_CHUNK_SIZE));
    }
    
    // Fetch all chunks in parallel (much faster than sequential)
    const chunkResults = await Promise.all(
      chunks.map(chunk => redis.mget<(SSEBookSelections | string | null)[]>(...chunk))
    );
    const allOddsData = chunkResults.flat();
    
    // Build key -> data map
    const oddsDataMap = new Map<string, SSEBookSelections>();
    filteredKeys.forEach((key, i) => {
      const data = allOddsData[i];
      if (data) {
        oddsDataMap.set(key, typeof data === "string" ? JSON.parse(data) : data);
      }
    });

    // Fetch event details (already batched)
    const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
    const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

    // Build event map - use commence_time from Redis event data
    // Also filter out games that have already started (live filtering)
    const now = new Date();
    const eventMap = new Map<string, { home_team: string; away_team: string; start_time: string }>();
    const liveEventIds = new Set<string>(); // Track events that have started
    const missingEventIds = new Set<string>(); // Track events with no data
    
    eventIds.forEach((id, i) => {
      const event = eventsRaw[i];
      if (!event) {
        // No event data in Redis - skip this event
        missingEventIds.add(id);
        return;
      }
      
      const startTime = (event.commence_time as string) || (event.start_time as string) || "";
      
      // Check if game has started
      if (startTime) {
        const gameStart = new Date(startTime);
        if (!isNaN(gameStart.getTime()) && gameStart <= now) {
          // Game has started - mark as live and skip
          liveEventIds.add(id);
          return;
        }
      }
      
      const homeTeam = (event.home_team as string) || "";
      const awayTeam = (event.away_team as string) || "";
      
      // Skip events without valid team data
      if (!homeTeam || !awayTeam) {
        missingEventIds.add(id);
        return;
      }
      
      eventMap.set(id, {
        home_team: homeTeam,
        away_team: awayTeam,
        start_time: startTime,
      });
    });

    // Process each event+market group (now all data is in memory)
    for (const [groupKey, marketKeys] of keysByEventMarket) {
      const [eventId, market] = groupKey.split(":");
      
      // Skip live games (already started) or events with missing data
      if (liveEventIds.has(eventId) || missingEventIds.has(eventId)) continue;
      
      const event = eventMap.get(eventId) || null;

      // Build book → selections map from pre-fetched data
      const bookSelections: Record<string, SSEBookSelections> = {};
      for (const key of marketKeys) {
        const rawBook = key.split(":").pop()!;
        const book = normalizeBookId(rawBook);
        const data = oddsDataMap.get(key);
        if (data) {
          bookSelections[book] = data;
        }
      }

      // Get all unique base selection keys (player|line without side)
      // For team_total market, we need to differentiate home vs away teams
      const baseSelectionKeys = new Set<string>();
      for (const [bookName, selections] of Object.entries(bookSelections)) {
        for (const [key, sel] of Object.entries(selections)) {
          const [playerRaw, , lineStr] = key.split("|");
          if (playerRaw && lineStr) {
            // For team_total markets, include home/away designation from raw_market
            if (market === "team_total" && sel && typeof sel === "object" && "raw_market" in sel) {
              const rawMarket = (sel as SSESelection).raw_market || "";
              const teamSide = rawMarket.toLowerCase().includes("home") ? "home" 
                : rawMarket.toLowerCase().includes("away") ? "away" 
                : "";
              if (teamSide) {
                baseSelectionKeys.add(`${playerRaw}|${lineStr}|${teamSide}`);
              } else {
                baseSelectionKeys.add(`${playerRaw}|${lineStr}|`);
              }
            } else {
              baseSelectionKeys.add(`${playerRaw}|${lineStr}|`);
            }
          }
        }
      }

      // Process each player/line pair (collecting both over and under)
      for (const baseKey of baseSelectionKeys) {
        const [playerRaw, lineStr, teamSide] = baseKey.split("|");
        const player = normalizePlayerName(playerRaw);
        const line = parseFloat(lineStr);

        // Create unique pair key (include teamSide for team_total markets to separate home/away)
        const pairKey = teamSide 
          ? `${eventId}:${market}:${player}:${line}:${teamSide}`
          : `${eventId}:${market}:${player}:${line}`;

        // Get or create selection pair
        let pair = pairMap.get(pairKey);
        if (!pair) {
          pair = {
            sport,
            eventId,
            event,
            player,
            playerDisplay: "", // Will be populated from selection data
            playerId: null,    // Will be populated from selection data
            team: null,
            position: null,
            market,
            marketDisplay: "", // Will be populated from raw_market field
            line,
            over: { books: [], best: null },
            under: { books: [], best: null },
          };
          pairMap.set(pairKey, pair);
        }

        // Helper to check if a selection matches the expected team side (for team_total markets)
        const matchesTeamSide = (sel: SSESelection | undefined): boolean => {
          if (!teamSide || market !== "team_total") return true; // No filtering needed
          if (!sel?.raw_market) return false;
          const rawMarket = sel.raw_market.toLowerCase();
          if (teamSide === "home") return rawMarket.includes("home");
          if (teamSide === "away") return rawMarket.includes("away");
          return true;
        };

        // Gather prices from all books for both sides
        // Support both over/under AND yes/no (for double/triple double, anytime scorer, etc.)
        for (const [book, selections] of Object.entries(bookSelections)) {
          // Skip excluded books (regional variants, etc.)
          if (EXCLUDED_BOOKS.has(book.toLowerCase())) continue;
          
          // Check "over" side (also check "yes" for yes/no markets like double double)
          // Also check "ml" for single-line markets like first basket, anytime TD, etc.
          const overKey = `${playerRaw}|over|${lineStr}`;
          const yesKey = `${playerRaw}|yes|${lineStr}`;
          const mlKey = `${playerRaw}|ml|${lineStr}`;
          const overSel = (selections[overKey] || selections[yesKey] || selections[mlKey]) as SSESelection | undefined;
          // For team_total markets, only include selections that match the team side
          if (overSel && !overSel.locked && matchesTeamSide(overSel)) {
            const overPrice = parseInt(String(overSel.price), 10);
            pair.over.books.push({
              book,
              price: overPrice,
              decimal: overSel.price_decimal,
              link: overSel.link || null,
              mobile_link: overSel.mobile_link || null,
              sgp: overSel.sgp || null,
              limits: overSel.limits || null,
              odd_id: overSel.odd_id || undefined,
            });
            if (!pair.over.best || overSel.price_decimal > pair.over.best.decimal) {
              pair.over.best = {
                book,
                price: overPrice,
                decimal: overSel.price_decimal,
                link: overSel.link || null,
                mobile_link: overSel.mobile_link || null,
              };
            }
            // Populate metadata from selection
            if (overSel.player && !pair.playerDisplay) pair.playerDisplay = overSel.player;
            if (overSel.player_id && !pair.playerId) pair.playerId = overSel.player_id;
            if (overSel.team && !pair.team) pair.team = overSel.team;
            if (overSel.position && !pair.position) pair.position = formatPosition(overSel.position);
            if (overSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(overSel.raw_market);
          }

          // Check "under" side (also check "no" for yes/no markets)
          const underKey = `${playerRaw}|under|${lineStr}`;
          const noKey = `${playerRaw}|no|${lineStr}`;
          const underSel = (selections[underKey] || selections[noKey]) as SSESelection | undefined;
          // For team_total markets, only include selections that match the team side
          if (underSel && !underSel.locked && matchesTeamSide(underSel)) {
            const underPrice = parseInt(String(underSel.price), 10);
            pair.under.books.push({
              book,
              price: underPrice,
              decimal: underSel.price_decimal,
              link: underSel.link || null,
              mobile_link: underSel.mobile_link || null,
              sgp: underSel.sgp || null,
              limits: underSel.limits || null,
              odd_id: underSel.odd_id || undefined,
            });
            if (!pair.under.best || underSel.price_decimal > pair.under.best.decimal) {
              pair.under.best = {
                book,
                price: underPrice,
                decimal: underSel.price_decimal,
                link: underSel.link || null,
                mobile_link: underSel.mobile_link || null,
              };
            }
            // Populate metadata from selection
            if (underSel.player && !pair.playerDisplay) pair.playerDisplay = underSel.player;
            if (underSel.player_id && !pair.playerId) pair.playerId = underSel.player_id;
            if (underSel.team && !pair.team) pair.team = underSel.team;
            if (underSel.position && !pair.position) pair.position = formatPosition(underSel.position);
            if (underSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(underSel.raw_market);
          }
        }
      }
    }

    // Moneyline feeds can publish one "ml" selection per team instead of over/under.
    // Group those sibling team pairs so we can populate opposite side books for UI/devig.
    const moneylineGroups = new Map<string, SelectionPair[]>();
    for (const pair of pairMap.values()) {
      if (!pair.market.toLowerCase().includes("moneyline")) continue;
      const groupKey = `${pair.eventId}:${pair.market}:${pair.line}`;
      if (!moneylineGroups.has(groupKey)) {
        moneylineGroups.set(groupKey, []);
      }
      moneylineGroups.get(groupKey)!.push(pair);
    }

    // Convert pairs to opportunities with proper devigging
    for (const pair of pairMap.values()) {
      // Create opportunities for both sides if they have enough books
      const sides: ("over" | "under")[] = ["over", "under"];
      
      for (const side of sides) {
        const sideData = pair[side];
        const oppositeSide = side === "over" ? "under" : "over";
        const oppositeData = pair[oppositeSide];
        let effectiveOppositeData = oppositeData;

        // For moneyline rows, fallback to the sibling team's "over/ml" books
        // when this pair has no direct under/no side populated.
        if (
          effectiveOppositeData.books.length === 0 &&
          pair.market.toLowerCase().includes("moneyline")
        ) {
          const groupKey = `${pair.eventId}:${pair.market}:${pair.line}`;
          const sibling = (moneylineGroups.get(groupKey) || []).find(
            (candidate) => candidate !== pair && candidate.over.books.length > 0
          );
          if (sibling) {
            effectiveOppositeData = sibling.over;
          }
        }

        // Need at least minBooksPerSide books on this side (default: 2 for EV, can be 1 for edge finder)
        if (sideData.books.length < minBooksPerSide || !sideData.best) continue;

        const opp: Opportunity = {
          sport: pair.sport,
          event_id: pair.eventId,
          event: pair.event,
          // Use readable player name, fall back to normalized if not available
          player: pair.playerDisplay || pair.player,
          player_id: pair.playerId,
          team: pair.team,
          position: pair.position,
          market: pair.market,
          // Use raw_market from SSE data for human-readable display, fallback to formatted market
          market_display: pair.marketDisplay || getMarketDisplay(pair.market),
          line: pair.line,
          side,
          best_book: sideData.best.book,
          best_price: formatAmericanOdds(sideData.best.price),
          best_decimal: sideData.best.decimal,
          best_link: sideData.best.link,
          best_mobile_link: sideData.best.mobile_link,
          sharp_price: null,
          sharp_decimal: null,
          sharp_books: [],
          blend_complete: true,
          blend_weight_available: 1.0,
          avg_book_count: 0,
          edge: null,
          edge_pct: null,
          best_implied: null,
          sharp_implied: null,
          true_probability: null,
          fair_decimal: null,
          fair_american: null,
          implied_edge: null,
          ev: null,
          ev_pct: null,
          kelly_fraction: null,
          devig_method: null,
          overround: null,
          market_coverage: null,
          devig_inputs: null,
          opposite_side: effectiveOppositeData.books.length > 0 ? {
            side: oppositeSide,
            sharp_price: null,
            sharp_decimal: null,
            best_book: effectiveOppositeData.best?.book || null,
            best_price: effectiveOppositeData.best ? formatAmericanOdds(effectiveOppositeData.best.price) : null,
            best_decimal: effectiveOppositeData.best?.decimal || null,
            all_books: effectiveOppositeData.books,
          } : null,
          all_books: sideData.books,
        };

        // Calculate metrics with proper devigging
        calculateMetricsWithDevig(opp, sideData, effectiveOppositeData, blend, minBooksPerSide, useAverage, useNextBest);
        opportunities.push(opp);
        
      }
    }

    return opportunities;
  } catch (error) {
    console.error(`[opportunities] Error fetching ${sport}:`, error);
    return [];
  }
}

/**
 * Calculate edge and EV metrics for an opportunity
 */
interface SideData {
  books: BookOffer[];
  best: { book: string; price: number; decimal: number; link: string | null; mobile_link: string | null } | null;
}

/**
 * Calculate metrics with proper devigging using both sides of the market
 */
function calculateMetricsWithDevig(
  opp: Opportunity,
  sideData: SideData,
  oppositeData: SideData,
  blend: BookWeight[] | null,
  minBooksPerSide: number,
  useAverage: boolean,
  useNextBest: boolean = false
): void {
  if (sideData.books.length < 2) return;

  // Always annotate average inclusion metadata for UI transparency,
  // even when comparison mode is not "average".
  annotateAndFilterBooksForAverage(sideData.books);
  annotateAndFilterBooksForAverage(oppositeData.books);

  // Sort books by decimal (best first)
  opp.all_books.sort((a, b) => b.decimal - a.decimal);

  let thisSharp: ReturnType<typeof getSharpOdds>;
  let oppositeSharp: ReturnType<typeof getSharpOdds>;

  if (useNextBest) {
    // Next Best mode: compare to the second-best book's price
    const sortedBooks = [...sideData.books].sort((a, b) => b.decimal - a.decimal);
    const bestDecimal = sortedBooks[0]?.decimal;
    // Find next best (first book with worse odds than best)
    const nextBest = sortedBooks.find(b => b.decimal < bestDecimal);
    
    thisSharp = {
      sharpDecimal: nextBest?.decimal || null,
      sharpBooks: nextBest ? [nextBest.book] : [],
      blendComplete: true,
      blendWeight: 1.0,
      bookCount: 1,
    };
    
    // For opposite side, also use next best
    const sortedOpp = [...oppositeData.books].sort((a, b) => b.decimal - a.decimal);
    const bestOppDecimal = sortedOpp[0]?.decimal;
    const nextBestOpp = sortedOpp.find(b => b.decimal < bestOppDecimal);
    
    oppositeSharp = {
      sharpDecimal: nextBestOpp?.decimal || null,
      sharpBooks: nextBestOpp ? [nextBestOpp.book] : [],
      blendComplete: true,
      blendWeight: 1.0,
      bookCount: 1,
    };
  } else {
    // Get sharp odds for THIS side
    thisSharp = getSharpOdds(sideData.books, blend, useAverage, minBooksPerSide);
    // Get sharp odds for OPPOSITE side (needed for devig)
    oppositeSharp = getSharpOdds(oppositeData.books, blend, useAverage, minBooksPerSide);
  }

  // Update blend flags and book count
  opp.blend_complete = thisSharp.blendComplete;
  opp.blend_weight_available = thisSharp.blendWeight;
  opp.avg_book_count = thisSharp.bookCount;

  // Set market coverage info
  const nBooksOver = opp.side === "over" ? sideData.books.length : oppositeData.books.length;
  const nBooksUnder = opp.side === "under" ? sideData.books.length : oppositeData.books.length;
  const twoWayComplete = sideData.books.length >= minBooksPerSide && 
                          oppositeData.books.length >= minBooksPerSide;

  opp.market_coverage = {
    n_books_over: nBooksOver,
    n_books_under: nBooksUnder,
    two_way_devig_ready: twoWayComplete,
  };

  // Set devig inputs info
  const devigSource: "sharp_book" | "sharp_blend" | "market_average" = 
    useNextBest ? "sharp_book" :
    useAverage ? "market_average" :
    (blend && blend.length > 1) ? "sharp_blend" :
    "sharp_book";

  const aggregation: "single" | "mean" | "weighted" = 
    useNextBest ? "single" :
    useAverage ? "mean" :
    (blend && blend.length > 1) ? "weighted" :
    "single";

  opp.devig_inputs = {
    source: devigSource,
    aggregation,
    over_books: opp.side === "over" ? thisSharp.sharpBooks : oppositeSharp.sharpBooks,
    under_books: opp.side === "under" ? thisSharp.sharpBooks : oppositeSharp.sharpBooks,
  };

  if (!thisSharp.sharpDecimal || thisSharp.sharpDecimal <= 1) return;

  // Set implied probabilities
  opp.best_implied = 1 / opp.best_decimal;
  opp.sharp_implied = 1 / thisSharp.sharpDecimal;

  // Set sharp reference for this side
  opp.sharp_decimal = thisSharp.sharpDecimal;
  opp.sharp_price = decimalToAmericanString(thisSharp.sharpDecimal);
  opp.sharp_books = thisSharp.sharpBooks;

  // Calculate EDGE (one-sided comparison - works without opposite side)
  opp.edge = opp.best_decimal - thisSharp.sharpDecimal;
  opp.edge_pct = ((opp.best_decimal / thisSharp.sharpDecimal) - 1) * 100;

  // Calculate EV (requires both sides for proper devig)
  if (oppositeSharp.sharpDecimal && oppositeSharp.sharpDecimal > 1 && twoWayComplete) {
    // PROPER DEVIG: Use both sides to calculate true probability
    const thisImplied = 1 / thisSharp.sharpDecimal;
    const oppositeImplied = 1 / oppositeSharp.sharpDecimal;
    const totalVig = thisImplied + oppositeImplied;
    const overround = totalVig - 1;

    // True probabilities after removing vig
    const trueProb = thisImplied / totalVig;

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied;
    opp.overround = overround;
    opp.devig_method = "proper";

    // Update opposite side info with sharp odds
    if (opp.opposite_side) {
      opp.opposite_side.sharp_decimal = oppositeSharp.sharpDecimal;
      opp.opposite_side.sharp_price = decimalToAmericanString(oppositeSharp.sharpDecimal);
    }

    // Calculate EV: (probability × payout) - 1
    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    // Kelly criterion: (bp - q) / b
    // where b = decimal - 1, p = true prob, q = 1 - p
    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  } else if (oppositeSharp.sharpDecimal && oppositeSharp.sharpDecimal > 1) {
    // Have both sides but NOT enough books - still calculate but mark as incomplete
    const thisImplied = 1 / thisSharp.sharpDecimal;
    const oppositeImplied = 1 / oppositeSharp.sharpDecimal;
    const totalVig = thisImplied + oppositeImplied;
    const overround = totalVig - 1;

    const trueProb = thisImplied / totalVig;

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied!;
    opp.overround = overround;
    opp.devig_method = "proper"; // Still proper math, just low confidence

    if (opp.opposite_side) {
      opp.opposite_side.sharp_decimal = oppositeSharp.sharpDecimal;
      opp.opposite_side.sharp_price = decimalToAmericanString(oppositeSharp.sharpDecimal);
    }

    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  } else {
    // FALLBACK: Estimate using typical vig assumption (2.5%)
    const impliedProb = 1 / thisSharp.sharpDecimal;
    const trueProb = impliedProb * 0.975; // Rough vig removal

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied!;
    opp.overround = 0.025; // Assumed
    opp.devig_method = "estimated";

    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  }
}

/**
 * RSI (Rush Street Interactive) books that often share the same odds feed.
 * When all have identical odds, we should only count them once in averages
 * to avoid skewing the market average unfairly.
 */
const RSI_BOOKS = new Set(["betrivers", "bally-bet", "betparx"]);

/**
 * Books to exclude from market average calculations.
 * Prediction markets (Polymarket, Kalshi) can skew averages with exchange-style pricing.
 */
const OUTLIER_PRONE_BOOKS = new Set(["polymarket", "kalshi"]);

/**
 * ProphetX can occasionally post prices that are materially disconnected
 * from the rest of the market. When this happens, don't include it in the
 * market average reference to avoid skewing edge calculations.
 *
 * Override with env var `PROPHETX_AVG_OUTLIER_THRESHOLD_AMERICAN`.
 */
const PROPHETX_AVG_OUTLIER_THRESHOLD_AMERICAN = (() => {
  const fromEnv = Number(process.env.PROPHETX_AVG_OUTLIER_THRESHOLD_AMERICAN);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 600;
})();

const PROPHETX_BOOK = "prophetx";
const PROPHETX_OUTLIER_REASON = "Not included in average (ProphetX outlier)";

/**
 * Compute median for robust outlier detection.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Annotate each book with average inclusion metadata and return
 * the final book list to use for market-average calculations.
 */
function annotateAndFilterBooksForAverage(books: BookOffer[]): BookOffer[] {
  const excludedByBook = new Map<string, string>();

  // 1) Exclude known non-reference books (prediction markets)
  const initiallyFiltered = books.filter((book) => {
    const id = book.book.toLowerCase();
    if (OUTLIER_PRONE_BOOKS.has(id)) {
      excludedByBook.set(id, "Not included in average (prediction market)");
      return false;
    }
    return true;
  });

  // 2) Conditionally exclude ProphetX if it is far from market consensus
  let prophetFiltered = initiallyFiltered;
  const prophetxBook = initiallyFiltered.find((book) => book.book.toLowerCase() === PROPHETX_BOOK);
  if (prophetxBook) {
    const comparisonBooks = initiallyFiltered.filter((book) => book.book.toLowerCase() !== PROPHETX_BOOK);
    if (comparisonBooks.length >= 1) {
      const marketMedianAmerican = median(comparisonBooks.map((book) => decimalToAmerican(book.decimal)));
      if (marketMedianAmerican !== null) {
        const prophetxAmerican = decimalToAmerican(prophetxBook.decimal);
        const delta = Math.abs(prophetxAmerican - marketMedianAmerican);
        if (delta >= PROPHETX_AVG_OUTLIER_THRESHOLD_AMERICAN) {
          excludedByBook.set(PROPHETX_BOOK, PROPHETX_OUTLIER_REASON);
          prophetFiltered = initiallyFiltered.filter((book) => book.book.toLowerCase() !== PROPHETX_BOOK);
        }
      }
    }
  }

  // 3) Deduplicate RSI books with identical prices
  const rsiByDecimal = new Map<number, BookOffer>();
  const averageBooks: BookOffer[] = [];
  for (const book of prophetFiltered) {
    const id = book.book.toLowerCase();
    if (!RSI_BOOKS.has(id)) {
      averageBooks.push(book);
      continue;
    }
    const roundedDecimal = Math.round(book.decimal * 10000) / 10000;
    const firstAtPrice = rsiByDecimal.get(roundedDecimal);
    if (!firstAtPrice) {
      rsiByDecimal.set(roundedDecimal, book);
      averageBooks.push(book);
      continue;
    }
    excludedByBook.set(id, `Not included in average (duplicate ${firstAtPrice.book} price)`);
  }

  // 4) Persist inclusion metadata to each original book entry
  const includedIds = new Set(averageBooks.map((book) => book.book.toLowerCase()));
  for (const book of books) {
    const id = book.book.toLowerCase();
    const included = includedIds.has(id);
    book.included_in_average = included;
    book.average_exclusion_reason = included ? null : (excludedByBook.get(id) || "Not included in average");
  }

  return averageBooks;
}

/**
 * Build a lookup map for fast book matching
 * Maps book names to their odds data for O(1) lookups
 */
function buildBookOddsMap(books: Pick<BookOffer, "book" | "decimal">[]): Map<string, Pick<BookOffer, "book" | "decimal">> {
  const map = new Map<string, Pick<BookOffer, "book" | "decimal">>();
  for (const book of books) {
    map.set(book.book.toLowerCase(), book);
  }
  return map;
}

/**
 * Get sharp odds from a list of book prices (using blend, average, or default)
 * Optimized with O(1) lookups using pre-built Map
 */
function getSharpOdds(
  books: BookOffer[],
  blend: BookWeight[] | null,
  useAverage: boolean = false,
  minBlendBooks: number = 1
): {
  sharpDecimal: number | null;
  sharpBooks: string[];
  blendComplete: boolean;
  blendWeight: number;
  bookCount: number;  // Number of books used in calculation (after RSI dedup for averages)
} {
  if (books.length === 0) {
    return { sharpDecimal: null, sharpBooks: [], blendComplete: true, blendWeight: 0, bookCount: 0 };
  }

  let sharpDecimal: number | null = null;
  const sharpBooks: string[] = [];
  let blendComplete = true;
  let blendWeight = 1.0;
  let bookCount = 0;
  const averageBooks = annotateAndFilterBooksForAverage(books);
  const minAverageBooks = Math.max(2, minBlendBooks);

  if (useAverage) {
    // Explicit market average: use filtered + deduplicated average inputs
    if (averageBooks.length < minAverageBooks) {
      return { sharpDecimal: null, sharpBooks: [], blendComplete: true, blendWeight: 0, bookCount: averageBooks.length };
    }
    sharpDecimal = averageBooks.reduce((sum, b) => sum + b.decimal, 0) / averageBooks.length;
    bookCount = averageBooks.length;
    // List all books used in the average (original list for transparency)
    averageBooks.forEach((b) => sharpBooks.push(b.book));
  } else if (blend && blend.length > 0) {
    // Custom blend of specific books
    // Build lookup map once for O(1) lookups instead of O(n) .find() calls
    const bookMap = buildBookOddsMap(books);
    
    let weightedSum = 0;
    let totalWeight = 0;
    const requestedWeight = blend.reduce((sum, b) => sum + b.weight, 0);
    let matchedBooks = 0;

    for (const { book, weight } of blend) {
      // O(1) lookup instead of O(n) .find()
      const bookOdds = bookMap.get(book.toLowerCase());
      if (bookOdds) {
        weightedSum += bookOdds.decimal * weight;
        totalWeight += weight;
        sharpBooks.push(book);
        matchedBooks += 1;
      }
    }

    blendWeight = requestedWeight > 0 ? totalWeight / requestedWeight : 0;
    // Consider blend complete if we have at least the required number of books (default: all)
    const required = Math.max(1, minBlendBooks);
    blendComplete = matchedBooks >= required;
    bookCount = sharpBooks.length;

    if (totalWeight > 0) {
      sharpDecimal = weightedSum / totalWeight;
    }
  } else {
    // Default: Pinnacle, then Circa, then average
    // Build lookup map once for O(1) lookups
    const bookMap = buildBookOddsMap(books);
    const pinnacle = bookMap.get("pinnacle");
    const circa = bookMap.get("circa");

    if (pinnacle) {
      sharpDecimal = pinnacle.decimal;
      sharpBooks.push("pinnacle");
      bookCount = 1;
    } else if (circa) {
      sharpDecimal = circa.decimal;
      sharpBooks.push("circa");
      bookCount = 1;
    } else {
      // Fallback to average (with outlier filtering + RSI deduplication)
      if (averageBooks.length < minAverageBooks) {
        return { sharpDecimal: null, sharpBooks: [], blendComplete: true, blendWeight: 0, bookCount: averageBooks.length };
      }
      sharpDecimal = averageBooks.reduce((sum, b) => sum + b.decimal, 0) / averageBooks.length;
      sharpBooks.push("average");
      bookCount = averageBooks.length;
    }
  }

  return { sharpDecimal, sharpBooks, blendComplete, blendWeight, bookCount };
}

/**
 * Convert decimal odds to American (returns signed string like "+150" or "-110")
 */
function decimalToAmericanString(decimal: number): string {
  if (decimal >= 2) {
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  } else {
    return String(Math.round(-100 / (decimal - 1)));
  }
}

/**
 * Format American odds number as signed string ("+150" or "-110")
 */
function formatAmericanOdds(price: number): string {
  if (price > 0) {
    return `+${price}`;
  }
  return String(price);
}

/**
 * Convert decimal odds to American number (for backwards compat)
 */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Get active event IDs for a sport - with caching
 * OPTIMIZATION: uses memory cache first (0ms), then Redis SET (O(1)), then SCAN fallback
 * NOTE: If active_events:{sport} set doesn't exist, ingestor needs to populate it
 */
const eventIdsCache = new Map<string, { ids: string[]; timestamp: number }>();
const EVENT_IDS_CACHE_TTL = 30000; // 30 seconds - longer cache since SCAN is expensive

async function getActiveEventIds(sport: string): Promise<string[]> {
  // Check memory cache first (fastest - 0ms)
  const cached = eventIdsCache.get(sport);
  if (cached && (Date.now() - cached.timestamp) < EVENT_IDS_CACHE_TTL) {
    return cached.ids;
  }

  // Try active events set first (O(1) - maintained by ingestor)
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    const ids = activeSet.map(String);
    eventIdsCache.set(sport, { ids, timestamp: Date.now() });
    return ids;
  }

  // Fallback to scanning event keys (slower - only if set not maintained)
  console.warn(`[API] active_events:${sport} empty, falling back to SCAN`);
  const eventKeys = await scanKeys(`events:${sport}:*`);
  const ids = eventKeys.map((k) => k.split(":")[2]).filter(Boolean);
  eventIdsCache.set(sport, { ids, timestamp: Date.now() });
  return ids;
}

/**
 * Invalidate event cache for a sport - called when SSE indicates updates
 */
function invalidateEventCache(sport: string): void {
  eventIdsCache.delete(sport);
}

/**
 * Get odds keys for specific events - SCOPED SCANNING
 * Architecture: active_events (small set) + per-event scans (focused)
 * This avoids maintaining a massive global odds_keys set that's hard to clean up
 */
const oddsKeysCache = new Map<string, { keys: string[]; timestamp: number }>();
const ODDS_KEYS_CACHE_TTL = 20000; // 20 seconds

async function getOddsKeysForEvents(sport: string, eventIds: string[]): Promise<string[]> {
  // Cache key includes event count for invalidation when events change
  const cacheKey = `${sport}:${eventIds.length}`;
  
  // Check memory cache first (fastest - 0ms)
  const cached = oddsKeysCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < ODDS_KEYS_CACHE_TTL) {
    return cached.keys;
  }

  // OPTIMIZED: Scan only for active events (scoped, not global)
  // This is efficient because we only scan keys for ~10-50 active games
  const allKeys: string[] = [];
  
  // Batch scans in parallel for speed (limit concurrency to avoid overwhelming Redis)
  const BATCH_SIZE = 10;
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(eventId => scanKeysForEvent(sport, eventId))
    );
    allKeys.push(...batchResults.flat());
  }
  
  oddsKeysCache.set(cacheKey, { keys: allKeys, timestamp: Date.now() });
  return allKeys;
}

/**
 * Scan keys for a single event - focused scan pattern
 */
async function scanKeysForEvent(sport: string, eventId: string): Promise<string[]> {
  const pattern = `odds:${sport}:${eventId}:*`;
  return scanKeys(pattern);
}

/**
 * Invalidate odds cache for a sport - called when SSE indicates updates
 */
function invalidateOddsCache(sport: string): void {
  oddsKeysCache.delete(sport);
}

/**
 * Invalidate all caches for a sport - useful for SSE-triggered refreshes
 */
function invalidateSportCaches(sport: string): void {
  invalidateEventCache(sport);
  invalidateOddsCache(sport);
}

/**
 * Scan Redis keys with pattern - optimized for fewer round trips
 * Uses high SCAN_COUNT for fewer iterations
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let iterations = 0;
  const MAX_ITERATIONS = 50; // Safety limit

  do {
    iterations++;
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT, // Higher count = fewer round trips
    });
    cursor = result[0];
    keys.push(...result[1]);
    
    // Safety: prevent infinite loops
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[scanKeys] Hit iteration limit for pattern: ${pattern}`);
      break;
    }
  } while (cursor !== "0");

  return keys;
}
