import { useQuery } from "@tanstack/react-query";
import type { HitRateMatrixResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseHitRateMatrixOptions = {
  market?: string;
  gameDate?: string;
  timeWindow?: string;
  positions?: string[];
};

export function useHitRateMatrix(options?: UseHitRateMatrixOptions) {
  const { session, user } = useAuth();

  return useQuery<HitRateMatrixResponse>({
    queryKey: [
      "hit-rate-matrix",
      user?.id,
      options?.market ?? "player_points",
      options?.gameDate ?? "",
      options?.timeWindow ?? "last_10",
      options?.positions ?? []
    ],
    queryFn: async () => {
      return api.getHitRateMatrix({
        accessToken: session?.access_token,
        market: options?.market,
        gameDate: options?.gameDate,
        timeWindow: options?.timeWindow,
        positions: options?.positions
      });
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1
  });
}
