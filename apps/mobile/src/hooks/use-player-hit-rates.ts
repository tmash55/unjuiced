import { useQuery } from "@tanstack/react-query";
import type { HitRatesV2Response } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePlayerHitRatesOptions = {
  playerId: number;
  enabled?: boolean;
  limit?: number;
};

export function usePlayerHitRates(options: UsePlayerHitRatesOptions) {
  const { session, user } = useAuth();
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? 100;

  return useQuery<HitRatesV2Response>({
    queryKey: ["hit-rates-v2-player", user?.id, options.playerId, limit],
    queryFn: async () => {
      return api.getNbaHitRatesV2({
        accessToken: session?.access_token,
        playerId: options.playerId,
        limit,
        hasOdds: true
      });
    },
    enabled: enabled && Number.isFinite(options.playerId) && options.playerId > 0,
    staleTime: 20_000,
    gcTime: 10 * 60_000,
    retry: 1
  });
}
