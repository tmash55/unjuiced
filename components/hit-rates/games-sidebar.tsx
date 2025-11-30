"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNbaGames, type NbaGame } from "@/hooks/use-nba-games";
import { MapPin, ChevronDown, ChevronUp, HeartPulse } from "lucide-react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { PlayerHeadshot } from "@/components/player-headshot";

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
}: GamesSidebarProps) {
  const { games, gamesDates, isLoading, error } = useNbaGames();
  
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
      if (!seen.has(player.playerId)) {
        seen.set(player.playerId, player);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      a.playerName.localeCompare(b.playerName)
    );
  }, [gamePlayers]);

  // Get the game ID for the selected player
  const selectedPlayerGameId = selectedPlayer?.gameId || null;

  // Auto-expand the selected player's game when entering drilldown and scroll to it
  useEffect(() => {
    if (selectedPlayer && selectedPlayerGameId) {
      setExpandedGameId(selectedPlayerGameId);
      
      // Scroll to the game after a short delay to allow rendering
      requestAnimationFrame(() => {
        const gameElement = gameRefs.current.get(selectedPlayerGameId);
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
      setExpandedGameId(expandedGameId === gameId ? null : gameId);
    } else {
      // In table mode: toggle game selection as before
      onToggleGame(gameId);
    }
  };

  // Get players for a specific game
  const getPlayersForGame = (gameId: string): HitRateProfile[] => {
    if (!gamePlayers) return [];
    // Filter to players from this specific game
    const filtered = gamePlayers.filter(p => p.gameId === gameId);
    
    // Debug: log when few players found
    if (filtered.length < 50 && gamePlayers.length > 0) {
      const uniqueGameIds = [...new Set(gamePlayers.map(p => p.gameId))];
      console.log(`[Sidebar Debug] Looking for gameId: ${gameId}`);
      console.log(`[Sidebar Debug] Found ${filtered.length} profiles from ${gamePlayers.length} total`);
      console.log(`[Sidebar Debug] Available gameIds in data:`, uniqueGameIds.slice(0, 5));
    }
    
    return filtered;
  };

  // Get unique players for a game
  const getUniquePlayersForGame = (gameId: string): HitRateProfile[] => {
    const players = getPlayersForGame(gameId);
    const seen = new Map<number, HitRateProfile>();
    for (const player of players) {
      if (!seen.has(player.playerId)) {
        seen.set(player.playerId, player);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      a.playerName.localeCompare(b.playerName)
    );
  };

  if (isLoading) {
    return (
      <div className="w-[20%] min-w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[20%] min-w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 h-full">
        <p className="text-sm text-red-500">Failed to load games</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-[20%] min-w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 h-full overflow-y-auto drilldown-scroll"
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {selectedPlayer ? "Switch Game" : "Upcoming Games"}
          </h3>
          {/* Quick actions - only show in table mode */}
          {!selectedPlayer && selectedGameIds.length > 0 && selectedGameIds.length < games.length && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Today's Games Option - only show in table mode */}
        {!selectedPlayer && (
          <button
            type="button"
            onClick={handleSelectTodaysGames}
            className={cn(
              "w-full text-center px-3 py-2 rounded-lg mb-3 transition-all text-sm font-semibold",
              allTodaysSelected
                ? "bg-brand/10 border border-brand/30 text-brand"
                : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            )}
          >
            {gamesDates.length > 0 ? getDayLabel(gamesDates[0]) : "Today"}'s Games
            <span className="text-xs opacity-70 ml-1.5">({todaysGames.length})</span>
          </button>
        )}

        {/* Games List - Grouped by Date */}
        <div className="space-y-4">
          {gamesDates.map((date) => {
            const dateGames = gamesByDate[date] || [];
            const dayLabel = getDayLabel(date);
            
            return (
              <div key={date}>
                {/* Date Header */}
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      {dayLabel}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      ({dateGames.length})
                    </span>
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                  {/* Show NBA Cup badge if any games on this date are NBA Cup */}
                  {(() => {
                    const cupGame = dateGames.find(g => isSpecialSeasonType(g.season_type));
                    const badge = cupGame ? getSeasonTypeBadge(cupGame.season_type) : null;
                    return badge ? (
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1.5 inline-block",
                        badge.color
                      )}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                
                {/* Games for this date */}
                <div className="space-y-2">
                  {dateGames.map((game) => {
                    const homeAbbr = game.home_team_tricode || "TBD";
                    const awayAbbr = game.away_team_tricode || "TBD";
                    const isSelected = selectedGameIds.includes(game.game_id);
                    const isNbaCup = isSpecialSeasonType(game.season_type);
                    const isExpanded = expandedGameId === game.game_id;
                    const isCurrentPlayerGame = selectedPlayerGameId === game.game_id;
                    const gamePlayers = selectedPlayer ? getUniquePlayersForGame(game.game_id) : [];

                    // Get team colors for gradient bar
                    const homeColors = getTeamColor(homeAbbr);
                    const awayColors = getTeamColor(awayAbbr);

                    return (
                      <div 
                        key={game.game_id}
                        ref={(el) => {
                          if (el) {
                            gameRefs.current.set(game.game_id, el);
                          } else {
                            gameRefs.current.delete(game.game_id);
                          }
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleGameClick(game.game_id)}
                          className={cn(
                            "w-full transition-all overflow-hidden",
                            // Rounded corners - remove bottom when expanded
                            isExpanded && selectedPlayer ? "rounded-t-lg" : "rounded-lg",
                            // In drilldown mode: highlight the current player's game
                            selectedPlayer && isCurrentPlayerGame
                              ? isExpanded
                                ? "bg-brand/10 border-2 border-b-0 border-brand/40 shadow-sm"
                                : "bg-brand/10 border-2 border-brand/40 shadow-sm"
                              : selectedPlayer
                                ? isNbaCup
                                  ? isExpanded
                                    ? "bg-amber-500/5 border border-b-0 border-amber-500/30"
                                    : "bg-amber-500/5 border border-amber-500/30 hover:border-amber-500/50"
                                  : isExpanded
                                    ? "bg-white dark:bg-neutral-800 border border-b-0 border-neutral-200 dark:border-neutral-700"
                                    : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                                // In table mode: use selection state
                                : isSelected
                                  ? "bg-brand/10 border-2 border-brand/40 shadow-sm"
                                  : isNbaCup
                                    ? "bg-amber-500/5 border border-amber-500/30 hover:border-amber-500/50"
                                    : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                          )}
                        >
                          {/* Team color accent bar at top */}
                          <div 
                            className="h-1 w-full"
                            style={{
                              background: `linear-gradient(90deg, ${awayColors.primary} 0%, ${awayColors.primary} 45%, ${homeColors.primary} 55%, ${homeColors.primary} 100%)`,
                            }}
                          />
                          
                          {/* Card content with padding */}
                          <div className="px-3 py-3">
                          <div className="flex items-center justify-between">
                            {/* Away Team */}
                            <div className="flex flex-col items-center w-16">
                              <img
                                src={`/team-logos/nba/${awayAbbr}.svg`}
                                alt={awayAbbr}
                                className="h-9 w-9 object-contain drop-shadow-sm"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <span className={cn(
                                "text-xs font-semibold mt-1.5 tracking-wide",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand" 
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {awayAbbr}
                              </span>
                            </div>

                            {/* Time & Broadcast in center */}
                            <div className="relative flex flex-col items-center justify-center min-h-[36px]">
                              <span className={cn(
                                "text-[11px] font-semibold",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand/70" 
                                  : "text-neutral-400 dark:text-neutral-500"
                              )}>
                                {formatGameTime(game.game_status, game.game_date)}
                              </span>
                              {/* Broadcast badges - positioned absolutely so they don't affect time layout */}
                              {(game.national_broadcast || game.neutral_site) && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 flex items-center gap-1">
                                  {game.national_broadcast && (
                                    <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                      {game.national_broadcast}
                                    </span>
                                  )}
                                  {game.neutral_site && (
                                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                                      <MapPin className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Home Team */}
                            <div className="flex flex-col items-center w-16">
                              <img
                                src={`/team-logos/nba/${homeAbbr}.svg`}
                                alt={homeAbbr}
                                className="h-9 w-9 object-contain drop-shadow-sm"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <span className={cn(
                                "text-xs font-semibold mt-1.5 tracking-wide",
                                (selectedPlayer ? isCurrentPlayerGame : isSelected) 
                                  ? "text-brand" 
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {homeAbbr}
                              </span>
                            </div>
                          </div>

                          {/* Expand indicator for drilldown mode */}
                          {selectedPlayer && gamePlayers.length > 0 && (
                            <div className="flex items-center justify-center mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/50">
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mr-1">
                                {gamePlayers.length} players
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3 text-neutral-400" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-neutral-400" />
                              )}
                            </div>
                          )}
                          </div>
                        </button>

                        {/* Inline player list - integrated with game card, grouped by team */}
                        {selectedPlayer && isExpanded && gamePlayers.length > 0 && (() => {
                          // Group players by team
                          const playersByTeam = gamePlayers.reduce((acc, player) => {
                            const team = player.teamAbbr?.toUpperCase() || "Unknown";
                            if (!acc[team]) acc[team] = [];
                            acc[team].push(player);
                            return acc;
                          }, {} as Record<string, typeof gamePlayers>);
                          
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
                              <div className="max-h-[280px] overflow-y-auto drilldown-scroll">
                                {teams.map((team, teamIdx) => {
                                  const teamColors = getTeamColor(team);
                                  return (
                                  <div key={team}>
                                    {/* Team header with color accent */}
                                    <div className={cn(
                                      "flex items-center gap-2.5 px-3 py-2 bg-neutral-100/90 dark:bg-neutral-900/70 relative",
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
                                      const isCurrentPlayer = player.playerId === selectedPlayer.playerId;
                                      const isLastInTeam = playerIdx === playersByTeam[team].length - 1;
                                      const isLastTeam = teamIdx === teams.length - 1;
                                      
                                      // Injury status helpers
                                      const injuryStatus = player.injuryStatus?.toLowerCase();
                                      const isQuestionable = injuryStatus === "questionable" || injuryStatus === "gtd" || injuryStatus === "game time decision";
                                      const isProbable = injuryStatus === "probable";
                                      const isOut = injuryStatus === "out";
                                      const hasInjury = isQuestionable || isProbable || isOut;
                                      
                                      // Position now comes from depth_chart_pos (PG, SG, SF, PF, C)
                                      const position = player.position || "";
                                      
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
                                          
                                          {/* Injury icon */}
                                          {hasInjury && (
                                            <HeartPulse className={cn(
                                              "h-3.5 w-3.5 shrink-0",
                                              isOut && "text-red-500",
                                              isQuestionable && "text-amber-500",
                                              isProbable && "text-emerald-500"
                                            )} />
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
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
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
