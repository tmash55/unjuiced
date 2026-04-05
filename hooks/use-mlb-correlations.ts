"use client";

import { useQuery } from "@tanstack/react-query";
import type { CorrelationResponse } from "@/app/api/mlb/correlations/route";

async function fetchCorrelations(params: {
  gameId?: number;
  playerId?: number;
}): Promise<CorrelationResponse> {
  const qs = new URLSearchParams();
  if (params.gameId) qs.set("game_id", String(params.gameId));
  if (params.playerId) qs.set("player_id", String(params.playerId));
  const res = await fetch(`/api/mlb/correlations?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch correlations");
  }
  return res.json();
}

export function useMlbCorrelations(params: {
  gameId?: number | null;
  playerId?: number | null;
}) {
  const hasParam = !!params.gameId || !!params.playerId;
  const query = useQuery({
    queryKey: ["mlb-correlations", params.gameId ?? null, params.playerId ?? null],
    queryFn: () =>
      fetchCorrelations({
        gameId: params.gameId ?? undefined,
        playerId: params.playerId ?? undefined,
      }),
    enabled: hasParam,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    correlations: query.data?.correlations ?? [],
    mode: query.data?.mode ?? "game",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
