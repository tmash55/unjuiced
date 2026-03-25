"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { getMlbPreviousSeasonAvg } from "@/lib/hit-rates/season-averages";

const SPORT = "mlb";
const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = `hitrates:${SPORT}:v1`;

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

async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();
  const validRows = rows.filter((r) => r.event_id && r.market && r.sel_key);
  if (validRows.length === 0) return result;

  const keys = validRows.map((r) => `bestodds:${SPORT}:${r.event_id}:${r.market}:${r.sel_key}`);

  try {
    const values = await redis.mget<(BestOddsData | string | null)[]>(...keys);
    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];
      if (!value) {
        result.set(compositeKey, null);
        return;
      }
      if (typeof value === "string") {
        try {
          result.set(compositeKey, JSON.parse(value));
        } catch {
          result.set(compositeKey, null);
        }
      } else {
        result.set(compositeKey, value);
      }
    });
  } catch (e) {
    console.error("[MLB Hit Rates v2] Redis best odds fetch error:", e);
  }

  return result;
}

async function fetchEventStartTimes(
  rows: Array<{ event_id?: string }>
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
  if (eventIds.length === 0) return result;

  const keys = eventIds.map((eventId) => `events:${SPORT}:${eventId}`);
  try {
    const values = await redis.mget<(EventRedisData | string | null)[]>(...keys);
    eventIds.forEach((eventId, index) => {
      const raw = values[index];
      if (!raw) {
        result.set(eventId, null);
        return;
      }

      let parsed: EventRedisData;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw) as EventRedisData;
        } catch {
          result.set(eventId, null);
          return;
        }
      } else {
        parsed = raw;
      }

      result.set(eventId, parsed.commence_time || parsed.start_time || null);
    });
  } catch (error) {
    console.error("[MLB Hit Rates v2] Redis event start_time fetch error:", error);
  }

  return result;
}

const VALID_SORT_FIELDS = [
  "line",
  "l5Avg",
  "l10Avg",
  "seasonAvg",
  "streak",
  "l5Pct",
  "l10Pct",
  "l20Pct",
  "seasonPct",
  "h2hPct",
  "matchupRank",
] as const;

