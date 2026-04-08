import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface NrfiPitcherRow {
  pitcher_id: number;
  pitcher_name: string;
  team_abbr: string;
  total_starts: number;
  nrfi_count: number;
  yrfi_count: number;
  nrfi_pct: string;
  nrfi_record: string;
  home_nrfi_pct: string | null;
  away_nrfi_pct: string | null;
  whip_1st: string | null;
  k_per_9_1st: string | null;
  bb_per_9_1st: string | null;
  ops_1st: string | null;
  avg_1st: string | null;
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
