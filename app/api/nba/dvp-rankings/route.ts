import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Valid positions
const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

// Request validation
const QuerySchema = z.object({
  position: z.enum(POSITIONS).default("PG"),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// Response types
export interface DvpTeamRanking {
  teamId: number;
  teamAbbr: string;
  teamName: string | null;
  position: string;
  games: number;
  // Core stats
  ptsAvg: number | null;
  ptsRank: number | null;
  rebAvg: number | null;
  rebRank: number | null;
  astAvg: number | null;
  astRank: number | null;
  fg3mAvg: number | null;
  stlAvg: number | null;
  blkAvg: number | null;
  tovAvg: number | null;
  // Combo stats
  praAvg: number | null;
  praRank: number | null;
  prAvg: number | null;
  paAvg: number | null;
  raAvg: number | null;
  bsAvg: number | null;
  // Shooting
  fgPct: number | null;
  fg3Pct: number | null;
  // Trend (L5)
  l5PtsAvg: number | null;
  l5RebAvg: number | null;
  l5AstAvg: number | null;
  l5PraAvg: number | null;
  l5Fg3mAvg: number | null;
  // Context
  ptsMin: number | null;
  ptsMax: number | null;
  minutesAvg: number | null;
  dd2Pct: number | null;
}

export interface DvpRankingsResponse {
  position: string;
  season: string;
  teams: DvpTeamRanking[];
  meta: {
    totalTeams: number;
    updatedAt: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      position: searchParams.get("position") || "PG",
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      console.error("[DvP Rankings] Validation error:", parsed.error);
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { position, season } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_dvp_rankings", {
      p_position: position,
      p_season: season,
    });

    if (error) {
      console.error("[DvP Rankings] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch DvP rankings", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Transform to camelCase response
    const teams: DvpTeamRanking[] = (data || []).map((row: any) => ({
      teamId: row.team_id,
      teamAbbr: row.team_abbr,
      teamName: row.team_name,
      position: row.def_position,
      games: row.games,
      // Core stats
      ptsAvg: row.pts_avg,
      ptsRank: row.pts_rank,
      rebAvg: row.reb_avg,
      rebRank: row.reb_rank,
      astAvg: row.ast_avg,
      astRank: row.ast_rank,
      fg3mAvg: row.fg3m_avg,
      stlAvg: row.stl_avg,
      blkAvg: row.blk_avg,
      tovAvg: row.tov_avg,
      // Combo stats
      praAvg: row.pra_avg,
      praRank: row.pra_rank,
      prAvg: row.pr_avg,
      paAvg: row.pa_avg,
      raAvg: row.ra_avg,
      bsAvg: row.bs_avg,
      // Shooting
      fgPct: row.fg_pct,
      fg3Pct: row.fg3_pct,
      // Trend (L5)
      l5PtsAvg: row.l5_pts_avg,
      l5RebAvg: row.l5_reb_avg,
      l5AstAvg: row.l5_ast_avg,
      l5PraAvg: row.l5_pra_avg,
      l5Fg3mAvg: row.l5_fg3m_avg,
      // Context
      ptsMin: row.pts_min,
      ptsMax: row.pts_max,
      minutesAvg: row.minutes_avg,
      dd2Pct: row.dd2_pct,
    }));

    const response: DvpRankingsResponse = {
      position,
      season,
      teams,
      meta: {
        totalTeams: teams.length,
        updatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 minutes, stale-while-revalidate for 10 minutes
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/dvp-rankings] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

