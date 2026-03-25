"use client";

import { useQuery } from "@tanstack/react-query";
import type { HRScoreResponse } from "@/app/api/mlb/hr-scores/route";

async function fetchHRScores(date?: string): Promise<HRScoreResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const res = await fetch(`/api/mlb/hr-scores?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch HR scores");
  }
  return res.json();
}

export function useMlbHRScores(date?: string) {
  const query = useQuery({
    queryKey: ["mlb-hr-scores", date ?? "today"],
    queryFn: () => fetchHRScores(date),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    players: query.data?.players ?? [],
    meta: query.data?.meta ?? null,
    availableDates: query.data?.meta?.availableDates ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