const QuerySchema = z.object({
  date: z
    .string()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "date must be YYYY-MM-DD"),
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getCacheKey(dates: string[], market?: string | null, hasOdds?: boolean): string {
  const dateKey = dates.sort().join("_");
  const marketKey = market || "all";
  const oddsKey = hasOdds ? "odds" : "all";
  return `${CACHE_KEY_PREFIX}:${dateKey}:${marketKey}:${oddsKey}`;
}

function transformProfile(
  row: any,
  bestOdds: BestOddsData | null,
  eventStartTime: string | null,
  previousSeasonAvg: number | null
) {
  const startTime =
    eventStartTime ||
    row.game_start_time ||
    row.start_time ||
    row.commence_time ||
    null;

  let matchupQuality: "favorable" | "neutral" | "unfavorable" | null = null;
  if (row.dvp_rank) {
    if (row.dvp_rank <= 10) matchupQuality = "unfavorable";
    else if (row.dvp_rank >= 21) matchupQuality = "favorable";
    else matchupQuality = "neutral";
  }

  const rawBattingHand =
    row.batting_hand ??
    row.bats ??
    row.batter_hand ??
    row.hit_side ??
    null;
  const battingHand =
    typeof rawBattingHand === "string"
      ? rawBattingHand.trim().toUpperCase().slice(0, 1)
      : null;
  const seasonBattingAvgRaw =
    row.season_batting_avg ??
    row.batting_avg ??
    row.ba ??
    null;
  const seasonBattingAvg = seasonBattingAvgRaw !== null && seasonBattingAvgRaw !== undefined
    ? Number(seasonBattingAvgRaw)
    : null;
  const lineupPositionRaw =
    row.lineup_position ??
    row.batting_order ??
    row.lineup_slot ??
    null;
  const lineupPosition = lineupPositionRaw !== null && lineupPositionRaw !== undefined
    ? Number(lineupPositionRaw)
    : null;

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
    previous_season_avg: previousSeasonAvg,
    spread: row.spread,
    total: row.total,
    spread_clv: row.spread_clv,
    total_clv: row.total_clv,
    injury_status: row.injury_status,
    injury_notes: row.injury_notes,
    batting_hand: battingHand && ["L", "R", "S"].includes(battingHand) ? battingHand : null,
    season_batting_avg: Number.isFinite(seasonBattingAvg as number) ? seasonBattingAvg : null,
    lineup_position:
      Number.isInteger(lineupPosition) && (lineupPosition as number) > 0
        ? lineupPosition
        : null,
    team_name: row.team_name,
    team_abbr: row.team_abbr,
    opponent_team_name: row.opponent_team_name,
    opponent_team_abbr: row.opponent_team_abbr,
    player_position: row.player_depth_chart_pos || row.player_position,
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
    best_odds: bestOdds
      ? {
          book: bestOdds.best_book,
          price: bestOdds.best_price,
          updated_at: bestOdds.updated_at,
        }
      : null,
    books: bestOdds?.book_count ?? row.book_count ?? 0,
    nba_players_hr: row.player_name
      ? {
          nba_player_id: row.player_id,
          name: row.player_name,
          position: row.player_depth_chart_pos || row.player_position,
          depth_chart_pos: row.player_depth_chart_pos || row.player_position,
          jersey_number: row.jersey_number,
        }
      : null,
    nba_games_hr: {
      game_date: row.game_date,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
      game_status: row.game_status,
      start_time: startTime,
    },
    nba_teams: row.primary_color
      ? {
          primary_color: row.primary_color,
          secondary_color: row.secondary_color,
          accent_color: row.accent_color,
        }
      : null,
    matchup: row.dvp_rank
      ? {
          player_id: row.player_id,
          market: row.market,
          opponent_team_id: row.opponent_team_id,
          player_position: row.player_depth_chart_pos || row.player_position,
          matchup_rank: row.dvp_rank,
          rank_label: row.dvp_label,
          avg_allowed: null,
          matchup_quality: matchupQuality,
        }
      : null,
  };
}

