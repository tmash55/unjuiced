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
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { LoadingState } from "@/components/common/loading-state";
import { Zap, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Native imports
import { useMultiFilterOpportunities } from "@/hooks/use-multi-filter-opportunities";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { MobileEdgeFinder } from "@/components/opportunities/mobile";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Shared preferences & filters component
import { useBestOddsPreferences, useEvPreferences } from "@/context/preferences-context";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";

import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";
import { useHiddenEdges } from "@/hooks/use-hidden-edges";
import { useIsMobile } from "@/hooks/use-media-query";
import { FilterPresetsBar } from "@/components/filter-presets";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import type { BestOddsData } from "@/components/odds-screen/types/odds-screen-types";

// Available leagues for the filters component
const AVAILABLE_LEAGUES = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba", "soccer_epl"];

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
  const isMobile = useIsMobile();
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

  // Use multi-filter hook (handles multiple active presets, parallel fetching, deduplication)
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
    });
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
          opportunities={filteredOpportunities}
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
          onPrefsChange={(newPrefs) => handlePrefsChange({ 
            ...newPrefs, 
            columnOrder: newPrefs.columnOrder ?? [] 
          })}
          availableLeagues={AVAILABLE_LEAGUES}
          availableMarkets={AVAILABLE_MARKETS}
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

  // Desktop View
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <ToolHeading>Edge Finder</ToolHeading>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ToolSubheading>
              {isLoading
              ? "Loading opportunities..."
              : isFetching && !isLoadingMore
              ? "Updating opportunities..."
              : `${filteredOpportunities.length}+ opportunities found`}
            </ToolSubheading>
            {/* Progressive Loading Indicator - Billion Dollar UX */}
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
          </div>
          {/* Freshness Indicator - Right aligned */}
          {dataUpdatedAt && !isLoading && !isLoadingMore && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              <span>Updated {formatTimeAgo(dataUpdatedAt)}</span>
              {isFetching && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Filter Presets */}
      <FilterPresetsBar 
        className="mb-6" 
        onPresetsChange={() => refetch()}
        onPresetHover={prefetchPreset}
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

          {/* Profit Boost Selector */}
          <div className="relative group">
            <div className="flex items-center gap-1">
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  boostPercent > 0
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
                onClick={() => {
                  // Toggle dropdown by focusing the select
                  const select = document.getElementById('boost-select') as HTMLSelectElement;
                  if (select) select.click();
                }}
              >
                <Zap className={cn("w-4 h-4", boostPercent > 0 && "text-amber-500")} />
                <span>{boostPercent > 0 ? `+${boostPercent}% Boost` : "Boost"}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {boostPercent > 0 && (
                <button
                  onClick={() => setBoostPercent(0)}
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  title="Clear boost"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all z-50">
              <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2 min-w-[180px]">
                <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-2 py-1 mb-1">
                  Profit Boost %
                </p>
                {/* Preset options */}
                <div className="space-y-0.5 mb-2">
                  {[0, 10, 20, 25, 30, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setBoostPercent(pct)}
                      className={cn(
                        "w-full px-2 py-1.5 rounded text-left text-sm transition-colors",
                        boostPercent === pct
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      )}
                    >
                      {pct === 0 ? "No Boost" : `+${pct}%`}
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-2">
                  <label className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-2">
                    Custom %
                  </label>
                  <div className="flex items-center gap-1 px-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      placeholder="0"
                      value={boostPercent || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBoostPercent(Math.min(200, Math.max(0, val)));
                      }}
                      className="w-20 h-8 text-sm"
                    />
                    <span className="text-sm text-neutral-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </FiltersBarSection>

          <FiltersBarSection align="right">
            {/* BestOddsFilters component - handles all advanced filtering */}
            <BestOddsFilters
              prefs={{
                ...prefs,
                columnOrder: ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'],
              }}
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
    </div>
  );
}

