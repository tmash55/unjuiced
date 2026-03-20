/**
 * Kelly Criterion calculator for Sharp Intel
 */

export interface KellyInput {
  polyImplied: number; // Polymarket implied probability (0-1)
  bookImplied: number; // Sportsbook implied probability (0-1)
  fraction?: number; // Kelly fraction (default 0.5 = half Kelly)
  bankroll?: number; // Optional bankroll for unit sizing
}

export interface KellyResult {
  edge: number; // Edge = poly_implied - book_implied
  fullKelly: number; // Full Kelly fraction of bankroll
  recommendedSize: number; // Adjusted by fraction
  units: number; // Units (0.5-5.0 scale)
  hasEdge: boolean;
}

/**
 * Calculate Kelly sizing
 * Edge = polymarket implied prob - sportsbook implied prob
 * Kelly% = edge / (decimal_odds - 1)
 */
export function calculateKelly({
  polyImplied,
  bookImplied,
  fraction = 0.5,
}: KellyInput): KellyResult {
  const edge = polyImplied - bookImplied;
  const hasEdge = edge > 0;

  if (!hasEdge || bookImplied <= 0 || bookImplied >= 1) {
    return { edge, fullKelly: 0, recommendedSize: 0, units: 0, hasEdge: false };
  }

  // Convert book implied to decimal odds
  const decimalOdds = 1 / bookImplied;
  // Kelly formula: (bp - q) / b where b = decimal - 1, p = polyImplied, q = 1 - polyImplied
  const b = decimalOdds - 1;
  const fullKelly = Math.max(0, (b * polyImplied - (1 - polyImplied)) / b);
  const recommendedSize = fullKelly * fraction;

  // Map to units: 0.5-5.0 scale (0% = 0.5u, 10%+ kelly = 5.0u)
  const units = Math.min(5.0, Math.max(0.5, 0.5 + (recommendedSize / 0.1) * 4.5));

  return {
    edge: Math.round(edge * 10000) / 10000,
    fullKelly: Math.round(fullKelly * 10000) / 10000,
    recommendedSize: Math.round(recommendedSize * 10000) / 10000,
    units: Math.round(units * 10) / 10,
    hasEdge: true,
  };
}
