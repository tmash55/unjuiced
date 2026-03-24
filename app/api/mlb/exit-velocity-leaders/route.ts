"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BattedBallDetail {
  exit_velocity: number;
  launch_angle: number | null;
  distance: number | null;
  trajectory: string | null;
  event_type: string | null;
  is_hit: boolean;
  is_barrel: boolean;
  pitch_type: string | null;
  pitch_speed: number | null;
  pitcher_hand: string | null;
  pitcher_name: string | null;
  game_date: string;
  hardness: string | null;
  inning: number | null;
  opponent: string | null;
}

export interface ExitVeloLeader {
  player_id: number;
  player_name: string;
  team_id: number;
  team_name: string;
  team_abbr: string;
  position: string;
  batting_hand: string;
  opponent_team_abbr: string;
  opponent_team_name: string;
  home_away: string;
  game_id: string;
  game_date: string;
  lineup_position: number | null;
  // Exit velo stats
  avg_exit_velo: number;
  max_exit_velo: number;
  barrel_pct: number;
  hard_hit_pct: number;
  sweet_spot_pct: number;
  avg_launch_angle: number;
  avg_distance: number;
  max_distance: number;
  total_batted_balls: number;
  avg_pitch_speed: number | null;
  // Batted ball outcomes
  line_drive_pct: number;
  fly_ball_pct: number;
  ground_ball_pct: number;
  // Recent performance
  hits: number;
  home_runs: number;
  xbh: number;
  barrels: number;
  // SLG metrics
  xslg: number;
  actual_slg: number;
  slg_diff: number;
  // Trend: compare recent N ABs to full data
  ev_trend: "hot" | "warm" | "steady" | "cooling" | "cold";
  ev_vs_season: number;
  season_avg_ev: number;
  // Matchup context
  opposing_pitcher: string | null;
  opposing_pitcher_hand: string | null;
  venue_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  // Per-batted-ball detail
  recent_batted_balls: BattedBallDetail[];
}

export interface ExitVeloResponse {
  leaders: ExitVeloLeader[];
  meta: {
    date: string;
    sample_size: number;
    total_players_with_data: number;
    cached: boolean;
    filters: {
      pitcher_hand: string | null;
      pitch_type: string | null;
    };
    available_pitch_types: string[];
  };
}

// ── Query params ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sample: z.coerce.number().int().min(5).max(50).optional().default(15),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  pitcherHand: z.enum(["L", "R"]).optional(),
  pitchType: z.string().optional(),
  matchupSplit: z.coerce.boolean().optional().default(false),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function classifyTrend(evDiff: number): ExitVeloLeader["ev_trend"] {
  if (evDiff >= 3) return "hot";
  if (evDiff >= 1) return "warm";
  if (evDiff >= -1) return "steady";
  if (evDiff >= -3) return "cooling";
  return "cold";
}

/**
 * Find the best date with data — tries the requested date first,
 * then falls back to the most recent date that has hit rate profiles.
 */
async function findBestDate(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  requestedDate: string
): Promise<string | null> {
  const { data: exact } = await supabase
    .from("mlb_hit_rate_profiles")
    .select("game_date")
    .eq("game_date", requestedDate)
    .limit(1);

  if (exact && exact.length > 0) return requestedDate;

  const { data: recent } = await supabase
    .from("mlb_hit_rate_profiles")
    .select("game_date")
    .lte("game_date", requestedDate)
    .order("game_date", { ascending: false })
    .limit(200);

  if (recent && recent.length > 0) {
    return [...new Set(recent.map((r) => r.game_date))][0] ?? null;
  }

  const { data: anyDate } = await supabase
    .from("mlb_hit_rate_profiles")
    .select("game_date")
    .order("game_date", { ascending: false })
    .limit(200);

  if (anyDate && anyDate.length > 0) {
    return [...new Set(anyDate.map((r) => r.game_date))][0] ?? null;
  }

  return null;
}

