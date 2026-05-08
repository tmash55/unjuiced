"use client";

import { useQueries } from "@tanstack/react-query";
import type { BatterOddsEntry } from "@/hooks/use-mlb-batter-odds";

// Prop scoring market → Redis/batter-odds market key
const MARKET_TO_ODDS: Record<string, string> = {
  hr: "player_home_runs",
  hits: "player_hits",
  tb: "player_total_bases",
  rbi: "player_rbis",
  sb: "player_stolen_bases",
  pitcher_k: "player_strikeouts",
  pitcher_h: "player_hits_allowed",
  pitcher_er: "player_earned_runs",
  pitcher_outs: "player_outs",
  pitcher_outs_recorded: "player_outs",
  h_r_rbi: "player_hits__runs__rbis",
};

interface BatterOddsResponse {
  odds: Record<string, BatterOddsEntry>;
  market: string;
  line: number | null;
  side: string;
}

async function fetchGameOdds(gameId: number, market: string): Promise<BatterOddsResponse> {
  const params = new URLSearchParams({ gameId: String(gameId), market, side: "over" });
  const res = await fetch(`/api/mlb/batter-odds?${params}`);
  if (!res.ok) throw new Error("Failed to fetch odds");
  return res.json();
}

/**
 * Fetches live odds for all games in a prop scores result set.
 * Uses the same batter-odds endpoint as slate insights.
 * Returns a map: "gameId:normalized_player_name" → BatterOddsEntry (with all_books containing all lines).
 */
export function usePropLiveOdds(gameIds: number[], market: string) {
  const oddsMarket = MARKET_TO_ODDS[market];

  const queries = useQueries({
    queries: gameIds.map((gid) => ({
      queryKey: ["prop-live-odds", gid, oddsMarket],
      queryFn: () => fetchGameOdds(gid, oddsMarket!),
      enabled: !!oddsMarket && gid > 0,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  // Keyed by "gameId:playerNorm" — prevents same-name players on different teams from colliding
  const allOdds: Record<string, BatterOddsEntry> = {};
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const gid = gameIds[i];
    if (q.data?.odds) {
      for (const [name, entry] of Object.entries(q.data.odds)) {
        allOdds[`${gid}:${name}`] = entry;
      }
    }
  }

  return {
    odds: allOdds,
    isLoading: queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
  };
}
