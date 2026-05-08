"use client";

import { useQuery } from "@tanstack/react-query";
import type { MlbSprayChartResponse } from "@/app/api/mlb/spray-chart/route";

interface UseMlbSprayChartOptions {
  playerId: number | null | undefined;
  playerType?: "batter" | "pitcher";
  gameId: number | null | undefined;
  eventId?: string | null | undefined;
  seasons?: number[];
  minExitVelo?: number;
  enabled?: boolean;
}

async function fetchMlbSprayChart(
  playerId: number,
  playerType: "batter" | "pitcher",
  gameId: number | null | undefined,
  eventId?: string | null | undefined,
  seasons?: number[],
  minExitVelo?: number
): Promise<MlbSprayChartResponse> {
  const params = new URLSearchParams({
    playerId: String(playerId),
    playerType,
  });

  if (gameId != null) params.set("gameId", String(gameId));
  if (eventId) params.set("eventId", eventId);
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
  playerType = "batter",
  gameId,
  eventId,
  seasons,
  minExitVelo,
  enabled = true,
}: UseMlbSprayChartOptions) {
  return useQuery({
    queryKey: ["mlb-spray-chart", playerId, playerType, gameId, eventId, seasons, minExitVelo],
    queryFn: () => fetchMlbSprayChart(playerId!, playerType, gameId, eventId, seasons, minExitVelo),
    enabled: enabled && typeof playerId === "number",
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type { MlbSprayChartResponse };
