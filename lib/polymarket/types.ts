/**
 * Polymarket Whale Board Types
 *
 * Elite-tier feature: real-time whale bet tracking + leaderboard
 */

export type WalletTier = "S" | "A" | "B" | "C" | "FADE" | "NEW";

export interface WalletScore {
  wallet_address: string;
  wallet_username: string | null;
  display_name: string | null;
  avatar_url: string | null;

  // Ranking
  rank: number;
  tier: WalletTier;
  composite_score: number;

  // Stats
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  roi: number | null;
  total_wagered: number;
  total_profit: number;
  avg_stake: number;
  median_stake: number;
  max_stake: number;
  avg_entry_price: number | null;
  avg_american_odds: number | null;

  // Sharpness
  clv_avg: number | null;
  beat_close_pct: number | null;

  // Streaks
  current_streak: number;
  best_win_streak: number;
  worst_loss_streak: number;
  last_bet_at: string | null;
  first_bet_at: string | null;
  active_days: number;

  // Breakdowns
  sport_breakdown: Record<
    string,
    { w: number; l: number; bets: number; wagered: number; profit: number; roi: number }
  >;
  market_breakdown: Record<
    string,
    { w: number; l: number; bets: number; wagered: number; profit: number; roi: number }
  >;
  primary_sport: string | null;
  primary_market: string | null;

  // Polymarket profile
  poly_pnl: number | null;
  poly_rank: number | null;
  poly_volume: number | null;
  poly_month_pnl: number | null;
  poly_week_pnl: number | null;
  poly_month_rank: number | null;
  poly_week_rank: number | null;
  hot_cold: "hot" | "cold" | null;

  // Notable plays
  biggest_win_pnl: number | null;
  biggest_win_title: string | null;
  biggest_win_odds: number | null;
  biggest_bet_size: number | null;
  biggest_bet_title: string | null;

  // Account
  is_new_account: boolean;
}

export interface BookOdds {
  book: string;
  line?: string | number | null;
  price?: string | number | null;
  decimal?: number | null;
  implied?: number | null;
  american?: number | null;
  displayBook?: string;
}

export interface WhaleSignal {
  id: number;
  tier: string;
  wallet_address: string;
  wallet_username: string | null;
  wallet_pnl: number | null;

  // Market info
  market_title: string;
  market_type: string | null;
  sport: string | null;
  outcome: string;
  side: string;
  token_id?: string | null;
  
  // New fields for v0 integration
  event_title: string | null;
  league: string | null;
  home_team: string | null;
  away_team: string | null;
  market_label: string | null;

  // Pricing
  entry_price: number;
  american_odds: number | null;
  bet_size: number;
  implied_probability: number | null;

  // Game info
  game_start_time: string | null;
  game_date: string | null;

  // Sportsbook cross-reference
  book_name: string | null;
  book_price: string | null;
  best_book: string | null;
  best_book_price: string | null;
  best_book_decimal: number | null;

  // Resolution
  resolved: boolean;
  result: "win" | "loss" | null;
  pnl: number | null;

  // Quality
  quality_score: number | null;

  // All sportsbook odds for this market/outcome
  all_book_odds: BookOdds[] | null;

  created_at: string;

  // Enriched fields (added by API)
  wallet_rank?: number;
  wallet_tier?: WalletTier;
  wallet_roi?: number | null;
  wallet_record?: string;
  wallet_total_bets?: number | null;
  wallet_avg_stake?: number | null;
  wallet_total_profit?: number | null;
  wallet_lifetime_volume?: number | null;  // From Polymarket leaderboard
  wallet_polymarket_rank?: number | null;  // Sports leaderboard rank
  wallet_poly_pnl?: number | null;         // Lifetime Polymarket PNL
  wallet_poly_month_pnl?: number | null;   // Last 30d PNL
  wallet_poly_week_pnl?: number | null;    // Last 7d PNL
  wallet_hot_cold?: "hot" | "cold" | null; // Recent form indicator
  stake_vs_avg?: number | null; // multiplier vs avg stake

  // Composite signal score
  signal_score?: number;     // 0.0 - 10.0
  signal_label?: string;     // 🔥 ⭐ 👍 👀
  score_breakdown?: {
    bettor: number;
    conviction: number;
    edge: number;
    recency: number;
  };

  // Aggregation fields (when multiple fills are merged)
  wager_count?: number;       // Number of individual fills
  fills?: {                   // Individual fill details
    price: number;            // Entry price (0-1)
    size: number;             // USD amount
    created_at: string;       // Timestamp
    american_odds: number | null;
  }[];
  total_shares?: number;      // Total shares across all fills

  // Odds matching fields
  odds_event_id?: string | null;
  odds_sport?: string | null;
  odds_market_key?: string | null;
  odds_confidence?: number | null;

  // Live sportsbook odds
  live_odds?: LiveOdds | null;
}

export interface LeaderboardResponse {
  wallets: WalletScore[];
  total: number;
  updated_at: string | null;
}

export interface FeedResponse {
  signals: WhaleSignal[];
  total: number;
}

export interface LiveOddsEntry {
  book: string;
  price: string;
  decimal: number;
  line?: string;
  mobile_link?: string;
}

export interface LiveOdds {
  best: LiveOddsEntry;
  all: LiveOddsEntry[];
  updated_at?: string;
}

export interface SignalPreferences {
  signal_followed_wallets?: string[];
  signal_sport_filters?: string[] | null;
  signal_excluded_sports?: string[] | null;
  signal_tier_filters?: string[] | null;
  signal_min_stake?: number;
  signal_sort_by?: string;
  signal_show_resolved?: boolean;
  signal_timeframe?: string;
  signal_alert_enabled?: boolean;
  signal_alert_min_stake?: number;
  signal_alert_sports?: string[] | null;
  signal_alert_wallets?: string[] | null;
}

export interface WalletDetailResponse {
  wallet: WalletScore;
  recent_bets: WhaleSignal[];
  sport_stats: Record<string, { w: number; l: number; roi: number }>;
}
