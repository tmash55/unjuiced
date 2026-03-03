import { useQuery } from "@tanstack/react-query";
import type { PlayerGamesWithInjuriesResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePlayerGamesWithInjuriesOptions = {
  playerId: number;
  season?: string;
  enabled?: boolean;
};

export function usePlayerGamesWithInjuries(options: UsePlayerGamesWithInjuriesOptions) {
  const { session, user } = useAuth();
  const enabled = options.enabled ?? true;

  return useQuery<PlayerGamesWithInjuriesResponse>({
    queryKey: ["player-games-with-injuries", user?.id, options.playerId, options.season ?? ""],
    queryFn: async () => {
      return api.getPlayerGamesWithInjuries({
        accessToken: session?.access_token,
        playerId: options.playerId,
        season: options.season,
      });
    },
    enabled: enabled && Number.isFinite(options.playerId) && options.playerId > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
