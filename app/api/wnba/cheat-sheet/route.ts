import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

/**
 * API route for WNBA Hit Rate Cheat Sheet
 *
 * Calls get_wnba_hit_rate_cheatsheet_v2 RPC, mirroring the NBA cheat sheet
 * but targeting wnba_hit_rate_profiles and WNBA tables.
 * Also fetches best odds from Redis (bestodds:wnba:* keys) for each row.
 */

// =============================================================================
// TYPES
// =============================================================================

interface BestOddsData {
  best_book: string;
  best_price: number;
  line: number;
  side: string;
  player_id: string;
  player_name: string;
  book_count: number;
  updated_at: number;
}

interface HistoricalContext {
  seasonPct: number | null;
  seasonAvg: number | null;
  seasonGames: number | null;
}

interface DvpContext {
  rank: number | null;
  avgAllowed: number | null;
  totalTeams: number;
  season: string;
}

export interface CheatSheetRow {
  // Player/Game Context
  playerId: number;
  nbaPlayerId: number | null;
  playerName: string;
  teamAbbr: string;
  teamName: string;
  opponentAbbr: string;
  opponentName: string;
  playerPosition: string;
  gameDate: string;
  gameId: number;
  homeAway: string;

  // Game Details
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamName: string;
  awayTeamName: string;
  gameStatus: string;
  startTime: string | null;

  // Betting Line Info
  market: string;
  line: number;
  overOdds: string;
  overOddsDecimal: number;

  // Hit Rates
  hitRate: number;
  last5Pct: number;
  last10Pct: number;
  last20Pct: number;
  seasonPct: number;
  hitStreak: number;

  // Edge Calculations
  avgStat: number;
  edge: number;
  edgePct: number;

  // Matchup Context
  dvpRank: number | null;
  dvpAvg: number | null;
  dvpTotalTeams: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable";

  // Confidence Metrics
  confidenceGrade: "A+" | "A" | "B+" | "B" | "C";
  confidenceScore: number;
  trend: "hot" | "improving" | "stable" | "declining" | "cold";

  // For Odds Fetching
  oddsSelectionId: string | null;
  selKey: string | null;
  eventId: string | null;

  // Best odds from Redis
  bestOdds: {
    book: string;
    price: number;
    updated_at: number;
  } | null;
  books: number;

