import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  position: z.string().min(1),
  opponentTeamId: z.coerce.number().int().positive(),
  market: z.string().min(1),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
  limit: z.coerce.number().int().min(1).max(100).nullish().transform(v => v ?? 50),
});

// RPC response structure
interface RpcRecentGame {
  player_name: string;
  team_abbr: string;
  date: string;
  stat: number;
  pts: number;
  reb: number;
  ast: number;
  minutes: number;
}

interface RpcResponse {
  total_games: number;
  player_count: number;
  avg_stat: number;
  min_stat: number;
  max_stat: number;
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  recent_games: RpcRecentGame[] | null;
}

// Frontend response structure
interface PositionVsTeamPlayer {
  playerName: string;
  teamAbbr: string;
  stat: number;
  gameDate: string;
  pts: number;
  reb: number;
  ast: number;
  minutes: number;
}

interface PositionVsTeamResponse {
  players: PositionVsTeamPlayer[];
  avgStat: number;
  minStat: number;
  maxStat: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  totalGames: number;
  playerCount: number;
  position: string;
  opponentTeamAbbr: string;
  market: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      position: searchParams.get("position"),
      opponentTeamId: searchParams.get("opponentTeamId"),
      market: searchParams.get("market"),
      season: searchParams.get("season"),
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { position, opponentTeamId, market, season, limit } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Get opponent team abbreviation
    const { data: opponentTeam } = await supabase
      .from("nba_teams")
      .select("abbreviation")
      .eq("team_id", opponentTeamId)
      .single();

    const opponentTeamAbbr = opponentTeam?.abbreviation || "UNK";

    // Call the RPC function
    const { data: rpcResult, error } = await supabase.rpc("get_positional_matchup_stats", {
      p_position: position,
      p_opponent_team_id: opponentTeamId,
      p_market: market,
      p_season: season,
      p_limit: limit,
    });

    if (error) {
      console.error("[Position vs Team] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch position vs team data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Handle null result (no data)
    if (!rpcResult) {
      return NextResponse.json({
        players: [],
        avgStat: 0,
        minStat: 0,
        maxStat: 0,
        avgPoints: 0,
        avgRebounds: 0,
        avgAssists: 0,
        totalGames: 0,
        playerCount: 0,
        position,
        opponentTeamAbbr,
        market,
      });
    }

    const data = rpcResult as RpcResponse;

    // Map recent games to frontend format
    const players: PositionVsTeamPlayer[] = (data.recent_games || []).map((game) => ({
      playerName: game.player_name,
      teamAbbr: game.team_abbr,
      stat: game.stat,
      gameDate: game.date,
      pts: game.pts,
      reb: game.reb,
      ast: game.ast,
      minutes: game.minutes,
    }));

    const response: PositionVsTeamResponse = {
      players,
      avgStat: data.avg_stat ?? 0,
      minStat: data.min_stat ?? 0,
      maxStat: data.max_stat ?? 0,
      avgPoints: data.avg_points ?? 0,
      avgRebounds: data.avg_rebounds ?? 0,
      avgAssists: data.avg_assists ?? 0,
      totalGames: data.total_games ?? 0,
      playerCount: data.player_count ?? 0,
      position,
      opponentTeamAbbr,
      market,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/position-vs-team] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

