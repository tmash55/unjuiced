"use client";

/**
 * Edge Finder V2 - Native implementation using v2 API
 * 
 * Uses native Opportunity types and components.
 * Shares preferences with V1 via useBestOddsPreferences.
 * 
 * URL: /edge-finder-v2
 */

import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { LoadingState } from "@/components/common/loading-state";

// V2 Native imports
import { useMultiFilterOpportunities } from "@/hooks/use-multi-filter-opportunities";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Shared preferences & V1 filters component
import { useBestOddsPreferences, useEvPreferences } from "@/context/preferences-context";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";

import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";
import { useHiddenEdges } from "@/hooks/use-hidden-edges";
import { FilterPresetsBar } from "@/components/filter-presets";
import { useFilterPresets } from "@/hooks/use-filter-presets";

// Available leagues for the filters component
const AVAILABLE_LEAGUES = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba", "soccer_epl"];

// Available markets (subset of common player props)
const AVAILABLE_MARKETS = [
  "player_points",
  "player_rebounds", 
  "player_assists",
  "pra",
  "player_threes",
  "player_steals",
  "player_blocks",
  "player_turnovers",
  "player_double_double",
  "player_triple_double",
  "passing_yards",
  "passing_touchdowns",
  "passing_completions",
  "passing_attempts",
  "passing_interceptions",
  "rushing_yards",
  "rushing_attempts",
  "rushing_touchdowns",
  "receiving_yards",
  "receptions",
  "receiving_touchdowns",
  "player_touchdowns",
  "player_anytime_td",
  "player_shots_on_goal",
  "player_goals",
  "player_assists_hockey",
  "player_points_hockey",
  "player_saves",
  "player_blocked_shots",
  "batter_hits",
  "batter_total_bases",
  "batter_rbis",
  "batter_runs_scored",
  "batter_home_runs",
  "batter_stolen_bases",
  "pitcher_strikeouts",
  "pitcher_hits_allowed",
  "pitcher_walks",
  "pitcher_outs",
];

/**
 * Map V2 preset back to V1 comparison mode
 */
function mapPresetToComparisonMode(preset: string): { mode: BestOddsPrefs['comparisonMode']; book: string | null } {
  if (preset === "average") {
    return { mode: "average", book: null };
  }
  // Assume it's a book ID
  return { mode: "book", book: preset };
}

