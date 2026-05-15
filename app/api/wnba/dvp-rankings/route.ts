import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  DvpRankingsResponse,
  DvpTeamRanking,
} from "@/app/api/nba/dvp-rankings/route";

const POSITIONS = ["G", "F", "C"] as const;

const QuerySchema = z.object({
  position: z.enum(POSITIONS).default("G"),
  season: z.string().nullish().transform((v) => v ?? "2026"),
});

const EXPANSION_TEAMS_2026 = [
  {
    teamId: 1611661327,
    teamAbbr: "TOR",
    teamName: "Toronto",
    inactiveReason: "No 2025 data - expansion team",
  },
  {
    teamId: 1611661332,
    teamAbbr: "POR",
    teamName: "Portland",
    inactiveReason: "No 2025 data - expansion team",
  },
] as const;

type WnbaDefenseRow = Record<string, number | string | null | undefined> & {
  team_id: number | string;
  team_abbr: string;
  team_name: string | null;
  position: string;
  season: string;
  games: number | null;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const getRank = (value: number | string | null | undefined): number | null => {
  const next = toNumber(value);
  return next == null ? null : Math.round(next);
};

const getMinMax = (rows: WnbaDefenseRow[], field: string) => {
  const values = rows
    .map((row) => toNumber(row[field]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

const buildRanking = (
  row: Partial<WnbaDefenseRow> & {
    team_id: number | string;
    team_abbr: string;
    team_name: string | null;
    position: string;
    season: string;
  },
  minMax: Record<string, { min: number | null; max: number | null }>,
  inactive?: { reason: string }
): DvpTeamRanking => {
  const avg = (field: string) => toNumber(row[field]);
  const rank = (field: string) => getRank(row[field]);

  return {
    teamId: Number(row.team_id),
    teamAbbr: row.team_abbr,
    teamName: row.team_name,
    position: row.position,
    season: row.season,
    inactive: Boolean(inactive),
    inactiveReason: inactive?.reason ?? null,
    games: Number(row.games ?? 0),

    ptsAvg: avg("pts_avg"),
    rebAvg: avg("reb_avg"),
    astAvg: avg("ast_avg"),
    fg3mAvg: avg("fg3m_avg"),
    stlAvg: avg("stl_avg"),
    blkAvg: avg("blk_avg"),
    tovAvg: avg("tov_avg"),

    ptsRank: rank("pts_rank"),
    rebRank: rank("reb_rank"),
    astRank: rank("ast_rank"),
    fg3mRank: rank("fg3m_rank"),
    stlRank: rank("stl_rank"),
    blkRank: rank("blk_rank"),
    tovRank: rank("tov_rank"),

    fgmAvg: avg("fgm_avg"),
    fgaAvg: avg("fga_avg"),
    fg3aAvg: avg("fg3a_avg"),
    ftmAvg: avg("ftm_avg"),
    ftaAvg: avg("fta_avg"),
    fgmRank: rank("fgm_rank"),
    fgaRank: rank("fga_rank"),
    fg3aRank: rank("fg3a_rank"),
    ftmRank: rank("ftm_rank"),
    ftaRank: rank("fta_rank"),

    fgPct: avg("fg_pct"),
    fg3Pct: avg("fg3_pct"),
    ftPct: avg("ft_pct"),
    fgPctRank: rank("fg_pct_rank"),
    fg3PctRank: rank("fg3_pct_rank"),
    ftPctRank: rank("ft_pct_rank"),

    orebAvg: avg("oreb_avg"),
    drebAvg: avg("dreb_avg"),
    orebRank: rank("oreb_rank"),
    drebRank: rank("dreb_rank"),
    minutesAvg: avg("minutes_avg"),
    minutesRank: rank("minutes_rank"),

    praAvg: avg("pra_avg"),
    prAvg: avg("pr_avg"),
    paAvg: avg("pa_avg"),
    raAvg: avg("ra_avg"),
    bsAvg: avg("bs_avg"),
    praRank: rank("pra_rank"),
    prRank: rank("pr_rank"),
    paRank: rank("pa_rank"),
    raRank: rank("ra_rank"),
    bsRank: rank("bs_rank"),
    dd2Pct: avg("dd2_pct"),
    dd2PctRank: rank("dd2_pct_rank"),

    l5PtsAvg: avg("l5_pts_avg"),
    l5RebAvg: avg("l5_reb_avg"),
    l5AstAvg: avg("l5_ast_avg"),
    l5Fg3mAvg: avg("l5_fg3m_avg"),
    l5StlAvg: avg("l5_stl_avg"),
    l5BlkAvg: avg("l5_blk_avg"),
    l5TovAvg: avg("l5_tov_avg"),
    l5PraAvg: avg("l5_pra_avg"),
    l5PrAvg: avg("l5_pr_avg"),
    l5PaAvg: avg("l5_pa_avg"),
    l5RaAvg: avg("l5_ra_avg"),
    l5BsAvg: avg("l5_bs_avg"),
    l5PtsRank: rank("l5_pts_rank"),
    l5RebRank: rank("l5_reb_rank"),
    l5AstRank: rank("l5_ast_rank"),
    l5Fg3mRank: rank("l5_fg3m_rank"),
    l5StlRank: rank("l5_stl_rank"),
    l5BlkRank: rank("l5_blk_rank"),
    l5TovRank: rank("l5_tov_rank"),
    l5PraRank: rank("l5_pra_rank"),
    l5PrRank: rank("l5_pr_rank"),
    l5PaRank: rank("l5_pa_rank"),
    l5RaRank: rank("l5_ra_rank"),
    l5BsRank: rank("l5_bs_rank"),

    l10PtsAvg: avg("l10_pts_avg"),
    l10RebAvg: avg("l10_reb_avg"),
    l10AstAvg: avg("l10_ast_avg"),
    l10Fg3mAvg: avg("l10_fg3m_avg"),
    l10StlAvg: avg("l10_stl_avg"),
    l10BlkAvg: avg("l10_blk_avg"),
    l10TovAvg: avg("l10_tov_avg"),
    l10PraAvg: avg("l10_pra_avg"),
    l10PrAvg: avg("l10_pr_avg"),
    l10PaAvg: avg("l10_pa_avg"),
    l10RaAvg: avg("l10_ra_avg"),
    l10BsAvg: avg("l10_bs_avg"),
    l10PtsRank: rank("l10_pts_rank"),
    l10RebRank: rank("l10_reb_rank"),
    l10AstRank: rank("l10_ast_rank"),
    l10Fg3mRank: rank("l10_fg3m_rank"),
    l10StlRank: rank("l10_stl_rank"),
    l10BlkRank: rank("l10_blk_rank"),
    l10TovRank: rank("l10_tov_rank"),
    l10PraRank: rank("l10_pra_rank"),
    l10PrRank: rank("l10_pr_rank"),
    l10PaRank: rank("l10_pa_rank"),
    l10RaRank: rank("l10_ra_rank"),
    l10BsRank: rank("l10_bs_rank"),

    l15PtsAvg: avg("l15_pts_avg"),
    l15RebAvg: avg("l15_reb_avg"),
    l15AstAvg: avg("l15_ast_avg"),
    l15Fg3mAvg: avg("l15_fg3m_avg"),
    l15StlAvg: avg("l15_stl_avg"),
    l15BlkAvg: avg("l15_blk_avg"),
    l15TovAvg: avg("l15_tov_avg"),
    l15PraAvg: avg("l15_pra_avg"),
    l15PrAvg: avg("l15_pr_avg"),
    l15PaAvg: avg("l15_pa_avg"),
    l15RaAvg: avg("l15_ra_avg"),
    l15BsAvg: avg("l15_bs_avg"),
    l15PtsRank: rank("l15_pts_rank"),
    l15RebRank: rank("l15_reb_rank"),
    l15AstRank: rank("l15_ast_rank"),
    l15Fg3mRank: rank("l15_fg3m_rank"),
    l15StlRank: rank("l15_stl_rank"),
    l15BlkRank: rank("l15_blk_rank"),
    l15TovRank: rank("l15_tov_rank"),
    l15PraRank: rank("l15_pra_rank"),
    l15PrRank: rank("l15_pr_rank"),
    l15PaRank: rank("l15_pa_rank"),
    l15RaRank: rank("l15_ra_rank"),
    l15BsRank: rank("l15_bs_rank"),

    l20PtsAvg: avg("l20_pts_avg"),
    l20RebAvg: avg("l20_reb_avg"),
    l20AstAvg: avg("l20_ast_avg"),
    l20Fg3mAvg: avg("l20_fg3m_avg"),
    l20StlAvg: avg("l20_stl_avg"),
    l20BlkAvg: avg("l20_blk_avg"),
    l20TovAvg: avg("l20_tov_avg"),
    l20PraAvg: avg("l20_pra_avg"),
    l20PrAvg: avg("l20_pr_avg"),
    l20PaAvg: avg("l20_pa_avg"),
    l20RaAvg: avg("l20_ra_avg"),
    l20BsAvg: avg("l20_bs_avg"),
    l20PtsRank: rank("l20_pts_rank"),
    l20RebRank: rank("l20_reb_rank"),
    l20AstRank: rank("l20_ast_rank"),
    l20Fg3mRank: rank("l20_fg3m_rank"),
    l20StlRank: rank("l20_stl_rank"),
    l20BlkRank: rank("l20_blk_rank"),
    l20TovRank: rank("l20_tov_rank"),
    l20PraRank: rank("l20_pra_rank"),
    l20PrRank: rank("l20_pr_rank"),
    l20PaRank: rank("l20_pa_rank"),
    l20RaRank: rank("l20_ra_rank"),
    l20BsRank: rank("l20_bs_rank"),

    minPts: minMax.pts.min,
    maxPts: minMax.pts.max,
    minReb: minMax.reb.min,
    maxReb: minMax.reb.max,
    minAst: minMax.ast.min,
    maxAst: minMax.ast.max,
    minFg3m: minMax.fg3m.min,
    maxFg3m: minMax.fg3m.max,
    minStl: minMax.stl.min,
    maxStl: minMax.stl.max,
    minBlk: minMax.blk.min,
    maxBlk: minMax.blk.max,
    minTov: minMax.tov.min,
    maxTov: minMax.tov.max,
    minPra: minMax.pra.min,
    maxPra: minMax.pra.max,
    minPr: minMax.pr.min,
    maxPr: minMax.pr.max,
    minPa: minMax.pa.min,
    maxPa: minMax.pa.max,
    minRa: minMax.ra.min,
    maxRa: minMax.ra.max,
    minBs: minMax.bs.min,
    maxBs: minMax.bs.max,
    minFga: minMax.fga.min,
    maxFga: minMax.fga.max,
    minFgPct: minMax.fgPct.min,
    maxFgPct: minMax.fgPct.max,
    minFg3Pct: minMax.fg3Pct.min,
    maxFg3Pct: minMax.fg3Pct.max,
    minFta: minMax.fta.min,
    maxFta: minMax.fta.max,
    minMinutes: minMax.minutes.min,
    maxMinutes: minMax.minutes.max,
  };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      position: searchParams.get("position") || "G",
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { position, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("wnba_team_defense_by_position")
      .select("*")
      .eq("season", season)
      .eq("position", position)
      .order("team_abbr", { ascending: true });

    if (error) {
      console.error("[WNBA DvP Rankings] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch WNBA DvP rankings", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = (data ?? []) as WnbaDefenseRow[];
    const minMax = {
      pts: getMinMax(rows, "pts_avg"),
      reb: getMinMax(rows, "reb_avg"),
      ast: getMinMax(rows, "ast_avg"),
      fg3m: getMinMax(rows, "fg3m_avg"),
      stl: getMinMax(rows, "stl_avg"),
      blk: getMinMax(rows, "blk_avg"),
      tov: getMinMax(rows, "tov_avg"),
      pra: getMinMax(rows, "pra_avg"),
      pr: getMinMax(rows, "pr_avg"),
      pa: getMinMax(rows, "pa_avg"),
      ra: getMinMax(rows, "ra_avg"),
      bs: getMinMax(rows, "bs_avg"),
      fga: getMinMax(rows, "fga_avg"),
      fgPct: getMinMax(rows, "fg_pct"),
      fg3Pct: getMinMax(rows, "fg3_pct"),
      fta: getMinMax(rows, "fta_avg"),
      minutes: getMinMax(rows, "minutes_avg"),
    };

    const activeTeams = rows.map((row) => buildRanking(row, minMax));
    const expansionTeams =
      season === "2025"
        ? EXPANSION_TEAMS_2026.map((team) =>
            buildRanking(
              {
                team_id: team.teamId,
                team_abbr: team.teamAbbr,
                team_name: team.teamName,
                position,
                season,
                games: 0,
              },
              minMax,
              { reason: team.inactiveReason }
            )
          )
        : [];

    const teams = [...activeTeams, ...expansionTeams];

    const response: DvpRankingsResponse = {
      position,
      season,
      teams,
      meta: {
        totalTeams: activeTeams.length,
        updatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/dvp-rankings] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
