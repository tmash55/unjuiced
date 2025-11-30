"use client";

import { useMemo, useState, use, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { HitRateTable } from "@/components/hit-rates/hit-rate-table";
import { GamesSidebar } from "@/components/hit-rates/games-sidebar";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";

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

// Pagination settings
// Each player has ~12 markets, each game has ~30 players = ~360 profiles per game
// With 15 games over 2 days = ~5,400 profiles total
// Load enough to ensure we have complete data for sidebar player lists
const INITIAL_PAGE_SIZE = 2000; // Load 2000 on initial page load
const LOAD_MORE_SIZE = 1000; // Load 1000 more each time

export default function HitRatesSportPage({ params }: { params: Promise<{ sport: string }> }) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase();
  if (!SUPPORTED_SPORTS.includes(sport as typeof SUPPORTED_SPORTS[number])) {
    notFound();
  }

  // Let the API determine the best date (today, or next day with profiles if today has none)
  // All markets selected by default
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    MARKET_OPTIONS.map((o) => o.value)
  );
  
  // Search state - with debouncing for server-side search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Game filter state (multi-select)
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  
  // Player drill-down state
  const [selectedPlayer, setSelectedPlayer] = useState<HitRateProfile | null>(null);
  // Track the preferred market for drilldown - persists when switching players
  const [preferredMarket, setPreferredMarket] = useState<string | null>(null);

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

  // Debounce search query for server-side search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pagination state
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);

  // Reset to initial page size when search or game filters change (not markets - those are client-side)
  useEffect(() => {
    setPageSize(INITIAL_PAGE_SIZE);
  }, [selectedGameIds, debouncedSearch]);

  // When a player is selected (drilldown mode), we need ALL players for the sidebar
  // to show complete rosters for each game
  const isInDrilldown = selectedPlayer !== null;
  
  // Check if specific games are selected (not "all games")
  const hasGameFilter = selectedGameIds.length > 0;
  
  // Check if markets are filtered (not all selected)
  const hasMarketFilter = selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length;

  const { rows, count, isLoading, isFetching, error, meta } = useHitRateTable({
    // Don't pass date - API fetches today + tomorrow automatically
    // Don't pass market - we filter client-side for instant response
    // Load all data when in drilldown mode, searching, filtering by game, or filtering by market
    // (market filtering is client-side, so we need all data to filter from)
    // With 2 days × ~15 games × ~30 players × 12 markets = ~10,800 profiles
    // BUT tomorrow's profiles have NULL hit rates and get pushed to the end
    // So we need a higher limit to get them all
    limit: isInDrilldown ? 15000 : (debouncedSearch || hasGameFilter || hasMarketFilter ? 12000 : pageSize),
    search: debouncedSearch || undefined,
  });
  
  // The actual date being displayed (from API response)
  const displayDate = meta?.date;
  
  // Total available count from API
  const totalCount = count ?? 0;
  const hasMore = rows.length < totalCount;
  
  // Load more handler
  const handleLoadMore = useCallback(() => {
    setPageSize((prev) => prev + LOAD_MORE_SIZE);
  }, []);

  // Player drill-down handler for TABLE clicks - always use exact profile clicked
  const handleTableRowClick = useCallback((player: HitRateProfile) => {
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

  // Client-side filtering: markets + game filter (search is server-side)
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // Filter by selected markets (instant, no API call)
    if (selectedMarkets.length > 0 && selectedMarkets.length < MARKET_OPTIONS.length) {
      result = result.filter((row: HitRateProfile) => 
        selectedMarkets.includes(row.market)
      );
    } else if (selectedMarkets.length === 0) {
      result = []; // No markets selected = show nothing
    }
    
    // Filter by selected games (if any specific games selected)
    if (selectedGameIds.length > 0) {
      result = result.filter((row: HitRateProfile) => 
        row.gameId && selectedGameIds.includes(row.gameId)
      );
    }
    
    return result;
  }, [rows, selectedMarkets, selectedGameIds]);

  // Only show full loading state on initial load, not on filter changes
  const showLoadingState = isLoading && rows.length === 0;

  // Pass all rows to sidebar so it can show players from any game (not just selected player's game)
  // The sidebar will filter by gameId internally when expanding each game
  const allPlayersForDrilldown = useMemo(() => {
    if (!selectedPlayer) return [];
    return rows; // Pass all rows - sidebar will filter by gameId as needed
  }, [rows, selectedPlayer]);

  // Get all profiles for the selected player (all their different markets)
  const selectedPlayerAllProfiles = useMemo(() => {
    if (!selectedPlayer) return [];
    return rows.filter(r => r.playerId === selectedPlayer.playerId);
  }, [rows, selectedPlayer]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <ToolHeading>NBA Hit Rates</ToolHeading>
        <ToolSubheading>
          Explore pre-calculated player prop hit rates, refreshed hourly and ready for deep analysis.
        </ToolSubheading>
      </div>

      {/* Games Sidebar + Table/Drilldown Row */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Games Sidebar - always visible */}
        <GamesSidebar 
          selectedGameIds={selectedGameIds}
          onToggleGame={toggleGame}
          onSelectAll={selectAllGames}
          onSelectTodaysGames={selectTodaysGames}
          onClearAll={clearGameSelection}
          selectedPlayer={selectedPlayer}
          gamePlayers={allPlayersForDrilldown}
          onPlayerSelect={handleSidebarPlayerSelect}
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
              rows={filteredRows} 
              loading={showLoadingState} 
              error={error?.message}
              onRowClick={handleTableRowClick}
              hasMore={hasMore && !debouncedSearch && selectedGameIds.length === 0 && selectedMarkets.length === MARKET_OPTIONS.length}
              onLoadMore={handleLoadMore}
              isLoadingMore={isFetching && rows.length > 0}
              totalCount={totalCount}
              selectedMarkets={selectedMarkets}
              onMarketsChange={setSelectedMarkets}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
        </div>
      </div>
    </div>
  );
}

