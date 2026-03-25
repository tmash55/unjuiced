"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HRSheetPlayer {
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
  // Opposing pitcher
  opposing_pitcher: string | null;
  opposing_pitcher_hand: string | null;
  // Unjuiced HR Score (0-100)
  hr_score: number;
  hr_score_tier: "elite" | "strong" | "average" | "below_avg" | "weak";
  // Factor scores (each 0-10)
  factors: {
    barrel_pct: number;
    avg_exit_velo: number;
    fb_pull_profile: number;
    park_hr_factor: number;
    weather: number;
    vs_pitcher_hand: number;
    pitcher_vulnerability: number;
    recent_hr_trend: number;
    lineup_context: number;
    career_hr_rate: number;
  };
  // Raw stats for display
  avg_exit_velo: number;
  season_avg_ev: number;
  barrel_pct: number;
  hard_hit_pct: number;
  fly_ball_pct: number;
  pull_pct: number;
  oppo_pct: number;
  // Park + weather
  park_hr_factor: number | null;
  park_hr_factor_vs_hand: number | null;
  venue_name: string | null;
  weather_temp_f: number | null;
  weather_wind_mph: number | null;
  weather_wind_label: string | null;
  weather_hr_impact: number | null;
  // Pitcher vulnerability
  pitcher_hr_per_9: number | null;
  pitcher_hr_fb_pct: number | null;
  // Recent HRs
  hrs_last_10_games: number;
  hrs_last_25_games: number;
  hr_by_game: { date: string; hrs: number }[];
  total_batted_balls: number;
  // Colors
  primary_color: string | null;
  secondary_color: string | null;
}

export interface HRSheetResponse {
  players: HRSheetPlayer[];
  meta: {
    date: string;
    sample_size: number;
    total_players: number;
    cached: boolean;
  };
}

// ── Query params ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sample: z.coerce.number().int().min(5).max(50).optional().default(15),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  minScore: z.coerce.number().min(0).max(100).optional(),
  pitcherHand: z.enum(["L", "R"]).optional(),
  gameId: z.string().optional(),
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

function scoreTier(score: number): HRSheetPlayer["hr_score_tier"] {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 50) return "average";
  if (score >= 35) return "below_avg";
  return "weak";
}

// Factor scoring functions (each returns 0-10)

function scoreBarrelPct(pct: number): number {
  if (pct >= 15) return 10;
  if (pct >= 12) return 9;
  if (pct >= 10) return 8;
  if (pct >= 8) return 6;
  if (pct >= 5) return 4;
  if (pct >= 3) return 2;
  return 1;
}

function scoreAvgEV(ev: number): number {
  if (ev >= 95) return 10;
  if (ev >= 93) return 9;
  if (ev >= 91) return 8;
  if (ev >= 89) return 6;
  if (ev >= 87) return 4;
  if (ev >= 85) return 3;
  return 1;
}

function scoreFbPull(fbPct: number, pullPct: number): number {
  // Both high = power hitter profile
  const fbScore = fbPct >= 40 ? 5 : fbPct >= 35 ? 4 : fbPct >= 30 ? 3 : fbPct >= 25 ? 2 : 1;
  const pullScore = pullPct >= 45 ? 5 : pullPct >= 40 ? 4 : pullPct >= 35 ? 3 : pullPct >= 30 ? 2 : 1;
  return fbScore + pullScore;
}

function scoreParkFactor(factor: number | null): number {
  if (factor == null) return 5; // neutral default
  if (factor >= 1.15) return 10;
  if (factor >= 1.10) return 9;
  if (factor >= 1.05) return 8;
  if (factor >= 1.00) return 6;
  if (factor >= 0.95) return 5;
  if (factor >= 0.90) return 3;
  if (factor >= 0.85) return 2;
  return 1;
}

function scoreWeather(hrImpact: number | null, tempF: number | null): number {
  // hr_impact_score from weather table (higher = more HR-friendly)
  if (hrImpact != null) {
    if (hrImpact >= 3) return 10;
    if (hrImpact >= 2) return 9;
    if (hrImpact >= 1) return 7;
    if (hrImpact >= 0) return 5;
    if (hrImpact >= -1) return 4;
    if (hrImpact >= -2) return 2;
    return 1;
  }
  // Fallback to temperature only
  if (tempF == null) return 5;
  if (tempF >= 85) return 8;
  if (tempF >= 75) return 7;
  if (tempF >= 65) return 5;
  if (tempF >= 55) return 3;
  return 1;
}

