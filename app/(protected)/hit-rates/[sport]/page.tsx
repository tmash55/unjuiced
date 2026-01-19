"use client";

import { useMemo, useState, use, useEffect, useCallback, useRef } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { GatedHitRateTable } from "@/components/hit-rates/gated-hit-rate-table";
import { GamesSidebar, hasGameStarted } from "@/components/hit-rates/games-sidebar";
import { GatedMobileHitRates } from "@/components/hit-rates/mobile/gated-mobile-hit-rates";
import { GlossaryModal, GlossaryButton } from "@/components/hit-rates/glossary-modal";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useNbaGames } from "@/hooks/use-nba-games";
import { useMediaQuery } from "@/hooks/use-media-query";

const SUPPORTED_SPORTS = ["nba"] as const;
const MARKET_OPTIONS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "player_points_rebounds_assists", label: "Points + Rebounds + Assists" },
  { value: "player_points_rebounds", label: "Points + Rebounds" },
  { value: "player_points_assists", label: "Points + Assists" },
  { value: "player_rebounds_assists", label: "Rebounds + Assists" },
  { value: "player_threes_made", label: "Three Pointers" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "Blocks + Steals" },
  { value: "player_turnovers", label: "Turnovers" },
];

// Debounce delay for market filter changes (ms)
const FILTER_DEBOUNCE_MS = 300;

// Pagination settings - Progressive loading for snappy UX
// OPTIMIZED: Load all player_points for today/tomorrow upfront for client-side sorting
const INITIAL_PAGE_SIZE = 500; // Load all player_points in one request
const BACKGROUND_PAGE_SIZE = 500; // Same size for consistency
const FULL_DATA_SIZE = 1500; // Full dataset for other markets

// Table display pagination - limit visible rows for performance
const TABLE_PAGE_SIZE = 150; // Show 150 rows at a time for better odds coverage
const TABLE_LOAD_MORE = 100; // Load 100 more when clicking "Show More"

// Memoized helper - normalize game IDs (remove leading zeros)
const normalizeGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  const idStr = String(id);
  return idStr.replace(/^0+/, "") || "0";
};

