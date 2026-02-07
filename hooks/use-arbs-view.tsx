"use client";

import { useMemo } from "react";
import { useArbitragePreferences } from "@/context/preferences-context";
import { useArbsStream } from "@/hooks/use-arbs-stream";
import { buildArbMarketOptions, matchesArbRow } from "@/lib/arb-filters";
import { sportsbooks } from "@/lib/data/sportsbooks";

export function useArbsView({ pro, live, eventId, limit = 100, mode }: { pro: boolean; live: boolean; eventId?: string; limit: number; mode: "prematch" | "live" }) {
  const { filters: arbPrefs, isLoading: prefsLoading, updateFilters } = useArbitragePreferences();
  const stream = useArbsStream({ pro, live, eventId, limit });
  const availableMarketOptions = useMemo(() => buildArbMarketOptions(stream.rows), [stream.rows]);

  // Calculate filtered counts from current page data
  // Note: This only counts filtered results in the current page, not total
  const counts = useMemo(() => {
    // Free users: cap at 1% ROI
    const effectiveMax = pro ? arbPrefs.maxArb : Math.min(arbPrefs.maxArb ?? 1, 1);
    const minLiquidity = arbPrefs.minLiquidity ?? 50;
    
    // Filter all rows in current page by user preferences
    const filtered = stream.rows.filter((r) =>
      matchesArbRow(r as any, {
        selectedBooks: arbPrefs.selectedBooks,
        selectedSports: arbPrefs.selectedSports,
        selectedLeagues: arbPrefs.selectedLeagues,
        selectedMarketTypes: arbPrefs.selectedMarketTypes,
        selectedMarkets: arbPrefs.selectedMarkets,
        minArb: arbPrefs.minArb,
        maxArb: effectiveMax,
        searchQuery: arbPrefs.searchQuery,
        minLiquidity,
      })
    );
    
    // Count live vs pregame from filtered results
    const liveCount = filtered.filter((r) => Boolean((r as any).ev?.live)).length;
    const pregameCount = filtered.length - liveCount;
    
    // Check if any filters are applied
    const allBooks = sportsbooks.filter(sb => sb.isActive !== false);
    const allSportsIds = ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'];
    const allLeaguesIds = ['nfl', 'ncaaf', 'nba', 'ncaab', 'wnba', 'mlb', 'nhl', 'soccer_epl'];
    const allMarketTypes = ['player', 'game'];
    
    const hasBookFilter = arbPrefs.selectedBooks.length !== allBooks.length;
    const hasRoiFilter = arbPrefs.minArb !== 0 || effectiveMax !== 20;
    const hasSearchFilter = Boolean(arbPrefs.searchQuery && arbPrefs.searchQuery.length > 0);
    const hasSportsFilter = arbPrefs.selectedSports.length > 0 && arbPrefs.selectedSports.length !== allSportsIds.length;
    const hasLeaguesFilter = arbPrefs.selectedLeagues.length > 0 && arbPrefs.selectedLeagues.length !== allLeaguesIds.length;
    const hasLiquidityFilter = minLiquidity > 0;
    const hasMarketTypeFilter = arbPrefs.selectedMarketTypes.length > 0 && arbPrefs.selectedMarketTypes.length !== allMarketTypes.length;
    const hasSpecificMarketFilter = arbPrefs.selectedMarkets.length > 0;
    const hasFilters = hasBookFilter || hasRoiFilter || hasSearchFilter || hasSportsFilter || hasLeaguesFilter || hasLiquidityFilter || hasMarketTypeFilter || hasSpecificMarketFilter;
    
    // If no filters applied, use API total counts for accuracy
    if (!hasFilters && stream.totalCounts) {
      return { live: stream.totalCounts.live, pregame: stream.totalCounts.pregame };
    }
    
    // With filters, show filtered count from current page
    // Note: This reflects the current page only when paginated
    return { live: liveCount, pregame: pregameCount };
  }, [stream.rows, stream.totalCounts, arbPrefs, pro]);

  const filteredRows = useMemo(() => {
    if (prefsLoading) return stream.rows;
    const wantLive = mode === "live";
    // Free users: cap at 1% ROI
    const effectiveMax = pro ? arbPrefs.maxArb : Math.min(arbPrefs.maxArb ?? 1, 1);
    const minLiquidity = arbPrefs.minLiquidity ?? 50;
    return stream.rows.filter((r) =>
      // live/prematch filter
      Boolean((r as any).ev?.live) === wantLive &&
      matchesArbRow(r as any, {
        selectedBooks: arbPrefs.selectedBooks,
        selectedSports: arbPrefs.selectedSports,
        selectedLeagues: arbPrefs.selectedLeagues,
        selectedMarketTypes: arbPrefs.selectedMarketTypes,
        selectedMarkets: arbPrefs.selectedMarkets,
        minArb: arbPrefs.minArb,
        maxArb: effectiveMax,
        searchQuery: arbPrefs.searchQuery,
        minLiquidity,
      })
    );
  }, [stream.rows, prefsLoading, arbPrefs, mode, pro]);

  // Calculate if filters are active for UI indication
  const allBooks = sportsbooks.filter(sb => sb.isActive !== false);
  const allSportsIds = ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'];
  const allLeaguesIds = ['nfl', 'ncaaf', 'nba', 'ncaab', 'wnba', 'mlb', 'nhl', 'soccer_epl'];
  const allMarketTypes = ['player', 'game'];
  // Free users: cap at 1% ROI
  const effectiveMax = pro ? arbPrefs.maxArb : Math.min(arbPrefs.maxArb ?? 1, 1);
  const minLiquidity = arbPrefs.minLiquidity ?? 50;
  const hasActiveFilters = 
    arbPrefs.selectedBooks.length !== allBooks.length ||
    (arbPrefs.selectedSports.length > 0 && arbPrefs.selectedSports.length !== allSportsIds.length) ||
    (arbPrefs.selectedLeagues.length > 0 && arbPrefs.selectedLeagues.length !== allLeaguesIds.length) ||
    (arbPrefs.selectedMarketTypes.length > 0 && arbPrefs.selectedMarketTypes.length !== allMarketTypes.length) ||
    arbPrefs.selectedMarkets.length > 0 ||
    arbPrefs.minArb !== 0 ||
    effectiveMax !== 20 ||
    minLiquidity > 0 ||
    Boolean(arbPrefs.searchQuery && arbPrefs.searchQuery.length > 0);

  return {
    ...stream,
    rows: filteredRows,
    counts,
    prefs: arbPrefs,
    prefsLoading,
    updateFilters,
    availableMarketOptions,
    hasActiveFilters,
    filteredCount: stream.filteredCount,
    filteredReason: stream.filteredReason,
  };
}
