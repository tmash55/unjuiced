"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { fetchPaceContextsForRows, getPaceContextKey, type PaceContext } from "@/lib/basketball/pace-context";
import { fetchGameLineContextsForRows, getGameLineContextKey, type GameLineContext } from "@/lib/basketball/game-line-context";

/**
 * Hit Rates API v2 - WNBA
 *
 * Uses `get_wnba_hit_rate_profiles_fast_v3` RPC which mirrors the NBA version
 * but targets wnba_players_hr, wnba_games_hr, and wnba_teams tables.
 */

// Cache configuration
const CACHE_TTL_SECONDS = 60; // 1 minute cache
const CACHE_KEY_PREFIX = "hitrates:wnba:v7";

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

interface EventRedisData {
  commence_time?: string;
  start_time?: string;
}

interface WnbaPlayerMetadata {
  jersey_number: number | null;
  position: string | null;
  depth_chart_pos: string | null;
  nba_player_id: number | null;
}

interface WnbaDvpRank {
  rank: number | null;
  avgAllowed: number | null;
  totalTeams: number | null;
}

interface WnbaHistoricalContext {
  seasonPct: number | null;
  seasonAvg: number | null;
  seasonGames: number | null;
  h2hPct: number | null;
  h2hAvg: number | null;
  h2hGames: number | null;
}

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

function getWnbaTeamIdFromAbbr(abbr?: string | null): number | null {
  if (!abbr) return null;
  return WNBA_TEAM_IDS_BY_ABBR[abbr.toUpperCase()] ?? null;
}

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();

  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);

  if (validRows.length === 0) {
    return result;
  }

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
    console.error("[Hit Rates v2 WNBA] Redis best odds fetch error:", e);
  }

  return result;
}

async function fetchEventStartTimes(
  rows: Array<{ event_id?: string }>
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const eventIds = [...new Set(rows.map(r => r.event_id).filter(Boolean))] as string[];

  if (eventIds.length === 0) {
    return result;
  }

  const eventKeys = eventIds.map(eventId => `events:wnba:${eventId}`);

  try {
    const values = await redis.mget<(EventRedisData | string | null)[]>(...eventKeys);
    eventIds.forEach((eventId, index) => {
      const raw = values[index];
      if (!raw) {
        result.set(eventId, null);
        return;
      }

      let event: EventRedisData;
      if (typeof raw === "string") {
        try {
          event = JSON.parse(raw) as EventRedisData;
        } catch {
          result.set(eventId, null);
          return;
        }
      } else {
        event = raw;
      }

      const startTime = event.commence_time || event.start_time || null;
      result.set(eventId, startTime);
    });
  } catch (error) {
    console.error("[Hit Rates v2 WNBA] Redis event start_time fetch error:", error);
  }

  return result;
}

