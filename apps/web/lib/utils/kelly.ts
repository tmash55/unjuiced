/**
 * Kelly Criterion Calculator for Optimal Bet Sizing
 * 
 * The Kelly Criterion is a formula for determining optimal bet sizes to maximize
 * long-term growth while minimizing risk of ruin.
 * 
 * Formula: f = (b * p - q) / b
 * Where:
 *   f = fraction of bankroll to wager
 *   b = decimal odds - 1
 *   p = true probability (from fair odds)
 *   q = 1 - p
 */

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  }
  return 1 + 100 / Math.abs(americanOdds);
}

/**
 * Convert decimal odds to implied probability
 */
export function decimalToImpliedProb(decimalOdds: number): number {
  return 1 / decimalOdds;
}

/**
 * Apply profit boost to decimal odds
 * 
 * A profit boost increases the profit portion of the odds:
 * - Decimal 2.50 (+150) with 30% boost:
 *   - Profit = 2.50 - 1 = 1.50
 *   - Boosted profit = 1.50 * 1.30 = 1.95
 *   - Boosted decimal = 1 + 1.95 = 2.95 (effective +195)
 * 
 * @param decimalOdds - Original decimal odds
 * @param boostPercent - Boost percentage (e.g., 30 for 30% boost)
 * @returns Boosted decimal odds
 */
export function applyBoostToDecimalOdds(decimalOdds: number, boostPercent: number): number {
  if (boostPercent <= 0) return decimalOdds;
  const profit = decimalOdds - 1;
  const boostedProfit = profit * (1 + boostPercent / 100);
  return 1 + boostedProfit;
}

/**
 * Calculate Kelly Criterion stake
 * 
 * @param params.bankroll - User's total bankroll
 * @param params.bestOdds - Best available odds (American format, e.g., +2152)
 * @param params.fairOdds - Fair/true odds (American format, e.g., +772)
 * @param params.fraction - Kelly fraction (0.25 = quarter Kelly, default)
 * @param params.boostPercent - Optional profit boost percentage
 * @returns Recommended stake amount (always >= 0)
 */
export function calculateKellyStake({
  bankroll,
  bestOdds,
  fairOdds,
  fraction = 0.25,
  boostPercent = 0,
}: {
  bankroll: number;
  bestOdds: number;
  fairOdds: number;
  fraction?: number;
  boostPercent?: number;
}): number {
  if (!bankroll || bankroll <= 0) return 0;
  if (!bestOdds || !fairOdds) return 0;
  
  // Convert American odds to decimal
  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  
  // Apply boost to effective odds if active
  const effectiveDecimalOdds = boostPercent > 0 
    ? applyBoostToDecimalOdds(decimalOdds, boostPercent)
    : decimalOdds;
  
  // Calculate true probability from fair odds
  const p = decimalToImpliedProb(fairDecimal);
  
  // Calculate Kelly components with boosted odds
  const b = effectiveDecimalOdds - 1; // Net odds received (with boost)
  const q = 1 - p; // Probability of losing
  
  // Kelly formula: f = (b * p - q) / b
  const kelly = (b * p - q) / b;
  
  // Apply fractional Kelly and ensure non-negative
  const fractionalKelly = Math.max(0, kelly * fraction);
  
  // Calculate stake
  const stake = bankroll * fractionalKelly;
  
  return stake;
}

/**
 * Format stake for display
 * Rounds to nearest whole dollar or to nearest $5 for larger amounts
 */
export function formatStake(stake: number): string {
  if (stake <= 0) return "$0";
  
  // For very small stakes (< $1), show with decimals
  if (stake < 1) {
    return `$${stake.toFixed(2)}`;
  }
  
  // For small stakes (< $10), round to nearest dollar
  if (stake < 10) {
    return `$${Math.round(stake)}`;
  }
  
  // For medium stakes ($10-$100), round to nearest $5
  if (stake < 100) {
    const rounded = Math.round(stake / 5) * 5;
    return `$${rounded}`;
  }
  
  // For larger stakes, round to nearest $10
  const rounded = Math.round(stake / 10) * 10;
  return `$${rounded}`;
}

/**
 * Additional stake dampener for long underdog prices.
 *
 * Use this only where a more conservative recommendation is desired.
 * Keeps near-even prices mostly unchanged while reducing very long-shot sizing.
 */
export function getLongOddsStakeMultiplier(americanOdds: number): number {
  // Favorite/near-even prices do not need extra dampening.
  if (!Number.isFinite(americanOdds) || americanOdds <= 100) return 1;

  const impliedProb = decimalToImpliedProb(americanToDecimal(americanOdds));
  // 0.45 implied probability is treated as the "no-discount" anchor.
  const normalized = impliedProb / 0.45;
  const scaled = Math.sqrt(normalized);

  // Clamp to avoid extreme reductions while still being meaningfully conservative.
  return Math.max(0.35, Math.min(1, scaled));
}

/**
 * Calculate and format Kelly stake as a single convenience function
 * 
 * @param params.boostPercent - Optional profit boost percentage (e.g., 30 for 30% boost)
 *                              When active, adjusts the effective odds before Kelly calculation
 */
export function getKellyStakeDisplay({
  bankroll,
  bestOdds,
  fairOdds,
  kellyPercent = 25, // Default to quarter Kelly (25%)
  boostPercent = 0,  // Optional profit boost
}: {
  bankroll: number;
  bestOdds: number;
  fairOdds: number;
  kellyPercent?: number;
  boostPercent?: number;
}): { stake: number; display: string; kellyPct: number; boostedStake?: number; boostedDisplay?: string } {
  // Convert kelly percent to fraction (25 -> 0.25)
  // Default to 25% if invalid or zero
  const fraction = kellyPercent > 0 ? kellyPercent / 100 : 0.25;
  
  // Convert American odds to decimal
  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  
  // Apply boost to effective odds if active
  const effectiveDecimalOdds = boostPercent > 0 
    ? applyBoostToDecimalOdds(decimalOdds, boostPercent)
    : decimalOdds;
  
  // Calculate true probability from fair odds
  const p = decimalToImpliedProb(fairDecimal);
  const q = 1 - p;
  
  // Calculate Kelly with boosted odds
  const b = effectiveDecimalOdds - 1; // Net odds received (with boost)
  const fullKelly = (b * p - q) / b;
  const kellyPct = Math.max(0, fullKelly * 100);
  
  // Apply fractional Kelly
  const fractionalKelly = Math.max(0, fullKelly * fraction);
  const stake = bankroll * fractionalKelly;
  
  return {
    stake,
    display: formatStake(stake),
    kellyPct,
  };
}
