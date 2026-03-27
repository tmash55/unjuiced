"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExitVeloResponse } from "@/app/api/mlb/exit-velocity-leaders/route";

interface UseMlbExitVelocityOptions {
  date?: string;
  sample?: number;
  limit?: number;
  pitcherHand?: string;
  pitchType?: string;
  matchupSplit?: boolean;
  season?: number;
  enabled?: boolean;
}

async function fetchExitVeloLeaders(
  date?: string,
  sample?: number,
  limit?: number,
  pitcherHand?: string,
  pitchType?: string,
  matchupSplit?: boolean,
  season?: number
): Promise<ExitVeloResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (sample) params.set("sample", String(sample));
  if (limit) params.set("limit", String(limit));
  if (pitcherHand) params.set("pitcherHand", pitcherHand);
  if (pitchType) params.set("pitchType", pitchType);
  if (matchupSplit) params.set("matchupSplit", "true");
  if (season) params.set("season", String(season));

  const res = await fetch(`/api/mlb/exit-velocity-leaders?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch exit velocity leaders");
  }
  return res.json();
}

export function useMlbExitVelocity({
  date,
  sample = 15,
  limit = 30,
  pitcherHand,
  pitchType,
  matchupSplit,
  season,
  enabled = true,
}: UseMlbExitVelocityOptions = {}) {
  const query = useQuery({
    queryKey: ["mlb-exit-velocity-leaders", date, sample, limit, pitcherHand, pitchType, matchupSplit, season],
    queryFn: () => fetchExitVeloLeaders(date, sample, limit, pitcherHand, pitchType, matchupSplit, season),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    leaders: query.data?.leaders ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export type { ExitVeloResponse };