export default function EdgeFinderV2Page() {
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
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
  const { activePresets, isLoading: presetsLoading } = useFilterPresets();
  
  // Local search state (debounced before saving to prefs)
  const [searchLocal, setSearchLocal] = useState(prefs.searchQuery || "");
  const [refreshing, setRefreshing] = useState(false);

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

  // Use multi-filter hook (handles multiple active presets, parallel fetching, deduplication)
  const {
    opportunities,
    activeFilters,
    isCustomMode,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMultiFilterOpportunities({
    prefs,
    activePresets,
    isPro: effectiveIsPro,
    limit,
    enabled: !planLoading && !prefsLoading && !presetsLoading,
  });

  // Apply hidden edges filter (must be done client-side due to user-specific state)
  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;

    // Hidden edges filter
    if (!prefs.showHidden) {
      filtered = filtered.filter((opp) => !isHidden(opp.id));
    }

    return filtered;
  }, [opportunities, prefs.showHidden, isHidden]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Handler for prefs changes from BestOddsFilters
  const handlePrefsChange = useCallback((newPrefs: BestOddsPrefs) => {
    updatePrefs({
      selectedBooks: newPrefs.selectedBooks,
      selectedLeagues: newPrefs.selectedLeagues,
      selectedMarkets: newPrefs.selectedMarkets,
      marketLines: newPrefs.marketLines, // Market-specific line filters (e.g., touchdowns: [0.5])
      minImprovement: newPrefs.minImprovement,
      maxOdds: newPrefs.maxOdds,
      minOdds: newPrefs.minOdds,
      hideCollegePlayerProps: newPrefs.hideCollegePlayerProps,
      comparisonMode: newPrefs.comparisonMode,
      comparisonBook: newPrefs.comparisonBook,
      searchQuery: newPrefs.searchQuery,
      showHidden: newPrefs.showHidden,
      columnOrder: newPrefs.columnOrder,
    });
  }, [updatePrefs]);

  // Kelly Criterion handlers
  const handleBankrollChange = useCallback((value: number) => {
    updateEvPrefs({ bankroll: value });
  }, [updateEvPrefs]);

  const handleKellyPercentChange = useCallback((value: number) => {
    updateEvPrefs({ kellyPercent: value });
  }, [updateEvPrefs]);

  // Handle column order changes
  const handleColumnOrderChange = useCallback((newOrder: string[]) => {
    updatePrefs({ columnOrder: newOrder });
  }, [updatePrefs]);

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
        <LoadingState message="Loading Edge Finder V2..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <ToolHeading>Edge Finder</ToolHeading>
          <ToolSubheading>
            {isLoading
            ? "Loading opportunities..."
            : isFetching
            ? "Updating opportunities..."
            : `${filteredOpportunities.length}+ opportunities found`}
          </ToolSubheading>
      </div>

      {/* Custom Filter Presets */}
      <FilterPresetsBar 
        className="mb-6" 
        onPresetsChange={() => refetch()}
      />

      {/* Filters Bar */}
      <div className="mb-6 relative z-10">
      <FiltersBar>
          <FiltersBarSection align="left">
          {/* Search */}
          <div className="relative">
              <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            <Input
              placeholder="Search players, teams..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              className="pl-9 w-64"
                disabled={locked}
            />
          </div>
          </FiltersBarSection>

          <FiltersBarSection align="right">
            {/* V1 BestOddsFilters component - handles all advanced filtering */}
            <BestOddsFilters
              prefs={prefs}
              onPrefsChange={handlePrefsChange}
              availableLeagues={AVAILABLE_LEAGUES}
              availableMarkets={AVAILABLE_MARKETS}
              availableSportsbooks={availableSportsbooks}
              deals={filteredOpportunities.map((opp) => ({
                bestBook: opp.bestBook,
                bestPrice: opp.bestDecimal,
                allBooks: opp.allBooks.map((b) => ({
                  book: b.book,
                  price: b.price,
                  link: b.link || "",
                })),
              }))}
              locked={locked}
              isLoggedIn={isLoggedIn}
              isPro={effectiveIsPro}
              refreshing={refreshing || isFetching}
              onRefresh={handleRefresh}
              hiddenCount={hiddenCount}
              showHidden={prefs.showHidden}
              onToggleShowHidden={handleToggleShowHidden}
              onClearAllHidden={clearAllHidden}
              customPresetActive={isCustomMode}
              activePresetName={activePresets.length > 0 ? activePresets.map(p => p.name).join(", ") : undefined}
              bankroll={evPrefs.bankroll}
              kellyPercent={evPrefs.kellyPercent}
              onBankrollChange={handleBankrollChange}
              onKellyPercentChange={handleKellyPercentChange}
            />
        </FiltersBarSection>
      </FiltersBar>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
          Error: {error.message}
        </div>
      )}

      {/* Table */}
      <OpportunitiesTable
        opportunities={filteredOpportunities}
        isLoading={isLoading}
        isFetching={isFetching || refreshing}
        isPro={effectiveIsPro}
        showEV={false}
        showHidden={prefs.showHidden}
        onHideEdge={hideEdge}
        onUnhideEdge={unhideEdge}
        isHidden={isHidden}
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
        columnOrder={prefs.columnOrder}
        onColumnOrderChange={handleColumnOrderChange}
      />

      {/* Load more button */}
      {limit < 500 && (
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

      {/* Pro Upgrade CTA */}
      {!effectiveIsPro && (
        <div className="text-center py-8 border-t">
          <p className="text-muted-foreground mb-2">
            {isLoggedIn 
              ? "Upgrade to Pro to unlock all opportunities and filters"
              : "Sign up for Pro to unlock all opportunities and filters"}
          </p>
          <a
            href="/pricing"
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium"
          >
            {isLoggedIn ? "Upgrade to Pro" : "View Plans"}
          </a>
        </div>
      )}
    </div>
  );
}
