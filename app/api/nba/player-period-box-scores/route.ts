import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeBasketballSeasonType } from "@/lib/basketball/pace-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  period: z.coerce.number().int().min(1).max(4).nullish().transform((v) => v ?? 1),
  season: z.string().nullish().transform((v) => v ?? "2025-26"),
  limit: z.coerce.number().int().min(1).max(150).nullish().transform((v) => v ?? 100),
});

interface PeriodRow {
  game_id: number | string;
  player_id: number;
  team_id: number | null;
  opponent_team_id: number | null;
  home_away: "H" | "A" | null;
  period: number;
  game_date: string | null;
  season: string | null;
  season_type: string | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fouls: number | null;
  minutes: number | string | null;
  seconds_played: number | null;
  is_starter: boolean | null;
  fgm: number | null;
  fga: number | null;
  fg3m: number | null;
  fg3a: number | null;
  ftm: number | null;
  fta: number | null;
  oreb: number | null;
  dreb: number | null;
  plus_minus: number | null;
}

interface GameRow {
  game_id: number | string;
  game_date: string | null;
  season_type: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_team_tricode: string | null;
  away_team_tricode: string | null;
  home_team_score: number | null;
  away_team_score: number | null;
}

interface TeamRow {
  team_id: number;
  name: string | null;
  abbreviation: string | null;
}

export interface PlayerPeriodBoxScoresResponse {
  period: number;
  season: string;
  games: BoxScoreGame[];
}

function percent(made: number | null, attempted: number | null): number {
  return attempted ? (made ?? 0) / attempted : 0;
}

function parsePeriodMinutes(minutes: number | string | null, secondsPlayed: number | null): number {
  if (typeof secondsPlayed === "number" && Number.isFinite(secondsPlayed)) {
    return secondsPlayed / 60;
  }

  if (typeof minutes === "number" && Number.isFinite(minutes)) {
    return minutes;
  }

  if (typeof minutes === "string") {
    const [rawMinutes, rawSeconds] = minutes.split(":");
    const parsedMinutes = Number(rawMinutes);
    const parsedSeconds = Number(rawSeconds ?? 0);
    if (Number.isFinite(parsedMinutes) && Number.isFinite(parsedSeconds)) {
      return parsedMinutes + parsedSeconds / 60;
    }

    const numericMinutes = Number(minutes);
    if (Number.isFinite(numericMinutes)) {
      return numericMinutes;
    }
  }

  return 0;
}

function getTeamScore(row: PeriodRow, game?: GameRow): { teamScore: number; opponentScore: number } {
  if (!game) return { teamScore: 0, opponentScore: 0 };

  if (row.team_id && row.team_id === game.home_team_id) {
    return {
      teamScore: game.home_team_score ?? 0,
      opponentScore: game.away_team_score ?? 0,
    };
  }

  if (row.team_id && row.team_id === game.away_team_id) {
    return {
      teamScore: game.away_team_score ?? 0,
      opponentScore: game.home_team_score ?? 0,
    };
  }

  return row.home_away === "A"
    ? { teamScore: game.away_team_score ?? 0, opponentScore: game.home_team_score ?? 0 }
    : { teamScore: game.home_team_score ?? 0, opponentScore: game.away_team_score ?? 0 };
}

