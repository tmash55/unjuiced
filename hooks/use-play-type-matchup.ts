import { useQuery } from "@tanstack/react-query";
import type { PlayTypeMatchupResponse } from "@/app/api/nba/play-type-matchup/route";

interface UsePlayTypeMatchupOptions {
  playerId: number | null | undefined;
  opponentTeamId: number | null | undefined;
  season?: string;
  enabled?: boolean;
}

async function fetchPlayTypeMatchup(
  playerId: number,
  opponentTeamId: number,
  season: string
): Promise<PlayTypeMatchupResponse> {
  const params = new URLSearchParams({
    playerId: String(playerId),
    opponentTeamId: String(opponentTeamId),
    season,
  });

  const res = await fetch(`/api/nba/play-type-matchup?${params.toString()}`);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch play type matchup");
  }

  return res.json();
}

export function usePlayTypeMatchup({
  playerId,
  opponentTeamId,
  season = "2025-26",
  enabled = true,
}: UsePlayTypeMatchupOptions) {
  return useQuery({
    queryKey: ["play-type-matchup", playerId, opponentTeamId, season],
    queryFn: () => fetchPlayTypeMatchup(playerId!, opponentTeamId!, season),
    enabled: enabled && !!playerId && !!opponentTeamId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (garbage collection time)
  });
}

// Re-export types for convenience
export type { PlayTypeMatchupResponse };
export type { PlayTypeData } from "@/app/api/nba/play-type-matchup/route";

