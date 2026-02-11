/**
 * Hook for fetching opportunities using the v2 API
 * 
 * Native hook - no adapters, works directly with Opportunity types.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import {
  type Opportunity,
  type OpportunityFilters,
  type Sport,
  DEFAULT_FILTERS,
  parseOpportunity,
} from "@/lib/types/opportunities";
import { normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { isMarketSelected } from "@/lib/utils";

interface UseOpportunitiesOptions {
  /**
   * Initial filter values (merged with defaults)
   */
  filters?: Partial<OpportunityFilters>;
  /**
   * Whether user has pro access
   */
  isPro: boolean;
  /**
   * Enable/disable the query
   */
  enabled?: boolean;
}

interface UseOpportunitiesResult {
  // Data
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;  // Count after filters but before limit - helps diagnose if limit is hiding results
  timingMs: number;
  
  // State
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  
  // Actions
  refetch: () => Promise<void>;
  setFilters: (updates: Partial<OpportunityFilters>) => void;
  
  // Current filters
  filters: OpportunityFilters;
}

/**
 * Build query params from filters
 */
function buildQueryParams(filters: OpportunityFilters, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();

  // Sports
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }

  // Markets - send to API for server-side filtering (empty = all markets)
  if (filters.selectedMarkets.length > 0) {
    params.set("markets", filters.selectedMarkets.join(","));
  }

  // Sharp reference
  if (filters.blend && filters.blend.length > 0) {
    params.set("blend", filters.blend.map((b) => `${b.book}:${b.weight}`).join(","));
  } else if (filters.preset) {
    params.set("preset", filters.preset);
  }

  // Edge/EV filters
  if (filters.minEdge > 0) params.set("minEdge", String(filters.minEdge));
  if (filters.minEV !== null) params.set("minEV", String(filters.minEV));
  if (filters.requireTwoWay) params.set("requireTwoWay", "true");
  
  // Require full blend (hide records if blend books are missing)
  if (filters.requireFullBlend) params.set("requireFullBlend", "true");
  
  // Market type filter (player props vs game lines)
  if (filters.marketType && filters.marketType !== "all") {
    params.set("marketType", filters.marketType);
  }
  
  // Market line filters (e.g., {"touchdowns": [0.5]} to only show "Anytime" touchdowns)
  if (filters.marketLines && Object.keys(filters.marketLines).length > 0) {
    params.set("marketLines", JSON.stringify(filters.marketLines));
  }
  
  // Min books per side (2 for edge finder, 2 for +EV)
  params.set("minBooksPerSide", String(filters.minBooksPerSide));

  // Odds range
  if (filters.minOdds !== -500) params.set("minOdds", String(filters.minOdds));
  if (filters.maxOdds !== 500) params.set("maxOdds", String(filters.maxOdds));

  // Sorting - API expects "sort" param with "edge" or "ev"
  const sortValue = filters.sortBy === "ev_pct" ? "ev" : "edge";
  params.set("sort", sortValue);

  // Limit based on plan
  params.set("limit", String(filters.limit || (isPro ? 200 : 50)));

  return params;
}

/**
 * Fetch opportunities from v2 API
 */
