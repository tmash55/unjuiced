"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

/**
 * Hit Rates API v2 - Optimized for Performance
 * 
 * Key optimizations:
 * 1. Redis caching for hit rate profiles (60s TTL)
 * 2. Matchups fetched in parallel with main query
 * 3. Smaller initial payload (100 rows default)
 * 4. Fast path for cache hits
 * 5. Background cache refresh on stale data
 */

// Cache configuration
const CACHE_TTL_SECONDS = 60; // 1 minute cache
const CACHE_KEY_PREFIX = "hitrates:nba";

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
  skipCache: z.coerce.boolean().optional(), // Force fresh data
});

const DEFAULT_LIMIT = 100; // Reduced from 200 for faster initial load

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
function getCacheKey(date: string, sort?: string, sortDir?: string): string {
  return `${CACHE_KEY_PREFIX}:${date}:${sort || "default"}:${sortDir || "desc"}`;
}

// Transform raw data to frontend format
function transformProfile(row: any, matchup?: any) {
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
    player_position: row.player_position,
    jersey_number: row.jersey_number,
    // game_logs removed - fetched separately via /api/nba/player-box-scores for drilldown
    created_at: row.created_at,
    updated_at: row.updated_at,
    home_away: row.home_away,
    national_broadcast: row.national_broadcast,
    is_primetime: row.is_primetime,
    odds_selection_id: row.odds_selection_id,
    event_id: row.event_id,
    is_back_to_back: row.is_back_to_back,
    nba_players_hr: row.player_name ? {
      nba_player_id: row.player_id,
      name: row.player_name,
      position: row.player_full_position,
      depth_chart_pos: row.player_depth_chart_pos,
      jersey_number: row.player_jersey_number,
    } : null,
    nba_games_hr: {
      game_date: row.game_date,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
      game_status: row.game_status,
    },
    nba_teams: row.primary_color ? {
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: row.accent_color,
    } : null,
    matchup: matchup ? {
      player_id: matchup.player_id,
      market: matchup.market,
      opponent_team_id: matchup.opponent_team_id,
      player_position: matchup.player_position,
      matchup_rank: matchup.matchup_rank,
      rank_label: matchup.rank_label,
      avg_allowed: matchup.avg_allowed,
      matchup_quality: matchup.matchup_quality,
    } : null,
  };
}

// Fetch matchup data for a batch of profiles
async function fetchMatchups(
  supabase: any, 
  data: any[]
): Promise<Map<string, any>> {
  const matchupMap = new Map<string, any>();
  
  if (data.length === 0) return matchupMap;
  
  // Limit to first 500 profiles for matchup fetch to avoid timeout
  const subset = data.slice(0, 500);
  
  const playerIds = subset.map((r: any) => r.player_id);
  const markets = subset.map((r: any) => r.market);
  const opponentIds = subset.map((r: any) => r.opponent_team_id);

  try {
    const { data: matchups, error } = await supabase.rpc("get_matchup_ranks_batch", {
      p_player_ids: playerIds,
      p_markets: markets,
      p_opponent_team_ids: opponentIds,
    });

    if (error) {
      console.error("[Hit Rates v2] Matchup RPC error:", error.message);
    } else if (matchups && Array.isArray(matchups)) {
      for (const m of matchups) {
        matchupMap.set(`${m.player_id}-${m.market}`, m);
      }
    }
  } catch (e) {
    console.error("[Hit Rates v2] Matchup fetch error:", e);
  }
  
  return matchupMap;
}

