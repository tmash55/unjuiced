/**
 * Adapter: Transform v2 Opportunity API response to BestOddsDeal format
 * 
 * This allows us to use the new /api/v2/opportunities endpoint with
 * existing BestOddsTable and BestOddsCards components.
 */

import type { BestOddsDeal } from "@/lib/best-odds-schema";

/**
 * v2 Opportunity structure (from /api/v2/opportunities)
 */
export interface OpportunityV2 {
  // Core identifiers
  sport: string;
  event_id: string;
  player: string;
  market: string;
  line: number;
  side: "over" | "under";

  // Best available odds
  best_book: string;
  best_price: string;        // Signed American ("+159")
  best_decimal: number;
  best_link: string | null;
  n_books: number;
  all_books: Array<{
    book: string;
    price: number;
    decimal: number;
    link: string | null;
    sgp: string | null;
  }>;

  // Sharp reference
  sharp_price: string | null;      // Signed American ("+108")
  sharp_decimal: number | null;
  sharp_books: string[];
  blend_complete: boolean;
  blend_weight_available: number;

  // Edge metrics
  edge: number | null;
  edge_pct: number | null;

  // Implied probabilities
  best_implied: number | null;
  sharp_implied: number | null;

  // +EV metrics
  true_probability: number | null;
  fair_decimal: number | null;
  fair_american: string | null;
  implied_edge: number | null;
  ev: number | null;
  ev_pct: number | null;
  kelly_fraction: number | null;
  devig_method: "proper" | "estimated" | null;

  // Quality info
  overround: number | null;
  market_coverage: {
    n_books_over: number;
    n_books_under: number;
    two_way_devig_ready: boolean;
  } | null;
  devig_inputs: {
    source: "sharp_book" | "sharp_blend" | "market_average";
    aggregation: "single" | "mean" | "weighted";
    over_books: string[];
    under_books: string[];
  } | null;

  // Opposite side
  opposite_side: {
    side: "over" | "under";
    sharp_price: string | null;
    sharp_decimal: number | null;
    best_book: string | null;
    best_price: string | null;
    best_decimal: number | null;
    all_books: Array<{
      book: string;
      price: number;
      decimal: number;
      link: string | null;
      sgp: string | null;
    }>;
  } | null;

  // Event metadata
  home_team: string;
  away_team: string;
  game_start: string;
  timestamp: number;
}

export interface OpportunitiesResponseV2 {
  opportunities: OpportunityV2[];
  count: number;
  total_scanned: number;
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
  timing_ms: number;
}

/**
 * Parse signed American odds string to number
 * "+159" → 159, "-110" → -110
 */
function parseAmericanOdds(price: string | number | null): number {
  if (price === null) return 0;
  if (typeof price === "number") return price;
  return parseInt(price.replace("+", ""), 10);
}

/**
 * Transform a single Opportunity to BestOddsDeal
 */
export function opportunityToDeal(opp: OpportunityV2): BestOddsDeal {
  const side = opp.side === "over" ? "o" : "u";
  
  // Build the key in the expected format
  const key = `${opp.sport}:evt_${opp.event_id}:${opp.player}:${opp.market}:${opp.line}:${side}`;

  // Find the best book entry for deep link
  const bestBookEntry = opp.all_books.find((b) => b.book === opp.best_book);

  // Calculate average price from all books (for backwards compat)
  const avgPrice = opp.all_books.length > 0
    ? Math.round(opp.all_books.reduce((sum, b) => sum + b.price, 0) / opp.all_books.length)
    : parseAmericanOdds(opp.best_price);

  return {
    // Core identifiers
    key,
    sport: opp.sport as BestOddsDeal["sport"],
    eid: opp.event_id,
    ent: opp.player,
    mkt: opp.market,
    ln: opp.line,
    side,

    // Odds data
    bestBook: opp.best_book,
    bestPrice: parseAmericanOdds(opp.best_price),
    bestLink: opp.best_link || bestBookEntry?.link || "",
    numBooks: opp.n_books,
    avgPrice,
    priceImprovement: opp.edge_pct ?? 0,

    // All available books
    allBooks: opp.all_books.map((b) => ({
      book: b.book,
      price: b.price,
      link: b.link || "",
      mobileLink: null,
      limit_max: null,
    })),

    // Optional fields
    bestLimit: null,
    bestLinkMobile: null,

    scope: "pregame", // SSE data is pregame
    lastUpdated: opp.timestamp,

    // Enriched metadata
    playerName: opp.player,
    player_name: opp.player,
    homeTeam: opp.home_team,
    home_team: opp.home_team,
    awayTeam: opp.away_team,
    away_team: opp.away_team,
    startTime: opp.game_start,
    game_start: opp.game_start,
    
    // Keep position/team empty for now (can be enriched separately if needed)
    team: undefined,
    position: undefined,
    sid: undefined,
  };
}

