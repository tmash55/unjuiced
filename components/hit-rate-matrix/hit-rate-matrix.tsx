"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  useHitRateMatrix,
  HitRateMatrixRow,
  ThresholdData,
  HitRateMatrixTimeWindow,
  HIT_RATE_MATRIX_MARKETS,
  TIME_WINDOW_OPTIONS,
  POSITION_OPTIONS,
  getDvpColor,
  formatOdds,
  getHitRateBackground,
  formatEdge,
  isDeadZone,
  getBestLineFromRow,
  decimalToAmerican,
} from "@/hooks/use-hit-rate-matrix";
import { PlayerHeadshot } from "@/components/player-headshot";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { Loader2, ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, Filter, X, Check, Search } from "lucide-react";
import { useNbaGames } from "@/hooks/use-nba-games";
import { GamesFilterDropdown, normalizeGameId } from "@/components/hit-rates/games-filter-dropdown";
import { Tooltip } from "@/components/tooltip";
import { useFavorites, BookSnapshot } from "@/hooks/use-favorites";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { toast } from "sonner";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";

// =============================================================================
// TYPES
// =============================================================================

interface HitRateMatrixProps {
  sport?: string;
  className?: string;
}

type SortField = "player" | "dvp" | "line" | number; // number represents threshold line
type SortDirection = "asc" | "desc";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HitRateMatrix({ sport = "nba", className }: HitRateMatrixProps) {
  // Filter state
  const [selectedMarket, setSelectedMarket] = useState("player_points");
  const [timeWindow, setTimeWindow] = useState<HitRateMatrixTimeWindow>("last_10");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  
  // NEW: Search, game filter, min edge filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<string | null>(null); // null = all games
  const [minEdge, setMinEdge] = useState<number>(0); // 0 = show all edges, 5 = only show edge strip if ≥5%
  
  // Player quick view modal state
  const [selectedPlayer, setSelectedPlayer] = useState<{
    nba_player_id: number;
    player_name: string;
    market: string;
    event_id: string;
    line?: number;
  } | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Refs for click outside handling
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  const positionDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(event.target as Node)) {
        setShowMarketDropdown(false);
      }
      if (positionDropdownRef.current && !positionDropdownRef.current.contains(event.target as Node)) {
        setShowPositionDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get today's date in ET
  const todayET = useMemo(() => {
    const now = new Date();
    const etOptions: Intl.DateTimeFormatOptions = {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    return now.toLocaleDateString("en-CA", etOptions);
  }, []);

  // Fetch data
  const { rows: rawRows, thresholdLines, isLoading, error } = useHitRateMatrix({
    market: selectedMarket,
    gameDate: todayET,
    timeWindow,
    positions: selectedPositions.length > 0 ? selectedPositions : undefined,
  });

  // Fetch games from the useNbaGames hook for consistent filtering
  const { games: nbaGames } = useNbaGames();

  // Extract unique gameIds from matrix data (numeric IDs that match useNbaGames)
  const matrixGameIds = useMemo(() => {
    if (!rawRows) return new Set<string>();
    const gameIds = new Set<string>();
    rawRows.forEach(row => {
      if (row.gameId !== null && row.gameId !== undefined) {
        gameIds.add(normalizeGameId(row.gameId));
      }
    });
    return gameIds;
  }, [rawRows]);

  // Filter nbaGames to only include games that have players in the matrix
  const filteredGames = useMemo(() => {
    return nbaGames.filter(game => matrixGameIds.has(normalizeGameId(game.game_id)));
  }, [nbaGames, matrixGameIds]);

  // Filter rows by search, game, etc.
  const filteredRows = useMemo(() => {
    if (!rawRows) return [];
    return rawRows.filter(row => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = row.playerName.toLowerCase().includes(q);
        const matchesTeam = row.teamAbbr?.toLowerCase().includes(q);
        if (!matchesName && !matchesTeam) return false;
      }
      // Game filter - compare using numeric gameId (matches useNbaGames)
      if (selectedGame && normalizeGameId(row.gameId) !== selectedGame) return false;
      return true;
    });
  }, [rawRows, searchQuery, selectedGame]);

  // Handle sort click
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction or clear
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortField(null);
        setSortDirection("desc");
      }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField, sortDirection]);

  // Sort rows
  const rows = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return filteredRows;
    if (sortField === null) return filteredRows;

    const sorted = [...filteredRows].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      if (sortField === "player") {
        aVal = a.playerName.toLowerCase();
        bVal = b.playerName.toLowerCase();
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === "asc" ? result : -result;
      } else if (sortField === "dvp") {
        aVal = a.dvpRank ?? 999;
        bVal = b.dvpRank ?? 999;
      } else if (sortField === "line") {
        aVal = a.primaryLine ?? 0;
        bVal = b.primaryLine ?? 0;
      } else if (typeof sortField === "number") {
        // Sort by threshold hit rate
        const aThreshold = a.thresholds.find(t => t.line === sortField);
        const bThreshold = b.thresholds.find(t => t.line === sortField);
        aVal = aThreshold?.hitRate ?? -1;
        bVal = bThreshold?.hitRate ?? -1;
      }

      if (aVal === null || bVal === null) return 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return sorted;
  }, [filteredRows, sortField, sortDirection]);

  const selectedMarketLabel = HIT_RATE_MATRIX_MARKETS.find((m) => m.value === selectedMarket)?.label || "Points";

  // Handle position toggle
  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const clearPositions = () => {
    setSelectedPositions([]);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
          className
        )}
      >
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span className="text-sm text-neutral-500">Loading hit rate matrix...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-6",
          className
        )}
      >
        <p className="text-sm text-red-500">Failed to load hit rate matrix</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-900 overflow-hidden shadow-sm",
        className
      )}
    >
      {/* Header with Filters */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search & Help */}
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search player..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-[160px] pl-8 pr-3 py-1.5 rounded-lg text-xs transition-all",
                  "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60",
                  "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                  "focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
                >
                  <X className="h-3 w-3 text-neutral-400" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Market Dropdown */}
            <div className="relative" ref={marketDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowMarketDropdown(!showMarketDropdown);
                  setShowPositionDropdown(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60",
                  "hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
                )}
              >
                {selectedMarketLabel}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 text-neutral-400 transition-transform", showMarketDropdown && "rotate-180")}
                />
              </button>

              {showMarketDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                  {HIT_RATE_MATRIX_MARKETS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setSelectedMarket(m.value);
                        setShowMarketDropdown(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                        selectedMarket === m.value
                          ? "bg-brand/10 text-brand font-medium"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      )}
                    >
                      {m.label}
                      {selectedMarket === m.value && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Game Filter Dropdown - Using shared component */}
            <GamesFilterDropdown
              games={filteredGames}
              singleSelect
              selectedGameId={selectedGame}
              onGameSelect={setSelectedGame}
              compact
            />

            {/* Time Window Toggle */}
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
              {TIME_WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTimeWindow(opt.value)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide transition-all",
                    timeWindow === opt.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {opt.shortLabel}
                </button>
              ))}
            </div>

            {/* Position Filter */}
            <div className="relative" ref={positionDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowPositionDropdown(!showPositionDropdown);
                  setShowMarketDropdown(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  selectedPositions.length > 0
                    ? "bg-brand/10 text-brand border border-brand/30"
                    : "bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60",
                  "hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
                )}
              >
                <Filter className="h-3 w-3" />
                {selectedPositions.length > 0 ? selectedPositions.join(", ") : "Position"}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 text-neutral-400 transition-transform", showPositionDropdown && "rotate-180")}
                />
              </button>

              {showPositionDropdown && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                  {selectedPositions.length > 0 && (
                    <button
                      type="button"
                      onClick={clearPositions}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 mb-0.5 border-b border-neutral-100 dark:border-neutral-700"
                    >
                      <X className="h-2.5 w-2.5" />
                      Clear all
                    </button>
                  )}
                  {POSITION_OPTIONS.map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => togglePosition(pos.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                        selectedPositions.includes(pos.value)
                          ? "bg-brand/10 text-brand font-medium"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      )}
                    >
                      <span>{pos.value}</span>
                      {selectedPositions.includes(pos.value) && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Min Edge Filter */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Edge</span>
              <select
                value={minEdge}
                onChange={(e) => setMinEdge(Number(e.target.value))}
                className="bg-transparent text-xs font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value={0}>All</option>
                <option value={3}>≥3%</option>
                <option value={5}>≥5%</option>
                <option value={10}>≥10%</option>
              </select>
            </div>

            {/* Player Count */}
            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium tabular-nums">
              {rows.length} players
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-neutral-500 dark:text-neutral-400">
          No data available for today's games
        </div>
      ) : (
        <div className="relative">
          {/* Scrollable container with max height */}
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full border-collapse">
              {/* Sticky header - no vertical borders */}
              <thead className="sticky top-0 z-30">
                <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm border-b border-neutral-200/50 dark:border-neutral-700/50">
                  {/* Player column - sticky left */}
                  <th 
                    className="sticky left-0 z-40 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm px-3 py-2.5 text-left w-[160px] min-w-[160px] cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-700/80 transition-colors"
                    onClick={() => handleSort("player")}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Player
                      <SortIcon field="player" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  {/* DvP column - sticky left */}
                  <th 
                    className="sticky left-[160px] z-40 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm px-2 py-2.5 text-center w-[50px] min-w-[50px] cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-700/80 transition-colors"
                    onClick={() => handleSort("dvp")}
                  >
                    <div className="flex items-center justify-center gap-0.5 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      DvP
                      <SortIcon field="dvp" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>
                  {/* Line column - sticky left */}
                  <th 
                    className="sticky left-[210px] z-40 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm px-2 py-2.5 text-center w-[50px] min-w-[50px] cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-700/80 transition-colors"
                    onClick={() => handleSort("line")}
                  >
                    <div className="flex items-center justify-center gap-0.5 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Line
                      <SortIcon field="line" sortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </th>

                  {/* Best Line column - sticky left - subtle separator */}
                  <th className="sticky left-[260px] z-40 bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm px-2 py-2.5 text-center w-[80px] min-w-[80px]">
                    <div className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Best
                    </div>
                  </th>

                  {/* Threshold columns - sortable, clean, no vertical borders */}
                  {thresholdLines.map((line) => (
                    <th
                      key={line}
                      className="p-0 text-center min-w-[62px] cursor-pointer hover:bg-neutral-100/30 dark:hover:bg-neutral-800/30 transition-colors"
                      onClick={() => handleSort(line)}
                    >
                      <div className="flex items-center justify-center gap-0.5 py-2.5 px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {line}+
                        <SortIcon field={line} sortField={sortField} sortDirection={sortDirection} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <MatrixRow 
                    key={`${row.playerId}-${row.eventId}`} 
                    row={row} 
                    isEven={idx % 2 === 0} 
                    market={selectedMarket} 
                    minEdge={minEdge}
                    onPlayerClick={(r) => setSelectedPlayer({
                      nba_player_id: r.playerId,
                      player_name: r.playerName,
                      market: selectedMarket,
                      event_id: r.eventId,
                      line: r.primaryLine ?? undefined,
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend - Premium, minimal */}
      <div className="px-4 py-2.5 border-t border-neutral-100/30 dark:border-neutral-800/30">
        <div className="flex items-center justify-center gap-8 text-[9px]">
          {/* Hit Rate Legend */}
          <div className="flex items-center gap-3">
            <span className="text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-medium">Hit Rate</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-700" />
                <span className="text-neutral-500 dark:text-neutral-400">80%+</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/65 dark:bg-emerald-600/65" />
                <span className="text-neutral-500 dark:text-neutral-400">60%+</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-neutral-500/55 dark:bg-neutral-600/55" />
                <span className="text-neutral-500 dark:text-neutral-400">50%+</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-red-600/60 dark:bg-red-700/60" />
                <span className="text-neutral-500 dark:text-neutral-400">&lt;50%</span>
              </div>
            </div>
          </div>
          
          {/* Edge Strip Legend */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-4 rounded-sm bg-neutral-500/40 dark:bg-neutral-600/40 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-amber-400/50 dark:bg-amber-300/40" />
            </div>
            <span className="text-neutral-400 dark:text-neutral-500">Edge ≥5%</span>
          </div>
        </div>
      </div>

      {/* Player Quick View Modal */}
      {selectedPlayer && (
        <PlayerQuickViewModal
          nba_player_id={selectedPlayer.nba_player_id}
          player_name={selectedPlayer.player_name}
          initial_market={selectedPlayer.market}
          initial_line={selectedPlayer.line}
          event_id={selectedPlayer.event_id}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SORT ICON COMPONENT
// =============================================================================

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) {
  if (sortField !== field) {
    return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  }
  return sortDirection === "asc" 
    ? <ChevronUp className="h-3 w-3 text-brand" />
    : <ChevronDown className="h-3 w-3 text-brand" />;
}

// =============================================================================
// ROW COMPONENT
// =============================================================================

function MatrixRow({ row, isEven, market, minEdge, onPlayerClick }: { 
  row: HitRateMatrixRow; 
  isEven: boolean; 
  market: string; 
  minEdge: number;
  onPlayerClick: (row: HitRateMatrixRow) => void;
}) {
  // Subtle row striping (2-3% opacity difference)
  const bgClass = isEven 
    ? "bg-white dark:bg-neutral-900" 
    : "bg-neutral-50/40 dark:bg-neutral-800/15";

  // Get best line for this row
  const bestLine = useMemo(() => getBestLineFromRow(row.thresholds), [row.thresholds]);
  const bestBook = bestLine?.bestBook ? getSportsbookById(bestLine.bestBook) : null;

  return (
    <tr className={cn("group transition-colors", bgClass, "hover:bg-neutral-100/40 dark:hover:bg-neutral-800/40")}>
      {/* Player Info - Sticky, no vertical borders */}
      <td className="sticky left-0 z-20 px-3 py-3 bg-inherit border-b border-neutral-100/30 dark:border-neutral-800/30">
        <div className="flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-xl overflow-hidden shrink-0 shadow-sm transition-transform duration-150 group-hover:scale-[1.03]"
            style={{
              background:
                row.primaryColor
                  ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor || row.primaryColor} 100%)`
                  : "#374151",
            }}
          >
            <PlayerHeadshot
              nbaPlayerId={row.playerId}
              name={row.playerName}
              size="small"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onPlayerClick(row)}
              className="text-sm font-bold text-neutral-900 dark:text-white truncate leading-tight hover:text-brand hover:underline cursor-pointer text-left block max-w-full"
            >
              {row.playerName}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
              {row.teamAbbr && (
                <img
                  src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                  alt={row.teamAbbr}
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{row.position}</span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <span>
                {row.homeAway === "H" ? "vs" : "@"} {row.opponentAbbr}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* DvP Rank - Sticky */}
      <td className="sticky left-[160px] z-20 px-1.5 py-2.5 text-center bg-inherit border-b border-neutral-100/30 dark:border-neutral-800/30">
        {row.dvpRank !== null ? (
          <Tooltip
            content={
              <span className="text-xs">
                {row.dvpQuality === "favorable" && "Weak defense - favorable matchup"}
                {row.dvpQuality === "unfavorable" && "Strong defense - tough matchup"}
                {row.dvpQuality === "neutral" && "Average defense"}
              </span>
            }
            side="top"
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold cursor-help tabular-nums",
                getDvpColor(row.dvpQuality)
              )}
            >
              {row.dvpRank}
            </span>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
        )}
      </td>

      {/* Primary Line - Sticky */}
      <td className="sticky left-[210px] z-20 px-1.5 py-2.5 text-center bg-inherit border-b border-neutral-100/30 dark:border-neutral-800/30">
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 tabular-nums">
          {row.primaryLine !== null ? row.primaryLine : "—"}
        </span>
      </td>

      {/* Best Line Column - shows best edge opportunity */}
      <td className="sticky left-[260px] z-20 px-2 py-2.5 text-center bg-inherit border-b border-neutral-100/30 dark:border-neutral-800/30">
        {bestLine && bestLine.edgePct !== null && bestLine.edgePct > 0 ? (
          <Tooltip
            content={
              <div className="px-3 py-2 text-[11px] min-w-[160px] space-y-1">
                <div className="font-medium text-neutral-800 dark:text-neutral-100">
                  Best Value Line
                </div>
                <div className="text-neutral-400 dark:text-neutral-500 text-[10px]">
                  Line: {bestLine.actualLine ?? bestLine.line}+
                </div>
                <div className="text-neutral-400 dark:text-neutral-500 text-[10px]">
                  Hit Rate: {bestLine.hitRate}%
                </div>
                {bestBook && (
                  <div className="text-neutral-400 dark:text-neutral-500 text-[10px]">
                    Best: {bestBook.name} {formatOdds(bestLine.bestOdds)}
                  </div>
                )}
                <div className="text-emerald-500 dark:text-emerald-400 text-[10px] font-medium pt-1 border-t border-neutral-200/20 dark:border-neutral-700/20">
                  Edge vs market: {formatEdge(bestLine.edgePct)}
                </div>
              </div>
            }
            side="top"
            delayDuration={200}
          >
            <div className="flex flex-col items-center gap-0.5 cursor-help">
              {/* Line value - primary */}
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 tabular-nums">
                {bestLine.actualLine ?? bestLine.line}+
              </span>
              {/* Odds + Edge - secondary */}
              <div className="flex items-center gap-1">
                {bestBook?.image?.light && (
                  <img src={bestBook.image.light} alt={bestBook.name} className="w-3.5 h-3.5 rounded-sm opacity-80" />
                )}
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums font-medium">
                  {formatOdds(bestLine.bestOdds)}
                </span>
              </div>
            </div>
          </Tooltip>
        ) : (
          <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
        )}
      </td>

      {/* Threshold Cells - no vertical borders */}
      {row.thresholds.map((threshold) => (
        <ThresholdCell 
          key={threshold.line} 
          threshold={threshold} 
          eventId={row.eventId}
          market={market}
          selKey={row.selKey}
          minEdge={minEdge}
          playerName={row.playerName}
          playerId={String(row.playerId)}
          teamAbbr={row.teamAbbr}
          position={row.position}
          homeTeam={row.homeAway === "H" ? row.teamAbbr : row.opponentAbbr}
          awayTeam={row.homeAway === "H" ? row.opponentAbbr : row.teamAbbr}
          gameDate={row.gameDate ?? null}
        />
      ))}
    </tr>
  );
}

// =============================================================================
// THRESHOLD CELL COMPONENT
// =============================================================================

interface ThresholdCellProps {
  threshold: ThresholdData;
  eventId: string;
  market: string;
  selKey: string;
  minEdge: number;
  // Row data for favorites
  playerName: string;
  playerId: string;
  teamAbbr: string;
  position: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string | null;
}

interface BookOddsDetail {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
}

interface OddsLineResponse {
  line: number;
  best: { book: string; over: number | null; under: number | null } | null;
  books: BookOddsDetail[];
  book_count: number;
  updated_at: number;
}

function ThresholdCell({ 
  threshold, 
  eventId, 
  market, 
  selKey, 
  minEdge,
  playerName,
  playerId,
  teamAbbr,
  position,
  homeTeam,
  awayTeam,
  gameDate,
}: ThresholdCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oddsData, setOddsData] = useState<OddsLineResponse | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<"below" | "above">("below");
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const hasFetched = useRef(false);

  const hasOdds = threshold.bestOdds !== null;
  const bookInfo = threshold.bestBook ? getSportsbookById(threshold.bestBook) : null;
  const bookLogo = bookInfo?.image?.light || null;
  
  // Edge strip visibility based on minEdge filter
  const showEdgeStrip = threshold.edgePct !== null && threshold.edgePct >= minEdge && threshold.edgePct >= 5;
  
  // Favorites
  const { toggleFavorite, isFavorited, isLoggedIn } = useFavorites();
  const lineValue = threshold.actualLine ?? threshold.line;
  
  const favoriteParams = useMemo(() => ({
    event_id: eventId,
    type: "player" as const,
    player_id: playerId,
    market: market,
    line: lineValue,
    side: "over",
  }), [eventId, playerId, market, lineValue]);
  
  const isFav = isFavorited(favoriteParams);
  
  const handleToggleFavorite = useCallback(async () => {
    if (!isLoggedIn) {
      toast.error("Please sign in to save favorites");
      return;
    }
    
    setIsTogglingFavorite(true);
    try {
      // Build books snapshot from oddsData
      const booksSnapshot: Record<string, BookSnapshot> = {};
      if (oddsData?.books) {
        oddsData.books.forEach((book) => {
          if (book.over !== null) {
            booksSnapshot[book.book] = {
              price: book.over,
              u: book.link_over || null,
              m: null,
              sgp: null,
            };
          }
        });
      }
      
      await toggleFavorite({
        type: "player",
        sport: "nba",
        event_id: eventId,
        game_date: gameDate,
        home_team: homeTeam,
        away_team: awayTeam,
        player_id: playerId,
        player_name: playerName,
        player_team: teamAbbr,
        player_position: position,
        market: market,
        line: lineValue,
        side: "over",
        odds_key: `odds:nba:${eventId}:${market}`,
        odds_selection_id: `${playerName.toLowerCase().replace(/\s+/g, "_")}|over|${lineValue}`,
        books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
        best_price_at_save: threshold.bestOdds,
        best_book_at_save: threshold.bestBook,
        source: "hit_rate_matrix",
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [isLoggedIn, toggleFavorite, eventId, gameDate, homeTeam, awayTeam, playerId, playerName, teamAbbr, position, market, lineValue, oddsData, threshold.bestOdds, threshold.bestBook]);

  // Extract player UUID from selKey (for API calls)
  const playerUuid = useMemo(() => {
    if (!selKey) return null;
    return selKey.includes(':') ? selKey.split(':')[0] : selKey;
  }, [selKey]);

  // Calculate dropdown position based on available viewport space
  const calculateDropdownPosition = useCallback(() => {
    if (!cellRef.current) return "below";
    const rect = cellRef.current.getBoundingClientRect();
    const dropdownHeight = 280; // Approximate height of dropdown
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Prefer below, but use above if not enough space below and more space above
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      return "above";
    }
    return "below";
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Fetch odds when dropdown is opened - use actualLine (the real sportsbook line)
  const fetchOdds = useCallback(async () => {
    if (!eventId || !market || !playerUuid) return;
    
    // Use actualLine if available, otherwise fall back to threshold line
    const lineToFetch = threshold.actualLine ?? threshold.line;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        event_id: eventId,
        market: market,
        player_id: playerUuid,
        line: String(lineToFetch),
      });
      const response = await fetch(`/api/nba/props/odds-line?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch odds");
      const data: OddsLineResponse = await response.json();
      setOddsData(data);
      hasFetched.current = true;
    } catch (err) {
      console.error("[ThresholdCell] Error fetching odds:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, market, playerUuid, threshold.line, threshold.actualLine]);

  const handleCellClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasOdds) return;
    
    if (!isOpen) {
      // Calculate position before opening
      setDropdownPosition(calculateDropdownPosition());
      if (!hasFetched.current && !isLoading) {
        fetchOdds();
      }
    }
    setIsOpen(!isOpen);
  }, [hasOdds, isOpen, isLoading, fetchOdds, calculateDropdownPosition]);

  const handleBookClick = useCallback((book: BookOddsDetail, side: "over" | "under", e: React.MouseEvent) => {
    e.stopPropagation();
    const link = side === "over" 
      ? (book.link_over || getBookFallbackUrl(book.book))
      : (book.link_under || getBookFallbackUrl(book.book));
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }, []);

  const sortedBooks = useMemo(() => {
    if (!oddsData?.books) return [];
    return [...oddsData.books].sort((a, b) => {
      const aPrice = a.over ?? a.under ?? -Infinity;
      const bPrice = b.over ?? b.under ?? -Infinity;
      return bPrice - aPrice;
    });
  }, [oddsData?.books]);

  // Check if this is a dead zone cell
  const isDead = isDeadZone(threshold.bookCount, threshold.edgePct);

  return (
    <td className="p-0 text-center relative border-b border-neutral-100/20 dark:border-neutral-800/20" ref={cellRef}>
      <Tooltip
        content={
          <div className="px-3 py-2 text-[11px] min-w-[160px] space-y-1">
            {/* Hit rate - PRIMARY info */}
            {threshold.hitRate !== null ? (
              <div className="font-medium text-neutral-800 dark:text-neutral-100">
                {threshold.hitRate}% hit rate
                <span className="font-normal text-neutral-500 dark:text-neutral-400 ml-1">
                  ({threshold.hits}/{threshold.games})
                </span>
              </div>
            ) : (
              <div className="text-neutral-500 dark:text-neutral-400">
                No hit rate data
              </div>
            )}
            
            {/* Line */}
            <div className="text-neutral-400 dark:text-neutral-500 text-[10px]">
              Line: {threshold.actualLine ?? threshold.line}+
            </div>
            
            {/* Best odds */}
            {hasOdds && bookInfo && (
              <div className="text-neutral-500 dark:text-neutral-400 text-[10px]">
                Best: {bookInfo.name} {formatOdds(threshold.bestOdds)}
              </div>
            )}
            
            {/* Average odds - shown when we have edge data */}
            {threshold.avgDecimal !== null && threshold.bookCount >= 2 && (
              <div className="text-neutral-400 dark:text-neutral-500 text-[10px]">
                Avg: {formatOdds(decimalToAmerican(threshold.avgDecimal))} ({threshold.bookCount} books)
              </div>
            )}
            
            {/* Edge annotation - shown on hover for any edge */}
            {threshold.edgePct !== null && threshold.edgePct > 0 && (
              <div className="text-amber-600/80 dark:text-amber-400/80 text-[10px] font-medium pt-1 border-t border-neutral-200/20 dark:border-neutral-700/20">
                Edge vs market: {formatEdge(threshold.edgePct)}
              </div>
            )}
            
            {hasOdds && (
              <div className="text-neutral-400 dark:text-neutral-500 text-[9px] pt-0.5">
                Click to compare books
              </div>
            )}
          </div>
        }
        side="top"
        delayDuration={200}
      >
        <div
          className={cn(
            "w-full h-full tabular-nums transition-all flex flex-col items-center justify-center min-h-[72px] relative",
            // Background = HIT RATE ONLY (heat map)
            getHitRateBackground(threshold.hitRate),
            // Dead zone fading
            isDead && "opacity-25",
            // Interactive states - subtle hover
            hasOdds && !isDead && "cursor-pointer hover:brightness-95 dark:hover:brightness-110",
            isOpen && "ring-1 ring-inset ring-white/20"
          )}
          onClick={isDead ? undefined : handleCellClick}
        >
          {/* Edge Strip - thin vertical line on far right edge */}
          {/* Only visible based on minEdge filter - muted amber/gold */}
          {showEdgeStrip && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-[2px] bg-amber-400/50 dark:bg-amber-300/40"
            />
          )}

          {/* Hit Rate % - PRIMARY (centered, hero number) */}
          {threshold.hitRate !== null ? (
            <span className="text-sm font-medium leading-none text-white dark:text-white drop-shadow-sm">
              {threshold.hitRate}%
            </span>
          ) : (
            <span className="text-neutral-400 dark:text-neutral-500 text-[10px]">—</span>
          )}

          {/* Odds - SECONDARY (more visible, below hit rate) */}
          {hasOdds && !isDead && (
            <div className="flex items-center gap-1 mt-1">
              {bookLogo && <img src={bookLogo} alt={threshold.bestBook || ""} className="w-3.5 h-3.5 rounded-sm" />}
              <span className="text-[10px] text-white/80 dark:text-white/75 font-medium tabular-nums">
                {formatOdds(threshold.bestOdds)}
              </span>
            </div>
          )}
        </div>
      </Tooltip>

      {/* Odds Dropdown - dynamically positioned */}
      {isOpen && hasOdds && (
        <div 
          ref={dropdownRef}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-[60] min-w-[280px] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800",
            dropdownPosition === "below" ? "top-full mt-1" : "bottom-full mb-1"
          )}
        >
          {/* Header with favorite button */}
          <div className="mb-2 px-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                {playerName}
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {lineValue}+ {market.replace("player_", "").replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {oddsData && <span className="text-[10px] text-neutral-400">{oddsData.book_count} books</span>}
              {/* Favorite heart button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite();
                }}
                disabled={isTogglingFavorite}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  isFav 
                    ? "text-red-500 hover:text-red-600" 
                    : "text-neutral-400 hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                )}
                title={isFav ? "Remove from favorites" : "Add to favorites"}
              >
                {isTogglingFavorite ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFav ? (
                  <HeartFill className="w-4 h-4" />
                ) : (
                  <Heart className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          )}

          {/* Books list */}
          {!isLoading && sortedBooks.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {/* Column headers */}
              <div className="flex items-center justify-between px-2 py-1 text-[9px] uppercase tracking-wide text-neutral-400 border-b border-neutral-100 dark:border-neutral-700 mb-1">
                <span>Sportsbook</span>
                <div className="flex gap-2">
                  <span className="w-[50px] text-center">Over</span>
                  <span className="w-[50px] text-center">Under</span>
                </div>
              </div>

              {sortedBooks.map((book, idx) => {
                const bInfo = getSportsbookById(book.book);
                const bLogo = bInfo?.image?.light || null;
                const bName = bInfo?.name || book.book;
                const isBest = idx === 0;
                const hasOverLink = book.over !== null && (book.link_over || getBookFallbackUrl(book.book));
                const hasUnderLink = book.under !== null && (book.link_under || getBookFallbackUrl(book.book));

                return (
                  <div
                    key={book.book}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 transition-colors",
                      isBest && "bg-emerald-50 dark:bg-emerald-900/20"
                    )}
                  >
                    {/* Book info */}
                    <div className="flex items-center gap-2 min-w-0">
                      {bLogo ? (
                        <img src={bLogo} alt={bName} className="h-4 w-4 rounded object-contain flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-700 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[80px]">
                        {bName}
                      </span>
                      {isBest && (
                        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                          Best
                        </span>
                      )}
                    </div>

                    {/* Over/Under prices */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleBookClick(book, "over", e)}
                        disabled={book.over === null || !hasOverLink}
                        className={cn(
                          "w-[50px] px-1.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-0.5",
                          book.over !== null && hasOverLink
                            ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer"
                            : "opacity-40 cursor-default",
                          book.over !== null && book.over >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        {formatOdds(book.over)}
                        {hasOverLink && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                      </button>

                      <button
                        onClick={(e) => handleBookClick(book, "under", e)}
                        disabled={book.under === null || !hasUnderLink}
                        className={cn(
                          "w-[50px] px-1.5 py-1 rounded text-[10px] font-semibold transition-colors flex items-center justify-center gap-0.5",
                          book.under !== null && hasUnderLink
                            ? "hover:bg-rose-100 dark:hover:bg-rose-900/30 cursor-pointer"
                            : "opacity-40 cursor-default",
                          book.under !== null && book.under >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        {formatOdds(book.under)}
                        {hasUnderLink && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && sortedBooks.length === 0 && oddsData && (
            <div className="py-3 text-center text-xs text-neutral-500">
              No books available
            </div>
          )}
        </div>
      )}
    </td>
  );
}

// Helper function
function getBookFallbackUrl(bookId?: string): string | null {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  if (!sb) return null;
  return sb.affiliateLink || sb.links?.desktop || null;
}
