"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, RefreshCw, X, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { MobileOddsCard } from "./mobile-odds-card";
import { GameDetailSheet } from "./game-detail-sheet";
import type { OddsScreenItem, OddsScreenEvent } from "../types/odds-screen-types";
import { LogoSVG } from "@/components/logo";
import { LoadingState } from "@/components/common/loading-state";

// Available sports
const SPORTS = [
  { key: "nba", label: "NBA" },
  { key: "ncaab", label: "NCAAB" },
  { key: "nhl", label: "NHL" },
  { key: "ncaabaseball", label: "NCAA Base" },
  { key: "soccer_epl", label: "EPL" },
  { key: "soccer_laliga", label: "LaLiga" },
  { key: "soccer_mls", label: "MLS" },
  { key: "soccer_ucl", label: "UCL" },
  { key: "soccer_uel", label: "UEL" },
  { key: "tennis_atp", label: "ATP" },
  { key: "tennis_wta", label: "WTA" },
  { key: "tennis_challenger", label: "Challenger" },
  { key: "tennis_itf_men", label: "ITF Men" },
  { key: "tennis_itf_women", label: "ITF Women" },
  { key: "tennis_utr_men", label: "UTR Men" },
  { key: "tennis_utr_women", label: "UTR Women" },
  { key: "ufc", label: "UFC" },
  { key: "mlb", label: "MLB", disabled: true },
  { key: "wnba", label: "WNBA", disabled: true },
  { key: "ncaaf", label: "NCAAF", disabled: true },
  { key: "nfl", label: "NFL", disabled: true },
];

interface MobileOddsViewProps {
  moneylineData: OddsScreenItem[];
  loading: boolean;
  sport: string;
  scope: "pregame" | "live";
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  // New props for navigation
  onSportChange: (sport: string) => void;
  onScopeChange: (scope: "pregame" | "live") => void;
  connectionStatus?: {
    connected: boolean;
    reconnecting: boolean;
  };
}

// Group items by game
interface GameGroup {
  game: OddsScreenEvent;
  items: OddsScreenItem[];
}

function groupItemsByGame(items: OddsScreenItem[]): GameGroup[] {
  const gameMap = new Map<string, GameGroup>();
  
  items.forEach(item => {
    const gameId = item.event?.id;
    if (!gameId) return;
    
    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, {
        game: item.event,
        items: [],
      });
    }
    gameMap.get(gameId)!.items.push(item);
  });
  
  // Sort by start time
  return Array.from(gameMap.values()).sort((a, b) => {
    return new Date(a.game.startTime).getTime() - new Date(b.game.startTime).getTime();
  });
}

// Group games by date
function groupGamesByDate(games: GameGroup[]): Map<string, GameGroup[]> {
  const groups = new Map<string, GameGroup[]>();
  
  games.forEach(gameGroup => {
    const date = new Date(gameGroup.game.startTime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = "TODAY";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      label = "TOMORROW";
    } else {
      label = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
    }
    
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(gameGroup);
  });
  
  return groups;
}

// Skeleton for loading state
function GameCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div 
      className="bg-white/90 dark:bg-neutral-900/80 rounded-2xl overflow-hidden border border-neutral-200/60 dark:border-neutral-800/60 animate-pulse shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-neutral-200/70 dark:bg-neutral-700/60" />
              <div className="h-5 w-12 bg-neutral-200/70 dark:bg-neutral-700/60 rounded" />
            </div>
            <div className="h-4 w-4 bg-neutral-200/70 dark:bg-neutral-700/60 rounded" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-neutral-200/70 dark:bg-neutral-700/60" />
              <div className="h-5 w-12 bg-neutral-200/70 dark:bg-neutral-700/60 rounded" />
            </div>
          </div>
          <div className="h-4 w-16 bg-neutral-200/70 dark:bg-neutral-700/60 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-neutral-200/70 dark:bg-neutral-700/60 rounded-xl" />
          <div className="flex-1 h-10 bg-neutral-200/70 dark:bg-neutral-700/60 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Connection Status Indicator
function ConnectionIndicator({ status }: { status?: { connected: boolean; reconnecting: boolean } }) {
  if (!status) return null;
  
  const { connected, reconnecting } = status;
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "w-2 h-2 rounded-full",
        connected ? "bg-emerald-500" : reconnecting ? "bg-amber-500 animate-pulse" : "bg-red-500"
      )} />
      {reconnecting && (
        <span className="text-[10px] text-amber-500 font-medium">Reconnecting...</span>
      )}
    </div>
  );
}

