"use client";

import { useQuery } from "@tanstack/react-query";
import type { MlbMatchupContextResponse } from "@/app/api/mlb/matchup-context/route";

interface UseMlbMatchupContextOptions {
  playerId: number | null | undefined;
  gameId: number | null | undefined;
  enabled?: boolean;
}

async function fetchMlbMatchupContext(
  playerId: number,
  gameId: number
): Promise<MlbMatchupContextResponse> {
  const params = new URLSearchParams({
    playerId: String(playerId),
    gameId: String(gameId),
  });

  const res = await fetch(`/api/mlb/matchup-context?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || body?.message || "Failed to fetch MLB matchup context");
  }

  return res.json();
}

export function useMlbMatchupContext({
  playerId,
  gameId,
  enabled = true,
}: UseMlbMatchupContextOptions) {
  return useQuery({
    queryKey: ["mlb-matchup-context", playerId, gameId],
    queryFn: () => fetchMlbMatchupContext(playerId!, gameId!),
    enabled: enabled && typeof playerId === "number" && typeof gameId === "number",
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type { MlbMatchupContextResponse };
