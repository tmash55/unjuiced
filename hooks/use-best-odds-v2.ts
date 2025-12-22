/**
 * Hook for fetching best odds using the v2 Opportunities API
 * 
 * This is a drop-in replacement for use-best-odds-view.ts that uses
 * the new /api/v2/opportunities endpoint with proper devigging.
 * 
 * Usage:
 *   Replace: import { useBestOddsView } from "@/hooks/use-best-odds-view"
 *   With:    import { useBestOddsV2 } from "@/hooks/use-best-odds-v2"
 */

import { useQuery } from "@tanstack/react-query";
import { useBestOddsPreferences } from "@/context/preferences-context";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import {
  transformOpportunitiesResponse,
  opportunityToExtendedDeal,
  type OpportunitiesResponseV2,
  type BestOddsDealV2,
} from "@/lib/api-adapters/opportunities-to-best-odds";

interface UseBestOddsV2Options {
  isPro: boolean;
  /**
   * Which sports to fetch (default: ['nba'])
   * Use 'all' or multiple sports for cross-sport scanning
   */
  sports?: string[];
  /**
   * Preset name for sharp reference (e.g., 'pinnacle', 'average', 'sharp_consensus')
   * See /api/v2/presets for available options
   */
  preset?: string;
  /**
   * Custom blend weights (overrides preset)
   * e.g., [{ book: 'pinnacle', weight: 0.6 }, { book: 'fanduel', weight: 0.4 }]
   */
  blend?: Array<{ book: string; weight: number }>;
  /**
   * Minimum edge percentage (default: 0)
   */
  minEdge?: number;
  /**
   * Minimum EV percentage for +EV filtering
   */
  minEV?: number;
  /**
   * Only return opportunities with proper two-way devigging
   */
  requireTwoWay?: boolean;
  /**
   * Return extended deal format with EV/sharp data (default: false)
   */
  extended?: boolean;
}

interface UseBestOddsV2Result {
  deals: BestOddsDeal[];
  extendedDeals: BestOddsDealV2[];
  premiumCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  prefs: ReturnType<typeof useBestOddsPreferences>["filters"];
  prefsLoading: boolean;
  updateFilters: ReturnType<typeof useBestOddsPreferences>["updateFilters"];
  // v2-specific metadata
  meta: {
    totalScanned: number;
    timingMs: number;
    preset: string | null;
  } | null;
}

export function useBestOddsV2({
  isPro,
  sports = ["nba"],
  preset = "pinnacle",
  blend,
  minEdge = 0,
  minEV,
  requireTwoWay = false,
  extended = false,
}: UseBestOddsV2Options): UseBestOddsV2Result {
  const { filters: prefs, isLoading: prefsLoading, updateFilters } = useBestOddsPreferences();

  // Build query key with all relevant parameters
  const queryKey = [
    "best-odds-v2",
    isPro,
    sports.join(","),
    preset,
    blend ? JSON.stringify(blend) : null,
    minEdge,
    minEV,
    requireTwoWay,
    prefs.scope,
    prefs.sortBy,
    prefs.minOdds,
    prefs.maxOdds,
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Build URL with query params
      const params = new URLSearchParams();
      
      // Sports
      params.set("sports", sports.join(","));
      
      // Sharp reference
      if (blend && blend.length > 0) {
        params.set("blend", blend.map((b) => `${b.book}:${b.weight}`).join(","));
      } else if (preset) {
        params.set("preset", preset);
      }
      
      // Edge/EV filters
      if (minEdge > 0) params.set("minEdge", String(minEdge));
      if (minEV !== undefined) params.set("minEV", String(minEV));
      if (requireTwoWay) params.set("requireTwoWay", "true");
      
      // Odds range filters from prefs
      if (prefs.minOdds !== undefined) params.set("minOdds", String(prefs.minOdds));
      if (prefs.maxOdds !== undefined) params.set("maxOdds", String(prefs.maxOdds));
      
      // Sort (map from legacy format)
      if (prefs.sortBy === "improvement") {
        params.set("sortBy", "edge_pct");
        params.set("sortDir", "desc");
      } else if (prefs.sortBy === "odds") {
        params.set("sortBy", "best_decimal");
        params.set("sortDir", "desc");
      }
      
      // Limit: Pro gets more, free gets preview
      const limit = isPro ? 500 : 50;
      params.set("limit", String(limit));

      const url = `/api/v2/opportunities?${params.toString()}`;
      
      console.log("[useBestOddsV2] Fetching:", url);
      
      const response = await fetch(url, { cache: "no-store" });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
      }
      
      const data: OpportunitiesResponseV2 = await response.json();
      
      console.log("[useBestOddsV2] Received:", data.count, "opportunities in", data.timing_ms, "ms");
      
      return data;
    },
    staleTime: 30_000, // Fresh for 30 seconds
    gcTime: 5 * 60_000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: false,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    enabled: isPro !== undefined, // Wait for auth to resolve
  });

  // Transform to legacy format
  const transformed = data ? transformOpportunitiesResponse(data) : null;
  
  // Get extended deals if requested
  const extendedDeals = extended && data
    ? data.opportunities.map(opportunityToExtendedDeal)
    : [];

  // Apply client-side filters from prefs (leagues, markets, books, search)
  const filteredDeals = (transformed?.deals || []).filter((deal) => {
    // League filter
    if (prefs.selectedLeagues?.length > 0) {
      if (!prefs.selectedLeagues.includes(deal.sport)) return false;
    }
    
    // Market filter
    if (prefs.selectedMarkets?.length > 0) {
      if (!prefs.selectedMarkets.includes(deal.mkt)) return false;
    }
    
    // Book filter
    if (prefs.selectedBooks?.length > 0) {
      if (!prefs.selectedBooks.includes(deal.bestBook)) return false;
    }
    
    // Search filter
    if (prefs.searchQuery) {
      const searchLower = prefs.searchQuery.toLowerCase();
      const playerMatch = deal.playerName?.toLowerCase().includes(searchLower);
      const teamMatch = deal.homeTeam?.toLowerCase().includes(searchLower) ||
                        deal.awayTeam?.toLowerCase().includes(searchLower);
      const marketMatch = deal.mkt.toLowerCase().includes(searchLower);
      if (!playerMatch && !teamMatch && !marketMatch) return false;
    }
    
    return true;
  });

  // Filter extended deals the same way
  const filteredExtendedDeals = extendedDeals.filter((deal) => {
    const baseCheck = filteredDeals.some((d) => d.key === deal.key);
    return baseCheck;
  });

  return {
    deals: filteredDeals,
    extendedDeals: filteredExtendedDeals,
    premiumCount: 0,
    loading: isLoading,
    error: error as Error | null,
    refresh: async () => {
      await refetch();
    },
    prefs,
    prefsLoading,
    updateFilters,
    meta: data
      ? {
          totalScanned: data.total_scanned,
          timingMs: data.timing_ms,
          preset: data.filters.preset,
        }
      : null,
  };
}

/**
 * Convenience hook for +EV opportunities only
 */
export function usePositiveEV({
  isPro,
  sports = ["nba"],
  preset = "pinnacle",
  minEV = 0,
}: {
  isPro: boolean;
  sports?: string[];
  preset?: string;
  minEV?: number;
}) {
  return useBestOddsV2({
    isPro,
    sports,
    preset,
    minEV,
    requireTwoWay: true,
    extended: true,
  });
}

