/**
 * Positive EV Constants
 * 
 * Sharp book mappings, preset configurations, and default values
 * for the +EV tool.
 */

import type { SharpPreset, SharpPresetConfig, DevigMethod } from "./types";

// =============================================================================
// Sharp Book Definitions
// =============================================================================

/**
 * Sharp/reference books available in the system
 * These are considered "market makers" with efficient pricing
 */
export const SHARP_BOOKS = {
  pinnacle: {
    id: "pinnacle",
    name: "Pinnacle",
    tier: "primary",
    description: "Most respected sharp book globally",
  },
  circa: {
    id: "circa",
    name: "Circa",
    tier: "primary",
    description: "Las Vegas sharp book known for high limits",
  },
  prophetx: {
    id: "prophetx",
    name: "ProphetX",
    tier: "primary",
    description: "Sharp pricing with high limits and SGP support",
  },
  hardrock: {
    id: "hardrock",
    name: "Hard Rock",
    tier: "secondary",
    description: "Sharp pricing, especially for player props",
  },
  thescore: {
    id: "thescore",
    name: "theScore",
    tier: "secondary",
    description: "Canadian book with sharp lines",
  },
  bookmaker: {
    id: "bookmaker",
    name: "Bookmaker",
    tier: "secondary",
    description: "Offshore sharp book",
  },
} as const;

/**
 * Soft/retail books - these are compared against sharp references
 */
export const SOFT_BOOKS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "bet365",
  "pointsbet",
  "wynnbet",
  "betrivers",
  "unibet",
  "foxbet",
  "barstool",
  "superbook",
  "betfred",
  "espnbet",
  "fanatics",
  "fliff",
  "prizepicks",
  "underdog",
] as const;

// =============================================================================
// Sharp Preset Configurations
// =============================================================================

/**
 * Pre-configured sharp reference presets
 */
export const SHARP_PRESETS: Record<SharpPreset, SharpPresetConfig> = {
  pinnacle: {
    id: "pinnacle",
    name: "Pinnacle",
    label: "Pinnacle",
    description: "Uses Pinnacle as the sole sharp reference. Most common and reliable baseline.",
    books: [{ bookId: "pinnacle", weight: 1.0 }],
  },
  circa: {
    id: "circa",
    name: "Circa",
    label: "Circa",
    description: "Uses Circa as the sole sharp reference. Top US-based sharp book.",
    books: [{ bookId: "circa", weight: 1.0 }],
  },
  prophetx: {
    id: "prophetx",
    name: "ProphetX",
    label: "ProphetX",
    description: "Uses ProphetX as the sole sharp reference. Sharp pricing with high limits.",
    books: [{ bookId: "prophetx", weight: 1.0 }],
  },
  pinnacle_circa: {
    id: "pinnacle_circa",
    name: "Pinnacle + Circa",
    label: "Pinnacle + Circa",
    description: "Blends Pinnacle and Circa odds (50/50). Good for US markets.",
    books: [
      { bookId: "pinnacle", weight: 0.5 },
      { bookId: "circa", weight: 0.5 },
    ],
  },
  hardrock_thescore: {
    id: "hardrock_thescore",
    name: "Hard Rock + theScore",
    label: "Hard Rock + theScore",
    description: "Alternative sharp blend using Hard Rock and theScore.",
    books: [
      { bookId: "hardrock", weight: 0.5 },
      { bookId: "thescore", weight: 0.5 },
    ],
  },
  draftkings: {
    id: "draftkings",
    name: "DraftKings",
    label: "DraftKings",
    description: "Uses DraftKings as reference. Major US retail book.",
    books: [{ bookId: "draftkings", weight: 1.0 }],
  },
  fanduel: {
    id: "fanduel",
    name: "FanDuel",
    label: "FanDuel",
    description: "Uses FanDuel as reference. Major US retail book.",
    books: [{ bookId: "fanduel", weight: 1.0 }],
  },
  betmgm: {
    id: "betmgm",
    name: "BetMGM",
    label: "BetMGM",
    description: "Uses BetMGM as reference. Major US retail book.",
    books: [{ bookId: "betmgm", weight: 1.0 }],
  },
  caesars: {
    id: "caesars",
    name: "Caesars",
    label: "Caesars",
    description: "Uses Caesars as reference. Major US retail book.",
    books: [{ bookId: "caesars", weight: 1.0 }],
  },
  hardrock: {
    id: "hardrock",
    name: "Hard Rock",
    label: "Hard Rock",
    description: "Uses Hard Rock as reference. Known for sharp player props.",
    books: [{ bookId: "hardrock", weight: 1.0 }],
  },
  bet365: {
    id: "bet365",
    name: "Bet365",
    label: "Bet365",
    description: "Uses Bet365 as reference. Global sportsbook with broad coverage.",
    books: [{ bookId: "bet365", weight: 1.0 }],
  },
  market_average: {
    id: "market_average",
    name: "Market Average",
    label: "Market Average",
    description: "Averages implied probabilities across ALL books for each market. Uses market consensus as true probability.",
    books: [], // Market average uses all available books dynamically
  },
  custom: {
    id: "custom",
    name: "Custom",
    label: "Custom",
    description: "User-defined blend of sharp books with custom weights.",
    books: [], // Filled in by user
  },
};

