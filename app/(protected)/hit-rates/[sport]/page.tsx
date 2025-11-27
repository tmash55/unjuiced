"use client";

import { useMemo, useState, use, useRef, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { HitRateTable } from "@/components/hit-rates/hit-rate-table";
import { GamesSidebar } from "@/components/hit-rates/games-sidebar";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
];

// Debounce delay for market filter changes (ms)
const FILTER_DEBOUNCE_MS = 300;

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
  // Debounced version of selected markets for API calls
  const [debouncedMarkets, setDebouncedMarkets] = useState<string[]>(selectedMarkets);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Game filter state (multi-select)
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  
  // Player drill-down state
  const [selectedPlayer, setSelectedPlayer] = useState<HitRateProfile | null>(null);

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

  // Player drill-down handlers
  const handlePlayerSelect = useCallback((player: HitRateProfile) => {
    setSelectedPlayer(player);
  }, []);

  const handleBackToTable = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  // Debounce market selection changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMarkets(selectedMarkets);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [selectedMarkets]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMarket = useCallback((value: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }, []);

  const selectAllMarkets = useCallback(() => {
    setSelectedMarkets(MARKET_OPTIONS.map((o) => o.value));
  }, []);

  const deselectAllMarkets = useCallback(() => {
    setSelectedMarkets([]);
  }, []);

  // Pass markets as comma-separated string (always pass selected markets to get all rows)
  const marketsParam = useMemo(() => {
    if (debouncedMarkets.length === 0) return undefined;
    return debouncedMarkets.join(",");
  }, [debouncedMarkets]);

  const { rows, isLoading, isFetching, error, meta } = useHitRateTable({
    // Don't pass date - let API auto-detect (today, or next day with profiles)
    market: marketsParam,
    limit: 3000, // High limit to handle all players × all markets for a full day
  });
  
  // The actual date being displayed (from API response)
  const displayDate = meta?.date;

  // Client-side filtering: game + search (instant, no API call needed)
  const filteredRows = useMemo(() => {
    let result = rows;
    
    // Filter by selected games (if any specific games selected)
    if (selectedGameIds.length > 0) {
      result = result.filter((row: HitRateProfile) => 
        row.gameId && selectedGameIds.includes(row.gameId)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((row: HitRateProfile) => {
        const playerName = row.playerName?.toLowerCase() || "";
        const teamName = row.teamName?.toLowerCase() || "";
        const teamAbbr = row.teamAbbr?.toLowerCase() || "";
        const opponentName = row.opponentTeamName?.toLowerCase() || "";
        const opponentAbbr = row.opponentTeamAbbr?.toLowerCase() || "";
        return (
          playerName.includes(query) ||
          teamName.includes(query) ||
          teamAbbr.includes(query) ||
          opponentName.includes(query) ||
          opponentAbbr.includes(query)
        );
      });
    }
    
    return result;
  }, [rows, selectedGameIds, searchQuery]);

  // Only show full loading state on initial load, not on filter changes
  const showLoadingState = isLoading && rows.length === 0;

  // Get all players from the selected player's game (for drill-down sidebar)
  const gamePlayersForDrilldown = useMemo(() => {
    if (!selectedPlayer?.gameId) return [];
    return rows.filter((row: HitRateProfile) => row.gameId === selectedPlayer.gameId);
  }, [rows, selectedPlayer?.gameId]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <ToolHeading>NBA Hit Rates</ToolHeading>
        <ToolSubheading>
          Explore pre-calculated player prop hit rates, refreshed hourly and ready for deep analysis.
        </ToolSubheading>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FiltersBar useDots className="sticky top-14 z-30">
          <FiltersBarSection align="left">
            <div className="flex items-center gap-4">
              {/* Markets Dropdown */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Markets</label>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 w-[200px]"
                    )}
                  >
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {selectedMarkets.length === 0
                        ? "No markets"
                        : selectedMarkets.length === MARKET_OPTIONS.length
                        ? "All Markets"
                        : `${selectedMarkets.length} selected`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", marketDropdownOpen && "rotate-180")} />
                  </button>

                  {marketDropdownOpen && (
                    <div className="absolute left-0 top-full z-[100] mt-2 w-[220px] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                      {/* Select All / Deselect All */}
                      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-2">
                        <button
                          type="button"
                          onClick={selectAllMarkets}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllMarkets}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                        >
                          Deselect All
                        </button>
                      </div>

                      {/* Market options */}
                      <div className="flex flex-col gap-1 max-h-64 overflow-auto">
                        {MARKET_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <Checkbox
                              checked={selectedMarkets.includes(opt.value)}
                              onCheckedChange={() => toggleMarket(opt.value)}
                            />
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Input */}
              <div className="relative">
                <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search player or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10"
                />
              </div>
            </div>
          </FiltersBarSection>
        </FiltersBar>
      </div>

      {/* Games Sidebar + Table/Drilldown Row */}
      <div className="flex gap-6 h-[calc(100vh-280px)]">
        {/* Games Sidebar - always visible */}
        <GamesSidebar 
          selectedGameIds={selectedGameIds}
          onToggleGame={toggleGame}
          onSelectAll={selectAllGames}
          onSelectTodaysGames={selectTodaysGames}
          onClearAll={clearGameSelection}
          selectedPlayer={selectedPlayer}
          gamePlayers={gamePlayersForDrilldown}
          onPlayerSelect={handlePlayerSelect}
        />

        {/* Table or Player Drill-down */}
        <div className="flex-1 min-w-0 h-full">
          {selectedPlayer ? (
            <PlayerDrilldown 
              profile={selectedPlayer} 
              onBack={handleBackToTable} 
            />
          ) : (
            <HitRateTable 
              rows={filteredRows} 
              loading={showLoadingState} 
              error={error?.message}
              onRowClick={handlePlayerSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}

