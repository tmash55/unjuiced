"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

/**
 * Hit Rates API v2 - WNBA
 *
 * Uses `get_wnba_hit_rate_profiles_fast_v3` RPC which mirrors the NBA version
 * but targets wnba_players_hr, wnba_games_hr, and wnba_teams tables.
 */

// Cache configuration
const CACHE_TTL_SECONDS = 60; // 1 minute cache
const CACHE_KEY_PREFIX = "hitrates:wnba:v4";

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

interface EventRedisData {
  commence_time?: string;
  start_time?: string;
}

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();

  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);

  if (validRows.length === 0) {
    return result;
  }

  const keys = validRows.map(r => `bestodds:wnba:${r.event_id}:${r.market}:${r.sel_key}`);

  try {
    const values = await redis.mget<(BestOddsData | null)[]>(...keys);

    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];

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
    console.error("[Hit Rates v2 WNBA] Redis best odds fetch error:", e);
  }

  return result;
}

async function fetchEventStartTimes(
  rows: Array<{ event_id?: string }>
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const eventIds = [...new Set(rows.map(r => r.event_id).filter(Boolean))] as string[];

  if (eventIds.length === 0) {
    return result;
  }

  const eventKeys = eventIds.map(eventId => `events:wnba:${eventId}`);

  try {
    const values = await redis.mget<(EventRedisData | string | null)[]>(...eventKeys);
    eventIds.forEach((eventId, index) => {
      const raw = values[index];
      if (!raw) {
        result.set(eventId, null);
        return;
      }

      let event: EventRedisData;
      if (typeof raw === "string") {
        try {
          event = JSON.parse(raw) as EventRedisData;
        } catch {
          result.set(eventId, null);
          return;
        }
      } else {
        event = raw;
      }

      const startTime = event.commence_time || event.start_time || null;
      result.set(eventId, startTime);
    });
  } catch (error) {
    console.error("[Hit Rates v2 WNBA] Redis event start_time fetch error:", error);
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
  hasOdds: z.coerce.boolean().optional(),
});

const DEFAULT_LIMIT = 500;

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

function getCacheKey(dates: string[], market?: string | null, hasOdds?: boolean): string {
  const dateKey = dates.sort().join("_");
  const marketKey = market || "all";
  const oddsKey = hasOdds ? "odds" : "all";
  return `${CACHE_KEY_PREFIX}:${dateKey}:${marketKey}:${oddsKey}`;
}

