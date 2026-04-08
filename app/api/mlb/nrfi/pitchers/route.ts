import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface NrfiPitcherRow {
  player_id: number;
  player_name: string;
  team_abbr: string;
  throws: string;
  total_starts: number;
  nrfi_count: number;
  yrfi_count: number;
  nrfi_pct: number;
  home_nrfi_pct: number | null;
  away_nrfi_pct: number | null;
  current_streak: number;
  streak_type: string; // "nrfi" or "yrfi"
  first_inn_whip: number | null;
  first_inn_k9: number | null;
  first_inn_ops: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minStarts = Number(searchParams.get("min_starts") ?? 10);
    const seasonsParam = searchParams.get("seasons") ?? "2025,2026";
    const seasons = seasonsParam.split(",").map(Number);

    const sb = createServerSupabaseClient();
    const { data, error } = await sb.rpc("get_nrfi_pitcher_leaderboard", {
      p_seasons: seasons,
      p_min_starts: minStarts,
    });

    if (error) {
      console.error("[NRFI Pitchers API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pitchers: data ?? [] });
  } catch (err: any) {
    console.error("[NRFI Pitchers API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
