import { useQuery } from "@tanstack/react-query";
import type { HitRateSortField, HitRatesV2Response } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseHitRatesOptions = {
  date?: string;
  market?: string;
  minHitRate?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sort?: HitRateSortField;
  sortDir?: "asc" | "desc";
  hasOdds?: boolean;
  autoRefreshEnabled?: boolean;
  autoRefreshMs?: number;
};

export function useHitRates(options?: UseHitRatesOptions) {
  const { session, user } = useAuth();
  const date = options?.date;
  const market = options?.market ?? "player_points";
  const minHitRate = options?.minHitRate;
  const limit = options?.limit ?? 80;
  const offset = options?.offset ?? 0;
  const search = options?.search ?? "";
  const sort = options?.sort ?? "l10Pct";
  const sortDir = options?.sortDir ?? "desc";
  const hasOdds = options?.hasOdds ?? true;
  const autoRefreshEnabled = options?.autoRefreshEnabled ?? false;
  const autoRefreshMs = options?.autoRefreshMs ?? 30_000;

  return useQuery<HitRatesV2Response>({
    queryKey: [
      "hit-rates-v2",
      user?.id,
      date ?? "",
      market,
      minHitRate ?? "",
      limit,
      offset,
      search,
      sort,
      sortDir,
      hasOdds
    ],
    queryFn: async () => {
      return api.getNbaHitRatesV2({
        accessToken: session?.access_token,
        date,
        market,
        minHitRate,
        limit,
        offset,
        search: search.trim() || undefined,
        sort,
        sortDir,
        hasOdds
      });
    },
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchInterval: autoRefreshEnabled ? autoRefreshMs : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
