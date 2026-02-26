"use client";

import { useMemo, useState, use, useEffect, useCallback, useRef } from "react";
import { notFound, useRouter } from "next/navigation";
import { GatedHitRateTable } from "@/components/hit-rates/gated-hit-rate-table";
import { GamesFilterDropdown, hasGameStarted } from "@/components/hit-rates/games-filter-dropdown";
import { GatedMobileHitRates } from "@/components/hit-rates/mobile/gated-mobile-hit-rates";
import { GlossaryModal, GlossaryButton } from "@/components/hit-rates/glossary-modal";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useNbaGames } from "@/hooks/use-nba-games";
import { useMlbGames } from "@/hooks/use-mlb-games";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AppPageLayout } from "@/components/layout/app-page-layout";

const SUPPORTED_SPORTS = ["nba", "mlb"] as const;
type SupportedSport = (typeof SUPPORTED_SPORTS)[number];

const SPORT_CONFIG: Record<
  SupportedSport,
  {
    title: string;
    subtitle: string;
    defaultMarket: string;
    markets: Array<{ value: string; label: string }>;
  }
> = {
  nba: {
    title: "NBA Hit Rates",
    subtitle: "Analyze player prop performance with historical hit rates, streaks, and matchup data.",
    defaultMarket: "player_points",
    markets: [
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
    ],
  },
  mlb: {
    title: "MLB Hit Rates",
    subtitle: "Analyze MLB batter and pitcher prop hit rates with recent trends and matchup context.",
    defaultMarket: "player_hits",
    markets: [
      { value: "player_hits", label: "Hits" },
      { value: "player_home_runs", label: "Home Runs" },
      { value: "player_runs_scored", label: "Runs" },
      { value: "player_rbi", label: "RBIs" },
      { value: "player_total_bases", label: "Total Bases" },
      { value: "pitcher_strikeouts", label: "Pitcher Strikeouts" },
    ],
  },
};

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
  const sport = resolvedParams.sport?.toLowerCase() as SupportedSport;
  if (!SUPPORTED_SPORTS.includes(sport)) {
    notFound();
  }
  const sportConfig = SPORT_CONFIG[sport];

  const router = useRouter();

  // Detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Session storage key for filter state preservation (sport-scoped)
  const FILTER_STATE_KEY = `hit-rate-filter-state:${sport}`;

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
    savedState?.selectedMarkets || [sportConfig.defaultMarket]
  );
  
  // Search state - with debouncing for server-side search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Game filter state (multi-select) - null means not yet initialized
  const [selectedGameIds, setSelectedGameIds] = useState<string[] | null>(
    savedState?.selectedGameIds ?? null
  );
  
  // Desktop sort state
  const [sortField, setSortField] = useState<"line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank" | null>(
    savedState?.sortField || "l10Pct"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    savedState?.sortDirection || "desc"
  );
  
  // Mobile-specific filter state
  const [mobileSelectedMarkets, setMobileSelectedMarkets] = useState<string[]>([
    sportConfig.defaultMarket,
  ]);
  const [mobileSortField, setMobileSortField] = useState(
    savedState?.mobileSortField || "l10Pct_desc"
  );
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileSelectedGameIds, setMobileSelectedGameIds] = useState<string[] | null>(
    savedState?.mobileSelectedGameIds ?? null
  );
  
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
  const nbaGamesQuery = useNbaGames(sport === "nba");
  const mlbGamesQuery = useMlbGames(sport === "mlb");
  const allGames = sport === "mlb" ? mlbGamesQuery.games : nbaGamesQuery.games;
  const apiPrimaryDate = sport === "mlb" ? mlbGamesQuery.primaryDate : nbaGamesQuery.primaryDate;

  // Ensure selected markets are valid for the active sport
  useEffect(() => {
    const validMarkets = new Set(sportConfig.markets.map((m) => m.value));

    setSelectedMarkets((prev) => {
      const next = prev.filter((m) => validMarkets.has(m));
      return next.length > 0 ? next : [sportConfig.defaultMarket];
    });

    setMobileSelectedMarkets((prev) => {
      const next = prev.filter((m) => validMarkets.has(m));
      return next.length > 0 ? next : [sportConfig.defaultMarket];
    });
  }, [sportConfig]);
  
  // Default game filter on first load.
  // NBA: preselect next game day.
  // MLB: default to "All Games" to avoid empty-state when a single matchup has no profiles yet.
  useEffect(() => {
    if (allGames && allGames.length > 0) {
      if (sport === "mlb") {
        if (selectedGameIds === null) {
          setSelectedGameIds([]);
        }

        if (mobileSelectedGameIds === null) {
          setMobileSelectedGameIds([]);
        }
        return;
      }

      const sortedGames = [...allGames].sort((a, b) => {
        const dateCompare = (a.game_date || "").localeCompare(b.game_date || "");
        if (dateCompare !== 0) return dateCompare;
        return String(a.game_id).localeCompare(String(b.game_id));
      });

      const upcomingGames = sortedGames.filter((game) => !hasGameStarted(game));
      const nextGameDate = upcomingGames[0]?.game_date ?? sortedGames[0]?.game_date;
      const defaultGameIds = nextGameDate
        ? sortedGames
            .filter((game) => game.game_date === nextGameDate)
            .map((game) => String(game.game_id))
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
  }, [allGames, mobileSelectedGameIds, selectedGameIds, sport]);

  // Remove stale selected game IDs that are not in the current sport's game list
  useEffect(() => {
    if (!allGames || allGames.length === 0) return;

    const validIds = new Set(allGames.map((g) => normalizeGameId(g.game_id)));

    setSelectedGameIds((prev) => {
      if (prev === null) return prev;
      const filtered = prev.filter((id) => validIds.has(normalizeGameId(id)));
      if (filtered.length === prev.length) return prev;
      return filtered.length > 0 ? filtered : null;
    });

    setMobileSelectedGameIds((prev) => {
      if (prev === null) return prev;
      const filtered = prev.filter((id) => validIds.has(normalizeGameId(id)));
      if (filtered.length === prev.length) return prev;
      return filtered.length > 0 ? filtered : null;
    });
  }, [allGames]);
  
  // Effective game IDs (fallback to empty array if not yet initialized)
  const effectiveDesktopGameIds = selectedGameIds ?? [];
  const effectiveMobileGameIds = mobileSelectedGameIds ?? [];
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Update selectedDate when selectedGameIds changes
  useEffect(() => {
    if (effectiveDesktopGameIds.length > 0) {
      const selectedIdSet = new Set(effectiveDesktopGameIds.map((id) => normalizeGameId(id)));
      const selectedGames = allGames.filter((game) => selectedIdSet.has(normalizeGameId(game.game_id)));
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
      const selectedIdSet = new Set(effectiveGameIds.map((id) => normalizeGameId(id)));
      const selectedGames = allGames.filter((game) => selectedIdSet.has(normalizeGameId(game.game_id)));
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
    sport,
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
        selectedGameIds,
        mobileSelectedGameIds,
        mobileSortField,
      };
      sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save filter state:", e);
    }
  }, [selectedMarkets, sortField, sortDirection, selectedGameIds, mobileSelectedGameIds, mobileSortField]);

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
    const profileDate = player.gameDate || effectiveDate || apiPrimaryDate || undefined;
    if (profileDate) {
      params.set("date", profileDate);
    }
    router.push(`/hit-rates/${sport}/player/${player.playerId}?${params.toString()}`);
  }, [router, sport, saveFilterState, effectiveDate, apiPrimaryDate]);

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
    
    if (selectedMarkets.length > 0 && selectedMarkets.length < sportConfig.markets.length) {
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
  }, [rows, selectedMarkets, normalizedSelectedGameIds, startedGameIds, sportConfig.markets.length]);

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
        sport={sport}
        rows={mobileFilteredRows}
        games={allGames ?? []}
        loading={isLoading}
        error={error?.message}
        onPlayerClick={handleTableRowClick}
        selectedMarkets={mobileSelectedMarkets}
        onMarketsChange={setMobileSelectedMarkets}
        marketOptions={sportConfig.markets}
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
      title={sportConfig.title}
      subtitle={sportConfig.subtitle}
      headerActions={<GlossaryButton onClick={() => setShowGlossary(true)} />}
    >
      {/* Glossary Modal */}
      <GlossaryModal isOpen={showGlossary} onClose={() => setShowGlossary(false)} />

      {/* Hit Rate Table - with Games Filter passed as additional filter */}
      <GatedHitRateTable 
        sport={sport}
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
        marketOptions={sportConfig.markets}
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
            sport={sport}
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
