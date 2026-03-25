"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  HotZoneWindow,
  MlbHotZoneMatchupResponse,
} from "@/app/api/mlb/hot-zone-matchup/route";

interface UseMlbHotZoneMatchupOptions {
  batterId: number | null | undefined;
  pitcherId?: number | null | undefined;
  batterWindow?: HotZoneWindow;
  pitcherWindow?: HotZoneWindow;
  season?: number;
  enabled?: boolean;
}

async function fetchMlbHotZoneMatchup({
  batterId,
  pitcherId,
  batterWindow = "season",
  pitcherWindow = "season",
  season,
}: {
  batterId: number;
  pitcherId?: number | null | undefined;
  batterWindow?: HotZoneWindow;
  pitcherWindow?: HotZoneWindow;
  season?: number;
}): Promise<MlbHotZoneMatchupResponse> {
  const params = new URLSearchParams({
    batterId: String(batterId),
    batterWindow,
    pitcherWindow,
  });

  if (pitcherId != null) params.set("pitcherId", String(pitcherId));
  if (season != null) params.set("season", String(season));

  const res = await fetch(`/api/mlb/hot-zone-matchup?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || body?.message || "Failed to fetch MLB hot zone matchup");
  }

  return res.json();
}

export function useMlbHotZoneMatchup({
  batterId,
  pitcherId,
  batterWindow = "season",
  pitcherWindow = "season",
  season,
  enabled = true,
}: UseMlbHotZoneMatchupOptions) {
  return useQuery({
    queryKey: [
      "mlb-hot-zone-matchup",
      batterId,
      pitcherId ?? null,
      batterWindow,
      pitcherWindow,
      season ?? null,
    ],
    queryFn: () =>
      fetchMlbHotZoneMatchup({
        batterId: batterId!,
        pitcherId,
        batterWindow,
        pitcherWindow,
        season,
      }),
    enabled: enabled && typeof batterId === "number",
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type { MlbHotZoneMatchupResponse, HotZoneWindow };
