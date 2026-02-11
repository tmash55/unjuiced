import { useQuery } from "@tanstack/react-query";
import type { PlayerBoxScoresResponse } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePlayerBoxScoresOptions = {
  playerId: number;
  season?: string;
  limit?: number;
  enabled?: boolean;
};

export function usePlayerBoxScores(options: UsePlayerBoxScoresOptions) {
  const { session, user } = useAuth();
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? 25;

  return useQuery<PlayerBoxScoresResponse>({
    queryKey: ["player-box-scores", user?.id, options.playerId, options.season ?? "", limit],
    queryFn: async () => {
      return api.getNbaPlayerBoxScores({
        accessToken: session?.access_token,
        playerId: options.playerId,
        season: options.season,
        limit
      });
    },
    enabled: enabled && Number.isFinite(options.playerId) && options.playerId > 0,
    staleTime: 5 * 60_000,
    gcTime: 20 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
