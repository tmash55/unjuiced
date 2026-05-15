export type BasketballLeague = "nba" | "wnba";

export interface PaceRecentContext {
  l5: number | null;
  l5Rank?: number | null;
  l10: number | null;
  l10Rank?: number | null;
  l20: number | null;
  l20Rank?: number | null;
  season: number | null;
  seasonRank?: number | null;
  games: number;
  trendL5VsSeason: number | null;
}

export interface PaceContext {
  gamePace: number | null;
  teamRecent: PaceRecentContext;
  opponentRecent: PaceRecentContext;
  matchupL5Pace: number | null;
  matchupL10Pace: number | null;
  opponentTrend: number | null;
  paceDelta: number | null;
  paceLabel: "pace_up" | "pace_down" | "neutral";
  confidence: "high" | "medium" | "low";
}

interface PaceProfileRow {
  game_id?: string | number | null;
  game_date?: string | null;
  season_type?: string | null;
  team_id?: number | null;
  opponent_team_id?: number | null;
  pace_context?: PaceContext | null;
}

interface PaceTableRow {
  season: string | null;
  season_type?: string | null;
  game_id: string | number | null;
  game_date: string | null;
  team_id: number | null;
  pace: number | null;
}

interface PaceRankContext {
  l5: Map<number, number>;
  l10: Map<number, number>;
  l20: Map<number, number>;
  season: Map<number, number>;
}

interface PaceRankingRow {
  league: BasketballLeague;
  season: string | null;
  season_type: string | null;
  pace_window: "l5" | "l10" | "l20" | "season" | string | null;
  team_id: number | null;
  games_played: number | null;
  pace: number | null;
  pace_rank: number | null;
}

interface PaceRankingSnapshot {
  l5?: PaceRankingRow;
  l10?: PaceRankingRow;
  l20?: PaceRankingRow;
  season?: PaceRankingRow;
}

const roundPace = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
};

