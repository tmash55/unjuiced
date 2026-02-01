"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

/**
 * Hit Rates API v2 - OPTIMIZED VERSION
 * 
 * Uses the new `get_nba_hit_rate_profiles_fast_v3` RPC which:
 * 1. Has NO JOINs (all data denormalized in the table)
 * 2. Pre-computed DvP ranks (no separate matchup call needed)
 * 3. Filters by has_live_odds for actionable profiles first
 * 4. No COUNT(*) query overhead
 * 5. Includes sel_key for Redis best odds lookup
 * 
 * Also merges live best odds from Redis for "card-ready" data.
 * 
 * Expected performance: <500ms vs 8-12s before
 */

// Cache configuration
const CACHE_TTL_SECONDS = 60; // 1 minute cache
const CACHE_KEY_PREFIX = "hitrates:nba:v4"; // Incremented for v3 RPC + best odds integration

// =============================================================================
// TYPES
// =============================================================================

interface BestOddsData {
  best_book: string;
  best_price: number;
  line: number;
  side: string;
  player_id: string;
  player_name: string;
  book_count: number;
  updated_at: number;
}

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

/**
 * Batch fetch best odds from Redis for all rows with valid keys
 */
async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();
  
  // Filter rows that have all required fields for Redis lookup
  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);
  
  if (validRows.length === 0) {
    return result;
  }
  
  // Build Redis keys
  const keys = validRows.map(r => `bestodds:nba:${r.event_id}:${r.market}:${r.sel_key}`);
  
  try {
    // Batch fetch all keys in one round trip
    const values = await redis.mget<(BestOddsData | null)[]>(...keys);
    
    // Map results back to composite keys for easy lookup
    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];
      
      // Handle both string and object responses from Redis
      if (value) {
        if (typeof value === 'string') {
          try {
            result.set(compositeKey, JSON.parse(value));
          } catch {
            result.set(compositeKey, null);
          }
        } else {
          result.set(compositeKey, value);
        }
      } else {
        result.set(compositeKey, null);
      }
    });
  } catch (e) {
    console.error("[Hit Rates v2] Redis best odds fetch error:", e);
    // Return empty map on error - gracefully degrade
  }
  
  return result;
}

// Valid sort fields for hit rates
const VALID_SORT_FIELDS = [
  "line", "l5Avg", "l10Avg", "seasonAvg", "streak", 
  "l5Pct", "l10Pct", "l20Pct", "seasonPct", "h2hPct", "matchupRank"
] as const;

const QuerySchema = z.object({
  date: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "date must be YYYY-MM-DD"
    ),
  market: z.string().optional(),
  minHitRate: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(5000).optional(),
  offset: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  playerId: z.coerce.number().int().positive().optional(),
  sort: z.enum(VALID_SORT_FIELDS).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  skipCache: z.coerce.boolean().optional(),
  hasOdds: z.coerce.boolean().optional(), // Filter for profiles with odds
});

const DEFAULT_LIMIT = 500; // Fetch more for client-side sorting
// No default market - when null, fetch ALL markets for flexible client-side filtering

// Get current ET date
function getETDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Generate cache key
function getCacheKey(dates: string[], market?: string | null, hasOdds?: boolean): string {
  const dateKey = dates.sort().join("_");
  const marketKey = market || "all";
  const oddsKey = hasOdds ? "odds" : "all";
  return `${CACHE_KEY_PREFIX}:${dateKey}:${marketKey}:${oddsKey}`;
}