function transformProfile(row: any, bestOdds: BestOddsData | null, eventStartTime: string | null) {
  const startTime =
    eventStartTime ||
    row.start_time ||
    row.commence_time ||
    row.game_start ||
    row.game_start_time ||
    null;

  let matchupQuality: "favorable" | "neutral" | "unfavorable" | null = null;
  if (row.dvp_rank) {
    if (row.dvp_rank <= 10) matchupQuality = "unfavorable";
    else if (row.dvp_rank >= 21) matchupQuality = "favorable";
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
    start_time: startTime,
    sel_key: row.sel_key,
    best_odds: bestOdds ? {
      book: bestOdds.best_book,
      price: bestOdds.best_price,
      updated_at: bestOdds.updated_at,
    } : null,
    books: bestOdds?.book_count ?? 0,
    // Top-level nba_player_id flows into HitRateProfile.nbaPlayerId for cdn.nba.com headshots
    nba_player_id: row.nba_player_id ?? null,
    // Keep nba_ field names for schema compatibility with shared frontend components.
    // For WNBA, nba_player_id may be null until the backfill catches that player.
    nba_players_hr: row.player_name ? {
      nba_player_id: row.nba_player_id ?? row.player_id,
      name: row.player_name,
      position: row.player_depth_chart_pos || row.player_position,
      depth_chart_pos: row.player_depth_chart_pos,
      jersey_number: row.jersey_number,
    } : null,
    nba_games_hr: {
      game_date: row.game_date,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
      game_status: row.game_status,
      start_time: startTime,
    },
    nba_teams: row.primary_color ? {
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: null,
    } : null,
    matchup: row.dvp_rank ? {
      player_id: row.player_id,
      market: row.market,
      opponent_team_id: row.opponent_team_id,
      player_position: row.player_depth_chart_pos || row.player_position,
      matchup_rank: row.dvp_rank,
      rank_label: row.dvp_label,
      avg_allowed: null,
      matchup_quality: matchupQuality,
    } : null,
  };
}

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

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    return (aVal - bVal) * multiplier;
  });
}

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
    hasOdds = false,
  } = query.data;

  const market = rawMarket || null;

  const todayET = getETDate();
  const tomorrowET = getETDate(1);

  const datesToFetch = date ? [date] : [todayET, tomorrowET];

  try {
    let allData: any[] = [];
    let cacheHit = false;

    const canUseCache = !search && !playerId && !skipCache;

    if (canUseCache) {
      const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
      try {
        const cached = await redis.get<{ data: any[]; ts: number }>(cacheKey);
        if (cached && cached.data) {
          allData = cached.data;
          cacheHit = true;
          console.log(`[Hit Rates v2 WNBA] Cache HIT (${allData.length} profiles) in ${Date.now() - startTime}ms`);
        }
      } catch (e) {
        console.error("[Hit Rates v2 WNBA] Cache read error:", e);
      }
    }

    if (!cacheHit) {
      const supabase = createServerSupabaseClient();
      const dbStartTime = Date.now();

      const { data, error } = await supabase.rpc("get_wnba_hit_rate_profiles_fast_v3", {
        p_dates: datesToFetch,
        p_market: market || null,
        p_has_odds: hasOdds ? true : null,
        p_limit: market ? 500 : 3000,
        p_offset: 0,
      });

      if (error) {
        console.error("[Hit Rates v2 WNBA] RPC error:", error.message);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }

      allData = data || [];

      const dbTime = Date.now() - dbStartTime;
      const withOddsCount = allData.filter((r: any) => r.odds_selection_id).length;
      console.log(`[Hit Rates v2 WNBA] RPC fetch: ${allData.length} profiles (${withOddsCount} with odds) in ${dbTime}ms`);

      if (canUseCache && allData.length > 0) {
        const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
        redis.set(cacheKey, {
          data: allData,
          ts: Date.now(),
        }, { ex: CACHE_TTL_SECONDS }).catch(e =>
          console.error("[Hit Rates v2 WNBA] Cache write error:", e)
        );
      }
    }

    let filteredData = filterData(allData, search, undefined, playerId);
    filteredData = sortData(filteredData, sort, sortDir);

    if (minHitRate) {
      filteredData = filteredData.filter(row =>
        row.last_10_pct !== null && row.last_10_pct >= minHitRate
      );
    }

    const paginatedData = filteredData.slice(offset, offset + limit);

    const bestOddsStartTime = Date.now();
    const bestOddsMap = await fetchBestOddsForRows(paginatedData);
    const bestOddsTime = Date.now() - bestOddsStartTime;
    console.log(`[Hit Rates v2 WNBA] Best odds fetch: ${bestOddsMap.size} keys in ${bestOddsTime}ms`);

    const eventStartTimes = await fetchEventStartTimes(paginatedData);

    const transformedData = paginatedData.map(row => {
      const compositeKey = row.event_id && row.market && row.sel_key
        ? `${row.event_id}:${row.market}:${row.sel_key}`
        : null;
      const bestOdds = compositeKey ? bestOddsMap.get(compositeKey) ?? null : null;
      const eventStartTime = row.event_id ? eventStartTimes.get(row.event_id) ?? null : null;
      return transformProfile(row, bestOdds, eventStartTime);
    });

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
    console.error("[Hit Rates v2 WNBA] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
