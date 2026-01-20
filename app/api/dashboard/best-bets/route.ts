import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard Best Bets API
 * 
 * Returns top 10 value bets across NBA, NFL, NHL for the Today dashboard.
 * Leverages the existing opportunities API for consistent data.
 */

// Sports to fetch for the dashboard
const DASHBOARD_SPORTS = ["nba", "nfl", "nhl"];

interface BestBet {
  id: string;
  player: string;
  team: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  edgePercent: number | null;
  sport: string;
  eventId: string;
  startTime: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  oddsSelectionId: string | null;
  booksSnapshot: Record<string, {
    price: number;
    url: string | null;
    mobileUrl: string | null;
    sgp: string | null;
  }>;
}

interface BestBetsResponse {
  bets: BestBet[];
  timestamp: number;
}

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

export async function GET(req: NextRequest) {
  try {
    // Get the base URL for internal API calls
    const baseUrl = req.nextUrl.origin;
    
    // Fetch opportunities from the existing API
    const response = await fetch(
      `${baseUrl}/api/v2/opportunities?sports=${DASHBOARD_SPORTS.join(",")}&minEV=0&limit=50&sort=ev`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        // Allow internal fetch in edge runtime
        cache: "no-store",
      }
    );
    
    if (!response.ok) {
      console.error("[Dashboard Best Bets] Opportunities API error:", response.status);
      return NextResponse.json({
        bets: [],
        timestamp: Date.now(),
      });
    }
    
    const data = await response.json();
    const opportunities = data.opportunities || [];
    
    // Transform opportunities to BestBet format
    const bets: BestBet[] = opportunities
      .filter((opp: any) => opp.ev_pct && opp.ev_pct > 0)
      .slice(0, 10)
      .map((opp: any) => {
        // Build books snapshot
        const booksSnapshot: Record<string, any> = {};
        if (opp.all_books) {
          for (const book of opp.all_books) {
            booksSnapshot[book.book] = {
              price: book.price,
              url: book.link || null,
              mobileUrl: book.mobile_link || null,
              sgp: book.sgp || null,
            };
          }
        }
        
        return {
          id: `${opp.event_id}-${opp.market}-${opp.line}-${opp.side}`,
          player: opp.player || "Unknown",
          team: opp.team || null,
          market: opp.market || "unknown",
          marketDisplay: opp.market_display || opp.market || "unknown",
          line: opp.line || 0,
          side: opp.side || "over",
          bestOdds: parseInt(opp.best_price) || 0,
          bestOddsFormatted: opp.best_price || "0",
          book: opp.best_book || "unknown",
          evPercent: opp.ev_pct ? Math.round(opp.ev_pct * 10) / 10 : null,
          edgePercent: opp.edge_pct ? Math.round(opp.edge_pct * 10) / 10 : null,
          sport: opp.sport || "unknown",
          eventId: opp.event_id || "",
          startTime: opp.event?.start_time || null,
          homeTeam: opp.event?.home_team || null,
          awayTeam: opp.event?.away_team || null,
          oddsSelectionId: opp.player_id || null,
          booksSnapshot,
        };
      });
    
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
