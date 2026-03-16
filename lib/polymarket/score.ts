/**
 * Sharp Signals — Composite Signal Score (0-10)
 *
 * Weights:
 *   Bettor tier & history    30%
 *   Stake conviction         25%
 *   Edge / odds value        20%
 *   Track record (ROI/CLV)   15%
 *   Recency                  10%
 */

export interface ScoreInput {
  tier: string;                    // sharp / whale
  bet_size: number;                // dollars wagered
  wallet_avg_stake?: number | null;// avg stake for this wallet
  wallet_roi?: number | null;      // lifetime ROI as decimal (0.34 = 34%)
  wallet_win_rate?: number | null; // win rate as decimal (0.62 = 62%)
  wallet_total_bets?: number | null;
  clv_avg?: number | null;         // avg CLV in percentage points
  american_odds?: number | null;   // american odds
  entry_price?: number | null;     // polymarket price (0-1)
  book_implied?: number | null;    // sportsbook implied prob (0-1)
  quality_score?: number | null;   // existing 1-5 quality score
  created_at: string;              // ISO timestamp
}

export interface ScoreResult {
  total: number;         // 0.0 - 10.0
  breakdown: {
    bettor: number;      // 0-10
    conviction: number;  // 0-10
    edge: number;        // 0-10
    track: number;       // 0-10
    recency: number;     // 0-10
  };
  label: "🔥" | "⭐" | "👍" | "👀";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Bettor tier & history (30% weight)
 * S-tier whale with 800+ bets = 10, random sharp with 5 bets = 3
 */
function scoreBettor(input: ScoreInput): number {
  let score = 0;

  // Tier base
  if (input.tier === "whale") score += 4;
  else if (input.tier === "sharp") score += 3;
  else score += 1;

  // Sample size bonus
  const bets = input.wallet_total_bets ?? 0;
  if (bets >= 500) score += 3;
  else if (bets >= 100) score += 2;
  else if (bets >= 20) score += 1;

  // Win rate bonus (only if decent sample)
  const wr = input.wallet_win_rate;
  if (wr != null && bets >= 10) {
    if (wr >= 0.60) score += 3;
    else if (wr >= 0.55) score += 2;
    else if (wr >= 0.50) score += 1;
  }

  return clamp(score, 0, 10);
}

/**
 * Stake conviction (25% weight)
 * How much above their average are they betting?
 * 16x avg = 10, 1x avg = 2, big absolute size also matters
 */
function scoreConviction(input: ScoreInput): number {
  let score = 0;

  // Stake vs average multiplier
  const avg = input.wallet_avg_stake;
  if (avg && avg > 0) {
    const multiplier = input.bet_size / avg;
    if (multiplier >= 10) score += 6;
    else if (multiplier >= 5) score += 5;
    else if (multiplier >= 3) score += 4;
    else if (multiplier >= 2) score += 3;
    else if (multiplier >= 1.5) score += 2;
    else score += 1;
  }

  // Absolute bet size
  if (input.bet_size >= 50000) score += 4;
  else if (input.bet_size >= 10000) score += 3;
  else if (input.bet_size >= 5000) score += 2;
  else if (input.bet_size >= 1000) score += 1;

  return clamp(score, 0, 10);
}

/**
 * Edge / odds value (20% weight)
 * Plus money with edge = great, heavy juice = bad
 */
function scoreEdge(input: ScoreInput): number {
  let score = 0;

  // Edge from polymarket vs book
  const polyProb = input.entry_price ?? 0;
  const bookProb = input.book_implied ?? 0;
  if (polyProb > 0 && bookProb > 0) {
    const edge = polyProb - bookProb;
    if (edge >= 0.15) score += 5;
    else if (edge >= 0.10) score += 4;
    else if (edge >= 0.05) score += 3;
    else if (edge >= 0.02) score += 2;
    else if (edge > 0) score += 1;
  }

  // Odds value — plus money is better
  const odds = input.american_odds ?? 0;
  if (odds >= 200) score += 3;
  else if (odds >= 100) score += 2.5;
  else if (odds >= 0) score += 2;
  else if (odds >= -150) score += 1.5;
  else if (odds >= -200) score += 1;
  else score += 0.5; // heavy juice = lower score

  // Existing quality score as tiebreaker
  if (input.quality_score) {
    score += (input.quality_score - 1) * 0.25; // 0-1 bonus
  }

  return clamp(score, 0, 10);
}

/**
 * Track record / ROI / CLV (15% weight)
 */
function scoreTrack(input: ScoreInput): number {
  let score = 0;

  // ROI
  const roi = input.wallet_roi;
  if (roi != null) {
    if (roi >= 0.30) score += 5;
    else if (roi >= 0.20) score += 4;
    else if (roi >= 0.10) score += 3;
    else if (roi >= 0.05) score += 2;
    else if (roi >= 0) score += 1;
    // Negative ROI = 0
  }

  // CLV (closing line value)
  const clv = input.clv_avg;
  if (clv != null) {
    if (clv >= 4) score += 5;
    else if (clv >= 2) score += 4;
    else if (clv >= 1) score += 3;
    else if (clv >= 0) score += 2;
  }

  return clamp(score, 0, 10);
}

/**
 * Recency (10% weight)
 * Fresh signal > stale signal. Decays over 24 hours.
 */
function scoreRecency(input: ScoreInput): number {
  const ageMs = Date.now() - new Date(input.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 0.5) return 10;
  if (ageHours <= 1) return 9;
  if (ageHours <= 2) return 8;
  if (ageHours <= 4) return 7;
  if (ageHours <= 6) return 6;
  if (ageHours <= 12) return 4;
  if (ageHours <= 24) return 2;
  return 1;
}

/**
 * Compute composite signal score (0.0 - 10.0)
 */
export function computeSignalScore(input: ScoreInput): ScoreResult {
  const bettor = scoreBettor(input);
  const conviction = scoreConviction(input);
  const edge = scoreEdge(input);
  const track = scoreTrack(input);
  const recency = scoreRecency(input);

  // Weighted average
  const total =
    bettor * 0.30 +
    conviction * 0.25 +
    edge * 0.20 +
    track * 0.15 +
    recency * 0.10;

  const rounded = Math.round(total * 10) / 10;

  // Label
  let label: ScoreResult["label"];
  if (rounded >= 8) label = "🔥";
  else if (rounded >= 6) label = "⭐";
  else if (rounded >= 4) label = "👍";
  else label = "👀";

  return {
    total: rounded,
    breakdown: { bettor, conviction, edge, track, recency },
    label,
  };
}
