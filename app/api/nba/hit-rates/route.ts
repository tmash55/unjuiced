"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
  limit: z.coerce.number().min(1).max(15000).optional(),
  offset: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
});

const DEFAULT_LIMIT = 200;
const PER_DAY_LIMIT = 3000; // Fetch up to 3000 per day
const FAST_LOAD_THRESHOLD = 250; // Skip matchups & tomorrow for fast initial load (under 250)

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    market: url.searchParams.get("market") ?? undefined,
    minHitRate: url.searchParams.get("minHitRate") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const { date, market, minHitRate, limit, offset, search } = query.data;
  
  const supabase = createServerSupabaseClient();

  // Use Eastern Time for "today" since NBA games are scheduled in ET
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayET = etFormatter.format(now);
  
  // Calculate tomorrow
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowET = etFormatter.format(tomorrowDate);

  let allData: any[] = [];
  let totalCount = 0;
  const requestedLimit = limit ?? DEFAULT_LIMIT;
  const isFastLoad = requestedLimit <= FAST_LOAD_THRESHOLD && !search;

  if (date) {
    // Specific date requested - single call
    const { data, error } = await supabase.rpc("get_hit_rate_profiles", {
      p_dates: [date],
      p_market: market || null,
      p_min_hit_rate: minHitRate || null,
      p_search: search || null,
      p_limit: requestedLimit,
      p_offset: offset ?? 0,
    });

  if (error) {
      console.error("[Hit Rates API] RPC error:", error.message);
    return NextResponse.json(
      { error: "Failed to load hit rates", details: error.message },
      { status: 500 }
    );
  }

    allData = data ?? [];
    totalCount = data?.[0]?.total_profiles ?? 0;
  } else if (isFastLoad) {
    // FAST INITIAL LOAD: Only fetch today, skip tomorrow for speed
    // Add retry for transient failures (503s from Supabase overload)
    let retries = 2;
    let data: any = null;
    let error: any = null;
    
    while (retries >= 0) {
      const result = await supabase.rpc("get_hit_rate_profiles", {
        p_dates: [todayET],
        p_market: market || null,
        p_min_hit_rate: minHitRate || null,
        p_search: null,
        p_limit: requestedLimit,
        p_offset: 0,
      });
      
      data = result.data;
      error = result.error;
      
      // Retry on 503/timeout errors
      if (error && (error.message?.includes("503") || error.message?.includes("timeout"))) {
        retries--;
        if (retries >= 0) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
          continue;
        }
      }
      break;
    }

    if (error) {
      console.error("[Hit Rates API] Fast load RPC error:", error.message);
      // Return empty data with error flag instead of failing completely
      return NextResponse.json(
        { data: [], count: 0, meta: { date: todayET, availableDates: [], error: error.message } },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    allData = data ?? [];
    totalCount = data?.[0]?.total_profiles ?? 0;
  } else {
    // FULL LOAD: Fetch BOTH today and tomorrow in parallel
    // Use Promise.allSettled so one timeout doesn't block the other
    const queryLimit = Math.min(requestedLimit, PER_DAY_LIMIT);
    
    const [todayResult, tomorrowResult] = await Promise.allSettled([
      supabase.rpc("get_hit_rate_profiles", {
        p_dates: [todayET],
        p_market: market || null,
        p_min_hit_rate: minHitRate || null,
        p_search: search || null,
        p_limit: queryLimit,
        p_offset: 0,
      }),
      supabase.rpc("get_hit_rate_profiles", {
        p_dates: [tomorrowET],
        p_market: market || null,
        p_min_hit_rate: minHitRate || null,
        p_search: search || null,
        p_limit: queryLimit,
        p_offset: 0,
      }),
    ]);

    // Extract data with graceful fallback - if one times out, still use the other
    let todayData: any[] = [];
    let tomorrowData: any[] = [];

    if (todayResult.status === "fulfilled") {
      if (todayResult.value.error) {
        console.error("[Hit Rates API] Today RPC error:", todayResult.value.error.message);
      } else {
        todayData = todayResult.value.data ?? [];
      }
    } else {
      console.error("[Hit Rates API] Today RPC rejected:", todayResult.reason);
    }

    if (tomorrowResult.status === "fulfilled") {
      if (tomorrowResult.value.error) {
        console.error("[Hit Rates API] Tomorrow RPC error:", tomorrowResult.value.error.message);
      } else {
        tomorrowData = tomorrowResult.value.data ?? [];
      }
    } else {
      console.error("[Hit Rates API] Tomorrow RPC rejected:", tomorrowResult.reason);
    }

    // Combine results (today first, then tomorrow) - graceful degradation
    allData = [...todayData, ...tomorrowData];
    
    // Total count from available days
    const todayCount = todayData[0]?.total_profiles ?? 0;
    const tomorrowCount = tomorrowData[0]?.total_profiles ?? 0;
    totalCount = todayCount + tomorrowCount;
  }

  // Apply limit to combined data
  const limitedData = allData.slice(0, requestedLimit);

  // Get unique dates from the response for meta
  const availableDates = [...new Set(allData.map((r: any) => r.game_date))].sort();
  const primaryDate = availableDates[0] || todayET;

  // Create matchup lookup map - SKIP for fast loads to reduce latency
  const matchupMap = new Map<string, any>();
  
  if (!isFastLoad && limitedData.length > 0) {
    const playerIds = limitedData.map((r: any) => r.player_id);
    const markets = limitedData.map((r: any) => r.market);
    const opponentIds = limitedData.map((r: any) => r.opponent_team_id);

    const { data: matchups, error: matchupError } = await supabase.rpc("get_matchup_ranks_batch", {
      p_player_ids: playerIds,
      p_markets: markets,
      p_opponent_team_ids: opponentIds,
    });

    if (matchupError) {
      console.error("[Hit Rates API] Matchup RPC error:", matchupError.message);
    } else if (matchups && Array.isArray(matchups)) {
      for (const m of matchups) {
        matchupMap.set(`${m.player_id}-${m.market}`, m);
      }
    }
  }

  // Transform RPC response to match frontend schema
  const transformedData = limitedData.map((row: any) => {
    const matchup = matchupMap.get(`${row.player_id}-${row.market}`);
    
    return {
      // Core profile fields
      id: row.id,
      player_id: row.player_id,
      team_id: row.team_id,
      market: row.market,
      line: row.line,
      opponent_team_id: row.opponent_team_id,
      game_id: row.game_id,
      game_date: row.game_date,
      
      // Hit rate metrics
      last_5_pct: row.last_5_pct,
      last_10_pct: row.last_10_pct,
      last_20_pct: row.last_20_pct,
      season_pct: row.season_pct,
      h2h_pct: row.h2h_pct,
      hit_streak: row.hit_streak,
      
      // Averages
      last_5_avg: row.last_5_avg,
      last_10_avg: row.last_10_avg,
      last_20_avg: row.last_20_avg,
      season_avg: row.season_avg,
      
      // Odds context
      spread: row.spread,
      total: row.total,
      spread_clv: row.spread_clv,
      total_clv: row.total_clv,
      
      // Metadata
      injury_status: row.injury_status,
      injury_notes: row.injury_notes,
      team_name: row.team_name,
      team_abbr: row.team_abbr,
      opponent_team_name: row.opponent_team_name,
      opponent_team_abbr: row.opponent_team_abbr,
      player_position: row.player_position,
      jersey_number: row.jersey_number,
      
      // Game logs & timestamps
      game_logs: row.game_logs,
      created_at: row.created_at,
      updated_at: row.updated_at,
      
      // Additional fields
      home_away: row.home_away,
      national_broadcast: row.national_broadcast,
      is_primetime: row.is_primetime,
      odds_selection_id: row.odds_selection_id,
      event_id: row.event_id,
      is_back_to_back: row.is_back_to_back,
      
      // Nested player object (for frontend compatibility)
      nba_players_hr: row.player_name ? {
        nba_player_id: row.player_id,
        name: row.player_name,
        position: row.player_full_position,
        depth_chart_pos: row.player_depth_chart_pos,
        jersey_number: row.player_jersey_number,
      } : null,
      
      // Nested game object
      nba_games_hr: {
        game_date: row.game_date,
        home_team_name: row.home_team_name,
        away_team_name: row.away_team_name,
        game_status: row.game_status,
      },
      
      // Nested team colors
      nba_teams: row.primary_color ? {
        primary_color: row.primary_color,
        secondary_color: row.secondary_color,
        accent_color: row.accent_color,
      } : null,
      
      // Matchup data from separate RPC
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
  });

  return NextResponse.json(
    {
      data: transformedData,
      count: Number(totalCount),
    meta: {
        date: primaryDate,
        availableDates,
      market: market ?? null,
      minHitRate: minHitRate ?? null,
        limit: requestedLimit,
      offset: offset ?? 0,
    },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
