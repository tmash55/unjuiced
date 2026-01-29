/**
 * Positive EV Types
 * 
 * Type definitions for the +EV tool including opportunities,
 * de-vig methods, and sharp reference presets.
 */

// =============================================================================
// De-vig Methods
// =============================================================================

/**
 * Supported de-vig methods for removing sportsbook margin
 * 
 * - power: Finds exponent k such that p_over^k + p_under^k = 1 (handles favorite/longshot bias)
 * - multiplicative: Rescales implied probs proportionally to sum to 1 (simple baseline)
 * - additive: Subtracts equal amount from each implied prob (works for balanced markets)
 * - probit: Uses normal quantile transformation (statistically smoother, more complex)
 */
export type DevigMethod = "power" | "multiplicative" | "additive" | "probit";

/**
 * Result from a single de-vig calculation
 */
export interface DevigResult {
  method: DevigMethod;
  fairProbOver: number;    // Fair probability for "over" side (0-1)
  fairProbUnder: number;   // Fair probability for "under" side (0-1)
  margin: number;          // Original market margin/overround
  success: boolean;        // Whether calculation succeeded
  error?: string;          // Error message if failed
}

/**
 * Combined de-vig results from multiple methods
 */
export interface MultiDevigResult {
  power?: DevigResult;
  multiplicative?: DevigResult;
  additive?: DevigResult;
  probit?: DevigResult;
}

// =============================================================================
// Sharp Reference Presets
// =============================================================================

/**
 * Available sharp reference presets
 * 
 * - pinnacle: Pinnacle only (most common sharp reference)
 * - circa: Circa only (US-based sharp book)
 * - prophetx: ProphetX only (sharp pricing with high limits)
 * - pinnacle_circa: Blend of Pinnacle and Circa
 * - hardrock_thescore: Blend of Hard Rock and theScore
 * - market_average: Average of all available sharp books (most robust consensus)
 * - custom: User-defined blend of books with weights
 */
export type SharpPreset = 
  | "pinnacle" 
  | "circa" 
  | "betonline"
  | "prophetx" 
  | "pinnacle_circa" 
  | "hardrock_thescore" 
  | "market_average" 
  | "draftkings"
  | "fanduel"
  | "betmgm"
  | "caesars"
  | "hardrock"
  | "bet365"
  | "polymarket"
  | "kalshi"
  | "custom";

/**
 * Configuration for a sharp reference preset
 */
export interface SharpPresetConfig {
  id: SharpPreset;
  name: string;
  label: string;  // Alias for name, for UI consistency
  description: string;
  books: {
    bookId: string;
    weight: number;  // 0-1, weights should sum to 1
  }[];
}

/**
 * Sharp reference odds for a market (both sides)
 */
export interface SharpReference {
  preset: SharpPreset;
  overOdds: number;      // American odds for over
  underOdds: number;     // American odds for under
  overDecimal: number;   // Decimal odds for over
  underDecimal: number;  // Decimal odds for under
  source: string;        // Which book(s) provided the odds
  blendedFrom?: string[]; // If blended, which books contributed
}

// =============================================================================
// Book Odds
// =============================================================================

/**
 * Betting limits info (max wager)
 */
export interface BookLimits {
  max: number;
}

/**
 * Odds from a single sportsbook for one side of a market
 */
export interface BookOffer {
  bookId: string;
  bookName: string;
  price: number;           // American odds
  priceDecimal: number;    // Decimal odds
  link?: string | null;
  mobileLink?: string | null;
  sgp?: string | null;
  limits?: BookLimits | null;  // Betting limits when available
  updated?: string;
  evPercent?: number;      // EV% for this book (calculated, optional)
  isSharpRef?: boolean;    // True if this book was used as sharp reference
}

/**
 * Paired odds (over + under) from a single book
 */
export interface BookPairedOdds {
  bookId: string;
  bookName: string;
  over?: BookOffer;
  under?: BookOffer;
}

// =============================================================================
// EV Calculations
// =============================================================================

/**
 * EV calculation result for a single book offer
 */
