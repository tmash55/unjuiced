/**
 * usePositiveEV Hook
 * 
 * React Query hook for fetching true +EV opportunities
 * using proper de-vigging methods.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import type {
  PositiveEVOpportunity,
  PositiveEVResponse,
  SharpPreset,
  DevigMethod,
  EVMode,
} from "@/lib/ev/types";
import {
  DEFAULT_DEVIG_METHODS,
  POSITIVE_EV_DEFAULTS,
  SHARP_PRESETS,
} from "@/lib/ev/constants";

// =============================================================================
// Types
// =============================================================================

export interface PositiveEVFilters {
  /** Sports to fetch (e.g., ["nba", "nfl"]) */
  sports: string[];
  
  /** Markets to filter (null = all) */
  markets?: string[] | null;
  
  /** Sharp reference preset */
  sharpPreset: SharpPreset;
  
  /** De-vig methods to use */
  devigMethods?: DevigMethod[];
  
  /** Minimum EV% threshold */
  minEV: number;
  
  /** Maximum EV% to show (filter outliers) */
  maxEV?: number;
  
  /** Filter to specific sportsbooks */
  books?: string[] | null;
  
  /** Max results */
  limit?: number;
  
  /** Search term for filtering */
  search?: string;
  
  /** Mode filter: pregame, live, or all */
  mode?: EVMode;
  
  /** Minimum books required on BOTH sides (width filter, default: 2) */
  minBooksPerSide?: number;
}

export interface UsePositiveEVOptions {
  filters: Partial<PositiveEVFilters>;
  isPro: boolean;
  enabled?: boolean;
}

export interface UsePositiveEVResult {
  /** Filtered opportunities */
  opportunities: PositiveEVOpportunity[];
  
  /** Total opportunities found before limit */
  totalFound: number;
  
  /** Total returned after limit */
  totalReturned: number;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Fetching state (includes background refetches) */
  isFetching: boolean;
  
  /** Error state */
  error: Error | null;
  
  /** Refetch function */
  refetch: () => Promise<void>;
  
  /** Current filters */
  filters: PositiveEVFilters;
  
  /** Update filters */
  setFilters: (updates: Partial<PositiveEVFilters>) => void;
  
  /** Sharp preset config */
  sharpPresetConfig: typeof SHARP_PRESETS[SharpPreset];
  
  /** Data updated timestamp */
  dataUpdatedAt: number | undefined;
}

// =============================================================================
// Default Filters
// =============================================================================

const DEFAULT_FILTERS: PositiveEVFilters = {
  sports: ["nba"],
  markets: null,
  sharpPreset: POSITIVE_EV_DEFAULTS.sharpPreset,
  devigMethods: DEFAULT_DEVIG_METHODS,
  minEV: POSITIVE_EV_DEFAULTS.minEV,
  maxEV: POSITIVE_EV_DEFAULTS.maxEV,
  books: null,
  limit: POSITIVE_EV_DEFAULTS.limit,
  search: "",
  mode: "pregame",
  minBooksPerSide: 2,
};

// =============================================================================
// API Fetching
// =============================================================================

/**
 * Build query params for the +EV API
 */
function buildQueryParams(filters: PositiveEVFilters, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();
  
  // Sports
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }
  
  // Markets
  if (filters.markets && filters.markets.length > 0) {
    params.set("markets", filters.markets.join(","));
  }
  
  // Sharp preset
  params.set("sharpPreset", filters.sharpPreset);
  
  // De-vig methods
  if (filters.devigMethods && filters.devigMethods.length > 0) {
    params.set("devigMethods", filters.devigMethods.join(","));
  }
  
  // EV thresholds
  if (filters.minEV > 0) {
    params.set("minEV", String(filters.minEV));
  }
  if (filters.maxEV) {
    params.set("maxEV", String(filters.maxEV));
  }
  
  // Books filter
  if (filters.books && filters.books.length > 0) {
    params.set("books", filters.books.join(","));
  }
  
  // Mode filter (pregame, live, or all)
  if (filters.mode) {
    params.set("mode", filters.mode);
  }
  
  // Minimum books per side (width filter)
  if (filters.minBooksPerSide !== undefined) {
    params.set("minBooksPerSide", String(filters.minBooksPerSide));
  }
  
  // Limit (pro users get more)
  const limit = filters.limit || (isPro ? 200 : 50);
  params.set("limit", String(limit));
  
  return params;
}

/**
 * Fetch +EV opportunities from the API
 */
