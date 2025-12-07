"use client";

import { useMemo, useState, use, useEffect, useCallback, useRef } from "react";
import { notFound } from "next/navigation";
import { HitRateTable } from "@/components/hit-rates/hit-rate-table";
import { GamesSidebar, hasGameStarted } from "@/components/hit-rates/games-sidebar";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { MobileHitRates } from "@/components/hit-rates/mobile/mobile-hit-rates";
import { MobilePlayerDrilldown } from "@/components/hit-rates/mobile/mobile-player-drilldown";
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
const INITIAL_PAGE_SIZE = 500; // Fast initial load - enough for all markets across multiple games
const BACKGROUND_PAGE_SIZE = 10000; // Load rest in background
const FULL_DATA_SIZE = 15000; // Load all when in drilldown or filtering

// Table display pagination - limit visible rows for performance
const TABLE_PAGE_SIZE = 100; // Show 100 rows at a time
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

  // Detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Let the API determine the best date (today, or next day with profiles if today has none)
  // Default to Points only
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    ["player_points"]
  );
  
  // Search state - with debouncing for server-side search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Game filter state (multi-select)
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  
  // Desktop sort state (lifted up to persist across drilldown navigation)
  const [sortField, setSortField] = useState<"line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank" | null>("l10Pct");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Mobile-specific filter state (lifted up to persist across drilldown navigation)
  const [mobileSelectedMarkets, setMobileSelectedMarkets] = useState<string[]>(["player_points"]);
  const [mobileSortField, setMobileSortField] = useState("l10Pct_desc");
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileSelectedGameIds, setMobileSelectedGameIds] = useState<string[]>([]);
  
  // Advanced filter state (shared between table and sidebar)
  const [hideNoOdds, setHideNoOdds] = useState(false);
  const [idsWithOdds, setIdsWithOdds] = useState<Set<string>>(new Set());
  
  // Stable callback for odds availability changes to prevent infinite loops
  const handleOddsAvailabilityChange = useCallback((ids: Set<string>) => {
    setIdsWithOdds(ids);
  }, []);
  
  // Get game data to find dates
  const { games: allGames, primaryDate: apiPrimaryDate } = useNbaGames();
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
  
  // Scroll position restoration - save position when entering drilldown
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);
  
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

  const handleBackToTable = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  // Sort change handler
  const handleSortChange = useCallback((field: typeof sortField, direction: typeof sortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Escape key to exit drilldown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPlayer) {
        setSelectedPlayer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlayer]);

  // Debounce search query for server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pagination state - progressive loading
  const [hasLoadedBackground, setHasLoadedBackground] = useState(false);

  // When a player is selected (drilldown mode), we need ALL players for the sidebar
  // to show complete rosters for each game
  const isInDrilldown = selectedPlayer !== null;
  
  // Check if specific games are selected (not "all games")
  const hasGameFilter = selectedGameIds.length > 0;
  
  // Check if markets are filtered (not all selected)
  const hasMarketFilter = selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length;

  // Determine how much data to fetch:
  // - User interaction (drilldown, search, filter): Full data immediately
  // - Background loaded: Use background data
  // - Initial load: Just 50 rows for snappy UX
  const needsFullData = isInDrilldown || debouncedSearch || hasGameFilter || hasMarketFilter;

  // Calculate limit based on state
  const currentLimit = needsFullData 
    ? FULL_DATA_SIZE 
    : hasLoadedBackground 
      ? BACKGROUND_PAGE_SIZE 
      : INITIAL_PAGE_SIZE;

  // When in drilldown mode, fetch BOTH days (undefined = today + tomorrow)
  // When a specific game is selected (not drilldown), fetch just that date
  const dateToFetch = isInDrilldown ? undefined : selectedDate;

  const { rows, count, isLoading, isFetching, error, meta } = useHitRateTable({
    date: dateToFetch,
    limit: currentLimit,
    search: debouncedSearch || undefined,
  });
  
  // Background fetch: After initial 50 load, automatically load more data
  useEffect(() => {
    if (!isLoading && rows.length > 0 && !hasLoadedBackground && !needsFullData) {
      // Initial load completed, trigger background fetch after a short delay
      const timer = setTimeout(() => {
        setHasLoadedBackground(true);
      }, 100); // Small delay to let UI render first
      return () => clearTimeout(timer);
    }
  }, [isLoading, rows.length, hasLoadedBackground, needsFullData]);

  // Reset background loading state when filters change
  useEffect(() => {
    setHasLoadedBackground(false);
  }, [selectedGameIds, debouncedSearch]);

  // Reset visible row count when filters change (for table pagination)
  useEffect(() => {
    setVisibleRowCount(TABLE_PAGE_SIZE);
  }, [selectedMarkets, selectedGameIds, debouncedSearch]);
  
  // The actual date being displayed (from API response)
  const displayDate = meta?.date;
  
  // Total available count from API
  const totalCount = count ?? 0;
  const hasMoreData = rows.length < totalCount && !hasLoadedBackground;
  
  // Load more handler for API data (background loading)
  const handleLoadMoreData = useCallback(() => {
    setHasLoadedBackground(true);
  }, []);

  // Show more handler for table pagination (UI only)
  const handleShowMoreRows = useCallback(() => {
    setVisibleRowCount(prev => prev + TABLE_LOAD_MORE);
  }, []);

  // Player drill-down handler for TABLE clicks - always use exact profile clicked
  const handleTableRowClick = useCallback((player: HitRateProfile) => {
    // Save scroll position before entering drilldown
    if (tableScrollRef.current) {
      setSavedScrollPosition(tableScrollRef.current.scrollTop);
    }
    // Reset search when entering drilldown
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedPlayer(player);
    setPreferredMarket(player.market);
  }, []);

  // Player drill-down handler for SIDEBAR clicks - try to keep same market
  const handleSidebarPlayerSelect = useCallback((player: HitRateProfile) => {
    // When switching players from sidebar, try to find a profile with the same market
    // This allows the user to stay on the same market when browsing players
    if (preferredMarket && rows.length > 0) {
      const sameMarketProfile = rows.find(
        r => r.playerId === player.playerId && r.market === preferredMarket
      );
      if (sameMarketProfile) {
        setSelectedPlayer(sameMarketProfile);
        return;
      }
      
      // Preferred market not available - fall back to Points market
      const pointsProfile = rows.find(
        r => r.playerId === player.playerId && r.market === "player_points"
      );
      if (pointsProfile) {
        setSelectedPlayer(pointsProfile);
        setPreferredMarket("player_points");
        return;
      }
    }
    // Final fallback: use the clicked profile and update preferred market
    setSelectedPlayer(player);
    setPreferredMarket(player.market);
  }, [preferredMarket, rows]);

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
    let result = rows;
    
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
  const hasMoreRows = filteredRows.length > visibleRowCount;

  // Get all profiles for the selected player (all their different markets)
  const selectedPlayerAllProfiles = useMemo(() => {
    if (!selectedPlayer) return [];
    return rows.filter(r => r.playerId === selectedPlayer.playerId);
  }, [rows, selectedPlayer]);

  // Mobile Layout
  if (isMobile) {
    // Show mobile drilldown if a player is selected
    if (selectedPlayer) {
      return (
        <MobilePlayerDrilldown 
          profile={selectedPlayer} 
          allPlayerProfiles={selectedPlayerAllProfiles}
          onBack={handleBackToTable} 
          onMarketChange={setPreferredMarket}
        />
      );
    }
    
    return (
      <MobileHitRates
        rows={rows}
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
        selectedGameIds={mobileSelectedGameIds}
        onGameIdsChange={setMobileSelectedGameIds}
        startedGameIds={startedGameIds}
      />
    );
  }

  // Desktop Layout
  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
        NBA Hit Rates
      </h1>

      {/* Games Sidebar + Table/Drilldown Row */}
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Games Sidebar - always visible */}
        <GamesSidebar 
          selectedGameIds={selectedGameIds}
          onToggleGame={toggleGame}
          onSelectAll={selectAllGames}
          onSelectTodaysGames={selectTodaysGames}
          onClearAll={clearGameSelection}
          selectedPlayer={selectedPlayer}
          gamePlayers={selectedPlayer ? rows : undefined}
          onPlayerSelect={handleSidebarPlayerSelect}
          hideNoOdds={hideNoOdds}
          idsWithOdds={idsWithOdds}
        />

        {/* Table or Player Drill-down */}
        <div className="w-[80%] min-w-0 h-full">
          {selectedPlayer ? (
            <PlayerDrilldown 
              profile={selectedPlayer} 
              allPlayerProfiles={selectedPlayerAllProfiles}
              onBack={handleBackToTable} 
              onMarketChange={setPreferredMarket}
            />
          ) : (
            <HitRateTable 
              rows={paginatedRows} 
              loading={showLoadingState} 
              error={error?.message}
              onRowClick={handleTableRowClick}
              hasMore={hasMoreRows}
              onLoadMore={handleShowMoreRows}
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
              initialScrollTop={savedScrollPosition}
              hideNoOdds={hideNoOdds}
              onHideNoOddsChange={setHideNoOdds}
              onOddsAvailabilityChange={handleOddsAvailabilityChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

