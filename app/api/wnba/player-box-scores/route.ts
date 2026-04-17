import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * WNBA Player Box Scores API
 *
 * Mirrors /api/nba/player-box-scores. Calls get_wnba_player_box_scores RPC,
 * which is expected to return player info, a season summary, and a list of
 * games (most recent first). For "rolling L10" behavior, callers can pass
 * season = null so the RPC returns the most recent games across seasons.
 *
 * WNBA seasons are single calendar years ("2025", "2026") unlike NBA's
 * "2025-26" format.
 */

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  season: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(150).nullish().transform(v => v ?? 100),
});

interface RpcPlayerInfo {
  player_id: number;
  name: string;
  first_name: string;
  last_name: string;
  position: string;
  jersey_number: number | null;
  team_id: number;
  team_abbr: string;
  team_name: string;
  injury_status: string | null;
  injury_notes: string | null;
}

interface RpcSeasonSummary {
  games_played: number;
  record: string;
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  avg_steals: number;
  avg_blocks: number;
  avg_threes: number;
  avg_minutes: number;
  avg_pra: number;
  avg_usage: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
}

interface RpcGame {
  game_id: string;
  date: string;
  season_type: string;
  home_away: "H" | "A";
  opponent_team_id: number;
  opponent_abbr: string;
  opponent_name: string;
  result: "W" | "L";
  margin: number;
  team_score: number;
  opponent_score: number;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  plus_minus: number;
  usage_pct: number;
  ts_pct: number;
  efg_pct: number;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  pace: number;
  pie: number;
  passes: number;
  potential_reb: number;
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
}

interface RpcResponse {
  player: RpcPlayerInfo;
  season: string;
  season_summary: RpcSeasonSummary;
  games: RpcGame[];
}

export interface PlayerInfo {
  playerId: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number | null;
  teamId: number;
  teamAbbr: string;
  teamName: string;
  injuryStatus: string | null;
  injuryNotes: string | null;
}

export interface SeasonSummary {
  gamesPlayed: number;
  record: string;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgThrees: number;
  avgMinutes: number;
  avgPra: number;
  avgUsage: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
}

export interface BoxScoreGame {
  gameId: string;
  date: string;
  seasonType: string;
  homeAway: "H" | "A";
  opponentTeamId: number;
  opponentAbbr: string;
  opponentName: string;
  result: "W" | "L";
  margin: number;
  teamScore: number;
  opponentScore: number;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  oreb: number;
  dreb: number;
  plusMinus: number;
  usagePct: number;
  tsPct: number;
  efgPct: number;
  offRating: number;
  defRating: number;
  netRating: number;
  pace: number;
  pie: number;
  passes: number;
  potentialReb: number;
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
}

export interface PlayerBoxScoresResponse {
  player: PlayerInfo | null;
  season: string;
  seasonSummary: SeasonSummary | null;
  games: BoxScoreGame[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      season: searchParams.get("season"),
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, season, limit } = parsed.data;

    const supabase = createServerSupabaseClient();

    const { data: rpcResult, error } = await supabase.rpc("get_wnba_player_box_scores", {
      p_player_id: playerId,
      p_season: season ?? null,
      p_limit: limit,
    });

    if (error) {
      console.error("[WNBA Player Box Scores] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch box scores", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!rpcResult) {
      return NextResponse.json({
        player: null,
        season: season ?? "",
        seasonSummary: null,
        games: [],
      });
    }

    const data = rpcResult as RpcResponse;

    const player: PlayerInfo | null = data.player ? {
      playerId: data.player.player_id,
      name: data.player.name,
      firstName: data.player.first_name,
      lastName: data.player.last_name,
      position: data.player.position,
      jerseyNumber: data.player.jersey_number,
      teamId: data.player.team_id,
      teamAbbr: data.player.team_abbr,
      teamName: data.player.team_name,
      injuryStatus: data.player.injury_status,
      injuryNotes: data.player.injury_notes,
    } : null;

    const seasonSummary: SeasonSummary | null = data.season_summary ? {
      gamesPlayed: data.season_summary.games_played,
      record: data.season_summary.record,
      avgPoints: data.season_summary.avg_points,
      avgRebounds: data.season_summary.avg_rebounds,
      avgAssists: data.season_summary.avg_assists,
      avgSteals: data.season_summary.avg_steals,
      avgBlocks: data.season_summary.avg_blocks,
      avgThrees: data.season_summary.avg_threes,
      avgMinutes: data.season_summary.avg_minutes,
      avgPra: data.season_summary.avg_pra,
      avgUsage: data.season_summary.avg_usage,
      fgPct: data.season_summary.fg_pct,
      fg3Pct: data.season_summary.fg3_pct,
      ftPct: data.season_summary.ft_pct,
    } : null;

    const games: BoxScoreGame[] = (data.games || []).map((g) => ({
      gameId: g.game_id,
      date: g.date,
      seasonType: g.season_type,
      homeAway: g.home_away,
      opponentTeamId: g.opponent_team_id,
      opponentAbbr: g.opponent_abbr,
      opponentName: g.opponent_name,
      result: g.result,
      margin: g.margin,
      teamScore: g.team_score,
      opponentScore: g.opponent_score,
      minutes: g.minutes,
      pts: g.pts,
      reb: g.reb,
      ast: g.ast,
      stl: g.stl,
      blk: g.blk,
      tov: g.tov,
      fouls: g.fouls,
      fgm: g.fgm,
      fga: g.fga,
      fgPct: g.fg_pct,
      fg3m: g.fg3m,
      fg3a: g.fg3a,
      fg3Pct: g.fg3_pct,
      ftm: g.ftm,
      fta: g.fta,
      ftPct: g.ft_pct,
      oreb: g.oreb,
      dreb: g.dreb,
      plusMinus: g.plus_minus,
      usagePct: g.usage_pct,
      tsPct: g.ts_pct,
      efgPct: g.efg_pct,
      offRating: g.off_rating,
      defRating: g.def_rating,
      netRating: g.net_rating,
      pace: g.pace,
      pie: g.pie,
      passes: g.passes,
      potentialReb: g.potential_reb,
      pra: g.pra,
      pr: g.pr,
      pa: g.pa,
      ra: g.ra,
      bs: g.bs,
    }));

    const response: PlayerBoxScoresResponse = {
      player,
      season: data.season || season || "",
      seasonSummary,
      games,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/player-box-scores] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