// Scope Dropdown
function ScopeDropdown({ 
  scope, 
  onScopeChange 
}: { 
  scope: "pregame" | "live"; 
  onScopeChange: (scope: "pregame" | "live") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (newScope: "pregame" | "live") => {
    onScopeChange(newScope);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.97]",
          "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        )}
      >
        <span>{scope === "pregame" ? "Pre-Game" : "Live"}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden min-w-[120px]"
          >
            <button
              onClick={() => handleSelect("pregame")}
              className={cn(
                "w-full px-4 py-2.5 text-left text-sm font-medium transition-colors",
                scope === "pregame"
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              )}
            >
              Pre-Game
            </button>
            <button
              onClick={() => handleSelect("live")}
              className={cn(
                "w-full px-4 py-2.5 text-left text-sm font-medium transition-colors",
                scope === "live"
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              )}
            >
              Live
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sport Chips
function SportChips({
  selectedSport,
  onSportChange,
}: {
  selectedSport: string;
  onSportChange: (sport: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected sport into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedSport]);

  return (
    <div 
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2"
    >
      {SPORTS.map((sport) => {
        const isSelected = selectedSport.toLowerCase() === sport.key;
        const isDisabled = sport.disabled;
        return (
          <button
            key={sport.key}
            ref={isSelected ? selectedRef : null}
            onClick={() => {
              if (!isDisabled) onSportChange(sport.key);
            }}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap active:scale-[0.95]",
              isSelected
                ? "bg-brand text-neutral-900 border border-brand shadow-sm shadow-brand/25"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
              isDisabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            {sport.label}
          </button>
        );
      })}
    </div>
  );
}

export function MobileOddsView({
  moneylineData,
  loading,
  sport,
  scope,
  searchQuery = "",
  onSearchChange,
  onRefresh,
  isRefreshing,
  onSportChange,
  onScopeChange,
  connectionStatus,
}: MobileOddsViewProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameGroup | null>(null);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return moneylineData;
    const query = searchQuery.toLowerCase();
    return moneylineData.filter(item => {
      const homeTeam = (item.event?.homeTeam || "").toLowerCase();
      const awayTeam = (item.event?.awayTeam || "").toLowerCase();
      return homeTeam.includes(query) || awayTeam.includes(query);
    });
  }, [moneylineData, searchQuery]);

  // Group data by game, then by date
  const gameGroups = useMemo(() => groupItemsByGame(filteredData), [filteredData]);
  const groupedByDate = useMemo(() => groupGamesByDate(gameGroups), [gameGroups]);

  // Handle game card tap
  const handleGameTap = (gameGroup: GameGroup) => {
    setSelectedGame(gameGroup);
  };

  // Handle closing game detail sheet
  const handleCloseSheet = () => {
    setSelectedGame(null);
  };

  // Calculate header height for sticky positioning
  // App has a 48px mobile header at top, so we start below that
  const appHeaderHeight = 48; // App's mobile header (h-12)
  const pageHeaderHeight = 44; // Our "Odds" header
  const sportChipsHeight = 44; // Sport chips row
  const filtersHeight = 52; // Filters row
  const searchHeight = showSearch ? 52 : 0; // Search input
  const totalHeaderHeight = pageHeaderHeight + sportChipsHeight + filtersHeight + searchHeight;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Page Header - Fixed below app's mobile header */}
      <div className="fixed top-12 left-0 right-0 z-50 h-11 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
          Compare Odds
        </h1>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* Sport Chips - Fixed below page header */}
      <div className="fixed top-[92px] left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        <SportChips selectedSport={sport} onSportChange={onSportChange} />
      </div>

      {/* Filters Row - Fixed below sport chips */}
      <div className="fixed top-[136px] left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Left: Scope Dropdown */}
          <ScopeDropdown scope={scope} onScopeChange={onScopeChange} />

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                "p-2 rounded-lg transition-colors active:scale-[0.95]",
                showSearch 
                  ? "bg-emerald-500 text-white" 
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              )}
            >
              {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
            
            {/* Refresh */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 active:scale-[0.95]"
              >
                <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder="Search teams..."
                    className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer for fixed headers */}
      <div style={{ paddingTop: `${totalHeaderHeight}px` }} />

      {/* Game Count */}
      <div className="px-4 py-2">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-semibold text-neutral-900 dark:text-white">{gameGroups.length}</span>
          {" "}game{gameGroups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {loading && moneylineData.length === 0 ? (
          // Loading State
          <div className="space-y-4">
            <LoadingState message="Loading games..." compact />
            {[0, 100, 200, 300].map((delay, i) => (
              <GameCardSkeleton key={i} delay={delay} />
            ))}
          </div>
        ) : gameGroups.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-center font-medium">No games found</p>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm text-center mt-1">
              {searchQuery ? "Try adjusting your search" : "Check back later for more games"}
            </p>
          </div>
        ) : (
          // Games List grouped by date
          <div className="space-y-4">
            {Array.from(groupedByDate.entries()).map(([dateLabel, games]) => (
              <div key={dateLabel}>
                {/* Date Header */}
                <div 
                  className="sticky z-30 -mx-4 px-4 py-2 bg-neutral-100/95 dark:bg-neutral-900/95 backdrop-blur-sm"
                  style={{ top: `${totalHeaderHeight}px` }}
                >
                  <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {dateLabel}
                  </h3>
                </div>

                {/* Game Cards */}
                <div className="space-y-3 mt-3">
                  {games.map((gameGroup) => (
                    <MobileOddsCard
                      key={gameGroup.game.id}
                      game={gameGroup.game}
                      items={gameGroup.items}
                      sport={sport}
                      onTap={() => handleGameTap(gameGroup)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Game Detail Sheet */}
      {selectedGame && (
        <GameDetailSheet
          game={selectedGame.game}
          moneylineItem={selectedGame.items[0]}
          sport={sport}
          scope={scope}
          isOpen={!!selectedGame}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
}