const average = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  return roundPace(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

function toDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function inferSeasonFromDate(league: BasketballLeague, value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  const year = date.getFullYear();
  if (!Number.isFinite(year)) return null;
  if (league === "wnba") return String(year);

  const month = date.getMonth() + 1;
  if (month >= 7) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

function getPreviousSeason(league: BasketballLeague, season: string | null) {
  if (!season) return null;
  if (league === "wnba") {
    const year = Number(season);
    return Number.isFinite(year) ? String(year - 1) : null;
  }

  const startYear = Number(season.slice(0, 4));
  return Number.isFinite(startYear) ? `${startYear - 1}-${String(startYear).slice(-2)}` : null;
}

export function normalizeBasketballSeasonType(
  seasonType?: string | null,
  league?: BasketballLeague,
  gameDate?: string | null
) {
  const normalized = String(seasonType || "").toLowerCase();
  if (/\b(cup|in-season|ist|emirates|commissioner)\b/.test(normalized)) {
    return "Regular Season";
  }
  if (normalized.includes("playoff") || normalized.includes("round") || normalized.includes("final")) {
    return "Playoffs";
  }
  if (normalized.includes("regular")) return "Regular Season";
  if (normalized.includes("preseason")) return "Preseason";

  if (league === "nba" && gameDate) {
    const date = new Date(`${gameDate.slice(0, 10)}T12:00:00`);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (month > 4 || (month === 4 && day >= 15)) return "Playoffs";
  }

  return "Regular Season";
}

export function getPaceContextKey(row: PaceProfileRow) {
  return [
    row.game_id ?? "",
    row.game_date ?? "",
    row.team_id ?? "",
    row.opponent_team_id ?? "",
  ].join(":");
}

function buildRecent(rows: PaceTableRow[], profileSeason: string | null, teamId?: number | null, ranks?: PaceRankContext): PaceRecentContext {
  const sorted = [...rows].sort((a, b) => toDateKey(b.game_date).localeCompare(toDateKey(a.game_date)));
  const l5 = average(sorted.slice(0, 5).map((row) => row.pace));
  const l10 = average(sorted.slice(0, 10).map((row) => row.pace));
  const l20 = average(sorted.slice(0, 20).map((row) => row.pace));
  const seasonRows = profileSeason ? sorted.filter((row) => row.season === profileSeason) : [];
  const season = seasonRows.length > 0 ? average(seasonRows.map((row) => row.pace)) : null;
  const trendL5VsSeason = l5 !== null && season !== null ? roundPace(l5 - season) : null;

  return {
    l5,
    l5Rank: teamId ? ranks?.l5.get(teamId) ?? null : null,
    l10,
    l10Rank: teamId ? ranks?.l10.get(teamId) ?? null : null,
    l20,
    l20Rank: teamId ? ranks?.l20.get(teamId) ?? null : null,
    season,
    seasonRank: teamId ? ranks?.season.get(teamId) ?? null : null,
    games: Math.min(sorted.length, 20),
    trendL5VsSeason,
  };
}

function rankTeamsByAverage(
  rowsByTeam: Map<number, PaceTableRow[]>,
  window: 5 | 10 | 20 | "season",
  profileSeason: string | null
) {
  const averages: Array<{ teamId: number; value: number }> = [];

  for (const [teamId, rows] of rowsByTeam.entries()) {
    const sorted = [...rows].sort((a, b) => toDateKey(b.game_date).localeCompare(toDateKey(a.game_date)));
    const sourceRows = window === "season" && profileSeason
      ? sorted.filter((row) => row.season === profileSeason)
      : sorted;
    // Early-season WNBA expansion teams can have real pace rows before they
    // have a full L5/L10 sample. Rank the available sample so pace context is
    // present instead of blank until the fifth game.
    if (sourceRows.length === 0) continue;
    const sample = window === "season" ? sourceRows : sourceRows.slice(0, window);
    const value = average(sample.map((row) => row.pace));
    if (value !== null) averages.push({ teamId, value });
  }

  averages.sort((a, b) => b.value - a.value);
  return new Map(averages.map((entry, index) => [entry.teamId, index + 1]));
}

function buildRankContext(rowsByTeam: Map<number, PaceTableRow[]>, profileSeason: string | null): PaceRankContext {
  return {
    l5: rankTeamsByAverage(rowsByTeam, 5, profileSeason),
    l10: rankTeamsByAverage(rowsByTeam, 10, profileSeason),
    l20: rankTeamsByAverage(rowsByTeam, 20, profileSeason),
    season: rankTeamsByAverage(rowsByTeam, "season", profileSeason),
  };
}

function classifyPace(matchupL5: number | null, matchupL10: number | null): PaceContext["paceLabel"] {
  if (matchupL5 === null || matchupL10 === null) return "neutral";
  const delta = matchupL5 - matchupL10;
  if (delta >= 1.5) return "pace_up";
  if (delta <= -1.5) return "pace_down";
  return "neutral";
}

function classifyConfidence(teamGames: number, opponentGames: number): PaceContext["confidence"] {
  if (teamGames >= 10 && opponentGames >= 10) return "high";
  if (teamGames >= 5 && opponentGames >= 5) return "medium";
  return "low";
}

function buildRankingIndex(rows: PaceRankingRow[]) {
  const index = new Map<string, PaceRankingSnapshot>();

  for (const row of rows) {
    if (!row.team_id || !row.pace_window || !row.season) continue;
    const seasonType = normalizeBasketballSeasonType(row.season_type);
    const key = `${row.season}:${seasonType}:${row.team_id}`;
    const current = index.get(key) ?? {};
    if (row.pace_window === "l5" || row.pace_window === "l10" || row.pace_window === "l20" || row.pace_window === "season") {
      current[row.pace_window] = row;
    }
    index.set(key, current);
  }

  return index;
}

function getRankingSnapshot(
  index: Map<string, PaceRankingSnapshot>,
  league: BasketballLeague,
  teamId: number | null | undefined,
  profileSeason: string | null,
  profileSeasonType: string
) {
  if (!teamId) return null;
  const previousSeason = getPreviousSeason(league, profileSeason);
  const candidates = [
    profileSeason ? `${profileSeason}:${profileSeasonType}:${teamId}` : null,
    profileSeasonType !== "Regular Season" && profileSeason ? `${profileSeason}:Regular Season:${teamId}` : null,
    previousSeason ? `${previousSeason}:Regular Season:${teamId}` : null,
    previousSeason ? `${previousSeason}:${profileSeasonType}:${teamId}` : null,
  ].filter(Boolean) as string[];

  for (const key of candidates) {
    const snapshot = index.get(key);
    if (snapshot) return snapshot;
  }

  return null;
}

function applyRankingSnapshot(recent: PaceRecentContext, snapshot: PaceRankingSnapshot | null): PaceRecentContext {
  if (!snapshot) return recent;
  const l5 = recent.l5 ?? roundPace(snapshot.l5?.pace);
  const l10 = recent.l10 ?? roundPace(snapshot.l10?.pace);
  const l20 = recent.l20 ?? roundPace(snapshot.l20?.pace);
  const season = recent.season ?? roundPace(snapshot.season?.pace);
  const games = Math.max(
    recent.games,
    snapshot.l5?.games_played ?? 0,
    snapshot.l10?.games_played ?? 0,
    snapshot.l20?.games_played ?? 0,
    snapshot.season?.games_played ?? 0
  );

  return {
    l5,
    l5Rank: recent.l5Rank ?? snapshot.l5?.pace_rank ?? null,
    l10,
    l10Rank: recent.l10Rank ?? snapshot.l10?.pace_rank ?? null,
    l20,
    l20Rank: recent.l20Rank ?? snapshot.l20?.pace_rank ?? null,
    season,
    seasonRank: recent.seasonRank ?? snapshot.season?.pace_rank ?? null,
    games,
    trendL5VsSeason: l5 !== null && season !== null ? roundPace(l5 - season) : recent.trendL5VsSeason,
  };
}

function buildContext(
  league: BasketballLeague,
  row: PaceProfileRow,
  teamRows: PaceTableRow[],
  opponentRows: PaceTableRow[],
  exactGamePace: number | null,
  ranks: PaceRankContext,
  rankingIndex: Map<string, PaceRankingSnapshot>
): PaceContext {
  const profileSeason = inferSeasonFromDate(league, row.game_date);
  const profileSeasonType = normalizeBasketballSeasonType(row.season_type, league, row.game_date);
  const teamRanking = getRankingSnapshot(rankingIndex, league, row.team_id, profileSeason, profileSeasonType);
  const opponentRanking = getRankingSnapshot(rankingIndex, league, row.opponent_team_id, profileSeason, profileSeasonType);
  const teamRecent = applyRankingSnapshot(buildRecent(teamRows, profileSeason, row.team_id, ranks), teamRanking);
  const opponentRecent = applyRankingSnapshot(buildRecent(opponentRows, profileSeason, row.opponent_team_id, ranks), opponentRanking);
  const matchupL5Pace = average([teamRecent.l5, opponentRecent.l5]);
  const matchupL10Pace = average([teamRecent.l10, opponentRecent.l10]);
  const opponentBaseline = opponentRecent.season ?? opponentRecent.l20;
  const opponentTrend = opponentRecent.l5 !== null && opponentBaseline !== null
    ? roundPace(opponentRecent.l5 - opponentBaseline)
    : null;
  const paceDelta = opponentRecent.l5 !== null && teamRecent.l5 !== null
    ? roundPace(opponentRecent.l5 - teamRecent.l5)
    : null;

  return {
    gamePace: roundPace(exactGamePace),
    teamRecent,
    opponentRecent,
    matchupL5Pace,
    matchupL10Pace,
    opponentTrend,
    paceDelta,
    paceLabel: classifyPace(matchupL5Pace, matchupL10Pace),
    confidence: classifyConfidence(teamRecent.games, opponentRecent.games),
  };
}

export async function fetchPaceContextsForRows(
  supabase: any,
  league: BasketballLeague,
  rows: PaceProfileRow[]
): Promise<Map<string, PaceContext>> {
  const rowsNeedingPace = rows.filter((row) => row.game_date && row.team_id && row.opponent_team_id);
  const result = new Map<string, PaceContext>();

  for (const row of rows) {
    if (row.pace_context) {
      result.set(getPaceContextKey(row), row.pace_context);
    }
  }

  if (rowsNeedingPace.length === 0) return result;

  const teamIds = Array.from(new Set(rowsNeedingPace.flatMap((row) => [row.team_id, row.opponent_team_id]).filter(Boolean))) as number[];
  const maxGameDate = rowsNeedingPace
    .map((row) => row.game_date!)
    .sort()
    .at(-1)!;

  const [{ data: historyRows, error: historyError }, { data: rankingRows, error: rankingError }] = await Promise.all([
    supabase
      .from("basketball_team_game_pace")
      .select("season, season_type, game_id, game_date, team_id, pace")
      .eq("league", league)
      .lt("game_date", maxGameDate)
      .order("game_date", { ascending: false })
      .limit(6000),
    supabase
      .from("basketball_team_pace_rankings")
      .select("league, season, season_type, pace_window, team_id, games_played, pace, pace_rank")
      .eq("league", league),
  ]);

  if (historyError) {
    console.error(`[pace-context] ${league} history fetch error:`, historyError.message);
    return result;
  }

  if (rankingError) {
    console.error(`[pace-context] ${league} ranking fetch error:`, rankingError.message);
  }

  const numericGameIds = Array.from(
    new Set(
      rowsNeedingPace
        .map((row) => Number(row.game_id))
        .filter((gameId) => Number.isFinite(gameId) && gameId > 0)
    )
  );

  let exactRows: PaceTableRow[] = [];
  if (numericGameIds.length > 0) {
    const { data, error } = await supabase
      .from("basketball_team_game_pace")
      .select("season, season_type, game_id, game_date, team_id, pace")
      .eq("league", league)
      .in("game_id", numericGameIds)
      .in("team_id", teamIds);

    if (error) {
      console.error(`[pace-context] ${league} exact game fetch error:`, error.message);
    } else {
      exactRows = data ?? [];
    }
  }

  const historyByTeam = new Map<number, PaceTableRow[]>();
  for (const paceRow of (historyRows ?? []) as PaceTableRow[]) {
    if (!paceRow.team_id) continue;
    const existing = historyByTeam.get(paceRow.team_id) ?? [];
    existing.push(paceRow);
    historyByTeam.set(paceRow.team_id, existing);
  }

  const rankingIndex = buildRankingIndex((rankingRows ?? []) as PaceRankingRow[]);
  const exactPaceByGameTeam = new Map<string, number | null>();
  for (const paceRow of exactRows) {
    if (!paceRow.game_id || !paceRow.team_id) continue;
    exactPaceByGameTeam.set(`${paceRow.game_id}:${paceRow.team_id}`, paceRow.pace);
  }

  for (const row of rowsNeedingPace) {
    const key = getPaceContextKey(row);
    if (result.has(key)) continue;

    const gameDate = row.game_date!;
    const profileSeason = inferSeasonFromDate(league, gameDate);
    const rowsBeforeProfileDate = new Map<number, PaceTableRow[]>();
    for (const [teamId, paceRows] of historyByTeam.entries()) {
      rowsBeforeProfileDate.set(
        teamId,
        paceRows.filter((paceRow) => toDateKey(paceRow.game_date) < gameDate)
      );
    }
    const ranks = buildRankContext(rowsBeforeProfileDate, profileSeason);
    const teamRows = (historyByTeam.get(row.team_id!) ?? []).filter((paceRow) => toDateKey(paceRow.game_date) < gameDate);
    const opponentRows = (historyByTeam.get(row.opponent_team_id!) ?? []).filter((paceRow) => toDateKey(paceRow.game_date) < gameDate);
    const exactGamePace = row.game_id && row.team_id
      ? exactPaceByGameTeam.get(`${Number(row.game_id)}:${row.team_id}`) ?? null
      : null;

    result.set(key, buildContext(league, row, teamRows, opponentRows, exactGamePace, ranks, rankingIndex));
  }

  return result;
}
