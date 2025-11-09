"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { BestOddsPrefs, BestOddsDeal } from "@/lib/best-odds-schema";
import { GatedBestOddsView } from "@/components/best-odds/gated-best-odds-view";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw, LayoutGrid, Table as TableIcon } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { Tooltip } from "@/components/tooltip";

import { useBestOddsView } from "@/hooks/use-best-odds-view";
import { matchesBestOddsDeal, sortDeals, getUniqueLeagues, getUniqueMarkets, getUniqueSportsbooks } from "@/lib/best-odds-filters";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { SUPPORTED_SPORTS } from "@/lib/data/markets";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";

export default function BestOddsPage() {
  // VC-Grade: Use centralized, cached Pro status and custom hook for data fetching
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
  
  // Custom hook handles all data fetching (Pro vs non-Pro)
  const { deals, loading, error, refresh, prefs, prefsLoading, updateFilters } = useBestOddsView({ 
    isPro, 
    planLoading 
  });
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Local search state for smooth typing (debounced like arbs)
  const [searchLocal, setSearchLocal] = useState("");
  
  // View mode state (default to table, will adjust on mount)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Set initial view mode based on screen size (client-side only, after mount)
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'cards' : 'table');
    };
    
    // Set initial value
    handleResize();
    
    // Optional: Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle preference changes
  const handlePrefsChange = useCallback((newPrefs: BestOddsPrefs) => {
    updateFilters(newPrefs);
  }, [updateFilters]);

  // Sync local search with preferences (when prefs change externally)
  useEffect(() => {
    setSearchLocal(prefs.searchQuery || "");
  }, [prefs.searchQuery]);

  // Debounce search query updates (400ms like arbs)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchLocal !== prefs.searchQuery) {
        updateFilters({ ...prefs, searchQuery: searchLocal });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchLocal, prefs, updateFilters]);

  // Show ALL possible options in filters (not just what's in current data)
  const availableLeagues = useMemo(() => ['nba', 'nfl', 'ncaaf', 'ncaab', 'nhl', 'mlb', 'wnba'], []);
  
  // Dynamically extract unique markets from actual data (instead of hardcoding)
  const availableMarkets = useMemo(() => {
    const uniqueMarkets = new Set<string>();
    deals.forEach((deal: BestOddsDeal) => {
      if (deal.mkt) {
        uniqueMarkets.add(deal.mkt);
      }
    });
    return Array.from(uniqueMarkets).sort();
  }, [deals]);
  
  const availableSportsbooks = useMemo(() => getAllActiveSportsbooks().map(b => b.id), []);

  // Apply client-side filtering and sorting
  const filteredDeals = useMemo(() => {
    let filtered = deals.filter((deal: BestOddsDeal) => matchesBestOddsDeal(deal, prefs));
    filtered = sortDeals(filtered, prefs.sortBy);
    return filtered;
  }, [deals, prefs]);

  // Calculate counts by scope for toggle buttons (using filtered deals)
  const pregameCount = filteredDeals.filter((d: BestOddsDeal) => d.scope === 'pregame').length;
  const liveCount = filteredDeals.filter((d: BestOddsDeal) => d.scope === 'live').length;

  const stats = {
    total: filteredDeals.length,
    pregame: pregameCount,
    live: liveCount,
    avgImprovement: filteredDeals.length > 0
      ? (filteredDeals.reduce((sum: number, d: BestOddsDeal) => sum + Number(d.priceImprovement || 0), 0) / filteredDeals.length).toFixed(1)
      : '0'
  };

  // Show loading state while checking plan
  if (planLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState type="account" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <ToolHeading>Edge Finder</ToolHeading>
        <ToolSubheading>
        Track real-time discrepancies between sportsbooks to uncover edges before the market adjusts.
        </ToolSubheading>
      </div>

      {/* Pregame/Live Toggle - Above Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pregame/Live Toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              onClick={() => handlePrefsChange({ ...prefs, scope: 'pregame' })}
              className={cn(prefs.scope === 'pregame' && 'active')}
            >
              Pre-Game {stats.pregame > 0 && `(${stats.pregame})`}
            </button>
            <button
              type="button"
              disabled={true}
              className="relative group"
              title="Coming soon"
            >
              <span className="flex items-center gap-1.5">
                Live
                <Lock className="h-3 w-3 opacity-60" />
                <span className="text-xs opacity-60">(Soon)</span>
              </span>
            </button>
          </div>

          {/* Info Text - Hidden on Mobile */}
          <div className="hidden md:block text-sm text-neutral-600 dark:text-neutral-400">
            {prefs.scope === 'pregame' && 'Showing upcoming games'}
            {prefs.scope === 'live' && 'Showing live in-progress games'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
        <div className="sticky top-14 z-30">
          <FiltersBar useDots={true}>
            <FiltersBarSection align="left">
              {/* Search Input - Hidden on mobile, disabled for non-pro */}
              <Tooltip content="Pro only" disabled={isPro}>
                <div className="relative hidden md:block">
                  <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search player or team..."
                    value={searchLocal}
                    onChange={(e) => setSearchLocal(e.target.value)}
                    disabled={!isPro}
                    className="w-64 pl-10"
                  />
                </div>
              </Tooltip>

              {/* View Toggle - Shows on left on mobile, right on desktop */}
              <Tooltip content="Pro only" disabled={isPro}>
                <div className={cn(
                  "flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900 md:hidden",
                  !isPro && "opacity-50"
                )}>
                  <button
                    onClick={() => isPro && setViewMode('table')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'table'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                  >
                    <TableIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => isPro && setViewMode('cards')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'cards'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </Tooltip>
            </FiltersBarSection>

            <FiltersBarSection align="right">
              {/* View Toggle - Shows on right on desktop, hidden on mobile */}
              <div className={cn(
                "hidden md:flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900",
                !isPro && "opacity-50"
              )}>
                <button
                  onClick={() => isPro && setViewMode('table')}
                  disabled={!isPro}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded transition-all",
                    viewMode === 'table'
                      ? "bg-brand text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                    !isPro && "cursor-not-allowed"
                  )}
                  title={!isPro ? "Pro only" : "Table view"}
                >
                  <TableIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => isPro && setViewMode('cards')}
                  disabled={!isPro}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded transition-all",
                    viewMode === 'cards'
                      ? "bg-brand text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                    !isPro && "cursor-not-allowed"
                  )}
                  title={!isPro ? "Pro only" : "Card view"}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              {/* Refresh Button */}
              <Tooltip content="Pro only" disabled={isPro}>
                <button
                  onClick={async () => {
                    if (!isPro) return;
                    try { 
                      setRefreshing(true); 
                      await refresh(); 
                    } finally { 
                      setRefreshing(false); 
                    }
                  }}
                  disabled={refreshing || !isPro}
                  className={cn(
                    "refresh-btn flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-all",
                    !isPro && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </button>
              </Tooltip>

              {/* Filters Button */}
              {isPro ? (
                <BestOddsFilters
                  prefs={prefs}
                  onPrefsChange={handlePrefsChange}
                  availableLeagues={availableLeagues}
                  availableMarkets={availableMarkets}
                  availableSportsbooks={availableSportsbooks}
                  deals={deals}
                />
              ) : (
                <Tooltip content="Pro only">
                  <button
                    type="button"
                    disabled
                    className="filters-btn flex items-center gap-2 h-9 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all opacity-50 cursor-not-allowed"
                  >
                    <Lock className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                </Tooltip>
              )}
            </FiltersBarSection>
          </FiltersBar>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-red-200">
          <p className="font-medium">Error loading opportunities</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Content - Gated View */}
      <GatedBestOddsView
        deals={filteredDeals}
        loading={loading || prefsLoading}
        viewMode={viewMode}
        isLoggedIn={isLoggedIn}
        isPro={isPro}
      />
    </div>
  );
}