// Transform RPC response to frontend format
function transformProfile(row: any, bestOdds: BestOddsData | null) {
  // Determine matchup quality from dvp_rank
  let matchupQuality: "favorable" | "neutral" | "unfavorable" | null = null;
  if (row.dvp_rank) {
    if (row.dvp_rank <= 10) matchupQuality = "unfavorable"; // Tough defense
    else if (row.dvp_rank >= 21) matchupQuality = "favorable"; // Weak defense
    else matchupQuality = "neutral";
  }

  return {
    id: row.id,
    player_id: row.player_id,
    team_id: row.team_id,
    market: row.market,
    line: row.line,
    opponent_team_id: row.opponent_team_id,
    game_id: row.game_id,
    game_date: row.game_date,
    last_5_pct: row.last_5_pct,
    last_10_pct: row.last_10_pct,
    last_20_pct: row.last_20_pct,
    season_pct: row.season_pct,
    h2h_pct: row.h2h_pct,
    h2h_avg: row.h2h_avg,
    h2h_games: row.h2h_games,
    hit_streak: row.hit_streak,
    last_5_avg: row.last_5_avg,
    last_10_avg: row.last_10_avg,
    last_20_avg: row.last_20_avg,
    season_avg: row.season_avg,
    spread: row.spread,
    total: row.total,
    spread_clv: row.spread_clv,
    total_clv: row.total_clv,
    injury_status: row.injury_status,
    injury_notes: row.injury_notes,
    team_name: row.team_name,
    team_abbr: row.team_abbr,
    opponent_team_name: row.opponent_team_name,
    opponent_team_abbr: row.opponent_team_abbr,
    player_position: row.player_position || row.player_depth_chart_pos,
    jersey_number: row.jersey_number,
    created_at: row.created_at,
    updated_at: row.updated_at,
    home_away: row.home_away,
    national_broadcast: row.national_broadcast,
    is_primetime: row.is_primetime,
    odds_selection_id: row.odds_selection_id,
    event_id: row.event_id,
    is_back_to_back: row.is_back_to_back,
    // New field from v3 RPC - needed for Redis lookup
    sel_key: row.sel_key,
    // Live best odds from Redis
    best_odds: bestOdds ? {
      book: bestOdds.best_book,
      price: bestOdds.best_price,
      updated_at: bestOdds.updated_at,
    } : null,
    books: bestOdds?.book_count ?? 0,
    // Player info (now denormalized)
    nba_players_hr: row.player_name ? {
      nba_player_id: row.player_id,
      name: row.player_name,
      position: row.player_depth_chart_pos || row.player_position,
      depth_chart_pos: row.player_depth_chart_pos,
      jersey_number: row.jersey_number,
    } : null,
    // Game info (now denormalized)
    nba_games_hr: {
      game_date: row.game_date,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
      game_status: row.game_status,
    },
    // Team colors (now denormalized - no accent_color in table yet)
    nba_teams: row.primary_color ? {
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: null, // Not in table yet
    } : null,
    // Matchup/DvP data (now pre-computed in table - no dvp_avg_allowed yet)
    matchup: row.dvp_rank ? {
      player_id: row.player_id,
      market: row.market,
      opponent_team_id: row.opponent_team_id,
      player_position: row.player_depth_chart_pos || row.player_position,
      matchup_rank: row.dvp_rank,
      rank_label: row.dvp_label,
      avg_allowed: null, // Not in table yet
      matchup_quality: matchupQuality,
    } : null,
  };
}

// Sort data client-side for flexibility
function sortData(data: any[], sort: string, sortDir: "asc" | "desc"): any[] {
  const multiplier = sortDir === "asc" ? 1 : -1;
  
  const fieldMap: Record<string, string> = {
    "line": "line",
    "l5Avg": "last_5_avg",
    "l10Avg": "last_10_avg",
    "seasonAvg": "season_avg",
    "streak": "hit_streak",
    "l5Pct": "last_5_pct",
    "l10Pct": "last_10_pct",
    "l20Pct": "last_20_pct",
    "seasonPct": "season_pct",
    "h2hPct": "h2h_pct",
    "matchupRank": "dvp_rank",
  };
  
  const dbField = fieldMap[sort];
  if (!dbField) return data;
  
  return [...data].sort((a, b) => {
    const aVal = a[dbField];
    const bVal = b[dbField];
    
    // ALWAYS push nulls to the END of the list
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;  // a goes after b
    if (bVal === null) return -1; // b goes after a
    
    return (aVal - bVal) * multiplier;
  });
}

