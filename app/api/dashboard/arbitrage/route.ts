import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard Arbitrage API
 * 
 * Returns top 3 arbitrage opportunities for the Today dashboard.
 * Leverages the existing arbs API for consistent data.
 */

interface ArbOpportunity {
  id: string;
  event: string;
  market: string;
  marketDisplay: string;
  books: string[];
  roiPercent: number;
  sport: string;
  startTime: string | null;
  isLive: boolean;
}

interface ArbitrageResponse {
  arbs: ArbOpportunity[];
  timestamp: number;
}

// Market display name mapping
const MARKET_DISPLAY: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes_made: "3PM",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_turnovers: "Turnovers",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  spread: "Spread",
  totals: "Total",
  moneyline: "Moneyline",
  h2h: "Moneyline",
};

function getMarketDisplay(market: string): string {
  return MARKET_DISPLAY[market] || market.replace(/_/g, " ").replace(/player /i, "");
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = req.nextUrl.origin;
    
    // Fetch arbs from the existing API - pregame only for stability
    const response = await fetch(
      `${baseUrl}/api/arbs?mode=pregame&limit=10`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    
    if (!response.ok) {
      console.error("[Dashboard Arbitrage] Arbs API error:", response.status);
      return NextResponse.json({
        arbs: [],
        timestamp: Date.now(),
      });
    }
    
    const data = await response.json();
    const rows = data.rows || [];
    
    // Transform to dashboard format and take top 3
    const arbs: ArbOpportunity[] = rows
      .slice(0, 3)
      .map((row: any) => {
        // Extract books from legs
        const books: string[] = [];
        if (row.legs && Array.isArray(row.legs)) {
          for (const leg of row.legs) {
            if (leg.book && !books.includes(leg.book)) {
              books.push(leg.book);
            }
          }
        }
        
        // Build event name
        let event = "Unknown Event";
        if (row.event) {
          event = row.event;
        } else if (row.away_team && row.home_team) {
          event = `${row.away_team} @ ${row.home_team}`;
        }
        
        return {
          id: row.id || `arb-${Date.now()}`,
          event,
          market: row.market || "unknown",
          marketDisplay: getMarketDisplay(row.market || "unknown"),
          books,
          roiPercent: row.roi_bps ? Math.round((row.roi_bps / 100) * 100) / 100 : 0,
          sport: row.sport || "unknown",
          startTime: row.start_time || null,
          isLive: !!row.live,
        };
      });
    
    const result: ArbitrageResponse = {
      arbs,
      timestamp: Date.now(),
    };
    
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[Dashboard Arbitrage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch arbitrage", arbs: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}
