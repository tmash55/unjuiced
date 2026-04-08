import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface NrfiTeamRow {
  team_id: number;
  team_abbr: string;
  team_name: string;
  games: number;
  scoring_pct: number;
  l30_scoring_pct: number | null;
  l30_trend: string; // "up", "down", "flat"
  first_inn_ops: number | null;
  first_inn_hrs: number | null;
  first_inn_walks: number | null;
  first_inn_ks: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonsParam = searchParams.get("seasons") ?? "2025,2026";
    const seasons = seasonsParam.split(",").map(Number);

    const sb = createServerSupabaseClient();
    const { data, error } = await sb.rpc("get_nrfi_team_leaderboard", {
      p_seasons: seasons,
    });

    if (error) {
      console.error("[NRFI Teams API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ teams: data ?? [] });
  } catch (err: any) {
    console.error("[NRFI Teams API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
