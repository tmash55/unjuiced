"use client";

/**
 * Edge Finder - Find betting edges across sportsbooks
 * 
 * Uses native Opportunity types and components.
 * Responsive: Shows mobile-optimized view on small screens.
 * 
 * URL: /edge-finder
 */

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { LoadingState } from "@/components/common/loading-state";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { Zap, ChevronDown, X, RefreshCw, Layers, Plus, Settings, Filter, ArrowRight } from "lucide-react";
import LockIcon from "@/icons/lock";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { FilterPresetFormModal } from "@/components/filter-presets/filter-preset-form-modal";
import { FilterPresetsManagerModal } from "@/components/filter-presets/filter-presets-manager-modal";

// Native imports
import { useMultiFilterOpportunities } from "@/hooks/use-multi-filter-opportunities";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { MobileEdgeFinder } from "@/components/opportunities/mobile";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Shared preferences & filters component
import { useBestOddsPreferences, useEvPreferences } from "@/context/preferences-context";
import { UnifiedFilters, type EdgeFinderSettings, type FilterChangeEvent } from "@/components/shared/unified-filters";
import { UnifiedFilterBar } from "@/components/shared/filter-bar";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { formatMarketLabel } from "@/lib/data/markets";

import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";
import { useHiddenEdges } from "@/hooks/use-hidden-edges";
import { useIsMobileOrTablet } from "@/hooks/use-media-query";
import { FilterPresetsBar } from "@/components/filter-presets";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import type { BestOddsData } from "@/components/odds-screen/types/odds-screen-types";
import { useAvailableMarkets, FALLBACK_MARKETS } from "@/hooks/use-available-markets";

// Available leagues for the filters component
const AVAILABLE_LEAGUES = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba", "soccer_epl"];
const FREE_EDGE_ROW_LIMIT = 7; // Number of rows free users can see

/**
 * Format timestamp as relative time (e.g., "5s ago", "2m ago")
 * Billion-dollar UX: Show users when data was last refreshed
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Map preset back to comparison mode
 */
function mapPresetToComparisonMode(preset: string): { mode: BestOddsPrefs['comparisonMode']; book: string | null } {
  if (preset === "average") {
    return { mode: "average", book: null };
  }
  // Assume it's a book ID
  return { mode: "book", book: preset };
}

