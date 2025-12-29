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
 * Calculate Kelly Criterion stake
 * 
 * @param params.bankroll - User's total bankroll
 * @param params.bestOdds - Best available odds (American format, e.g., +2152)
 * @param params.fairOdds - Fair/true odds (American format, e.g., +772)
 * @param params.fraction - Kelly fraction (0.25 = quarter Kelly, default)
 * @returns Recommended stake amount (always >= 0)
 */
export function calculateKellyStake({
  bankroll,
  bestOdds,
  fairOdds,
  fraction = 0.25,
}: {
  bankroll: number;
  bestOdds: number;
  fairOdds: number;
  fraction?: number;
}): number {
  if (!bankroll || bankroll <= 0) return 0;
  if (!bestOdds || !fairOdds) return 0;
  
  // Convert American odds to decimal
  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  
  // Calculate true probability from fair odds
  const p = decimalToImpliedProb(fairDecimal);
  
  // Calculate Kelly components
  const b = decimalOdds - 1; // Net odds received on a 1:1 bet
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
 * Calculate and format Kelly stake as a single convenience function
 */
export function getKellyStakeDisplay({
  bankroll,
  bestOdds,
  fairOdds,
  kellyPercent = 25, // Default to quarter Kelly (25%)
}: {
  bankroll: number;
  bestOdds: number;
  fairOdds: number;
  kellyPercent?: number;
}): { stake: number; display: string; kellyPct: number } {
  // Convert kelly percent to fraction (25 -> 0.25)
  // Default to 25% if invalid or zero
  const fraction = kellyPercent > 0 ? kellyPercent / 100 : 0.25;
  
  const stake = calculateKellyStake({
    bankroll,
    bestOdds,
    fairOdds,
    fraction,
  });
  
  // Calculate the kelly % for the bet (before fraction)
  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  const p = decimalToImpliedProb(fairDecimal);
  const b = decimalOdds - 1;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  const kellyPct = Math.max(0, fullKelly * 100);
  
  return {
    stake,
    display: formatStake(stake),
    kellyPct,
  };
}