function scoreVsPitcherHand(evVsHand: number, overallEv: number): number {
  // Compare EV against this hand vs overall
  const diff = evVsHand - overallEv;
  if (diff >= 3) return 10;
  if (diff >= 2) return 9;
  if (diff >= 1) return 7;
  if (diff >= 0) return 5;
  if (diff >= -1) return 4;
  if (diff >= -2) return 2;
  return 1;
}

function scorePitcherVulnerability(hrPer9: number | null): number {
  if (hrPer9 == null) return 5;
  if (hrPer9 >= 1.8) return 10;
  if (hrPer9 >= 1.5) return 9;
  if (hrPer9 >= 1.2) return 7;
  if (hrPer9 >= 1.0) return 6;
  if (hrPer9 >= 0.8) return 4;
  if (hrPer9 >= 0.5) return 2;
  return 1;
}

function scoreRecentHRTrend(hrsLast10: number, hrsLast25: number): number {
  // Weight recent more heavily
  const combined = hrsLast10 * 2 + (hrsLast25 - hrsLast10);
  if (combined >= 8) return 10;
  if (combined >= 6) return 9;
  if (combined >= 4) return 7;
  if (combined >= 3) return 6;
  if (combined >= 2) return 4;
  if (combined >= 1) return 3;
  return 1;
}

function scoreLineupContext(pos: number | null): number {
  if (pos == null) return 3;
  if (pos >= 2 && pos <= 5) return 10;
  if (pos === 1 || pos === 6) return 7;
  if (pos === 7) return 5;
  if (pos === 8) return 3;
  return 2; // 9th
}

