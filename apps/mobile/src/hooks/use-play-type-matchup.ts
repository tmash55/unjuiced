import { useQuery } from "@tanstack/react-query";
import type { PlayTypeMatchupResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePlayTypeMatchupOptions = {
  playerId: number | null | undefined;
  opponentTeamId: number | null | undefined;
  season?: string;
  enabled?: boolean;
};

export function usePlayTypeMatchup({
  playerId,
  opponentTeamId,
  season,
  enabled = true
}: UsePlayTypeMatchupOptions) {
  const { session, user } = useAuth();

  return useQuery<PlayTypeMatchupResponse>({
    queryKey: ["play-type-matchup", user?.id, playerId, opponentTeamId, season],
    queryFn: async () => {
      return api.getPlayTypeMatchup({
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
