import { useQuery } from "@tanstack/react-query";
import type { PlayerCorrelationsData } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePlayerCorrelationsOptions = {
  playerId: number | null;
  market: string | null;
  line: number | null;
  gameId?: number | null;
  lastNGames?: number | null;
  season?: string;
  enabled?: boolean;
};

export function usePlayerCorrelations({
  playerId,
  market,
  line,
  gameId,
  lastNGames,
  season,
  enabled = true
}: UsePlayerCorrelationsOptions) {
  const { session, user } = useAuth();

  const isValid = playerId != null && market != null && line != null && line > 0;

  const query = useQuery<PlayerCorrelationsData>({
    queryKey: ["player-correlations", user?.id, playerId, market, line, gameId, lastNGames, season],
    queryFn: async () => {
      return api.getPlayerCorrelations({
        accessToken: session?.access_token,
        playerId: playerId!,
        market: market!,
        line: line!,
        gameId: gameId ?? undefined,
        lastNGames: lastNGames ?? undefined,
        season
      });
    },
    enabled: enabled && isValid,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1
  });

  return {
    data: query.data ?? null,
    anchorPlayer: query.data?.anchorPlayer ?? null,
    anchorPerformance: query.data?.anchorPerformance ?? null,
    teammateCorrelations: query.data?.teammateCorrelations ?? [],
    headline: query.data?.headline ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch
  };
}
