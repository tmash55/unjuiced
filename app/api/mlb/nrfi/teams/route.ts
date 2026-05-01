import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentMlbSeason } from "@/lib/mlb/current-season";

export interface NrfiTeamRow {
  tid: number;
  gp: number;
  scoring_pct: string | null;
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
  team_name?: string | null;
  team_abbr?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonsParam = searchParams.get("seasons") ?? String(getCurrentMlbSeason());
    const seasons = seasonsParam.split(",").map(Number);

    const sb = createServerSupabaseClient();
    const { data, error } = await sb.rpc("get_nrfi_team_leaderboard", {
      p_seasons: seasons,
    });

    if (error) {
      console.error("[NRFI Teams API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with team metadata for display in the leaderboard
    const rows = data ?? [];
    const teamIds = rows.map((r: any) => r.tid).filter(Boolean);
    const teamMap = new Map<number, { name: string | null; abbr: string | null }>();

    if (teamIds.length > 0) {
      const { data: teams } = await sb
        .from("mlb_teams")
        .select("team_id, name, abbreviation")
        .in("team_id", teamIds);

      for (const team of teams ?? []) {
        if (!team.team_id) continue;
        teamMap.set(team.team_id, {
          name: team.name ?? null,
          abbr: team.abbreviation ?? null,
        });
      }
    }

    const enriched = rows.map((r: any) => ({
      ...r,
      team_name: r.team_name ?? teamMap.get(r.tid)?.name ?? null,
      team_abbr: r.team_abbr ?? teamMap.get(r.tid)?.abbr ?? null,
    }));

    return NextResponse.json({ teams: enriched });
  } catch (err: any) {
    console.error("[NRFI Teams API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
