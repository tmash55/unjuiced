import { useQuery } from "@tanstack/react-query";
import type { DvpRankingsResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseDvpRankingsOptions = {
  position: string | null;
  season?: string;
  enabled?: boolean;
};

export function useDvpRankings({ position, season, enabled = true }: UseDvpRankingsOptions) {
  const { session, user } = useAuth();

  return useQuery<DvpRankingsResponse>({
    queryKey: ["dvp-rankings", user?.id, position, season ?? ""],
    queryFn: async () => {
      return api.getDvpRankings({
        accessToken: session?.access_token,
        position: position!,
        season
      });
    },
    enabled: enabled && !!position,
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