async function fetchPositiveEV(
  filters: PositiveEVFilters,
  isPro: boolean
): Promise<PositiveEVResponse> {
  const params = buildQueryParams(filters, isPro);
  const url = `/api/v2/positive-ev?${params.toString()}`;
  
  const response = await fetch(url, { cache: "no-store" });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch +EV opportunities: ${response.statusText}`);
  }
  
  return response.json();
}

// =============================================================================
// Client-Side Filtering
// =============================================================================

/**
 * Apply client-side filters (search, etc.)
 */
function filterOpportunities(
  opportunities: PositiveEVOpportunity[],
  filters: PositiveEVFilters
): PositiveEVOpportunity[] {
  let filtered = [...opportunities];
  
  // Search filter
  if (filters.search && filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim();
    filtered = filtered.filter((opp) => {
      const playerName = opp.playerName?.toLowerCase() || "";
      const market = opp.marketDisplay?.toLowerCase() || opp.market?.toLowerCase() || "";
      const team = opp.playerTeam?.toLowerCase() || "";
      const matchup = `${opp.homeTeam || ""} ${opp.awayTeam || ""}`.toLowerCase();
      
      return (
        playerName.includes(searchLower) ||
        market.includes(searchLower) ||
        team.includes(searchLower) ||
        matchup.includes(searchLower)
      );
    });
  }
  
  return filtered;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook for fetching true +EV opportunities
 * 
 * @example
 * ```tsx
 * const { opportunities, isLoading, filters, setFilters } = usePositiveEV({
 *   filters: { 
 *     sports: ["nba"],
 *     sharpPreset: "pinnacle",
 *     minEV: 2,
 *   },
 *   isPro: true,
 * });
 * ```
 */
export function usePositiveEV({
  filters: initialFilters,
  isPro,
  enabled = true,
}: UsePositiveEVOptions): UsePositiveEVResult {
  const queryClient = useQueryClient();
  
  // Merge initial filters with defaults
  const filters: PositiveEVFilters = useMemo(
    () => ({
      ...DEFAULT_FILTERS,
      ...initialFilters,
    }),
    [initialFilters]
  );
  
  // Query key
  const queryKey = useMemo(
    () => {
      const key = [
        "positive-ev",
        filters.sports.join(","),
        filters.markets?.join(",") || "all",
        filters.sharpPreset,
        filters.devigMethods?.join(",") || "default",
        filters.minEV,
        filters.maxEV,
        filters.books?.join(",") || "all",
        filters.limit,
        filters.mode || "pregame",
        isPro,
      ];
      console.log('[usePositiveEV] Query key changed:', key);
      return key;
    },
    [filters, isPro]
  );
  
  // Query
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: queryRefetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey,
    queryFn: () => {
      console.log('[usePositiveEV] Fetching with filters:', filters);
      return fetchPositiveEV(filters, isPro);
    },
    staleTime: 30_000, // Fresh for 30 seconds
    gcTime: 5 * 60_000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
  
  // Filter update helper (for use with a filter context)
  const setFilters = useCallback(
    (updates: Partial<PositiveEVFilters>) => {
      // This would be handled by a parent context
      // For now, just invalidate the query to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["positive-ev"] });
    },
    [queryClient]
  );
  
  // Get sharp preset config
  const sharpPresetConfig = SHARP_PRESETS[filters.sharpPreset];
  
  return {
    opportunities,
    totalFound: data?.meta.totalFound || 0,
    totalReturned: data?.meta.returned || 0,
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
    filters,
    setFilters,
    sharpPresetConfig,
    dataUpdatedAt,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for high EV opportunities (>= 3%)
 */
export function useHighEVOpportunities({
  sports = ["nba"],
  sharpPreset = "pinnacle",
  mode = "pregame" as EVMode,
  isPro,
}: {
  sports?: string[];
  sharpPreset?: SharpPreset;
  mode?: EVMode;
  isPro: boolean;
}) {
  return usePositiveEV({
    filters: {
      sports,
      sharpPreset,
      minEV: 3, // 3%+ EV
      mode,
    },
    isPro,
  });
}

/**
 * Hook for all +EV opportunities (> 0%)
 */
export function useAllPositiveEV({
  sports = ["nba"],
  sharpPreset = "pinnacle",
  mode = "pregame" as EVMode,
  isPro,
}: {
  sports?: string[];
  sharpPreset?: SharpPreset;
  mode?: EVMode;
  isPro: boolean;
}) {
  return usePositiveEV({
    filters: {
      sports,
      sharpPreset,
      minEV: 0.1, // Anything positive
      mode,
    },
    isPro,
  });
}

/**
 * Hook for comparing different sharp presets
 */
export function usePositiveEVComparison({
  sports = ["nba"],
  presets = ["pinnacle", "pinnacle_circa", "hardrock_thescore"] as SharpPreset[],
  minEV = 0,
  mode = "pregame" as EVMode,
  isPro,
}: {
  sports?: string[];
  presets?: SharpPreset[];
  minEV?: number;
  mode?: EVMode;
  isPro: boolean;
}) {
  // Fetch data for each preset in parallel
  const results = presets.map((preset) =>
    usePositiveEV({
      filters: { sports, sharpPreset: preset, minEV, mode },
      isPro,
    })
  );
  
  return {
    results: presets.map((preset, i) => ({
      preset,
      config: SHARP_PRESETS[preset],
      ...results[i],
    })),
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
  };
}
