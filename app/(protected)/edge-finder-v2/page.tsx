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
import { cn } from "@/lib/utils";
import { RefreshCw, Beaker } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { Tooltip } from "@/components/tooltip";

// V2 Native imports
import { useOpportunities } from "@/hooks/use-opportunities";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { type OpportunityFilters, type Sport, DEFAULT_FILTERS } from "@/lib/types/opportunities";

// Shared preferences & V1 filters component
import { useBestOddsPreferences } from "@/context/preferences-context";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";

import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";
import { useHiddenEdges } from "@/hooks/use-hidden-edges";

// Available leagues for the filters component
const AVAILABLE_LEAGUES = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba"];

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
 * Map V1 BestOddsPrefs to V2 OpportunityFilters
 */
function mapPrefsToFilters(prefs: BestOddsPrefs): OpportunityFilters {
  // Derive sports from selected leagues
  const leagueToSport: Record<string, Sport> = {
    nba: "nba",
    nfl: "nfl",
    ncaaf: "ncaaf",
    ncaab: "ncaab",
    nhl: "nhl",
    mlb: "mlb",
    wnba: "wnba",
  };
  
  // If no leagues selected (empty = all), use default sports (nba, nfl) for performance
  // Empty array in prefs means "all selected" in V1 - but querying all is slow
  // Default to NBA + NFL which is what V1 does in practice
  let sports: Sport[];
  if (prefs.selectedLeagues.length > 0) {
    sports = [...new Set(
      prefs.selectedLeagues
        .map(l => leagueToSport[l])
        .filter((s): s is Sport => !!s)
    )];
  } else {
    // Default to NBA and NFL when "all" is selected
    sports = ["nba", "nfl"];
  }

  // Map comparison mode to preset
  let preset: string = "average";
  if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
    preset = prefs.comparisonBook;
  } else if (prefs.comparisonMode === "average") {
    preset = "average";
  }
  // Note: next_best doesn't map to a preset, we'll handle it client-side

  return {
    ...DEFAULT_FILTERS,
    sports: sports.length > 0 ? sports : ["nba", "nfl"],
    preset,
    minEdge: prefs.minImprovement || 0,
    minOdds: prefs.minOdds ?? -500,
    maxOdds: prefs.maxOdds ?? 500,
    searchQuery: prefs.searchQuery || "",
    selectedBooks: prefs.selectedBooks || [],
    selectedMarkets: prefs.selectedMarkets || [],
    selectedLeagues: prefs.selectedLeagues || [],
    minBooksPerSide: 2,
  };
}

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

  // Sync local search with prefs on load
  useEffect(() => {
    setSearchLocal(prefs.searchQuery || "");
  }, [prefs.searchQuery]);

  // Debounce search updates to prefs
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchLocal !== (prefs.searchQuery || "")) {
        updatePrefs({ searchQuery: searchLocal });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchLocal, prefs.searchQuery, updatePrefs]);

  // Convert prefs to V2 filters
  const filters = useMemo(() => mapPrefsToFilters(prefs), [prefs]);

  // Use v2 hook
  const {
    opportunities,
    totalScanned,
    totalAfterFilters,
    timingMs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOpportunities({
    filters,
    isPro: effectiveIsPro,
    enabled: !planLoading && !prefsLoading,
  });

  // Apply client-side filters (search, hidden, books)
  const filteredOpportunities = useMemo(() => {
    let filtered = opportunities;

    // Search filter
    if (searchLocal.trim()) {
      const q = searchLocal.toLowerCase();
      filtered = filtered.filter(
        (opp) =>
          (opp.player || "").toLowerCase().includes(q) ||
          (opp.homeTeam || "").toLowerCase().includes(q) ||
          (opp.awayTeam || "").toLowerCase().includes(q) ||
          (opp.market || "").toLowerCase().includes(q)
      );
    }

    // Hidden edges filter
    if (!prefs.showHidden) {
      filtered = filtered.filter((opp) => !isHidden(opp.id));
    }

    // Book filter (client-side since API doesn't support it)
    if (prefs.selectedBooks.length > 0) {
      filtered = filtered.filter((opp) => prefs.selectedBooks.includes(opp.bestBook));
    }

    // College player props filter
    if (prefs.hideCollegePlayerProps) {
      filtered = filtered.filter((opp) => {
        const isCollege = opp.sport === "ncaaf" || opp.sport === "ncaab";
        // Allow game markets for college, just filter player props
        const isPlayerProp = opp.player && opp.player !== "game";
        return !(isCollege && isPlayerProp);
      });
    }

    return filtered;
  }, [opportunities, searchLocal, prefs.showHidden, prefs.selectedBooks, prefs.hideCollegePlayerProps, isHidden]);

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
        <LoadingState text="Loading Edge Finder V2..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* V2 Test Banner */}
      <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <Beaker className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-500">V2 Native Mode</p>
          <p className="text-xs text-muted-foreground truncate">
            Using native components with /api/v2/opportunities. Compare to{" "}
            <a href="/edge-finder" className="underline text-primary">
              /edge-finder (v1)
            </a>
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <p>Scanned: {totalScanned.toLocaleString()}</p>
          <p>
            After filters: {totalAfterFilters.toLocaleString()}{" "}
            {totalAfterFilters > 500 && <span className="text-amber-500">(limit: 500)</span>}
          </p>
          <p>Timing: {timingMs}ms</p>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ToolHeading>Edge Finder</ToolHeading>
          <Tooltip content={effectiveIsPro ? "Refresh data" : "Pro only"}>
            <button
              onClick={handleRefresh}
              disabled={refreshing || isLoading || !effectiveIsPro}
              className={cn(
                "p-2 rounded-md border transition-colors",
                "hover:bg-muted/50 disabled:opacity-50"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", (refreshing || isFetching) && "animate-spin")} />
            </button>
          </Tooltip>
        </div>
        <ToolSubheading>
          {isLoading
            ? "Loading opportunities..."
            : `${filteredOpportunities.length} opportunities found`}
        </ToolSubheading>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 relative z-10">
        <FiltersBar>
          <FiltersBarSection>
            {/* Search */}
            <div className="relative">
              <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players, teams..."
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
                className="pl-9 w-64"
                disabled={locked}
              />
            </div>

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
        isPro={effectiveIsPro}
        showEV={false}
        showHidden={prefs.showHidden}
        onHideEdge={hideEdge}
        onUnhideEdge={unhideEdge}
        isHidden={isHidden}
      />

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
