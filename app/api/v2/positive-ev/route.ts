// Use Node.js runtime for longer timeouts and better performance
export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  normalizePlayerName,
  getMarketDisplay,
  normalizeRawMarket,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import {
  devigMultiple,
  calculateMultiEV,
  americanToDecimal,
  americanToImpliedProb,
  createSharpReference,
  blendSharpOdds,
  formatEV,
  formatKelly,
  type DevigMethod,
  type SharpPreset,
  type PositiveEVOpportunity,
  type PositiveEVResponse,
  type BookOffer,
  type MultiDevigResult,
  type EVMode,
  type CustomSharpConfig,
} from "@/lib/ev";
import {
  SHARP_PRESETS,
  DEFAULT_DEVIG_METHODS,
  POSITIVE_EV_DEFAULTS,
  EV_THRESHOLDS,
} from "@/lib/ev/constants";
import { createClient } from "@/libs/supabase/server";
import { getUserPlan } from "@/lib/plans-server";
import { hasEliteAccess } from "@/lib/plans";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Configuration - optimized for speed
const SCAN_COUNT = 2000;      // Larger scan batches
const MGET_CHUNK_SIZE = 500;  // Reduced to prevent connection issues

// =============================================================================
// Redis Response Cache (shared across all instances)
// =============================================================================

const RESPONSE_CACHE_PREFIX = "ev:response:";
const RESPONSE_CACHE_TTL_PRESET = 15;  // 15 seconds for standard presets
const RESPONSE_CACHE_TTL_CUSTOM = 30;  // 30 seconds for custom models (configs rarely change)

/**
 * Build cache key from request parameters
 */
function buildResponseCacheKey(params: URLSearchParams): string {
  const keys = ['sports', 'sharpPreset', 'devigMethods', 'minEV', 'maxEV', 'books', 'limit', 'mode', 'minBooksPerSide', 'customSharpBooks', 'customBookWeights'];
  return keys.map(k => `${k}:${params.get(k) || ''}`).join('|');
}

/**
 * Check if request is using a custom model (has customSharpBooks)
 */
function isCustomModelRequest(params: URLSearchParams): boolean {
  const customBooks = params.get("customSharpBooks");
  return !!customBooks && customBooks.length > 0;
}

/**
 * Get hash of cache key for shorter Redis keys
 */
function hashCacheKey(key: string): string {
  // Simple hash function for shorter keys
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Check Redis response cache
 */
async function getFromResponseCache(key: string): Promise<unknown | null> {
  try {
    const redisKey = `${RESPONSE_CACHE_PREFIX}${hashCacheKey(key)}`;
    const cached = await redis.get(redisKey);
    return cached;
  } catch (error) {
    console.error("[positive-ev] Redis cache read error:", error);
    return null;
  }
}

/**
 * Store in Redis response cache with tiered TTL
 */
async function setInResponseCache(key: string, data: unknown, isCustom: boolean): Promise<void> {
  try {
    const ttl = isCustom ? RESPONSE_CACHE_TTL_CUSTOM : RESPONSE_CACHE_TTL_PRESET;
    const redisKey = `${RESPONSE_CACHE_PREFIX}${hashCacheKey(key)}`;
    await redis.set(redisKey, data, { ex: ttl });
  } catch (error) {
    console.error("[positive-ev] Redis cache write error:", error);
  }
}

// Supported sports
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

// Books to exclude (regional variants)
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
]);

/**
 * Get the book IDs that should be excluded based on the current sharp preset
 * Only exclude books that are actually being used as the sharp reference
 */
function getExcludedBooksForPreset(preset: SharpPreset): Set<string> {
  const excluded = new Set<string>();
  
  switch (preset) {
    case "pinnacle":
      excluded.add("pinnacle");
      break;
    case "pinnacle_circa":
      excluded.add("pinnacle");
      excluded.add("circa");
      break;
    case "hardrock_thescore":
      excluded.add("hardrock");
      excluded.add("hard-rock");
      excluded.add("thescore");
      break;
    case "market_average":
      // Market average uses ALL books to calculate fair value
      // Any individual book can still be +EV if better than the average
      // So we don't exclude any books
      break;
    case "custom":
      // Custom presets would need to be handled based on user config
      // For now, don't exclude anything
      break;
  }
  
  return excluded;
}

/**
 * Normalize book IDs to match canonical sportsbook IDs
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
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

/**
 * Format position strings
 */
function formatPosition(position: string | null): string | null {
  if (!position) return null;
  const multiPosPatterns = ["GF", "FG", "FC", "CF", "SF", "FS", "PG", "SG", "PF"];
  const upper = position.toUpperCase();
  if (position.length === 2 && multiPosPatterns.includes(upper)) {
    return `${position[0]}/${position[1]}`;
  }
  return position;
}