export default function EdgeFinderPage() {
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
  const isMobile = useIsMobileOrTablet(); // Show card view on phones & tablets (< 1280px)
  const stablePlanRef = useRef(isPro);

  useEffect(() => {
    if (!planLoading) {
      stablePlanRef.current = isPro;
    }
  }, [planLoading, isPro]);

  const effectiveIsPro = planLoading ? stablePlanRef.current : isPro;
  const locked = !effectiveIsPro;

  // Use shared preferences
  const { filters: prefs, updateFilters: updatePrefs, isLoading: prefsLoading } = useBestOddsPreferences();
  
  // Get EV-specific preferences (bankroll, kelly %)
  const { filters: evPrefs, updateFilters: updateEvPrefs } = useEvPreferences();
  
  // Get active filter presets
  const { activePresets, isLoading: presetsLoading, togglePreset, deactivateAll: deactivateAllPresets } = useFilterPresets();
  
  // Dynamically fetch available markets from the API
  // This ensures we always show markets that actually exist in the data feed
  const { data: marketsData } = useAvailableMarkets(AVAILABLE_LEAGUES);
  const availableMarketOptions = useMemo(() => {
    if (marketsData?.aggregatedMarkets && marketsData.aggregatedMarkets.length > 0) {
      return marketsData.aggregatedMarkets.map((market) => ({
        key: market.key,
        label: market.display && market.display.length > 3 ? market.display : formatMarketLabel(market.key),
        sports: market.sports,
      }));
    }
    return FALLBACK_MARKETS.map((market) => ({
      key: market,
      label: formatMarketLabel(market),
    }));
  }, [marketsData?.aggregatedMarkets]);
  const availableMarkets = useMemo(
    () => availableMarketOptions.map((market) => market.key),
    [availableMarketOptions]
  );
  
  // Local search state (debounced before saving to prefs)
  const [searchLocal, setSearchLocal] = useState(prefs.searchQuery || "");
  const [refreshing, setRefreshing] = useState(false);
  
  // Preset modal states
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showPresetForm, setShowPresetForm] = useState(false);
  
  // Handler to switch to standard preset (deactivates custom models)
  const handlePresetChange = async (mode: BestOddsPrefs['comparisonMode'], book: string | null = null) => {
    // Deactivate all custom models
    if (activePresets.length > 0) {
      await Promise.all(activePresets.map(p => togglePreset(p.id, false)));
    }
    // Update comparison mode
    updatePrefs({ comparisonMode: mode, comparisonBook: book });
  };
  

  // Hidden edges management
  const { 
    hiddenCount, 
    hideEdge, 
    unhideEdge, 
    isHidden,
    clearAllHidden 
  } = useHiddenEdges();

  // Result limit (default 200 for Pro, 50 for free)
  const [limit, setLimit] = useState(200);

  // Profit boost % (for sportsbook promotions like "30% profit boost")
  const [boostPercent, setBoostPercent] = useState(0);

  // Player quick view modal state
  const [selectedPlayer, setSelectedPlayer] = useState<{
    odds_player_id: string;
    player_name: string;
    market: string;
    event_id: string;
    line?: number;
    odds?: BestOddsData;
  } | null>(null);

  // Sync local search with prefs on load
  useEffect(() => {
    setSearchLocal(prefs.searchQuery || "");
  }, [prefs.searchQuery]);

  // Reset limit when plan changes
  useEffect(() => {
    setLimit(effectiveIsPro ? 200 : 50);
  }, [effectiveIsPro]);

  // When user searches, fetch full set for coverage; otherwise use default
  useEffect(() => {
    const hasSearch = (searchLocal || "").trim().length > 0;
    setLimit(hasSearch ? 500 : (effectiveIsPro ? 200 : 50));
  }, [searchLocal, effectiveIsPro]);

  // Debounce search updates to prefs
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchLocal !== (prefs.searchQuery || "")) {
        updatePrefs({ searchQuery: searchLocal });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchLocal, prefs.searchQuery, updatePrefs]);

  // ===== DATA SOURCE =====
  // Manual refresh only - SSE streaming removed until backend optimization
  
  const {
    opportunities,
    activeFilters,
    isCustomMode,
    isLoading,
    isFetching,
    error,
    refetch,
    prefetchPreset,
    dataUpdatedAt,
    isStale,
    isLoadingMore,
    loadProgress,
  } = useMultiFilterOpportunities({
    prefs: {
      ...prefs,
      columnOrder: ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'],
    },
    activePresets,
    isPro: effectiveIsPro,
    limit,
    enabled: !planLoading && !prefsLoading && !presetsLoading,
  });

  // Apply hidden edges filter and min liquidity filter (must be done client-side due to user-specific state)
  // Note: Pinning of expanded rows is handled internally by OpportunitiesTable
  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;

    // Hidden edges filter
    if (!prefs.showHidden) {
      filtered = filtered.filter((opp) => !isHidden(opp.id));
    }

    // Min liquidity filter - filter out opportunities where best book's max stake is below threshold
    const minLiquidity = prefs.minLiquidity ?? 0;
    if (minLiquidity > 0) {
      filtered = filtered.filter((opp) => {
        // Find the best book's limits from allBooks (use rounding for floating point comparison)
        const roundedBest = Math.round(opp.bestDecimal * 10000) / 10000;
        const bestBookOffer = opp.allBooks?.find(b => Math.round(b.decimal * 10000) / 10000 === roundedBest);
        const maxStake = bestBookOffer?.limits?.max;
        // If limits are unknown (null/undefined), include the opportunity
        if (maxStake == null) return true;
        // Otherwise, only include if max stake meets threshold
        return maxStake >= minLiquidity;
      });
    }

    return filtered;
  }, [opportunities, prefs.showHidden, prefs.minLiquidity, isHidden]);

  // Gate: limit visible rows for free users
  const displayOpportunities = useMemo(() => {
    if (effectiveIsPro) return filteredOpportunities;
    return filteredOpportunities.slice(0, FREE_EDGE_ROW_LIMIT);
  }, [filteredOpportunities, effectiveIsPro]);

  const hiddenEdgeCount = effectiveIsPro
    ? 0
    : Math.max(0, filteredOpportunities.length - FREE_EDGE_ROW_LIMIT);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Handler for filters changes from UnifiedFilters
  const handleFiltersChange = useCallback((filters: FilterChangeEvent) => {
    const updates: Partial<BestOddsPrefs> = {};
    
    // Common filters
    if (filters.selectedBooks !== undefined) updates.selectedBooks = filters.selectedBooks;
    if (filters.selectedMarkets !== undefined) updates.selectedMarkets = filters.selectedMarkets;
    if (filters.minLiquidity !== undefined) updates.minLiquidity = filters.minLiquidity;
    if (filters.showHidden !== undefined) updates.showHidden = filters.showHidden;
    
    // Edge Finder specific filters
    if (filters.selectedLeagues !== undefined) updates.selectedLeagues = filters.selectedLeagues;
    if (filters.marketLines !== undefined) updates.marketLines = filters.marketLines;
    if (filters.minImprovement !== undefined) updates.minImprovement = filters.minImprovement;
    if (filters.maxOdds !== undefined) updates.maxOdds = filters.maxOdds;
    if (filters.minOdds !== undefined) updates.minOdds = filters.minOdds;
    if (filters.hideCollegePlayerProps !== undefined) updates.hideCollegePlayerProps = filters.hideCollegePlayerProps;
    
    updatePrefs(updates);
  }, [updatePrefs]);

  // Kelly Criterion handlers
  const handleBankrollChange = useCallback((value: number) => {
    updateEvPrefs({ bankroll: value });
  }, [updateEvPrefs]);

  const handleKellyPercentChange = useCallback((value: number) => {
    updateEvPrefs({ kellyPercent: value });
  }, [updateEvPrefs]);

  // Toggle show hidden
  const handleToggleShowHidden = useCallback(() => {
    updatePrefs({ showHidden: !prefs.showHidden });
  }, [updatePrefs, prefs.showHidden]);

  // Get available sportsbooks from current deals for counts
  const availableSportsbooks = useMemo(() => {
    const books = new Set<string>();
    opportunities.forEach((opp) => {
      opp.allBooks.forEach((b) => books.add(b.book));
    });
    return Array.from(books);
  }, [opportunities]);

  if (planLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState message="Loading Edge Finder..." />
      </div>
    );
  }

  // Mobile View - Full-screen app-like experience
  if (isMobile) {
    return (
      <>
        <MobileEdgeFinder
          opportunities={displayOpportunities}
          isLoading={isLoading}
          isFetching={isFetching || refreshing}
          error={error}
          onRefresh={handleRefresh}
          onPlayerClick={(opp) => {
            if (opp.playerId && opp.player) {
              setSelectedPlayer({
                odds_player_id: opp.playerId,
                player_name: opp.player,
                market: opp.market || "",
                event_id: opp.eventId || "",
                line: opp.line,
              });
            }
          }}
          onHideEdge={(opp) => hideEdge({
            edgeKey: opp.id,
            eventId: opp.eventId,
            eventDate: opp.gameStart,
            sport: opp.sport,
            playerName: opp.player,
            market: opp.market,
            line: opp.line,
            autoUnhideHours: 24
          })}
          onUnhideEdge={unhideEdge}
          isHidden={isHidden}
          bankroll={evPrefs.bankroll}
          kellyPercent={evPrefs.kellyPercent || 25}
          isPro={effectiveIsPro}
          activePresets={activePresets}
          isCustomMode={isCustomMode}
          dataUpdatedAt={dataUpdatedAt ?? undefined}
          onPresetHover={prefetchPreset}
          prefs={prefs}
          onPrefsChange={(newPrefs) => updatePrefs(newPrefs)}
          availableLeagues={AVAILABLE_LEAGUES}
          availableMarkets={availableMarkets}
          availableSportsbooks={availableSportsbooks}
          boostPercent={boostPercent}
          onBoostChange={setBoostPercent}
          onBankrollChange={handleBankrollChange}
          onKellyPercentChange={handleKellyPercentChange}
        />
        
        {/* Player Quick View Modal */}
        {selectedPlayer && (
          <PlayerQuickViewModal
            odds_player_id={selectedPlayer.odds_player_id}
            player_name={selectedPlayer.player_name}
            initial_market={selectedPlayer.market}
            initial_line={selectedPlayer.line}
            event_id={selectedPlayer.event_id}
            odds={selectedPlayer.odds ?? undefined}
            open={!!selectedPlayer}
            onOpenChange={(open) => {
              if (!open) setSelectedPlayer(null);
            }}
          />
        )}
      </>
    );
  }

  // Build subtitle based on loading state
  const subtitle = isLoading
    ? "Loading opportunities..."
    : isFetching && !isLoadingMore
    ? "Updating opportunities..."
    : effectiveIsPro
    ? `${filteredOpportunities.length}+ opportunities found`
    : `${displayOpportunities.length} of ${filteredOpportunities.length}+ opportunities shown`;

  // Header actions - freshness indicator and loading
  const headerActions = (
    <div className="flex items-center gap-3">
      {/* Progressive Loading Indicator */}
      {isLoadingMore && (
        <div className="flex items-center gap-2 text-xs text-blue-500 dark:text-blue-400">
          <div className="w-16 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <span>Loading more...</span>
        </div>
      )}
      {/* Freshness Indicator */}
      {dataUpdatedAt && !isLoading && !isLoadingMore && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
          <span>Updated {formatTimeAgo(dataUpdatedAt)}</span>
          {isFetching && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );

  // Context bar - filter bar with timestamp above
  const contextBar = (
    <>
      {/* Timestamp indicator - above filter bar */}
      {headerActions && (
        <div className="flex justify-end mb-2">
          {headerActions}
        </div>
      )}
      <UnifiedFilterBar
        tool="edge-finder"
        className="mb-6"
        // Mode (using scope for Edge Finder)
        mode={prefs.scope === "pregame" ? "pregame" : prefs.scope === "live" ? "live" : "all"}
        onModeChange={(mode) => updatePrefs({ scope: mode === "pregame" ? "pregame" : mode === "live" ? "live" : "all" })}
        // Search
        searchQuery={searchLocal}
        onSearchChange={setSearchLocal}
        // Boost
        boostPercent={boostPercent}
        onBoostChange={setBoostPercent}
        // Leagues
        selectedLeagues={prefs.selectedLeagues}
        onLeaguesChange={(leagues) => updatePrefs({ selectedLeagues: leagues })}
        availableLeagues={AVAILABLE_LEAGUES}
        // Markets
        selectedMarkets={prefs.selectedMarkets}
        onMarketsChange={(markets) => updatePrefs({ selectedMarkets: markets })}
        availableMarkets={availableMarketOptions}
        // Sportsbooks
        selectedBooks={prefs.selectedBooks}
        onBooksChange={(books) => updatePrefs({ selectedBooks: books })}
        sportsbookCounts={(() => {
          const counts: Record<string, number> = {};
          filteredOpportunities.forEach((opp) => {
            const bestDecimal = opp.bestDecimal;
            // Count ALL books that have the same best decimal odds
            // Use rounding to handle floating point precision issues
            const roundedBest = Math.round(bestDecimal * 10000) / 10000;
            opp.allBooks
              .filter(b => Math.round(b.decimal * 10000) / 10000 === roundedBest)
              .forEach(b => {
                counts[b.book] = (counts[b.book] || 0) + 1;
              });
          });
          return counts;
        })()}
        // Comparison mode
        comparisonMode={prefs.comparisonMode}
        comparisonBook={prefs.comparisonBook}
        onComparisonChange={(mode, book) => {
          handlePresetChange(mode, book);
        }}
        // Global settings
        minLiquidity={prefs.minLiquidity ?? 0}
        onMinLiquidityChange={(minLiquidity) => updatePrefs({ minLiquidity })}
        // Odds range
        minOdds={prefs.minOdds ?? -10000}
        onMinOddsChange={(minOdds) => updatePrefs({ minOdds })}
        maxOdds={prefs.maxOdds ?? 100000}
        onMaxOddsChange={(maxOdds) => updatePrefs({ maxOdds })}
        // Kelly
        bankroll={evPrefs.bankroll}
        kellyPercent={evPrefs.kellyPercent}
        onBankrollChange={handleBankrollChange}
        onKellyPercentChange={handleKellyPercentChange}
        // Hidden
        showHidden={prefs.showHidden}
        hiddenCount={hiddenCount}
        onToggleShowHidden={handleToggleShowHidden}
        // Custom Models
        activePresets={activePresets}
        onManageModels={() => setShowPresetManager(true)}
        onClearPresets={deactivateAllPresets}
        // Refresh
        onRefresh={refetch}
        isRefreshing={isFetching}
        // Reset
        onReset={() => {
          updatePrefs({
            scope: "pregame",
            selectedLeagues: AVAILABLE_LEAGUES,
            selectedBooks: [],
            selectedMarkets: [],
            comparisonMode: "average",
            comparisonBook: null,
            minLiquidity: 0,
            minOdds: -10000,
            maxOdds: 100000,
          });
          setBoostPercent(0);
          setSearchLocal("");
        }}
        // UI state
        locked={locked}
        isPro={effectiveIsPro}
      />
    </>
  );

  // Desktop View
  return (
    <AppPageLayout
      title="Edge Finder"
      subtitle={subtitle}
      contextBar={contextBar}
      stickyContextBar={true}
    >
      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
          Error: {error.message}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl">
          <OpportunitiesTable
            opportunities={displayOpportunities}
            isLoading={isLoading}
            isFetching={isFetching || refreshing}
            isPro={effectiveIsPro}
            showEV={false}
            showHidden={prefs.showHidden}
            onHideEdge={hideEdge}
            onUnhideEdge={unhideEdge}
            isHidden={isHidden}
            onPlayerClick={setSelectedPlayer}
            comparisonMode={isCustomMode ? undefined : prefs.comparisonMode}
            comparisonLabel={
              isCustomMode 
                ? undefined 
                : prefs.comparisonMode === "book" && prefs.comparisonBook
                  ? getSportsbookById(prefs.comparisonBook)?.name || prefs.comparisonBook
                  : undefined
            }
            excludedBooks={prefs.selectedBooks}
            isCustomMode={isCustomMode}
            bankroll={evPrefs.bankroll}
            kellyPercent={evPrefs.kellyPercent || 25}
            boostPercent={boostPercent}
          />
      </div>

      {/* Gate banner for free users - below table */}
      {!effectiveIsPro && hiddenEdgeCount > 0 && !isLoading && (
        <div className="relative -mt-2 mb-4">
          {/* Gradient fade */}
          <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-transparent via-white/70 to-white dark:via-neutral-950/70 dark:to-neutral-950 pointer-events-none" />
          {/* Lock banner */}
          <div className="relative flex flex-col items-center gap-4 py-8 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400">
              <LockIcon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-neutral-900 dark:text-white">
                {hiddenEdgeCount} More Edge{hiddenEdgeCount === 1 ? "" : "s"} Hidden
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">
                Free users can preview {FREE_EDGE_ROW_LIMIT} opportunities. Upgrade to unlock all edges, custom models, and advanced filters.
              </p>
            </div>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400"
            >
              {isLoggedIn ? "Upgrade to Sharp" : "View Plans"}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* Load more button - pro only */}
      {effectiveIsPro && limit < 500 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setLimit(500)}
            className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
            disabled={isLoading || isFetching}
          >
            Load more results
          </button>
        </div>
      )}

      {/* Pro Upgrade CTA - full banner for free users */}
      {!effectiveIsPro && (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-sky-200/60 dark:border-sky-800/40 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 dark:from-sky-950/30 dark:via-neutral-900 dark:to-sky-950/20 p-4 shadow-sm sm:p-5">
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400">
                  <LockIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Unlock All Edge Finder Opportunities
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-200/80">
                    Free users can preview {FREE_EDGE_ROW_LIMIT} opportunities. Upgrade for full access to every edge, every sport.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-neutral-800 dark:text-neutral-100 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-sky-200/50 dark:border-sky-800/30 bg-white/80 px-3 py-1.5 shadow-sm dark:bg-sky-950/20 dark:border-sky-700/20">
                <Layers className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                <div>
                  <p className="font-semibold leading-none">Unlimited Edges</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Access every opportunity across all sports.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-sky-200/50 dark:border-sky-800/30 bg-white/80 px-3 py-1.5 shadow-sm dark:bg-sky-950/20 dark:border-sky-700/20">
                <Filter className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                <div>
                  <p className="font-semibold leading-none">Custom Filter Models</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Build your own comparison presets with custom books.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-sky-200/50 dark:border-sky-800/30 bg-white/80 px-3 py-1.5 shadow-sm dark:bg-sky-950/20 dark:border-sky-700/20">
                <Settings className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                <div>
                  <p className="font-semibold leading-none">Advanced Filters</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Fine-tune by odds range, liquidity, and more.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-sky-200/50 dark:border-sky-800/30 bg-white/80 px-3 py-1.5 shadow-sm dark:bg-sky-950/20 dark:border-sky-700/20">
                <Zap className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                <div>
                  <p className="font-semibold leading-none">Kelly Criterion Sizing</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Optimal bet sizing based on your bankroll.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-sky-500 bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-600 hover:border-sky-600 dark:border-sky-400 dark:bg-sky-500 dark:hover:bg-sky-400 dark:hover:border-sky-400"
              >
                {isLoggedIn ? "Upgrade to Sharp" : "View Plans"}
                <ArrowRight className="h-4 w-4" />
              </a>
              <span className="text-xs text-neutral-500 dark:text-neutral-300/70">
                Stop leaving edges on the table.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Player Quick View Modal */}
      {selectedPlayer && (
        <PlayerQuickViewModal
          odds_player_id={selectedPlayer.odds_player_id}
          player_name={selectedPlayer.player_name}
          initial_market={selectedPlayer.market}
          initial_line={selectedPlayer.line}
          event_id={selectedPlayer.event_id}
          odds={selectedPlayer.odds ?? undefined}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}

      {/* Preset Manager & Form Modals */}
      <FilterPresetsManagerModal
        open={showPresetManager}
        onOpenChange={setShowPresetManager}
        onCreateNew={() => {
          setShowPresetManager(false);
          setShowPresetForm(true);
        }}
      />
      <FilterPresetFormModal
        open={showPresetForm}
        onOpenChange={setShowPresetForm}
        onSuccess={() => refetch()}
      />
    </AppPageLayout>
  );
}