  // Extras
  isBackToBack: boolean;
  injuryStatus: string | null;
  injuryNotes: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

const WNBA_TEAM_IDS_BY_ABBR: Record<string, number> = {
  ATL: 1611661330,
  CHI: 1611661329,
  CON: 1611661323,
  CONN: 1611661323,
  CTN: 1611661323,
  DAL: 1611661321,
  GSV: 1611661331,
  GOL: 1611661331,
  GSW: 1611661331,
  IND: 1611661325,
  LA: 1611661320,
  LAS: 1611661320,
  LOS: 1611661320,
  LV: 1611661319,
  LVA: 1611661319,
  MIN: 1611661324,
  NY: 1611661313,
  NEW: 1611661313,
  NYL: 1611661313,
  PHO: 1611661317,
  PHX: 1611661317,
  POR: 1611661332,
  SEA: 1611661328,
  TOR: 1611661327,
  WAS: 1611661322,
  WSH: 1611661322,
};

const WNBA_DVP_DEFAULT_TOTAL_TEAMS = 13;

function getWnbaTeamIdFromAbbr(abbr?: string | null): number | null {
  if (!abbr) return null;
  return WNBA_TEAM_IDS_BY_ABBR[abbr.toUpperCase()] ?? null;
}

function getWnbaSeasonFromDate(gameDate?: string | null): string {
  const year = gameDate?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : "2025";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWnbaPosition(position?: string | null): string | null {
  if (!position) return null;
  const upper = position.toUpperCase();
  if (upper === "C") return "C";
  if (["F", "SF", "PF", "FC", "F-C", "C-F"].includes(upper)) return "F";
  if (["G", "PG", "SG", "GF", "G-F", "F-G"].includes(upper)) return "G";
  return null;
}

function getWnbaDvpMarketFields(market?: string | null): { rank: string; avg: string } | null {
  switch (market) {
    case "player_points":
      return { rank: "pts_rank", avg: "pts_avg" };
    case "player_rebounds":
      return { rank: "reb_rank", avg: "reb_avg" };
    case "player_assists":
      return { rank: "ast_rank", avg: "ast_avg" };
    case "player_threes_made":
      return { rank: "fg3m_rank", avg: "fg3m_avg" };
    case "player_steals":
      return { rank: "stl_rank", avg: "stl_avg" };
    case "player_blocks":
      return { rank: "blk_rank", avg: "blk_avg" };
    case "player_turnovers":
      return { rank: "tov_rank", avg: "tov_avg" };
    case "player_points_rebounds_assists":
      return { rank: "pra_rank", avg: "pra_avg" };
    case "player_points_rebounds":
      return { rank: "pr_rank", avg: "pr_avg" };
    case "player_points_assists":
      return { rank: "pa_rank", avg: "pa_avg" };
    case "player_rebounds_assists":
      return { rank: "ra_rank", avg: "ra_avg" };
    case "player_blocks_steals":
      return { rank: "bs_rank", avg: "bs_avg" };
    default:
      return null;
  }
}

function getWnbaDvpCutoffs(totalTeams = WNBA_DVP_DEFAULT_TOTAL_TEAMS) {
  const teams = Math.max(totalTeams || WNBA_DVP_DEFAULT_TOTAL_TEAMS, 1);
  const tierSize = Math.max(1, Math.floor(teams / 3));
  return {
    toughMax: tierSize,
    favorableMin: teams - tierSize + 1,
  };
}

function getWnbaDvpQuality(
  rank: number | null,
  totalTeams = WNBA_DVP_DEFAULT_TOTAL_TEAMS
): "favorable" | "neutral" | "unfavorable" {
  if (rank === null) return "neutral";
  const { toughMax, favorableMin } = getWnbaDvpCutoffs(totalTeams);
  if (rank <= toughMax) return "unfavorable";
  if (rank >= favorableMin) return "favorable";
  return "neutral";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getConfidenceGrade(score: number): CheatSheetRow["confidenceGrade"] {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  return "C";
}

function getOddsScore(decimalOdds: number | null, americanOdds: number | null): number {
  if (decimalOdds !== null) {
    if (decimalOdds >= 2.0) return 10;
    if (decimalOdds >= 1.91) return 8;
    if (decimalOdds >= 1.83) return 6;
    if (decimalOdds >= 1.72) return 4;
    return 2;
  }

  if (americanOdds !== null) {
    if (americanOdds >= 100) return 10;
    if (americanOdds >= -110) return 8;
    if (americanOdds >= -120) return 6;
    if (americanOdds >= -140) return 4;
    return 2;
  }

  return 5;
}

function calculateConfidenceScore(input: {
  hitRate: number | null;
  edge: number | null;
  dvpRank: number | null;
  dvpTotalTeams: number;
  hitStreak: number | null;
  decimalOdds: number | null;
  americanOdds: number | null;
}) {
  const hitRateScore = clamp((input.hitRate ?? 0) * 40, 0, 40);
  const edgeScore = clamp((input.edge ?? 0) * 4, 0, 20);
  const dvpScore =
    input.dvpRank === null
      ? 10
      : clamp(((input.dvpRank - 1) / Math.max(1, input.dvpTotalTeams - 1)) * 20, 0, 20);
  const streakScore = clamp((input.hitStreak ?? 0) * 2, 0, 10);
  const oddsScore = getOddsScore(input.decimalOdds, input.americanOdds);

  return Number(
    clamp(hitRateScore + edgeScore + dvpScore + streakScore + oddsScore, 0, 100).toFixed(2)
  );
}

async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();

  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);

  if (validRows.length === 0) {
    return result;
  }

  // Build Redis keys - format: bestodds:wnba:{eventId}:{market}:{selKey}
  const keys = validRows.map(r => `bestodds:wnba:${r.event_id}:${r.market}:${r.sel_key}`);

  try {
    const values = await redis.mget<(BestOddsData | null)[]>(...keys);

    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];

      if (value) {
        if (typeof value === 'string') {
          try {
            result.set(compositeKey, JSON.parse(value));
          } catch {
            result.set(compositeKey, null);
          }
        } else {
          result.set(compositeKey, value);
        }
      } else {
        result.set(compositeKey, null);
      }
    });
  } catch (e) {
    console.error("[Cheat Sheet WNBA] Redis best odds fetch error:", e);
  }

  return result;
}