/**
 * Format American odds as string
 */
function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

// Types for pairing
interface SelectionPair {
  sport: string;
  eventId: string;
  event: { home_team: string; away_team: string; start_time: string } | null;
  player: string;
  playerDisplay: string;
  playerId: string | null;
  team: string | null;
  position: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  over: {
    books: BookOffer[];
    best: BookOffer | null;
  };
  under: {
    books: BookOffer[];
    best: BookOffer | null;
  };
}

/**
 * GET /api/v2/positive-ev
 * 
 * True +EV tool using proper de-vigging methods
 * 
 * Query params:
 *   sports      - Comma-separated sports (default: "nba")
 *   markets     - Comma-separated markets (optional)
 *   sharpPreset - Sharp reference preset (default: "pinnacle")
 *   devigMethods - Comma-separated methods (default: "power,multiplicative")
 *   minEV       - Minimum EV% threshold (default: 0)
 *   maxEV       - Maximum EV% to show (default: 20)
 *   books       - Filter to specific sportsbooks (optional)
 *   limit       - Max results (default: 100)
 *   mode        - Filter mode: "pregame" (default), "live", or "all"
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;
    
    // Parse mode first (needed for cache check)
    const modeParam = params.get("mode")?.toLowerCase();
    const mode: EVMode = modeParam === "live" ? "live" : modeParam === "all" ? "all" : "pregame";
    
    // Cache bypass: ?fresh=true skips cache (use after SSE updates)
    const bypassCache = params.get("fresh") === "true";
    
    // Check Redis response cache first (fast path)
    const cacheKey = buildResponseCacheKey(params);
    if (!bypassCache) {
      const cachedResponse = await getFromResponseCache(cacheKey);
      if (cachedResponse) {
        console.log(`[positive-ev] Cache HIT (Redis, ${Date.now() - startTime}ms)`);
        return NextResponse.json(cachedResponse, {
          headers: {
            "Cache-Control": "private, max-age=15",
            "X-Cache": "HIT",
            "X-Cache-Source": "redis",
            "X-Mode": mode,
          },
        });
      }
    } else {
      console.log(`[positive-ev] Cache BYPASS requested (SSE triggered refresh)`);
    }

    // Parse parameters
    const sportsParam = params.get("sports")?.toLowerCase().split(",").filter(Boolean) || ["nba"];
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));

    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    const markets = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const sharpPreset = (params.get("sharpPreset") || "pinnacle") as SharpPreset;
    const devigMethodsParam = params.get("devigMethods")?.toLowerCase().split(",").filter(Boolean) || null;
    const devigMethods: DevigMethod[] = devigMethodsParam 
      ? (devigMethodsParam.filter(m => ["power", "multiplicative", "additive", "probit"].includes(m)) as DevigMethod[])
      : DEFAULT_DEVIG_METHODS;
    const minEV = parseFloat(params.get("minEV") || "0");
    const maxEV = parseFloat(params.get("maxEV") || String(EV_THRESHOLDS.maximum));
    const booksFilter = params.get("books")?.toLowerCase().split(",").filter(Boolean) || null;
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);
    const minBooksPerSide = parseInt(params.get("minBooksPerSide") || "2");
    
    // Custom sharp books (for user's custom models) - Elite only
    const customSharpBooksParam = params.get("customSharpBooks")?.toLowerCase().split(",").filter(Boolean) || null;
    const customBookWeightsParam = params.get("customBookWeights");
    let customSharpConfig: CustomSharpConfig | null = null;
    
    if (customSharpBooksParam && customSharpBooksParam.length > 0) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userPlan = await getUserPlan(user);
      if (!hasEliteAccess(userPlan)) {
        return NextResponse.json(
          { error: "Custom models require Elite plan", code: "elite_required" },
          { status: 403 }
        );
      }
      let weights: Record<string, number> | null = null;
      if (customBookWeightsParam) {
        try {
          weights = JSON.parse(customBookWeightsParam);
        } catch (e) {
          console.warn("[positive-ev] Failed to parse customBookWeights, using equal weights");
        }
      }
      customSharpConfig = {
        books: customSharpBooksParam,
        weights,
      };
      console.log(`[positive-ev] Using custom sharp config: ${customSharpBooksParam.join(", ")}`, weights ? `with weights` : `equal weights`);
    }
    
    // Note: mode is already parsed above for cache check

    // Validate sharp preset (only if not using custom config)
    if (!customSharpConfig && !SHARP_PRESETS[sharpPreset]) {
      return NextResponse.json({ error: `Invalid sharpPreset: ${sharpPreset}` }, { status: 400 });
    }

    // Fetch opportunities for all sports IN PARALLEL (much faster!)
    console.log(`[positive-ev] Fetching ${sports.length} sports in parallel...`);
    
    const sportPromises = sports.map(async (sport) => {
      try {
        const startTime = Date.now();
        const sportOpps = await fetchPositiveEVOpportunities(
          sport,
          markets,
          sharpPreset,
          devigMethods,
          minEV,
          maxEV,
          booksFilter,
          mode,
          minBooksPerSide,
          customSharpConfig
        );
        console.log(`[positive-ev] ✅ ${sport}: ${sportOpps.length} opps in ${Date.now() - startTime}ms`);
        return sportOpps;
      } catch (error) {
        console.error(`[positive-ev] ❌ ${sport} failed:`, error instanceof Error ? error.message : error);
        return []; // Return empty array on error, don't fail entire request
      }
    });
    
    const sportResults = await Promise.all(sportPromises);
    const allOpportunities = sportResults.flat();

    // Sort by worst-case EV (conservative) descending
    allOpportunities.sort((a, b) => b.evCalculations.evWorst - a.evCalculations.evWorst);

    // Apply limit
    const opportunities = allOpportunities.slice(0, limit);

    const response: PositiveEVResponse = {
      opportunities,
      meta: {
        totalFound: allOpportunities.length,
        returned: opportunities.length,
        sharpPreset: customSharpConfig ? "custom" : sharpPreset,
        customSharpConfig: customSharpConfig || undefined,
        devigMethods,
        minEV,
        minBooksPerSide,
        mode,
        timestamp: new Date().toISOString(),
      },
    };

    // Log response size for debugging
    const responseSize = JSON.stringify(response).length;
    console.log(`[positive-ev] Response size: ${(responseSize / 1024).toFixed(2)} KB`);
    if (responseSize > 500000) { // 500KB warning
      console.warn(`[positive-ev] ⚠️  Large response (${(responseSize / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Store in Redis response cache for quick subsequent requests
    // Fire and forget - don't await to avoid slowing down response
    const isCustom = isCustomModelRequest(params);
    setInResponseCache(cacheKey, response, isCustom).catch(err => {
      console.error("[positive-ev] Failed to cache response:", err);
    });
    const ttlUsed = isCustom ? RESPONSE_CACHE_TTL_CUSTOM : RESPONSE_CACHE_TTL_PRESET;
    console.log(`[positive-ev] Cache MISS - storing in Redis (TTL: ${ttlUsed}s, total time: ${Date.now() - startTime}ms)`);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=15",
        "Content-Type": "application/json",
        "X-Cache": "MISS",
        "X-Cache-Source": "redis",
        "X-Mode": mode,
      },
    });
  } catch (error) {
    console.error("[/api/v2/positive-ev] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", timing_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

/**
 * Fetch +EV opportunities for a single sport
 */
