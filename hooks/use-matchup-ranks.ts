"use client";

import { useQuery } from "@tanstack/react-query";

export interface MarketMatchupRank {
  market: string;
  rank: number | null;
  avgAllowed: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable" | null;
}

export interface MatchupRanksResponse {
  playerId: number;
  opponentTeamId: number;
  position: string;
  markets: MarketMatchupRank[];
}

export interface UseMatchupRanksOptions {
  playerId: number;
  opponentTeamId: number;
  position: string;
  markets?: string[]; // Optional: specify which markets to fetch
  enabled?: boolean;
}

async function fetchMatchupRanks(
  playerId: number,
  opponentTeamId: number,
  position: string,
  markets?: string[]
): Promise<MatchupRanksResponse> {
  const params = new URLSearchParams({
    playerId: playerId.toString(),
    opponentTeamId: opponentTeamId.toString(),
    position,
  });

  if (markets && markets.length > 0) {
    params.set("markets", markets.join(","));
  }

  const res = await fetch(`/api/nba/matchup-ranks?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load matchup ranks");
  }

  return res.json();
}

export function useMatchupRanks(options: UseMatchupRanksOptions) {
  const { playerId, opponentTeamId, position, markets, enabled = true } = options;

  const isValid = !!playerId && !!opponentTeamId && !!position;

  const query = useQuery<MatchupRanksResponse>({
    queryKey: ["matchup-ranks", playerId, opponentTeamId, position, markets?.join(",")],
    queryFn: () => fetchMatchupRanks(playerId, opponentTeamId, position, markets),
    enabled: enabled && isValid,
    staleTime: 5 * 60_000, // 5 minutes (matchup data doesn't change often)
    gcTime: 10 * 60_000, // 10 minutes
  });

  return {
    markets: query.data?.markets ?? [],
    playerId: query.data?.playerId ?? 0,
    opponentTeamId: query.data?.opponentTeamId ?? 0,
    position: query.data?.position ?? "",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

