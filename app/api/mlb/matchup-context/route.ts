import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  gameId: z.coerce.number().int().positive(),
});

export interface MlbMatchupPitcher {
  player_id: number | null;
  name: string | null;
  jersey_number: number | null;
  team_id: number | null;
}

export interface MlbPitcherSeasonStats {
  season: number | null;
  era: number | null;
  whip: number | null;
  innings_pitched: number | null;
  k_per_9: number | null;
  bb_per_9: number | null;
  hr_per_9: number | null;
  strikeouts: number | null;
  walks: number | null;
  games_started: number | null;
  games_pitched: number | null;
  wins: number | null;
  losses: number | null;
  opp_avg: number | null;
  opp_obp: number | null;
  hits_per_9: number | null;
  batters_faced: number | null;
}

export interface MlbBvpCareer {
  plate_appearances: number | null;
  at_bats: number | null;
  hits: number | null;
  home_runs: number | null;
  strike_outs: number | null;
  base_on_balls: number | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  rbi: number | null;
  doubles: number | null;
  triples: number | null;
  games_played: number | null;
}

export interface MlbBallparkFactor {
  factor_type: string | null;
  factor_overall: number | null;
  factor_vs_lhb: number | null;
  factor_vs_rhb: number | null;
  season: number | null;
}

export interface MlbMatchupContextResponse {
  game_id: number | null;
  game_date: string | null;
  game_time: string | null;
  venue_name: string | null;
  day_night: string | null;
  batter_home_away: "H" | "A" | null;
  opposing_pitcher: MlbMatchupPitcher | null;
  pitcher_stats: MlbPitcherSeasonStats[] | null;
  pitcher_statcast: Record<string, unknown> | null;
  bvp_career: MlbBvpCareer | null;
  bvp_seasons: Array<Record<string, unknown>> | null;
  ballpark_factors: MlbBallparkFactor[] | null;
  batter_statcast: Array<Record<string, unknown>> | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      gameId: searchParams.get("gameId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, gameId } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_mlb_matchup_context", {
      p_player_id: playerId,
      p_game_id: gameId,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch MLB matchup context", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(data as MlbMatchupContextResponse, {
      headers: {
        "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