export interface EVCalculation {
  method: DevigMethod;
  fairProb: number;        // Fair probability (0-1)
  bookProb: number;        // Book's implied probability (0-1)
  bookDecimal: number;     // Book's decimal odds
  ev: number;              // Expected value as decimal (e.g., 0.05 = 5%)
  evPercent: number;       // Expected value as percentage (e.g., 5.0)
  edge: number;            // Edge vs fair (fairProb - bookProb)
  kellyFraction?: number;  // Optimal Kelly stake fraction
}

/**
 * Combined EV calculations from multiple methods
 */
export interface MultiEVCalculation {
  power?: EVCalculation;
  multiplicative?: EVCalculation;
  additive?: EVCalculation;
  probit?: EVCalculation;
  
  // Aggregated values
  evWorst: number;         // Min EV across methods (conservative)
  evBest: number;          // Max EV across methods (optimistic)
  evDisplay: number;       // Display value (defaults to evWorst)
  kellyWorst?: number;     // Conservative Kelly fraction
}

// =============================================================================
// Positive EV Opportunity
// =============================================================================

/**
 * A single +EV opportunity
 */
export interface PositiveEVOpportunity {
  // Unique identifier
  id: string;
  
  // Market identification
  sport: string;
  eventId: string;
  market: string;
  marketDisplay: string;
  
  // Event context
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
  gameDate?: string;
  
  // Player info (for player props)
  playerId?: string;
  playerName?: string;
  playerTeam?: string;
  playerPosition?: string;
  
  // Selection details
  line: number;
  side: "over" | "under" | "yes" | "no";
  
  // Sharp reference used
  sharpPreset: SharpPreset;
  sharpReference: SharpReference;
  
  // De-vig results
  devigResults: MultiDevigResult;
  
  // Book offering the +EV
  book: BookOffer;
  
  // EV calculations
  evCalculations: MultiEVCalculation;
  
  // All books for comparison (current side)
  allBooks: BookOffer[];
  
  // Opposite side books for full market view
  oppositeBooks?: BookOffer[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request parameters for the +EV API
 */
export interface PositiveEVRequest {
  sports: string[];                    // e.g., ["nba", "nfl"]
  markets?: string[];                  // Filter by markets (optional)
  sharpPreset: SharpPreset;            // Which sharp reference to use
  devigMethods?: DevigMethod[];        // Which methods to use (default: power, multiplicative)
  minEV?: number;                      // Minimum EV% threshold (default: 0)
  maxEV?: number;                      // Maximum EV% to show (filter outliers)
  books?: string[];                    // Filter to user's sportsbooks
  limit?: number;                      // Max results (default: 100)
  includeAllMethods?: boolean;         // Include all 4 methods in response
  minBooksPerSide?: number;            // Minimum books required on BOTH sides (width filter)
}

/**
 * Mode filter for live/pregame/all events
 */
export type EVMode = "pregame" | "live" | "all";

/**
 * Custom sharp configuration (for user's custom EV models)
 */
export interface CustomSharpConfig {
  books: string[];
  weights: Record<string, number> | null;
}

/**
 * Response from the +EV API
 */
export interface PositiveEVResponse {
  opportunities: PositiveEVOpportunity[];
  meta: {
    totalFound: number;
    returned: number;
    sharpPreset: SharpPreset;
    customSharpConfig?: CustomSharpConfig;
    devigMethods: DevigMethod[];
    minEV: number;
    minBooksPerSide?: number;
    mode: EVMode;
    timestamp: string;
  };
}

// =============================================================================
// User Model/Preset Types
// =============================================================================

/**
 * User-saved +EV model/preset
 */
export interface PositiveEVModel {
  id: string;
  userId: string;
  name: string;
  description?: string;
  
  // Filters
  sports: string[];
  markets: string[];
  books: string[];
  
  // Configuration
  sharpPreset: SharpPreset;
  customSharpBooks?: { bookId: string; weight: number }[];
  devigMethods: DevigMethod[];
  minEV: number;
  maxEV?: number;
  
  // Display preferences
  showKelly: boolean;
  kellyBankroll?: number;
  kellyFraction?: number;  // e.g., 0.25 for quarter Kelly
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