// Filter data by search/market/player
function filterData(
  data: any[], 
  search?: string, 
  market?: string, 
  playerId?: number
): any[] {
  let result = data;
  
  if (search?.trim()) {
    const searchLower = search.toLowerCase().trim();
    result = result.filter(row => 
      row.player_name?.toLowerCase().includes(searchLower) ||
      row.team_name?.toLowerCase().includes(searchLower) ||
      row.team_abbr?.toLowerCase().includes(searchLower)
    );
  }
  
  if (market) {
    result = result.filter(row => row.market === market);
  }
  
  if (playerId) {
    result = result.filter(row => row.player_id === playerId);
  }
  
  return result;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  const query = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    market: url.searchParams.get("market") ?? undefined,
    minHitRate: url.searchParams.get("minHitRate") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    playerId: url.searchParams.get("playerId") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    sortDir: url.searchParams.get("sortDir") ?? undefined,
    skipCache: url.searchParams.get("skipCache") ?? undefined,
    hasOdds: url.searchParams.get("hasOdds") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const { 
    date, 
    market: rawMarket, 
    minHitRate, 
    limit = DEFAULT_LIMIT, 
    offset = 0, 
    search, 
    playerId,
    sort = "l10Pct",
    sortDir = "desc",
    skipCache = false,
    hasOdds = true, // Default to only profiles with odds
  } = query.data;
  
  // When no market specified, fetch ALL markets (client filters as needed)
  const market = rawMarket || null;

  const todayET = getETDate();
  const tomorrowET = getETDate(1);
  
  // Determine dates to fetch
  const datesToFetch = date ? [date] : [todayET, tomorrowET];
  
  try {
    let allData: any[] = [];
    let cacheHit = false;
    
    // Try cache first (unless search/player filter or skipCache)
    const canUseCache = !search && !playerId && !skipCache;
    
    if (canUseCache) {
      const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
      try {
        const cached = await redis.get<{ data: any[]; ts: number }>(cacheKey);
        if (cached && cached.data) {
          allData = cached.data;
          cacheHit = true;
          console.log(`[Hit Rates v2] Cache HIT (${allData.length} profiles) in ${Date.now() - startTime}ms`);
        }
      } catch (e) {
        console.error("[Hit Rates v2] Cache read error:", e);
      }
    }
    
    // Cache miss - fetch from Supabase using FAST RPC
    if (!cacheHit) {
      const supabase = createServerSupabaseClient();
      const dbStartTime = Date.now();
      
      // Call the new optimized RPC function (v3 includes sel_key for Redis lookup)
      const { data, error } = await supabase.rpc("get_nba_hit_rate_profiles_fast_v3", {
        p_dates: datesToFetch,
        p_market: market || null,
        p_has_odds: hasOdds,
        p_limit: market ? 500 : 3000, // 500 per market, 3000 for all markets
        p_offset: 0,
      });
      
      if (error) {
        console.error("[Hit Rates v2] RPC error:", error.message);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
      
      allData = data || [];
      
      const dbTime = Date.now() - dbStartTime;
      const withOddsCount = allData.filter((r: any) => r.odds_selection_id).length;
      console.log(`[Hit Rates v2] RPC fetch: ${allData.length} profiles (${withOddsCount} with odds) in ${dbTime}ms`);
      
      // Cache the data
      if (canUseCache && allData.length > 0) {
        const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
        redis.set(cacheKey, {
          data: allData,
          ts: Date.now(),
        }, { ex: CACHE_TTL_SECONDS }).catch(e => 
          console.error("[Hit Rates v2] Cache write error:", e)
        );
      }
    }
    
    // Apply client-side filters (for search/playerId which bypass cache)
    let filteredData = filterData(allData, search, undefined, playerId);
    
    // Apply sorting
    filteredData = sortData(filteredData, sort, sortDir);
    
    // Apply min hit rate filter if specified
    if (minHitRate) {
      filteredData = filteredData.filter(row => 
        row.last_10_pct !== null && row.last_10_pct >= minHitRate
      );
    }
    
    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit);
    
    // Fetch live best odds from Redis for paginated rows
    const bestOddsStartTime = Date.now();
    const bestOddsMap = await fetchBestOddsForRows(paginatedData);
    const bestOddsTime = Date.now() - bestOddsStartTime;
    console.log(`[Hit Rates v2] Best odds fetch: ${bestOddsMap.size} keys in ${bestOddsTime}ms`);
    
    // Transform to frontend format with best odds merged
    const transformedData = paginatedData.map(row => {
      // Build composite key for lookup
      const compositeKey = row.event_id && row.market && row.sel_key 
        ? `${row.event_id}:${row.market}:${row.sel_key}` 
        : null;
      const bestOdds = compositeKey ? bestOddsMap.get(compositeKey) ?? null : null;
      return transformProfile(row, bestOdds);
    });
    
    // Get unique dates from response
    const availableDates = [...new Set(allData.map((r: any) => r.game_date))].sort();
    const primaryDate = availableDates[0] || todayET;
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        data: transformedData,
        count: filteredData.length,
        meta: {
          date: primaryDate,
          availableDates,
          market: market ?? null,
          minHitRate: minHitRate ?? null,
          limit,
          offset,
          cacheHit,
          responseTime,
          hasMore: filteredData.length > offset + limit,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[Hit Rates v2] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
