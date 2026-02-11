/**
 * SSE Odds Types
 * 
 * Types and utilities for the SSE-powered odds system.
 * These match the Redis key structure from the SSE consumer.
 */

// =============================================================================
// MARKET CONSTANTS
// =============================================================================

/**
 * Canonical market keys - use these everywhere for consistency.
 * Maps to display names for UI.
 */
export const SSE_MARKETS = {
  // Player Props - Core
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes_made: "3-Pointers", // Note: _made suffix
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_turnovers: "Turnovers",
  
  // Player Props - Combos
  player_pra: "PRA",
  player_points_rebounds_assists: "PRA",
  player_pr: "PTS+REB",
  player_points_rebounds: "P+R",
  player_pa: "PTS+AST",
  player_points_assists: "P+A",
  player_ra: "REB+AST",
  player_rebounds_assists: "R+A",
  player_bs: "BLK+STL",
  player_blocks_steals: "B+S",
  
  // Player Props - Special
  player_double_double: "Double Double",
  player_fantasy: "Fantasy Points",
  
  // First Basket Markets (NBA)
  first_field_goal: "First Basket",
  team_first_basket: "First Basket (Team)",
  home_team_first_field_goal: "First Basket (Home)",
  away_team_first_field_goal: "First Basket (Away)",
  
  // Game Markets
  game_spread: "Point Spread",
  game_total: "Game Total",
  game_moneyline: "Moneyline",
  team_total: "Team Total",
} as const;

export type SSEMarketKey = keyof typeof SSE_MARKETS;

/**
 * Normalize raw market display names to consistent labels.
 * This handles cases where different sportsbooks send different names for the same market.
 */
const RAW_MARKET_ALIASES: Record<string, string> = {
  // First Basket variations - all should display as "First Basket"
  "First Field Goal": "First Basket",
  "First Basket": "First Basket",
  "First Basket Scorer": "First Basket",
  "1st Basket": "First Basket",
  "1st Field Goal": "First Basket",
  "Team First Basket": "First Basket (Team)",
  "Team First Field Goal": "First Basket (Team)",
  "Home Team First Basket": "First Basket (Home)",
  "Home Team First Field Goal": "First Basket (Home)",
  "Away Team First Basket": "First Basket (Away)", 
  "Away Team First Field Goal": "First Basket (Away)",
  // 1Q Points variations
  "1st Quarter Points": "1Q Points",
  "1Q Points": "1Q Points",
  "First Quarter Points": "1Q Points",
};

/**
 * Normalize a raw market name to a consistent display name.
 * Used when setting marketDisplay from SSE data.
 */
export function normalizeRawMarket(rawMarket: string): string {
  return RAW_MARKET_ALIASES[rawMarket] || rawMarket;
}

/**
 * Get display name for a market key
 */
export function getMarketDisplay(market: string): string {
  return SSE_MARKETS[market as SSEMarketKey] || market.replace(/_/g, " ").replace(/player /i, "");
}

/**
 * Get short display name for a market key (for compact UI)
 */
export function getMarketDisplayShort(market: string): string {
  const shortNames: Record<string, string> = {
    player_points: "PTS",
    player_rebounds: "REB",
    player_assists: "AST",
    player_threes_made: "3PM",
    player_steals: "STL",
    player_blocks: "BLK",
    player_turnovers: "TO",
    player_pra: "PRA",
    player_pr: "P+R",
    player_pa: "P+A",
    player_ra: "R+A",
    player_bs: "B+S",
    player_double_double: "DD",
    player_fantasy: "FAN",
    game_spread: "SPR",
    game_total: "TOT",
    game_moneyline: "ML",
    team_total: "TT",
  };
  return shortNames[market] || market.slice(0, 3).toUpperCase();
}

// =============================================================================
// PLAYER NAME NORMALIZATION
// =============================================================================

/**
 * Normalize player name to match Redis selection key format.
 * MUST match SSE consumer's normalization exactly.
 * 
 * Rules:
 * 1. Lowercase
 * 2. Spaces → underscores
 * 3. Remove periods (.)
 * 4. Remove apostrophes (')
 * 5. Hyphens → underscores
 * 
 * @example
 * normalizePlayerName("LeBron James") // → "lebron_james"
 * normalizePlayerName("De'Aaron Fox") // → "deaaron_fox"
 * normalizePlayerName("P.J. Washington") // → "pj_washington"
 * normalizePlayerName("Karl-Anthony Towns") // → "karl_anthony_towns"
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/-/g, "_");
}

/**
 * Build a selection key from player name, side, and line.
 * 
 * @example
 * buildSelectionKey("LeBron James", "over", 25.5) // → "lebron_james|over|25.5"
 */
