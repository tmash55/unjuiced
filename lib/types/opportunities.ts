/**
 * V2 Opportunities Type Definitions
 * 
 * Native types for the /api/v2/opportunities endpoint.
 * No adapters needed - components use these directly.
 */

export type Sport = "nba" | "nfl" | "nhl" | "ncaaf" | "ncaab" | "mlb" | "wnba" | "soccer_epl";
export type Side = "over" | "under" | "yes" | "no";
export type DevigMethod = "proper" | "estimated";
export type DevigSource = "sharp_book" | "sharp_blend" | "market_average";

/**
 * Betting limits info (max wager)
 */
export interface BookLimits {
  max: number;
}

/**
 * A single book's odds for a selection
 */
export interface BookOdds {
  book: string;
  price: number;           // American odds as number
  priceFormatted: string;  // "+159" or "-110"
  decimal: number;
  link: string | null;
  sgp: string | null;      // SGP eligibility token
  limits: BookLimits | null;  // Betting limits when available
}

/**
 * Market coverage and devig quality info
 */
export interface MarketCoverage {
  nBooksOver: number;
  nBooksUnder: number;
  twoWayDevigReady: boolean;
}

/**
 * Information about how devigging was performed
 */
export interface DevigInfo {
  source: DevigSource;
  aggregation: "single" | "mean" | "weighted";
  overBooks: string[];
  underBooks: string[];
}

/**
 * The opposite side of a two-way market
 */
export interface OppositeSide {
  side: Side;
  sharpPrice: string | null;
  sharpDecimal: number | null;
  bestBook: string | null;
  bestPrice: string | null;
  bestDecimal: number | null;
  allBooks: BookOdds[];
}

/**
 * Core opportunity data from v2 API
 */
export interface Opportunity {
  // Identifiers
  id: string;              // Unique key for React
  sport: Sport;
  eventId: string;
  player: string;
  team: string | null;     // Player's team abbreviation
  position: string | null; // Player's position (e.g., "G/F", "QB")
  market: string;
  marketDisplay: string;   // Human-readable market (e.g., "Player Points")
  line: number;
  side: Side;

  // Event metadata
  homeTeam: string;
  awayTeam: string;
  gameStart: string;       // ISO timestamp
  timestamp: number;

  // Best available odds
  bestBook: string;
  bestPrice: string;       // "+159"
  bestDecimal: number;
  bestLink: string | null;
  nBooks: number;
  allBooks: BookOdds[];

  // Sharp reference
  sharpPrice: string | null;
  sharpDecimal: number | null;
  sharpBooks: string[];
  blendComplete: boolean;
  blendWeight: number;
  avgBookCount: number;    // Number of books used in average calculation (after RSI dedup)

  // Edge metrics
  edge: number | null;
  edgePct: number | null;

  // Implied probabilities
  bestImplied: number | null;
  sharpImplied: number | null;

  // +EV metrics (requires proper devig)
  trueProbability: number | null;
  fairDecimal: number | null;
  fairAmerican: string | null;
  impliedEdge: number | null;
  ev: number | null;
  evPct: number | null;
  kellyFraction: number | null;
  devigMethod: DevigMethod | null;

  // Quality indicators
  overround: number | null;
  marketCoverage: MarketCoverage | null;
  devigInfo: DevigInfo | null;

  // Opposite side
  oppositeSide: OppositeSide | null;

  // Filter metadata (for multi-filter support)
  filterId: string | null;       // ID of the custom filter that matched (null = preset mode)
  filterName: string | null;     // Display name of the filter
  filterIcon: string | null;     // Sports string (e.g., "nba" or "nba,nfl")
}

/**
 * API response from /api/v2/opportunities
 */
export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  totalScanned: number;
  filters: {
    sports: string[];
    preset: string | null;
    blend: Array<{ book: string; weight: number }> | null;
    minEdge: number;
    minEV: number | null;
    minOdds: number;
    maxOdds: number;
    minBooksPerSide: number;
    requireTwoWay: boolean;
    limit: number;
    sortBy: string;
    sortDir: string;
  };
  timingMs: number;
}

/**
 * Filter/sort options for opportunities
 */
export interface OpportunityFilters {
  sports: Sport[];
  preset: string | null;
  blend: Array<{ book: string; weight: number }> | null;
  limit: number;
  minEdge: number;
  minEV: number | null;
  minOdds: number;
  maxOdds: number;
  minBooksPerSide: number;
  requireTwoWay: boolean;
  requireFullBlend: boolean;  // If true, hide records when blend books are missing
  marketType: "all" | "player" | "game";  // Filter by player props or game lines
  searchQuery: string;
  selectedBooks: string[];
  selectedMarkets: string[];
  selectedLeagues: string[];  // For league filtering (derived from sports)
  marketLines: Record<string, number[]>;  // Line values per market (e.g., {"touchdowns": [0.5]}). Empty = all lines
  sortBy: "edge_pct" | "ev_pct" | "best_decimal" | "kelly_fraction";
  sortDir: "asc" | "desc";
}

