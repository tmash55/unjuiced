import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const QuerySchema = z.object({
  position: z.string().min(1),
  opponentTeamId: z.coerce.number().int().positive(),
  market: z.string().min(1),
  season: z.string().nullish().transform((v) => v ?? "2025"),
  limit: z.coerce.number().int().min(1).max(100).nullish().transform((v) => v ?? 50),
  minMinutes: z.coerce.number().int().min(0).nullish().transform((v) => v ?? 0),
});

interface RpcRecentGame {
  player_id: number;
  player_name: string;
  team_abbr: string;
  position: string;
  date: string;
  stat: number;
  closing_line: number | null;
  closing_price_over: number | null;
  closing_price_under: number | null;
  hit_over: boolean | null;
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
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
  avg_closing_line: number | null;
  games_with_lines: number;
  over_hit_count: number;
  under_hit_count: number;
  push_count: number;
  over_hit_rate: number | null;
  recent_games: RpcRecentGame[] | null;
}

interface PositionVsTeamPlayer {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string;
  stat: number;
  closingLine: number | null;
  closingPriceOver: number | null;
  closingPriceUnder: number | null;
  hitOver: boolean | null;
  gameDate: string;
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
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
  avgClosingLine: number | null;
  gamesWithLines: number;
  overHitCount: number;
  underHitCount: number;
  pushCount: number;
  overHitRate: number | null;
  totalGames: number;
  playerCount: number;
  position: string;
  opponentTeamAbbr: string;
  market: string;
  season: string;
}

function normalizeWnbaPosition(position: string) {
  const upper = position.toUpperCase();
  if (upper === "C") return "C";
  if (upper === "F" || upper === "SF" || upper === "PF") return "F";
  return "G";
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
    const normalizedPosition = normalizeWnbaPosition(position);
    const supabase = createServerSupabaseClient();

    const { data: opponentTeam } = await supabase
      .from("wnba_teams")
      .select("abbreviation")
      .eq("team_id", opponentTeamId)
      .single();

    const opponentTeamAbbr = opponentTeam?.abbreviation || "UNK";

    const { data: rpcResult, error } = await supabase.rpc("get_wnba_positional_matchup_stats", {
      p_position: normalizedPosition,
      p_opponent_team_id: opponentTeamId,
      p_market: market,
      p_season: season,
      p_limit: limit,
    });

    if (error) {
      console.error("[WNBA Position vs Team] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch WNBA position vs team data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = (rpcResult || {}) as RpcResponse;
    const players: PositionVsTeamPlayer[] = (data.recent_games || [])
      .filter((game) => game.minutes >= minMinutes)
      .map((game) => ({
        playerId: game.player_id,
        playerName: game.player_name,
        teamAbbr: game.team_abbr,
        position: game.position || normalizedPosition,
        stat: game.stat,
        closingLine: game.closing_line,
        closingPriceOver: game.closing_price_over,
        closingPriceUnder: game.closing_price_under,
        hitOver: game.hit_over,
        gameDate: game.date,
        pts: game.pts,
        reb: game.reb,
        ast: game.ast,
        fg3m: game.fg3m,
        stl: game.stl,
        blk: game.blk,
        tov: game.tov,
        fgm: game.fgm,
        fga: game.fga,
        minutes: game.minutes,
      }));

    const stats = players.map((p) => p.stat);
    const avgStat = stats.length > 0 ? stats.reduce((a, b) => a + b, 0) / stats.length : 0;
    const minStat = stats.length > 0 ? Math.min(...stats) : 0;
    const maxStat = stats.length > 0 ? Math.max(...stats) : 0;
    const uniquePlayerIds = new Set(players.map((p) => p.playerId));

    const playersWithLines = players.filter((p) => p.closingLine !== null);
    const overHits = playersWithLines.filter((p) => p.hitOver === true).length;
    const underHits = playersWithLines.filter((p) => p.hitOver === false).length;
    const pushes = playersWithLines.filter((p) => p.hitOver === null && p.closingLine !== null).length;

    const response: PositionVsTeamResponse = {
      players,
      avgStat,
      minStat,
      maxStat,
      avgPoints: players.length > 0 ? players.reduce((a, b) => a + b.pts, 0) / players.length : 0,
      avgRebounds: players.length > 0 ? players.reduce((a, b) => a + b.reb, 0) / players.length : 0,
      avgAssists: players.length > 0 ? players.reduce((a, b) => a + b.ast, 0) / players.length : 0,
      avgClosingLine: playersWithLines.length > 0
        ? playersWithLines.reduce((a, b) => a + (b.closingLine ?? 0), 0) / playersWithLines.length
        : null,
      gamesWithLines: playersWithLines.length,
      overHitCount: overHits,
      underHitCount: underHits,
      pushCount: pushes,
      overHitRate: playersWithLines.length > 0 ? Math.round((overHits / playersWithLines.length) * 100) : null,
      totalGames: players.length,
      playerCount: uniquePlayerIds.size,
      position: normalizedPosition,
      opponentTeamAbbr,
      market,
      season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/position-vs-team] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
