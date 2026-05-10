export type QuickViewSport = "nba" | "wnba" | "mlb";

export interface QuickViewGameContext {
  gameId?: number | string | null;
  gameDate?: string | null;
  gameDatetime?: string | null;
  gameStatus?: string | null;
  homeAway?: "H" | "A" | null;
  opponentTeamAbbr?: string | null;
  opposingPitcherName?: string | null;
  opposingPitcherId?: number | string | null;
}

const SUPPORTED_QUICK_VIEW_SPORTS = new Set(["nba", "wnba", "mlb"]);

// Sport keys ship in different shapes depending on where they originate. The
// EV / odds APIs use the long basketball_nba / basketball_wnba / baseball_mlb
// form; the hit-rate APIs and our own UI prefer the short nba / wnba / mlb.
// Map both to the short form before checking support.
const SPORT_KEY_ALIASES: Record<string, QuickViewSport> = {
  basketball_nba: "nba",
  basketball_wnba: "wnba",
  baseball_mlb: "mlb",
};

const MLB_QUICK_VIEW_MARKET_ALIASES: Record<string, string> = {
  player_runs: "player_runs_scored",
  player_rbis: "player_rbi",
  batter_rbis: "player_rbi",
  batter_hits: "player_hits",
  batter_home_runs: "player_home_runs",
  batter_total_bases: "player_total_bases",
  batter_stolen_bases: "player_stolen_bases",
  player_steals: "player_stolen_bases",
  stolen_bases: "player_stolen_bases",
  batter_hits_runs_rbis: "player_hits__runs__rbis",
  player_strikeouts: "pitcher_strikeouts",
  pitcher_strikeouts: "pitcher_strikeouts",
  player_hits_allowed: "pitcher_hits_allowed",
  pitcher_hits_allowed: "pitcher_hits_allowed",
  player_earned_runs: "pitcher_earned_runs",
  pitcher_earned_runs: "pitcher_earned_runs",
  player_outs: "pitcher_outs",
  pitcher_outs: "pitcher_outs",
  pitcher_outs_recorded: "pitcher_outs",
  player_walks_allowed: "pitcher_walks",
  pitcher_walks: "pitcher_walks",
  pitcher_walks_allowed: "pitcher_walks",
};

export function getQuickViewSport(sport?: string | null): QuickViewSport | null {
  const normalized = sport?.toLowerCase();
  if (!normalized) return null;
  if (SPORT_KEY_ALIASES[normalized]) return SPORT_KEY_ALIASES[normalized];
  return SUPPORTED_QUICK_VIEW_SPORTS.has(normalized)
    ? (normalized as QuickViewSport)
    : null;
}

export function normalizeQuickViewMarket(sport: QuickViewSport, market?: string | null): string {
  // WNBA shares the NBA market vocabulary (player_points, player_rebounds, …).
  const normalized = market || (sport === "mlb" ? "player_hits" : "player_points");
  if (sport !== "mlb") return normalized;
  return MLB_QUICK_VIEW_MARKET_ALIASES[normalized] || normalized;
}

export function parseQuickViewPlayerId(value?: string | number | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildQuickViewGameContext({
  gameId,
  startTime,
  gameDate,
  gameStatus,
  homeTeam,
  awayTeam,
  playerTeam,
  opposingPitcherName,
  opposingPitcherId,
  homeProbablePitcherId,
  awayProbablePitcherId,
}: {
  gameId?: number | string | null;
  startTime?: string | null;
  gameDate?: string | null;
  gameStatus?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  playerTeam?: string | null;
  opposingPitcherName?: string | null;
  opposingPitcherId?: number | string | null;
  homeProbablePitcherId?: number | string | null;
  awayProbablePitcherId?: number | string | null;
}): QuickViewGameContext | undefined {
  if (!homeTeam || !awayTeam) return undefined;

  const normalizedPlayerTeam = playerTeam?.toUpperCase() ?? null;
  const normalizedHome = homeTeam.toUpperCase();
  const normalizedAway = awayTeam.toUpperCase();
  const homeAway =
    normalizedPlayerTeam === normalizedHome
      ? "H"
      : normalizedPlayerTeam === normalizedAway
      ? "A"
      : null;
  const opponentTeamAbbr =
    homeAway === "H"
      ? awayTeam
      : homeAway === "A"
      ? homeTeam
      : null;

  if (!opponentTeamAbbr) return undefined;

  const resolvedDate = gameDate || (startTime ? startTime.split("T")[0] : null);
  const resolvedOpposingPitcherId =
    opposingPitcherId ?? (homeAway === "H" ? awayProbablePitcherId : homeAway === "A" ? homeProbablePitcherId : null);

  return {
    gameId: gameId ?? null,
    gameDate: resolvedDate,
    gameDatetime: startTime ?? null,
    gameStatus: gameStatus ?? null,
    homeAway,
    opponentTeamAbbr,
    opposingPitcherName: opposingPitcherName ?? null,
    opposingPitcherId: resolvedOpposingPitcherId ?? null,
  };
}
