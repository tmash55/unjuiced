import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  opponentTeamId: z.coerce.number().int().positive(),
  position: z.string().min(1),
  markets: z.string().optional(), // Comma-separated list of markets
});

// Response structure for a single market's matchup rank
export interface MarketMatchupRank {
  market: string;
  rank: number | null;
  avgAllowed: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable" | null;
}

export interface MatchupRanksResponse {
  playerId: number;
  opponentTeamId: number;
  position: string;
  markets: MarketMatchupRank[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      opponentTeamId: searchParams.get("opponentTeamId"),
      position: searchParams.get("position"),
      markets: searchParams.get("markets"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, opponentTeamId, position, markets } = parsed.data;
    
    // Parse markets list (default to common markets if not provided)
    const marketsList = markets
      ? markets.split(",").map(m => m.trim())
      : [
          "player_points",
          "player_assists",
          "player_rebounds",
          "player_threes_made",
          "player_blocks",
          "player_steals",
          "player_points_rebounds_assists",
          "player_points_rebounds",
          "player_points_assists",
          "player_rebounds_assists",
          "player_blocks_steals",
        ];

    const supabase = createServerSupabaseClient();

    // Create arrays for batch RPC call
    const playerIds = marketsList.map(() => playerId);
    const opponentTeamIds = marketsList.map(() => opponentTeamId);

    // Call the RPC function to get matchup ranks
    const { data: matchups, error } = await supabase.rpc("get_matchup_ranks_batch", {
      p_player_ids: playerIds,
      p_markets: marketsList,
      p_opponent_team_ids: opponentTeamIds,
    });

    if (error) {
      console.error("[Matchup Ranks] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch matchup ranks", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Map results to response format
    const marketRanks: MarketMatchupRank[] = marketsList.map((market) => {
      const matchup = matchups?.find((m: any) => 
        m.player_id === playerId && 
        m.market === market && 
        m.opponent_team_id === opponentTeamId
      );

      return {
        market,
        rank: matchup?.matchup_rank ?? null,
        avgAllowed: matchup?.avg_allowed ?? null,
        matchupQuality: matchup?.matchup_quality ?? null,
      };
    });

    const response: MatchupRanksResponse = {
      playerId,
      opponentTeamId,
      position,
      markets: marketRanks,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/matchup-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

