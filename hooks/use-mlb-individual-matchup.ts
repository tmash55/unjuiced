"use client";

import { useQuery } from "@tanstack/react-query";
import type { IndividualMatchupResponse } from "@/app/api/mlb/individual-matchup/route";

export type { IndividualMatchupResponse };

interface UseIndividualMatchupParams {
  batterId: number | null;
  pitcherId: number | null;
  sample?: "season" | "30" | "15" | "7";
}

async function fetchIndividualMatchup(
  batterId: number,
  pitcherId: number,
  sample: string
): Promise<IndividualMatchupResponse> {
  const params = new URLSearchParams({
    batterId: String(batterId),
    pitcherId: String(pitcherId),
    sample,
  });
  const res = await fetch(`/api/mlb/individual-matchup?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch individual matchup");
  }
  return res.json();
}

export function useMlbIndividualMatchup({ batterId, pitcherId, sample = "season" }: UseIndividualMatchupParams) {
  const query = useQuery<IndividualMatchupResponse>({
    queryKey: ["mlb-individual-matchup", batterId, pitcherId, sample],
    queryFn: () => fetchIndividualMatchup(batterId!, pitcherId!, sample),
    enabled: batterId != null && pitcherId != null,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    pitcher: query.data?.pitcher ?? null,
    batter: query.data?.batter ?? null,
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
