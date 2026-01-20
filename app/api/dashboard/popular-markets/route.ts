import { NextRequest, NextResponse } from "next/server";

/**
 * Dashboard Popular Markets API
 * 
 * Returns top plays for viral/popular markets:
 * - First Basket (NBA)
 * - Double Double (NBA)
 * - Triple Double (NBA)
 * - Anytime TD (NFL)
 * - Anytime Goal Scorer (NHL)
 * - First Goal Scorer (NHL)
 * 
 * Leverages the existing opportunities API for consistent data.
 */

// Popular markets configuration
const POPULAR_MARKETS = [
  { key: "player_first_basket", display: "First Basket", sport: "nba", maxPlays: 2 },
  { key: "player_double_double", display: "Double Double", sport: "nba", maxPlays: 2 },
  { key: "player_triple_double", display: "Triple Double", sport: "nba", maxPlays: 2 },
  { key: "player_anytime_td", display: "Anytime TD", sport: "nfl", maxPlays: 2 },
  { key: "anytime_td", display: "Anytime TD", sport: "nfl", maxPlays: 2 }, // Alternative key
  { key: "player_first_td", display: "First TD", sport: "nfl", maxPlays: 1 },
  { key: "first_td", display: "First TD", sport: "nfl", maxPlays: 1 }, // Alternative key
  { key: "player_anytime_goal", display: "Anytime Goal", sport: "nhl", maxPlays: 2 },
  { key: "anytime_goal_scorer", display: "Anytime Goal", sport: "nhl", maxPlays: 2 }, // Alternative key
  { key: "player_first_goal", display: "First Goal", sport: "nhl", maxPlays: 1 },
  { key: "first_goal_scorer", display: "First Goal", sport: "nhl", maxPlays: 1 }, // Alternative key
];

// Sport icons
const SPORT_ICONS: Record<string, string> = {
  nba: "🏀",
  nfl: "🏈",
  nhl: "🏒",
};

interface MarketPlay {
  player: string;
  team: string | null;
  line: number;
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
}

interface PopularMarket {
  marketKey: string;
  displayName: string;
  sport: string;
  icon: string;
  plays: MarketPlay[];
  edgeFinderUrl: string;
}

interface PopularMarketsResponse {
  markets: PopularMarket[];
  timestamp: number;
}

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = req.nextUrl.origin;
    
    // Fetch opportunities from all sports
    const response = await fetch(
      `${baseUrl}/api/v2/opportunities?sports=nba,nfl,nhl&limit=200&sort=ev`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    
    if (!response.ok) {
      console.error("[Popular Markets] Opportunities API error:", response.status);
      return NextResponse.json({
        markets: [],
        timestamp: Date.now(),
      });
    }
    
    const data = await response.json();
    const opportunities = data.opportunities || [];
    
    // Group opportunities by market
    const marketGroups = new Map<string, { config: typeof POPULAR_MARKETS[0]; plays: any[] }>();
    
    for (const marketConfig of POPULAR_MARKETS) {
      const key = `${marketConfig.sport}-${marketConfig.display}`;
      if (!marketGroups.has(key)) {
        marketGroups.set(key, { config: marketConfig, plays: [] });
      }
    }
    
    // Match opportunities to popular markets
    for (const opp of opportunities) {
      const market = (opp.market || "").toLowerCase();
      const sport = (opp.sport || "").toLowerCase();
      
      for (const marketConfig of POPULAR_MARKETS) {
        if (sport === marketConfig.sport && market === marketConfig.key.toLowerCase()) {
          const key = `${marketConfig.sport}-${marketConfig.display}`;
          const group = marketGroups.get(key);
          if (group) {
            group.plays.push(opp);
          }
          break;
        }
      }
    }
    
    // Build response
    const marketsWithPlays: PopularMarket[] = [];
    
    for (const [key, group] of marketGroups) {
      if (group.plays.length === 0) continue;
      
      // Sort by EV and take top plays
      const sortedPlays = group.plays
        .sort((a: any, b: any) => (b.ev_pct || -999) - (a.ev_pct || -999))
        .slice(0, group.config.maxPlays);
      
      const plays: MarketPlay[] = sortedPlays.map((opp: any) => ({
        player: opp.player || "Unknown",
        team: opp.team || null,
        line: opp.line || 0.5,
        bestOdds: parseInt(opp.best_price) || 0,
        bestOddsFormatted: opp.best_price || "0",
        book: opp.best_book || "unknown",
        evPercent: opp.ev_pct ? Math.round(opp.ev_pct * 10) / 10 : null,
      }));
      
      marketsWithPlays.push({
        marketKey: group.config.key,
        displayName: group.config.display,
        sport: group.config.sport,
        icon: SPORT_ICONS[group.config.sport] || "🎯",
        plays,
        edgeFinderUrl: `/edge-finder?markets=${group.config.key}&sports=${group.config.sport}`,
      });
    }
    
    // Sort markets by whether they have positive EV plays
    marketsWithPlays.sort((a, b) => {
      const aMaxEV = Math.max(...a.plays.map(p => p.evPercent || 0), 0);
      const bMaxEV = Math.max(...b.plays.map(p => p.evPercent || 0), 0);
      return bMaxEV - aMaxEV;
    });
    
    const result: PopularMarketsResponse = {
      markets: marketsWithPlays,
      timestamp: Date.now(),
    };
    
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[Popular Markets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular markets", markets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}
