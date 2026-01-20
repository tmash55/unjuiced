import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard Best Bets API
 * 
 * Returns top 9 +EV bets (player props AND game lines) across NBA, NFL, NHL.
 * Uses the same /api/v2/positive-ev endpoint that the EV tool uses,
 * with Pinnacle as the sharp reference for devigging.
 */

// Sports to fetch for the dashboard
const DASHBOARD_SPORTS = ["nba", "nfl", "nhl"];

// Minimum EV to be considered a "best bet" (same as EV tool default)
const MIN_EV_THRESHOLD = 0.5;

interface BestBet {
  id: string;
  player: string;
  team: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  edgePercent: number | null;
  kelly: number | null;
  fairOdds: number | null;
  devigMethod: string | null;
  sport: string;
  eventId: string;
  startTime: string | null;
  oddsSelectionId: string | null;
  booksSnapshot: Record<string, {
    price: number;
    url: string | null;
    mobileUrl: string | null;
    sgp: string | null;
  }>;
  deepLink?: string | null;
}

interface BestBetsResponse {
  bets: BestBet[];
  timestamp: number;
}

function formatOdds(price: number | string): string {
  const numPrice = typeof price === "string" ? parseInt(price) : price;
  if (isNaN(numPrice)) return "0";
  return numPrice > 0 ? `+${numPrice}` : String(numPrice);
}

/**
 * Format player/display name for game lines vs player props
 */
function formatDisplayName(opp: any): string {
  const playerName = opp.playerName || opp.playerDisplay || opp.player;
  
  // Game lines - show teams
  if (playerName === "game_total" || playerName === "game_spread" || !playerName) {
    if (opp.homeTeam && opp.awayTeam) {
      return `${opp.awayTeam} @ ${opp.homeTeam}`;
    }
    return opp.marketDisplay || opp.market || "Game";
  }
  
  // Player props - show player name
  return playerName;
}

/**
 * Helper to get decimal odds from American odds
 */