async function fetchPlayerMetadata(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: Array<{ player_id?: number }>
): Promise<Map<number, WnbaPlayerMetadata>> {
  const result = new Map<number, WnbaPlayerMetadata>();
  const playerIds = [...new Set(rows.map((row) => row.player_id).filter(Boolean))] as number[];

  if (playerIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from("wnba_players_hr")
    .select("wnba_player_id, jersey_number, position, depth_chart_pos, nba_player_id")
    .in("wnba_player_id", playerIds);

  if (error) {
    console.error("[Hit Rates v2 WNBA] Player metadata fetch error:", error.message);
    return result;
  }

  for (const player of data || []) {
    result.set(Number(player.wnba_player_id), {
      jersey_number: player.jersey_number ?? null,
      position: player.position ?? null,
      depth_chart_pos: player.depth_chart_pos ?? null,
      nba_player_id: player.nba_player_id ?? null,
    });
  }

  return result;
}

function normalizeWnbaPosition(position?: string | null): "G" | "F" | "C" | null {
  if (!position) return null;
  const upper = position.toUpperCase();
  if (upper === "C") return "C";
  if (upper === "F" || upper === "SF" || upper === "PF" || upper === "FC") return "F";
  if (upper === "G" || upper === "PG" || upper === "SG" || upper === "GF") return "G";
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

function roundNumber(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getWnbaMarketStat(game: any, market?: string | null): number | null {
  switch (market) {
    case "player_points":
      return game.pts;
    case "player_rebounds":
      return game.reb;
    case "player_assists":
      return game.ast;
    case "player_threes_made":
      return game.fg3m;
    case "player_steals":
      return game.stl;
    case "player_blocks":
      return game.blk;
    case "player_turnovers":
      return game.tov;
    case "player_points_rebounds_assists":
      return game.pts + game.reb + game.ast;
    case "player_points_rebounds":
      return game.pts + game.reb;
    case "player_points_assists":
      return game.pts + game.ast;
    case "player_rebounds_assists":
      return game.reb + game.ast;
    case "player_blocks_steals":
      return game.blk + game.stl;
    default:
      return null;
  }
}

async function fetchHistoricalContextForRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: Array<{
    id?: string;
    player_id?: number;
    opponent_team_id?: number | null;
    opponent_team_abbr?: string | null;
    game_date?: string | null;
    market?: string | null;
    line?: number | null;
    h2h_pct?: number | null;
    h2h_avg?: number | null;
    h2h_games?: number | null;
  }>
): Promise<Map<string, WnbaHistoricalContext>> {
  const result = new Map<string, WnbaHistoricalContext>();
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))] as string[];

  if (ids.length === 0) return result;

  const { data: profileRows, error: profileError } = await supabase
    .from("wnba_hit_rate_profiles")
    .select("id, season_2025_pct, season_2025_avg, season_2025_games, h2h_pct, h2h_avg, h2h_games")
    .in("id", ids);

  if (profileError) {
    console.error("[Hit Rates v2 WNBA] Historical profile context fetch error:", profileError.message);
  }

  for (const profile of profileRows || []) {
    result.set(profile.id, {
      seasonPct: profile.season_2025_pct ?? null,
      seasonAvg: profile.season_2025_avg ?? null,
      seasonGames: profile.season_2025_games ?? null,
      h2hPct: profile.h2h_pct ?? null,
      h2hAvg: profile.h2h_avg ?? null,
      h2hGames: profile.h2h_games ?? null,
    });
  }

  const h2hRows = rows.filter((row) => {
    const existing = row.id ? result.get(row.id) : null;
    const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
    return (
      row.id &&
      row.player_id &&
      opponentTeamId &&
      row.game_date &&
      row.market &&
      typeof row.line === "number" &&
      !(existing?.h2hGames && existing.h2hGames > 0)
    );
  });

  if (h2hRows.length === 0) return result;

  const playerIds = [...new Set(h2hRows.map((row) => row.player_id).filter(Boolean))] as number[];
  const opponentIds = [...new Set(h2hRows.map((row) => row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr)).filter(Boolean))] as number[];
  const maxDate = h2hRows.map((row) => row.game_date!).sort().at(-1)!;

  const { data: boxScores, error: boxScoreError } = await supabase
    .from("wnba_player_box_scores")
    .select("player_id, opponent_team_id, game_date, pts, reb, ast, fg3m, stl, blk, tov")
    .in("player_id", playerIds)
    .in("opponent_team_id", opponentIds)
    .lt("game_date", maxDate)
    .order("game_date", { ascending: false });

  if (boxScoreError) {
    console.error("[Hit Rates v2 WNBA] H2H box score fetch error:", boxScoreError.message);
    return result;
  }

  const boxScoresByPlayerOpponent = new Map<string, any[]>();
  for (const game of boxScores || []) {
    const key = `${game.player_id}:${game.opponent_team_id}`;
    const existing = boxScoresByPlayerOpponent.get(key) ?? [];
    existing.push(game);
    boxScoresByPlayerOpponent.set(key, existing);
  }

  for (const row of h2hRows) {
    const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
    if (!row.id || !row.player_id || !opponentTeamId || !row.game_date || typeof row.line !== "number") continue;

    const games = (boxScoresByPlayerOpponent.get(`${row.player_id}:${opponentTeamId}`) ?? [])
      .filter((game) => String(game.game_date) < String(row.game_date));
    const values = games
      .map((game) => getWnbaMarketStat(game, row.market))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) continue;

    const hits = values.filter((value) => value >= row.line!).length;
    const existing = result.get(row.id) ?? {
      seasonPct: null,
      seasonAvg: null,
      seasonGames: null,
      h2hPct: null,
      h2hAvg: null,
      h2hGames: null,
    };

    result.set(row.id, {
      ...existing,
      h2hPct: roundNumber((hits / values.length) * 100, 1),
      h2hAvg: roundNumber(values.reduce((sum, value) => sum + value, 0) / values.length, 1),
      h2hGames: values.length,
    });
  }

  return result;
}