function profileContextKey(row: {
  player_id?: number | string | null;
  game_id?: number | string | null;
  game_date?: string | null;
  market?: string | null;
  line?: number | string | null;
}) {
  const line = row.line === null || row.line === undefined ? "" : Number(row.line);
  return `${row.player_id ?? ""}:${row.game_id ?? ""}:${row.game_date ?? ""}:${row.market ?? ""}:${line}`;
}

function normalizePct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

async function fetchHistoricalContextForRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: any[]
): Promise<Map<string, HistoricalContext>> {
  const result = new Map<string, HistoricalContext>();
  const playerIds = [...new Set(rows.map((row) => row.player_id).filter(Boolean))];
  const gameIds = [...new Set(rows.map((row) => row.game_id).filter(Boolean))];
  const markets = [...new Set(rows.map((row) => row.market).filter(Boolean))];

  if (playerIds.length === 0 || gameIds.length === 0 || markets.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from("wnba_hit_rate_profiles")
    .select("player_id, game_id, game_date, market, line, season_2025_pct, season_2025_avg, season_2025_games")
    .in("player_id", playerIds)
    .in("game_id", gameIds)
    .in("market", markets);

  if (error) {
    console.error("[Cheat Sheet WNBA] Historical profile context fetch error:", error.message);
    return result;
  }

  for (const profile of data || []) {
    result.set(profileContextKey(profile), {
      seasonPct: normalizePct(profile.season_2025_pct),
      seasonAvg: profile.season_2025_avg ?? null,
      seasonGames: profile.season_2025_games ?? null,
    });
  }

  return result;
}

async function fetchHeadshotIdsForRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: any[]
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  const playerIds = [...new Set(rows.map((row) => Number(row.player_id)).filter(Number.isFinite))];

  if (playerIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from("wnba_players_hr")
    .select("wnba_player_id, nba_player_id")
    .in("wnba_player_id", playerIds);

  if (error) {
    console.error("[Cheat Sheet WNBA] Headshot ID fetch error:", error.message);
    return result;
  }

  for (const player of data || []) {
    result.set(Number(player.wnba_player_id), player.nba_player_id ?? null);
  }

  return result;
}

function dvpContextKey(row: {
  opponent_abbr?: string | null;
  player_position?: string | null;
  market?: string | null;
  game_date?: string | null;
}) {
  const teamId = getWnbaTeamIdFromAbbr(row.opponent_abbr);
  const position = normalizeWnbaPosition(row.player_position);
  const season = getWnbaSeasonFromDate(row.game_date);
  return teamId && position && row.market ? `${season}:${teamId}:${position}:${row.market}` : null;
}

async function fetchDvpContextForRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: any[]
): Promise<Map<string, DvpContext>> {
  const result = new Map<string, DvpContext>();
  const opponentTeamIds = [
    ...new Set(
      rows
        .map((row) => getWnbaTeamIdFromAbbr(row.opponent_abbr))
        .filter(Boolean)
    ),
  ] as number[];

  if (opponentTeamIds.length === 0) {
    return result;
  }

  const requestedSeasons = [
    ...new Set(rows.map((row) => getWnbaSeasonFromDate(row.game_date))),
  ];
  const seasonsToFetch = [
    ...new Set(
      requestedSeasons.flatMap((season) => {
        const year = Number(season);
        return Number.isFinite(year) ? [String(year), String(year - 1)] : [season];
      })
    ),
  ];

  const { data, error } = await supabase
    .from("wnba_team_defense_by_position")
    .select("*")
    .in("season", seasonsToFetch);

  if (error) {
    console.error("[Cheat Sheet WNBA] DvP context fetch error:", error.message);
    return result;
  }

  const teamIdsBySeason = new Map<string, Set<number>>();
  const defenseByTeamPosition = new Map<string, any>();
  for (const row of data || []) {
    const season = String(row.season);
    const teamId = Number(row.team_id);
    const position = normalizeWnbaPosition(row.position);
    if (!teamId || !position) continue;
    const teamIds = teamIdsBySeason.get(season) ?? new Set<number>();
    teamIds.add(teamId);
    teamIdsBySeason.set(season, teamIds);
    defenseByTeamPosition.set(`${season}:${teamId}:${position}`, row);
  }

  const totalTeamsBySeason = new Map<string, number>();
  for (const [season, teamIds] of teamIdsBySeason) {
    totalTeamsBySeason.set(season, teamIds.size || WNBA_DVP_DEFAULT_TOTAL_TEAMS);
  }

  for (const row of rows) {
    const key = dvpContextKey(row);
    if (!key) continue;

    const teamId = getWnbaTeamIdFromAbbr(row.opponent_abbr);
    const position = normalizeWnbaPosition(row.player_position);
    const fields = getWnbaDvpMarketFields(row.market);
    if (!teamId || !position || !fields) continue;

    const targetSeason = getWnbaSeasonFromDate(row.game_date);
    const targetYear = Number(targetSeason);
    const seasonCandidates = Number.isFinite(targetYear)
      ? [String(targetYear), String(targetYear - 1)]
      : [targetSeason];
    const seasonUsed = seasonCandidates.find((season) =>
      defenseByTeamPosition.has(`${season}:${teamId}:${position}`)
    );
    if (!seasonUsed) continue;

    const defense = defenseByTeamPosition.get(`${seasonUsed}:${teamId}:${position}`);
    if (!defense) continue;

    result.set(key, {
      rank: defense[fields.rank] ?? null,
      avgAllowed: defense[fields.avg] ?? null,
      season: seasonUsed,
      // Opening day can intentionally use the previous season's 13-team DvP
      // set. Once the 2026 table includes expansion teams, this becomes 15.
      // That keeps rank 12 of 13 and rank 14 of 15 comparable without forcing
      // unavailable expansion-team data into the model.
      totalTeams: totalTeamsBySeason.get(seasonUsed) ?? WNBA_DVP_DEFAULT_TOTAL_TEAMS,
    });
  }

  return result;
}

