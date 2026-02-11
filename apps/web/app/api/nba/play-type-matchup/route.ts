import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  opponentTeamId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// Response types
export interface PlayTypeData {
  play_type: string;
  display_name: string;
  player_ppg: number;
  player_pct_of_total: number;
  player_ppp: number;
  player_possessions: number;
  player_total_points: number;
  player_percentile: number | null;
  player_fg_pct: number;
  opponent_def_rank: number | null;
  opponent_ppp_allowed: number | null;
  opponent_possessions: number | null;
  opponent_fg_pct_allowed: number | null;
  matchup_rating: "tough" | "neutral" | "favorable";
  matchup_color: "red" | "yellow" | "green";
  is_free_throws: boolean;
  ft_pct: number | null;
  opponent_fta_per_game: number | null;
}

export interface PlayTypeMatchupResponse {
  player: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
    team_abbr: string;
    games_played: number;
    season: string;
  };
  opponent: {
    team_id: number;
    team_name: string;
    team_abbr: string;
  };
  play_types: PlayTypeData[];
  summary: {
    total_play_types: number;
    favorable_matchups: number;
    tough_matchups: number;
    favorable_pct_of_points: number | null;
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      opponentTeamId: searchParams.get("opponentTeamId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      console.error("[Play Type Matchup] Validation error:", parsed.error);
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, opponentTeamId, season } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_play_type_matchup", {
      p_player_id: playerId,
      p_opponent_team_id: opponentTeamId,
      p_season: season,
    });

    if (error) {
      console.error("[Play Type Matchup] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch play type matchup", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // The RPC returns a single JSON object
    const response: PlayTypeMatchupResponse = data as PlayTypeMatchupResponse;

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 minutes, with stale-while-revalidate for 10 minutes
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/play-type-matchup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