async function fetchDvpRanksForRows(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  rows: Array<{
    opponent_team_id?: number | null;
    opponent_team_abbr?: string | null;
    player_position?: string | null;
    player_depth_chart_pos?: string | null;
    market?: string | null;
    player_id?: number;
  }>,
  playerMetadataMap: Map<number, WnbaPlayerMetadata>
): Promise<Map<string, WnbaDvpRank>> {
  const result = new Map<string, WnbaDvpRank>();
  const opponentIds = [
    ...new Set(
      rows
        .map((row) => row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr))
        .filter(Boolean)
    ),
  ] as number[];

  if (opponentIds.length === 0) {
    return result;
  }

  const teamRankRows = await Promise.all(
    opponentIds.map(async (teamId) => {
      const { data, error } = await supabase
        .from("wnba_team_defense_by_position")
        .select("*")
        .eq("team_id", teamId)
        .eq("season", "2025");

      if (error) {
        console.error("[Hit Rates v2 WNBA] DvP rank fetch error:", teamId, error.message);
        return [] as any[];
      }

      return data || [];
    })
  );

  const defenseByTeamPosition = new Map<string, any>();
  for (const data of teamRankRows.flat()) {
    const teamId = Number(data.team_id);
    const position = data.position;
    if (!teamId || !position) continue;
    defenseByTeamPosition.set(`${teamId}:${position}`, {
      ...data,
      total_teams: 13,
    });
  }

  for (const row of rows) {
    const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
    const metadata = row.player_id ? playerMetadataMap.get(row.player_id) ?? null : null;
    const position = normalizeWnbaPosition(
      row.player_depth_chart_pos ||
      row.player_position ||
      metadata?.depth_chart_pos ||
      metadata?.position
    );
    const fields = getWnbaDvpMarketFields(row.market);

    if (!opponentTeamId || !position || !fields) continue;

    const defense = defenseByTeamPosition.get(`${opponentTeamId}:${position}`);
    if (!defense) continue;

    result.set(`${opponentTeamId}:${position}:${row.market}`, {
      rank: defense[fields.rank] ?? null,
      avgAllowed: defense[fields.avg] ?? null,
      totalTeams: defense.total_teams ?? null,
    });
  }

  return result;
}

// Valid sort fields for hit rates
const VALID_SORT_FIELDS = [
  "line", "l5Avg", "l10Avg", "seasonAvg", "streak",
  "l5Pct", "l10Pct", "l20Pct", "seasonPct", "h2hPct", "matchupRank"
] as const;

const QuerySchema = z.object({
  date: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "date must be YYYY-MM-DD"
    ),
  market: z.string().optional(),
  minHitRate: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(5000).optional(),
  offset: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  playerId: z.coerce.number().int().positive().optional(),
  sort: z.enum(VALID_SORT_FIELDS).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  skipCache: z.coerce.boolean().optional(),
  hasOdds: z.coerce.boolean().optional(),
});

const DEFAULT_LIMIT = 500;

function getETDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isPlayableGame(game: any): boolean {
  const status = String(game.game_status || "").toLowerCase();
  return !status.includes("postponed") && !status.includes("cancelled");
}

function isRegularSeasonGame(game: any): boolean {
  return String(game.season_type || "").toLowerCase().includes("regular");
}

async function getDefaultDatesToFetch(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  todayET: string,
  tomorrowET: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("wnba_games_hr")
    .select("game_date, game_status, season_type")
    .gte("game_date", todayET)
    .order("game_date", { ascending: true })
    .limit(60);

  if (error) {
    console.error("[Hit Rates v2 WNBA] Schedule date lookup error:", error.message);
    return [todayET, tomorrowET];
  }

  const playableGames = (data || []).filter(isPlayableGame);
  const regularSeasonGames = playableGames.filter(isRegularSeasonGame);
  const preferredGames = regularSeasonGames.length > 0 ? regularSeasonGames : playableGames;
  const dates = [...new Set(preferredGames.map((game) => game.game_date))].slice(0, 2);

  return dates.length > 0 ? dates : [todayET, tomorrowET];
}

function getCacheKey(dates: string[], market?: string | null, hasOdds?: boolean): string {
  const dateKey = dates.sort().join("_");
  const marketKey = market || "all";
  const oddsKey = hasOdds ? "odds" : "all";
  return `${CACHE_KEY_PREFIX}:${dateKey}:${marketKey}:${oddsKey}`;
}

