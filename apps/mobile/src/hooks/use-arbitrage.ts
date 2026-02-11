import { useQuery } from "@tanstack/react-query";
import type { ArbMode, GetArbsResponse } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseArbitrageOptions = {
  mode?: ArbMode;
  limit?: number;
  cursor?: number;
  autoRefreshEnabled?: boolean;
  autoRefreshMs?: number;
};

export function useArbitrage(options?: UseArbitrageOptions) {
  const { session, user } = useAuth();
  const mode = options?.mode ?? "all";
  const limit = options?.limit ?? 100;
  const cursor = options?.cursor ?? 0;
  const autoRefreshEnabled = options?.autoRefreshEnabled ?? false;
  const autoRefreshMs = options?.autoRefreshMs ?? 10_000;

  return useQuery<GetArbsResponse>({
    queryKey: ["arbs", user?.id, mode, limit, cursor],
    queryFn: async () => {
      const response = await api.getArbs({
        accessToken: session?.access_token,
        mode,
        limit,
        cursor
      });

      if (!response) {
        throw new Error("Arbitrage response was empty");
      }

      return response;
    },
    staleTime: 5_000,
    gcTime: 10 * 60_000,
    refetchInterval: autoRefreshEnabled ? autoRefreshMs : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
