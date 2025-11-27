"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useNbaGames, type NbaGame } from "@/hooks/use-nba-games";
import { MapPin, ChevronDown, User } from "lucide-react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

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

  if (isLoading) {
    return (
      <div className="w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 h-full">
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
      <div className="w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 h-full">
        <p className="text-sm text-red-500">Failed to load games</p>
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 h-full overflow-y-auto">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Upcoming Games
          </h3>
          {/* Quick actions */}
          {selectedGameIds.length > 0 && selectedGameIds.length < games.length && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Today's Games Option */}
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

                    return (
                      <button
                        key={game.game_id}
                        type="button"
                        onClick={() => onToggleGame(game.game_id)}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-lg transition-all",
                          isSelected
                            ? "bg-brand/10 border-2 border-brand/40 shadow-sm"
                            : isNbaCup
                              ? "bg-amber-500/5 border border-amber-500/30 hover:border-amber-500/50"
                              : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          {/* Away Team */}
                          <div className="flex flex-col items-center w-14">
                            <img
                              src={`/team-logos/nba/${awayAbbr}.svg`}
                              alt={awayAbbr}
                              className="h-7 w-7 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <span className={cn(
                              "text-[11px] font-bold mt-1",
                              isSelected ? "text-brand" : "text-neutral-700 dark:text-neutral-300"
                            )}>
                              {awayAbbr}
                            </span>
                          </div>

                          {/* Time & Broadcast in center */}
                          <div className="relative flex flex-col items-center justify-center min-h-[32px]">
                            <span className={cn(
                              "text-[10px] font-semibold",
                              isSelected ? "text-brand/70" : "text-neutral-400 dark:text-neutral-500"
                            )}>
                              {formatGameTime(game.game_status, game.game_date)}
                            </span>
                            {/* Broadcast badges - positioned absolutely so they don't affect time layout */}
                            {(game.national_broadcast || game.neutral_site) && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.25 flex items-center gap-1">
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
                          <div className="flex flex-col items-center w-14">
                            <img
                              src={`/team-logos/nba/${homeAbbr}.svg`}
                              alt={homeAbbr}
                              className="h-7 w-7 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <span className={cn(
                              "text-[11px] font-bold mt-1",
                              isSelected ? "text-brand" : "text-neutral-700 dark:text-neutral-300"
                            )}>
                              {homeAbbr}
                            </span>
                          </div>
                        </div>
                      </button>
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

        {/* Players from selected game - shown when in drill-down view */}
        {selectedPlayer && uniqueGamePlayers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Game Players
              </h4>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                ({uniqueGamePlayers.length})
              </span>
            </div>
            
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {uniqueGamePlayers.map((player) => {
                const isCurrentPlayer = player.playerId === selectedPlayer.playerId;
                
                return (
                  <button
                    key={player.playerId}
                    type="button"
                    onClick={() => onPlayerSelect?.(player)}
                    disabled={isCurrentPlayer}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                      isCurrentPlayer
                        ? "bg-brand/10 border border-brand/30 cursor-default"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                    )}
                  >
                    {player.teamAbbr && (
                      <img
                        src={`/team-logos/nba/${player.teamAbbr.toUpperCase()}.svg`}
                        alt={player.teamAbbr}
                        className="h-4 w-4 object-contain shrink-0"
                      />
                    )}
                    <span className={cn(
                      "text-xs font-medium truncate",
                      isCurrentPlayer 
                        ? "text-brand" 
                        : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {player.playerName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
