"use client";

import { useQuery } from "@tanstack/react-query";

export interface TeamDefenseRanksResponse {
  opponentTeamId: number;
  positions: {
    [position: string]: {
      [market: string]: {
        rank: number | null;
        avgAllowed: number | null;
      };
    };
  };
}

export interface UseTeamDefenseRanksOptions {
  opponentTeamId: number | null;
  enabled?: boolean;
}

async function fetchTeamDefenseRanks(
  opponentTeamId: number
): Promise<TeamDefenseRanksResponse> {
  const params = new URLSearchParams({
    opponentTeamId: opponentTeamId.toString(),
  });

  const res = await fetch(`/api/nba/team-defense-ranks?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load team defense ranks");
  }

  return res.json();
}

export function useTeamDefenseRanks(options: UseTeamDefenseRanksOptions) {
  const { opponentTeamId, enabled = true } = options;

  const query = useQuery<TeamDefenseRanksResponse>({
    queryKey: ["team-defense-ranks", opponentTeamId],
    queryFn: () => fetchTeamDefenseRanks(opponentTeamId!),
    enabled: enabled && !!opponentTeamId,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
    placeholderData: (previousData) => previousData,
  });

  return {
    positions: query.data?.positions ?? {},
    opponentTeamId: query.data?.opponentTeamId ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