// Request body interface
interface CheatSheetRequest {
  timeWindow?: "last_5_pct" | "last_10_pct" | "last_20_pct" | "season_pct";
  minHitRate?: number;
  oddsFloor?: number;
  oddsCeiling?: number;
  markets?: string[];
  dates?: string[];
}

function transformRows(
  rawRows: any[],
  bestOddsMap: Map<string, BestOddsData | null>,
  historicalContextMap: Map<string, HistoricalContext>,
  headshotIdMap: Map<number, number | null>,
  dvpContextMap: Map<string, DvpContext>,
  timeWindow: CheatSheetRequest["timeWindow"] = "last_10_pct"
): CheatSheetRow[] {
  return rawRows.map((row: any) => {
    const compositeKey = `${row.event_id}:${row.market}:${row.odds_selection_id}`;
    const bestOddsData = bestOddsMap.get(compositeKey);
    const historicalContext = historicalContextMap.get(profileContextKey(row));
    const hasPreviousSeasonSample = Boolean(
      historicalContext?.seasonGames && historicalContext.seasonGames > 0
    );
    const seasonPct = hasPreviousSeasonSample
      ? (historicalContext?.seasonPct ?? row.season_pct)
      : row.season_pct;
    const isSeasonWindow = timeWindow === "season_pct";
    const dvpContext = dvpContextMap.get(dvpContextKey(row) ?? "");
    const dvpRank = dvpContext?.rank ?? row.dvp_rank ?? null;
    const dvpAvg = dvpContext?.avgAllowed ?? row.dvp_avg ?? null;
    const dvpTotalTeams = dvpContext?.totalTeams ?? WNBA_DVP_DEFAULT_TOTAL_TEAMS;
    const matchupQuality = getWnbaDvpQuality(dvpRank, dvpTotalTeams);
    const confidenceScore = calculateConfidenceScore({
      hitRate: isSeasonWindow ? seasonPct : row.hit_rate,
      edge: parseNumber(row.edge),
      dvpRank,
      dvpTotalTeams,
      hitStreak: parseNumber(row.hit_streak),
      decimalOdds: parseNumber(row.over_odds_decimal),
      americanOdds: parseNumber(bestOddsData?.best_price ?? row.over_odds),
    });

    return {
      playerId: row.player_id,
      nbaPlayerId: row.nba_player_id ?? headshotIdMap.get(Number(row.player_id)) ?? null,
      playerName: row.player_name,
      teamAbbr: row.team_abbr,
      teamName: row.team_name,
      opponentAbbr: row.opponent_abbr,
      opponentName: row.opponent_name,
      playerPosition: row.player_position,
      gameDate: row.game_date,
      gameId: row.game_id,
      homeAway: row.home_away,
      homeTeamAbbr: row.home_team_abbr,
      awayTeamAbbr: row.away_team_abbr,
      homeTeamName: row.home_team_name,
      awayTeamName: row.away_team_name,
      gameStatus: row.game_status,
      startTime: row.start_time ?? row.commence_time ?? null,
      market: row.market,
      line: row.line,
      overOdds: row.over_odds,
      overOddsDecimal: row.over_odds_decimal,
      hitRate: isSeasonWindow ? seasonPct : row.hit_rate,
      last5Pct: row.last_5_pct,
      last10Pct: row.last_10_pct,
      last20Pct: row.last_20_pct,
      seasonPct,
      hitStreak: row.hit_streak,
      avgStat: isSeasonWindow && hasPreviousSeasonSample && typeof historicalContext?.seasonAvg === "number"
        ? historicalContext.seasonAvg
        : row.avg_stat,
      edge: row.edge,
      edgePct: row.edge_pct,
      dvpRank,
      dvpAvg,
      dvpTotalTeams,
      matchupQuality,
      confidenceGrade: getConfidenceGrade(confidenceScore),
      confidenceScore,
      trend: row.trend,
      oddsSelectionId: row.odds_selection_id,
      selKey: row.odds_selection_id,
      eventId: row.event_id,
      bestOdds: bestOddsData ? {
        book: bestOddsData.best_book,
        price: bestOddsData.best_price,
        updated_at: bestOddsData.updated_at,
      } : null,
      books: bestOddsData?.book_count ?? 0,
      isBackToBack: row.is_back_to_back,
      injuryStatus: row.injury_status,
      injuryNotes: row.injury_notes,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
    };
  });
}

