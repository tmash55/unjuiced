import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

const PITCHER_MARKETS = new Set([
  "pitcher_strikeouts",
  "player_strikeouts",
  "pitcher_hits_allowed",
  "player_hits_allowed",
  "pitcher_earned_runs",
  "player_earned_runs",
  "pitcher_outs",
  "player_outs",
  "pitcher_outs_recorded",
  "pitcher_walks",
  "pitcher_walks_allowed",
  "player_walks_allowed",
]);

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  market: z.string().min(1),
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(5).max(200).optional(),
  includePrior: z
    .preprocess((value) => {
      if (value === "false") return false;
      if (value === "true") return true;
      return value;
    }, z.boolean())
    .optional(),
});

type LogType = "batter" | "pitcher";

interface MlbDrilldownLogEntry {
  gameId: string;
  date: string;
  season: number;
  gameDatetime?: string | null;
  dayNight?: "D" | "N" | null;
  homeAway: "H" | "A";
  opponentAbbr: string;
  opponentName: string;
  result: "W" | "L";
  teamScore: number | null;
  opponentScore: number | null;
  marketValue: number;
  atBats?: number;
  plateAppearances?: number;
  hits?: number;
  homeRuns?: number;
  runs?: number;
  rbi?: number;
  totalBases?: number;
  walks?: number;
  strikeOuts?: number;
  battingAvg?: number | null;
  obp?: number | null;
  slg?: number | null;
  battingHand?: string | null;
  lineupPosition?: number | null;
  inningsPitched?: number | null;
  hitsAllowed?: number;
  earnedRuns?: number;
  eraGame?: number | null;
  whipGame?: number | null;
}

interface MlbGameMeta {
  gameDatetime: string | null;
}

function normalizeResult(result: string | null | undefined): "W" | "L" {
  return result === "W" ? "W" : "L";
}

function getCurrentEtYear(): number {
  const now = new Date();
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(now)
  );
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDayNightFromGameDatetime(gameDatetime: string | null | undefined): "D" | "N" | null {
  if (!gameDatetime) return null;
  const parsed = new Date(gameDatetime);
  if (Number.isNaN(parsed.getTime())) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    }).format(parsed)
  );
  if (!Number.isFinite(hour)) return null;
  return hour < 17 ? "D" : "N";
}

async function fetchGameMetaById(supabase: ReturnType<typeof createServerSupabaseClient>, rows: any[]) {
  const gameIds = Array.from(
    new Set(
      rows
        .map((row) => row.game_id)
        .filter((gameId) => gameId !== null && gameId !== undefined)
        .map(String)
    )
  );
  if (gameIds.length === 0) return new Map<string, MlbGameMeta>();

  const { data, error } = await supabase
    .from("mlb_games")
    .select("game_id, game_datetime")
    .in("game_id", gameIds);

  if (error) {
    console.warn("[mlb/player-game-logs] Unable to fetch game timing metadata", error.message);
    return new Map<string, MlbGameMeta>();
  }

  return new Map(
    (data || []).map((row: any) => [
      String(row.game_id),
      { gameDatetime: row.game_datetime ?? null },
    ])
  );
}

