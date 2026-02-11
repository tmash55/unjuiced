"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBestOdds } from "@/lib/best-odds-client";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { useBestOddsPreferences } from "@/context/preferences-context";

interface UseBestOddsViewOptions {
  isPro: boolean;
}

/**
 * Custom hook for managing best odds data fetching
 * Uses React Query to prevent unnecessary refetches when switching tabs
 * Follows the same pattern as the odds screen for consistency
 */
export function useBestOddsView({ isPro }: UseBestOddsViewOptions) {
  const { filters: prefs, isLoading: prefsLoading, updateFilters } = useBestOddsPreferences();

  // Use React Query for intelligent caching and refetch control
  const queryKey = ['best-odds', isPro, prefs.scope, prefs.sortBy];
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!isPro) {
        // Non-Pro: Fetch preview data (server already limits to 2 per sport)
        const previewResponse = await fetch(
          `/api/best-odds?scope=${prefs.scope}&sortBy=${prefs.sortBy}&limit=500`,
          { cache: "no-store" }
        );

        const previewData = await previewResponse.json();

        return { deals: previewData.deals || [], premiumCount: previewData.premiumCount || 0 };
      } else {
        // Pro: Fetch ALL deals without filters (filter client-side)
        const response = await fetchBestOdds({
          scope: prefs.scope,
          sortBy: prefs.sortBy,
          limit: 2000,
          minImprovement: 0, // Get all, filter client-side
        });
        return { deals: response.deals, premiumCount: 0 };
      }
    },
    staleTime: 30_000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60_000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when switching back to tab
    refetchOnReconnect: true, // Refetch when internet reconnects
    refetchInterval: false, // No automatic polling (user can manually refresh)
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s (max 30s)
  });

  // Refresh function for manual refresh
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    deals: data?.deals || [],
    premiumCount: data?.premiumCount ?? 0,
    // Only show loading if we don't have data yet (not when refetching with cached data)
    loading: isLoading && !data,
    error: error ? (error instanceof Error ? error.message : 'Failed to load deals') : null,
    refresh,
    prefs,
    prefsLoading,
    updateFilters,
  };
}

