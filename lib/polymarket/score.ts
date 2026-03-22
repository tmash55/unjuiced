/**
 * Sharp Intel — Signal Score v2 (0-100)
 *
 * Philosophy: Score the SIGNAL, not the sharp.
 * A top-ranked sharp making a routine bet should score lower than
 * a mid-ranked sharp making a 10x conviction play.
 *
 * Weights:
 *   Conviction (stake vs avg)       40%
 *   Edge (poly vs book odds)        20%
 *   Bettor quality (tier/rank/PnL)  15%
 *   Recency                         10%
 *   Consensus bonus (additive)      15%  ← never negative
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
  // Consensus data (populated by feed route)
  consensus_count?: number | null; // # of sharps/insiders on same side
  consensus_total?: number | null; // total sharps/insiders on this market (both sides)
}

export interface ScoreResult {
  total: number; // 0 - 100
  breakdown: {
    conviction: number; // 0-100 (raw sub-score)
    edge: number; // 0-100
    bettor: number; // 0-100
    recency: number; // 0-100
    consensus: number; // 0-100
  };
  label: "🔥" | "⭐" | "👍" | "👀";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── Conviction (40% weight) ────────────────────────────────────────────
// The #1 signal: how much are they betting relative to their average?
// A 15x play is a screaming conviction bet. A 1x play is routine but valid.

function scoreConviction(input: ScoreInput): number {
  let score = 0;

  // Stake vs average multiplier (0-60)
  const avg = input.wallet_avg_stake;
  if (avg && avg > 0) {
    const multiplier = input.bet_size / avg;
    if (multiplier >= 15) score += 60;
    else if (multiplier >= 10) score += 57;
    else if (multiplier >= 5) score += 51;
    else if (multiplier >= 3) score += 45;
    else if (multiplier >= 2) score += 39;
    else if (multiplier >= 1.5) score += 33;
    else if (multiplier >= 1.0) score += 27;
    else if (multiplier >= 0.5) score += 15;
    else score += 8;
  } else {
    // No avg stake data — use absolute size as proxy
    if (input.bet_size >= 50000) score += 50;
    else if (input.bet_size >= 20000) score += 40;
    else if (input.bet_size >= 10000) score += 30;
    else if (input.bet_size >= 5000) score += 25;
    else score += 18;
  }

  // Absolute bet size bonus (0-40)
  // Big money talks regardless of multiplier
  if (input.bet_size >= 100000) score += 40;
  else if (input.bet_size >= 50000) score += 35;
  else if (input.bet_size >= 25000) score += 30;
  else if (input.bet_size >= 10000) score += 24;
  else if (input.bet_size >= 5000) score += 18;
  else if (input.bet_size >= 2000) score += 13;
  else if (input.bet_size >= 1000) score += 9;
  else if (input.bet_size >= 500) score += 6;
  else score += 3;

  return clamp(score, 0, 100);
}

// ─── Edge (20% weight) ─────────────────────────────────────────────────
// Is there actual value vs sportsbook odds?

function scoreEdge(input: ScoreInput): number {
  let score = 25; // Base — don't penalize missing data

  // Edge: polymarket price vs sportsbook implied
  const polyProb = input.entry_price ?? 0;
  const bookProb = input.book_implied ? input.book_implied / 100 : 0;
  if (polyProb > 0 && bookProb > 0) {
    const edgePp = (polyProb - bookProb) * 100;
    if (edgePp >= 15) score += 40;
    else if (edgePp >= 10) score += 32;
    else if (edgePp >= 5) score += 22;
    else if (edgePp >= 2) score += 12;
    else if (edgePp > 0) score += 5;
    // Negative edge (book has better odds) — slight penalty
    else if (edgePp > -5) score += 0;
    else score -= 5;
  }

  // Plus money bonus — underdog plays have higher upside
  const odds = input.american_odds ?? 0;
  if (odds >= 300) score += 25;
  else if (odds >= 200) score += 20;
  else if (odds >= 100) score += 15;
  else if (odds >= 0) score += 8;
  else if (odds >= -150) score += 4;
  else if (odds >= -300) score += 2;
  // Heavy favorites get no bonus

  return clamp(score, 0, 100);
}

// ─── Bettor Quality (15% weight) ───────────────────────────────────────
// Tiebreaker, not a baseline. Every sharp has already proven themselves
// to be on the leaderboard — this just differentiates degrees.

function scoreBettor(input: ScoreInput): number {
  let score = 0;

  // Tier base (0-20)
  if (input.tier === "sharp") score += 20;
  else if (input.tier === "whale") score += 12;
  else score += 5;

  // Rank bonus (0-25)
  const rank = input.wallet_rank;
  if (rank != null && rank > 0) {
    if (rank <= 5) score += 25;
    else if (rank <= 10) score += 22;
    else if (rank <= 25) score += 18;
    else if (rank <= 50) score += 14;
    else if (rank <= 100) score += 8;
    else score += 4;
  }

  // PnL bonus (0-20)
  const pnl = input.wallet_pnl;
  if (pnl != null) {
    if (pnl >= 1000000) score += 20;
    else if (pnl >= 500000) score += 16;
    else if (pnl >= 200000) score += 12;
    else if (pnl >= 100000) score += 9;
    else if (pnl >= 50000) score += 6;
    else if (pnl > 0) score += 3;
  }

  // Win rate bonus (0-20, need sample)
  const wr = input.wallet_win_rate;
  const bets = input.wallet_total_bets ?? 0;
  if (wr != null && bets >= 10) {
    if (wr >= 0.65) score += 20;
    else if (wr >= 0.60) score += 15;
    else if (wr >= 0.55) score += 10;
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

// ─── Recency (10% weight) ──────────────────────────────────────────────
// Fresh signals are actionable. Old ones are history.

function scoreRecency(input: ScoreInput): number {
  const ageMs = Date.now() - new Date(input.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 0.25) return 100;
  if (ageHours <= 0.5) return 95;
  if (ageHours <= 1) return 88;
  if (ageHours <= 2) return 78;
  if (ageHours <= 4) return 65;
  if (ageHours <= 8) return 50;
  if (ageHours <= 12) return 35;
  if (ageHours <= 24) return 20;
  return 5;
}

// ─── Consensus (15% weight, additive only) ─────────────────────────────
// Multiple sharps independently reaching the same conclusion is powerful.
// NEVER penalizes solo plays — just rewards agreement.

function scoreConsensus(input: ScoreInput): number {
  const count = input.consensus_count ?? 1;
  const total = input.consensus_total ?? count;

  // Solo play — neutral (50), not penalized
  if (count <= 1 && total <= 1) return 50;

  // Split market (roughly equal both sides) — no bonus
  if (total >= 2 && count <= total / 2) return 40;

  // Consensus builds
  if (count >= 4) return 100;
  if (count >= 3) return 90;
  if (count >= 2) return 75;

  return 50;
}

// ─── Composite Score ───────────────────────────────────────────────────

export function computeSignalScore(input: ScoreInput): ScoreResult {
  const conviction = scoreConviction(input);
  const edge = scoreEdge(input);
  const bettor = scoreBettor(input);
  const recency = scoreRecency(input);
  const consensus = scoreConsensus(input);

  // Weighted sum — no baselines, no tier head starts
  const raw =
    conviction * 0.4 +
    edge * 0.2 +
    bettor * 0.15 +
    recency * 0.1 +
    consensus * 0.15;

  const total = clamp(Math.round(raw), 10, 99);

  // Label
  let label: ScoreResult["label"];
  if (total >= 90) label = "🔥";
  else if (total >= 80) label = "⭐";
  else if (total >= 65) label = "👍";
  else label = "👀";

  return {
    total,
    breakdown: { conviction, edge, bettor, recency, consensus },
    label,
  };
}
