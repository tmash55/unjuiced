import { useQuery } from "@tanstack/react-query";
import type { PositionVsTeamResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePositionVsTeamOptions = {
  position: string | null;
  opponentTeamId: number | null;
  market: string;
  limit?: number;
  minMinutes?: number;
  season?: string;
  enabled?: boolean;
};

export function usePositionVsTeam({
  position,
  opponentTeamId,
  market,
  limit = 20,
  minMinutes = 15,
  season,
  enabled = true
}: UsePositionVsTeamOptions) {
  const { session, user } = useAuth();

  return useQuery<PositionVsTeamResponse>({
    queryKey: ["position-vs-team", user?.id, position, opponentTeamId, market, limit, minMinutes, season],
    queryFn: async () => {
      return api.getPositionVsTeam({
        accessToken: session?.access_token,
        position: position!,
        opponentTeamId: opponentTeamId!,
        market,
        limit,
        minMinutes,
        season
      });
    },
    enabled: enabled && !!position && !!opponentTeamId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1
  });
}