// Pitch type display names
const PITCH_TYPE_NAMES: Record<string, string> = {
  FF: "4-Seam Fastball",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  CU: "Curveball",
  CH: "Changeup",
  FS: "Splitter",
  KC: "Knuckle Curve",
  ST: "Sweeper",
  SV: "Slurve",
  KN: "Knuckleball",
  EP: "Eephus",
  SC: "Screwball",
};

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
      sample: searchParams.get("sample") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      pitcherHand: searchParams.get("pitcherHand") ?? undefined,
      pitchType: searchParams.get("pitchType") ?? undefined,
      matchupSplit: searchParams.get("matchupSplit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid params", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { sample, limit, pitcherHand, pitchType, matchupSplit } = parsed.data;
    const requestedDate = parsed.data.date || getETDate();
    const supabase = createServerSupabaseClient();

    // 1. Find date with data (with fallback)
    const date = await findBestDate(supabase, requestedDate);

    if (!date) {
      return NextResponse.json(
        {
          leaders: [],
          meta: {
            date: requestedDate,
            sample_size: sample,
            total_players_with_data: 0,
            cached: false,
            filters: { pitcher_hand: pitcherHand ?? null, pitch_type: pitchType ?? null },
            available_pitch_types: [],
          },
        } satisfies ExitVeloResponse,
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
      );
    }

    // 2. Get players for that date using the RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_mlb_hit_rate_profiles_v3",
      {
        p_dates: [date],
        p_market: null,
        p_has_odds: false,
        p_limit: 3000,
        p_offset: 0,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: "Failed to fetch players", details: rpcError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!rpcData || rpcData.length === 0) {
      return NextResponse.json(
        {
          leaders: [],
          meta: {
            date,
            sample_size: sample,
            total_players_with_data: 0,
            cached: false,
            filters: { pitcher_hand: pitcherHand ?? null, pitch_type: pitchType ?? null },
            available_pitch_types: [],
          },
        } satisfies ExitVeloResponse,
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
      );
    }

    // Dedupe players
    const playerMap = new Map<
      number,
      {
        player_id: number;
        player_name: string;
        team_id: number;
        team_name: string;
        team_abbr: string;
        position: string;
        batting_hand: string;
        opponent_team_abbr: string;
        opponent_team_name: string;
        home_away: string;
        game_id: string;
        game_date: string;
        lineup_position: number | null;
      }
    >();

    for (const row of rpcData) {
      if (!row.player_id || playerMap.has(row.player_id)) continue;
      const battingHandRaw = row.batting_hand ?? row.bats ?? row.batter_hand ?? null;
      const battingHand =
        typeof battingHandRaw === "string"
          ? battingHandRaw.trim().toUpperCase().slice(0, 1)
          : "R";
      const lineupPosRaw = row.lineup_position ?? row.batting_order ?? null;
      const lineupPosition =
        lineupPosRaw != null && Number.isInteger(Number(lineupPosRaw)) && Number(lineupPosRaw) > 0
          ? Number(lineupPosRaw)
          : null;

      playerMap.set(row.player_id, {
        player_id: row.player_id,
        player_name: row.player_name,
        team_id: row.team_id,
        team_name: row.team_name,
        team_abbr: row.team_abbr,
        position: row.player_depth_chart_pos || row.player_position || "",
        batting_hand: battingHand,
        opponent_team_abbr: row.opponent_team_abbr,
        opponent_team_name: row.opponent_team_name,
        home_away: row.home_away || "",
        game_id: row.game_id,
        game_date: row.game_date,
        lineup_position: lineupPosition,
      });
    }

    const playerIds = Array.from(playerMap.keys());

    // 3. Query mlb_batted_balls directly — one query for ALL players
    let bbQuery = supabase
      .from("mlb_batted_balls")
      .select(
        "batter_id, batter_hand, pitcher_id, exit_velocity, launch_angle, total_distance, trajectory, hardness, pitch_type, pitch_speed, event, event_type, is_hit, is_barrel, game_date, pitcher_hand, game_id, inning"
      )
      .in("batter_id", playerIds)
      .not("exit_velocity", "is", null)
      .gt("exit_velocity", 0)
      .order("game_date", { ascending: false })
      .order("id", { ascending: false });

    // Apply pitcher hand filter
    if (pitcherHand) {
      bbQuery = bbQuery.eq("pitcher_hand", pitcherHand);
    }

    // Fetch enough rows: sample * num_players (with headroom)
    // Multiplier of 5 ensures players with fewer recent BBs still get their full sample
    const fetchLimit = Math.min(sample * playerIds.length * 5, 100000);
    bbQuery = bbQuery.limit(fetchLimit);

    const { data: allBBsPrePitch, error: bbError } = await bbQuery;

    if (bbError) {
      return NextResponse.json(
        { error: "Failed to fetch batted balls", details: bbError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Collect available pitch types BEFORE pitch type filter (so dropdown stays populated)
    const pitchTypeSet = new Set<string>();
    if (allBBsPrePitch) {
      for (const bb of allBBsPrePitch) {
        if (bb.pitch_type) pitchTypeSet.add(bb.pitch_type);
      }
    }

    // Apply pitch type filter client-side (so pitch type dropdown stays full)
    const allBBs = pitchType
      ? (allBBsPrePitch ?? []).filter((bb: any) => bb.pitch_type === pitchType)
      : allBBsPrePitch;

    // Also fetch full season data (unfiltered) for season avg comparison
    const { data: seasonBBs } = await supabase
      .from("mlb_batted_balls")
      .select("batter_id, exit_velocity")
      .in("batter_id", playerIds)
      .not("exit_velocity", "is", null)
      .gt("exit_velocity", 0)
      .limit(100000);

    // Build season avg map
    const seasonEvMap = new Map<number, number[]>();
    if (seasonBBs) {
      for (const bb of seasonBBs) {
        const evs = seasonEvMap.get(bb.batter_id) ?? [];
        evs.push(Number(bb.exit_velocity));
        seasonEvMap.set(bb.batter_id, evs);
      }
    }

    // Group batted balls by batter
    const bbByBatter = new Map<number, any[]>();
    if (allBBs) {
      for (const bb of allBBs) {
        const list = bbByBatter.get(bb.batter_id) ?? [];
        list.push(bb);
        bbByBatter.set(bb.batter_id, list);
      }
    }

    // 4. Get team colors
    const teamIds = [...new Set(Array.from(playerMap.values()).map((p) => p.team_id))];
    const { data: teamColors } = await supabase
      .from("mlb_teams")
      .select("team_id, primary_color, secondary_color")
      .in("team_id", teamIds);

    const colorMap = new Map<number, { primary: string; secondary: string }>();
    if (teamColors) {
      for (const t of teamColors) {
        colorMap.set(t.team_id, { primary: t.primary_color, secondary: t.secondary_color });
      }
    }

    // 5. Get venue names + probable pitchers
    const gameIds = [...new Set(Array.from(playerMap.values()).map((p) => p.game_id))];
    const { data: gameRows } = await supabase
      .from("mlb_games")
      .select("game_id, venue_id, home_id, away_id, home_probable_pitcher, away_probable_pitcher, home_probable_pitcher_id, away_probable_pitcher_id")
      .in("game_id", gameIds);

    const venueIds = [...new Set((gameRows || []).map((g: any) => g.venue_id).filter(Boolean))];
    const { data: venues } =
      venueIds.length > 0
        ? await supabase.from("mlb_venues").select("venue_id, name").in("venue_id", venueIds)
        : { data: [] };

    const venueNameMap = new Map<number, string>();
    if (venues) for (const v of venues) venueNameMap.set(v.venue_id, v.name);
    const gameVenueMap = new Map<string, string>();

    // Derive pitcher throwing hands from the batted balls we already fetched
    const pitcherHandMap = new Map<number, string>();
    if (allBBs) {
      const handCounts = new Map<number, Record<string, number>>();
      for (const bb of allBBs) {
        if (!bb.pitcher_id || !bb.pitcher_hand) continue;
        const counts = handCounts.get(bb.pitcher_id) ?? {};
        counts[bb.pitcher_hand] = (counts[bb.pitcher_hand] || 0) + 1;
        handCounts.set(bb.pitcher_id, counts);
      }
      for (const [pid, counts] of handCounts) {
        const topHand = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topHand) pitcherHandMap.set(pid, topHand);
      }
    }

    // Also do a targeted lookup for probable pitchers not found in batter BBs
    const probablePitcherIds = new Set<number>();
    if (gameRows) {
      for (const g of gameRows) {
        if (g.home_probable_pitcher_id && !pitcherHandMap.has(g.home_probable_pitcher_id)) {
          probablePitcherIds.add(g.home_probable_pitcher_id);
        }
        if (g.away_probable_pitcher_id && !pitcherHandMap.has(g.away_probable_pitcher_id)) {
          probablePitcherIds.add(g.away_probable_pitcher_id);
        }
      }
    }
    if (probablePitcherIds.size > 0) {
      const { data: pitcherBBs } = await supabase
        .from("mlb_batted_balls")
        .select("pitcher_id, pitcher_hand")
        .in("pitcher_id", Array.from(probablePitcherIds))
        .not("pitcher_hand", "is", null)
        .limit(probablePitcherIds.size * 3);

      if (pitcherBBs) {
        for (const bb of pitcherBBs) {
          if (bb.pitcher_hand && !pitcherHandMap.has(bb.pitcher_id)) {
            pitcherHandMap.set(bb.pitcher_id, bb.pitcher_hand);
          }
        }
      }
    }

    // Map: game_id -> game info including pitcher hands
    const gamePitcherMap = new Map<string, {
      home_pitcher: string | null;
      away_pitcher: string | null;
      home_pitcher_hand: string | null;
      away_pitcher_hand: string | null;
      home_id: number;
      away_id: number;
    }>();
    if (gameRows) {
      for (const g of gameRows) {
        if (g.venue_id && venueNameMap.has(g.venue_id)) {
          gameVenueMap.set(String(g.game_id), venueNameMap.get(g.venue_id)!);
        }
        gamePitcherMap.set(String(g.game_id), {
          home_pitcher: g.home_probable_pitcher,
          away_pitcher: g.away_probable_pitcher,
          home_pitcher_hand: g.home_probable_pitcher_id ? pitcherHandMap.get(g.home_probable_pitcher_id) ?? null : null,
          away_pitcher_hand: g.away_probable_pitcher_id ? pitcherHandMap.get(g.away_probable_pitcher_id) ?? null : null,
          home_id: g.home_id,
          away_id: g.away_id,
        });
      }
    }

    // 6. Lightweight pitcher name map from game probable pitchers we already fetched
    const pitcherNameMap = new Map<number, string>();
    if (gameRows) {
      for (const g of gameRows) {
        if (g.home_probable_pitcher_id && g.home_probable_pitcher) {
          pitcherNameMap.set(g.home_probable_pitcher_id, g.home_probable_pitcher);
        }
        if (g.away_probable_pitcher_id && g.away_probable_pitcher) {
          pitcherNameMap.set(g.away_probable_pitcher_id, g.away_probable_pitcher);
        }
      }
    }

    // 7. Process into leaders
    const leaders: ExitVeloLeader[] = [];

    for (const [batterId, bbs] of bbByBatter) {
      const player = playerMap.get(batterId);
      if (!player) continue;

      // Already sorted by game_date desc from query
      if (bbs.length < 3) continue;

      // Derive batting hand from batted ball data (more reliable than profile)
      const handCounts: Record<string, number> = {};
      for (const bb of bbs) {
        const h = bb.batter_hand;
        if (h) handCounts[h] = (handCounts[h] || 0) + 1;
      }
      const derivedBatHand =
        Object.keys(handCounts).length > 0
          ? Object.entries(handCounts).sort((a, b) => b[1] - a[1])[0][0]
          : player.batting_hand;

      // When matchupSplit is on, filter BBs to only those vs the hand they're facing today
      let filteredBBs = bbs;
      if (matchupSplit) {
        const gInfo = gamePitcherMap.get(String(player.game_id));
        const isHome = gInfo ? player.team_id === gInfo.home_id : false;
        const facingHand = gInfo ? (isHome ? gInfo.away_pitcher_hand : gInfo.home_pitcher_hand) : null;
        if (facingHand) {
          filteredBBs = bbs.filter((bb: any) => bb.pitcher_hand === facingHand);
          if (filteredBBs.length < 3) continue; // Skip if not enough split data
        }
      }

      const recentBBs = filteredBBs.slice(0, sample);
      const recentEVs = recentBBs.map((bb: any) => Number(bb.exit_velocity));
      const avgEV = recentEVs.reduce((s, v) => s + v, 0) / recentEVs.length;
      const maxEV = Math.max(...recentEVs);

      const recentBarrels = recentBBs.filter((bb: any) => bb.is_barrel === true).length;
      const barrelPct = (recentBarrels / recentBBs.length) * 100;

      const recentHardHit = recentBBs.filter(
        (bb: any) => Number(bb.exit_velocity) >= 95 || bb.hardness === "hard"
      ).length;
      const hardHitPct = (recentHardHit / recentBBs.length) * 100;

      const sweetSpot = recentBBs.filter((bb: any) => {
        const la = Number(bb.launch_angle);
        return !isNaN(la) && la >= 8 && la <= 32;
      }).length;
      const sweetSpotPct = (sweetSpot / recentBBs.length) * 100;

      const launchAngles = recentBBs
        .filter((bb: any) => bb.launch_angle != null)
        .map((bb: any) => Number(bb.launch_angle));
      const avgLA =
        launchAngles.length > 0 ? launchAngles.reduce((s, v) => s + v, 0) / launchAngles.length : 0;

      const distances = recentBBs
        .filter((bb: any) => bb.total_distance != null)
        .map((bb: any) => Number(bb.total_distance));
      const avgDist = distances.length > 0 ? distances.reduce((s, v) => s + v, 0) / distances.length : 0;
      const maxDist = distances.length > 0 ? Math.max(...distances) : 0;

      const pitchSpeeds = recentBBs
        .filter((bb: any) => bb.pitch_speed != null)
        .map((bb: any) => Number(bb.pitch_speed));
      const avgPitchSpeed =
        pitchSpeeds.length > 0 ? pitchSpeeds.reduce((s, v) => s + v, 0) / pitchSpeeds.length : null;

      // Trajectory
      const trajectories = recentBBs.reduce((acc: Record<string, number>, bb: any) => {
        const t = bb.trajectory || "unknown";
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});
      const ldPct = ((trajectories["line_drive"] || 0) / recentBBs.length) * 100;
      const fbPct = ((trajectories["fly_ball"] || 0) / recentBBs.length) * 100;
      const gbPct = ((trajectories["ground_ball"] || 0) / recentBBs.length) * 100;

      // Results — use is_hit boolean or event_type
      const hits = recentBBs.filter((bb: any) => bb.is_hit === true).length;
      const homeRuns = recentBBs.filter(
        (bb: any) => (bb.event_type || "").toLowerCase() === "home_run"
      ).length;
      const xbhTypes = new Set(["double", "triple", "home_run"]);
      const xbh = recentBBs.filter((bb: any) =>
        xbhTypes.has((bb.event_type || "").toLowerCase())
      ).length;

      // xSLG: expected slugging based on EV + LA per batted ball
      let totalExpectedBases = 0;
      let totalActualBases = 0;
      for (const bb of recentBBs) {
        const ev = Number(bb.exit_velocity);
        const la = bb.launch_angle != null ? Number(bb.launch_angle) : null;
        // Expected bases model
        if (bb.is_barrel === true) {
          totalExpectedBases += 1.5;
        } else if (ev >= 95 && la != null && la >= 10 && la <= 30) {
          totalExpectedBases += 1.0;
        } else if (ev >= 95 && la != null && la > 30) {
          totalExpectedBases += 0.4;
        } else if (ev >= 95) {
          totalExpectedBases += 0.6;
        } else if (la != null && la >= 10 && la <= 30) {
          totalExpectedBases += 0.5;
        } else {
          totalExpectedBases += 0.15;
        }
        // Actual bases from event
        const evt = (bb.event_type || "").toLowerCase();
        if (evt === "home_run") totalActualBases += 4;
        else if (evt === "triple") totalActualBases += 3;
        else if (evt === "double") totalActualBases += 2;
        else if (evt === "single") totalActualBases += 1;
      }
      const xslg = recentBBs.length > 0 ? totalExpectedBases / recentBBs.length : 0;
      const actualSlg = recentBBs.length > 0 ? totalActualBases / recentBBs.length : 0;
      const slgDiff = xslg - actualSlg;

      // Season avg EV (from unfiltered data)
      const seasonEvs = seasonEvMap.get(batterId) ?? recentEVs;
      const seasonAvgEV =
        seasonEvs.length > 0 ? seasonEvs.reduce((s, v) => s + v, 0) / seasonEvs.length : avgEV;
      const evDiff = avgEV - seasonAvgEV;

      const colors = colorMap.get(player.team_id);

      // Determine opposing pitcher + hand
      const gameInfo = gamePitcherMap.get(String(player.game_id));
      let opposingPitcher: string | null = null;
      let opposingPitcherHand: string | null = null;
      if (gameInfo) {
        const isHome = player.team_id === gameInfo.home_id;
        opposingPitcher = isHome ? gameInfo.away_pitcher : gameInfo.home_pitcher;
        opposingPitcherHand = isHome ? gameInfo.away_pitcher_hand : gameInfo.home_pitcher_hand;
      }

      leaders.push({
        player_id: player.player_id,
        player_name: player.player_name,
        team_id: player.team_id,
        team_name: player.team_name,
        team_abbr: player.team_abbr,
        position: player.position,
        batting_hand: derivedBatHand,
        opponent_team_abbr: player.opponent_team_abbr,
        opponent_team_name: player.opponent_team_name,
        home_away: player.home_away,
        game_id: player.game_id,
        game_date: player.game_date,
        lineup_position: player.lineup_position,
        avg_exit_velo: Math.round(avgEV * 10) / 10,
        max_exit_velo: Math.round(maxEV * 10) / 10,
        barrel_pct: Math.round(barrelPct * 10) / 10,
        hard_hit_pct: Math.round(hardHitPct * 10) / 10,
        sweet_spot_pct: Math.round(sweetSpotPct * 10) / 10,
        avg_launch_angle: Math.round(avgLA * 10) / 10,
        avg_distance: Math.round(avgDist),
        max_distance: Math.round(maxDist),
        total_batted_balls: recentBBs.length,
        avg_pitch_speed: avgPitchSpeed != null ? Math.round(avgPitchSpeed * 10) / 10 : null,
        line_drive_pct: Math.round(ldPct * 10) / 10,
        fly_ball_pct: Math.round(fbPct * 10) / 10,
        ground_ball_pct: Math.round(gbPct * 10) / 10,
        hits,
        home_runs: homeRuns,
        xbh,
        barrels: recentBarrels,
        xslg: Math.round(xslg * 1000) / 1000,
        actual_slg: Math.round(actualSlg * 1000) / 1000,
        slg_diff: Math.round(slgDiff * 1000) / 1000,
        ev_trend: classifyTrend(evDiff),
        ev_vs_season: Math.round(evDiff * 10) / 10,
        season_avg_ev: Math.round(seasonAvgEV * 10) / 10,
        opposing_pitcher: opposingPitcher,
        opposing_pitcher_hand: opposingPitcherHand,
        venue_name: gameVenueMap.get(String(player.game_id)) || null,
        primary_color: colors?.primary || null,
        secondary_color: colors?.secondary || null,
        recent_batted_balls: recentBBs.map((bb: any) => ({
          exit_velocity: Math.round(Number(bb.exit_velocity) * 10) / 10,
          launch_angle: bb.launch_angle != null ? Math.round(Number(bb.launch_angle) * 10) / 10 : null,
          distance: bb.total_distance != null ? Math.round(Number(bb.total_distance)) : null,
          trajectory: bb.trajectory || null,
          event_type: bb.event_type || null,
          is_hit: bb.is_hit === true,
          is_barrel: bb.is_barrel === true,
          pitch_type: bb.pitch_type || null,
          pitch_speed: bb.pitch_speed != null ? Math.round(Number(bb.pitch_speed) * 10) / 10 : null,
          pitcher_hand: bb.pitcher_hand || null,
          pitcher_name: bb.pitcher_id ? pitcherNameMap.get(bb.pitcher_id) ?? null : null,
          game_date: bb.game_date,
          hardness: bb.hardness || null,
          inning: bb.inning != null ? Number(bb.inning) : null,
          opponent: null,
        })),
      });
    }

    leaders.sort((a, b) => b.avg_exit_velo - a.avg_exit_velo);
    const trimmed = leaders.slice(0, limit);

    const response: ExitVeloResponse = {
      leaders: trimmed,
      meta: {
        date,
        sample_size: sample,
        total_players_with_data: leaders.length,
        cached: false,
        filters: {
          pitcher_hand: pitcherHand ?? null,
          pitch_type: pitchType ?? null,
        },
        available_pitch_types: [...pitchTypeSet].sort(),
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error: any) {
    console.error("[Exit Velocity Leaders] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