function scoreCareerHRRate(hrPerBB: number): number {
  // HR per batted ball (approximate PA proxy)
  if (hrPerBB >= 0.08) return 10;
  if (hrPerBB >= 0.06) return 8;
  if (hrPerBB >= 0.04) return 6;
  if (hrPerBB >= 0.03) return 5;
  if (hrPerBB >= 0.02) return 3;
  return 1;
}

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

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
      sample: searchParams.get("sample") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      minScore: searchParams.get("minScore") ?? undefined,
      pitcherHand: searchParams.get("pitcherHand") ?? undefined,
      gameId: searchParams.get("gameId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid params", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { sample, limit, minScore, pitcherHand, gameId } = parsed.data;
    const requestedDate = parsed.data.date || getETDate();
    const supabase = createServerSupabaseClient();

    // 1. Find date with data
    const date = await findBestDate(supabase, requestedDate);

    const emptyResponse: HRSheetResponse = {
      players: [],
      meta: { date: requestedDate, sample_size: sample, total_players: 0, cached: false },
    };

    if (!date) {
      return NextResponse.json(emptyResponse, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
      });
    }

    // 2. Get players for that date
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_mlb_hit_rate_profiles_v3",
      { p_dates: [date], p_market: null, p_has_odds: false, p_limit: 3000, p_offset: 0 }
    );

    if (rpcError || !rpcData || rpcData.length === 0) {
      return NextResponse.json(emptyResponse, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
      });
    }

    // Dedupe players
    const playerMap = new Map<number, {
      player_id: number; player_name: string; team_id: number; team_name: string;
      team_abbr: string; position: string; batting_hand: string;
      opponent_team_abbr: string; opponent_team_name: string;
      home_away: string; game_id: string; game_date: string; lineup_position: number | null;
    }>();

    for (const row of rpcData) {
      if (!row.player_id || playerMap.has(row.player_id)) continue;
      const battingHandRaw = row.batting_hand ?? row.bats ?? row.batter_hand ?? null;
      const battingHand = typeof battingHandRaw === "string" ? battingHandRaw.trim().toUpperCase().slice(0, 1) : "R";
      const lineupPosRaw = row.lineup_position ?? row.batting_order ?? null;
      const lineupPosition = lineupPosRaw != null && Number.isInteger(Number(lineupPosRaw)) && Number(lineupPosRaw) > 0 ? Number(lineupPosRaw) : null;

      playerMap.set(row.player_id, {
        player_id: row.player_id, player_name: row.player_name,
        team_id: row.team_id, team_name: row.team_name, team_abbr: row.team_abbr,
        position: row.player_depth_chart_pos || row.player_position || "",
        batting_hand: battingHand,
        opponent_team_abbr: row.opponent_team_abbr, opponent_team_name: row.opponent_team_name,
        home_away: row.home_away || "", game_id: row.game_id, game_date: row.game_date,
        lineup_position: lineupPosition,
      });
    }

    const playerIds = Array.from(playerMap.keys());

    // 3. Fetch batted balls (with pitcher_id, pitcher_hand for splits)
    const fetchLimit = Math.min(sample * playerIds.length * 3, 80000);
    const { data: allBBs, error: bbError } = await supabase
      .from("mlb_batted_balls")
      .select("batter_id, batter_hand, pitcher_id, pitcher_hand, exit_velocity, launch_angle, total_distance, trajectory, hardness, event, event_type, is_hit, is_barrel, game_date, coord_x, coord_y")
      .in("batter_id", playerIds)
      .not("exit_velocity", "is", null)
      .gt("exit_velocity", 0)
      .order("game_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(fetchLimit);

    if (bbError) {
      return NextResponse.json(
        { error: "Failed to fetch batted balls", details: bbError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Season data for comparison
    const { data: seasonBBs } = await supabase
      .from("mlb_batted_balls")
      .select("batter_id, exit_velocity, event_type, is_barrel")
      .in("batter_id", playerIds)
      .not("exit_velocity", "is", null)
      .gt("exit_velocity", 0)
      .limit(100000);

    // Build season stats
    const seasonStats = new Map<number, { evs: number[]; hrs: number; total: number }>();
    if (seasonBBs) {
      for (const bb of seasonBBs) {
        const stats = seasonStats.get(bb.batter_id) ?? { evs: [], hrs: 0, total: 0 };
        stats.evs.push(Number(bb.exit_velocity));
        stats.total++;
        if ((bb.event_type || "").toLowerCase() === "home_run") stats.hrs++;
        seasonStats.set(bb.batter_id, stats);
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

    // Derive pitcher hands from batted balls
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

    // 4. Get game data (venue, pitchers, weather)
    const gameIds = [...new Set(Array.from(playerMap.values()).map((p) => p.game_id))];

    // Games + probable pitchers
    const { data: gameRows } = await supabase
      .from("mlb_games")
      .select("game_id, venue_id, home_id, away_id, home_probable_pitcher, away_probable_pitcher, home_probable_pitcher_id, away_probable_pitcher_id")
      .in("game_id", gameIds);

    // Weather
    const { data: weatherRows } = await supabase
      .from("mlb_game_weather")
      .select("game_id, temperature_f, wind_speed_mph, wind_label, wind_impact, hr_impact_score, roof_type")
      .in("game_id", gameIds);

    const weatherMap = new Map<string, any>();
    if (weatherRows) {
      for (const w of weatherRows) weatherMap.set(String(w.game_id), w);
    }

    // Venues + park factors
    const venueIds = [...new Set((gameRows || []).map((g: any) => g.venue_id).filter(Boolean))];
    const { data: venues } = venueIds.length > 0
      ? await supabase.from("mlb_venues").select("venue_id, name").in("venue_id", venueIds)
      : { data: [] };

    const venueNameMap = new Map<number, string>();
    if (venues) for (const v of venues) venueNameMap.set(v.venue_id, v.name);

    // Ballpark HR factors
    const { data: parkFactors } = venueIds.length > 0
      ? await supabase
          .from("mlb_ballpark_factors")
          .select("venue_id, factor_type, factor_overall, factor_vs_lhb, factor_vs_rhb")
          .in("venue_id", venueIds)
          .eq("factor_type", "HR")
      : { data: [] };

    const parkFactorMap = new Map<number, { overall: number; vs_lhb: number; vs_rhb: number }>();
    if (parkFactors) {
      for (const pf of parkFactors) {
        parkFactorMap.set(pf.venue_id, {
          overall: Number(pf.factor_overall ?? 1),
          vs_lhb: Number(pf.factor_vs_lhb ?? pf.factor_overall ?? 1),
          vs_rhb: Number(pf.factor_vs_rhb ?? pf.factor_overall ?? 1),
        });
      }
    }

    // Build game info maps
    const gamePitcherMap = new Map<string, {
      home_pitcher: string | null; away_pitcher: string | null;
      home_pitcher_hand: string | null; away_pitcher_hand: string | null;
      home_id: number; away_id: number; venue_id: number | null;
    }>();

    // Lookup probable pitcher hands
    const probablePitcherIds = new Set<number>();
    if (gameRows) {
      for (const g of gameRows) {
        if (g.home_probable_pitcher_id && !pitcherHandMap.has(g.home_probable_pitcher_id)) probablePitcherIds.add(g.home_probable_pitcher_id);
        if (g.away_probable_pitcher_id && !pitcherHandMap.has(g.away_probable_pitcher_id)) probablePitcherIds.add(g.away_probable_pitcher_id);
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

    // Pitcher HR vulnerability: count HRs allowed from batted balls
    const allProbablePitcherIds = new Set<number>();
    if (gameRows) {
      for (const g of gameRows) {
        if (g.home_probable_pitcher_id) allProbablePitcherIds.add(g.home_probable_pitcher_id);
        if (g.away_probable_pitcher_id) allProbablePitcherIds.add(g.away_probable_pitcher_id);
      }
    }

    const pitcherHRStats = new Map<number, { hrs: number; total: number; fb_count: number }>();
    if (allProbablePitcherIds.size > 0) {
      const { data: pitcherBBData } = await supabase
        .from("mlb_batted_balls")
        .select("pitcher_id, event_type, trajectory, is_barrel")
        .in("pitcher_id", Array.from(allProbablePitcherIds))
        .not("exit_velocity", "is", null)
        .limit(allProbablePitcherIds.size * 200);

      if (pitcherBBData) {
        for (const bb of pitcherBBData) {
          const stats = pitcherHRStats.get(bb.pitcher_id) ?? { hrs: 0, total: 0, fb_count: 0 };
          stats.total++;
          if ((bb.event_type || "").toLowerCase() === "home_run") stats.hrs++;
          if (bb.trajectory === "fly_ball") stats.fb_count++;
          pitcherHRStats.set(bb.pitcher_id, stats);
        }
      }
    }

    if (gameRows) {
      for (const g of gameRows) {
        gamePitcherMap.set(String(g.game_id), {
          home_pitcher: g.home_probable_pitcher,
          away_pitcher: g.away_probable_pitcher,
          home_pitcher_hand: g.home_probable_pitcher_id ? pitcherHandMap.get(g.home_probable_pitcher_id) ?? null : null,
          away_pitcher_hand: g.away_probable_pitcher_id ? pitcherHandMap.get(g.away_probable_pitcher_id) ?? null : null,
          home_id: g.home_id,
          away_id: g.away_id,
          venue_id: g.venue_id,
        });
      }
    }

    // 5. Team colors
    const teamIds = [...new Set(Array.from(playerMap.values()).map((p) => p.team_id))];
    const { data: teamColors } = await supabase
      .from("mlb_teams")
      .select("team_id, primary_color, secondary_color")
      .in("team_id", teamIds);

    const colorMap = new Map<number, { primary: string; secondary: string }>();
    if (teamColors) for (const t of teamColors) colorMap.set(t.team_id, { primary: t.primary_color, secondary: t.secondary_color });

    // 6. Process into HR sheet players
    const players: HRSheetPlayer[] = [];

    for (const [batterId, bbs] of bbByBatter) {
      const player = playerMap.get(batterId);
      if (!player) continue;
      if (bbs.length < 3) continue;

      // Derive batting hand
      const handCounts: Record<string, number> = {};
      for (const bb of bbs) { if (bb.batter_hand) handCounts[bb.batter_hand] = (handCounts[bb.batter_hand] || 0) + 1; }
      const derivedBatHand = Object.keys(handCounts).length > 0 ? Object.entries(handCounts).sort((a, b) => b[1] - a[1])[0][0] : player.batting_hand;

      const recentBBs = bbs.slice(0, sample);

      // Basic stats
      const evs = recentBBs.map((bb: any) => Number(bb.exit_velocity));
      const avgEV = evs.reduce((s, v) => s + v, 0) / evs.length;
      const barrels = recentBBs.filter((bb: any) => bb.is_barrel === true).length;
      const barrelPct = (barrels / recentBBs.length) * 100;
      const hardHit = recentBBs.filter((bb: any) => Number(bb.exit_velocity) >= 95).length;
      const hardHitPct = (hardHit / recentBBs.length) * 100;

      // Trajectory
      const trajectories = recentBBs.reduce((acc: Record<string, number>, bb: any) => {
        const t = bb.trajectory || "unknown";
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});
      const fbPct = ((trajectories["fly_ball"] || 0) / recentBBs.length) * 100;

      // Pull/Oppo % from coordinates
      // For RHB: pull = left field (coord_x < 115), oppo = right field (coord_x > 135)
      // For LHB: pull = right field (coord_x > 135), oppo = left field (coord_x < 115)
      const withCoords = recentBBs.filter((bb: any) => bb.coord_x != null);
      let pullPct = 35; // default
      let oppoPct = 20; // default
      if (withCoords.length >= 3) {
        const pullCount = withCoords.filter((bb: any) => {
          const x = Number(bb.coord_x);
          const hand = bb.batter_hand || derivedBatHand;
          return hand === "L" ? x > 135 : x < 115;
        }).length;
        const oppoCount = withCoords.filter((bb: any) => {
          const x = Number(bb.coord_x);
          const hand = bb.batter_hand || derivedBatHand;
          return hand === "L" ? x < 115 : x > 135;
        }).length;
        pullPct = (pullCount / withCoords.length) * 100;
        oppoPct = (oppoCount / withCoords.length) * 100;
      }

      // Game info
      const gameInfo = gamePitcherMap.get(String(player.game_id));
      const isHome = gameInfo ? player.team_id === gameInfo.home_id : false;
      const opposingPitcher = gameInfo ? (isHome ? gameInfo.away_pitcher : gameInfo.home_pitcher) : null;
      const opposingPitcherHand = gameInfo ? (isHome ? gameInfo.away_pitcher_hand : gameInfo.home_pitcher_hand) : null;
      const opposingPitcherId = gameInfo
        ? (isHome
          ? (gameRows?.find((g: any) => String(g.game_id) === String(player.game_id))?.away_probable_pitcher_id)
          : (gameRows?.find((g: any) => String(g.game_id) === String(player.game_id))?.home_probable_pitcher_id))
        : null;

      // Park factor
      const venueId = gameInfo?.venue_id;
      const parkFactor = venueId ? parkFactorMap.get(venueId) : null;
      const parkHrFactor = parkFactor?.overall ?? null;
      const parkHrFactorVsHand = parkFactor
        ? (derivedBatHand === "L" ? parkFactor.vs_lhb : parkFactor.vs_rhb)
        : null;

      // Weather
      const weather = weatherMap.get(String(player.game_id));
      const weatherTempF = weather?.temperature_f ?? null;
      const weatherWindMph = weather?.wind_speed_mph ?? null;
      const weatherWindLabel = weather?.wind_label ?? null;
      const weatherHrImpact = weather?.hr_impact_score ?? null;

      // Pitcher vulnerability
      const pitcherStats = opposingPitcherId ? pitcherHRStats.get(opposingPitcherId) : null;
      // Approximate HR/9 from batted balls: (HRs / total_BBs) * ~30 (avg BBs per 9 innings)
      const pitcherHrPer9 = pitcherStats && pitcherStats.total >= 20
        ? (pitcherStats.hrs / pitcherStats.total) * 30
        : null;
      const pitcherHrFbPct = pitcherStats && pitcherStats.fb_count > 0
        ? (pitcherStats.hrs / pitcherStats.fb_count) * 100
        : null;

      // vs Pitcher Hand split: EV against the hand they're facing
      let evVsHand = avgEV;
      if (opposingPitcherHand) {
        const handBBs = bbs.filter((bb: any) => bb.pitcher_hand === opposingPitcherHand);
        if (handBBs.length >= 5) {
          const handEvs = handBBs.slice(0, sample).map((bb: any) => Number(bb.exit_velocity));
          evVsHand = handEvs.reduce((s, v) => s + v, 0) / handEvs.length;
        }
      }

      // Recent HRs (from all BBs, not just sample)
      const allGameDates = [...new Set(bbs.map((bb: any) => bb.game_date))];
      const last10GameDates = allGameDates.slice(0, 10);
      const last25GameDates = allGameDates.slice(0, 25);
      const hrsLast10 = bbs.filter((bb: any) => last10GameDates.includes(bb.game_date) && (bb.event_type || "").toLowerCase() === "home_run").length;
      const hrsLast25 = bbs.filter((bb: any) => last25GameDates.includes(bb.game_date) && (bb.event_type || "").toLowerCase() === "home_run").length;

      // Per-game HR data for sparkline (last 10 games, oldest first)
      const hrByGame = last10GameDates.map((d) => ({
        date: d,
        hrs: bbs.filter((bb: any) => bb.game_date === d && (bb.event_type || "").toLowerCase() === "home_run").length,
      })).reverse();

      // Season stats
      const season = seasonStats.get(batterId);
      const seasonAvgEV = season && season.evs.length > 0 ? season.evs.reduce((s, v) => s + v, 0) / season.evs.length : avgEV;
      const careerHrRate = season && season.total > 0 ? season.hrs / season.total : 0;

      // Score factors
      const factors = {
        barrel_pct: scoreBarrelPct(barrelPct),
        avg_exit_velo: scoreAvgEV(avgEV),
        fb_pull_profile: scoreFbPull(fbPct, pullPct),
        park_hr_factor: scoreParkFactor(parkHrFactorVsHand ?? parkHrFactor),
        weather: scoreWeather(weatherHrImpact, weatherTempF),
        vs_pitcher_hand: scoreVsPitcherHand(evVsHand, seasonAvgEV),
        pitcher_vulnerability: scorePitcherVulnerability(pitcherHrPer9),
        recent_hr_trend: scoreRecentHRTrend(hrsLast10, hrsLast25),
        lineup_context: scoreLineupContext(player.lineup_position),
        career_hr_rate: scoreCareerHRRate(careerHrRate),
      };

      const hrScore = Object.values(factors).reduce((sum, v) => sum + v, 0);
      const colors = colorMap.get(player.team_id);

      players.push({
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
        opposing_pitcher: opposingPitcher,
        opposing_pitcher_hand: opposingPitcherHand,
        hr_score: hrScore,
        hr_score_tier: scoreTier(hrScore),
        factors,
        avg_exit_velo: Math.round(avgEV * 10) / 10,
        season_avg_ev: Math.round(seasonAvgEV * 10) / 10,
        barrel_pct: Math.round(barrelPct * 10) / 10,
        hard_hit_pct: Math.round(hardHitPct * 10) / 10,
        fly_ball_pct: Math.round(fbPct * 10) / 10,
        pull_pct: Math.round(pullPct * 10) / 10,
        oppo_pct: Math.round(oppoPct * 10) / 10,
        park_hr_factor: parkHrFactor != null ? Math.round(parkHrFactor * 100) / 100 : null,
        park_hr_factor_vs_hand: parkHrFactorVsHand != null ? Math.round(parkHrFactorVsHand * 100) / 100 : null,
        venue_name: venueId ? venueNameMap.get(venueId) ?? null : null,
        weather_temp_f: weatherTempF != null ? Math.round(Number(weatherTempF)) : null,
        weather_wind_mph: weatherWindMph != null ? Math.round(Number(weatherWindMph)) : null,
        weather_wind_label: weatherWindLabel,
        weather_hr_impact: weatherHrImpact != null ? Math.round(Number(weatherHrImpact) * 10) / 10 : null,
        pitcher_hr_per_9: pitcherHrPer9 != null ? Math.round(pitcherHrPer9 * 100) / 100 : null,
        pitcher_hr_fb_pct: pitcherHrFbPct != null ? Math.round(pitcherHrFbPct * 10) / 10 : null,
        hrs_last_10_games: hrsLast10,
        hrs_last_25_games: hrsLast25,
        hr_by_game: hrByGame,
        total_batted_balls: recentBBs.length,
        primary_color: colors?.primary || null,
        secondary_color: colors?.secondary || null,
      });
    }

    // Sort by HR score
    players.sort((a, b) => b.hr_score - a.hr_score);

    // Apply filters
    let filtered = players;
    if (gameId) {
      filtered = filtered.filter((p) => String(p.game_id) === gameId);
    }
    if (pitcherHand) {
      filtered = filtered.filter((p) => p.opposing_pitcher_hand === pitcherHand);
    }
    if (minScore) {
      filtered = filtered.filter((p) => p.hr_score >= minScore);
    }
    const trimmed = filtered.slice(0, limit);

    const response: HRSheetResponse = {
      players: trimmed,
      meta: {
        date,
        sample_size: sample,
        total_players: players.length,
        cached: false,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
