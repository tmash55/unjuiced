export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { 
  normalizePlayerName, 
  getMarketDisplay,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import { getPreset, SHARP_PRESETS } from "@/lib/odds/presets";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Supported sports
const VALID_SPORTS = new Set(["nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "wnba"]);

// Types
interface BookWeight {
  book: string;
  weight: number;
}

interface Opportunity {
  sport: string;
  event_id: string;
  event: {
    home_team: string;
    away_team: string;
    start_time: string;
  } | null;
  player: string;
  team: string | null;
  position: string | null;
  market: string;
  market_display: string;
  line: number;
  side: "over" | "under";

  // Best odds
  best_book: string;
  best_price: number;
  best_decimal: number;
  best_link: string | null;

  // Sharp reference
  sharp_price: string | null;         // Signed American odds (e.g. "+108", "-143")
  sharp_decimal: number | null;
  sharp_books: string[];
  blend_complete: boolean;
  blend_weight_available: number;

  // Edge metrics
  edge: number | null;
  edge_pct: number | null;

  // Implied probabilities (for debugging and tooltips)
  best_implied: number | null;      // 1 / best_decimal
  sharp_implied: number | null;     // 1 / sharp_decimal
  
  // +EV metrics (properly devigged using both sides)
  true_probability: number | null;
  fair_decimal: number | null;      // 1 / true_probability
  fair_american: string | null;     // fair_decimal converted to American (signed, e.g. "+122")
  implied_edge: number | null;      // true_probability - best_implied
  ev: number | null;
  ev_pct: number | null;
  kelly_fraction: number | null;
  devig_method: "proper" | "estimated" | null;
  
  // Devig quality info
  overround: number | null;         // Total vig: (implied_over + implied_under) - 1
  
  // Market coverage: how many books exist on each side
  market_coverage: {
    n_books_over: number;
    n_books_under: number;
    two_way_devig_ready: boolean;   // Both sides have enough books (≥ minBooksPerSide)
  } | null;
  
  // Devig inputs: what was used to calculate fair odds
  devig_inputs: {
    source: "sharp_book" | "sharp_blend" | "market_average";
    aggregation: "single" | "mean" | "weighted";  // How books were combined
    over_books: string[];           // Which books contributed to over sharp
    under_books: string[];          // Which books contributed to under sharp
  } | null;

  // Opposite side info (for transparency and expandable rows)
  opposite_side: {
    side: "over" | "under";
    sharp_price: string | null;       // Signed American odds
    sharp_decimal: number | null;
    best_book: string | null;
    best_price: string | null;        // Signed American odds
    best_decimal: number | null;
    all_books: {
      book: string;
      price: number;
      decimal: number;
      link: string | null;
      sgp: string | null;
    }[];
  } | null;

  // All books
  all_books: {
    book: string;
    price: number;
    decimal: number;
    link: string | null;
    sgp: string | null;
  }[];
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  total_scanned: number;
  filters: {
    sports: string[];
    markets: string[] | null;
    min_odds: number;
    max_odds: number;
    min_edge: number;
    min_ev: number;
    preset: string | null;
    blend: BookWeight[] | null;
    require_full_blend: boolean;
    min_books_per_side: number;
    require_two_way: boolean;
  };
  timing_ms: number;
}

/**
 * GET /api/v2/opportunities
 * 
 * Unified endpoint for Edge Finder and +EV tool
 * Aggregates opportunities across multiple sports and markets
 * 
 * Query params:
 *   sports    - Comma-separated sports (default: "nba")
 *   markets   - Comma-separated markets (default: all)
 *   minOdds   - Minimum American odds (default: -500)
 *   maxOdds   - Maximum American odds (default: 500)
 *   minEdge   - Minimum edge % vs sharp (default: 0)
 *   minEV     - Minimum EV % (default: 0)
 *   blend     - Custom book weights (e.g., "pinnacle:0.6,circa:0.4")
 *   limit     - Max results (default: 100)
 *   sort      - Sort by "edge" or "ev" (default: "ev")
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;

    // Parse parameters
    const sportsParam = params.get("sports")?.toLowerCase().split(",").filter(Boolean) || ["nba"];
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));
    
    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    const markets = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const minOdds = parseInt(params.get("minOdds") || "-500");
    const maxOdds = parseInt(params.get("maxOdds") || "500");
    const minEdge = parseFloat(params.get("minEdge") || "0");
    const minEV = parseFloat(params.get("minEV") || "0");
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);
    const sortBy = params.get("sort") === "edge" ? "edge" : "ev";
    const requireFullBlend = params.get("requireFullBlend") === "true";
    const minBooksPerSide = Math.max(1, parseInt(params.get("minBooksPerSide") || "2"));
    const requireTwoWay = params.get("requireTwoWay") === "true";

    // Parse blend - can be a preset ID or custom blend string
    const presetId = params.get("preset");
    const blendParam = params.get("blend");
    let blend: BookWeight[] | null = null;
    let presetName: string | null = null;

    // Track if user explicitly requested average
    let useAverage = false;

    if (presetId) {
      // Use preset
      const preset = getPreset(presetId);
      if (preset) {
        presetName = preset.name;
        if (preset.books.length > 0) {
          blend = preset.books;
        } else {
          // Empty books = average preset
          useAverage = true;
        }
      }
    } else if (blendParam) {
      // Use custom blend
      blend = parseBlend(blendParam);
    }
    // If neither, blend is null (default behavior: Pinnacle > Circa > average)

    // Fetch all sports in parallel
    const sportPromises = sports.map((sport) =>
      fetchSportOpportunities(sport, markets, blend, minBooksPerSide, useAverage)
    );
    const results = await Promise.all(sportPromises);

    // Merge all results
    let allOpportunities = results.flat();
    const totalScanned = allOpportunities.length;

    // Apply filters
    allOpportunities = allOpportunities.filter((o) => {
      // Odds range filter
      if (o.best_price < minOdds || o.best_price > maxOdds) return false;

      // Edge filter
      if (minEdge > 0 && (o.edge_pct === null || o.edge_pct < minEdge)) return false;

      // EV filter
      if (minEV > 0 && (o.ev_pct === null || o.ev_pct < minEV)) return false;

      // Full blend filter
      if (requireFullBlend && !o.blend_complete) return false;

      // Two-way complete filter
      if (requireTwoWay && (!o.market_coverage || !o.market_coverage.two_way_devig_ready)) return false;

      return true;
    });

    // Sort
    if (sortBy === "ev") {
      allOpportunities.sort((a, b) => (b.ev_pct || 0) - (a.ev_pct || 0));
    } else {
      allOpportunities.sort((a, b) => (b.edge_pct || 0) - (a.edge_pct || 0));
    }

    // Limit
    const opportunities = allOpportunities.slice(0, limit);

    const response: OpportunitiesResponse = {
      opportunities,
      count: opportunities.length,
      total_scanned: totalScanned,
      filters: {
        sports,
        markets,
        min_odds: minOdds,
        max_odds: maxOdds,
        min_edge: minEdge,
        min_ev: minEV,
        preset: presetName,
        blend,
        require_full_blend: requireFullBlend,
        min_books_per_side: minBooksPerSide,
        require_two_way: requireTwoWay,
      },
      timing_ms: Date.now() - startTime,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (error) {
    console.error("[/api/v2/opportunities] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", timing_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

/**
 * Parse blend parameter: "pinnacle:0.6,circa:0.4" -> [{ book, weight }]
 */
function parseBlend(blendStr: string | null): BookWeight[] | null {
  if (!blendStr) return null;

  const weights: BookWeight[] = [];
  const parts = blendStr.split(",");

  for (const part of parts) {
    const [book, weightStr] = part.split(":");
    const weight = parseFloat(weightStr);
    if (book && !isNaN(weight) && weight > 0 && weight <= 1) {
      weights.push({ book: book.toLowerCase(), weight });
    }
  }

  // Validate weights sum to ~1.0
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (weights.length === 0 || Math.abs(totalWeight - 1) > 0.01) {
    return null; // Invalid blend, fall back to default
  }

  return weights;
}

/**
 * Fetch opportunities for a single sport
 */
// Intermediate structure to collect both sides of a selection
interface SelectionPair {
  sport: string;
  eventId: string;
  event: { home_team: string; away_team: string; start_time: string } | null;
  player: string;
  playerRaw: string;
  team: string | null;
  position: string | null;
  market: string;
  line: number;
  over: {
    books: { book: string; price: number; decimal: number; link: string | null; sgp: string | null }[];
    best: { book: string; price: number; decimal: number; link: string | null } | null;
  };
  under: {
    books: { book: string; price: number; decimal: number; link: string | null; sgp: string | null }[];
    best: { book: string; price: number; decimal: number; link: string | null } | null;
  };
}

async function fetchSportOpportunities(
  sport: string,
  markets: string[] | null,
  blend: BookWeight[] | null,
  minBooksPerSide: number,
  useAverage: boolean
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];
  // Map to collect both sides: key = "eventId:market:player:line"
  const pairMap = new Map<string, SelectionPair>();

  try {
    // Get active events
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];

    // Fetch event details
    const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
    const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

    // Build event map
    const eventMap = new Map<string, { home_team: string; away_team: string; start_time: string }>();
    eventIds.forEach((id, i) => {
      const event = eventsRaw[i];
      if (event) {
        eventMap.set(id, {
          home_team: (event.home_team as string) || "",
          away_team: (event.away_team as string) || "",
          start_time: (event.start_time as string) || "",
        });
      }
    });

    // Process each event
    for (const eventId of eventIds) {
      const event = eventMap.get(eventId) || null;

      // Scan for all odds keys for this event: odds:nba:eventId:market:book
      const oddsPattern = `odds:${sport}:${eventId}:*`;
      const oddsKeys = await scanKeys(oddsPattern);

      if (oddsKeys.length === 0) continue;

      // Group keys by market
      const keysByMarket = new Map<string, string[]>();
      for (const key of oddsKeys) {
        const parts = key.split(":");
        const market = parts[3];
        const book = parts[4];
        if (!market || !book) continue;
        
        // Filter by markets if specified
        if (markets && !markets.includes(market)) continue;

        if (!keysByMarket.has(market)) {
          keysByMarket.set(market, []);
        }
        keysByMarket.get(market)!.push(key);
      }

      // Process each market
      for (const [market, marketKeys] of keysByMarket) {
        // Batch fetch all books for this market
        const oddsDataRaw = await redis.mget<(SSEBookSelections | string | null)[]>(...marketKeys);

        // Build book → selections map
        const bookSelections: Record<string, SSEBookSelections> = {};
        marketKeys.forEach((key, i) => {
          const book = key.split(":").pop()!;
          const data = oddsDataRaw[i];
          if (data) {
            bookSelections[book] = typeof data === "string" ? JSON.parse(data) : data;
          }
        });

        // Get all unique base selection keys (player|line without side)
        const baseSelectionKeys = new Set<string>();
        for (const selections of Object.values(bookSelections)) {
          for (const key of Object.keys(selections)) {
            const [playerRaw, , lineStr] = key.split("|");
            if (playerRaw && lineStr) {
              baseSelectionKeys.add(`${playerRaw}|${lineStr}`);
            }
          }
        }

        // Process each player/line pair (collecting both over and under)
        for (const baseKey of baseSelectionKeys) {
          const [playerRaw, lineStr] = baseKey.split("|");
          const player = normalizePlayerName(playerRaw);
          const line = parseFloat(lineStr);

          // Create unique pair key (without side)
          const pairKey = `${eventId}:${market}:${player}:${line}`;

          // Get or create selection pair
          let pair = pairMap.get(pairKey);
          if (!pair) {
            pair = {
              sport,
              eventId,
              event,
              player,
              playerRaw,
              team: null,
              position: null,
              market,
              line,
              over: { books: [], best: null },
              under: { books: [], best: null },
            };
            pairMap.set(pairKey, pair);
          }

          // Gather prices from all books for both sides
          for (const [book, selections] of Object.entries(bookSelections)) {
            // Check over side
            const overKey = `${playerRaw}|over|${lineStr}`;
            const overSel = selections[overKey] as SSESelection | undefined;
            if (overSel && !overSel.locked) {
              pair.over.books.push({
                book,
                price: overSel.price,
                decimal: overSel.price_decimal,
                link: overSel.link || null,
                sgp: overSel.sgp || null,
              });
              if (!pair.over.best || overSel.price_decimal > pair.over.best.decimal) {
                pair.over.best = {
                  book,
                  price: overSel.price,
                  decimal: overSel.price_decimal,
                  link: overSel.link || null,
                };
              }
              if (overSel.team && !pair.team) pair.team = overSel.team;
              if (overSel.position && !pair.position) pair.position = overSel.position;
            }

            // Check under side
            const underKey = `${playerRaw}|under|${lineStr}`;
            const underSel = selections[underKey] as SSESelection | undefined;
            if (underSel && !underSel.locked) {
              pair.under.books.push({
                book,
                price: underSel.price,
                decimal: underSel.price_decimal,
                link: underSel.link || null,
                sgp: underSel.sgp || null,
              });
              if (!pair.under.best || underSel.price_decimal > pair.under.best.decimal) {
                pair.under.best = {
                  book,
                  price: underSel.price,
                  decimal: underSel.price_decimal,
                  link: underSel.link || null,
                };
              }
              if (underSel.team && !pair.team) pair.team = underSel.team;
              if (underSel.position && !pair.position) pair.position = underSel.position;
            }
          }
        }
      }
    }

    // Convert pairs to opportunities with proper devigging
    for (const pair of pairMap.values()) {
      // Create opportunities for both sides if they have enough books
      const sides: ("over" | "under")[] = ["over", "under"];
      
      for (const side of sides) {
        const sideData = pair[side];
        const oppositeSide = side === "over" ? "under" : "over";
        const oppositeData = pair[oppositeSide];

        // Need at least 2 books on this side
        if (sideData.books.length < 2 || !sideData.best) continue;

        const opp: Opportunity = {
          sport: pair.sport,
          event_id: pair.eventId,
          event: pair.event,
          player: pair.player,
          team: pair.team,
          position: pair.position,
          market: pair.market,
          market_display: getMarketDisplay(pair.market),
          line: pair.line,
          side,
          best_book: sideData.best.book,
          best_price: sideData.best.price,
          best_decimal: sideData.best.decimal,
          best_link: sideData.best.link,
          sharp_price: null,
          sharp_decimal: null,
          sharp_books: [],
          blend_complete: true,
          blend_weight_available: 1.0,
          edge: null,
          edge_pct: null,
          best_implied: null,
          sharp_implied: null,
          true_probability: null,
          fair_decimal: null,
          fair_american: null,
          implied_edge: null,
          ev: null,
          ev_pct: null,
          kelly_fraction: null,
          devig_method: null,
          overround: null,
          market_coverage: null,
          devig_inputs: null,
          opposite_side: oppositeData.books.length > 0 ? {
            side: oppositeSide,
            sharp_price: null,
            sharp_decimal: null,
            best_book: oppositeData.best?.book || null,
            best_price: oppositeData.best ? formatAmericanOdds(oppositeData.best.price) : null,
            best_decimal: oppositeData.best?.decimal || null,
            all_books: oppositeData.books,
          } : null,
          all_books: sideData.books,
        };

        // Calculate metrics with proper devigging
        calculateMetricsWithDevig(opp, sideData, oppositeData, blend, minBooksPerSide, useAverage);
        opportunities.push(opp);
      }
    }

    return opportunities;
  } catch (error) {
    console.error(`[opportunities] Error fetching ${sport}:`, error);
    return [];
  }
}

/**
 * Calculate edge and EV metrics for an opportunity
 */
interface SideData {
  books: { book: string; price: number; decimal: number; link: string | null; sgp: string | null }[];
  best: { book: string; price: number; decimal: number; link: string | null } | null;
}

/**
 * Calculate metrics with proper devigging using both sides of the market
 */
function calculateMetricsWithDevig(
  opp: Opportunity,
  sideData: SideData,
  oppositeData: SideData,
  blend: BookWeight[] | null,
  minBooksPerSide: number,
  useAverage: boolean
): void {
  if (sideData.books.length < 2) return;

  // Sort books by decimal (best first)
  opp.all_books.sort((a, b) => b.decimal - a.decimal);

  // Get sharp odds for THIS side
  const thisSharp = getSharpOdds(sideData.books, blend, useAverage);

  // Get sharp odds for OPPOSITE side (needed for devig)
  const oppositeSharp = getSharpOdds(oppositeData.books, blend, useAverage);

  // Update blend flags
  opp.blend_complete = thisSharp.blendComplete;
  opp.blend_weight_available = thisSharp.blendWeight;

  // Set market coverage info
  const nBooksOver = opp.side === "over" ? sideData.books.length : oppositeData.books.length;
  const nBooksUnder = opp.side === "under" ? sideData.books.length : oppositeData.books.length;
  const twoWayComplete = sideData.books.length >= minBooksPerSide && 
                          oppositeData.books.length >= minBooksPerSide;

  opp.market_coverage = {
    n_books_over: nBooksOver,
    n_books_under: nBooksUnder,
    two_way_devig_ready: twoWayComplete,
  };

  // Set devig inputs info
  const devigSource: "sharp_book" | "sharp_blend" | "market_average" = 
    useAverage ? "market_average" :
    (blend && blend.length > 1) ? "sharp_blend" :
    "sharp_book";

  const aggregation: "single" | "mean" | "weighted" = 
    useAverage ? "mean" :
    (blend && blend.length > 1) ? "weighted" :
    "single";

  opp.devig_inputs = {
    source: devigSource,
    aggregation,
    over_books: opp.side === "over" ? thisSharp.sharpBooks : oppositeSharp.sharpBooks,
    under_books: opp.side === "under" ? thisSharp.sharpBooks : oppositeSharp.sharpBooks,
  };

  if (!thisSharp.sharpDecimal || thisSharp.sharpDecimal <= 1) return;

  // Set implied probabilities
  opp.best_implied = 1 / opp.best_decimal;
  opp.sharp_implied = 1 / thisSharp.sharpDecimal;

  // Set sharp reference for this side
  opp.sharp_decimal = thisSharp.sharpDecimal;
  opp.sharp_price = decimalToAmericanString(thisSharp.sharpDecimal);
  opp.sharp_books = thisSharp.sharpBooks;

  // Calculate EDGE (one-sided comparison - works without opposite side)
  opp.edge = opp.best_decimal - thisSharp.sharpDecimal;
  opp.edge_pct = ((opp.best_decimal / thisSharp.sharpDecimal) - 1) * 100;

  // Calculate EV (requires both sides for proper devig)
  if (oppositeSharp.sharpDecimal && oppositeSharp.sharpDecimal > 1 && twoWayComplete) {
    // PROPER DEVIG: Use both sides to calculate true probability
    const thisImplied = 1 / thisSharp.sharpDecimal;
    const oppositeImplied = 1 / oppositeSharp.sharpDecimal;
    const totalVig = thisImplied + oppositeImplied;
    const overround = totalVig - 1;

    // True probabilities after removing vig
    const trueProb = thisImplied / totalVig;

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied;
    opp.overround = overround;
    opp.devig_method = "proper";

    // Update opposite side info with sharp odds
    if (opp.opposite_side) {
      opp.opposite_side.sharp_decimal = oppositeSharp.sharpDecimal;
      opp.opposite_side.sharp_price = decimalToAmericanString(oppositeSharp.sharpDecimal);
    }

    // Calculate EV: (probability × payout) - 1
    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    // Kelly criterion: (bp - q) / b
    // where b = decimal - 1, p = true prob, q = 1 - p
    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  } else if (oppositeSharp.sharpDecimal && oppositeSharp.sharpDecimal > 1) {
    // Have both sides but NOT enough books - still calculate but mark as incomplete
    const thisImplied = 1 / thisSharp.sharpDecimal;
    const oppositeImplied = 1 / oppositeSharp.sharpDecimal;
    const totalVig = thisImplied + oppositeImplied;
    const overround = totalVig - 1;

    const trueProb = thisImplied / totalVig;

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied!;
    opp.overround = overround;
    opp.devig_method = "proper"; // Still proper math, just low confidence

    if (opp.opposite_side) {
      opp.opposite_side.sharp_decimal = oppositeSharp.sharpDecimal;
      opp.opposite_side.sharp_price = decimalToAmericanString(oppositeSharp.sharpDecimal);
    }

    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  } else {
    // FALLBACK: Estimate using typical vig assumption (2.5%)
    const impliedProb = 1 / thisSharp.sharpDecimal;
    const trueProb = impliedProb * 0.975; // Rough vig removal

    opp.true_probability = trueProb;
    opp.fair_decimal = 1 / trueProb;
    opp.fair_american = decimalToAmericanString(opp.fair_decimal);
    opp.implied_edge = trueProb - opp.best_implied!;
    opp.overround = 0.025; // Assumed
    opp.devig_method = "estimated";

    opp.ev = (trueProb * opp.best_decimal) - 1;
    opp.ev_pct = opp.ev * 100;

    if (opp.ev > 0) {
      const b = opp.best_decimal - 1;
      const p = trueProb;
      const q = 1 - p;
      opp.kelly_fraction = Math.max(0, (b * p - q) / b);
    }
  }
}

/**
 * Get sharp odds from a list of book prices (using blend, average, or default)
 */
function getSharpOdds(
  books: { book: string; decimal: number }[],
  blend: BookWeight[] | null,
  useAverage: boolean = false
): {
  sharpDecimal: number | null;
  sharpBooks: string[];
  blendComplete: boolean;
  blendWeight: number;
} {
  if (books.length === 0) {
    return { sharpDecimal: null, sharpBooks: [], blendComplete: true, blendWeight: 0 };
  }

  let sharpDecimal: number | null = null;
  const sharpBooks: string[] = [];
  let blendComplete = true;
  let blendWeight = 1.0;

  if (useAverage) {
    // Explicit market average: use all books
    sharpDecimal = books.reduce((sum, b) => sum + b.decimal, 0) / books.length;
    // List all books used in the average
    books.forEach(b => sharpBooks.push(b.book));
  } else if (blend && blend.length > 0) {
    // Custom blend of specific books
    let weightedSum = 0;
    let totalWeight = 0;
    const requestedWeight = blend.reduce((sum, b) => sum + b.weight, 0);

    for (const { book, weight } of blend) {
      const bookOdds = books.find((b) => b.book === book);
      if (bookOdds) {
        weightedSum += bookOdds.decimal * weight;
        totalWeight += weight;
        sharpBooks.push(book);
      }
    }

    blendWeight = requestedWeight > 0 ? totalWeight / requestedWeight : 0;
    blendComplete = totalWeight >= requestedWeight * 0.99;

    if (totalWeight > 0) {
      sharpDecimal = weightedSum / totalWeight;
    }
  } else {
    // Default: Pinnacle, then Circa, then average
    const pinnacle = books.find((b) => b.book === "pinnacle");
    const circa = books.find((b) => b.book === "circa");

    if (pinnacle) {
      sharpDecimal = pinnacle.decimal;
      sharpBooks.push("pinnacle");
    } else if (circa) {
      sharpDecimal = circa.decimal;
      sharpBooks.push("circa");
    } else {
      // Fallback to average
      sharpDecimal = books.reduce((sum, b) => sum + b.decimal, 0) / books.length;
      sharpBooks.push("average");
    }
  }

  return { sharpDecimal, sharpBooks, blendComplete, blendWeight };
}

/**
 * Convert decimal odds to American (returns signed string like "+150" or "-110")
 */
function decimalToAmericanString(decimal: number): string {
  if (decimal >= 2) {
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  } else {
    return String(Math.round(-100 / (decimal - 1)));
  }
}

/**
 * Format American odds number as signed string ("+150" or "-110")
 */
function formatAmericanOdds(price: number): string {
  if (price > 0) {
    return `+${price}`;
  }
  return String(price);
}

/**
 * Convert decimal odds to American number (for backwards compat)
 */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Get active event IDs for a sport
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  // Try active events set first
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    return activeSet;
  }

  // Fallback to scanning event keys
  const eventKeys = await scanKeys(`events:${sport}:*`);
  return eventKeys.map((k) => k.split(":")[2]).filter(Boolean);
}

/**
 * Scan Redis keys with pattern
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0");

  return keys;
}

