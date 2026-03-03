import { useQuery } from "@tanstack/react-query";
import type { TeamDefenseRanksResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseTeamDefenseRanksOptions = {
  opponentTeamId: number | null | undefined;
  season?: string;
  enabled?: boolean;
};

export function useTeamDefenseRanks({
  opponentTeamId,
  season,
  enabled = true
}: UseTeamDefenseRanksOptions) {
  const { session, user } = useAuth();

  const query = useQuery<TeamDefenseRanksResponse>({
    queryKey: ["team-defense-ranks", user?.id, opponentTeamId, season],
    queryFn: async () => {
      return api.getTeamDefenseRanks({
        accessToken: session?.access_token,
        opponentTeamId: opponentTeamId!,
        season
      });
    },
    enabled: enabled && !!opponentTeamId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1
  });

  return {
    positions: query.data?.positions ?? {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch
  };
}
