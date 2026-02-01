"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import { type NbaGame } from "@/hooks/use-nba-games";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// Normalize game IDs for comparison - exported for use in filtering
export const normalizeGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

// Check if a game has started
export const hasGameStarted = (game: NbaGame): boolean => {
  const status = game.game_status?.toLowerCase() || "";
  if (status.includes("final")) return true;
  if (/^\d+-\d+$/.test(status) || /^q[1-4]/i.test(status) || status.includes("halftime") || status.includes("ot")) {
    return true;
  }
  const timeMatch = game.game_status?.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (timeMatch && game.game_date) {
    const [, hours, minutes, period] = timeMatch;
    let hour = parseInt(hours, 10);
    if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (period.toLowerCase() === "am" && hour === 12) hour = 0;
    const gameTime = new Date(`${game.game_date}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
    return new Date() >= gameTime;
  }
  return false;
};

// Format game time
const formatGameTime = (gameStatus: string | null): string => {
  if (!gameStatus) return "TBD";
  if (gameStatus.toLowerCase().includes("final")) return "Final";
  if (/^\d+-\d+$/.test(gameStatus)) return gameStatus;
  
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  const etDate = new Date();
  etDate.setHours(hour, parseInt(minutes), 0, 0);
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Get day label
const getDayLabel = (gameDate: string): string => {
  const date = new Date(gameDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

interface GamesFilterDropdownProps {
  games: NbaGame[];
  className?: string;
  // Multi-select mode (default)
  selectedGameIds?: string[];
  onToggleGame?: (gameId: string) => void;
  onSelectAll?: () => void;
  // Single-select mode
  singleSelect?: boolean;
  selectedGameId?: string | null;
  onGameSelect?: (gameId: string | null) => void;
  // Compact mode for smaller filter rows (matrix, etc.)
  compact?: boolean;
}

export function GamesFilterDropdown({
  games,
  className,
  // Multi-select props
  selectedGameIds = [],
  onToggleGame,
  onSelectAll,
  // Single-select props
  singleSelect = false,
  selectedGameId = null,
  onGameSelect,
  // Compact mode
  compact = false,
}: GamesFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Group games by date
  const gamesByDate = useMemo(() => {
    const grouped: Record<string, NbaGame[]> = {};
    games.forEach((game) => {
      const date = game.game_date || "Unknown";
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(game);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  // For single-select mode, determine if a game is selected
  const isSelected = (gameId: string) => {
    if (singleSelect) {
      return selectedGameId === gameId;
    }
    if (selectedGameIds.length === 0) return false; // All games = nothing specifically selected
    return selectedGameIds.includes(normalizeGameId(gameId));
  };

  // Determine "all games" state
  const allGamesSelected = singleSelect 
    ? selectedGameId === null 
    : selectedGameIds.length === 0;
  const selectedCount = singleSelect ? (selectedGameId ? 1 : 0) : selectedGameIds.length;

  // Handle clearing selection (select all games)
  const handleSelectAll = () => {
    if (singleSelect) {
      onGameSelect?.(null);
    } else {
      onSelectAll?.();
    }
  };

  // Handle game click
  const handleGameClick = (gameId: string) => {
    if (singleSelect) {
      onGameSelect?.(gameId);
      setIsOpen(false); // Close dropdown on single-select
    } else {
      onToggleGame?.(gameId);
    }
  };

  // Get display text for the trigger
  const triggerText = useMemo(() => {
    if (allGamesSelected) return "All Games";
    if (singleSelect && selectedGameId) {
      const game = games.find(g => normalizeGameId(g.game_id) === selectedGameId);
      if (game) return `${game.away_team_tricode} @ ${game.home_team_tricode}`;
    }
    if (selectedCount === 1 && selectedGameIds.length > 0) {
      const game = games.find(g => normalizeGameId(g.game_id) === selectedGameIds[0]);
      if (game) return `${game.away_team_tricode} @ ${game.home_team_tricode}`;
    }
    return `${selectedCount} Games`;
  }, [allGamesSelected, selectedCount, selectedGameIds, selectedGameId, games, singleSelect]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg",
            "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
            "border border-neutral-200 dark:border-neutral-700",
            "font-medium text-neutral-700 dark:text-neutral-300",
            "transition-colors",
            // Compact mode for smaller filter rows
            compact ? "px-3 py-1.5 text-xs" : "px-3 py-2 h-10 text-sm",
            !allGamesSelected && "border-[#0EA5E9]/50 dark:border-[#7DD3FC]/50 bg-[#0EA5E9]/5 dark:bg-[#7DD3FC]/5",
            className
          )}
        >
          <span className="truncate max-w-[120px]">{triggerText}</span>
          {!allGamesSelected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSelectAll();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelectAll();
                }
              }}
              className="p-0.5 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[280px] max-h-[400px] overflow-hidden p-0"
      >
        {/* All Games Option */}
        <DropdownMenuItem
          onClick={() => {
            handleSelectAll();
            setIsOpen(false);
          }}
          className={cn(
            "flex items-center justify-between px-3 py-2 cursor-pointer",
            allGamesSelected && "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10"
          )}
        >
          <span className={cn(
            "font-medium",
            allGamesSelected ? "text-[#0EA5E9] dark:text-[#7DD3FC]" : "text-neutral-900 dark:text-white"
          )}>
            All Games
          </span>
          {allGamesSelected && (
            <Check className="h-4 w-4 text-[#0EA5E9] dark:text-[#7DD3FC]" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Games List */}
        <div className="overflow-y-auto max-h-[320px]">
          {gamesByDate.map(([date, dateGames]) => (
            <React.Fragment key={date}>
              <DropdownMenuLabel className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50">
                {getDayLabel(date)}
              </DropdownMenuLabel>
              
              {dateGames.map((game) => {
                const gameId = normalizeGameId(game.game_id);
                const selected = isSelected(gameId);
                const started = hasGameStarted(game);
                
                return (
                  <DropdownMenuItem
                    key={game.game_id}
                    onClick={(e) => {
                      e.preventDefault();
                      handleGameClick(gameId);
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 cursor-pointer",
                      selected && "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10",
                      started && !selected && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <img
                          src={getTeamLogoUrl(game.away_team_tricode || "", "nba")}
                          alt={game.away_team_tricode || ""}
                          className="h-4 w-4 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          {game.away_team_tricode}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400">@</span>
                      <div className="flex items-center gap-1">
                        <img
                          src={getTeamLogoUrl(game.home_team_tricode || "", "nba")}
                          alt={game.home_team_tricode || ""}
                          className="h-4 w-4 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          {game.home_team_tricode}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {formatGameTime(game.game_status)}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 text-[#0EA5E9] dark:text-[#7DD3FC]" />
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
