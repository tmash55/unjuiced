"use client";

import { useMemo, useState, use, useEffect, useCallback, useRef } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { GatedHitRateTable } from "@/components/hit-rates/gated-hit-rate-table";
import { GamesFilterDropdown, hasGameStarted } from "@/components/hit-rates/games-filter-dropdown";
import { GatedMobileHitRates } from "@/components/hit-rates/mobile/gated-mobile-hit-rates";
import { GlossaryModal, GlossaryButton } from "@/components/hit-rates/glossary-modal";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useNbaGames } from "@/hooks/use-nba-games";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AppPageLayout } from "@/components/layout/app-page-layout";

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
const INITIAL_PAGE_SIZE = 500;
const BACKGROUND_PAGE_SIZE = 500;
const FULL_DATA_SIZE = 1500;

// Table display pagination - limit visible rows for performance
const TABLE_PAGE_SIZE = 150;
const TABLE_LOAD_MORE = 100;

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

  // Market filter state
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    savedState?.selectedMarkets || ["player_points"]
  );
  
  // Search state - with debouncing for server-side search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Game filter state (multi-select) - null means not yet initialized
  const [selectedGameIds, setSelectedGameIds] = useState<string[] | null>(null);
  
  // Desktop sort state
  const [sortField, setSortField] = useState<"line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank" | null>(
    savedState?.sortField || "l10Pct"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    savedState?.sortDirection || "desc"
  );
  
  // Mobile-specific filter state
  const [mobileSelectedMarkets, setMobileSelectedMarkets] = useState<string[]>(["player_points"]);
  const [mobileSortField, setMobileSortField] = useState("l10Pct_desc");
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileSelectedGameIds, setMobileSelectedGameIds] = useState<string[] | null>(null);
  
  // Advanced filter state
  const [hideNoOdds, setHideNoOdds] = useState(false);
  const [idsWithOdds, setIdsWithOdds] = useState<Set<string>>(new Set());
  
  // Glossary modal state
  const [showGlossary, setShowGlossary] = useState(false);
  
  // Stable callback for odds availability changes
  const handleOddsAvailabilityChange = useCallback((ids: Set<string>) => {
    setIdsWithOdds(ids);
  }, []);
  
  // Get game data
  const { games: allGames, primaryDate: apiPrimaryDate } = useNbaGames();
  
  // Default to today's games on first load (both desktop and mobile)
  useEffect(() => {
    if (allGames && allGames.length > 0) {
      const now = new Date();
      const etOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
      const todayET = now.toLocaleDateString('en-CA', etOptions);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowET = tomorrow.toLocaleDateString('en-CA', etOptions);

      const todayGames = allGames.filter(g => g.game_date === todayET);
      const todayUpcomingGames = todayGames.filter(g => !hasGameStarted(g));
      const tomorrowGames = allGames.filter(g => g.game_date === tomorrowET);

      const defaultGameIds = todayUpcomingGames.length > 0
        ? todayUpcomingGames.map(g => g.game_id)
        : tomorrowGames.length > 0
        ? tomorrowGames.map(g => g.game_id)
        : [];
      
      // Initialize desktop if not yet set
      if (selectedGameIds === null) {
        setSelectedGameIds(defaultGameIds);
      }
      
      // Initialize mobile if not yet set
      if (mobileSelectedGameIds === null) {
        setMobileSelectedGameIds(defaultGameIds);
      }
    }
  }, [allGames, selectedGameIds, mobileSelectedGameIds]);
  
  // Effective game IDs (fallback to empty array if not yet initialized)
  const effectiveDesktopGameIds = selectedGameIds ?? [];
  const effectiveMobileGameIds = mobileSelectedGameIds ?? [];
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Update selectedDate when selectedGameIds changes
  useEffect(() => {
    if (effectiveDesktopGameIds.length > 0) {
      const selectedGames = allGames.filter(g => 
        effectiveDesktopGameIds.includes(String(g.game_id))
      );
      const uniqueDates = new Set(selectedGames.map(g => g.game_date));
      
      if (uniqueDates.size > 1) {
        setSelectedDate(undefined);
      } else if (uniqueDates.size === 1) {
        setSelectedDate(Array.from(uniqueDates)[0]);
      } else {
        setSelectedDate(undefined);
      }
    } else {
      setSelectedDate(undefined);
    }
  }, [effectiveDesktopGameIds, allGames]);
  
  // Player drill-down state
  const [selectedPlayer, setSelectedPlayer] = useState<HitRateProfile | null>(null);
  const [preferredMarket, setPreferredMarket] = useState<string | null>(null);
  
  // Table scroll ref
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  // Table display pagination
  const [visibleRowCount, setVisibleRowCount] = useState(TABLE_PAGE_SIZE);

  const toggleGame = useCallback((gameId: string) => {
    const normalizedId = normalizeGameId(gameId);
    setSelectedGameIds((prev) => {
      const currentIds = prev ?? [];
      // Check if already selected (compare normalized)
      const isCurrentlySelected = currentIds.some(id => normalizeGameId(id) === normalizedId);
      if (isCurrentlySelected) {
        // Remove it
        return currentIds.filter(id => normalizeGameId(id) !== normalizedId);
      } else {
        // Add it
        return [...currentIds, normalizedId];
      }
    });
  }, []);

  const selectAllGames = useCallback(() => {
    setSelectedGameIds([]);
  }, []);

  const selectTodaysGames = useCallback((gameIds: string[]) => {
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

  // Debounce search query
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

  const isInDrilldown = selectedPlayer !== null;
  
  // Effective state based on viewport
  const effectiveSearch = isMobile ? debouncedMobileSearch : debouncedSearch;
  const effectiveGameIds = isMobile ? effectiveMobileGameIds : effectiveDesktopGameIds;
  const effectiveSortChanged = isMobile 
    ? mobileSortField !== "l10Pct_desc" 
    : (sortField !== "l10Pct" || sortDirection !== "desc");
  
  const hasGameFilter = effectiveGameIds.length > 0;
  const needsFullData = isInDrilldown || effectiveSearch || hasGameFilter || effectiveSortChanged;

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

  const dateToFetch = isInDrilldown ? undefined : effectiveDate;

  const { rows, count, isLoading, isFetching, error, meta } = useHitRateTable({
    date: dateToFetch,
    limit: currentLimit,
    search: effectiveSearch || undefined,
    sort: sortField || undefined,
    sortDir: sortDirection,
  });

  // Reset background loading state when filters change
  useEffect(() => {
    setHasLoadedBackground(false);
  }, [selectedGameIds, debouncedSearch, mobileSelectedGameIds, debouncedMobileSearch]);

  // Reset visible row count when filters change
  useEffect(() => {
    setVisibleRowCount(TABLE_PAGE_SIZE);
  }, [selectedMarkets, selectedGameIds, debouncedSearch, mobileSelectedMarkets, mobileSelectedGameIds, debouncedMobileSearch]);
  
  const displayDate = meta?.date;
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
      };
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save filter state:", e);
    }
  }, [selectedMarkets, sortField, sortDirection]);

  // Clear saved filter state after it's been restored
  useEffect(() => {
    if (savedState) {
      const timer = setTimeout(() => {
        sessionStorage.removeItem(FILTER_STATE_KEY);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Player drill-down handler for TABLE clicks
  const handleTableRowClick = useCallback((player: HitRateProfile) => {
    saveFilterState();
    const params = new URLSearchParams({
      market: player.market,
    });
    router.push(`/hit-rates/${sport}/player/${player.playerId}?${params.toString()}`);
  }, [router, sport, saveFilterState]);

  // Pre-compute normalized selected game IDs
  const normalizedSelectedGameIds = useMemo(() => 
    effectiveDesktopGameIds.map(normalizeGameId),
    [effectiveDesktopGameIds]
  );

  // Pre-compute Set of started game IDs
  const startedGameIds = useMemo(() => {
    if (!allGames) return new Set<string>();
    return new Set(
      allGames
        .filter(game => hasGameStarted(game))
        .map(game => normalizeGameId(game.game_id))
    );
  }, [allGames]);

  // Client-side filtering: markets + game filter
  const filteredRows = useMemo(() => {
    let result = rows.filter((row: HitRateProfile) => row.line !== null);
    
    if (selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length) {
      result = result.filter((row: HitRateProfile) => 
        selectedMarkets.includes(row.market)
      );
    } else if (selectedMarkets.length === 0) {
      return [];
    }
    
    if (normalizedSelectedGameIds.length > 0) {
      result = result.filter((row: HitRateProfile) => {
        if (!row.gameId) return false;
        return normalizedSelectedGameIds.includes(normalizeGameId(row.gameId));
      });
    } else {
      result = result.filter((row: HitRateProfile) => {
        if (!row.gameId) return true;
        return !startedGameIds.has(normalizeGameId(row.gameId));
      });
    }
    
    return result;
  }, [rows, selectedMarkets, normalizedSelectedGameIds, startedGameIds]);

  const showLoadingState = isLoading && rows.length === 0;

  // Paginate filtered rows for display
  const paginatedRows = useMemo(() => 
    filteredRows.slice(0, visibleRowCount),
    [filteredRows, visibleRowCount]
  );
  
  const hasMoreRows = filteredRows.length > visibleRowCount || hasMoreApiData;
  
  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (filteredRows.length > visibleRowCount) {
      setVisibleRowCount(prev => prev + TABLE_LOAD_MORE);
    } else if (hasMoreApiData) {
      setHasLoadedBackground(true);
    }
  }, [filteredRows.length, visibleRowCount, hasMoreApiData]);

  // Mobile filtered rows
  const mobileFilteredRows = useMemo(() => {
    let result = rows.filter((row: HitRateProfile) => row.line !== null);
    
    if (effectiveMobileGameIds.length > 0) {
      return result;
    }
    
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

  // Desktop Layout - Using AppPageLayout
  return (
    <AppPageLayout
      title="NBA Hit Rates"
      subtitle="Analyze player prop performance with historical hit rates, streaks, and matchup data."
      headerActions={<GlossaryButton onClick={() => setShowGlossary(true)} />}
    >
      {/* Glossary Modal */}
      <GlossaryModal isOpen={showGlossary} onClose={() => setShowGlossary(false)} />

      {/* Hit Rate Table - with Games Filter passed as additional filter */}
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
        // Pass games filter props
        gamesFilter={
          <GamesFilterDropdown
            games={allGames ?? []}
            selectedGameIds={effectiveDesktopGameIds}
            onToggleGame={toggleGame}
            onSelectAll={selectAllGames}
          />
        }
      />
    </AppPageLayout>
  );
}
