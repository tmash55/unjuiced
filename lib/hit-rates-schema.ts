// Matchup rank data from get_matchup_ranks_batch RPC
export interface MatchupRank {
  player_id: number;
  market: string;
  opponent_team_id: number;
  player_position: string | null;
  matchup_rank: number | null;
  rank_label: string | null;
  avg_allowed: number | null;
  matchup_quality: "favorable" | "neutral" | "unfavorable" | null;
}

export interface RawHitRateProfile {
  id: string;
  player_id: number;
  team_id: number | null;
  team_name: string | null;
  team_abbr: string | null;
  player_name?: string | null;
  player_position?: string | null;
  opponent_team_id: number | null;
  opponent_team_name: string | null;
  opponent_team_abbr: string | null;
  market: string;
  line: number | null;
  game_id: string | null;
  game_date: string | null;
  start_time?: string | null;
  commence_time?: string | null;
  event_id: string | null;
  last_5_pct: number | null;
  last_10_pct: number | null;
  last_20_pct: number | null;
  season_pct: number | null;
  h2h_pct: number | null;
  h2h_avg: number | null;
  h2h_games: number | null;
  last_5_avg: number | null;
  last_10_avg: number | null;
  last_20_avg: number | null;
  season_avg: number | null;
  hit_streak: number | null;
  spread: number | null;
  total: number | null;
  injury_status: string | null;
  injury_notes: string | null;
  position: string | null;
  jersey_number: number | null;
  game_logs: unknown[] | null;
  is_primetime: boolean | null;
  national_broadcast: string | null;
  home_away: string | null; // "H" or "A"
  odds_selection_id: string | null;
  sel_key: string | null; // Key used for Redis odds lookup (linesidx, booksidx, bestodds)
  // Best odds from Redis (returned by v2 API)
  best_odds?: {
    book: string;
    price: number;
    updated_at: number;
  } | null;
  books?: number; // Number of books with odds
  // Matchup data (merged from RPC)
  matchup?: MatchupRank | null;
  nba_players_hr?: {
    nba_player_id: number;
    name: string;
    position: string | null;
    depth_chart_pos: string | null; // Specific position: PG, SG, SF, PF, C
    jersey_number: number | null;
  } | null;
  nba_games_hr?: {
    game_date: string | null;
    home_team_name: string | null;
    away_team_name: string | null;
    game_status: string | null;
    start_time?: string | null;
  } | null;
  nba_teams?: {
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
  } | null;
}

export interface HitRateProfile {
  id: string;
  playerId: number;
  playerName: string;
  teamId: number | null;
  teamAbbr: string | null;
  teamName: string | null;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  opponentTeamName: string | null;
  market: string;
  line: number | null;
  gameId: string | null;
  eventId: string | null;
  hitStreak: number | null;
  last5Pct: number | null;
  last10Pct: number | null;
  last20Pct: number | null;
  seasonPct: number | null;
  h2hPct: number | null; // Head-to-head percentage vs this opponent
  h2hAvg: number | null; // Average stat value vs this opponent
  h2hGames: number | null; // Number of games vs this opponent (sample size)
  last5Avg: number | null;
  last10Avg: number | null;
  last20Avg: number | null;
  seasonAvg: number | null;
  spread: number | null;
  total: number | null;
  injuryStatus: string | null;
  injuryNotes: string | null;
  position: string | null;
  jerseyNumber: number | null;
  gameDate: string | null;
  startTime: string | null;
  gameStatus: string | null;
  // gameLogs removed - fetched separately via usePlayerBoxScores for drilldown
  gameLogs?: unknown[] | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  isPrimetime: boolean | null;
  nationalBroadcast: string | null;
  homeAway: string | null; // "H" or "A"
  oddsSelectionId: string | null;
  selKey: string | null; // Key used for Redis odds lookup (linesidx, booksidx, bestodds)
  // Matchup data
  matchupRank: number | null;
  matchupRankLabel: string | null;
  matchupAvgAllowed: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable" | null;
  // Best odds from Redis (returned by v2 API)
  bestOdds: {
    book: string;
    price: number;
    updated_at: number;
  } | null;
  books: number; // Number of books with odds
}

export interface HitRateResponse {
  data: RawHitRateProfile[];
  count: number;
  meta: {
    date: string;
    availableDates: string[]; // Dates with profiles (today, tomorrow, etc.)
    market: string | null;
    minHitRate: number | null;
    limit: number;
    offset: number;
  };
}
