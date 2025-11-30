"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { MatchupRank } from "@/lib/hit-rates-schema";

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
  limit: z.coerce.number().min(1).max(15000).optional(), // ~2 days × 15 games × 30 players × 12 markets
  offset: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  // New: include preview profiles (profiles with NULL lines for upcoming games)
  includePreview: z.enum(["true", "false"]).optional(),
});

const DEFAULT_LIMIT = 500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    market: url.searchParams.get("market") ?? undefined,
    minHitRate: url.searchParams.get("minHitRate") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    includePreview: url.searchParams.get("includePreview") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const { date, market, minHitRate, limit, offset, search, includePreview } = query.data;
  const showPreview = includePreview === "true";
  
  // Use Eastern Time for default "today" since NBA games are scheduled in ET
  // This prevents timezone issues where UTC date is already "tomorrow"
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayET = etFormatter.format(now); // Format: YYYY-MM-DD
  
  const supabase = createServerSupabaseClient();

  // Calculate tomorrow's date in ET
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowET = etFormatter.format(tomorrowDate);

  // Determine which dates to fetch
  let targetDates: string[] = [];
  
  if (date) {
    // Specific date requested
    targetDates = [date];
  } else {
    // Default: fetch today and tomorrow (for preview)
    // Check which dates have profiles
    const { data: datesWithProfiles } = await supabase
      .from("nba_hit_rate_profiles")
      .select("game_date")
      .gte("game_date", todayET)
      .lte("game_date", tomorrowET)
      .order("game_date", { ascending: true });

    const uniqueDates = [...new Set(datesWithProfiles?.map(d => d.game_date) ?? [])];
    
    if (uniqueDates.length > 0) {
      targetDates = uniqueDates;
    } else {
      // No profiles for today/tomorrow, find the next date with profiles
      const { data: nextDateData } = await supabase
        .from("nba_hit_rate_profiles")
        .select("game_date")
        .gt("game_date", tomorrowET)
        .order("game_date", { ascending: true })
        .limit(1);

      if (nextDateData && nextDateData.length > 0) {
        targetDates = [nextDateData[0].game_date];
      } else {
        targetDates = [todayET]; // Fallback
      }
    }
  }
  
  // For response meta, use the first date as the "primary" date
  const primaryDate = targetDates[0] || todayET;

  // Available dates = the dates we're fetching
  const availableDates = targetDates;

  let builder = supabase
    .from("nba_hit_rate_profiles")
    .select(
      `
        *,
        nba_players_hr!inner (
          nba_player_id,
          name,
          position,
          depth_chart_pos,
          jersey_number
        ),
        nba_games_hr (
          game_date,
          home_team_name,
          away_team_name,
          game_status
        ),
        nba_teams!nba_hit_rate_profiles_team_id_fkey (
          primary_color,
          secondary_color,
          accent_color
        )
      `,
      { count: "exact" }
    )
    // Fetch profiles for all target dates (today + tomorrow)
    .in("game_date", targetDates)
    // Sort by date first (today before tomorrow), then by hit rate within each day
    // This ensures tomorrow's profiles (which often have NULL hit rates) are included
    // rather than being pushed to the very end and potentially cut off by the limit
    .order("game_date", { ascending: true })
    .order("last_10_pct", { ascending: false, nullsFirst: false });

  if (market) {
    // Support comma-separated markets for multi-select
    const markets = market.split(",").map((m) => m.trim()).filter(Boolean);
    if (markets.length === 1) {
      builder = builder.eq("market", markets[0]);
    } else if (markets.length > 1) {
      builder = builder.in("market", markets);
    }
  }
  if (typeof minHitRate === "number") {
    builder = builder.gte("last_10_pct", minHitRate);
  }

  // Search filter - searches player name (primary), team abbr, opponent team abbr
  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    const searchPattern = `%${searchTerm}%`;
    
    // For player name search, filter on the joined table
    // This is the primary search use case
    builder = builder.ilike("nba_players_hr.name", searchPattern);
  }

  // Supabase has a row limit (~1000-2000). For large requests, we need to paginate.
  const SUPABASE_BATCH_SIZE = 1000; // Safe batch size
  const requestedLimit = limit ?? DEFAULT_LIMIT;
  const startOffset = offset ?? 0;
  
  let allData: any[] = [];
  let totalCount: number | null = null;
  let fetchError: any = null;
  
  // If requesting more than batch size, fetch in batches
  if (requestedLimit > SUPABASE_BATCH_SIZE) {
    let currentOffset = startOffset;
    let remaining = requestedLimit;
    
    while (remaining > 0) {
      const batchSize = Math.min(remaining, SUPABASE_BATCH_SIZE);
      const batchBuilder = builder.range(currentOffset, currentOffset + batchSize - 1);
      
      const { data: batchData, error: batchError, count: batchCount } = await batchBuilder;
      
      if (batchError) {
        fetchError = batchError;
        break;
      }
      
      if (totalCount === null) {
        totalCount = batchCount;
      }
      
      if (!batchData || batchData.length === 0) {
        break; // No more data
      }
      
      allData = [...allData, ...batchData];
      currentOffset += batchData.length;
      remaining -= batchData.length;
      
      // If we got fewer than requested, we've hit the end
      if (batchData.length < batchSize) {
        break;
      }
    }
    
    console.log(`[Hit Rates API] Fetched ${allData.length} profiles in batches (total count: ${totalCount ?? 0}, requested: ${requestedLimit})`);
  } else {
    // Small request, single fetch
    builder = builder.range(startOffset, startOffset + requestedLimit - 1);
    const { data, error, count } = await builder;
    allData = data ?? [];
    totalCount = count;
    fetchError = error;
    console.log(`[Hit Rates API] Fetched ${allData.length} profiles (total count: ${totalCount ?? 0}, limit: ${requestedLimit})`);
  }
  
  const data = allData;
  const error = fetchError;
  const count = totalCount;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load hit rates", details: error.message },
      { status: 500 }
    );
  }

  // Early return if no data
  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        data: [],
        count: 0,
        meta: {
          date: primaryDate,
          availableDates,
          market: market ?? null,
          minHitRate: minHitRate ?? null,
          limit: limit ?? DEFAULT_LIMIT,
          offset: offset ?? 0,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  // Build parallel arrays for matchup RPC call (O(n))
  const playerIds = data.map((hr) => hr.player_id);
  const markets = data.map((hr) => hr.market);
  const opponentIds = data.map((hr) => hr.opponent_team_id);

  // Fetch matchup ranks in parallel with main query result processing
  const { data: matchups, error: matchupError } = await supabase.rpc("get_matchup_ranks_batch", {
    p_player_ids: playerIds,
    p_markets: markets,
    p_opponent_team_ids: opponentIds,
  });

  // Log matchup fetch results for debugging
  if (matchupError) {
    console.error("[Hit Rates API] Matchup RPC error:", matchupError.message);
  } else {
    console.log(`[Hit Rates API] Fetched ${matchups?.length ?? 0} matchup ranks`);
  }

  // Create O(1) lookup Map instead of O(n²) .find() loop
  const matchupMap = new Map<string, MatchupRank>();
  if (matchups && Array.isArray(matchups)) {
    for (const m of matchups as MatchupRank[]) {
      // Key by player_id + market for fast lookup
      matchupMap.set(`${m.player_id}-${m.market}`, m);
    }
  }

  // Merge matchup data into hit rates (O(n) total)
  const enrichedData = data.map((hr) => ({
    ...hr,
    matchup: matchupMap.get(`${hr.player_id}-${hr.market}`) ?? null,
  }));

  return NextResponse.json(
    {
      data: enrichedData,
      count: count ?? 0,
      meta: {
        date: primaryDate,
        availableDates,
        market: market ?? null,
        minHitRate: minHitRate ?? null,
        limit: limit ?? DEFAULT_LIMIT,
        offset: offset ?? 0,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

