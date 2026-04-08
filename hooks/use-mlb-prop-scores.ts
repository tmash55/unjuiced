"use client";

import { useQuery } from "@tanstack/react-query";
import type { PropScoreResponse } from "@/app/api/mlb/prop-scores/types";

async function fetchPropScores(date?: string, market?: string): Promise<PropScoreResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (market) params.set("market", market);
  const res = await fetch(`/api/mlb/prop-scores?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch prop scores");
  }
  return res.json();
}

export function useMlbPropScores(date?: string, market?: string, enabled = true) {
  const query = useQuery({
    queryKey: ["mlb-prop-scores", date ?? "today", market ?? "all"],
    queryFn: () => fetchPropScores(date, market),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Handle both old format (players) and new format (scores + lineups)
  const data = query.data;
  const players = data?.scores ?? data?.players ?? [];

  return {
    players,
    lineups: data?.lineups ?? {},
    meta: data?.meta ?? null,
    availableDates: data?.meta?.availableDates ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
