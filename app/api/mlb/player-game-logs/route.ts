import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

const PITCHER_MARKETS = new Set(["pitcher_strikeouts"]);

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  market: z.string().min(1),
  season: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(5).max(200).optional(),
  includePrior: z.coerce.boolean().optional(),
});

type LogType = "batter" | "pitcher";

interface MlbDrilldownLogEntry {
  gameId: string;
  date: string;
  season: number;
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

function mapBatterRows(rows: any[], market: string): { entries: MlbDrilldownLogEntry[]; games: BoxScoreGame[] } {
  const entries: MlbDrilldownLogEntry[] = rows.map((row) => {
    const marketValue =
      market === "player_hits"
        ? row.hits
        : market === "player_home_runs"
        ? row.home_runs
        : market === "player_runs_scored"
        ? row.runs
        : market === "player_rbi"
        ? row.rbi
        : market === "player_total_bases"
        ? row.total_bases
        : row.hits;

    const rawBattingHand = row.batting_hand ?? row.bats ?? row.batter_hand ?? null;
    const battingHand =
      typeof rawBattingHand === "string"
        ? rawBattingHand.trim().toUpperCase().slice(0, 1)
        : null;
    const lineupRaw = row.lineup_position ?? row.batting_order ?? row.lineup_slot ?? null;
    const lineupPosition = lineupRaw !== null && lineupRaw !== undefined ? Number(lineupRaw) : null;

    return {
      gameId: String(row.game_id),
      date: row.official_date,
      season: row.season,
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
    };
  });

  return { entries, games };
}

function mapPitcherRows(rows: any[]): { entries: MlbDrilldownLogEntry[]; games: BoxScoreGame[] } {
  const entries: MlbDrilldownLogEntry[] = rows.map((row) => ({
    gameId: String(row.game_id),
    date: row.official_date,
    season: row.season,
    homeAway: row.is_home ? "H" : "A",
    opponentAbbr: row.opponent_abbr || "OPP",
    opponentName: row.opponent_name || "Opponent",
    result: normalizeResult(row.game_result),
    teamScore: row.team_score ?? null,
    opponentScore: row.opponent_score ?? null,
    marketValue: Number(row.strike_outs ?? 0),
    strikeOuts: row.strike_outs,
    walks: row.base_on_balls,
    inningsPitched: toNumeric(row.innings_numeric),
    hitsAllowed: row.hits_allowed,
    earnedRuns: row.earned_runs,
    eraGame: toNumeric(row.era_game),
    whipGame: toNumeric(row.whip_game),
  }));

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
      mlbWalks: entry.walks ?? 0,
      mlbHitsAllowed: entry.hitsAllowed ?? 0,
      mlbEarnedRuns: entry.earnedRuns ?? 0,
      mlbEraGame: entry.eraGame ?? 0,
      mlbWhipGame: entry.whipGame ?? 0,
    };
  });

  return { entries, games };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      market: searchParams.get("market"),
      season: searchParams.get("season"),
      limit: searchParams.get("limit"),
      includePrior: searchParams.get("includePrior"),
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

      const { entries, games } = mapPitcherRows(data || []);
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

    const { entries, games } = mapBatterRows(data || [], market);
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