export default function HitRatesSportPage({ params }: { params: Promise<{ sport: string }> }) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase();
  if (!SUPPORTED_SPORTS.includes(sport as typeof SUPPORTED_SPORTS[number])) {
    notFound();
  }

  const router = useRouter();
  const searchParams = useSearchParams();

  // Detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Session storage key for filter state preservation
  const FILTER_STATE_KEY = "hit-rate-filter-state";

  // Restore filter state from sessionStorage on mount
  const getSavedFilterState = () => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem(FILTER_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse saved filter state:", e);
    }
    return null;
  };

  // Initialize state from sessionStorage if available
  const savedState = getSavedFilterState();

  // Let the API determine the best date (today, or next day with profiles if today has none)
  // Default to Points only, or restore from session
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    savedState?.selectedMarkets || ["player_points"]
  );
  
  // Search state - with debouncing for server-side search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Game filter state (multi-select)
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  
  // Desktop sort state (lifted up to persist across drilldown navigation)
  const [sortField, setSortField] = useState<"line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank" | null>(
    savedState?.sortField || "l10Pct"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    savedState?.sortDirection || "desc"
  );
  
  // Mobile-specific filter state (lifted up to persist across drilldown navigation)
  const [mobileSelectedMarkets, setMobileSelectedMarkets] = useState<string[]>(["player_points"]);
  const [mobileSortField, setMobileSortField] = useState("l10Pct_desc");
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileSelectedGameIds, setMobileSelectedGameIds] = useState<string[] | null>(null); // null = not initialized yet
  
  // Advanced filter state (shared between table and sidebar)
  // FIXED: Default to false so we show all players while odds are loading
  // Users can enable this filter once they see the data
  const [hideNoOdds, setHideNoOdds] = useState(false); // Default OFF - show all players, toggle to filter
  const [idsWithOdds, setIdsWithOdds] = useState<Set<string>>(new Set());
  
  // Glossary modal state
  const [showGlossary, setShowGlossary] = useState(false);
  
  // Sidebar collapse state - initialize from URL
  const sidebarParam = searchParams.get("sidebar");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarParam === "collapsed");
  
  // Toggle sidebar and persist to URL
  const toggleSidebar = useCallback(() => {
    const newCollapsedState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsedState);
    
    // Update URL with new sidebar state
    const newSearchParams = new URLSearchParams(searchParams);
    if (newCollapsedState) {
      newSearchParams.set("sidebar", "collapsed");
    } else {
      newSearchParams.delete("sidebar");
    }
    router.replace(`/hit-rates/${sport}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  }, [isSidebarCollapsed, searchParams, router, sport]);
  
  // Stable callback for odds availability changes to prevent infinite loops
  const handleOddsAvailabilityChange = useCallback((ids: Set<string>) => {
    setIdsWithOdds(ids);
  }, []);
  
  // Get game data to find dates
  const { games: allGames, primaryDate: apiPrimaryDate } = useNbaGames();
  
  // Default mobile to today's games on first load
  useEffect(() => {
    if (mobileSelectedGameIds === null && allGames && allGames.length > 0) {
      // Get today's date in ET
      const now = new Date();
      const etOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
      const todayET = now.toLocaleDateString('en-CA', etOptions);
      
      // Filter to today's games only
      const todayGames = allGames.filter(g => g.game_date === todayET);
      
      if (todayGames.length > 0) {
        setMobileSelectedGameIds(todayGames.map(g => g.game_id));
      } else {
        // No games today, show all games
        setMobileSelectedGameIds([]);
      }
    }
  }, [allGames, mobileSelectedGameIds]);
  
  // Ensure we always have an array to pass to children (not null)
  const effectiveMobileGameIds = mobileSelectedGameIds ?? [];
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Update selectedDate when selectedGameIds changes
  useEffect(() => {
    if (selectedGameIds.length > 0) {
      // Get all selected games
      const selectedGames = allGames.filter(g => 
        selectedGameIds.includes(String(g.game_id))
      );
      
      // Get unique dates from selected games
      const uniqueDates = new Set(selectedGames.map(g => g.game_date));
      
      if (uniqueDates.size > 1) {
        // Multiple dates selected - pass undefined so API fetches BOTH today and tomorrow
        setSelectedDate(undefined);
      } else if (uniqueDates.size === 1) {
        // Single date - use that date
        setSelectedDate(Array.from(uniqueDates)[0]);
      } else {
        // No valid games found, default to undefined
        setSelectedDate(undefined);
      }
    } else {
      // No games selected - pass undefined so API fetches BOTH today and tomorrow
      setSelectedDate(undefined);
    }
  }, [selectedGameIds, allGames]);
  
  // Player drill-down state
  const [selectedPlayer, setSelectedPlayer] = useState<HitRateProfile | null>(null);
  // Track the preferred market for drilldown - persists when switching players
  const [preferredMarket, setPreferredMarket] = useState<string | null>(null);
  
  // Table scroll ref
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  // Table display pagination - limit visible rows for performance
  const [visibleRowCount, setVisibleRowCount] = useState(TABLE_PAGE_SIZE);

  const toggleGame = useCallback((gameId: string) => {
    setSelectedGameIds((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  }, []);

  const selectAllGames = useCallback(() => {
    setSelectedGameIds([]);
  }, []);

  const selectTodaysGames = useCallback((gameIds: string[]) => {
    // Setting to empty array means "all games" (no filter)
    // But here we want to select specifically today's games
    setSelectedGameIds(gameIds);
  }, []);

  const clearGameSelection = useCallback(() => {
    setSelectedGameIds([]);
  }, []);

  // Sort change handler
  const handleSortChange = useCallback((field: typeof sortField, direction: typeof sortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Debounce search query for server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce mobile search query
  const [debouncedMobileSearch, setDebouncedMobileSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMobileSearch(mobileSearchQuery);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mobileSearchQuery]);

  // Pagination state - progressive loading
  const [hasLoadedBackground, setHasLoadedBackground] = useState(false);

  // When a player is selected (drilldown mode), we need ALL players for the sidebar
  // to show complete rosters for each game
  const isInDrilldown = selectedPlayer !== null;
  
  // Effective state based on viewport
  const effectiveSearch = isMobile ? debouncedMobileSearch : debouncedSearch;
  const effectiveGameIds = isMobile ? (mobileSelectedGameIds ?? []) : selectedGameIds;
  const effectiveSortChanged = isMobile 
    ? mobileSortField !== "l10Pct_desc" 
    : (sortField !== "l10Pct" || sortDirection !== "desc");
  
  // Check if specific games are selected (not "all games")
  const hasGameFilter = effectiveGameIds.length > 0;
  
  // Determine how much data to fetch:
  // - Drilldown, search, game filter, or custom sort: Need more data for complete/accurate view
  // - Background loaded: Use background data
  // - Initial load: Just 500 rows for snappy UX
  const needsFullData = isInDrilldown || effectiveSearch || hasGameFilter || effectiveSortChanged;

  // Calculate limit based on state
  const currentLimit = needsFullData 
    ? FULL_DATA_SIZE
    : hasLoadedBackground 
    ? BACKGROUND_PAGE_SIZE 
    : INITIAL_PAGE_SIZE;

  // Calculate date to fetch based on effective game IDs
  const [effectiveDate, setEffectiveDate] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (effectiveGameIds.length > 0) {
      const selectedGames = allGames.filter(g => 
        effectiveGameIds.includes(String(g.game_id))
      );
      const uniqueDates = new Set(selectedGames.map(g => g.game_date));
      
      if (uniqueDates.size === 1) {
        setEffectiveDate(Array.from(uniqueDates)[0]);
      } else {
        setEffectiveDate(undefined);
      }
    } else {
      setEffectiveDate(undefined);
    }
  }, [effectiveGameIds, allGames]);

  // When in drilldown mode, fetch BOTH days (undefined = today + tomorrow)
  const dateToFetch = isInDrilldown ? undefined : effectiveDate;

  const { rows, count, isLoading, isFetching, error, meta } = useHitRateTable({
    date: dateToFetch,
    limit: currentLimit,
    search: effectiveSearch || undefined,
    // Pass sort to API for server-side sorting (ensures we get true top N by sort field)
    sort: sortField || undefined,
    sortDir: sortDirection,
  });
  
  // Background loading is now on-demand only (via Load More button or sort changes)
  // This prevents duplicate API calls on initial page load

  // Reset background loading state when filters change
  useEffect(() => {
    setHasLoadedBackground(false);
  }, [selectedGameIds, debouncedSearch, mobileSelectedGameIds, debouncedMobileSearch]);

  // Reset visible row count when filters change (for table pagination)
  useEffect(() => {
    setVisibleRowCount(TABLE_PAGE_SIZE);
  }, [selectedMarkets, selectedGameIds, debouncedSearch, mobileSelectedMarkets, mobileSelectedGameIds, debouncedMobileSearch]);
  
  // The actual date being displayed (from API response)
  const displayDate = meta?.date;
  
  // Total available count from API
  const totalCount = count ?? 0;
  const hasMoreApiData = rows.length < totalCount && !hasLoadedBackground;

  // Save filter state to sessionStorage before navigating to drilldown
  const saveFilterState = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const state = {
        selectedMarkets,
        sortField,
        sortDirection,
        // Add more state if needed
      };
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save filter state:", e);
    }
  }, [selectedMarkets, sortField, sortDirection]);

  // Clear saved filter state after it's been restored
  useEffect(() => {
    if (savedState) {
      // Clear after a short delay to ensure state is applied
      const timer = setTimeout(() => {
        sessionStorage.removeItem(FILTER_STATE_KEY);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // Only run once on mount

  // Player drill-down handler for TABLE clicks - navigate to player page
  const handleTableRowClick = useCallback((player: HitRateProfile) => {
    // Save current filter state before navigating
    saveFilterState();
    // Navigate to player page with market and sidebar collapse state
    const params = new URLSearchParams({
      market: player.market,
      ...(isSidebarCollapsed && { sidebar: 'collapsed' }),
    });
    router.push(`/hit-rates/${sport}/player/${player.playerId}?${params.toString()}`);
  }, [router, sport, isSidebarCollapsed, saveFilterState]);

  // Player drill-down handler for SIDEBAR clicks - navigate with preferred market
  const handleSidebarPlayerSelect = useCallback((player: HitRateProfile) => {
    // Save current filter state before navigating
    saveFilterState();
    // Use preferred market if available, otherwise use the player's current market
    const marketToUse = preferredMarket || player.market;
    const params = new URLSearchParams({
      market: marketToUse,
      ...(isSidebarCollapsed && { sidebar: 'collapsed' }),
    });
    router.push(`/hit-rates/${sport}/player/${player.playerId}?${params.toString()}`);
  }, [router, sport, preferredMarket, isSidebarCollapsed, saveFilterState]);

  // Pre-compute normalized selected game IDs (avoids recalc in filter)
  const normalizedSelectedGameIds = useMemo(() => 
    selectedGameIds.map(normalizeGameId),
    [selectedGameIds]
  );

  // Pre-compute Set of started game IDs to filter from table (unless specific games selected)
  const startedGameIds = useMemo(() => {
    if (!allGames) return new Set<string>();
    return new Set(
      allGames
        .filter(game => hasGameStarted(game))
        .map(game => normalizeGameId(game.game_id))
    );
  }, [allGames]);

  // Client-side filtering: markets + game filter (search is server-side)
  const filteredRows = useMemo(() => {
    // First: exclude records with no betting line (null line = no actionable data)
    let result = rows.filter((row: HitRateProfile) => row.line !== null);
    
    // Filter by selected markets (instant, no API call)
    if (selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length) {
      result = result.filter((row: HitRateProfile) => 
        selectedMarkets.includes(row.market)
      );
    } else if (selectedMarkets.length === 0) {
      return []; // No markets selected = show nothing (early return)
    }
    
    // Filter by selected games (if any specific games selected)
    if (normalizedSelectedGameIds.length > 0) {
      result = result.filter((row: HitRateProfile) => {
        if (!row.gameId) return false;
        return normalizedSelectedGameIds.includes(normalizeGameId(row.gameId));
      });
    } else {
      // No specific games selected - hide players from games that have already started
      result = result.filter((row: HitRateProfile) => {
        if (!row.gameId) return true; // Keep rows without gameId
        return !startedGameIds.has(normalizeGameId(row.gameId));
      });
    }
    
    return result;
  }, [rows, selectedMarkets, normalizedSelectedGameIds, startedGameIds]);

  // Only show full loading state on initial load, not on filter changes
  const showLoadingState = isLoading && rows.length === 0;

  // Paginate filtered rows for display (performance optimization)
  const paginatedRows = useMemo(() => 
    filteredRows.slice(0, visibleRowCount),
    [filteredRows, visibleRowCount]
  );
  // Show "Load More" if there are more client rows OR more API data available
  const hasMoreRows = filteredRows.length > visibleRowCount || hasMoreApiData;
  
  // Load more handler - fetches more from API if needed
  const handleLoadMore = useCallback(() => {
    // If we have more client-side rows to show, show them first
    if (filteredRows.length > visibleRowCount) {
      setVisibleRowCount(prev => prev + TABLE_LOAD_MORE);
    } 
    // Otherwise, trigger API fetch for more data
    else if (hasMoreApiData) {
      setHasLoadedBackground(true);
    }
  }, [filteredRows.length, visibleRowCount, hasMoreApiData]);

  // Mobile filtered rows - apply started games filter to match desktop behavior
  // Mobile does its own market/game filtering internally, but we pre-filter started games
  const mobileFilteredRows = useMemo(() => {
    // First: exclude records with no betting line
    let result = rows.filter((row: HitRateProfile) => row.line !== null);
    
    // If specific games are selected on mobile, don't filter started games (user explicitly selected them)
    if (effectiveMobileGameIds.length > 0) {
      return result;
    }
    
    // No games selected - filter out players from games that have already started
    return result.filter((row: HitRateProfile) => {
      if (!row.gameId) return true;
      return !startedGameIds.has(normalizeGameId(row.gameId));
    });
  }, [rows, effectiveMobileGameIds, startedGameIds]);

  // Mobile Layout
  if (isMobile) {
    
    return (
      <GatedMobileHitRates
        rows={mobileFilteredRows}
        games={allGames ?? []}
        loading={isLoading}
        error={error?.message}
        onPlayerClick={handleTableRowClick}
        selectedMarkets={mobileSelectedMarkets}
        onMarketsChange={setMobileSelectedMarkets}
        sortField={mobileSortField}
        onSortChange={setMobileSortField}
        searchQuery={mobileSearchQuery}
        onSearchChange={setMobileSearchQuery}
        selectedGameIds={effectiveMobileGameIds}
        onGameIdsChange={setMobileSelectedGameIds}
        startedGameIds={startedGameIds}
        hideNoOdds={hideNoOdds}
        onHideNoOddsChange={setHideNoOdds}
      />
    );
  }

  // Desktop Layout
  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header with Glossary */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          NBA Hit Rates
        </h1>
        <GlossaryButton onClick={() => setShowGlossary(true)} />
      </div>

      {/* Glossary Modal */}
      <GlossaryModal isOpen={showGlossary} onClose={() => setShowGlossary(false)} />

      {/* Games Sidebar + Table/Drilldown Row */}
      <div className="flex gap-6 h-[calc(100vh-140px)] overflow-hidden">
        {/* Games Sidebar - collapsible */}
        <GamesSidebar 
          selectedGameIds={selectedGameIds}
          onToggleGame={toggleGame}
          onSelectAll={selectAllGames}
          onSelectTodaysGames={selectTodaysGames}
          onClearAll={clearGameSelection}
          selectedPlayer={null}
          gamePlayers={undefined}
          onPlayerSelect={handleSidebarPlayerSelect}
          hideNoOdds={hideNoOdds}
          idsWithOdds={idsWithOdds}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Hit Rate Table */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto">
          <GatedHitRateTable 
              rows={paginatedRows} 
              loading={showLoadingState} 
              error={error?.message}
              onRowClick={handleTableRowClick}
              hasMore={hasMoreRows}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && rows.length > 0}
              totalCount={filteredRows.length}
              selectedMarkets={selectedMarkets}
              onMarketsChange={setSelectedMarkets}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              scrollRef={tableScrollRef as React.RefObject<HTMLDivElement>}
              hideNoOdds={hideNoOdds}
              onHideNoOddsChange={setHideNoOdds}
              onOddsAvailabilityChange={handleOddsAvailabilityChange}
            />
        </div>
      </div>
    </div>
  );
}
