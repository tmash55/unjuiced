import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HitRateOddsSelection, HitRateOddsResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseHitRateOddsOptions = {
  selections: HitRateOddsSelection[];
  enabled?: boolean;
};

function dedupeSelections(selections: HitRateOddsSelection[]): HitRateOddsSelection[] {
  const map = new Map<string, HitRateOddsSelection>();
  for (const item of selections) {
    const key = `${item.stableKey}|${item.line ?? ""}`;
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

export function useHitRateOdds({ selections, enabled = true }: UseHitRateOddsOptions) {
  const { session, user } = useAuth();

  const normalizedSelections = useMemo(() => {
    const valid = selections.filter((item) => typeof item.stableKey === "string" && item.stableKey.trim().length > 0);
    return dedupeSelections(valid);
  }, [selections]);

  const selectionKey = useMemo(
    () =>
      normalizedSelections
        .map((item) => `${item.stableKey}:${item.line ?? ""}`)
        .sort()
        .join(","),
    [normalizedSelections]
  );

  const query = useQuery<HitRateOddsResponse>({
    queryKey: ["hit-rate-odds-mobile", user?.id, selectionKey],
    enabled: enabled && normalizedSelections.length > 0,
    queryFn: async () => {
      return api.getNbaHitRateOdds({
        accessToken: session?.access_token,
        selections: normalizedSelections
      });
    },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1
  });

  function getOdds(stableKey: string | null | undefined) {
    if (!stableKey) return null;
    return query.data?.odds?.[stableKey] ?? null;
  }

  return {
    data: query.data ?? null,
    getOdds,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch
  };
}
