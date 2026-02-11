/**
 * De-vig Library
 * 
 * Core mathematical functions for removing sportsbook margin (vig)
 * from odds to calculate fair probabilities and Expected Value.
 * 
 * Implements 4 de-vig methods:
 * - Power (Tier A): Handles favorite/longshot bias
 * - Multiplicative (Tier A): Simple proportional rescaling
 * - Additive (Tier B): Equal margin subtraction
 * - Probit (Tier B): Normal quantile transformation
 */

import type {
  DevigMethod,
  DevigResult,
  MultiDevigResult,
  EVCalculation,
  MultiEVCalculation,
  SharpReference,
  BookOffer,
} from "./types";
import { DEFAULT_DEVIG_METHODS } from "./constants";

// =============================================================================
// Odds Conversion Functions
// =============================================================================

/**
 * Convert American odds to implied probability
 * 
 * @param odds American odds (e.g., -110, +150)
 * @returns Implied probability (0-1)
 * 
 * @example
 * americanToImpliedProb(-110) // 0.5238 (52.38%)
 * americanToImpliedProb(+150) // 0.4 (40%)
 */
export function americanToImpliedProb(odds: number): number {
  if (odds === 0) return 0;
  
  if (odds < 0) {
    // Favorite: -110 → 110 / (110 + 100) = 0.5238
    return Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    // Underdog: +150 → 100 / (150 + 100) = 0.4
    return 100 / (odds + 100);
  }
}

/**
 * Convert American odds to decimal odds
 * 
 * @param odds American odds
 * @returns Decimal odds (e.g., 1.91, 2.5)
 * 
 * @example
 * americanToDecimal(-110) // 1.909
 * americanToDecimal(+150) // 2.5
 */
export function americanToDecimal(odds: number): number {
  if (odds === 0) return 1;
  
  if (odds < 0) {
    // Favorite: -110 → 1 + (100 / 110) = 1.909
    return 1 + (100 / Math.abs(odds));
  } else {
    // Underdog: +150 → 1 + (150 / 100) = 2.5
    return 1 + (odds / 100);
  }
}

/**
 * Convert decimal odds to American odds
 * 
 * @param decimal Decimal odds
 * @returns American odds
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) return 0;
  
  if (decimal >= 2) {
    // Underdog: 2.5 → (2.5 - 1) * 100 = +150
    return Math.round((decimal - 1) * 100);
  } else {
    // Favorite: 1.909 → -100 / (1.909 - 1) = -110
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Convert implied probability to American odds
 * 
 * @param prob Implied probability (0-1)
 * @returns American odds
 */
export function impliedProbToAmerican(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  
  if (prob >= 0.5) {
    // Favorite
    return Math.round(-100 * prob / (1 - prob));
  } else {
    // Underdog
    return Math.round(100 * (1 - prob) / prob);
  }
}

/**
 * Convert implied probability to decimal odds
 * 
 * @param prob Implied probability (0-1)
 * @returns Decimal odds
 */
export function impliedProbToDecimal(prob: number): number {
  if (prob <= 0) return Infinity;
  return 1 / prob;
}

// =============================================================================
// Margin/Overround Calculation
// =============================================================================

/**
 * Calculate the market margin (overround/vig)
 * 
 * @param probOver Implied probability for over side
 * @param probUnder Implied probability for under side
 * @returns Margin as decimal (e.g., 0.0476 = 4.76%)
 * 
 * @example
 * // -110 on both sides
 * calculateMargin(0.5238, 0.5238) // 0.0476 (4.76% vig)
 */
export function calculateMargin(probOver: number, probUnder: number): number {
  return probOver + probUnder - 1;
}

/**
 * Calculate margin from American odds
 */
export function calculateMarginFromOdds(overOdds: number, underOdds: number): number {
  const probOver = americanToImpliedProb(overOdds);
  const probUnder = americanToImpliedProb(underOdds);
  return calculateMargin(probOver, probUnder);
}

// =============================================================================
// De-vig Method: Multiplicative (Ratio)
// =============================================================================

/**
 * Multiplicative de-vig method (also called "Ratio" or "Proportional")
 * 
 * Rescales implied probabilities proportionally so they sum to 1.
 * Simple, stable, and widely used baseline.
 * 
 * Formula: p_fair = p_implied / (p_over + p_under)
 * 
 * @param overOdds American odds for over
 * @param underOdds American odds for under
 * @returns DevigResult with fair probabilities
 */