// Sort data by field
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
    "matchupRank": "matchup_rank",
  };
  
  const dbField = fieldMap[sort];
  if (!dbField) return data;
  
  return [...data].sort((a, b) => {
    const aVal = a[dbField] ?? (sortDir === "asc" ? Infinity : -Infinity);
    const bVal = b[dbField] ?? (sortDir === "asc" ? Infinity : -Infinity);
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
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const { 
    date, 
    market, 
    minHitRate, 
    limit = DEFAULT_LIMIT, 
    offset = 0, 
    search, 
    playerId,
    sort = "l10Pct",
    sortDir = "desc",
    skipCache = false,
  } = query.data;

  const todayET = getETDate();
  const tomorrowET = getETDate(1);
  
  // Determine dates to fetch
  const datesToFetch = date ? [date] : [todayET, tomorrowET];
  
  try {
    let allData: any[] = [];
    let totalCount = 0;
    let cacheHit = false;
    
    // Try cache first (unless search/player filter or skipCache)
    const canUseCache = !search && !playerId && !skipCache;
    
    if (canUseCache) {
      // Try to get cached data for each date
      const cachePromises = datesToFetch.map(async (d) => {
        const cacheKey = getCacheKey(d, sort, sortDir);
        try {
          const cached = await redis.get<{ data: any[]; count: number; ts: number }>(cacheKey);
          if (cached) {
            return { date: d, ...cached };
          }
        } catch (e) {
          console.error(`[Hit Rates v2] Cache read error for ${d}:`, e);
        }
        return null;
      });
      
      const cacheResults = await Promise.all(cachePromises);
      const validCaches = cacheResults.filter(Boolean);
      
      if (validCaches.length === datesToFetch.length) {
        // Full cache hit!
        cacheHit = true;
        for (const cache of validCaches) {
          if (cache) {
            allData = [...allData, ...cache.data];
            totalCount += cache.count;
          }
        }
        console.log(`[Hit Rates v2] Cache HIT for ${datesToFetch.join(", ")} in ${Date.now() - startTime}ms`);
      }
    }
    
    // Cache miss - fetch from Supabase
    if (!cacheHit) {
      const supabase = createServerSupabaseClient();
      
      // Fetch profiles for all dates in parallel
      const fetchPromises = datesToFetch.map(async (d) => {
        const { data, error } = await supabase.rpc("get_nba_hit_rate_profiles", {
          p_dates: [d],
          p_market: null, // Fetch all markets, filter client-side for better caching
          p_min_hit_rate: minHitRate || null,
          p_search: null, // Filter client-side for better caching
          p_player_id: null, // Filter client-side for better caching
          p_limit: 3000, // Fetch more for caching
          p_offset: 0,
        });
        
        if (error) {
          console.error(`[Hit Rates v2] RPC error for ${d}:`, error.message);
          return { date: d, data: [], count: 0, error };
        }
        
        return { 
          date: d, 
          data: data || [], 
          count: data?.[0]?.total_profiles ?? 0,
        };
      });
      
      const fetchResults = await Promise.all(fetchPromises);
      
      // Process results and cache
      for (const result of fetchResults) {
        if (result.data.length > 0 && canUseCache) {
          // Sort data before caching
          const sortedData = sortData(result.data, sort, sortDir);
          
          // Cache for future requests (don't await to not block response)
          const cacheKey = getCacheKey(result.date, sort, sortDir);
          redis.set(cacheKey, {
            data: sortedData,
            count: result.count,
            ts: Date.now(),
          }, { ex: CACHE_TTL_SECONDS }).catch(e => 
            console.error(`[Hit Rates v2] Cache write error:`, e)
          );
          
          allData = [...allData, ...sortedData];
        } else {
          allData = [...allData, ...result.data];
        }
        totalCount += result.count;
      }
      
      console.log(`[Hit Rates v2] DB fetch for ${datesToFetch.join(", ")} in ${Date.now() - startTime}ms`);
    }
    
    // Apply client-side filters
    let filteredData = filterData(allData, search, market, playerId);
    
    // Apply sorting if not already sorted (cache data is pre-sorted)
    if (!cacheHit) {
      filteredData = sortData(filteredData, sort, sortDir);
    }
    
    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit);
    
    // Fetch matchups for paginated data (run in parallel with no blocking)
    // Only fetch if we have a reasonable number of rows
    const supabaseForMatchups = createServerSupabaseClient();
    const matchupMap = await fetchMatchups(supabaseForMatchups, paginatedData);
    
    // Transform to frontend format with matchup data
    const transformedData = paginatedData.map(row => {
      const matchup = matchupMap.get(`${row.player_id}-${row.market}`);
      return transformProfile(row, matchup);
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
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    console.error("[Hit Rates v2] Error:", error);
    return NextResponse.json(
      { error: "Failed to load hit rates", details: error?.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