async function fetchPositiveEVOpportunities(
  sport: string,
  markets: string[] | null,
  sharpPreset: SharpPreset,
  devigMethods: DevigMethod[],
  minEV: number,
  maxEV: number,
  booksFilter: string[] | null,
  mode: EVMode,
  minBooksPerSide: number,
  customSharpConfig: CustomSharpConfig | null = null
): Promise<PositiveEVOpportunity[]> {
  const opportunities: PositiveEVOpportunity[] = [];
  const pairMap = new Map<string, SelectionPair>();

  try {
    // Step 1: Get active events
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];

    // Step 2: Get odds keys
    const allOddsKeys = await getOddsKeysForEvents(sport, eventIds);
    if (allOddsKeys.length === 0) return [];

    // Filter keys by event and market
    const eventIdSet = new Set(eventIds);
    const filteredKeys: string[] = [];

    // Helper to check if market is allowed (supports composite keys like "nba:player_points")
    const isMarketAllowed = (market: string): boolean => {
      if (!markets) return true; // No filter = all allowed
      // Check composite key (sport-specific)
      if (markets.includes(`${sport}:${market}`)) return true;
      // Check plain key (global / backwards compat)
      if (markets.includes(market)) return true;
      return false;
    };

    for (const key of allOddsKeys) {
      const parts = key.split(":");
      const eventId = parts[2];
      const market = parts[3];
      const book = parts[4];

      if (!eventId || !market || !book) continue;
      if (!eventIdSet.has(eventId)) continue;
      if (!isMarketAllowed(market)) continue;

      filteredKeys.push(key);
    }

    if (filteredKeys.length === 0) return [];

    // Step 3: Batch fetch all odds data
    const chunks: string[][] = [];
    for (let i = 0; i < filteredKeys.length; i += MGET_CHUNK_SIZE) {
      chunks.push(filteredKeys.slice(i, i + MGET_CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) => redis.mget<(SSEBookSelections | string | null)[]>(...chunk))
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

    // Step 4: Fetch event details
    const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
    const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

    // Build event map with robust filtering
    const now = new Date();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    const eventMap = new Map<string, { home_team: string; away_team: string; start_time: string; isLive: boolean }>();
    const pregameEventIds = new Set<string>();
    const liveEventIds = new Set<string>();
    const excludedEventIds = new Set<string>(); // Track events to exclude completely

    eventIds.forEach((id, i) => {
      const event = eventsRaw[i];
      if (!event) {
        // No event data - exclude
        excludedEventIds.add(id);
        return;
      }

      const startTime = (event.commence_time as string) || (event.start_time as string) || "";
      const isLiveFlag = event.is_live === true;
      const homeTeam = (event.home_team as string) || "";
      const awayTeam = (event.away_team as string) || "";
      
      // Skip events without valid team data
      if (!homeTeam || !awayTeam) {
        excludedEventIds.add(id);
        return;
      }

      // Robust time validation
      if (!startTime) {
        // No start time - exclude (likely stale data / TBD issue)
        excludedEventIds.add(id);
        return;
      }

      const gameStart = new Date(startTime);
      if (isNaN(gameStart.getTime())) {
        // Invalid date - exclude
        excludedEventIds.add(id);
        return;
      }

      // Check if game started more than 6 hours ago (definitely finished)
      const msSinceStart = now.getTime() - gameStart.getTime();
      if (msSinceStart > SIX_HOURS_MS) {
        // Game is likely over - exclude
        excludedEventIds.add(id);
        return;
      }

      // Determine if live or pregame
      const isLive = isLiveFlag || gameStart <= now;
      
      if (isLive) {
        liveEventIds.add(id);
      } else {
        pregameEventIds.add(id);
      }

      eventMap.set(id, { 
        home_team: homeTeam, 
        away_team: awayTeam, 
        start_time: startTime,
        isLive 
      });
    });

    // Step 5: Build selection pairs
    const keysByEventMarket = new Map<string, string[]>();
    for (const key of filteredKeys) {
      const parts = key.split(":");
      const eventId = parts[2];
      const market = parts[3];
      const groupKey = `${eventId}:${market}`;
      if (!keysByEventMarket.has(groupKey)) {
        keysByEventMarket.set(groupKey, []);
      }
      keysByEventMarket.get(groupKey)!.push(key);
    }

    for (const [groupKey, marketKeys] of keysByEventMarket) {
      const [eventId, market] = groupKey.split(":");
      
      // Skip excluded events (no data, invalid time, or finished games)
      if (excludedEventIds.has(eventId)) continue;
      
      // Apply mode filter
      if (mode === "pregame" && liveEventIds.has(eventId)) continue; // Skip live in pregame mode
      if (mode === "live" && pregameEventIds.has(eventId)) continue; // Skip pregame in live mode
      // mode === "all" shows both

      const eventData = eventMap.get(eventId);
      const event = eventData ? { 
        home_team: eventData.home_team, 
        away_team: eventData.away_team, 
        start_time: eventData.start_time 
      } : null;

      // Build book selections
      const bookSelections: Record<string, SSEBookSelections> = {};
      for (const key of marketKeys) {
        const rawBook = key.split(":").pop()!;
        const book = normalizeBookId(rawBook);
        const data = oddsDataMap.get(key);
        if (data) {
          bookSelections[book] = data;
        }
      }

      // Get unique base selection keys
      // For team_total market, we need to differentiate home vs away teams
      const baseSelectionKeys = new Set<string>();
      for (const selections of Object.values(bookSelections)) {
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

      // Process each player/line pair
      for (const baseKey of baseSelectionKeys) {
        const [playerRaw, lineStr, teamSide] = baseKey.split("|");
        const player = normalizePlayerName(playerRaw);
        const line = parseFloat(lineStr);
        // Include teamSide in pair key for team_total markets to separate home/away
        const pairKey = teamSide 
          ? `${eventId}:${market}:${player}:${line}:${teamSide}`
          : `${eventId}:${market}:${player}:${line}`;

        let pair = pairMap.get(pairKey);
        if (!pair) {
          pair = {
            sport,
            eventId,
            event,
            player,
            playerDisplay: "",
            playerId: null,
            team: null,
            position: null,
            market,
            marketDisplay: "",
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

        // Gather prices from all books
        for (const [book, selections] of Object.entries(bookSelections)) {
          if (EXCLUDED_BOOKS.has(book.toLowerCase())) continue;

          // Check over/yes/ml
          const overKey = `${playerRaw}|over|${lineStr}`;
          const yesKey = `${playerRaw}|yes|${lineStr}`;
          const mlKey = `${playerRaw}|ml|${lineStr}`;
          const overSel = (selections[overKey] || selections[yesKey] || selections[mlKey]) as SSESelection | undefined;

          // For team_total markets, only include selections that match the team side
          if (overSel && !overSel.locked && matchesTeamSide(overSel)) {
            const overPrice = parseInt(String(overSel.price), 10);
            // Debug: Log when limits data is present
            if (overSel.limits?.max) {
              console.log(`[positive-ev] Limits found: ${book} - Max $${overSel.limits.max}`);
            }
            const bookOffer: BookOffer = {
              bookId: book,
              bookName: book,
              price: overPrice,
              priceDecimal: overSel.price_decimal,
              link: overSel.link || null,
              mobileLink: overSel.mobile_link || null,
              sgp: overSel.sgp || null,
              limits: overSel.limits || null,
              updated: overSel.updated || undefined,
              oddId: overSel.odd_id || undefined,
            };
            pair.over.books.push(bookOffer);
            if (!pair.over.best || overSel.price_decimal > pair.over.best.priceDecimal) {
              pair.over.best = bookOffer;
            }
            if (overSel.player && !pair.playerDisplay) pair.playerDisplay = overSel.player;
            if (overSel.player_id && !pair.playerId) pair.playerId = overSel.player_id;
            if (overSel.team && !pair.team) pair.team = overSel.team;
            if (overSel.position && !pair.position) pair.position = formatPosition(overSel.position);
            if (overSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(overSel.raw_market);
          }

          // Check under/no
          const underKey = `${playerRaw}|under|${lineStr}`;
          const noKey = `${playerRaw}|no|${lineStr}`;
          const underSel = (selections[underKey] || selections[noKey]) as SSESelection | undefined;

          // For team_total markets, only include selections that match the team side
          if (underSel && !underSel.locked && matchesTeamSide(underSel)) {
            const underPrice = parseInt(String(underSel.price), 10);
            // Debug: Log when limits data is present
            if (underSel.limits?.max) {
              console.log(`[positive-ev] Limits found: ${book} - Max $${underSel.limits.max}`);
            }
            const bookOffer: BookOffer = {
              bookId: book,
              bookName: book,
              price: underPrice,
              priceDecimal: underSel.price_decimal,
              link: underSel.link || null,
              mobileLink: underSel.mobile_link || null,
              sgp: underSel.sgp || null,
              limits: underSel.limits || null,
              updated: underSel.updated || undefined,
              oddId: underSel.odd_id || undefined,
            };
            pair.under.books.push(bookOffer);
            if (!pair.under.best || underSel.price_decimal > pair.under.best.priceDecimal) {
              pair.under.best = bookOffer;
            }
            if (underSel.player && !pair.playerDisplay) pair.playerDisplay = underSel.player;
            if (underSel.player_id && !pair.playerId) pair.playerId = underSel.player_id;
            if (underSel.team && !pair.team) pair.team = underSel.team;
            if (underSel.position && !pair.position) pair.position = formatPosition(underSel.position);
            if (underSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(underSel.raw_market);
          }
        }
      }
    }

    // Step 6: Calculate +EV for each pair
    for (const pair of pairMap.values()) {
      // Need minimum books on both sides for proper de-vigging (width filter)
      if (pair.over.books.length < minBooksPerSide || pair.under.books.length < minBooksPerSide) continue;

      // Get sharp reference odds (use custom config if provided, otherwise use preset)
      const sharpOver = customSharpConfig 
        ? getSharpOddsForCustomConfig(pair.over.books, customSharpConfig)
        : getSharpOddsForPreset(pair.over.books, sharpPreset);
      const sharpUnder = customSharpConfig
        ? getSharpOddsForCustomConfig(pair.under.books, customSharpConfig)
        : getSharpOddsForPreset(pair.under.books, sharpPreset);

      if (!sharpOver || !sharpUnder) continue;

      // In custom model mode, enforce min-books against the actual
      // reference books that contributed on BOTH sides after exclusions.
      // This ensures we only surface rows with enough true paired refs.
      if (customSharpConfig) {
        const sharpOverRefs = new Set(sharpOver.blendedFrom ?? [sharpOver.source.toLowerCase()]);
        const sharpUnderRefs = new Set(sharpUnder.blendedFrom ?? [sharpUnder.source.toLowerCase()]);
        const sharedRefCount = Array.from(sharpOverRefs).filter((book) => sharpUnderRefs.has(book)).length;

        if (sharedRefCount < minBooksPerSide) {
          continue;
        }
      }

      // De-vig using the sharp reference
      const devigResults = devigMultiple(sharpOver.price, sharpUnder.price, devigMethods);

      // Determine the effective preset name for display
      const effectivePreset = customSharpConfig ? "custom" : sharpPreset;

      // Create sharp reference object
      // Only include books that contributed to BOTH sides in blendedFrom
      const bothSidesBooks = sharpOver.blendedFrom && sharpUnder.blendedFrom
        ? sharpOver.blendedFrom.filter(b => sharpUnder.blendedFrom!.includes(b))
        : sharpOver.blendedFrom;
      
      const sharpReference = createSharpReference(
        sharpOver.price,
        sharpUnder.price,
        effectivePreset,
        sharpOver.source,
        bothSidesBooks
      );

      // Check each book for +EV opportunities on both sides
      const sides: ("over" | "under")[] = ["over", "under"];
      
      // Get books to exclude based on the sharp reference
      // When using custom config, exclude the custom sharp books
      const excludedBooks = customSharpConfig
        ? new Set(customSharpConfig.books.map(b => b.toLowerCase()))
        : getExcludedBooksForPreset(sharpPreset);

      for (const side of sides) {
        const sideData = pair[side];
        const oppositeSide = side === "over" ? "under" : "over";
        const oppositeData = pair[oppositeSide];

        // Calculate EV for ALL books first (for comparison display)
        const booksWithEV: Array<{
          book: typeof sideData.books[0];
          evCalc: ReturnType<typeof calculateMultiEV>;
          isExcluded: boolean;
        }> = [];
        
        for (const bookOffer of sideData.books) {
          const evCalc = calculateMultiEV(devigResults, bookOffer, side);
          const isExcluded = excludedBooks.has(bookOffer.bookId.toLowerCase());
          booksWithEV.push({ book: bookOffer, evCalc, isExcluded });
        }
        
        // Sort by EV (highest first)
        booksWithEV.sort((a, b) => b.evCalc.evWorst - a.evCalc.evWorst);

        // Filter to books that can be bet on (not excluded, passes user filter)
        let bettableBooks = booksWithEV.filter(b => !b.isExcluded);
        if (booksFilter) {
          bettableBooks = bettableBooks.filter(b => booksFilter.includes(b.book.bookId));
        }
        
        // Find the best EV book that meets threshold
        const bestBook = bettableBooks.find(b => 
          b.evCalc.evWorst >= minEV && b.evCalc.evWorst <= maxEV
        );
        
        // Skip if no book meets threshold
        if (!bestBook) continue;
        
        // Create allBooks array with EV% for each book
        const allBooksWithEV: BookOffer[] = booksWithEV.map(b => ({
          bookId: b.book.bookId,
          bookName: b.book.bookName,
          price: b.book.price,
          priceDecimal: b.book.priceDecimal,
          link: b.book.link || null,
          mobileLink: b.book.mobileLink || null,
          sgp: b.book.sgp || null,
          limits: b.book.limits || null,
          oddId: b.book.oddId || undefined,
          evPercent: b.evCalc.evWorst, // EV% for this book
          isSharpRef: b.isExcluded, // Mark if used as sharp reference
        }));
        
        // Sort allBooks by EV (best first) for display
        allBooksWithEV.sort((a, b) => (b.evPercent ?? 0) - (a.evPercent ?? 0));

        // Create ONE opportunity per market (deduplicated to best EV)
        const marketKey = `${pair.eventId}:${pair.market}:${pair.player}:${pair.line}:${side}`;
        const opp: PositiveEVOpportunity = {
          id: marketKey,
          sport: pair.sport,
          eventId: pair.eventId,
          market: pair.market,
          marketDisplay: pair.marketDisplay || getMarketDisplay(pair.market),
          homeTeam: pair.event?.home_team,
          awayTeam: pair.event?.away_team,
          startTime: pair.event?.start_time,
          playerId: pair.playerId || undefined,
          playerName: pair.playerDisplay || pair.player,
          playerTeam: pair.team || undefined,
          playerPosition: pair.position || undefined,
          line: pair.line,
          side,
          sharpPreset: effectivePreset,
          sharpReference: {
            ...sharpReference,
            blendedFrom: undefined,
          },
          devigResults: {
            [devigMethods[0]]: devigResults[devigMethods[0]],
          } as MultiDevigResult,
          book: {
            bookId: bestBook.book.bookId,
            price: bestBook.book.price,
            priceDecimal: bestBook.book.priceDecimal,
            link: bestBook.book.link,
            mobileLink: bestBook.book.mobileLink || null,
            limits: bestBook.book.limits || null,
            oddId: bestBook.book.oddId || undefined,
            evPercent: bestBook.evCalc.evWorst,
          } as BookOffer,
          evCalculations: bestBook.evCalc,
          // All books with their EV% for comparison
          allBooks: allBooksWithEV,
          oppositeBooks: oppositeData.books.map(b => ({
            bookId: b.bookId,
            bookName: b.bookName,
            price: b.price,
            priceDecimal: b.priceDecimal,
            link: b.link || null,
            mobileLink: b.mobileLink || null,
            sgp: b.sgp || null,
            limits: b.limits || null,
            oddId: b.oddId || undefined,
          })) as BookOffer[],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        opportunities.push(opp);
      }
    }

    return opportunities;
  } catch (error) {
    console.error(`[positive-ev] Error fetching ${sport}:`, error);
    return [];
  }
}

/**
 * Books to exclude from market average calculations entirely.
 * Prediction markets (Polymarket, Kalshi) use exchange-style pricing
 * that can skew traditional sportsbook averages.
 */
const EXCLUDED_FROM_AVERAGE = new Set(["polymarket", "kalshi"]);

/**
 * RSI (Rush Street Interactive) books that often share the same odds feed.
 * When all have identical odds, we should only count them once in averages.
 */
const RSI_BOOKS = new Set(["betrivers", "bally-bet", "betparx"]);

/**
 * Filter and deduplicate books for market average calculation.
 * - Excludes prediction markets (Polymarket, Kalshi) entirely
 * - RSI books with identical odds are counted once to avoid skewing
 */
function filterBooksForAverage(books: BookOffer[]): BookOffer[] {
  // Step 1: Exclude prediction markets entirely
  const filtered = books.filter((b) => !EXCLUDED_FROM_AVERAGE.has(b.bookId.toLowerCase()));

  // Step 2: Deduplicate RSI books with identical odds
  const rsiBooks: BookOffer[] = [];
  const otherBooks: BookOffer[] = [];

  for (const b of filtered) {
    if (RSI_BOOKS.has(b.bookId.toLowerCase())) {
      rsiBooks.push(b);
    } else {
      otherBooks.push(b);
    }
  }

  if (rsiBooks.length === 0) return filtered;

  // Keep only unique RSI prices
  const rsiByPrice = new Map<number, BookOffer>();
  for (const b of rsiBooks) {
    const rounded = Math.round(b.price * 100) / 100;
    if (!rsiByPrice.has(rounded)) {
      rsiByPrice.set(rounded, b);
    }
  }

  return [...otherBooks, ...rsiByPrice.values()];
}

/**
 * Get sharp odds for a preset from available books
 */
function getSharpOddsForPreset(
  books: BookOffer[],
  preset: SharpPreset
): { price: number; source: string; blendedFrom?: string[] } | null {
  const presetConfig = SHARP_PRESETS[preset];
  if (!presetConfig) return null;

  if (preset === "custom") {
    // Custom preset - would need user-defined weights
    return null;
  }

  // Market Average: Use available sportsbooks (excluding prediction markets & deduplicating RSI)
  if (preset === "market_average") {
    const filteredBooks = filterBooksForAverage(books);
    
    if (filteredBooks.length === 0) return null;
    
    // Equal weight for all books
    const blendInputs = filteredBooks.map((b) => ({
      bookId: b.bookId,
      odds: b.price,
      weight: 1.0,
    }));
    
    const blendedOdds = blendSharpOdds(blendInputs);
    if (blendedOdds === 0) return null;
    
    return {
      price: blendedOdds,
      source: `Market Avg (${filteredBooks.length} books)`,
      blendedFrom: filteredBooks.map((b) => b.bookId),
    };
  }

  const presetBooks = presetConfig.books;
  
  // Build lookup map for O(1) lookups instead of O(n) .find() calls
  const bookMap = buildBookLookupMap(books);

  if (presetBooks.length === 1) {
    // Single book preset - O(1) lookup
    const targetBook = presetBooks[0].bookId;
    const match = bookMap.get(targetBook.toLowerCase()) || bookMap.get(normalizeBookIdForSharp(targetBook.toLowerCase()));
    if (match) {
      return { price: match.price, source: targetBook };
    }
    return null;
  }

  // Blended preset - REQUIRES ALL BOOKS to be present
  const blendInputs: { bookId: string; odds: number; weight: number }[] = [];
  const blendedFrom: string[] = [];

  for (const { bookId, weight } of presetBooks) {
    // O(1) lookup instead of O(n) .find()
    const match = bookMap.get(bookId.toLowerCase()) || bookMap.get(normalizeBookIdForSharp(bookId.toLowerCase()));
    if (match) {
      blendInputs.push({ bookId, odds: match.price, weight });
      blendedFrom.push(bookId);
    }
  }

  // For blended presets, require ALL books to be available
  // This ensures pinnacle_circa only works when BOTH Pinnacle AND Circa have odds
  if (blendInputs.length !== presetBooks.length) {
    return null;
  }

  // All books are present, so weights are already properly normalized from the preset config
  const blendedOdds = blendSharpOdds(blendInputs);
  if (blendedOdds === 0) return null;

  return {
    price: blendedOdds,
    source: `${preset} (${blendedFrom.join(", ")})`,
    blendedFrom,
  };
}

/**
 * Get sharp odds using a custom configuration (user's custom EV model)
 * Supports weighted blending of multiple sharp books
 */
/**
 * Build a lookup map for fast book matching
 * Maps all possible book ID variations to the BookOffer
 */
function buildBookLookupMap(books: BookOffer[]): Map<string, BookOffer> {
  const map = new Map<string, BookOffer>();
  for (const book of books) {
    const lower = book.bookId.toLowerCase();
    // Add the original lowercased ID
    map.set(lower, book);
    // Add the normalized version too
    const normalized = normalizeBookIdForSharp(lower);
    if (normalized !== lower) {
      map.set(normalized, book);
    }
  }
  return map;
}

function getSharpOddsForCustomConfig(
  books: BookOffer[],
  config: CustomSharpConfig
): { price: number; source: string; blendedFrom?: string[] } | null {
  if (!config.books || config.books.length === 0) {
    return null;
  }

  // For custom blends, exclude prediction markets entirely to avoid skewing
  const filteredBooks = books.filter((b) => !EXCLUDED_FROM_AVERAGE.has(b.bookId.toLowerCase()));
  
  // Build lookup map once for O(1) lookups instead of O(n) .find() calls
  const bookMap = buildBookLookupMap(filteredBooks);

  // Single book in custom config
  if (config.books.length === 1) {
    const targetBook = config.books[0].toLowerCase();
    const match = bookMap.get(targetBook) || bookMap.get(normalizeBookIdForSharp(targetBook));
    if (match) {
      return { price: match.price, source: targetBook };
    }
    return null;
  }

  // Multiple books - use weighted blending
  const blendInputs: { bookId: string; odds: number; weight: number }[] = [];
  const blendedFrom: string[] = [];
  
  // Calculate total weight from available books for normalization
  let totalAvailableWeight = 0;

  for (const bookId of config.books) {
    const normalizedBookId = bookId.toLowerCase();
    // O(1) lookup instead of O(n) .find()
    const match = bookMap.get(normalizedBookId) || bookMap.get(normalizeBookIdForSharp(normalizedBookId));
    
    if (match) {
      // Get weight from config, default to equal weight if not specified
      const weight = config.weights?.[bookId] ?? config.weights?.[normalizedBookId] ?? (100 / config.books.length);
      blendInputs.push({ bookId: normalizedBookId, odds: match.price, weight });
      blendedFrom.push(normalizedBookId);
      totalAvailableWeight += weight;
    }
  }

  // Require at least one book to be available
  if (blendInputs.length === 0) {
    return null;
  }

  // If not all books are available, normalize weights to sum to 100%
  if (blendInputs.length < config.books.length && totalAvailableWeight > 0) {
    const normalizationFactor = 100 / totalAvailableWeight;
    blendInputs.forEach(input => {
      input.weight = input.weight * normalizationFactor;
    });
  }

  const blendedOdds = blendSharpOdds(blendInputs);
  if (blendedOdds === 0) return null;

  const sourceBooks = blendedFrom.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(", ");
  return {
    price: blendedOdds,
    source: `Custom (${sourceBooks})`,
    blendedFrom,
  };
}

/**
 * Normalize book ID for sharp book matching
 */
function normalizeBookIdForSharp(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hard-rock":
      return "hardrock";
    default:
      return lower;
  }
}

// =============================================================================
// Redis Helpers (reused from opportunities API)
// =============================================================================

async function getActiveEventIds(sport: string): Promise<string[]> {
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    return activeSet.map(String);
  }

  // Fallback to scanning
  const eventKeys = await scanKeys(`events:${sport}:*`);
  return eventKeys.map((k) => k.split(":")[2]).filter(Boolean);
}

async function getOddsKeysForEvents(sport: string, eventIds: string[]): Promise<string[]> {
  const allKeys: string[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((eventId) => scanKeys(`odds:${sport}:${eventId}:*`))
    );
    allKeys.push(...batchResults.flat());
  }

  return allKeys;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  do {
    iterations++;
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = result[0];
    keys.push(...result[1]);

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[scanKeys] Hit iteration limit for pattern: ${pattern}`);
      break;
    }
  } while (cursor !== "0");

  return keys;
}
