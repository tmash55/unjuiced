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
  limit: z.coerce.number().min(1).max(5000).optional(), // Increased max to handle all markets
  offset: z.coerce.number().min(0).optional(),
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
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const { date, market, minHitRate, limit, offset } = query.data;
  
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
  
  let targetDate = date || todayET;
  
  const supabase = createServerSupabaseClient();

  // If no specific date was provided, check if today has profiles
  // If not, find the next day that has profiles (like Thanksgiving with no games)
  if (!date) {
    const { count: todayCount } = await supabase
      .from("nba_hit_rate_profiles")
      .select("*", { count: "exact", head: true })
      .eq("game_date", todayET);

    if (!todayCount || todayCount === 0) {
      // No profiles today, find the next date with profiles
      const { data: nextDateData } = await supabase
        .from("nba_hit_rate_profiles")
        .select("game_date")
        .gt("game_date", todayET)
        .order("game_date", { ascending: true })
        .limit(1);

      if (nextDateData && nextDateData.length > 0) {
        targetDate = nextDateData[0].game_date;
      }
    }
  }

  let builder = supabase
    .from("nba_hit_rate_profiles")
    .select(
      `
        *,
        nba_players_hr!inner (
          nba_player_id,
          name,
          position,
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
    .eq("game_date", targetDate)
    .order("last_10_pct", { ascending: false });

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

  builder = builder.range(
    offset ?? 0,
    (offset ?? 0) + (limit ?? DEFAULT_LIMIT) - 1
  );

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load hit rates", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: data ?? [],
    count: count ?? 0,
    meta: {
      date: targetDate,
      market: market ?? null,
      minHitRate: minHitRate ?? null,
      limit: limit ?? DEFAULT_LIMIT,
      offset: offset ?? 0,
    },
  });
}

