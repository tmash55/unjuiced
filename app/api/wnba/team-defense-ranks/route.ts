import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDvpTeamCount } from "@/lib/dvp-rank-scale";
import { z } from "zod";

const QuerySchema = z.object({
  opponentTeamId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform((v) => v ?? "2026"),
});

export interface TeamDefenseRanksResponse {
  opponentTeamId: number;
  positions: {
    [position: string]: {
      [market: string]: {
        rank: number | null;
        avgAllowed: number | null;
      };
    };
  };
  meta: {
    season: string;
    totalTeams: number;
    positionBuckets: string[];
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = QuerySchema.safeParse({
      opponentTeamId: searchParams.get("opponentTeamId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { opponentTeamId, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data: defenseData, error } = await supabase
      .from("wnba_team_defense_by_position")
      .select("*")
      .eq("team_id", opponentTeamId)
      .eq("season", season);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch WNBA team defense ranks", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const positionData: TeamDefenseRanksResponse["positions"] = {};
    let totalTeams = getDvpTeamCount("wnba", season);

    defenseData?.forEach((data: any) => {
      const position = data.position;
      if (!position) return;

      const rowTotalTeams =
        season === "2025" ? 13 : Number(data.total_teams || 0);
      totalTeams = Math.max(
        totalTeams,
        getDvpTeamCount("wnba", season, rowTotalTeams),
      );
      positionData[position] = {
        player_points: {
          rank: data.pts_rank,
          avgAllowed: data.pts_avg,
        },
        player_rebounds: {
          rank: data.reb_rank,
          avgAllowed: data.reb_avg,
        },
        player_assists: {
          rank: data.ast_rank,
          avgAllowed: data.ast_avg,
        },
        player_threes_made: {
          rank: data.fg3m_rank,
          avgAllowed: data.fg3m_avg,
        },
        player_steals: {
          rank: data.stl_rank,
          avgAllowed: data.stl_avg,
        },
        player_blocks: {
          rank: data.blk_rank,
          avgAllowed: data.blk_avg,
        },
        player_turnovers: {
          rank: data.tov_rank,
          avgAllowed: data.tov_avg,
        },
        player_points_rebounds_assists: {
          rank: data.pra_rank,
          avgAllowed: data.pra_avg,
        },
        player_points_rebounds: {
          rank: data.pr_rank,
          avgAllowed: data.pr_avg,
        },
        player_points_assists: {
          rank: data.pa_rank,
          avgAllowed: data.pa_avg,
        },
        player_rebounds_assists: {
          rank: data.ra_rank,
          avgAllowed: data.ra_avg,
        },
        player_blocks_steals: {
          rank: data.bs_rank,
          avgAllowed: data.bs_avg,
        },
      };
    });

    const response: TeamDefenseRanksResponse = {
      opponentTeamId,
      positions: positionData,
      meta: {
        season,
        totalTeams,
        positionBuckets: Object.keys(positionData),
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/team-defense-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
