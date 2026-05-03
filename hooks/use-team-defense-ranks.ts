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
  meta?: {
    season?: string;
    totalTeams?: number;
    positionBuckets?: string[];
  };
}

export interface UseTeamDefenseRanksOptions {
  opponentTeamId: number | null;
  sport?: "nba" | "wnba";
  season?: string;
  enabled?: boolean;
}

async function fetchTeamDefenseRanks(
  opponentTeamId: number,
  sport: "nba" | "wnba",
  season?: string
): Promise<TeamDefenseRanksResponse> {
  const params = new URLSearchParams();
  params.set("opponentTeamId", opponentTeamId.toString());
  if (season) params.set("season", season);

  const res = await fetch(`/api/${sport}/team-defense-ranks?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load team defense ranks");
  }

  return res.json();
}

export function useTeamDefenseRanks(options: UseTeamDefenseRanksOptions) {
  const { opponentTeamId, sport = "nba", season, enabled = true } = options;

  const query = useQuery<TeamDefenseRanksResponse>({
    queryKey: ["team-defense-ranks", sport, opponentTeamId, season],
    queryFn: () => fetchTeamDefenseRanks(opponentTeamId!, sport, season),
    enabled: enabled && !!opponentTeamId,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
    placeholderData: (previousData) => previousData,
  });

  return {
    positions: query.data?.positions ?? {},
    opponentTeamId: query.data?.opponentTeamId ?? 0,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