function mapBatterRows(rows: any[], market: string, gameMetaById = new Map<string, MlbGameMeta>()): { entries: MlbDrilldownLogEntry[]; games: BoxScoreGame[] } {
  const entries: MlbDrilldownLogEntry[] = rows.map((row) => {
    const marketValue =
      market === "player_hits"
        ? row.hits
        : market === "player_home_runs"
        ? row.home_runs
        : market === "player_runs_scored"
        ? row.runs
        : market === "player_rbi"
        || market === "player_rbis"
        ? row.rbi
        : market === "player_total_bases"
        ? row.total_bases
        : market === "player_hits__runs__rbis"
        ? Number(row.hits ?? 0) + Number(row.runs ?? 0) + Number(row.rbi ?? 0)
        : row.hits;

    const rawBattingHand = row.batting_hand ?? row.bats ?? row.batter_hand ?? null;
    const battingHand =
      typeof rawBattingHand === "string"
        ? rawBattingHand.trim().toUpperCase().slice(0, 1)
        : null;
    const lineupRaw = row.lineup_position ?? row.batting_order ?? row.lineup_slot ?? null;
    const lineupPosition = lineupRaw !== null && lineupRaw !== undefined ? Number(lineupRaw) : null;
    const gameMeta = gameMetaById.get(String(row.game_id));
    const gameDatetime = row.game_datetime ?? row.start_time ?? gameMeta?.gameDatetime ?? null;
    const dayNightRaw = typeof row.day_night === "string" ? row.day_night.trim().toUpperCase().slice(0, 1) : null;
    const dayNight = dayNightRaw === "D" || dayNightRaw === "N" ? dayNightRaw : getDayNightFromGameDatetime(gameDatetime);

    return {
      gameId: String(row.game_id),
      date: row.official_date,
      season: row.season,
      gameDatetime,
      dayNight,
      homeAway: row.is_home ? "H" : "A",
      opponentAbbr: row.opponent_abbr || "OPP",
      opponentName: row.opponent_name || "Opponent",
      result: normalizeResult(row.game_result),
      teamScore: row.team_score ?? null,
      opponentScore: row.opponent_score ?? null,
      marketValue: Number(marketValue ?? 0),
      atBats: row.at_bats,
      plateAppearances: row.plate_appearances,
      hits: row.hits,
      homeRuns: row.home_runs,
      runs: row.runs,
      rbi: row.rbi,
      totalBases: row.total_bases,
      walks: row.base_on_balls,
      strikeOuts: row.strike_outs,
      battingAvg: toNumeric(row.batting_avg),
      obp: toNumeric(row.obp),
      slg: toNumeric(row.slg),
      battingHand: battingHand && ["L", "R", "S"].includes(battingHand) ? battingHand : null,
      lineupPosition: Number.isInteger(lineupPosition) && (lineupPosition as number) > 0 ? lineupPosition : null,
    };
  });

  const games: BoxScoreGame[] = entries.map((entry) => {
    const margin =
      entry.teamScore !== null && entry.opponentScore !== null
        ? entry.teamScore - entry.opponentScore
        : 0;

    return {
      gameId: entry.gameId,
      date: entry.date,
      seasonType: "R",
      homeAway: entry.homeAway,
      opponentTeamId: 0,
      opponentAbbr: entry.opponentAbbr,
      opponentName: entry.opponentName,
      result: entry.result,
      margin,
      teamScore: entry.teamScore ?? 0,
      opponentScore: entry.opponentScore ?? 0,
      minutes: entry.plateAppearances ?? 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: entry.strikeOuts ?? 0,
      fouls: 0,
      fgm: 0,
      fga: entry.atBats ?? 0,
      fgPct: 0,
      fg3m: 0,
      fg3a: 0,
      fg3Pct: 0,
      ftm: 0,
      fta: 0,
      ftPct: 0,
      oreb: 0,
      dreb: 0,
      plusMinus: 0,
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
      pra: 0,
      pr: 0,
      pa: 0,
      ra: 0,
      bs: 0,
      mlbHits: entry.hits ?? 0,
      mlbHomeRuns: entry.homeRuns ?? 0,
      mlbRunsScored: entry.runs ?? 0,
      mlbRbi: entry.rbi ?? 0,
      mlbTotalBases: entry.totalBases ?? 0,
      mlbAtBats: entry.atBats ?? 0,
      mlbPlateAppearances: entry.plateAppearances ?? 0,
      mlbWalks: entry.walks ?? 0,
      mlbStrikeOuts: entry.strikeOuts ?? 0,
      mlbBattingAvg: entry.battingAvg ?? null,
      mlbObp: entry.obp ?? null,
      mlbSlg: entry.slg ?? null,
      mlbGameDatetime: entry.gameDatetime ?? null,
      mlbDayNight: entry.dayNight ?? null,
    };
  });

  return { entries, games };
}

function getPitcherMarketValue(row: any, market: string): number {
  const innings = toNumeric(row.innings_numeric) ?? 0;
  switch (market) {
    case "pitcher_hits_allowed":
    case "player_hits_allowed":
      return Number(row.hits_allowed ?? 0);
    case "pitcher_earned_runs":
    case "player_earned_runs":
      return Number(row.earned_runs ?? 0);
    case "pitcher_outs":
    case "player_outs":
    case "pitcher_outs_recorded":
      return Math.round(innings * 3);
    case "pitcher_walks":
    case "pitcher_walks_allowed":
    case "player_walks_allowed":
      return Number(row.base_on_balls ?? 0);
    case "pitcher_strikeouts":
    case "player_strikeouts":
    default:
      return Number(row.strike_outs ?? 0);
  }
}

