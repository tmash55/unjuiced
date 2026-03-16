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

  // Notable plays
  biggest_win_pnl: number | null;
  biggest_win_title: string | null;
  biggest_win_odds: number | null;
  biggest_bet_size: number | null;
  biggest_bet_title: string | null;

  // Account
  is_new_account: boolean;
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

  created_at: string;

  // Enriched fields (added by API)
  wallet_rank?: number;
  wallet_tier?: WalletTier;
  wallet_roi?: number | null;
  wallet_record?: string;
  stake_vs_avg?: number | null; // multiplier vs avg stake
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

export interface WalletDetailResponse {
  wallet: WalletScore;
  recent_bets: WhaleSignal[];
  sport_stats: Record<string, { w: number; l: number; roi: number }>;
}
