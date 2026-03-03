import { useQuery } from "@tanstack/react-query";
import type { ShotZoneMatchupResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseShotZoneMatchupOptions = {
  playerId: number | null | undefined;
  opponentTeamId: number | null | undefined;
  season?: string;
  enabled?: boolean;
};

export function useShotZoneMatchup({
  playerId,
  opponentTeamId,
  season,
  enabled = true
}: UseShotZoneMatchupOptions) {
  const { session, user } = useAuth();

  return useQuery<ShotZoneMatchupResponse>({
    queryKey: ["shot-zone-matchup", user?.id, playerId, opponentTeamId, season],
    queryFn: async () => {
      return api.getShotZoneMatchup({
        accessToken: session?.access_token,
        playerId: playerId!,
        opponentTeamId: opponentTeamId!,
        season
      });
    },
    enabled: enabled && !!playerId && !!opponentTeamId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1
  });
}
