export interface PropScorePlayer {
  player_id: number;
  player_name: string;
  player_type: "batter" | "pitcher";
  team_abbr: string;
  game_id: number;
  game_date: string;
  market: string;
  composite_score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  factor_scores: Record<string, number>;
  key_stats: Record<string, any>;
  expanded_stats: Record<string, any>;
  opponent_name: string;
  batting_order: number | null;
  lineup_status: "confirmed" | "projected" | "roster" | null;
  line: number | null;
  best_odds: number | null;
  best_odds_book: string | null;
  best_odds_decimal: number | null;
  implied_prob: number | null;
  model_prob: number | null;
  edge_pct: number | null;
  odds_snapshot: Record<string, {
    line: number;
    over: number | null;
    under: number | null;
    link?: string | null;
    mobile_link: string | null;
    odd_id?: string | null;
  }> | null;
  // Results (populated after game resolves)
  actual_stat?: number | null;
  hit_over?: boolean | null;
  resolved_at?: string | null;
  // Added by new API
  game_time?: string | null;
  venue_name?: string | null;
  best_odds_link?: string | null;
  best_odds_mobile_link?: string | null;
}

export interface LineupPlayer {
  batting_order: number;
  player_name: string;
  position: string;
  bats: string;
}

export interface PropScoreResponse {
  players?: PropScorePlayer[];
  scores?: PropScorePlayer[];
  lineups?: Record<string, { home: LineupPlayer[]; away: LineupPlayer[] }>;
  meta: {
    date: string;
    market?: string | null;
    totalPlayers?: number;
    totalScores?: number;
    availableDates: string[];
    oddsMatched?: number;
    markets?: string[];
  };
}
