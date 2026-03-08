import { useQuery } from "@tanstack/react-query";
import type { Opportunity } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseEdgeOpportunitiesOptions = {
  sports?: string[];
  preset?: string;
  markets?: string[];
  marketLines?: Record<string, number[]>;
  marketType?: "player" | "game" | "all";
  minEdge?: number;
  minOdds?: number;
  maxOdds?: number;
  limit?: number;
  autoRefreshEnabled?: boolean;
  autoRefreshMs?: number;
};

type UseEdgeOpportunitiesResult = {
  opportunities: Opportunity[];
  count: number;
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
};

export function useEdgeOpportunities(options?: UseEdgeOpportunitiesOptions) {
  const { session, user } = useAuth();
  const sports = options?.sports ?? ["nba", "nfl"];
  const preset = options?.preset ?? "average";
  const markets = options?.markets ?? [];
  const marketLines = options?.marketLines ?? {};
  const marketType = options?.marketType ?? "all";
  const minEdge = options?.minEdge ?? 0;
  const minOdds = options?.minOdds ?? -500;
  const maxOdds = options?.maxOdds ?? 500;
  const limit = options?.limit ?? 100;
  const autoRefreshEnabled = options?.autoRefreshEnabled ?? false;
  const autoRefreshMs = options?.autoRefreshMs ?? 15_000;

  return useQuery<UseEdgeOpportunitiesResult>({
    queryKey: [
      "edge-opportunities",
      user?.id,
      sports.join(","),
      preset,
      markets.join(","),
      JSON.stringify(marketLines),
      marketType,
      minEdge,
      minOdds,
      maxOdds,
      limit,
    ],
    queryFn: async () => {
      const response = await api.getOpportunities({
        accessToken: session?.access_token,
        sports,
        markets,
        preset,
        marketLines,
        marketType,
        minEdge,
        minOdds,
        maxOdds,
        minBooksPerSide: 2,
        requireTwoWay: false,
        limit,
        sort: "edge",
      });

      return {
        opportunities: response.opportunities,
        count: response.count,
        totalScanned: response.totalScanned,
        totalAfterFilters: response.totalAfterFilters,
        timingMs: response.timingMs,
      };
    },
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    refetchInterval: autoRefreshEnabled ? autoRefreshMs : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