function transformProfile(
  row: any,
  bestOdds: BestOddsData | null,
  eventStartTime: string | null,
  playerMetadata: WnbaPlayerMetadata | null,
  dvpRank: WnbaDvpRank | null,
  paceContext: PaceContext | null,
  gameLineContext: GameLineContext | null
) {
  const teamId = row.team_id ?? getWnbaTeamIdFromAbbr(row.team_abbr);
  const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
  const playerPosition = row.player_depth_chart_pos || row.player_position || playerMetadata?.depth_chart_pos || playerMetadata?.position;
  const normalizedPosition = normalizeWnbaPosition(playerPosition);
  const effectiveDvpRank = row.dvp_rank ?? dvpRank?.rank ?? null;
  const effectiveDvpAvgAllowed = row.dvp_avg_allowed ?? dvpRank?.avgAllowed ?? null;
  const effectiveTotalTeams = dvpRank?.totalTeams ?? 13;
  const startTime =
    eventStartTime ||
    row.start_time ||
    row.commence_time ||
    row.game_start ||
    row.game_start_time ||
    null;

  let matchupQuality: "favorable" | "neutral" | "unfavorable" | null = null;
  if (effectiveDvpRank) {
    const toughCutoff = Math.ceil(effectiveTotalTeams / 3);
    const favorableCutoff = effectiveTotalTeams - toughCutoff + 1;
    if (effectiveDvpRank <= toughCutoff) matchupQuality = "unfavorable";
    else if (effectiveDvpRank >= favorableCutoff) matchupQuality = "favorable";
    else matchupQuality = "neutral";
  }

  return {
    id: row.id,
    player_id: row.player_id,
    team_id: teamId,
    market: row.market,
    line: row.line,
    opponent_team_id: opponentTeamId,
    game_id: row.game_id,
    game_date: row.game_date,
    last_5_pct: row.last_5_pct,
    last_10_pct: row.last_10_pct,
    last_20_pct: row.last_20_pct,
    season_pct: row.season_pct,
    season_games: row.season_games ?? null,
    h2h_pct: row.h2h_pct,
    h2h_avg: row.h2h_avg,
    h2h_games: row.h2h_games,
    hit_streak: row.hit_streak,
    last_5_avg: row.last_5_avg,
    last_10_avg: row.last_10_avg,
    last_20_avg: row.last_20_avg,
    season_avg: row.season_avg,
    spread: row.spread ?? gameLineContext?.spread ?? null,
    total: row.total ?? gameLineContext?.total ?? null,
    game_odds_book: gameLineContext?.spreadBook ?? gameLineContext?.totalBook ?? null,
    spread_book: gameLineContext?.spreadBook ?? null,
    total_book: gameLineContext?.totalBook ?? null,
    spread_clv: row.spread_clv,
    total_clv: row.total_clv,
    injury_status: row.injury_status,
    injury_notes: row.injury_notes,
    team_name: row.team_name,
    team_abbr: row.team_abbr,
    opponent_team_name: row.opponent_team_name,
    opponent_team_abbr: row.opponent_team_abbr,
    player_position: playerPosition,
    jersey_number: row.jersey_number ?? playerMetadata?.jersey_number ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    home_away: row.home_away,
    national_broadcast: row.national_broadcast,
    is_primetime: row.is_primetime,
    odds_selection_id: row.odds_selection_id,
    event_id: row.event_id,
    is_back_to_back: row.is_back_to_back,
    start_time: startTime,
    sel_key: row.sel_key,
    best_odds: bestOdds ? {
      book: bestOdds.best_book,
      price: bestOdds.best_price,
      updated_at: bestOdds.updated_at,
    } : null,
    books: bestOdds?.book_count ?? 0,
    // Top-level nba_player_id flows into HitRateProfile.nbaPlayerId for cdn.nba.com headshots
    nba_player_id: row.nba_player_id ?? playerMetadata?.nba_player_id ?? null,
    // Keep nba_ field names for schema compatibility with shared frontend components.
    // For WNBA: this object's nba_player_id is read as the canonical routing
    // playerId (URLs, RPC queries), so it MUST be the wnba_player_id, not the
    // cdn headshot id. Headshots use the separate top-level nba_player_id above.
    nba_players_hr: row.player_name ? {
      nba_player_id: row.player_id,
      name: row.player_name,
      position: playerPosition,
      depth_chart_pos: row.player_depth_chart_pos || playerMetadata?.depth_chart_pos,
      jersey_number: row.jersey_number ?? playerMetadata?.jersey_number ?? null,
    } : null,
    nba_games_hr: {
      game_date: row.game_date,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
      game_status: row.game_status,
      start_time: startTime,
    },
    nba_teams: row.primary_color ? {
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: null,
    } : null,
    matchup: effectiveDvpRank ? {
      player_id: row.player_id,
      market: row.market,
      opponent_team_id: opponentTeamId,
      player_position: normalizedPosition || playerPosition,
      matchup_rank: effectiveDvpRank,
      rank_label: row.dvp_label ?? (matchupQuality === "favorable" ? "Weak" : matchupQuality === "unfavorable" ? "Tough" : "Neutral"),
      avg_allowed: effectiveDvpAvgAllowed,
      matchup_quality: matchupQuality,
    } : null,
    pace_context: row.pace_context ?? paceContext,
  };
}

function sortData(data: any[], sort: string, sortDir: "asc" | "desc"): any[] {
  const multiplier = sortDir === "asc" ? 1 : -1;

  const fieldMap: Record<string, string> = {
    "line": "line",
    "l5Avg": "last_5_avg",
    "l10Avg": "last_10_avg",
    "seasonAvg": "season_avg",
    "streak": "hit_streak",
    "l5Pct": "last_5_pct",
    "l10Pct": "last_10_pct",
    "l20Pct": "last_20_pct",
    "seasonPct": "season_pct",
    "h2hPct": "h2h_pct",
    "matchupRank": "dvp_rank",
  };

  const dbField = fieldMap[sort];
  if (!dbField) return data;

  return [...data].sort((a, b) => {
    const aVal = a[dbField];
    const bVal = b[dbField];

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    return (aVal - bVal) * multiplier;
  });
}

