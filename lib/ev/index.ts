/**
 * Positive EV Library
 * 
 * Core library for Expected Value calculations using de-vigging methods.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   devigPower, 
 *   devigMultiplicative, 
 *   calculateEV,
 *   calculateMultiEV 
 * } from "@/lib/ev";
 * 
 * // De-vig sharp odds
 * const sharpOver = -110;
 * const sharpUnder = -110;
 * const devigResult = devigPower(sharpOver, sharpUnder);
 * 
 * // Calculate EV for a soft book offer
 * const ev = calculateEV(devigResult.fairProbOver, +105);
 * console.log(`EV: ${(ev * 100).toFixed(1)}%`); // "EV: 2.5%"
 * ```
 */

// Types
export type {
  DevigMethod,
  DevigResult,
  MultiDevigResult,
  SharpPreset,
  SharpPresetConfig,
  SharpReference,
  BookOffer,
  BookPairedOdds,
  EVCalculation,
  MultiEVCalculation,
  PositiveEVOpportunity,
  PositiveEVRequest,
  PositiveEVResponse,
  PositiveEVModel,
  EVMode,
} from "./types";

// Constants
export {
  SHARP_BOOKS,
  SOFT_BOOKS,
  SHARP_PRESETS,
  DEVIG_METHODS,
  DEFAULT_DEVIG_METHODS,
  ALL_DEVIG_METHODS,
  POSITIVE_EV_DEFAULTS,
  EV_THRESHOLDS,
  SUPPORTED_SPORTS,
  TWO_WAY_MARKETS,
  NON_TWO_WAY_MARKETS,
} from "./constants";

// Odds conversion functions
export {
  americanToImpliedProb,
  americanToDecimal,
  decimalToAmerican,
  impliedProbToAmerican,
  impliedProbToDecimal,
} from "./devig";

// Margin calculation
export {
  calculateMargin,
  calculateMarginFromOdds,
} from "./devig";

// De-vig methods
export {
  devigMultiplicative,
  devigAdditive,
  devigPower,
  devigProbit,
  devigMultiple,
} from "./devig";

// EV calculation
export {
  calculateEV,
  calculateKelly,
  calculateEVDetails,
  calculateMultiEV,
} from "./devig";

// Sharp reference helpers
export {
  blendSharpOdds,
  createSharpReference,
} from "./devig";

// Utility functions
export {
  isPositiveEV,
  formatEV,
  formatKelly,
  getKellyStake,
} from "./devig";
