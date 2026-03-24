"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { GameMatchupResponse } from "@/app/api/mlb/game-matchup/route";

export type { GameMatchupResponse } from "@/app/api/mlb/game-matchup/route";
export type {
  PitcherProfile,
  PitchArsenalRow,
  BatterMatchup,
  BatterPitchSplit,
} from "@/app/api/mlb/game-matchup/route";

interface UseGameMatchupParams {
  gameId: number | null;
  battingSide: "home" | "away";
  sample?: "season" | "30" | "15" | "7";
}

async function fetchGameMatchup(
  gameId: number,
  battingSide: string,
  sample: string
): Promise<GameMatchupResponse> {
  const params = new URLSearchParams({
    gameId: String(gameId),
    battingSide,
    sample,
  });
  const res = await fetch(`/api/mlb/game-matchup?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch game matchup");
  }
  return res.json();
}

export function useMlbGameMatchup({ gameId, battingSide, sample = "season" }: UseGameMatchupParams) {
  const query = useQuery<GameMatchupResponse>({
    queryKey: ["mlb-game-matchup", gameId, battingSide, sample],
    queryFn: () => fetchGameMatchup(gameId!, battingSide, sample),
    enabled: gameId != null,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? null,
    game: query.data?.game ?? null,
    pitcher: query.data?.pitcher ?? null,
    batters: query.data?.batters ?? [],
    summary: query.data?.summary ?? null,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
