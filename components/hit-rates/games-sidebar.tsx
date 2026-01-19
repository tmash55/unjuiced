"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNbaGames, type NbaGame } from "@/hooks/use-nba-games";
import { MapPin, ChevronDown, ChevronUp, HeartPulse, ArrowDown, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Chart from "@/icons/chart";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";

// NBA Team Colors (primary and secondary)
const NBA_TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ATL: { primary: "#E03A3E", secondary: "#C1D32F" },
  BKN: { primary: "#000000", secondary: "#FFFFFF" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  CHI: { primary: "#CE1141", secondary: "#000000" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  DAL: { primary: "#00538C", secondary: "#002B5E" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  DET: { primary: "#C8102E", secondary: "#1D42BA" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  HOU: { primary: "#CE1141", secondary: "#000000" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  LAL: { primary: "#552583", secondary: "#FDB927" },
  MEM: { primary: "#5D76A9", secondary: "#12173F" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  MIN: { primary: "#0C2340", secondary: "#236192" },
  NOP: { primary: "#0C2340", secondary: "#C8102E" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  POR: { primary: "#E03A3E", secondary: "#000000" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  SAS: { primary: "#C4CED4", secondary: "#000000" },
  TOR: { primary: "#CE1141", secondary: "#000000" },
  UTA: { primary: "#002B5C", secondary: "#00471B" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
};

// Get team color or fallback
const getTeamColor = (abbr: string): { primary: string; secondary: string } => {
  return NBA_TEAM_COLORS[abbr?.toUpperCase()] || { primary: "#6366f1", secondary: "#4f46e5" };
};

// Normalize game IDs for comparison (handles string/number and leading zeros)
const normalizeGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

// Check if a game has started (live or final) - exported for use in table filtering
export const hasGameStarted = (game: NbaGame): boolean => {
  const status = game.game_status?.toLowerCase() || "";
  
  // Check for final/ended games
  if (status.includes("final")) return true;
  
  // Check for live games (score format like "118-98" or "Q1", "Q2", etc.)
  if (/^\d+-\d+$/.test(status) || /^q[1-4]/i.test(status) || status.includes("halftime") || status.includes("ot")) {
    return true;
  }
  
  // Check if scheduled time has passed
  const timeMatch = game.game_status?.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (timeMatch && game.game_date) {
    const [, hours, minutes, period] = timeMatch;
    let hour = parseInt(hours, 10);
    if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (period.toLowerCase() === "am" && hour === 12) hour = 0;
    
    // Create a date object in ET (Eastern Time)
    const gameTime = new Date(`${game.game_date}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
    const now = new Date();
    
    // Game has started if current time is past game time
    return now >= gameTime;
  }
  
  return false;
};

interface GamePlayer {
  id: string;
  playerId: number;
  playerName: string;
  teamAbbr: string | null;
  market: string;
  line: number | null;
}

interface GamesSidebarProps {
  selectedGameIds: string[];
  onToggleGame: (gameId: string) => void;
  onSelectAll: () => void;
  onSelectTodaysGames: (gameIds: string[]) => void;
  onClearAll: () => void;
  // Drill-down related props
  selectedPlayer?: HitRateProfile | null;
  gamePlayers?: HitRateProfile[]; // All players from the selected game
  onPlayerSelect?: (player: HitRateProfile) => void;
  isLoadingPlayers?: boolean; // Show loading state for player list
  // Filter props (shared with table)
  hideNoOdds?: boolean;
  idsWithOdds?: Set<string>;
  // Collapse state
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Format game time - extract just the time portion
const formatGameTime = (gameStatus: string | null, gameDate: string | null): string => {
  if (!gameStatus) return "TBD";
  
  // Check if it's a final score or other non-time status
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;
  
  // Try to parse time like "7:00 pm ET" and convert to local
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create a date object in ET (Eastern Time)
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Format in user's local timezone
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Get day label (Today, Tomorrow, or day of week)
const getDayLabel = (gameDate: string): string => {
  const date = new Date(gameDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

// Check if this is a special season type (NBA Cup, etc.)
const isSpecialSeasonType = (seasonType: string | null): boolean => {
  if (!seasonType) return false;
  return seasonType.toLowerCase().includes("cup") || 
         seasonType.toLowerCase().includes("playoff") ||
         seasonType.toLowerCase().includes("all-star");
};

// Get season type badge
const getSeasonTypeBadge = (seasonType: string | null): { label: string; color: string } | null => {
  if (!seasonType) return null;
  const lower = seasonType.toLowerCase();
  if (lower.includes("cup")) return { label: "🏆 NBA Cup", color: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (lower.includes("playoff")) return { label: "🏀 Playoffs", color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30" };
  if (lower.includes("all-star")) return { label: "⭐ All-Star", color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" };
  return null;
};

export function GamesSidebar({ 
  selectedGameIds, 
  onToggleGame, 
  onSelectAll, 
  onSelectTodaysGames, 
  onClearAll,
  selectedPlayer,
  gamePlayers,
  onPlayerSelect,
  isLoadingPlayers = false,
  hideNoOdds,
  idsWithOdds,
  isCollapsed = false,
  onToggleCollapse,
}: GamesSidebarProps) {
  const { games, gamesDates, isLoading, error } = useNbaGames();
  const { hasAccess } = useHasHitRateAccess();
  
  // Track which game has its player list expanded (for drilldown mode)
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  
  // Refs for scrolling to games
  const gameRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if any games are special season type
  const specialSeasonType = games.find(g => isSpecialSeasonType(g.season_type))?.season_type ?? null;
  const seasonBadge = getSeasonTypeBadge(specialSeasonType);

  // Group games by date
  const gamesByDate = React.useMemo(() => {
    const grouped: Record<string, typeof games> = {};
    for (const game of games) {
      if (!grouped[game.game_date]) {
        grouped[game.game_date] = [];
      }
      grouped[game.game_date].push(game);
    }
    return grouped;
  }, [games]);

  // Track which dates have all games started (for auto-collapse)
  const datesWithAllStarted = React.useMemo(() => {
    const result = new Set<string>();
    for (const date of gamesDates) {
      const dateGames = gamesByDate[date] || [];
      if (dateGames.length > 0 && dateGames.every(game => hasGameStarted(game))) {
        result.add(date);
      }
    }
    return result;
  }, [gamesDates, gamesByDate]);

  // State to track manually expanded dates (for dates with all started games)
  const [expandedStartedDates, setExpandedStartedDates] = React.useState<Set<string>>(new Set());

  // Get today's/first day's games
  const todaysGames = React.useMemo(() => {
    if (gamesDates.length === 0) return [];
    const firstDate = gamesDates[0];
    return gamesByDate[firstDate] || [];
  }, [gamesDates, gamesByDate]);

  const todaysGameIds = React.useMemo(() => todaysGames.map(g => g.game_id), [todaysGames]);
  
  // Check if all today's games are selected
  const allTodaysSelected = selectedGameIds.length === 0 || 
    (todaysGameIds.length > 0 && todaysGameIds.every(id => selectedGameIds.includes(id)) && selectedGameIds.length === todaysGameIds.length);

  const handleSelectTodaysGames = () => {
    onSelectTodaysGames(todaysGameIds);
  };

  // Group players by unique player (dedupe markets for same player)
  const uniqueGamePlayers = React.useMemo(() => {
    if (!gamePlayers) return [];
    const seen = new Map<number, HitRateProfile>();
    for (const player of gamePlayers) {
      const pid = Number(player.playerId);
      if (!isNaN(pid) && !seen.has(pid)) {
        seen.set(pid, player);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      a.playerName.localeCompare(b.playerName)
    );
  }, [gamePlayers]);

  // Get the game ID for the selected player
  // Use nullish coalescing to preserve empty strings (though they shouldn't occur)
  const selectedPlayerGameId = selectedPlayer?.gameId ?? null;

  // Auto-expand the selected player's game when entering drilldown and scroll to it
  useEffect(() => {
    if (selectedPlayer && selectedPlayerGameId) {
      setExpandedGameId(normalizeGameId(selectedPlayerGameId));
      
      // Scroll to the game after a short delay to allow rendering
      requestAnimationFrame(() => {
        const gameElement = gameRefs.current.get(normalizeGameId(selectedPlayerGameId));
        const container = containerRef.current;
        if (gameElement && container) {
          // Calculate the scroll position within the container
          const containerRect = container.getBoundingClientRect();
          const gameRect = gameElement.getBoundingClientRect();
          const scrollTop = gameRect.top - containerRect.top + container.scrollTop - 80; // 80px offset for header
          
          // Smooth scroll within the sidebar container only
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      });
    } else {
      setExpandedGameId(null);
    }
  }, [selectedPlayer, selectedPlayerGameId]);

  // Handle game click - different behavior for drilldown vs table mode
  const handleGameClick = (gameId: string) => {
    if (selectedPlayer) {
      // In drilldown mode: toggle the player list expansion
      const normalizedId = normalizeGameId(gameId);
      setExpandedGameId(normalizeGameId(expandedGameId) === normalizedId ? null : normalizedId);
    } else {
      // In table mode: toggle game selection as before
      onToggleGame(gameId);
    }
  };

  // Get players for a specific game
  const getPlayersForGame = (gameId: string): HitRateProfile[] => {
    if (!gamePlayers) return [];
    const normalizedGameId = normalizeGameId(gameId);
    return gamePlayers.filter(p => normalizeGameId(p.gameId) === normalizedGameId);
  };

  // Get unique players for a game, sorted by seasonAvg (proxy for minutes/importance)
  const getUniquePlayersForGame = (gameId: string): HitRateProfile[] => {
    const players = getPlayersForGame(gameId);
    const seen = new Map<number, HitRateProfile>();
    for (const player of players) {
      const pid = Number(player.playerId);
      if (!isNaN(pid) && !seen.has(pid)) {
        seen.set(pid, player);
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      // Sort by seasonAvg descending (higher avg = more minutes typically)
      const avgA = a.seasonAvg ?? 0;
      const avgB = b.seasonAvg ?? 0;
      return avgB - avgA;
    });
  };

  // Collapsed state - show just the toggle button - Premium
  if (isCollapsed) {
    return (
      <div className="shrink-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/80 dark:from-neutral-900 dark:to-neutral-950/80 h-full flex flex-col items-center py-4 px-2 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
        <Tooltip content="Expand Games" side="right">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-700 transition-all duration-200 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm hover:shadow-md"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-[20%] min-w-[260px] shrink-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/80 dark:from-neutral-900 dark:to-neutral-950/80 p-4 h-full shadow-lg ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
          <div className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
          <div className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
          <div className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[20%] min-w-[260px] shrink-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/80 dark:from-neutral-900 dark:to-neutral-950/80 p-4 h-full shadow-lg ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
        <p className="text-sm font-medium text-red-500">Failed to load games</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-[20%] min-w-[260px] shrink-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-950/50 h-full overflow-y-auto drilldown-scroll shadow-lg ring-1 ring-black/[0.02] dark:ring-white/[0.02]"
    >
      <div className="p-4">
        {/* Header with collapse toggle - Premium */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            {selectedPlayer ? "Switch Game" : "Upcoming Games"}
          </h3>
          <div className="flex items-center gap-2">
            {/* Quick actions - only show in table mode */}
            {!selectedPlayer && selectedGameIds.length > 0 && selectedGameIds.length < games.length && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              >
                Clear
              </button>
            )}
            {onToggleCollapse && (
              <Tooltip content="Collapse" side="left">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-xl bg-white dark:bg-neutral-800 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-700 transition-all duration-200 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm hover:shadow-md"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Today's Games Option - only show in table mode - Premium */}
        {!selectedPlayer && (
          <button
            type="button"
            onClick={handleSelectTodaysGames}
            className={cn(
              "w-full text-center px-4 py-2.5 rounded-xl mb-4 transition-all duration-200 text-sm font-bold",
              allTodaysSelected
                ? "bg-gradient-to-r from-brand/15 to-brand/10 border border-brand/40 text-brand shadow-sm shadow-brand/10"
                : "bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 shadow-sm hover:shadow-md"
            )}
          >
            {gamesDates.length > 0 ? getDayLabel(gamesDates[0]) : "Today"}'s Games
            <span className="text-xs opacity-70 ml-1.5">({todaysGames.length})</span>
          </button>
        )}

        {/* Games List - Grouped by Date - Premium */}
        <div className="space-y-5">
          {gamesDates.map((date) => {
            const dateGames = gamesByDate[date] || [];
            const dayLabel = getDayLabel(date);
            const allStarted = datesWithAllStarted.has(date);
            const isDateExpanded = !allStarted || expandedStartedDates.has(date);
            
            const toggleDateExpanded = () => {
              setExpandedStartedDates(prev => {
                const next = new Set(prev);
                if (next.has(date)) {
                  next.delete(date);
                } else {
                  next.add(date);
                }
                return next;
              });
            };
            
            return (
              <div key={date}>
                {/* Date Header - Premium */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      allStarted ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-400"
                    )}>
                      {dayLabel}
                    </span>
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                      {dateGames.length}
                    </span>
                    {allStarted && isDateExpanded && (
                      <button
                        type="button"
                        onClick={toggleDateExpanded}
                        className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                      >
                        Hide
                      </button>
                    )}
                    <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 to-transparent dark:from-neutral-700" />
                  </div>
                  {/* All started - collapsed card - Premium */}
                  {allStarted && !isDateExpanded && (
                    <button
                      type="button"
                      onClick={toggleDateExpanded}
                      className="mt-3 w-full p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-200 group shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-1.5">
                            {dateGames.slice(0, 3).map((g, i) => (
                              <img
                                key={g.game_id}
                                src={`/team-logos/nba/${g.home_team_tricode}.svg`}
                                alt=""
                                className="w-6 h-6 rounded-full bg-white dark:bg-neutral-700 border-2 border-white dark:border-neutral-800 object-contain shadow-sm"
                                style={{ zIndex: 3 - i }}
                              />
                            ))}
                            {dateGames.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-600 border-2 border-white dark:border-neutral-800 flex items-center justify-center text-[9px] font-bold text-neutral-600 dark:text-neutral-300 shadow-sm">
                                +{dateGames.length - 3}
                              </div>
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block">
                              {dateGames.length} game{dateGames.length !== 1 ? "s" : ""} started
                            </span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              Tap to view
                            </span>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                      </div>
                    </button>
                  )}
                  {/* Show NBA Cup badge if any games on this date are NBA Cup - Premium */}
                  {isDateExpanded && (() => {
                    const cupGame = dateGames.find(g => isSpecialSeasonType(g.season_type));
                    const badge = cupGame ? getSeasonTypeBadge(cupGame.season_type) : null;
                    return badge ? (
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-1 rounded-lg border mt-2 inline-block shadow-sm",
                        badge.color
                      )}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                
                {/* Games for this date - collapsed if all started - Premium */}
                {isDateExpanded && (
                <div className="space-y-2.5">
                  {dateGames.map((game) => {
                    const homeAbbr = game.home_team_tricode || "TBD";
                    const awayAbbr = game.away_team_tricode || "TBD";
                    const isSelected = selectedGameIds.some(id => normalizeGameId(id) === normalizeGameId(game.game_id));
                    const isNbaCup = isSpecialSeasonType(game.season_type);
                    const normalizedSidebarGameId = normalizeGameId(game.game_id);
                    const isExpanded = normalizeGameId(expandedGameId) === normalizedSidebarGameId;
                    const isCurrentPlayerGame = normalizeGameId(selectedPlayerGameId) === normalizedSidebarGameId;
                    const gamePlayers = selectedPlayer ? getUniquePlayersForGame(game.game_id) : [];

                    // Get team colors for gradient bar
                    const homeColors = getTeamColor(homeAbbr);
                    const awayColors = getTeamColor(awayAbbr);

                    return (
                      <div 
                        key={game.game_id}
                        ref={(el) => {
                          if (el) {
                            gameRefs.current.set(normalizeGameId(game.game_id), el);
                          } else {
                            gameRefs.current.delete(normalizeGameId(game.game_id));
                          }
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleGameClick(game.game_id)}
                          className={cn(
                            "w-full transition-all duration-200 overflow-hidden",
                            // Rounded corners - remove bottom when expanded - Premium
                            isExpanded && selectedPlayer ? "rounded-t-xl" : "rounded-xl",
                            // Grey out games that have started
                            hasGameStarted(game) && "opacity-50",
                            // In drilldown mode: highlight the current player's game
                            selectedPlayer && isCurrentPlayerGame
                              ? isExpanded
                                ? "bg-gradient-to-br from-brand/10 to-brand/5 border-2 border-b-0 border-brand/40 shadow-md shadow-brand/10"
                                : "bg-gradient-to-br from-brand/10 to-brand/5 border-2 border-brand/40 shadow-md shadow-brand/10"
                              : selectedPlayer
                                ? isNbaCup
                                  ? isExpanded
                                    ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-b-0 border-amber-500/40"
                                    : "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/40 hover:border-amber-500/50 shadow-sm hover:shadow-md"
                                  : isExpanded
                                    ? "bg-white dark:bg-neutral-800 border border-b-0 border-neutral-200/80 dark:border-neutral-700/80"
                                    : "bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600 shadow-sm hover:shadow-md"
                                // In table mode: use selection state
                                : isSelected
                                  ? "bg-gradient-to-br from-brand/10 to-brand/5 border-2 border-brand/40 shadow-md shadow-brand/10"
                                  : isNbaCup
                                    ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/40 hover:border-amber-500/50 shadow-sm hover:shadow-md"
                                    : "bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600 shadow-sm hover:shadow-md"
                          )}
                        >
                          {/* Team color accent bar at top - Premium */}
                          <div 
                            className="h-1.5 w-full"
                            style={{
                              background: `linear-gradient(90deg, ${awayColors.primary} 0%, ${awayColors.primary} 45%, ${homeColors.primary} 55%, ${homeColors.primary} 100%)`,
                            }}
                          />
                          
                          {/* Card content with padding - Premium */}
                          <div className="px-3.5 py-3.5">
                          <div className="flex items-center justify-between">
                            {/* Away Team */}
                            <div className="flex flex-col items-center w-16">
                              <img
                                src={`/team-logos/nba/${awayAbbr}.svg`}
                                alt={awayAbbr}
                                className="h-10 w-10 object-contain drop-shadow-md transition-transform duration-200 hover:scale-105"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <span className={cn(
                                "text-xs font-bold mt-2 tracking-wide",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand" 
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {awayAbbr}
                              </span>
                            </div>

                            {/* Time & Broadcast in center - Premium */}
                            <div className="relative flex flex-col items-center justify-center min-h-[36px]">
                              <span className={cn(
                                "text-[11px] font-bold",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand/80" 
                                  : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {formatGameTime(game.game_status, game.game_date)}
                              </span>
                              {/* Broadcast badges - positioned absolutely so they don't affect time layout - Premium */}
                              {(game.national_broadcast || game.neutral_site) && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 flex items-center gap-1">
                                  {game.national_broadcast && (
                                    <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                                      {game.national_broadcast}
                                    </span>
                                  )}
                                  {game.neutral_site && (
                                    <Tooltip content="Neutral Site" side="top">
                                      <span className="flex items-center gap-0.5 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-1 py-0.5 rounded-md cursor-help shadow-sm">
                                        <MapPin className="h-2.5 w-2.5" />
                                      </span>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Home Team */}
                            <div className="flex flex-col items-center w-16">
                              <img
                                src={`/team-logos/nba/${homeAbbr}.svg`}
                                alt={homeAbbr}
                                className="h-10 w-10 object-contain drop-shadow-md transition-transform duration-200 hover:scale-105"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <span className={cn(
                                "text-xs font-bold mt-2 tracking-wide",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand" 
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {homeAbbr}
                              </span>
                            </div>
                          </div>

                          {/* Expand indicator for drilldown mode - Premium */}
                          {selectedPlayer && (isLoadingPlayers || gamePlayers.length > 0) && (
                            <div className="flex items-center justify-center mt-3 pt-2.5 border-t border-neutral-200/50 dark:border-neutral-700/50">
                              {isLoadingPlayers ? (
                                <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 animate-pulse">
                                  Loading players...
                                </span>
                              ) : (
                                <>
                                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mr-1">
                                    {gamePlayers.length} player{gamePlayers.length !== 1 ? 's' : ''}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3 text-neutral-400" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-neutral-400" />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          </div>
                        </button>

                        {/* Inline player list - integrated with game card, grouped by team */}
                        {selectedPlayer && isExpanded && gamePlayers.length > 0 && (() => {
                          // Don't filter players in the sidebar - show all players
                          const filteredPlayers = gamePlayers;
                          
                          // Group players by team and sort by seasonAvg (proxy for minutes/importance)
                          const playersByTeam = filteredPlayers.reduce((acc, player) => {
                            const team = player.teamAbbr?.toUpperCase() || "Unknown";
                            if (!acc[team]) acc[team] = [];
                            acc[team].push(player);
                            return acc;
                          }, {} as Record<string, typeof gamePlayers>);
                          
                          // Sort players within each team by seasonAvg (descending - higher avg = more minutes typically)
                          Object.keys(playersByTeam).forEach(team => {
                            playersByTeam[team].sort((a, b) => {
                              const avgA = a.seasonAvg ?? 0;
                              const avgB = b.seasonAvg ?? 0;
                              return avgB - avgA; // Descending order
                            });
                          });
                          
                          // Get team order: away team first (matches game card layout)
                          const teams = Object.keys(playersByTeam).sort((a, b) => {
                            if (a === awayAbbr) return -1;
                            if (b === awayAbbr) return 1;
                            if (a === homeAbbr) return 1;
                            if (b === homeAbbr) return -1;
                            return a.localeCompare(b);
                          });
                          
                          return (
                            <div className={cn(
                              "overflow-hidden rounded-b-lg -mt-1 border-x border-b",
                              isCurrentPlayerGame
                                ? "border-brand/40 bg-brand/5"
                                : isNbaCup
                                  ? "border-amber-500/30 bg-amber-500/5"
                                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                            )}>
                              <div className="max-h-[280px] overflow-y-auto drilldown-scroll relative">
                                {teams.map((team, teamIdx) => {
                                  const teamColors = getTeamColor(team);
                                  return (
                                  <div key={team} className="relative">
                                    {/* Team header with color accent - STICKY */}
                                    <div className={cn(
                                      "flex items-center gap-2.5 px-3 py-2 bg-neutral-100 dark:bg-neutral-900 relative z-10",
                                      "sticky top-0",
                                      teamIdx > 0 && "border-t border-neutral-200 dark:border-neutral-700"
                                    )}>
                                      {/* Left color accent bar */}
                                      <div 
                                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r-sm"
                                        style={{ backgroundColor: teamColors.primary }}
                                      />
                                      <img
                                        src={`/team-logos/nba/${team}.svg`}
                                        alt={team}
                                        className="h-5 w-5 object-contain ml-1"
                                      />
                                      <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                                        {team}
                                      </span>
                                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                                        ({playersByTeam[team].length})
                                      </span>
                                    </div>
                                    
                                    {/* Team players list */}
                                    {playersByTeam[team].map((player, playerIdx) => {
                                      // Use Number() to ensure consistent comparison - handles potential string/number mismatches
                                      const isCurrentPlayer = 
                                        player.playerId != null && 
                                        selectedPlayer?.playerId != null && 
                                        Number(player.playerId) === Number(selectedPlayer.playerId);
                                      const isLastInTeam = playerIdx === playersByTeam[team].length - 1;
                                      const isLastTeam = teamIdx === teams.length - 1;
                                      
                                      // Check if this player is locked for free users
                                      // Only the currently selected player is unlocked, all others are locked
                                      const isLocked = !hasAccess && !isCurrentPlayer;
                                      
                                      // Injury status helpers
                                      const injuryStatus = player.injuryStatus?.toLowerCase();
                                      const isQuestionable = injuryStatus === "questionable" || injuryStatus === "gtd" || injuryStatus === "game time decision";
                                      const isProbable = injuryStatus === "probable";
                                      const isOut = injuryStatus === "out";
                                      const hasInjury = isQuestionable || isProbable || isOut;
                                      
                                      // Check if player is in G League
                                      const isGLeague = player.injuryNotes?.toLowerCase().includes("g league") || 
                                                        player.injuryNotes?.toLowerCase().includes("g-league") ||
                                                        player.injuryNotes?.toLowerCase().includes("gleague");
                                      
                                      // Position now comes from depth_chart_pos (PG, SG, SF, PF, C)
                                      const position = player.position || "";
                                      
                                      // Locked player row with tooltip
                                      if (isLocked) {
                                        return (
                                          <Tooltip
                                            key={player.playerId}
                                            content={
                                              <div className="text-center py-1">
                                                <p className="font-semibold text-white">Upgrade to unlock</p>
                                                <p className="text-xs text-neutral-300 mt-0.5">See all players & insights</p>
                                              </div>
                                            }
                                            side="left"
                                          >
                                            <div
                                              className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all cursor-not-allowed",
                                                !(isLastInTeam && isLastTeam) && "border-b border-neutral-100 dark:border-neutral-700/50",
                                                "opacity-40 grayscale hover:opacity-60 hover:grayscale-0"
                                              )}
                                            >
                                              {/* Player headshot with blur */}
                                              <div className="relative shrink-0 rounded-full overflow-hidden ring-1 ring-neutral-200 dark:ring-neutral-700">
                                                <PlayerHeadshot
                                                  nbaPlayerId={player.playerId}
                                                  name={player.playerName}
                                                  size="tiny"
                                                  className="w-7 h-7 object-cover object-top blur-[1px]"
                                                />
                                              </div>
                                              
                                              {/* Position badge */}
                                              {position && (
                                                <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 w-5 shrink-0">
                                                  {position}
                                                </span>
                                              )}
                                              
                                              {/* Player name */}
                                              <span className="text-sm font-medium truncate flex-1 text-neutral-400 dark:text-neutral-500">
                                                {player.playerName}
                                              </span>
                                              
                                              {/* Lock icon */}
                                              <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
                                            </div>
                                          </Tooltip>
                                        );
                                      }
                                      
                                      return (
                                        <button
                                          key={player.playerId}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onPlayerSelect?.(player);
                                          }}
                                          disabled={isCurrentPlayer}
                                          className={cn(
                                            "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all",
                                            !(isLastInTeam && isLastTeam) && "border-b border-neutral-100 dark:border-neutral-700/50",
                                            isCurrentPlayer
                                              ? "bg-brand/10"
                                              : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer",
                                            isOut && "opacity-50"
                                          )}
                                        >
                                          {/* Player headshot */}
                                          <div className={cn(
                                            "relative shrink-0 rounded-full overflow-hidden ring-1",
                                            isCurrentPlayer 
                                              ? "ring-brand" 
                                              : "ring-neutral-200 dark:ring-neutral-700"
                                          )}>
                                            <PlayerHeadshot
                                              nbaPlayerId={player.playerId}
                                              name={player.playerName}
                                              size="tiny"
                                              className="w-7 h-7 object-cover object-top"
                                            />
                                          </div>
                                          
                                          {/* Position badge */}
                                          {position && (
                                            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 w-5 shrink-0">
                                              {position}
                                            </span>
                                          )}
                                          
                                          {/* Player name */}
                                          <span className={cn(
                                            "text-sm font-medium truncate flex-1",
                                            isCurrentPlayer 
                                              ? "text-brand font-semibold" 
                                              : "text-neutral-700 dark:text-neutral-300"
                                          )}>
                                            {player.playerName}
                                          </span>
                                          
                                          {/* Injury / G League icon */}
                                          {hasInjury && (
                                            <Tooltip
                                              content={isGLeague 
                                                ? `G League${player.injuryNotes ? ` - ${player.injuryNotes}` : ""}`
                                                : `${player.injuryStatus ? player.injuryStatus.charAt(0).toUpperCase() + player.injuryStatus.slice(1).toLowerCase() : ''}${player.injuryNotes ? ` - ${player.injuryNotes}` : ""}`
                                              }
                                              side="left"
                                            >
                                              {isGLeague ? (
                                                <ArrowDown className="h-3.5 w-3.5 shrink-0 cursor-help text-blue-500" />
                                              ) : (
                                                <HeartPulse className={cn(
                                                  "h-3.5 w-3.5 shrink-0 cursor-help",
                                                  isOut && "text-red-500",
                                                  isQuestionable && "text-amber-500",
                                                  isProbable && "text-emerald-500"
                                                )} />
                                              )}
                                            </Tooltip>
                                          )}
                                          
                                          {/* Current player indicator */}
                                          {isCurrentPlayer && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );})}
                                
                                {/* Upgrade CTA for free users with locked players */}
                                {!hasAccess && filteredPlayers.length > 1 && (
                                  <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-[var(--color-brand)]/5 via-[var(--color-brand)]/10 to-[var(--color-brand)]/5">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Chart className="h-4 w-4 stroke-[var(--color-brand)]" />
                                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                        Unlock all players
                                      </span>
                                    </div>
                                    <ButtonLink
                                      href="/pricing"
                                      variant="primary"
                                      className="w-full justify-center rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                                    >
                                      Unlock Now
                                    </ButtonLink>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>

        {games.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
            No games scheduled
          </p>
        )}
      </div>
    </div>
  );
}
