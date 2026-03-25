"use client";

import { useQuery } from "@tanstack/react-query";
import type { MlbPlayerSearchResponse, MlbPlayerSearchResult } from "@/app/api/mlb/player-search/route";

export type { MlbPlayerSearchResult };

interface UseMlbPlayerSearchParams {
  query: string;
  type?: "batter" | "pitcher" | "all";
  enabled?: boolean;
}

async function fetchPlayerSearch(q: string, type: string): Promise<MlbPlayerSearchResponse> {
  const params = new URLSearchParams({ q, type });
  const res = await fetch(`/api/mlb/player-search?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to search players");
  }
  return res.json();
}

export function useMlbPlayerSearch({ query, type = "all", enabled = true }: UseMlbPlayerSearchParams) {
  const trimmed = query.trim();
  const q = useQuery<MlbPlayerSearchResponse>({
    queryKey: ["mlb-player-search", trimmed, type],
    queryFn: () => fetchPlayerSearch(trimmed, type),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    players: q.data?.players ?? [],
    isLoading: q.isLoading && trimmed.length >= 2,
    isFetching: q.isFetching,
    error: q.error as Error | null,
  };
}