function applySeasonFallbackFilter(
  rows: CheatSheetRow[],
  timeWindow: CheatSheetRequest["timeWindow"],
  minHitRate: number
): CheatSheetRow[] {
  const filteredRows =
    timeWindow === "season_pct"
      ? rows.filter((row) => (row.seasonPct ?? 0) >= minHitRate)
      : rows;

  return [...filteredRows].sort(
    (a, b) =>
      (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0) ||
      (b.hitRate ?? 0) - (a.hitRate ?? 0)
  );
}

function selectedHitPct(row: any, timeWindow: CheatSheetRequest["timeWindow"]) {
  switch (timeWindow) {
    case "last_5_pct":
      return parseNumber(row.last_5_pct) ?? 0;
    case "last_20_pct":
      return parseNumber(row.last_20_pct) ?? 0;
    case "season_pct":
      return parseNumber(row.season_pct) ?? 0;
    case "last_10_pct":
    default:
      return parseNumber(row.last_10_pct) ?? 0;
  }
}

function selectedAvg(row: any, timeWindow: CheatSheetRequest["timeWindow"]) {
  switch (timeWindow) {
    case "last_5_pct":
      return parseNumber(row.last_5_avg) ?? 0;
    case "last_20_pct":
      return parseNumber(row.last_20_avg) ?? 0;
    case "season_pct":
      return parseNumber(row.season_avg) ?? 0;
    case "last_10_pct":
    default:
      return parseNumber(row.last_10_avg) ?? 0;
  }
}