/**
 * Transform full API response to BestOddsResponse format
 */
export function transformOpportunitiesResponse(
  response: OpportunitiesResponseV2
): {
  deals: BestOddsDeal[];
  total: number;
  version: number;
  premiumCount: number;
} {
  return {
    deals: response.opportunities.map(opportunityToDeal),
    total: response.count,
    version: Date.now(), // Use timestamp as version
    premiumCount: 0,
  };
}

/**
 * Extended deal with v2-specific fields for advanced UI features
 * Useful when you want to access EV/devig data in components
 */
export interface BestOddsDealV2 extends BestOddsDeal {
  // Sharp reference (new)
  sharpPrice?: string | null;
  sharpDecimal?: number | null;
  sharpBooks?: string[];
  
  // EV metrics (new)
  ev?: number | null;
  evPct?: number | null;
  trueProbability?: number | null;
  fairDecimal?: number | null;
  fairAmerican?: string | null;
  impliedEdge?: number | null;
  kellyFraction?: number | null;
  devigMethod?: "proper" | "estimated" | null;
  
  // Implied probabilities (new)
  bestImplied?: number | null;
  sharpImplied?: number | null;
  
  // Quality indicators (new)
  overround?: number | null;
  blendComplete?: boolean;
  twoWayDevigReady?: boolean;
  devigSource?: "sharp_book" | "sharp_blend" | "market_average" | null;
  
  // Opposite side (new)
  oppositeSide?: {
    side: "over" | "under";
    bestBook: string | null;
    bestPrice: number | null;
    allBooks: Array<{
      book: string;
      price: number;
      decimal: number;
      link: string | null;
    }>;
  } | null;
}

/**
 * Transform to extended deal format (preserves all v2 data)
 */
export function opportunityToExtendedDeal(opp: OpportunityV2): BestOddsDealV2 {
  const baseDeal = opportunityToDeal(opp);
  
  return {
    ...baseDeal,
    
    // Sharp reference
    sharpPrice: opp.sharp_price,
    sharpDecimal: opp.sharp_decimal,
    sharpBooks: opp.sharp_books,
    
    // EV metrics
    ev: opp.ev,
    evPct: opp.ev_pct,
    trueProbability: opp.true_probability,
    fairDecimal: opp.fair_decimal,
    fairAmerican: opp.fair_american,
    impliedEdge: opp.implied_edge,
    kellyFraction: opp.kelly_fraction,
    devigMethod: opp.devig_method,
    
    // Implied probabilities
    bestImplied: opp.best_implied,
    sharpImplied: opp.sharp_implied,
    
    // Quality indicators
    overround: opp.overround,
    blendComplete: opp.blend_complete,
    twoWayDevigReady: opp.market_coverage?.two_way_devig_ready ?? false,
    devigSource: opp.devig_inputs?.source ?? null,
    
    // Opposite side
    oppositeSide: opp.opposite_side ? {
      side: opp.opposite_side.side,
      bestBook: opp.opposite_side.best_book,
      bestPrice: opp.opposite_side.best_price 
        ? parseAmericanOdds(opp.opposite_side.best_price) 
        : null,
      allBooks: opp.opposite_side.all_books.map((b) => ({
        book: b.book,
        price: b.price,
        decimal: b.decimal,
        link: b.link,
      })),
    } : null,
  };
}

