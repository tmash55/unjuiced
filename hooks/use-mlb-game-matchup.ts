"use client";

import { useQuery } from "@tanstack/react-query";
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
  statSeason?: number;
  pitcherId?: number | null; // Override opposing pitcher (e.g. reliever)
}

async function fetchGameMatchup(
  gameId: number,
  battingSide: string,
  sample: string,
  statSeason?: number,
  pitcherId?: number | null
): Promise<GameMatchupResponse> {
  const params = new URLSearchParams({
    gameId: String(gameId),
    battingSide,
    sample,
  });
  if (statSeason) params.set("statSeason", String(statSeason));
  if (pitcherId) params.set("pitcherId", String(pitcherId));
  const res = await fetch(`/api/mlb/game-matchup?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch game matchup");
  }
  return res.json();
}

export function useMlbGameMatchup({ gameId, battingSide, sample = "season", statSeason, pitcherId }: UseGameMatchupParams) {
  const query = useQuery<GameMatchupResponse>({
    queryKey: ["mlb-game-matchup", gameId, battingSide, sample, statSeason, pitcherId ?? null],
    queryFn: () => fetchGameMatchup(gameId!, battingSide, sample, statSeason, pitcherId),
    enabled: gameId != null,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
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
    refetch: query.refetch,
    error: query.error as Error | null,
  };
}