/**
 * Filter configuration with metadata (for multi-filter support)
 */
export interface FilterConfig {
  filters: OpportunityFilters;
  metadata: {
    filterId: string;        // Unique ID (preset ID or "default")
    filterName: string;      // Display name
    filterIcon: string;      // Sport icon(s)
    isCustom: boolean;       // true = custom preset, false = preset mode
  };
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: OpportunityFilters = {
  sports: ["nba"],
  preset: "pinnacle",
  blend: null,
  limit: 200,
  minEdge: 0,
  minEV: null,
  minOdds: -500,
  maxOdds: 500,
  minBooksPerSide: 2,
  requireTwoWay: false,
  requireFullBlend: false,
  marketType: "all",
  searchQuery: "",
  selectedBooks: [],
  selectedMarkets: [],
  selectedLeagues: [],
  marketLines: {},
  sortBy: "edge_pct",
  sortDir: "desc",
};

// ============================================
// Helper Functions
// ============================================

/**
 * Parse API response to native Opportunity format
 */
export function parseOpportunity(raw: Record<string, unknown>): Opportunity {
  // Parse event data safely
  const eventData = raw.event as Record<string, unknown> | null;
  
  return {
    id: `${raw.sport}:${raw.event_id}:${raw.player}:${raw.market}:${raw.line}:${raw.side}`,
    sport: raw.sport as Sport,
    eventId: raw.event_id as string,
    player: (raw.player as string) || "",
    team: (raw.team as string) || null,
    position: (raw.position as string) || null,
    market: (raw.market as string) || "",
    marketDisplay: (raw.market_display as string) || (raw.market as string) || "",
    line: raw.line as number,
    side: raw.side as Side,

    // Event data can be nested or flat
    homeTeam: eventData?.home_team as string || (raw.home_team as string) || "",
    awayTeam: eventData?.away_team as string || (raw.away_team as string) || "",
    gameStart: eventData?.start_time as string || (raw.game_start as string) || "",
    timestamp: raw.timestamp as number,

    bestBook: raw.best_book as string,
    bestPrice: raw.best_price as string,
    bestDecimal: raw.best_decimal as number,
    bestLink: raw.best_link as string | null,
    nBooks: raw.n_books as number,
    allBooks: ((raw.all_books as Array<Record<string, unknown>>) || []).map((b) => ({
      book: b.book as string,
      price: b.price as number,
      priceFormatted: formatAmericanOdds(b.price as number),
      decimal: b.decimal as number,
      link: b.link as string | null,
      sgp: b.sgp as string | null,
      limits: b.limits as { max: number } | null,
    })),

    sharpPrice: raw.sharp_price as string | null,
    sharpDecimal: raw.sharp_decimal as number | null,
    sharpBooks: (raw.sharp_books as string[]) || [],
    blendComplete: raw.blend_complete as boolean,
    blendWeight: raw.blend_weight_available as number,
    avgBookCount: (raw.avg_book_count as number) || 0,

    edge: raw.edge as number | null,
    edgePct: raw.edge_pct as number | null,

    bestImplied: raw.best_implied as number | null,
    sharpImplied: raw.sharp_implied as number | null,

    trueProbability: raw.true_probability as number | null,
    fairDecimal: raw.fair_decimal as number | null,
    fairAmerican: raw.fair_american as string | null,
    impliedEdge: raw.implied_edge as number | null,
    ev: raw.ev as number | null,
    evPct: raw.ev_pct as number | null,
    kellyFraction: raw.kelly_fraction as number | null,
    devigMethod: raw.devig_method as DevigMethod | null,

    overround: raw.overround as number | null,
    marketCoverage: raw.market_coverage
      ? {
          nBooksOver: (raw.market_coverage as Record<string, unknown>).n_books_over as number,
          nBooksUnder: (raw.market_coverage as Record<string, unknown>).n_books_under as number,
          twoWayDevigReady: (raw.market_coverage as Record<string, unknown>).two_way_devig_ready as boolean,
        }
      : null,
    devigInfo: raw.devig_inputs
      ? {
          source: (raw.devig_inputs as Record<string, unknown>).source as DevigSource,
          aggregation: (raw.devig_inputs as Record<string, unknown>).aggregation as "single" | "mean" | "weighted",
          overBooks: (raw.devig_inputs as Record<string, unknown>).over_books as string[],
          underBooks: (raw.devig_inputs as Record<string, unknown>).under_books as string[],
        }
      : null,

    oppositeSide: raw.opposite_side
      ? {
          side: (raw.opposite_side as Record<string, unknown>).side as Side,
          sharpPrice: (raw.opposite_side as Record<string, unknown>).sharp_price as string | null,
          sharpDecimal: (raw.opposite_side as Record<string, unknown>).sharp_decimal as number | null,
          bestBook: (raw.opposite_side as Record<string, unknown>).best_book as string | null,
          bestPrice: (raw.opposite_side as Record<string, unknown>).best_price as string | null,
          bestDecimal: (raw.opposite_side as Record<string, unknown>).best_decimal as number | null,
          allBooks: (
            ((raw.opposite_side as Record<string, unknown>).all_books as Array<Record<string, unknown>>) || []
          ).map((b) => ({
            book: b.book as string,
            price: b.price as number,
            priceFormatted: formatAmericanOdds(b.price as number),
            decimal: b.decimal as number,
            link: b.link as string | null,
            sgp: b.sgp as string | null,
            limits: (b.limits as { max: number } | null) ?? null,
          })),
        }
      : null,

    // Filter metadata (populated after parsing for multi-filter support)
    filterId: (raw.filter_id as string) || null,
    filterName: (raw.filter_name as string) || null,
    filterIcon: (raw.filter_icon as string) || null,
  };
}

/**
 * Format American odds as signed string
 */
export function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

/**
 * Format edge percentage for display
 */
export function formatEdge(edgePct: number | null): string {
  if (edgePct === null) return "—";
  const sign = edgePct > 0 ? "+" : "";
  return `${sign}${edgePct.toFixed(1)}%`;
}

/**
 * Format EV percentage for display
 */
export function formatEV(evPct: number | null): string {
  if (evPct === null) return "—";
  const sign = evPct > 0 ? "+" : "";
  return `${sign}${evPct.toFixed(1)}%`;
}

/**
 * Format probability as percentage
 */
export function formatProbability(prob: number | null): string {
  if (prob === null) return "—";
  return `${(prob * 100).toFixed(1)}%`;
}

/**
 * Format Kelly fraction as percentage
 */
export function formatKelly(kelly: number | null): string {
  if (kelly === null || kelly <= 0) return "—";
  return `${(kelly * 100).toFixed(1)}%`;
}

/**
 * Get quality grade based on edge and EV
 */
export function getOpportunityGrade(opp: Opportunity): "A" | "B" | "C" | "D" | null {
  const ev = opp.evPct;
  const edge = opp.edgePct;
  const twoWay = opp.marketCoverage?.twoWayDevigReady;

  if (ev === null && edge === null) return null;

  // A: High EV (>5%) with proper devig
  if (ev !== null && ev >= 5 && twoWay) return "A";
  
  // B: Good EV (2-5%) or high edge (>10%)
  if ((ev !== null && ev >= 2) || (edge !== null && edge >= 10)) return "B";
  
  // C: Moderate edge (5-10%)
  if (edge !== null && edge >= 5) return "C";
  
  // D: Low edge
  return "D";
}

/**
 * Shorten market names to save space
 * - Period prefixes: "1st Half" -> "1H", "2nd Quarter" -> "2Q"
 * - Remove redundant "Player" prefix
 */
export function shortenPeriodPrefix(text: string): string {
  return text
    // Shorten period prefixes
    .replace(/1st Quarter /i, "1Q ")
    .replace(/2nd Quarter /i, "2Q ")
    .replace(/3rd Quarter /i, "3Q ")
    .replace(/4th Quarter /i, "4Q ")
    .replace(/1st Half /i, "1H ")
    .replace(/2nd Half /i, "2H ")
    .replace(/First Quarter /i, "1Q ")
    .replace(/Second Quarter /i, "2Q ")
    .replace(/Third Quarter /i, "3Q ")
    .replace(/Fourth Quarter /i, "4Q ")
    .replace(/First Half /i, "1H ")
    .replace(/Second Half /i, "2H ")
    .replace(/1st Period /i, "P1 ")
    .replace(/2nd Period /i, "P2 ")
    .replace(/3rd Period /i, "P3 ")
    // Remove redundant "Player" prefix
    .replace(/Player /gi, "");
}

/**
 * Get market display name with shortened period prefixes
 */
export function formatMarketName(market: string): string {
  const names: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes_made: "3-Pointers",
    player_steals: "Steals",
    player_blocks: "Blocks",
    player_turnovers: "Turnovers",
    player_points_rebounds_assists: "PRA",
    player_points_rebounds: "Pts+Reb",
    player_points_assists: "Pts+Ast",
    player_rebounds_assists: "Reb+Ast",
    passing_yards: "Pass Yds",
    rushing_yards: "Rush Yds",
    receiving_yards: "Rec Yds",
    passing_touchdowns: "Pass TDs",
    rushing_touchdowns: "Rush TDs",
    receptions: "Receptions",
  };
  
  const result = names[market] || market.replace(/_/g, " ").replace(/player /i, "");
  return shortenPeriodPrefix(result);
}