function filterData(
  data: any[],
  search?: string,
  market?: string,
  playerId?: number
): any[] {
  let result = data;

  if (search?.trim()) {
    const searchLower = search.toLowerCase().trim();
    result = result.filter(row =>
      row.player_name?.toLowerCase().includes(searchLower) ||
      row.team_name?.toLowerCase().includes(searchLower) ||
      row.team_abbr?.toLowerCase().includes(searchLower)
    );
  }

  if (market) {
    result = result.filter(row => row.market === market);
  }

  if (playerId) {
    result = result.filter(row => row.player_id === playerId);
  }

  return result;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);

  const query = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    market: url.searchParams.get("market") ?? undefined,
    minHitRate: url.searchParams.get("minHitRate") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    playerId: url.searchParams.get("playerId") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    sortDir: url.searchParams.get("sortDir") ?? undefined,
    skipCache: url.searchParams.get("skipCache") ?? undefined,
    hasOdds: url.searchParams.get("hasOdds") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: query.error.flatten() },
      { status: 400 }
    );
  }

  const {
    date,
    market: rawMarket,
    minHitRate,
    limit = DEFAULT_LIMIT,
    offset = 0,
    search,
    playerId,
    sort = "l10Pct",
    sortDir = "desc",
    skipCache = false,
    hasOdds = false,
  } = query.data;

  const market = rawMarket || null;

  const todayET = getETDate();
  const tomorrowET = getETDate(1);
  const supabase = createServerSupabaseClient();

  const datesToFetch = date
    ? [date]
    : await getDefaultDatesToFetch(supabase, todayET, tomorrowET);

  try {
    let allData: any[] = [];
    let cacheHit = false;

    const canUseCache = !search && !playerId && !skipCache;

    if (canUseCache) {
      const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
      try {
        const cached = await redis.get<{ data: any[]; ts: number }>(cacheKey);
        if (cached && cached.data) {
          allData = cached.data;
          cacheHit = true;
          console.log(`[Hit Rates v2 WNBA] Cache HIT (${allData.length} profiles) in ${Date.now() - startTime}ms`);
        }
      } catch (e) {
        console.error("[Hit Rates v2 WNBA] Cache read error:", e);
      }
    }

    if (!cacheHit) {
      const dbStartTime = Date.now();

      const { data, error } = await supabase.rpc("get_wnba_hit_rate_profiles_fast_v3", {
        p_dates: datesToFetch,
        p_market: market || null,
        p_has_odds: hasOdds ? true : null,
        p_limit: market ? 500 : 3000,
        p_offset: 0,
      });

      if (error) {
        console.error("[Hit Rates v2 WNBA] RPC error:", error.message);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }

      allData = data || [];

      const dbTime = Date.now() - dbStartTime;
      const withOddsCount = allData.filter((r: any) => r.odds_selection_id).length;
      console.log(`[Hit Rates v2 WNBA] RPC fetch: ${allData.length} profiles (${withOddsCount} with odds) in ${dbTime}ms`);

      if (canUseCache && allData.length > 0) {
        const cacheKey = getCacheKey(datesToFetch, market, hasOdds);
        redis.set(cacheKey, {
          data: allData,
          ts: Date.now(),
        }, { ex: CACHE_TTL_SECONDS }).catch(e =>
          console.error("[Hit Rates v2 WNBA] Cache write error:", e)
        );
      }
    }

    let filteredData = filterData(allData, search, undefined, playerId);
    const historicalContextMap = await fetchHistoricalContextForRows(supabase, filteredData);

    filteredData = filteredData.map((row) => {
      const context = row.id ? historicalContextMap.get(row.id) : null;
      if (!context) return row;
      const hasPreviousSeasonSample = Boolean(context.seasonGames && context.seasonGames > 0);

      return {
        ...row,
        season_pct: hasPreviousSeasonSample ? context.seasonPct : null,
        season_avg: hasPreviousSeasonSample ? context.seasonAvg : null,
        season_games: context.seasonGames,
        h2h_pct: row.h2h_pct ?? context.h2hPct,
        h2h_avg: row.h2h_avg ?? context.h2hAvg,
        h2h_games: row.h2h_games && row.h2h_games > 0 ? row.h2h_games : context.h2hGames,
      };
    });

    const playerMetadataMap = await fetchPlayerMetadata(supabase, filteredData);
    const dvpRankMap = await fetchDvpRanksForRows(supabase, filteredData, playerMetadataMap);

    filteredData = filteredData.map((row) => {
      const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
      const metadata = row.player_id ? playerMetadataMap.get(row.player_id) ?? null : null;
      const position = normalizeWnbaPosition(
        row.player_depth_chart_pos ||
        row.player_position ||
        metadata?.depth_chart_pos ||
        metadata?.position
      );
      const dvp = opponentTeamId && position && row.market
        ? dvpRankMap.get(`${opponentTeamId}:${position}:${row.market}`) ?? null
        : null;

      if (!dvp || row.dvp_rank) return row;

      return {
        ...row,
        dvp_rank: dvp.rank,
        dvp_avg_allowed: dvp.avgAllowed,
        dvp_total_teams: dvp.totalTeams,
      };
    });

    filteredData = sortData(filteredData, sort, sortDir);

    if (minHitRate) {
      filteredData = filteredData.filter(row =>
        row.last_10_pct !== null && row.last_10_pct >= minHitRate
      );
    }

    const paginatedData = filteredData.slice(offset, offset + limit);

    const bestOddsStartTime = Date.now();
    const bestOddsMap = await fetchBestOddsForRows(paginatedData);
    const bestOddsTime = Date.now() - bestOddsStartTime;
    console.log(`[Hit Rates v2 WNBA] Best odds fetch: ${bestOddsMap.size} keys in ${bestOddsTime}ms`);

    const eventStartTimes = await fetchEventStartTimes(paginatedData);
    const paceRows = paginatedData.map((row) => ({
      ...row,
      team_id: row.team_id ?? getWnbaTeamIdFromAbbr(row.team_abbr),
      opponent_team_id: row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr),
    }));
    const paceContextMap = await fetchPaceContextsForRows(supabase, "wnba", paceRows);
    const gameLineContextMap = await fetchGameLineContextsForRows("wnba", paginatedData);

    const transformedData = paginatedData.map((row, index) => {
      const compositeKey = row.event_id && row.market && row.sel_key
        ? `${row.event_id}:${row.market}:${row.sel_key}`
        : null;
      const bestOdds = compositeKey ? bestOddsMap.get(compositeKey) ?? null : null;
      const eventStartTime = row.event_id ? eventStartTimes.get(row.event_id) ?? null : null;
      const playerMetadata = row.player_id ? playerMetadataMap.get(row.player_id) ?? null : null;
      const opponentTeamId = row.opponent_team_id ?? getWnbaTeamIdFromAbbr(row.opponent_team_abbr);
      const position = normalizeWnbaPosition(
        row.player_depth_chart_pos ||
        row.player_position ||
        playerMetadata?.depth_chart_pos ||
        playerMetadata?.position
      );
      const dvpRank = opponentTeamId && position && row.market
        ? dvpRankMap.get(`${opponentTeamId}:${position}:${row.market}`) ?? null
        : null;
      const paceContext = paceContextMap.get(getPaceContextKey(paceRows[index])) ?? null;
      const gameLineContext = gameLineContextMap.get(getGameLineContextKey(row)) ?? null;
      return transformProfile(row, bestOdds, eventStartTime, playerMetadata, dvpRank, paceContext, gameLineContext);
    });

    const availableDates = [...new Set(allData.map((r: any) => r.game_date))].sort();
    const primaryDate = availableDates[0] || todayET;

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        data: transformedData,
        count: filteredData.length,
        meta: {
          date: primaryDate,
          availableDates,
          market: market ?? null,
          minHitRate: minHitRate ?? null,
          limit,
          offset,
          cacheHit,
          responseTime,
          hasMore: filteredData.length > offset + limit,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[Hit Rates v2 WNBA] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
