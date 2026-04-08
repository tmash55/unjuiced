"use client";

import { useQuery } from "@tanstack/react-query";
import type { SuggestedParlaysResponse } from "@/app/api/mlb/suggested-parlays/route";

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function fetchParlays(date: string, gameId?: number): Promise<SuggestedParlaysResponse> {
  const qs = new URLSearchParams({ date });
  if (gameId) qs.set("game_id", String(gameId));
  const res = await fetch(`/api/mlb/suggested-parlays?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch suggested parlays");
  }
  return res.json();
}

export function useMlbSuggestedParlays(gameId?: number | null) {
  const date = getETDate();
  const query = useQuery({
    queryKey: ["mlb-suggested-parlays", date, gameId ?? null],
    queryFn: () => fetchParlays(date, gameId ?? undefined),
    enabled: !!gameId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    parlays: query.data?.parlays ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
