import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface NrfiTeamRow {
  tid: number;
  gp: number;
  scoring_pct: string;
  l30_scoring_pct: string | null;
  total_1st_runs: number;
  avg_1st_runs: string;
  ops_1st: string | null;
  hits_1st: number;
  hrs_1st: number;
  walks_1st: number;
  ks_1st: number;
  home_scoring_pct: string | null;
  away_scoring_pct: string | null;
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

    // Enrich with team abbreviations from mlb_teams or mlb_games
    const rows = data ?? [];
    const teamIds = rows.map((r: any) => r.tid).filter(Boolean);
    let teamMap = new Map<number, string>();

    if (teamIds.length > 0) {
      // Try to get team abbrs from recent games
      const { data: games } = await sb
        .from("mlb_games")
        .select("home_id, home_team_tricode, away_id, away_team_tricode")
        .or(`home_id.in.(${teamIds.join(",")}),away_id.in.(${teamIds.join(",")})`)
        .limit(100);

      for (const g of games ?? []) {
        if (g.home_id && g.home_team_tricode) teamMap.set(g.home_id, g.home_team_tricode);
        if (g.away_id && g.away_team_tricode) teamMap.set(g.away_id, g.away_team_tricode);
      }
    }

    const enriched = rows.map((r: any) => ({
      ...r,
      team_abbr: teamMap.get(r.tid) ?? null,
    }));

    return NextResponse.json({ teams: enriched });
  } catch (err: any) {
    console.error("[NRFI Teams API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