function mapPitcherRows(rows: any[], market: string, gameMetaById = new Map<string, MlbGameMeta>()): { entries: MlbDrilldownLogEntry[]; games: BoxScoreGame[] } {
  const entries: MlbDrilldownLogEntry[] = rows.map((row) => {
    const inningsPitched = toNumeric(row.innings_numeric);
    const gameMeta = gameMetaById.get(String(row.game_id));
    const gameDatetime = row.game_datetime ?? row.start_time ?? gameMeta?.gameDatetime ?? null;
    const dayNightRaw = typeof row.day_night === "string" ? row.day_night.trim().toUpperCase().slice(0, 1) : null;
    const dayNight = dayNightRaw === "D" || dayNightRaw === "N" ? dayNightRaw : getDayNightFromGameDatetime(gameDatetime);
    return {
      gameId: String(row.game_id),
      date: row.official_date,
      season: row.season,
      gameDatetime,
      dayNight,
      homeAway: row.is_home ? "H" : "A",
      opponentAbbr: row.opponent_abbr || "OPP",
      opponentName: row.opponent_name || "Opponent",
      result: normalizeResult(row.game_result),
      teamScore: row.team_score ?? null,
      opponentScore: row.opponent_score ?? null,
      marketValue: getPitcherMarketValue(row, market),
      strikeOuts: row.strike_outs,
      walks: row.base_on_balls,
      inningsPitched,
      hitsAllowed: row.hits_allowed,
      earnedRuns: row.earned_runs,
      eraGame: toNumeric(row.era_game),
      whipGame: toNumeric(row.whip_game),
    };
  });

  const games: BoxScoreGame[] = entries.map((entry) => {
    const margin =
      entry.teamScore !== null && entry.opponentScore !== null
        ? entry.teamScore - entry.opponentScore
        : 0;

    return {
      gameId: entry.gameId,
      date: entry.date,
      seasonType: "R",
      homeAway: entry.homeAway,
      opponentTeamId: 0,
      opponentAbbr: entry.opponentAbbr,
      opponentName: entry.opponentName,
      result: entry.result,
      margin,
      teamScore: entry.teamScore ?? 0,
      opponentScore: entry.opponentScore ?? 0,
      minutes: entry.inningsPitched ?? 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
      fgPct: 0,
      fg3m: 0,
      fg3a: 0,
      fg3Pct: 0,
      ftm: 0,
      fta: 0,
      ftPct: 0,
      oreb: 0,
      dreb: 0,
      plusMinus: 0,
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
      pra: 0,
      pr: 0,
      pa: 0,
      ra: 0,
      bs: 0,
      mlbPitcherStrikeouts: entry.strikeOuts ?? 0,
      mlbInningsPitched: entry.inningsPitched ?? 0,
      mlbPitcherOuts: Math.round((entry.inningsPitched ?? 0) * 3),
      mlbWalks: entry.walks ?? 0,
      mlbHitsAllowed: entry.hitsAllowed ?? 0,
      mlbEarnedRuns: entry.earnedRuns ?? 0,
      mlbEraGame: entry.eraGame ?? 0,
      mlbWhipGame: entry.whipGame ?? 0,
      mlbGameDatetime: entry.gameDatetime ?? null,
      mlbDayNight: entry.dayNight ?? null,
    };
  });

  return { entries, games };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId") ?? undefined,
      market: searchParams.get("market") ?? undefined,
      season: searchParams.get("season") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      includePrior: searchParams.get("includePrior") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const {
      playerId,
      market,
      season = getCurrentEtYear(),
      limit = 40,
      includePrior = true,
    } = parsed.data;

    const logType: LogType = PITCHER_MARKETS.has(market) ? "pitcher" : "batter";
    const supabase = createServerSupabaseClient();

    if (logType === "pitcher") {
      const { data, error } = await supabase.rpc("get_mlb_pitcher_game_logs", {
        p_player_id: playerId,
        p_season: season,
        p_limit: limit,
        p_include_prior: includePrior,
      });

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch pitcher logs", details: error.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      const rows = includePrior === false
        ? (data || []).filter((row: any) => Number(row.season) === season)
        : data || [];
      const gameMetaById = await fetchGameMetaById(supabase, rows);
      const { entries, games } = mapPitcherRows(rows, market, gameMetaById);
      return NextResponse.json(
        {
          playerId,
          market,
          season,
          logType,
          entries,
          games,
        },
        { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } }
      );
    }

    const { data, error } = await supabase.rpc("get_mlb_batter_game_logs", {
      p_player_id: playerId,
      p_season: season,
      p_limit: limit,
      p_include_prior: includePrior,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch batter logs", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = includePrior === false
      ? (data || []).filter((row: any) => Number(row.season) === season)
      : data || [];
    const gameMetaById = await fetchGameMetaById(supabase, rows);
    const { entries, games } = mapBatterRows(rows, market, gameMetaById);
    return NextResponse.json(
      {
        playerId,
        market,
        season,
        logType,
        entries,
        games,
      },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
