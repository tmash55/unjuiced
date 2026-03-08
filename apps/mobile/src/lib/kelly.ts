/**
 * Kelly Criterion Calculator for Optimal Bet Sizing
 *
 * Formula: f = (b * p - q) / b
 * Where:
 *   f = fraction of bankroll to wager
 *   b = decimal odds - 1
 *   p = true probability (from fair odds)
 *   q = 1 - p
 */

export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  }
  return 1 + 100 / Math.abs(americanOdds);
}

export function decimalToImpliedProb(decimalOdds: number): number {
  return 1 / decimalOdds;
}

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

  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  const p = decimalToImpliedProb(fairDecimal);
  const b = decimalOdds - 1;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  const fractionalKelly = Math.max(0, kelly * fraction);

  return bankroll * fractionalKelly;
}

export function formatStake(stake: number): string {
  if (stake <= 0) return "$0";
  if (stake < 1) return `$${stake.toFixed(2)}`;
  if (stake < 10) return `$${Math.round(stake)}`;
  if (stake < 100) {
    const rounded = Math.round(stake / 5) * 5;
    return `$${rounded}`;
  }
  const rounded = Math.round(stake / 10) * 10;
  return `$${rounded}`;
}

export function getKellyStakeDisplay({
  bankroll,
  bestOdds,
  fairOdds,
  kellyPercent = 25,
}: {
  bankroll: number;
  bestOdds: number;
  fairOdds: number;
  kellyPercent?: number;
}): { stake: number; display: string; kellyPct: number } {
  const fraction = kellyPercent > 0 ? kellyPercent / 100 : 0.25;

  const decimalOdds = americanToDecimal(bestOdds);
  const fairDecimal = americanToDecimal(fairOdds);
  const p = decimalToImpliedProb(fairDecimal);
  const q = 1 - p;
  const b = decimalOdds - 1;
  const fullKelly = (b * p - q) / b;
  const kellyPct = Math.max(0, fullKelly * 100);
  const fractionalKelly = Math.max(0, fullKelly * fraction);
  const stake = bankroll * fractionalKelly;

  return {
    stake,
    display: formatStake(stake),
    kellyPct,
  };
}
