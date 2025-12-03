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
  minMinutes: z.coerce.number().int().min(0).nullish().transform(v => v ?? 0),
});

// RPC response structure
interface RpcRecentGame {
  player_id: number;
  player_name: string;
  team_abbr: string;
  position: string; // Player's actual position from depth_chart_pos
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
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string; // Player's actual position
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
      minMinutes: searchParams.get("minMinutes"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { position, opponentTeamId, market, season, limit, minMinutes } = parsed.data;

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

    // Map recent games to frontend format and filter by minMinutes
    const players: PositionVsTeamPlayer[] = (data.recent_games || [])
      .filter((game) => game.minutes >= minMinutes)
      .map((game) => ({
        playerId: game.player_id,
        playerName: game.player_name,
        teamAbbr: game.team_abbr,
        position: game.position || position, // Use player's actual position, fallback to queried
        stat: game.stat,
        gameDate: game.date,
        pts: game.pts,
        reb: game.reb,
        ast: game.ast,
        minutes: game.minutes,
      }));

    // Recalculate stats based on filtered players
    const stats = players.map(p => p.stat);
    const avgStat = stats.length > 0 ? stats.reduce((a, b) => a + b, 0) / stats.length : 0;
    const minStat = stats.length > 0 ? Math.min(...stats) : 0;
    const maxStat = stats.length > 0 ? Math.max(...stats) : 0;
    const uniquePlayerIds = new Set(players.map(p => p.playerId));

    const response: PositionVsTeamResponse = {
      players,
      avgStat: avgStat,
      minStat: minStat,
      maxStat: maxStat,
      avgPoints: players.length > 0 ? players.reduce((a, b) => a + b.pts, 0) / players.length : 0,
      avgRebounds: players.length > 0 ? players.reduce((a, b) => a + b.reb, 0) / players.length : 0,
      avgAssists: players.length > 0 ? players.reduce((a, b) => a + b.ast, 0) / players.length : 0,
      totalGames: players.length,
      playerCount: uniquePlayerIds.size,
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

