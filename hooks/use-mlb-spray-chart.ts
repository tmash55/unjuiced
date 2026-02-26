"use client";

import { useQuery } from "@tanstack/react-query";
import type { MlbSprayChartResponse } from "@/app/api/mlb/spray-chart/route";

interface UseMlbSprayChartOptions {
  playerId: number | null | undefined;
  gameId: number | null | undefined;
  seasons?: number[];
  minExitVelo?: number;
  enabled?: boolean;
}

async function fetchMlbSprayChart(
  playerId: number,
  gameId: number | null | undefined,
  seasons?: number[],
  minExitVelo?: number
): Promise<MlbSprayChartResponse> {
  const params = new URLSearchParams({
    playerId: String(playerId),
  });

  if (gameId != null) params.set("gameId", String(gameId));
  if (seasons && seasons.length > 0) params.set("seasons", seasons.join(","));
  if (minExitVelo != null) params.set("minExitVelo", String(minExitVelo));

  const res = await fetch(`/api/mlb/spray-chart?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || body?.message || "Failed to fetch MLB spray chart");
  }

  return res.json();
}

export function useMlbSprayChart({
  playerId,
  gameId,
  seasons,
  minExitVelo,
  enabled = true,
}: UseMlbSprayChartOptions) {
  return useQuery({
    queryKey: ["mlb-spray-chart", playerId, gameId, seasons, minExitVelo],
    queryFn: () => fetchMlbSprayChart(playerId!, gameId, seasons, minExitVelo),
    enabled: enabled && typeof playerId === "number",
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type { MlbSprayChartResponse };
