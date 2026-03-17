/**
 * Sharp Signals — Composite Signal Score (0-100)
 *
 * Inspired by OddsJam Insiders scoring:
 *   - Stake conviction (bet size × multiplier vs avg) is the #1 factor
 *   - Bettor quality (tier, rank, ROI, sample) is #2
 *   - Edge (poly vs sportsbook) is a bonus
 *   - Recency keeps stale signals from floating to the top
 *
 * Weights:
 *   Bettor quality           35%
 *   Stake conviction         35%
 *   Edge / odds value        15%
 *   Recency                  15%
 */

export interface ScoreInput {
  tier: string;
  bet_size: number;
  wallet_avg_stake?: number | null;
  wallet_roi?: number | null;
  wallet_win_rate?: number | null;
  wallet_total_bets?: number | null;
  wallet_rank?: number | null;
  wallet_pnl?: number | null;
  clv_avg?: number | null;
  american_odds?: number | null;
  entry_price?: number | null;
  book_implied?: number | null;
  quality_score?: number | null;
  created_at: string;
}

export interface ScoreResult {
  total: number;         // 0 - 100
  breakdown: {
    bettor: number;      // 0-100
    conviction: number;  // 0-100
    edge: number;        // 0-100
    recency: number;     // 0-100
  };
  label: "🔥" | "⭐" | "👍" | "👀";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Bettor quality (35% weight)
 * Based on tier, rank, PnL, win rate, sample size
 * A top-50 leaderboard sharp with 500+ bets and 60%+ WR = 100
 */
function scoreBettor(input: ScoreInput): number {
  let score = 0;

  // Tier base (0-30)
  if (input.tier === "sharp") score += 25;
  else if (input.tier === "whale") score += 20;
  else score += 5;

  // Leaderboard rank bonus (0-25)
  const rank = input.wallet_rank;
  if (rank != null && rank > 0) {
    if (rank <= 10) score += 25;
    else if (rank <= 25) score += 20;
    else if (rank <= 50) score += 15;
    else if (rank <= 100) score += 10;
    else if (rank <= 250) score += 5;
  }

  // PnL bonus (0-15)
  const pnl = input.wallet_pnl;
  if (pnl != null) {
    if (pnl >= 500000) score += 15;
    else if (pnl >= 200000) score += 12;
    else if (pnl >= 100000) score += 10;
    else if (pnl >= 50000) score += 7;
    else if (pnl >= 10000) score += 5;
    else if (pnl > 0) score += 3;
  }

  // Win rate bonus (0-15, only with decent sample)
  const wr = input.wallet_win_rate;
  const bets = input.wallet_total_bets ?? 0;
  if (wr != null && bets >= 10) {
    if (wr >= 0.65) score += 15;
    else if (wr >= 0.60) score += 12;
    else if (wr >= 0.55) score += 8;
    else if (wr >= 0.50) score += 5;
  }

  // Sample size bonus (0-15)
  if (bets >= 500) score += 15;
  else if (bets >= 200) score += 12;
  else if (bets >= 100) score += 8;
  else if (bets >= 50) score += 5;
  else if (bets >= 20) score += 3;

  return clamp(score, 0, 100);
}

/**
 * Stake conviction (35% weight)
 * How much are they betting relative to their average?
 * OddsJam style: 1.6x+ is notable, 3x+ is high conviction, 10x+ is max
 * Absolute bet size also matters
 */
function scoreConviction(input: ScoreInput): number {
  let score = 0;

  // Stake vs average multiplier (0-50)
  const avg = input.wallet_avg_stake;
  if (avg && avg > 0) {
    const multiplier = input.bet_size / avg;
    if (multiplier >= 10) score += 50;
    else if (multiplier >= 5) score += 42;
    else if (multiplier >= 3) score += 35;
    else if (multiplier >= 2) score += 28;
    else if (multiplier >= 1.5) score += 22;
    else if (multiplier >= 1.2) score += 18;
    else if (multiplier >= 1.0) score += 14;
    else score += 8; // Below average bet
  } else {
    // No avg stake data — use absolute size as proxy
    score += 15;
  }

  // Absolute bet size (0-50)
  if (input.bet_size >= 50000) score += 50;
  else if (input.bet_size >= 25000) score += 42;
  else if (input.bet_size >= 10000) score += 35;
  else if (input.bet_size >= 5000) score += 28;
  else if (input.bet_size >= 2000) score += 20;
  else if (input.bet_size >= 1000) score += 15;
  else if (input.bet_size >= 500) score += 10;
  else score += 5;

  return clamp(score, 0, 100);
}

/**
 * Edge / odds value (15% weight)
 * Polymarket price vs sportsbook implied probability
 * Plus money is more valuable than heavy juice
 */
function scoreEdge(input: ScoreInput): number {
  let score = 30; // Base score — we don't penalize for missing data

  // Edge from polymarket vs book
  const polyProb = input.entry_price ?? 0;
  const bookProb = input.book_implied ?? 0;
  if (polyProb > 0 && bookProb > 0) {
    const edge = polyProb - bookProb;
    if (edge >= 0.15) score += 40;
    else if (edge >= 0.10) score += 30;
    else if (edge >= 0.05) score += 20;
    else if (edge >= 0.02) score += 10;
    else if (edge > 0) score += 5;
  }

  // Odds value — plus money is better for the bettor
  const odds = input.american_odds ?? 0;
  if (odds >= 300) score += 25;
  else if (odds >= 200) score += 20;
  else if (odds >= 100) score += 15;
  else if (odds >= 0) score += 10;
  else if (odds >= -150) score += 5;

  // Quality score tiebreaker (0-5)
  if (input.quality_score) {
    score += input.quality_score;
  }

  return clamp(score, 0, 100);
}

/**
 * Recency (15% weight)
 * Fresh signals are more actionable. Decays over time.
 */
function scoreRecency(input: ScoreInput): number {
  const ageMs = Date.now() - new Date(input.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 0.25) return 100;
  if (ageHours <= 0.5) return 95;
  if (ageHours <= 1) return 85;
  if (ageHours <= 2) return 75;
  if (ageHours <= 4) return 60;
  if (ageHours <= 8) return 45;
  if (ageHours <= 12) return 30;
  if (ageHours <= 24) return 15;
  return 5;
}

/**
 * Compute composite signal score (0-100)
 */
export function computeSignalScore(input: ScoreInput): ScoreResult {
  const bettor = scoreBettor(input);
  const conviction = scoreConviction(input);
  const edge = scoreEdge(input);
  const recency = scoreRecency(input);

  // Weighted average
  const total =
    bettor * 0.35 +
    conviction * 0.35 +
    edge * 0.15 +
    recency * 0.15;

  const rounded = Math.round(total);

  // Label thresholds (matching OddsJam-style feel)
  let label: ScoreResult["label"];
  if (rounded >= 85) label = "🔥";
  else if (rounded >= 70) label = "⭐";
  else if (rounded >= 50) label = "👍";
  else label = "👀";

  return {
    total: rounded,
    breakdown: { bettor, conviction, edge, recency },
    label,
  };
}
