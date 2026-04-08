import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface TeamScoringRow {
  player_id: number;
  player_name: string;
  condition: string;
  games_matching: number;
  total_games: number;
  hit_pct_in_condition: number;
  rbi_share: number;
  run_share: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("team_id");
    const season = searchParams.get("season") || "2026";

    if (!teamId) {
      return NextResponse.json({ error: "team_id required" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();
    const { data, error } = await sb.rpc("get_team_scoring_correlations", {
      p_team_id: Number(teamId),
      p_season: Number(season),
    });

    if (error) {
      console.error("[Team Scoring API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scoring: data ?? [] });
  } catch (err: any) {
    console.error("[Team Scoring API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
