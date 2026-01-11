"use client";

import { useQuery } from "@tanstack/react-query";

interface AggregatedMarket {
  key: string;
  display: string;
  totalEvents: number;
  sports: string[];
}

interface MultiSportMarketsResponse {
  sports: string[];
  markets: AggregatedMarket[];
  count: number;
}

/**
 * Fetch available markets for multiple sports in a single API call
 * Much faster than fetching each sport individually
 */
async function fetchMarketsForSports(sports: string[]): Promise<AggregatedMarket[]> {
  const res = await fetch(`/api/v2/props/markets?sports=${sports.join(",")}`, {
    cache: "no-store",
  });
  
  if (!res.ok) {
    console.warn(`[useAvailableMarkets] Failed to fetch markets:`, res.status);
    return [];
  }
  
  const data: MultiSportMarketsResponse = await res.json();
  return data.markets || [];
}

/**
 * Hook to fetch available markets across multiple sports
 * 
 * Returns unique market keys sorted by total event coverage across all sports.
 * This allows the Edge Finder to show a dynamic list of markets based on
 * what's actually available in the data feed.
 * 
 * OPTIMIZED: Uses a single API call to fetch all sports at once
 */
export function useAvailableMarkets(sports: string[]) {
  return useQuery({
    queryKey: ["available-markets", sports.sort().join(",")],
    queryFn: async () => {
      if (sports.length === 0) {
        return { markets: [], marketsByKey: new Map<string, AggregatedMarket>(), aggregatedMarkets: [] };
      }

      // Single API call for all sports (much faster!)
      const aggregatedMarkets = await fetchMarketsForSports(sports);

      // Build lookup map
      const marketMap = new Map<string, AggregatedMarket>();
      for (const market of aggregatedMarkets) {
        marketMap.set(market.key, market);
      }

      // Return just the keys for the filters component (backwards compatible)
      const marketKeys = aggregatedMarkets.map((m) => m.key);

      return {
        markets: marketKeys,
        marketsByKey: marketMap,
        aggregatedMarkets,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - markets don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: sports.length > 0,
  });
}

/**
 * Default fallback markets when API is unavailable
 * This ensures the UI always has some markets to show
 * Keys are standardized to match Redis data feed format
 */
export const FALLBACK_MARKETS = [
  // -------------------------------------------------------------------------
  // Basketball (NBA, NCAAB, WNBA) - Core Stats
  // -------------------------------------------------------------------------
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes_made",
  "player_fgm",
  "player_steals",
  "player_blocks",
  "player_turnovers",
  
  // Basketball - Combo Markets (standardized Redis keys)
  "player_pra",         // Points + Rebounds + Assists
  "player_pr",          // Points + Rebounds
  "player_pa",          // Points + Assists
  "player_ra",          // Rebounds + Assists
  "player_bs",          // Blocks + Steals
  "player_double_double",
  "player_triple_double",
  
  // Basketball - First Basket / Scoring (single-line)
  "first_field_goal",   // 1st Basket (Game)
  "team_first_basket",  // 1st Basket (Team)
  "top_points_scorer",
  
  // Basketball - Quarter Props
  "1st_quarter_player_points",
  "1st_quarter_player_rebounds",
  "1st_quarter_player_assists",
  "1st_3_minutes_player_points",
  
  // Basketball - Game Markets
  "game_moneyline",
  "game_spread",
  "total_points",
  "team_total",
  "overtime",
  
  // -------------------------------------------------------------------------
  // Football (NFL, NCAAF)
  // -------------------------------------------------------------------------
  "passing_yards",
  "passing_tds",
  "rushing_yards",
  "rushing_tds",
  "receiving_yards",
  "receptions",
  "player_touchdowns",  // Anytime TD
  "first_td",           // 1st TD Scorer
  "last_td",            // Last TD Scorer
  "pass_rush_yards",    // Pass + Rush combo
  "rush_rec_yards",     // Rush + Rec combo
  
  // -------------------------------------------------------------------------
  // Hockey (NHL)
  // -------------------------------------------------------------------------
  "player_goals",
  "player_assists",
  "player_points",
  "player_shots_on_goal",
  "player_total_saves",
  "player_blocked_shots",
  "player_first_goal",
  "player_last_goal",
  
  // -------------------------------------------------------------------------
  // Baseball (MLB)
  // -------------------------------------------------------------------------
  "batter_hits",
  "batter_total_bases",
  "batter_rbis",
  "batter_home_runs",
  "pitcher_strikeouts",
  
  // -------------------------------------------------------------------------
  // Soccer (EPL)
  // -------------------------------------------------------------------------
  "player_goals",
  "anytime_goalscorer",
  "first_goalscorer",
  "player_shots_on_target",
];
