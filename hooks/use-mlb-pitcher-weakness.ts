"use client";

import { useQuery } from "@tanstack/react-query";
import type { PitcherWeaknessResponse } from "@/app/api/mlb/pitcher-weakness/types";

export type { PitcherWeaknessResponse } from "@/app/api/mlb/pitcher-weakness/types";
export type {
  PitcherData,
  PitcherHeadline,
  BattingOrderSplit,
  InningSplit,
  PitcherHandSplit,
  LineupBatter,
  BatterOdds,
  GameInfo,
} from "@/app/api/mlb/pitcher-weakness/types";

interface UsePitcherWeaknessParams {
  gameId: number | null;
  season?: number;
}

async function fetchPitcherWeakness(
  gameId: number,
  season?: number
): Promise<PitcherWeaknessResponse> {
  const params = new URLSearchParams({
    gameId: String(gameId),
  });
  if (season) params.set("season", String(season));
  const res = await fetch(`/api/mlb/pitcher-weakness?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch pitcher weakness");
  }
  return res.json();
}

export function useMlbPitcherWeakness({ gameId, season }: UsePitcherWeaknessParams) {
  const query = useQuery<PitcherWeaknessResponse>({
    queryKey: ["mlb-pitcher-weakness", gameId, season],
    queryFn: () => fetchPitcherWeakness(gameId!, season),
    enabled: gameId != null,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    game: query.data?.game ?? null,
    awayPitcher: query.data?.away_pitcher ?? null,
    homePitcher: query.data?.home_pitcher ?? null,
    awayLineup: query.data?.away_lineup ?? [],
    homeLineup: query.data?.home_lineup ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error as Error | null,
  };
}