function sortData(data: any[], sort: string, sortDir: "asc" | "desc"): any[] {
  const multiplier = sortDir === "asc" ? 1 : -1;
  const fieldMap: Record<string, string> = {
    line: "line",
    l5Avg: "last_5_avg",
    l10Avg: "last_10_avg",
    seasonAvg: "season_avg",
    streak: "hit_streak",
    l5Pct: "last_5_pct",
    l10Pct: "last_10_pct",
    l20Pct: "last_20_pct",
    seasonPct: "season_pct",
    h2hPct: "h2h_pct",
    matchupRank: "dvp_rank",
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

function filterData(data: any[], search?: string, market?: string, playerId?: number): any[] {
  let result = data;

  if (search?.trim()) {
    const searchLower = search.toLowerCase().trim();
    result = result.filter(
      (row) =>
        row.player_name?.toLowerCase().includes(searchLower) ||
        row.team_name?.toLowerCase().includes(searchLower) ||
        row.team_abbr?.toLowerCase().includes(searchLower)
    );
  }

  if (market) result = result.filter((row) => row.market === market);
  if (playerId) result = result.filter((row) => row.player_id === playerId);

  return result;
}

async function getFallbackDates(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  todayET: string,
  market: string | null,
  hasOdds: boolean
) {
  const getUniqueDates = (rows: Array<{ game_date: string | null }>) =>
    [...new Set(rows.map((r) => r.game_date).filter(Boolean) as string[])].slice(0, 2);

  let upcomingQuery = supabase
    .from("mlb_hit_rate_profiles")
    .select("game_date")
    .gte("game_date", todayET);

  if (market) {
    upcomingQuery = upcomingQuery.eq("market", market);
  }
  if (hasOdds) {
    upcomingQuery = upcomingQuery.eq("has_live_odds", true);
  }

  const { data: upcoming } = await upcomingQuery
    .order("game_date", { ascending: true })
    .limit(200);

  const upcomingDates = getUniqueDates(upcoming || []);
  if (upcomingDates.length > 0) return upcomingDates;

  let anyDatesQuery = supabase
    .from("mlb_hit_rate_profiles")
    .select("game_date");

  if (market) {
    anyDatesQuery = anyDatesQuery.eq("market", market);
  }
  if (hasOdds) {
    anyDatesQuery = anyDatesQuery.eq("has_live_odds", true);
  }

  const { data: anyDates } = await anyDatesQuery
    .order("game_date", { ascending: true })
    .limit(200);

  return getUniqueDates(anyDates || []);
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
  const initialDatesToFetch = date ? [date] : [todayET, tomorrowET];

  try {
    let allData: any[] = [];
    let cacheHit = false;
    const canUseCache = !search && !playerId && !skipCache;

    if (canUseCache) {
      const cacheKey = getCacheKey(initialDatesToFetch, market, hasOdds);
      try {
        const cached = await redis.get<{ data: any[]; ts: number }>(cacheKey);
        if (cached?.data) {
          allData = cached.data;
          cacheHit = true;
        }
      } catch (e) {
        console.error("[MLB Hit Rates v2] Cache read error:", e);
      }
    }

    if (!cacheHit) {
      const supabase = createServerSupabaseClient();
      let datesToFetch = initialDatesToFetch;

      let { data, error } = await supabase.rpc("get_mlb_hit_rate_profiles_v3", {
        p_dates: datesToFetch,
        p_market: market,
        p_has_odds: hasOdds,
        p_limit: market ? 2000 : 3000,
        p_offset: 0,
      });

      if (!date && (!data || data.length === 0)) {
        const fallbackDates = await getFallbackDates(supabase, todayET, market, hasOdds);
        if (fallbackDates.length > 0) {
          datesToFetch = fallbackDates;
          const fallback = await supabase.rpc("get_mlb_hit_rate_profiles_v3", {
            p_dates: datesToFetch,
            p_market: market,
            p_has_odds: hasOdds,
            p_limit: market ? 2000 : 3000,
            p_offset: 0,
          });
          data = fallback.data;
          error = fallback.error;
        }

        // Final fallback: remove date constraint and fetch by market globally.
        // This handles cases where date discovery is blocked or no near-term rows exist.
        if (!error && (!data || data.length === 0)) {
          const broadFallback = await supabase.rpc("get_mlb_hit_rate_profiles_v3", {
            p_dates: null,
            p_market: market,
            p_has_odds: hasOdds,
            p_limit: market ? 2000 : 3000,
            p_offset: 0,
          });
          data = broadFallback.data;
          error = broadFallback.error;
          datesToFetch = [];
        }
      }

      if (error) {
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }

      allData = data || [];

      if (canUseCache && allData.length > 0) {
        const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
        redis
          .set(cacheKey, { data: allData, ts: Date.now() }, { ex: CACHE_TTL_SECONDS })
          .catch((e) => console.error("[MLB Hit Rates v2] Cache write error:", e));
      }
    }

    let filteredData = filterData(allData, search, undefined, playerId);
    filteredData = sortData(filteredData, sort, sortDir);

    if (minHitRate) {
      filteredData = filteredData.filter(
        (row) => row.last_10_pct !== null && row.last_10_pct >= minHitRate
      );
    }

    const paginatedData = filteredData.slice(offset, offset + limit);

    const bestOddsMap = await fetchBestOddsForRows(paginatedData);
    const eventStartTimes = await fetchEventStartTimes(paginatedData);

    const transformedData = paginatedData.map((row) => {
      const compositeKey =
        row.event_id && row.market && row.sel_key
          ? `${row.event_id}:${row.market}:${row.sel_key}`
          : null;
      const bestOdds = compositeKey ? bestOddsMap.get(compositeKey) ?? null : null;
      const eventStartTime = row.event_id ? eventStartTimes.get(row.event_id) ?? null : null;
      const previousSeasonAvg = getMlbPreviousSeasonAvg(row, todayET);
      return transformProfile(row, bestOdds, eventStartTime, previousSeasonAvg);
    });

    const availableDates = [...new Set(allData.map((r: any) => r.game_date))].sort();
    const primaryDate = availableDates[0] || todayET;

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
          responseTime: Date.now() - startTime,
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
    console.error("[MLB Hit Rates v2] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
