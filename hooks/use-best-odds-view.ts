"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBestOdds } from "@/lib/best-odds-client";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { useBestOddsPreferences } from "@/context/preferences-context";

interface UseBestOddsViewOptions {
  isPro: boolean;
  planLoading: boolean;
}

/**
 * Custom hook for managing best odds data fetching
 * Handles Pro vs non-Pro data sources automatically
 * Follows the same pattern as useArbsView for consistency
 */
export function useBestOddsView({ isPro, planLoading }: UseBestOddsViewOptions) {
  const { filters: prefs, isLoading: prefsLoading, updateFilters } = useBestOddsPreferences();
  const [deals, setDeals] = useState<BestOddsDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load deals from API (fetch ALL data for Pro, preview for non-Pro)
  const loadDeals = useCallback(async () => {
    // Don't fetch if still checking plan status
    if (planLoading) return;

    try {
      setLoading(true);
      setError(null);

      if (!isPro) {
        // Non-Pro: Fetch preview data from teaser endpoint
        const response = await fetch("/api/best-odds/teaser?limit=10", { cache: "no-store" });
        const data = await response.json();
        setDeals(data.deals || []);
      } else {
        // Pro: Fetch ALL deals without filters (filter client-side)
        const response = await fetchBestOdds({
          scope: prefs.scope,
          sortBy: prefs.sortBy,
          limit: 2000,
          minImprovement: 0, // Get all, filter client-side
        });
        setDeals(response.deals);
      }
    } catch (err) {
      console.error('[useBestOddsView] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [prefs.scope, prefs.sortBy, isPro, planLoading]);

  // Refresh function for manual refresh
  const refresh = useCallback(async () => {
    await loadDeals();
  }, [loadDeals]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  return {
    deals,
    loading,
    error,
    refresh,
    prefs,
    prefsLoading,
    updateFilters,
  };
}