function getDecimalOdds(american: number): number {
  if (american > 0) {
    return 1 + (american / 100);
  } else {
    return 1 + (100 / Math.abs(american));
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the base URL for internal API calls
    const baseUrl = req.nextUrl.origin;
    
    // Build the API URL using the same endpoint and parameters as the EV tool
    const apiUrl = new URL(`${baseUrl}/api/v2/positive-ev`);
    apiUrl.searchParams.set("sports", DASHBOARD_SPORTS.join(","));
    apiUrl.searchParams.set("sharpPreset", "pinnacle"); // Pinnacle devigging
    apiUrl.searchParams.set("devigMethods", "power,multiplicative");
    apiUrl.searchParams.set("minEV", String(MIN_EV_THRESHOLD));
    apiUrl.searchParams.set("minBooksPerSide", "2"); // Same as EV tool default
    apiUrl.searchParams.set("limit", "100");
    apiUrl.searchParams.set("mode", "pregame");
    
    console.log("[Dashboard Best Bets] Fetching from:", apiUrl.toString());
    
    const response = await fetch(apiUrl.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    
    if (!response.ok) {
      console.error("[Dashboard Best Bets] Positive EV API error:", response.status);
      return NextResponse.json({
        bets: [],
        timestamp: Date.now(),
      });
    }
    
    const data = await response.json();
    const opportunities = data.opportunities || [];
    
    console.log(`[Dashboard Best Bets] Found ${opportunities.length} opportunities from EV API`);
    
    // Helper to get EV percent from opportunity
    const getEvPercent = (opp: any): number => {
      // 1. Try pre-calculated fields
      let ev = opp.evPercent ?? opp.ev_pct ?? 0;
      if (ev > 0) return ev;
      
      // 2. Try evCalculations object
      if (opp.evCalculations) {
        // Try to get worst-case EV first (most conservative)
        if (opp.evCalculations.worstCase?.ev > 0) return opp.evCalculations.worstCase.ev * 100;
        if (opp.evCalculations.average?.ev > 0) return opp.evCalculations.average.ev * 100;
        
        // Try specific method (power/multiplicative)
        const methods = Object.values(opp.evCalculations);
        for (const calc of methods as any[]) {
          if (calc && calc.ev > 0) return calc.ev * 100;
        }
      }
      
      // 3. Calculate manually if we have fair probability and best odds
      const fairProb = opp.devigResults?.power?.fairProbOver ?? 
                       opp.devigResults?.multiplicative?.fairProbOver ?? 
                       opp.devigResults?.average?.fairProbOver;
                       
      if (fairProb > 0) {
        const bestBook = (opp.allBooks || opp.bookOffers || [])[0];
        const bestPrice = bestBook?.price ?? bestBook?.american ?? opp.best_price;
        
        if (bestPrice) {
          const decimalOdds = getDecimalOdds(typeof bestPrice === 'string' ? parseInt(bestPrice) : bestPrice);
          // EV = (Decimal Odds * Fair Win Probability) - 1
          const calculatedEv = (decimalOdds * fairProb) - 1;
          return calculatedEv * 100;
        }
      }
      
      return 0;
    };
    
    // Filter for positive EV only
    const validOpps = opportunities.filter((opp: any) => {
      const evPct = getEvPercent(opp);
      return evPct > 0;
    });
    
    console.log(`[Dashboard Best Bets] ${validOpps.length} opportunities with positive EV`);
    
    // Transform opportunities to BestBet format (Limit to 9 for 3x3 grid)
    const bets: BestBet[] = validOpps
      .slice(0, 9)
      .map((opp: any, idx: number) => {
        // Build books snapshot from allBooks
        const booksSnapshot: Record<string, any> = {};
        const bookOffers = opp.allBooks || opp.bookOffers || [];
        for (const book of bookOffers) {
          const bookId = book.bookId || book.book;
          if (bookId) {
            booksSnapshot[bookId] = {
              price: book.price || book.american,
              url: book.link || book.url || null,
              mobileUrl: book.mobileLink || book.mobile_link || null,
              sgp: book.sgp || null,
            };
          }
        }
        
        // Get best book info from allBooks (first one is typically best)
        const bestBook = bookOffers[0] || {};
        
        const evPct = getEvPercent(opp);
        // Calculate edge manually if missing (Edge = Fair Prob - Implied Prob)
        let edgePct = opp.edgePercent ?? opp.edge_pct ?? 0;
        if (!edgePct && evPct > 0) {
           // Approximate edge roughly equal to EV for small values, or 0 if unknown
           edgePct = evPct; 
        }
        
        // Get best odds
        const bestPrice = bestBook.price ?? bestBook.american ?? 0;
        
        // Format display name (player name or team matchup for game lines)
        const displayName = formatDisplayName(opp);
        
        // Extract book name (could be string or object)
        let bookName = "unknown";
        if (typeof opp.book === "string") {
          bookName = opp.book;
        } else if (opp.book?.bookId) {
          bookName = opp.book.bookId;
        } else if (bestBook.bookId) {
          bookName = bestBook.bookId;
        }
        
        // Ensure bestOdds is a number
        let bestOddsNum = 0;
        if (typeof bestPrice === "number") {
          bestOddsNum = bestPrice;
        } else if (typeof bestPrice === "string") {
          bestOddsNum = parseInt(bestPrice) || 0;
        }
        
        // Extract kelly
        const kelly = opp.kelly_fraction ?? opp.kelly ?? null;
        
        // Extract fair odds (fair_american)
        const fairOdds = opp.fair_american ? parseInt(opp.fair_american) : null;
        
        // Extract deep link
        const deepLink = bestBook.mobileLink || bestBook.mobile_link || bestBook.link || bestBook.url;

        return {
          id: `best-${opp.eventId}-${opp.market}-${opp.line}-${opp.side}-${idx}`,
          player: displayName,
          team: opp.playerTeam || null,
          homeTeam: opp.homeTeam || null,
          awayTeam: opp.awayTeam || null,
          market: opp.market || "unknown",
          marketDisplay: opp.marketDisplay || opp.market || "Unknown",
          line: opp.line || 0,
          side: opp.side || "over",
          bestOdds: bestOddsNum,
          bestOddsFormatted: formatOdds(bestOddsNum),
          book: bookName,
          evPercent: evPct ? Math.round(evPct * 10) / 10 : null,
          edgePercent: edgePct ? Math.round(edgePct * 10) / 10 : null,
          kelly: kelly,
          fairOdds: fairOdds,
          devigMethod: "Pinnacle", // Hardcoded as we force Pinnacle preset
          sport: opp.sport || "unknown",
          eventId: opp.eventId || "",
          startTime: opp.startTime || null,
          oddsSelectionId: opp.playerId || null,
          booksSnapshot,
          deepLink,
        };
      });
    
    console.log(`[Dashboard Best Bets] Returning ${bets.length} bets`);
    
    const result: BestBetsResponse = {
      bets,
      timestamp: Date.now(),
    };
    
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[Dashboard Best Bets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch best bets", bets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}
