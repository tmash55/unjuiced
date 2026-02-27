import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  responseEncoding: false,
});

/**
 * Dashboard Popular Markets API
 * 
 * Reads pre-computed popular market edges from Redis.
 * 
 * Redis Structure:
 * - Key: dashboard:popular-markets:data (HASH)
 * - Fields: market names (e.g., "first_basket", "double_double")
 * - Values: JSON array of plays for each market
 * 
 * - Key: dashboard:popular-markets:timestamp (STRING)
 * - Value: Unix timestamp (ms) of last update
 */

const REDIS_DATA_KEY = "dashboard:popular-markets:data";
const REDIS_TIMESTAMP_KEY = "dashboard:popular-markets:timestamp";

// Market display configuration
const MARKET_CONFIG: Record<string, { display: string; sport: string; maxPlays: number }> = {
  first_basket: { display: "First Basket", sport: "nba", maxPlays: 2 },
  player_first_basket: { display: "First Basket", sport: "nba", maxPlays: 2 },
  double_double: { display: "Double Double", sport: "nba", maxPlays: 2 },
  player_double_double: { display: "Double Double", sport: "nba", maxPlays: 2 },
  triple_double: { display: "Triple Double", sport: "nba", maxPlays: 2 },
  player_triple_double: { display: "Triple Double", sport: "nba", maxPlays: 2 },
  anytime_td: { display: "Anytime TD", sport: "nfl", maxPlays: 2 },
  player_anytime_td: { display: "Anytime TD", sport: "nfl", maxPlays: 2 },
  first_td: { display: "First TD", sport: "nfl", maxPlays: 2 },
  player_first_td: { display: "First TD", sport: "nfl", maxPlays: 2 },
  anytime_goal: { display: "Anytime Goal", sport: "nhl", maxPlays: 2 },
  player_anytime_goal: { display: "Anytime Goal", sport: "nhl", maxPlays: 2 },
  first_goal: { display: "First Goal", sport: "nhl", maxPlays: 2 },
  player_first_goal: { display: "First Goal", sport: "nhl", maxPlays: 2 },
};

// Sport icons
const SPORT_ICONS: Record<string, string> = {
  nba: "🏀",
  nfl: "🏈",
  nhl: "🏒",
  ncaab: "🏀",
  ncaaf: "🏈",
};

interface RedisOpportunity {
  id: string;
  player: string;
  playerRaw: string;
  team: string;
  position?: string;
  market: string;
  marketDisplay: string;
  side: string;
  bestOdds: number;
  bestOddsFormatted: string;
  bestOddsDecimal: number;
  avgOdds: number;
  avgOddsFormatted: string;
  avgOddsDecimal: number;
  book: string;
  u: string | null;
  m: string | null;
  deepLink: string | null;
  vsMarketAvg: number;
  bookCount: number;
  uniqueBookCount: number;
  sport: string;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  isLive: boolean;
}

interface MarketPlay {
  player: string;
  team: string | null;
  line: number;
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  marketAvg: number | null;
  marketAvgFormatted: string | null;
  vsMarketAvg: number | null;
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

export async function GET(req: NextRequest) {
  try {
    // Read the hash: each field = market name, value = JSON array of plays
    const hashData = await redis.hgetall(REDIS_DATA_KEY);
    const timestamp = await redis.get(REDIS_TIMESTAMP_KEY);
    
    if (!hashData || Object.keys(hashData).length === 0) {
      return NextResponse.json({
        markets: [],
        timestamp: Date.now(),
      });
    }

    // Build markets from hash data
    // Structure: { "first_basket": "[{play1}, {play2}]", "double_double": "[...]" }
    const marketsWithPlays: PopularMarket[] = [];

    for (const [marketKey, playsJson] of Object.entries(hashData)) {
      const config = MARKET_CONFIG[marketKey];
      if (!config) {
        continue;
      }

      // Parse the JSON array of plays
      let plays: RedisOpportunity[] = [];
      try {
        if (typeof playsJson === "string") {
          plays = JSON.parse(playsJson);
        } else if (Array.isArray(playsJson)) {
          plays = playsJson;
        }
      } catch {
        continue;
      }

      if (!Array.isArray(plays) || plays.length === 0) {
        continue;
      }

      // Get sport from first play or from config
      const sport = plays[0]?.sport || config.sport;

      // Sort by vsMarketAvg descending and take top plays
      const sortedPlays = plays
        .sort((a, b) => (b.vsMarketAvg || 0) - (a.vsMarketAvg || 0))
        .slice(0, config.maxPlays);

      const formattedPlays: MarketPlay[] = sortedPlays.map((opp) => ({
        player: opp.player,
        team: opp.team || null,
        line: 0.5, // One-way markets don't have traditional lines
        bestOdds: opp.bestOdds,
        bestOddsFormatted: opp.bestOddsFormatted,
        book: opp.book,
        evPercent: opp.vsMarketAvg ? Math.round(opp.vsMarketAvg * 10) / 10 : null,
        marketAvg: opp.avgOdds,
        marketAvgFormatted: opp.avgOddsFormatted,
        vsMarketAvg: opp.vsMarketAvg ? Math.round(opp.vsMarketAvg * 10) / 10 : null,
      }));

      marketsWithPlays.push({
        marketKey,
        displayName: config.display,
        sport,
        icon: SPORT_ICONS[sport] || "🎯",
        plays: formattedPlays,
        edgeFinderUrl: `/edge-finder?markets=${marketKey}&sports=${sport}`,
      });
    }

    // Sort markets by best edge
    marketsWithPlays.sort((a, b) => {
      const aMaxEdge = Math.max(...a.plays.map(p => p.vsMarketAvg || 0), 0);
      const bMaxEdge = Math.max(...b.plays.map(p => p.vsMarketAvg || 0), 0);
      return bMaxEdge - aMaxEdge;
    });

    const result: PopularMarketsResponse = {
      markets: marketsWithPlays.slice(0, 6), // Max 6 markets for dashboard
      timestamp: timestamp ? Number(timestamp) : Date.now(),
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch popular markets", markets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}
