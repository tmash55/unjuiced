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
  season: string;
  games: number;
  
  // Basic stats
  ptsAvg: number | null;
  rebAvg: number | null;
  astAvg: number | null;
  fg3mAvg: number | null;
  stlAvg: number | null;
  blkAvg: number | null;
  tovAvg: number | null;
  
  // Basic ranks
  ptsRank: number | null;
  rebRank: number | null;
  astRank: number | null;
  fg3mRank: number | null;
  stlRank: number | null;
  blkRank: number | null;
  tovRank: number | null;
  
  // Shooting volume stats
  fgmAvg: number | null;
  fgaAvg: number | null;
  fg3aAvg: number | null;
  ftmAvg: number | null;
  ftaAvg: number | null;
  
  // Shooting volume ranks
  fgmRank: number | null;
  fgaRank: number | null;
  fg3aRank: number | null;
  ftmRank: number | null;
  ftaRank: number | null;
  
  // Shooting efficiency stats
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  
  // Shooting efficiency ranks
  fgPctRank: number | null;
  fg3PctRank: number | null;
  ftPctRank: number | null;
  
  // Rebounding breakdown
  orebAvg: number | null;
  drebAvg: number | null;
  orebRank: number | null;
  drebRank: number | null;
  
  // Other stats
  minutesAvg: number | null;
  minutesRank: number | null;
  
  // Combo stats
  praAvg: number | null;
  prAvg: number | null;
  paAvg: number | null;
  raAvg: number | null;
  bsAvg: number | null;
  praRank: number | null;
  prRank: number | null;
  paRank: number | null;
  raRank: number | null;
  bsRank: number | null;
  dd2Pct: number | null;
  dd2PctRank: number | null;
  
  // L5 trending stats
  l5PtsAvg: number | null;
  l5RebAvg: number | null;
  l5AstAvg: number | null;
  l5Fg3mAvg: number | null;
  l5StlAvg: number | null;
  l5BlkAvg: number | null;
  l5TovAvg: number | null;
  l5PraAvg: number | null;
  l5PrAvg: number | null;
  l5PaAvg: number | null;
  l5RaAvg: number | null;
  l5BsAvg: number | null;
  
  // L5 ranks
  l5PtsRank: number | null;
  l5RebRank: number | null;
  l5AstRank: number | null;
  l5Fg3mRank: number | null;
  l5StlRank: number | null;
  l5BlkRank: number | null;
  l5TovRank: number | null;
  l5PraRank: number | null;
  l5PrRank: number | null;
  l5PaRank: number | null;
  l5RaRank: number | null;
  l5BsRank: number | null;
  
  // L10 trending stats
  l10PtsAvg: number | null;
  l10RebAvg: number | null;
  l10AstAvg: number | null;
  l10Fg3mAvg: number | null;
  l10StlAvg: number | null;
  l10BlkAvg: number | null;
  l10TovAvg: number | null;
  l10PraAvg: number | null;
  l10PrAvg: number | null;
  l10PaAvg: number | null;
  l10RaAvg: number | null;
  l10BsAvg: number | null;
  
  // L10 ranks
  l10PtsRank: number | null;
  l10RebRank: number | null;
  l10AstRank: number | null;
  l10Fg3mRank: number | null;
  l10StlRank: number | null;
  l10BlkRank: number | null;
  l10TovRank: number | null;
  l10PraRank: number | null;
  l10PrRank: number | null;
  l10PaRank: number | null;
  l10RaRank: number | null;
  l10BsRank: number | null;
  
  // L15 trending stats
  l15PtsAvg: number | null;
  l15RebAvg: number | null;
  l15AstAvg: number | null;
  l15Fg3mAvg: number | null;
  l15StlAvg: number | null;
  l15BlkAvg: number | null;
  l15TovAvg: number | null;
  l15PraAvg: number | null;
  l15PrAvg: number | null;
  l15PaAvg: number | null;
  l15RaAvg: number | null;
  l15BsAvg: number | null;
  
  // L15 ranks
  l15PtsRank: number | null;
  l15RebRank: number | null;
  l15AstRank: number | null;
  l15Fg3mRank: number | null;
  l15StlRank: number | null;
  l15BlkRank: number | null;
  l15TovRank: number | null;
  l15PraRank: number | null;
  l15PrRank: number | null;
  l15PaRank: number | null;
  l15RaRank: number | null;
  l15BsRank: number | null;
  
  // L20 trending stats
  l20PtsAvg: number | null;
  l20RebAvg: number | null;
  l20AstAvg: number | null;
  l20Fg3mAvg: number | null;
  l20StlAvg: number | null;
  l20BlkAvg: number | null;
  l20TovAvg: number | null;
  l20PraAvg: number | null;
  l20PrAvg: number | null;
  l20PaAvg: number | null;
  l20RaAvg: number | null;
  l20BsAvg: number | null;
  
  // L20 ranks
  l20PtsRank: number | null;
  l20RebRank: number | null;
  l20AstRank: number | null;
  l20Fg3mRank: number | null;
  l20StlRank: number | null;
  l20BlkRank: number | null;
  l20TovRank: number | null;
  l20PraRank: number | null;
  l20PrRank: number | null;
  l20PaRank: number | null;
  l20RaRank: number | null;
  l20BsRank: number | null;
  
  // Min/max for heatmap scaling (basic stats)
  minPts: number | null;
  maxPts: number | null;
  minReb: number | null;
  maxReb: number | null;
  minAst: number | null;
  maxAst: number | null;
  minFg3m: number | null;
  maxFg3m: number | null;
  minStl: number | null;
  maxStl: number | null;
  minBlk: number | null;
  maxBlk: number | null;
  minTov: number | null;
  maxTov: number | null;
  minPra: number | null;
  maxPra: number | null;
  
  // Min/max for combo stats
  minPr: number | null;
  maxPr: number | null;
  minPa: number | null;
  maxPa: number | null;
  minRa: number | null;
  maxRa: number | null;
  minBs: number | null;
  maxBs: number | null;
  
  // Min/max for shooting stats
  minFga: number | null;
  maxFga: number | null;
  minFgPct: number | null;
  maxFgPct: number | null;
  minFg3Pct: number | null;
  maxFg3Pct: number | null;
  minFta: number | null;
  maxFta: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
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
      season: row.season,
      games: row.games,
      
      // Basic stats
      ptsAvg: row.pts_avg,
      rebAvg: row.reb_avg,
      astAvg: row.ast_avg,
      fg3mAvg: row.fg3m_avg,
      stlAvg: row.stl_avg,
      blkAvg: row.blk_avg,
      tovAvg: row.tov_avg,
      
      // Basic ranks
      ptsRank: row.pts_rank,
      rebRank: row.reb_rank,
      astRank: row.ast_rank,
      fg3mRank: row.fg3m_rank,
      stlRank: row.stl_rank,
      blkRank: row.blk_rank,
      tovRank: row.tov_rank,
      
      // Shooting volume stats
      fgmAvg: row.fgm_avg,
      fgaAvg: row.fga_avg,
      fg3aAvg: row.fg3a_avg,
      ftmAvg: row.ftm_avg,
      ftaAvg: row.fta_avg,
      
      // Shooting volume ranks
      fgmRank: row.fgm_rank,
      fgaRank: row.fga_rank,
      fg3aRank: row.fg3a_rank,
      ftmRank: row.ftm_rank,
      ftaRank: row.fta_rank,
      
      // Shooting efficiency stats
      fgPct: row.fg_pct,
      fg3Pct: row.fg3_pct,
      ftPct: row.ft_pct,
      
      // Shooting efficiency ranks
      fgPctRank: row.fg_pct_rank,
      fg3PctRank: row.fg3_pct_rank,
      ftPctRank: row.ft_pct_rank,
      
      // Rebounding breakdown
      orebAvg: row.oreb_avg,
      drebAvg: row.dreb_avg,
      orebRank: row.oreb_rank,
      drebRank: row.dreb_rank,
      
      // Other stats
      minutesAvg: row.minutes_avg,
      minutesRank: row.minutes_rank,
      
      // Combo stats
      praAvg: row.pra_avg,
      prAvg: row.pr_avg,
      paAvg: row.pa_avg,
      raAvg: row.ra_avg,
      bsAvg: row.bs_avg,
      praRank: row.pra_rank,
      prRank: row.pr_rank,
      paRank: row.pa_rank,
      raRank: row.ra_rank,
      bsRank: row.bs_rank,
      dd2Pct: row.dd2_pct,
      dd2PctRank: row.dd2_pct_rank,
      
      // L5 trending stats
      l5PtsAvg: row.l5_pts_avg,
      l5RebAvg: row.l5_reb_avg,
      l5AstAvg: row.l5_ast_avg,
      l5Fg3mAvg: row.l5_fg3m_avg,
      l5StlAvg: row.l5_stl_avg,
      l5BlkAvg: row.l5_blk_avg,
      l5TovAvg: row.l5_tov_avg,
      l5PraAvg: row.l5_pra_avg,
      l5PrAvg: row.l5_pr_avg,
      l5PaAvg: row.l5_pa_avg,
      l5RaAvg: row.l5_ra_avg,
      l5BsAvg: row.l5_bs_avg,
      
      // L5 ranks
      l5PtsRank: row.l5_pts_rank,
      l5RebRank: row.l5_reb_rank,
      l5AstRank: row.l5_ast_rank,
      l5Fg3mRank: row.l5_fg3m_rank,
      l5StlRank: row.l5_stl_rank,
      l5BlkRank: row.l5_blk_rank,
      l5TovRank: row.l5_tov_rank,
      l5PraRank: row.l5_pra_rank,
      l5PrRank: row.l5_pr_rank,
      l5PaRank: row.l5_pa_rank,
      l5RaRank: row.l5_ra_rank,
      l5BsRank: row.l5_bs_rank,
      
      // L10 trending stats
      l10PtsAvg: row.l10_pts_avg,
      l10RebAvg: row.l10_reb_avg,
      l10AstAvg: row.l10_ast_avg,
      l10Fg3mAvg: row.l10_fg3m_avg,
      l10StlAvg: row.l10_stl_avg,
      l10BlkAvg: row.l10_blk_avg,
      l10TovAvg: row.l10_tov_avg,
      l10PraAvg: row.l10_pra_avg,
      l10PrAvg: row.l10_pr_avg,
      l10PaAvg: row.l10_pa_avg,
      l10RaAvg: row.l10_ra_avg,
      l10BsAvg: row.l10_bs_avg,
      
      // L10 ranks
      l10PtsRank: row.l10_pts_rank,
      l10RebRank: row.l10_reb_rank,
      l10AstRank: row.l10_ast_rank,
      l10Fg3mRank: row.l10_fg3m_rank,
      l10StlRank: row.l10_stl_rank,
      l10BlkRank: row.l10_blk_rank,
      l10TovRank: row.l10_tov_rank,
      l10PraRank: row.l10_pra_rank,
      l10PrRank: row.l10_pr_rank,
      l10PaRank: row.l10_pa_rank,
      l10RaRank: row.l10_ra_rank,
      l10BsRank: row.l10_bs_rank,
      
      // L15 trending stats
      l15PtsAvg: row.l15_pts_avg,
      l15RebAvg: row.l15_reb_avg,
      l15AstAvg: row.l15_ast_avg,
      l15Fg3mAvg: row.l15_fg3m_avg,
      l15StlAvg: row.l15_stl_avg,
      l15BlkAvg: row.l15_blk_avg,
      l15TovAvg: row.l15_tov_avg,
      l15PraAvg: row.l15_pra_avg,
      l15PrAvg: row.l15_pr_avg,
      l15PaAvg: row.l15_pa_avg,
      l15RaAvg: row.l15_ra_avg,
      l15BsAvg: row.l15_bs_avg,
      
      // L15 ranks
      l15PtsRank: row.l15_pts_rank,
      l15RebRank: row.l15_reb_rank,
      l15AstRank: row.l15_ast_rank,
      l15Fg3mRank: row.l15_fg3m_rank,
      l15StlRank: row.l15_stl_rank,
      l15BlkRank: row.l15_blk_rank,
      l15TovRank: row.l15_tov_rank,
      l15PraRank: row.l15_pra_rank,
      l15PrRank: row.l15_pr_rank,
      l15PaRank: row.l15_pa_rank,
      l15RaRank: row.l15_ra_rank,
      l15BsRank: row.l15_bs_rank,
      
      // L20 trending stats
      l20PtsAvg: row.l20_pts_avg,
      l20RebAvg: row.l20_reb_avg,
      l20AstAvg: row.l20_ast_avg,
      l20Fg3mAvg: row.l20_fg3m_avg,
      l20StlAvg: row.l20_stl_avg,
      l20BlkAvg: row.l20_blk_avg,
      l20TovAvg: row.l20_tov_avg,
      l20PraAvg: row.l20_pra_avg,
      l20PrAvg: row.l20_pr_avg,
      l20PaAvg: row.l20_pa_avg,
      l20RaAvg: row.l20_ra_avg,
      l20BsAvg: row.l20_bs_avg,
      
      // L20 ranks
      l20PtsRank: row.l20_pts_rank,
      l20RebRank: row.l20_reb_rank,
      l20AstRank: row.l20_ast_rank,
      l20Fg3mRank: row.l20_fg3m_rank,
      l20StlRank: row.l20_stl_rank,
      l20BlkRank: row.l20_blk_rank,
      l20TovRank: row.l20_tov_rank,
      l20PraRank: row.l20_pra_rank,
      l20PrRank: row.l20_pr_rank,
      l20PaRank: row.l20_pa_rank,
      l20RaRank: row.l20_ra_rank,
      l20BsRank: row.l20_bs_rank,
      
      // Min/max for heatmap scaling (basic stats)
      minPts: row.min_pts,
      maxPts: row.max_pts,
      minReb: row.min_reb,
      maxReb: row.max_reb,
      minAst: row.min_ast,
      maxAst: row.max_ast,
      minFg3m: row.min_fg3m,
      maxFg3m: row.max_fg3m,
      minStl: row.min_stl,
      maxStl: row.max_stl,
      minBlk: row.min_blk,
      maxBlk: row.max_blk,
      minTov: row.min_tov,
      maxTov: row.max_tov,
      minPra: row.min_pra,
      maxPra: row.max_pra,
      
      // Min/max for combo stats
      minPr: row.min_pr,
      maxPr: row.max_pr,
      minPa: row.min_pa,
      maxPa: row.max_pa,
      minRa: row.min_ra,
      maxRa: row.max_ra,
      minBs: row.min_bs,
      maxBs: row.max_bs,
      
      // Min/max for shooting stats
      minFga: row.min_fga,
      maxFga: row.max_fga,
      minFgPct: row.min_fg_pct,
      maxFgPct: row.max_fg_pct,
      minFg3Pct: row.min_fg3_pct,
      maxFg3Pct: row.max_fg3_pct,
      minFta: row.min_fta,
      maxFta: row.max_fta,
      minMinutes: row.min_minutes,
      maxMinutes: row.max_minutes,
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