// =============================================================================
// De-vig Method Configurations
// =============================================================================

/**
 * De-vig method metadata
 */
export const DEVIG_METHODS: Record<DevigMethod, {
  id: DevigMethod;
  name: string;
  label: string;  // Alias for name, for UI consistency
  description: string;
  tier: "primary" | "secondary";
  complexity: "simple" | "moderate" | "complex";
}> = {
  power: {
    id: "power",
    name: "Power",
    label: "Power",
    description: "Finds exponent k where p_over^k + p_under^k = 1. Handles favorite/longshot bias well.",
    tier: "primary",
    complexity: "moderate",
  },
  multiplicative: {
    id: "multiplicative",
    name: "Multiplicative",
    label: "Multiplicative",
    description: "Rescales implied probabilities proportionally to sum to 1. Simple and stable baseline.",
    tier: "primary",
    complexity: "simple",
  },
  additive: {
    id: "additive",
    name: "Additive",
    label: "Additive",
    description: "Subtracts equal margin from each side. Works best for balanced markets.",
    tier: "secondary",
    complexity: "simple",
  },
  probit: {
    id: "probit",
    name: "Probit",
    label: "Probit",
    description: "Uses normal quantile transformation for statistically smoother correction.",
    tier: "secondary",
    complexity: "complex",
  },
};

/**
 * Default de-vig methods to use (Tier A)
 */
export const DEFAULT_DEVIG_METHODS: DevigMethod[] = ["power", "multiplicative"];

/**
 * All de-vig methods in recommended order
 */
export const ALL_DEVIG_METHODS: DevigMethod[] = ["power", "multiplicative", "additive", "probit"];

// =============================================================================
// Default Values
// =============================================================================

/**
 * Default configuration values for the +EV tool
 */
export const POSITIVE_EV_DEFAULTS = {
  // Sharp reference
  sharpPreset: "pinnacle" as SharpPreset,
  
  // De-vig
  devigMethods: DEFAULT_DEVIG_METHODS,
  
  // Filters
  minEV: 0,           // Show all +EV (> 0%)
  maxEV: 20,          // Cap at 20% to filter outliers/errors
  limit: 100,         // Max results per request
  
  // Kelly
  showKelly: true,
  kellyFraction: 0.25,  // Quarter Kelly (conservative)
  kellyBankroll: 1000,  // Default bankroll for display
  
  // API
  cacheSeconds: 30,     // Cache duration for API responses
} as const;

// =============================================================================
// EV Thresholds
// =============================================================================

/**
 * EV percentage thresholds for UI display
 */
export const EV_THRESHOLDS = {
  /** Minimum to show as +EV */
  positive: 0,
  
  /** "Good" EV threshold */
  good: 2,
  
  /** "Great" EV threshold */
  great: 5,
  
  /** "Excellent" EV threshold (rare) */
  excellent: 10,
  
  /** Suspicious - likely data error or closing line */
  suspicious: 15,
  
  /** Maximum allowed - above this is filtered as error */
  maximum: 25,
} as const;

// =============================================================================
// Sport-specific Configurations
// =============================================================================

/**
 * Sports that support the +EV tool
 */
export const SUPPORTED_SPORTS = [
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaab",
  "ncaaf",
  "soccer",
  "tennis",
  "mma",
] as const;

/**
 * Two-way market types that work with de-vigging
 * (markets with exactly 2 outcomes that sum to ~100%)
 */
export const TWO_WAY_MARKETS = [
  // Player props
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_steals",
  "player_blocks",
  "player_turnovers",
  "player_pts_rebs",
  "player_pts_asts",
  "player_rebs_asts",
  "player_pts_rebs_asts",
  "player_steals_blocks",
  "player_fantasy_score",
  "player_double_double",
  "player_triple_double",
  
  // NFL player props
  "player_passing_yards",
  "player_passing_tds",
  "player_rushing_yards",
  "player_rushing_tds",
  "player_receiving_yards",
  "player_receiving_tds",
  "player_receptions",
  "player_passing_attempts",
  "player_rushing_attempts",
  "player_interceptions",
  
  // NHL player props
  "player_goals",
  "player_shots",
  "player_saves",
  
  // Game markets
  "total",
  "spread",
  "moneyline",
  "1st_half_total",
  "1st_half_spread",
  "1st_quarter_total",
  "1st_quarter_spread",
  
  // Yes/No markets
  "both_teams_to_score",
  "over_under_goals",
] as const;

/**
 * Markets that are NOT suitable for standard 2-way de-vigging
 * (3+ way markets, or markets with correlation issues)
 */
export const NON_TWO_WAY_MARKETS = [
  "first_basket",
  "first_field_goal",
  "first_touchdown",
  "anytime_touchdown",
  "first_goal",
  "exact_score",
  "correct_score",
  "race_to_points",
] as const;