export function buildSelectionKey(
  playerName: string,
  side: "over" | "under" | "ml" | "spread",
  line: number
): string {
  return `${normalizePlayerName(playerName)}|${side}|${line}`;
}

// =============================================================================
// REDIS KEY HELPERS
// =============================================================================

/**
 * Build Redis key for active events SET
 */
export function getActiveEventsKey(sport: string): string {
  return `active_events:${sport}`;
}

/**
 * Build Redis key for event metadata
 */
export function getEventKey(sport: string, eventId: string): string {
  return `events:${sport}:${eventId}`;
}

/**
 * Build Redis key pattern for all books in a market
 */
export function getMarketOddsPattern(sport: string, eventId: string, market: string): string {
  return `odds:${sport}:${eventId}:${market}:*`;
}

/**
 * Build Redis key for specific book's odds
 */
export function getBookOddsKey(sport: string, eventId: string, market: string, book: string): string {
  return `odds:${sport}:${eventId}:${market}:${book}`;
}

// =============================================================================
// DATA TYPES
// =============================================================================

/**
 * Event metadata from Redis
 */
export interface SSEEvent {
  event_id: string;
  is_live: boolean;
  commence_time: string;
  home_team_id: string;
  home_team: string;
  home_team_name: string;
  away_team_id: string;
  away_team: string;
  away_team_name: string;
  updated: string;
}

/**
 * Individual selection (player/line/side) from Redis
 */
export interface SSESelection {
  player: string;
  player_id: string;
  jersey_number: string;
  position: string;
  team: string;
  team_name: string;
  side: "over" | "under" | "ml" | "spread";
  line: number;
  price: string; // American odds as string, e.g., "-115", "+120"
  price_decimal: number;
  main: boolean;
  locked: boolean;
  link: string;
  mobile_link?: string | null;  // Deep link for mobile apps (e.g., fanduelsportsbook://...)
  sgp: string | null;
  limits: { max: number } | null;  // Betting limits (max wager) when available
  raw_market: string;
  updated: string;
}

/**
 * All selections for a book (keyed by selection key)
 */
export type SSEBookSelections = Record<string, SSESelection>;

/**
 * All books for a market
 */
export type SSEMarketOdds = Record<string, SSEBookSelections>;

/**
 * Book price info for edge calculation
 */
export interface BookPrice {
  book: string;
  price: string;
  decimal: number;
  link: string;
  sgp: string | null;
  selection: SSESelection;
}

/**
 * Edge calculation result for a single selection
 */
export interface EdgeResult {
  // Event info
  event_id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  is_live: boolean;
  
  // Selection info
  player: string;
  player_id: string;
  team: string;
  market: string;
  market_display: string;
  line: number;
  side: "over" | "under" | "ml" | "spread";
  
  // Best odds
  best_book: string;
  best_price: string;
  best_decimal: number;
  best_link: string;
  best_sgp: string | null;
  
  // Comparison
  pinnacle_price: string | null;
  pinnacle_decimal: number | null;
  circa_price: string | null;
  circa_decimal: number | null;
  average_decimal: number;
  
  // Edge calculations
  edge_vs_pinnacle: number | null; // Decimal difference
  edge_vs_pinnacle_pct: number | null; // Percentage
  edge_vs_average: number;
  edge_vs_average_pct: number;
  
  // All books for this selection
  all_books: Array<{
    book: string;
    price: string;
    decimal: number;
    link: string;
  }>;
}

/**
 * Edge finder API response
 */
export interface EdgeFinderResponse {
  edges: EdgeResult[];
  count: number;
  total_found: number;
  market: string;
  compare_book: string;
  min_edge: number;
}

// =============================================================================
// ODDS UTILITIES
// =============================================================================

/**
 * Parse American odds string to number
 */
export function parseAmericanOdds(odds: string): number {
  return parseInt(odds.replace("+", ""), 10);
}

/**
 * Format decimal odds to American odds string
 */
export function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) {
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  } else {
    const american = Math.round(-100 / (decimal - 1));
    return `${american}`;
  }
}

/**
 * Calculate implied probability from decimal odds
 */
export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

/**
 * Calculate edge between two decimal odds
 */
export function calculateEdge(best: number, comparison: number): {
  edge: number;
  edgePct: number;
} {
  const edge = best - comparison;
  const edgePct = ((best / comparison) - 1) * 100;
  return { edge, edgePct };
}