function getOpponent(row: PeriodRow, game?: GameRow, teamsById?: Map<number, TeamRow>) {
  const opponentFromTeams = row.opponent_team_id ? teamsById?.get(row.opponent_team_id) : null;

  if (game && row.opponent_team_id === game.home_team_id) {
    return {
      abbr: game.home_team_tricode ?? opponentFromTeams?.abbreviation ?? "OPP",
      name: game.home_team_name ?? opponentFromTeams?.name ?? "Opponent",
    };
  }

  if (game && row.opponent_team_id === game.away_team_id) {
    return {
      abbr: game.away_team_tricode ?? opponentFromTeams?.abbreviation ?? "OPP",
      name: game.away_team_name ?? opponentFromTeams?.name ?? "Opponent",
    };
  }

  return {
    abbr: opponentFromTeams?.abbreviation ?? "OPP",
    name: opponentFromTeams?.name ?? "Opponent",
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      period: searchParams.get("period"),
      season: searchParams.get("season"),
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, period, season, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data: periodRows, error: periodError } = await supabase
      .from("nba_player_period_box_scores")
      .select(
        "game_id, player_id, team_id, opponent_team_id, home_away, period, game_date, season, season_type, pts, reb, ast, stl, blk, tov, fouls, minutes, seconds_played, is_starter, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, plus_minus"
      )
      .eq("player_id", playerId)
      .eq("period", period)
      .eq("season", season)
      .order("game_date", { ascending: false })
      .limit(limit);

    if (periodError) {
      console.error("[NBA Player Period Box Scores] period query error:", periodError.message);
      return NextResponse.json(
        { error: "Failed to fetch period box scores", details: periodError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = (periodRows ?? []) as PeriodRow[];
    if (rows.length === 0) {
      return NextResponse.json(
        { period, season, games: [] } satisfies PlayerPeriodBoxScoresResponse,
        { headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    const gameIds = [...new Set(rows.map((r) => Number(r.game_id)).filter((id) => Number.isFinite(id)))];
    const teamIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.team_id, r.opponent_team_id])
          .filter((id): id is number => typeof id === "number")
      ),
    ];

    const [{ data: gameRows, error: gameError }, { data: teamRows, error: teamError }] =
      await Promise.all([
        supabase
          .from("nba_games_hr")
          .select(
            "game_id, game_date, season_type, home_team_id, away_team_id, home_team_name, away_team_name, home_team_tricode, away_team_tricode, home_team_score, away_team_score"
          )
          .in("game_id", gameIds),
        supabase.from("nba_teams").select("team_id, name, abbreviation").in("team_id", teamIds),
      ]);

    if (gameError) {
      console.error("[NBA Player Period Box Scores] game context query error:", gameError.message);
    }

    if (teamError) {
      console.error("[NBA Player Period Box Scores] team context query error:", teamError.message);
    }

    const gamesById = new Map<string, GameRow>();
    for (const game of (gameRows ?? []) as GameRow[]) {
      gamesById.set(String(game.game_id), game);
    }

    const teamsById = new Map<number, TeamRow>();
    for (const team of (teamRows ?? []) as TeamRow[]) {
      teamsById.set(Number(team.team_id), team);
    }

    const games: BoxScoreGame[] = rows.map((row) => {
      const game = gamesById.get(String(row.game_id));
      const gameDate = row.game_date ?? game?.game_date ?? "";
      const scores = getTeamScore(row, game);
      const margin = scores.teamScore - scores.opponentScore;
      const opponent = getOpponent(row, game, teamsById);

      return {
        gameId: String(row.game_id),
        date: gameDate,
        seasonType: normalizeBasketballSeasonType(row.season_type ?? game?.season_type ?? "regular", "nba", gameDate),
        homeAway: row.home_away ?? "H",
        isStarter: row.is_starter,
        opponentTeamId: row.opponent_team_id ?? 0,
        opponentAbbr: opponent.abbr,
        opponentName: opponent.name,
        result: margin >= 0 ? "W" : "L",
        margin,
        teamScore: scores.teamScore,
        opponentScore: scores.opponentScore,
        minutes: parsePeriodMinutes(row.minutes, row.seconds_played),
        pts: row.pts ?? 0,
        reb: row.reb ?? 0,
        ast: row.ast ?? 0,
        stl: row.stl ?? 0,
        blk: row.blk ?? 0,
        tov: row.tov ?? 0,
        fouls: row.fouls ?? 0,
        fgm: row.fgm ?? 0,
        fga: row.fga ?? 0,
        fgPct: percent(row.fgm, row.fga),
        fg3m: row.fg3m ?? 0,
        fg3a: row.fg3a ?? 0,
        fg3Pct: percent(row.fg3m, row.fg3a),
        ftm: row.ftm ?? 0,
        fta: row.fta ?? 0,
        ftPct: percent(row.ftm, row.fta),
        oreb: row.oreb ?? 0,
        dreb: row.dreb ?? 0,
        plusMinus: row.plus_minus ?? 0,
        usagePct: 0,
        tsPct: 0,
        efgPct: 0,
        offRating: 0,
        defRating: 0,
        netRating: 0,
        pace: 0,
        pie: 0,
        passes: 0,
        potentialReb: 0,
        potentialAssists: null,
        pra: (row.pts ?? 0) + (row.reb ?? 0) + (row.ast ?? 0),
        pr: (row.pts ?? 0) + (row.reb ?? 0),
        pa: (row.pts ?? 0) + (row.ast ?? 0),
        ra: (row.reb ?? 0) + (row.ast ?? 0),
        bs: (row.blk ?? 0) + (row.stl ?? 0),
      };
    });

    games.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(
      { period, season, games } satisfies PlayerPeriodBoxScoresResponse,
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("[/api/nba/player-period-box-scores] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