export function devigMultiplicative(overOdds: number, underOdds: number): DevigResult {
  try {
    const probOver = americanToImpliedProb(overOdds);
    const probUnder = americanToImpliedProb(underOdds);
    const total = probOver + probUnder;
    
    if (total <= 0) {
      return {
        method: "multiplicative",
        fairProbOver: 0,
        fairProbUnder: 0,
        margin: 0,
        success: false,
        error: "Invalid odds: total probability <= 0",
      };
    }
    
    const margin = total - 1;
    const fairProbOver = probOver / total;
    const fairProbUnder = probUnder / total;
    
    return {
      method: "multiplicative",
      fairProbOver,
      fairProbUnder,
      margin,
      success: true,
    };
  } catch (err) {
    return {
      method: "multiplicative",
      fairProbOver: 0,
      fairProbUnder: 0,
      margin: 0,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// De-vig Method: Additive
// =============================================================================

/**
 * Additive de-vig method
 * 
 * Subtracts an equal amount from each implied probability.
 * Works best for balanced markets; can produce negative values on extreme odds.
 * 
 * Formula: p_fair = p_implied - (margin / 2)
 * 
 * @param overOdds American odds for over
 * @param underOdds American odds for under
 * @returns DevigResult with fair probabilities
 */
export function devigAdditive(overOdds: number, underOdds: number): DevigResult {
  try {
    const probOver = americanToImpliedProb(overOdds);
    const probUnder = americanToImpliedProb(underOdds);
    const margin = probOver + probUnder - 1;
    
    // Subtract half the margin from each side
    let fairProbOver = probOver - margin / 2;
    let fairProbUnder = probUnder - margin / 2;
    
    // Clamp to valid probability range
    // Note: if clamping is needed, results may be less accurate
    const needsClamping = fairProbOver < 0 || fairProbOver > 1 || fairProbUnder < 0 || fairProbUnder > 1;
    
    fairProbOver = Math.max(0.001, Math.min(0.999, fairProbOver));
    fairProbUnder = Math.max(0.001, Math.min(0.999, fairProbUnder));
    
    // Renormalize after clamping
    const total = fairProbOver + fairProbUnder;
    fairProbOver = fairProbOver / total;
    fairProbUnder = fairProbUnder / total;
    
    return {
      method: "additive",
      fairProbOver,
      fairProbUnder,
      margin,
      success: true,
      error: needsClamping ? "Clamping applied due to extreme odds" : undefined,
    };
  } catch (err) {
    return {
      method: "additive",
      fairProbOver: 0,
      fairProbUnder: 0,
      margin: 0,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// De-vig Method: Power
// =============================================================================

/**
 * Power de-vig method
 * 
 * Finds an exponent k such that p_over^k + p_under^k = 1.
 * Handles favorite/longshot bias better than simple methods.
 * 
 * Uses binary search to solve for k.
 * 
 * @param overOdds American odds for over
 * @param underOdds American odds for under
 * @returns DevigResult with fair probabilities
 */
export function devigPower(overOdds: number, underOdds: number): DevigResult {
  try {
    const probOver = americanToImpliedProb(overOdds);
    const probUnder = americanToImpliedProb(underOdds);
    const margin = probOver + probUnder - 1;
    
    if (probOver <= 0 || probUnder <= 0) {
      return {
        method: "power",
        fairProbOver: 0,
        fairProbUnder: 0,
        margin,
        success: false,
        error: "Invalid odds: probability <= 0",
      };
    }
    
    // Binary search for k where p_over^k + p_under^k = 1
    let kLow = 0.1;
    let kHigh = 10;
    let k = 1;
    const tolerance = 1e-10;
    const maxIterations = 100;
    
    for (let i = 0; i < maxIterations; i++) {
      k = (kLow + kHigh) / 2;
      const sum = Math.pow(probOver, k) + Math.pow(probUnder, k);
      
      if (Math.abs(sum - 1) < tolerance) {
        break;
      }
      
      if (sum > 1) {
        kLow = k;
      } else {
        kHigh = k;
      }
    }
    
    const fairProbOver = Math.pow(probOver, k);
    const fairProbUnder = Math.pow(probUnder, k);
    
    // Verify sum is close to 1
    const sum = fairProbOver + fairProbUnder;
    if (Math.abs(sum - 1) > 0.001) {
      return {
        method: "power",
        fairProbOver: fairProbOver / sum,
        fairProbUnder: fairProbUnder / sum,
        margin,
        success: true,
        error: "Convergence warning: sum not exactly 1",
      };
    }
    
    return {
      method: "power",
      fairProbOver,
      fairProbUnder,
      margin,
      success: true,
    };
  } catch (err) {
    return {
      method: "power",
      fairProbOver: 0,
      fairProbUnder: 0,
      margin: 0,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// De-vig Method: Probit
// =============================================================================

/**
 * Standard normal CDF (cumulative distribution function)
 * Approximation using error function
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Inverse standard normal CDF (probit function)
 * Approximation using Abramowitz and Stegun formula
 */
function normalInverseCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00,
  ];
  
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Probit de-vig method
 * 
 * Transforms probabilities via normal quantiles, adjusts, and transforms back.
 * Provides a statistically smoother correction that handles favorite/longshot bias.
 * 
 * The key insight is that we need to find a shift value 'k' such that:
 * Φ(z_over + k) + Φ(z_under + k) = 1
 * 
 * Since Φ(z) + Φ(-z) = 1, we need: z_over + k = -(z_under + k)
 * Which gives us: k = -(z_over + z_under) / 2
 * 
 * @param overOdds American odds for over
 * @param underOdds American odds for under
 * @returns DevigResult with fair probabilities
 */
export function devigProbit(overOdds: number, underOdds: number): DevigResult {
  try {
    const probOver = americanToImpliedProb(overOdds);
    const probUnder = americanToImpliedProb(underOdds);
    const margin = probOver + probUnder - 1;
    
    // If margin is very small, just use multiplicative (more stable)
    if (Math.abs(margin) < 0.001) {
      const fairProbOver = probOver / (probOver + probUnder);
      const fairProbUnder = probUnder / (probOver + probUnder);
      return {
        method: "probit",
        fairProbOver,
        fairProbUnder,
        margin,
        success: true,
      };
    }
    
    // Clamp to avoid infinity in probit
    const clampedOver = Math.max(0.001, Math.min(0.999, probOver));
    const clampedUnder = Math.max(0.001, Math.min(0.999, probUnder));
    
    // Transform to normal scale (z-scores)
    const zOver = normalInverseCDF(clampedOver);
    const zUnder = normalInverseCDF(clampedUnder);
    
    // The analytical solution: shift both z-scores by -k where k = (zOver + zUnder) / 2
    // This makes the adjusted z-scores symmetric around 0, ensuring probs sum to 1
    const k = (zOver + zUnder) / 2;
    
    const fairProbOver = normalCDF(zOver - k);
    const fairProbUnder = normalCDF(zUnder - k);
    
    // Safety check: if results are unreasonable, fall back to multiplicative
    if (fairProbOver <= 0 || fairProbOver >= 1 || fairProbUnder <= 0 || fairProbUnder >= 1 ||
        !isFinite(fairProbOver) || !isFinite(fairProbUnder)) {
      const fairProbOverFallback = probOver / (probOver + probUnder);
      const fairProbUnderFallback = probUnder / (probOver + probUnder);
      return {
        method: "probit",
        fairProbOver: fairProbOverFallback,
        fairProbUnder: fairProbUnderFallback,
        margin,
        success: true,
      };
    }
    
    // Normalize to ensure sum is exactly 1 (handle any floating point errors)
    const total = fairProbOver + fairProbUnder;
    
    return {
      method: "probit",
      fairProbOver: fairProbOver / total,
      fairProbUnder: fairProbUnder / total,
      margin,
      success: true,
    };
  } catch (err) {
    return {
      method: "probit",
      fairProbOver: 0,
      fairProbUnder: 0,
      margin: 0,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// Multi-Method De-vig
// =============================================================================

/**
 * Run multiple de-vig methods and return all results
 * 
 * @param overOdds American odds for over
 * @param underOdds American odds for under
 * @param methods Which methods to run (default: power, multiplicative)
 * @returns Results from each method
 */
export function devigMultiple(
  overOdds: number,
  underOdds: number,
  methods: DevigMethod[] = DEFAULT_DEVIG_METHODS
): MultiDevigResult {
  const results: MultiDevigResult = {};
  
  for (const method of methods) {
    switch (method) {
      case "power":
        results.power = devigPower(overOdds, underOdds);
        break;
      case "multiplicative":
        results.multiplicative = devigMultiplicative(overOdds, underOdds);
        break;
      case "additive":
        results.additive = devigAdditive(overOdds, underOdds);
        break;
      case "probit":
        results.probit = devigProbit(overOdds, underOdds);
        break;
    }
  }
  
  return results;
}

// =============================================================================
// EV Calculation
// =============================================================================

/**
 * Calculate Expected Value for a single bet
 * 
 * EV = (p_fair * decimal_payout) - 1
 * 
 * @param fairProb Fair probability (0-1)
 * @param bookOdds Book's American odds
 * @returns EV as decimal (e.g., 0.05 = 5% EV)
 */
export function calculateEV(fairProb: number, bookOdds: number): number {
  const decimal = americanToDecimal(bookOdds);
  return (fairProb * decimal) - 1;
}

/**
 * Calculate Kelly fraction for optimal bet sizing
 * 
 * Kelly = (p * (d - 1) - (1 - p)) / (d - 1)
 *       = (p * d - 1) / (d - 1)
 * 
 * Where:
 * - p = fair probability
 * - d = decimal odds
 * 
 * @param fairProb Fair probability (0-1)
 * @param bookOdds Book's American odds
 * @returns Optimal fraction of bankroll to bet (0-1)
 */
export function calculateKelly(fairProb: number, bookOdds: number): number {
  const decimal = americanToDecimal(bookOdds);
  
  if (decimal <= 1) return 0;
  
  const kelly = (fairProb * decimal - 1) / (decimal - 1);
  
  // Return 0 if negative (no edge)
  return Math.max(0, kelly);
}

/**
 * Calculate full EV details for a book offer using a specific de-vig method
 * 
 * @param fairProb Fair probability from de-vig
 * @param bookOffer Book's odds offer
 * @param method Which de-vig method was used
 * @returns Full EV calculation details
 */
export function calculateEVDetails(
  fairProb: number,
  bookOffer: BookOffer,
  method: DevigMethod
): EVCalculation {
  const bookDecimal = americanToDecimal(bookOffer.price);
  const bookProb = americanToImpliedProb(bookOffer.price);
  const ev = calculateEV(fairProb, bookOffer.price);
  const kelly = calculateKelly(fairProb, bookOffer.price);
  
  return {
    method,
    fairProb,
    bookProb,
    bookDecimal,
    ev,
    evPercent: ev * 100,
    edge: bookProb - fairProb, // How much the book is "off"
    kellyFraction: kelly,
  };
}

/**
 * Calculate EV using multiple de-vig methods
 * 
 * @param devigResults Results from multi-method de-vig
 * @param bookOffer Book's odds offer
 * @param side Which side to calculate for ("over" or "under")
 * @returns Combined EV calculations with worst/best/display values
 */
export function calculateMultiEV(
  devigResults: MultiDevigResult,
  bookOffer: BookOffer,
  side: "over" | "under"
): MultiEVCalculation {
  const result: MultiEVCalculation = {
    evWorst: Infinity,
    evBest: -Infinity,
    evDisplay: 0,
  };
  
  const evValues: number[] = [];
  const kellyValues: number[] = [];
  
  // Calculate EV for each available method
  if (devigResults.power?.success) {
    const fairProb = side === "over" 
      ? devigResults.power.fairProbOver 
      : devigResults.power.fairProbUnder;
    result.power = calculateEVDetails(fairProb, bookOffer, "power");
    evValues.push(result.power.evPercent);
    if (result.power.kellyFraction !== undefined) {
      kellyValues.push(result.power.kellyFraction);
    }
  }
  
  if (devigResults.multiplicative?.success) {
    const fairProb = side === "over" 
      ? devigResults.multiplicative.fairProbOver 
      : devigResults.multiplicative.fairProbUnder;
    result.multiplicative = calculateEVDetails(fairProb, bookOffer, "multiplicative");
    evValues.push(result.multiplicative.evPercent);
    if (result.multiplicative.kellyFraction !== undefined) {
      kellyValues.push(result.multiplicative.kellyFraction);
    }
  }
  
  if (devigResults.additive?.success) {
    const fairProb = side === "over" 
      ? devigResults.additive.fairProbOver 
      : devigResults.additive.fairProbUnder;
    result.additive = calculateEVDetails(fairProb, bookOffer, "additive");
    evValues.push(result.additive.evPercent);
    if (result.additive.kellyFraction !== undefined) {
      kellyValues.push(result.additive.kellyFraction);
    }
  }
  
  if (devigResults.probit?.success) {
    const fairProb = side === "over" 
      ? devigResults.probit.fairProbOver 
      : devigResults.probit.fairProbUnder;
    result.probit = calculateEVDetails(fairProb, bookOffer, "probit");
    evValues.push(result.probit.evPercent);
    if (result.probit.kellyFraction !== undefined) {
      kellyValues.push(result.probit.kellyFraction);
    }
  }
  
  // Calculate aggregated values
  if (evValues.length > 0) {
    result.evWorst = Math.min(...evValues);
    result.evBest = Math.max(...evValues);
    result.evDisplay = result.evWorst; // Default to conservative
  } else {
    result.evWorst = 0;
    result.evBest = 0;
    result.evDisplay = 0;
  }
  
  if (kellyValues.length > 0) {
    result.kellyWorst = Math.min(...kellyValues);
  }
  
  return result;
}

// =============================================================================
// Sharp Reference Helpers
// =============================================================================

/**
 * Blend odds from multiple sharp books
 * 
 * @param bookOdds Array of { bookId, odds, weight }
 * @returns Blended American odds
 */
export function blendSharpOdds(
  bookOdds: { bookId: string; odds: number; weight: number }[]
): number {
  if (bookOdds.length === 0) return 0;
  if (bookOdds.length === 1) return bookOdds[0].odds;
  
  // Convert to probabilities, blend, convert back
  let totalWeight = 0;
  let blendedProb = 0;
  
  for (const { odds, weight } of bookOdds) {
    const prob = americanToImpliedProb(odds);
    blendedProb += prob * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return 0;
  
  blendedProb = blendedProb / totalWeight;
  return impliedProbToAmerican(blendedProb);
}

/**
 * Create a sharp reference from book odds
 */
export function createSharpReference(
  overOdds: number,
  underOdds: number,
  preset: string,
  source: string,
  blendedFrom?: string[]
): SharpReference {
  return {
    preset: preset as SharpReference["preset"],
    overOdds,
    underOdds,
    overDecimal: americanToDecimal(overOdds),
    underDecimal: americanToDecimal(underOdds),
    source,
    blendedFrom,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a market is +EV based on de-vig results
 * 
 * @param evCalc EV calculation results
 * @param minEV Minimum EV% threshold
 * @returns true if the bet is +EV (above threshold)
 */
export function isPositiveEV(evCalc: MultiEVCalculation, minEV: number = 0): boolean {
  return evCalc.evWorst > minEV;
}

/**
 * Format EV percentage for display
 * 
 * @param ev EV as percentage (e.g., 5.23)
 * @returns Formatted string (e.g., "+5.2%")
 */
export function formatEV(ev: number): string {
  const sign = ev >= 0 ? "+" : "";
  return `${sign}${ev.toFixed(1)}%`;
}

/**
 * Format Kelly fraction as percentage
 * 
 * @param kelly Kelly fraction (e.g., 0.0234)
 * @param fraction Kelly multiplier (e.g., 0.25 for quarter Kelly)
 * @returns Formatted string (e.g., "0.6%")
 */
export function formatKelly(kelly: number, fraction: number = 1): string {
  const adjusted = kelly * fraction * 100;
  return `${adjusted.toFixed(1)}%`;
}

/**
 * Get Kelly stake amount
 * 
 * @param kelly Kelly fraction
 * @param bankroll Total bankroll
 * @param fraction Kelly multiplier (e.g., 0.25 for quarter Kelly)
 * @returns Stake amount
 */
export function getKellyStake(kelly: number, bankroll: number, fraction: number = 1): number {
  return bankroll * kelly * fraction;
}
