"use client";

import { useQuery } from "@tanstack/react-query";

interface BatterOddsEntry {
  best_price: number;
  best_book: string;
  best_link: string | null;
  best_mobile_link: string | null;
  line: number;
  side: string;
  ev_pct: number | null;
  fair_american: string | null;
  sharp_book: string | null;
  all_books: { book: string; price: number; link: string | null; mobile_link: string | null; line?: number; sgp?: string | null; odd_id?: string | null }[];
}

interface BatterOddsResponse {
  odds: Record<string, BatterOddsEntry>; // keyed by normalized player name
  market: string;
  line: number | null;
  side: string;
}

async function fetchBatterOdds(
  gameId: number,
  market: string,
  line: number | null,
  side: string
): Promise<BatterOddsResponse> {
  const params = new URLSearchParams({
    gameId: String(gameId),
    market,
    side,
  });
  if (line !== null) params.set("line", String(line));

  const res = await fetch(`/api/mlb/batter-odds?${params}`);
  if (!res.ok) throw new Error("Failed to fetch batter odds");
  return res.json();
}

export function useMlbBatterOdds(
  gameId: number | null,
  market: string = "player_home_runs",
  line: number | null = 0.5,
  side: string = "over"
) {
  const query = useQuery({
    queryKey: ["mlb-batter-odds", gameId, market, line, side],
    queryFn: () => fetchBatterOdds(gameId!, market, line, side),
    enabled: !!gameId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    odds: query.data?.odds ?? {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}

export type { BatterOddsEntry };