function getTrend(row: any): CheatSheetRow["trend"] {
  const last5 = parseNumber(row.last_5_pct) ?? 0;
  const last10 = parseNumber(row.last_10_pct) ?? 0;
  const season = parseNumber(row.season_pct) ?? 0;
  const streak = parseNumber(row.hit_streak) ?? 0;

  if (last5 >= 80 && streak >= 3) return "hot";
  if (last5 > last10 && last5 > season) return "improving";
  if (last5 < last10 && last5 < season - 10) return "declining";
  if (streak === 0 && last5 < 40) return "cold";
  return "stable";
}

function normalizeProfileRow(row: any, timeWindow: CheatSheetRequest["timeWindow"]) {
  const hitPct = selectedHitPct(row, timeWindow);
  const avgStat = selectedAvg(row, timeWindow);
  const line = parseNumber(row.line) ?? 0;
  const edge = avgStat - line;
  const edgePct = line > 0 ? (avgStat / line - 1) * 100 : 0;

  return {
    player_id: row.player_id,
    nba_player_id: row.nba_player_id ?? null,
    player_name: row.player_name,
    team_abbr: row.team_abbr,
    team_name: row.team_name,
    opponent_abbr: row.opponent_abbr ?? row.opponent_team_abbr,
    opponent_name: row.opponent_name ?? row.opponent_team_name,
    player_position: row.player_position ?? row.position,
    game_date: row.game_date,
    game_id: row.game_id,
    home_away: row.home_away,
    home_team_abbr: row.home_away === "H" ? row.team_abbr : row.opponent_team_abbr,
    away_team_abbr: row.home_away === "A" ? row.team_abbr : row.opponent_team_abbr,
    home_team_name: row.home_team_name,
    away_team_name: row.away_team_name,
    game_status: row.game_status,
    start_time: row.start_time ?? row.commence_time ?? null,
    market: row.market,
    line,
    over_odds: row.over_price == null ? null : String(row.over_price),
    over_odds_decimal: row.over_price_decimal,
    hit_rate: hitPct / 100,
    last_5_pct: (parseNumber(row.last_5_pct) ?? 0) / 100,
    last_10_pct: (parseNumber(row.last_10_pct) ?? 0) / 100,
    last_20_pct: (parseNumber(row.last_20_pct) ?? 0) / 100,
    season_pct: (parseNumber(row.season_pct) ?? 0) / 100,
    hit_streak: parseNumber(row.hit_streak) ?? 0,
    avg_stat: avgStat,
    edge,
    edge_pct: edgePct,
    dvp_rank: row.dvp_rank ?? null,
    dvp_avg: row.dvp_avg ?? null,
    matchup_quality: row.matchup_quality ?? "neutral",
    confidence_grade: row.confidence_grade ?? "C",
    confidence_score: row.confidence_score ?? hitPct,
    trend: row.trend ?? getTrend(row),
    odds_selection_id: row.odds_selection_id,
    event_id: row.event_id,
    is_back_to_back: row.is_back_to_back ?? false,
    injury_status: row.injury_status,
    injury_notes: row.injury_notes,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
  };
}

async function fetchCheatSheetRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  args: {
    timeWindow: CheatSheetRequest["timeWindow"];
    rpcTimeWindow: CheatSheetRequest["timeWindow"];
    rpcMinHitRate: number;
    oddsFloor: number | null;
    oddsCeiling: number | null;
    markets: string[] | null;
    dates: string[] | null;
  }
) {
  const { data, error } = await supabase.rpc("get_wnba_hit_rate_cheatsheet_v2", {
    p_time_window: args.rpcTimeWindow,
    p_min_hit_rate: args.rpcMinHitRate,
    p_odds_floor: args.oddsFloor,
    p_odds_ceiling: args.oddsCeiling,
    p_markets: args.markets,
    p_dates: args.dates,
  });

  if (!error) {
    return { data: data || [], error: null };
  }

  const shouldFallback =
    String(error.message || "").includes("operator does not exist") ||
    String(error.message || "").includes("invalid input syntax");

  if (!shouldFallback) {
    return { data: null, error };
  }

  console.warn("[Cheat Sheet WNBA] RPC failed, falling back to direct profiles query:", error.message);

  let query = supabase.from("wnba_hit_rate_profiles").select("*");

  if (args.dates && args.dates.length > 0) {
    query = query.in("game_date", args.dates);
  }

  if (args.markets && args.markets.length > 0) {
    query = query.in("market", args.markets);
  }

  const { data: profiles, error: fallbackError } = await query;

  if (fallbackError) {
    return { data: null, error: fallbackError };
  }

  const rows = (profiles || [])
    .filter((row: any) => selectedHitPct(row, args.rpcTimeWindow) / 100 >= args.rpcMinHitRate)
    .map((row: any) => normalizeProfileRow(row, args.rpcTimeWindow));

  return { data: rows, error: null };
}