async function fetchOpportunities(
  filters: OpportunityFilters,
  isPro: boolean
): Promise<{
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
}> {
  const params = buildQueryParams(filters, isPro);
  const url = `/api/v2/opportunities?${params.toString()}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
  }

  const data = await response.json();

  // Parse raw API response to typed Opportunity objects
  const opportunities = (data.opportunities || []).map((raw: Record<string, unknown>) =>
    parseOpportunity(raw)
  );

  return {
    opportunities,
    totalScanned: data.total_scanned || 0,
    totalAfterFilters: data.total_after_filters || 0,
    timingMs: data.timing_ms || 0,
  };
}

/**
 * Client-side filtering (for search, books, markets)
 */
function filterOpportunities(
  opportunities: Opportunity[],
  filters: OpportunityFilters
): Opportunity[] {
  return opportunities.filter((opp) => {
    // Search filter
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matches =
        (opp.player || "").toLowerCase().includes(q) ||
        (opp.homeTeam || "").toLowerCase().includes(q) ||
        (opp.awayTeam || "").toLowerCase().includes(q) ||
        (opp.market || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Book filter (selectedBooks contains EXCLUDED books - inverted logic)
    // Empty = all selected, non-empty = those books are excluded
    // Normalize bestBook ID to match the format in selectedBooks (e.g., "hardrockbet" → "hard-rock")
    if (filters.selectedBooks.length > 0) {
      const normalizedBook = normalizeSportsbookId(opp.bestBook);
      if (filters.selectedBooks.includes(normalizedBook)) return false;
    }

    // Market filter (selectedMarkets contains SELECTED markets - normal logic)
    // Empty = all selected, non-empty = those are the only markets to show
    if (!isMarketSelected(filters.selectedMarkets, opp.sport || "", opp.market || "")) {
      return false;
    }

    return true;
  });
}

/**
 * Main hook for opportunities
 */
export function useOpportunities({
  filters: initialFilters,
  isPro,
  enabled = true,
}: UseOpportunitiesOptions): UseOpportunitiesResult {
  const queryClient = useQueryClient();

  // Merge initial filters with defaults
  const filters: OpportunityFilters = useMemo(
    () => ({
      ...DEFAULT_FILTERS,
      ...initialFilters,
    }),
    [initialFilters]
  );

  // Query key includes server-side filter params
  const queryKey = useMemo(
    () => [
      "opportunities-v2",
      filters.sports.join(","),
      filters.selectedMarkets.join(","), // Server-side market filter
      filters.preset,
      filters.blend ? JSON.stringify(filters.blend) : null,
      filters.minEdge,
      filters.minEV,
      filters.requireTwoWay,
      filters.requireFullBlend,
      filters.marketType,
      filters.minBooksPerSide,
      filters.minOdds,
      filters.maxOdds,
      filters.sortBy, // Used for query key even though API uses simplified "sort"
      isPro,
    ],
    [filters, isPro]
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchOpportunities(filters, isPro),
    staleTime: 60_000, // Fresh for 60 seconds
    gcTime: 5 * 60_000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
    retry: 3,
    enabled,
  });

  // Apply client-side filters
  const opportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    return filterOpportunities(data.opportunities, filters);
  }, [data?.opportunities, filters]);

  // Refetch helper
  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  // Filter update helper
  const setFilters = useCallback(
    (updates: Partial<OpportunityFilters>) => {
      // Invalidate query with new filters
      // The parent component should manage filter state and pass updated filters
      queryClient.invalidateQueries({ queryKey: ["opportunities-v2"] });
    },
    [queryClient]
  );

  return {
    opportunities,
    totalScanned: data?.totalScanned || 0,
    totalAfterFilters: data?.totalAfterFilters || 0,
    timingMs: data?.timingMs || 0,
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
    setFilters,
    filters,
  };
}

/**
 * Hook for +EV opportunities only
 */
export function usePositiveEVOpportunities({
  sports = ["nba"] as Sport[],
  minEV = 0,
  preset = "pinnacle",
  isPro,
}: {
  sports?: Sport[];
  minEV?: number;
  preset?: string;
  isPro: boolean;
}) {
  return useOpportunities({
    filters: {
      sports,
      preset,
      minEV,
      requireTwoWay: true,
      minBooksPerSide: 2,  // Require 2 books per side for proper EV calculation
      sortBy: "ev_pct",
      sortDir: "desc",
    },
    isPro,
  });
}

/**
 * Hook for edge opportunities (line shopping)
 */
export function useEdgeOpportunities({
  sports = ["nba"] as Sport[],
  minEdge = 3,
  preset = "pinnacle",
  isPro,
}: {
  sports?: Sport[];
  minEdge?: number;
  preset?: string;
  isPro: boolean;
}) {
  return useOpportunities({
    filters: {
      sports,
      preset,
      minEdge,
      requireTwoWay: false,
      minBooksPerSide: 2,  // Need 2 books on same side for edge comparison
      sortBy: "edge_pct",
      sortDir: "desc",
    },
    isPro,
  });
}
