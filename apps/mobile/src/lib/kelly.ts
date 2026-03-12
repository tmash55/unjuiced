/**
 * Kelly Criterion Calculator for Optimal Bet Sizing
 *
 * Uses the simplified EV-based kelly formula (matching desktop):
 *   fullKelly% = (ev% / 100) / (decimalOdds - 1) * 100
 */

export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  }
  return 1 + 100 / Math.abs(americanOdds);
}

export function formatStake(stake: number): string {
  if (stake <= 0) return "$0";
  if (stake < 0.5) return "<$1";
  if (stake < 10) return `$${Math.round(stake)}`;
  if (stake < 100) {
    const rounded = Math.round(stake / 5) * 5;
    return `$${rounded}`;
  }
  const rounded = Math.round(stake / 10) * 10;
  return `$${rounded}`;
}

/**
 * Calculate kelly stake and percentage using EV% and best odds.
 * Matches the desktop positive-ev page formula.
 */
export function getKellyStakeDisplay({
  bankroll,
  bestOdds,
  evPercent,
  kellyPercent = 25,
}: {
  bankroll: number;
  bestOdds: number;
  evPercent: number;
  kellyPercent?: number;
}): { stake: number; display: string; kellyPct: number } {
  if (bankroll <= 0 || evPercent <= 0) {
    return { stake: 0, display: "$0", kellyPct: 0 };
  }

  const decimalOdds = americanToDecimal(bestOdds);
  if (decimalOdds <= 1) {
    return { stake: 0, display: "$0", kellyPct: 0 };
  }

  const fullKellyPct = (evPercent / 100) / (decimalOdds - 1) * 100;
  if (fullKellyPct <= 0 || !isFinite(fullKellyPct)) {
    return { stake: 0, display: "$0", kellyPct: 0 };
  }

  const fractionalKellyPct = fullKellyPct * (kellyPercent / 100);
  const stake = bankroll * (fractionalKellyPct / 100);

  return {
    stake,
    display: formatStake(stake),
    kellyPct: fullKellyPct,
  };
}