export async function POST(req: NextRequest) {
  try {
    const body: CheatSheetRequest = await req.json().catch(() => ({}));

    const {
      timeWindow = "last_10_pct",
      minHitRate = 0.80,
      oddsFloor = -300,
      oddsCeiling = 200,
      markets = null,
      dates = null,
    } = body;
    const rpcTimeWindow = timeWindow === "season_pct" ? "last_10_pct" : timeWindow;
    const rpcMinHitRate = timeWindow === "season_pct" ? 0 : minHitRate;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await fetchCheatSheetRows(supabase, {
      timeWindow,
      rpcTimeWindow,
      rpcMinHitRate,
      oddsFloor: null,
      oddsCeiling: null,
      markets,
      dates,
    });

    if (error) {
      console.error("[Cheat Sheet WNBA] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch cheat sheet data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawRows = data || [];

    const bestOddsMap = await fetchBestOddsForRows(
      rawRows.map((row: any) => ({
        event_id: row.event_id,
        market: row.market,
        sel_key: row.odds_selection_id,
      }))
    );
    const historicalContextMap = await fetchHistoricalContextForRows(supabase, rawRows);
    const headshotIdMap = await fetchHeadshotIdsForRows(supabase, rawRows);
    const dvpContextMap = await fetchDvpContextForRows(supabase, rawRows);

    const rows = applySeasonFallbackFilter(
      transformRows(rawRows, bestOddsMap, historicalContextMap, headshotIdMap, dvpContextMap, timeWindow),
      timeWindow,
      minHitRate
    );

    return NextResponse.json(
      { rows, count: rows.length },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (err) {
    console.error("[Cheat Sheet WNBA] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const timeWindow = searchParams.get("timeWindow") || "last_10_pct";
  const minHitRate = parseFloat(searchParams.get("minHitRate") || "0.80");
  const oddsFloor = parseInt(searchParams.get("oddsFloor") || "-300");
  const oddsCeiling = parseInt(searchParams.get("oddsCeiling") || "200");
  const markets = searchParams.get("markets")?.split(",").filter(Boolean) || null;
  const dates = searchParams.get("dates")?.split(",").filter(Boolean) || null;
  const rpcTimeWindow = timeWindow === "season_pct" ? "last_10_pct" : timeWindow;
  const rpcMinHitRate = timeWindow === "season_pct" ? 0 : minHitRate;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await fetchCheatSheetRows(supabase, {
    timeWindow: timeWindow as CheatSheetRequest["timeWindow"],
    rpcTimeWindow: rpcTimeWindow as CheatSheetRequest["timeWindow"],
    rpcMinHitRate,
    oddsFloor: null,
    oddsCeiling: null,
    markets,
    dates,
  });

  if (error) {
    console.error("[Cheat Sheet WNBA] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cheat sheet data", details: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawRows = data || [];

  const bestOddsMap = await fetchBestOddsForRows(
    rawRows.map((row: any) => ({
      event_id: row.event_id,
      market: row.market,
      sel_key: row.odds_selection_id,
    }))
  );
  const historicalContextMap = await fetchHistoricalContextForRows(supabase, rawRows);
  const headshotIdMap = await fetchHeadshotIdsForRows(supabase, rawRows);
  const dvpContextMap = await fetchDvpContextForRows(supabase, rawRows);

  const rows = applySeasonFallbackFilter(
    transformRows(rawRows, bestOddsMap, historicalContextMap, headshotIdMap, dvpContextMap, timeWindow as CheatSheetRequest["timeWindow"]),
    timeWindow as CheatSheetRequest["timeWindow"],
    minHitRate
  );

  return NextResponse.json(
    { rows, count: rows.length },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
