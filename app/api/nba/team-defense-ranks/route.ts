import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  opponentTeamId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
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
}

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      opponentTeamId: searchParams.get("opponentTeamId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      console.error("[Team Defense Ranks] Validation error:", parsed.error);
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { opponentTeamId, season } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Fetch defense data for all positions at once using the all-positions RPC function
    const { data: defenseData, error } = await supabase.rpc("get_team_defense_all_positions", {
      p_team_id: opponentTeamId,
      p_season: season,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch team defense ranks", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Map the RPC results to our market structure
    const positionData: TeamDefenseRanksResponse["positions"] = {};

    defenseData?.forEach((data: any) => {
      const position = data.def_position;
      
      if (!position) return;

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
          rank: null, // Not available in this RPC
          avgAllowed: null,
        },
        player_points_rebounds_assists: {
          rank: data.pra_rank,
          avgAllowed: data.pra_avg,
        },
        player_points_rebounds: {
          rank: null, // Not available in this RPC
          avgAllowed: null,
        },
        player_points_assists: {
          rank: null, // Not available in this RPC
          avgAllowed: null,
        },
        player_rebounds_assists: {
          rank: null, // Not available in this RPC
          avgAllowed: null,
        },
        player_blocks_steals: {
          rank: null, // Not available in this RPC
          avgAllowed: null,
        },
      };
    });

    const response: TeamDefenseRanksResponse = {
      opponentTeamId,
      positions: positionData,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/team-defense-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

