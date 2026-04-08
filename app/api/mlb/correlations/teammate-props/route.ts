import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Reuses the existing get_game_correlations RPC filtered to teammate_props type
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("game_id");
    const teamId = searchParams.get("team_id");

    if (!gameId) {
      return NextResponse.json({ error: "game_id required" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();
    const { data, error } = await sb.rpc("get_game_correlations", {
      p_game_id: Number(gameId),
      p_min_sample: 3,
      p_min_co_occurrence: 30,
    });

    if (error) {
      console.error("[Teammate Props API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to teammate props only, optionally by team
    let rows = (data ?? []).filter((r: any) => r.correlation_type === "teammate_props");
    if (teamId) {
      rows = rows.filter((r: any) => r.team_id === Number(teamId));
    }

    return NextResponse.json({ props: rows });
  } catch (err: any) {
    console.error("[Teammate Props API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
