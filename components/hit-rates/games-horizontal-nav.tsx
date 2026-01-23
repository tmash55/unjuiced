"use client";

import React, { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type NbaGame } from "@/hooks/use-nba-games";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";

// NBA Team Colors for accents
const NBA_TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E", BKN: "#000000", BOS: "#007A33", CHA: "#1D1160",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#0E2240",
  DET: "#C8102E", GSW: "#1D428A", HOU: "#CE1141", IND: "#002D62",
  LAC: "#C8102E", LAL: "#552583", MEM: "#5D76A9", MIA: "#98002E",
  MIL: "#00471B", MIN: "#0C2340", NOP: "#0C2340", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#1D1160",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141",
  UTA: "#002B5C", WAS: "#002B5C",
};

// Normalize game IDs for comparison
const normalizeGameId = (id: string | number | null | undefined): string => {
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

// Check if game is live
const isGameLive = (game: NbaGame): boolean => {
  const status = game.game_status?.toLowerCase() || "";
  return /^\d+-\d+$/.test(status) || /^q[1-4]/i.test(status) || status.includes("halftime") || status.includes("ot");
};

// Format game time
const formatGameTime = (gameStatus: string | null, gameDate: string | null): string => {
  if (!gameStatus) return "TBD";
  if (gameStatus.toLowerCase().includes("final")) return "Final";
  
  // Live scores
  if (/^\d+-\d+$/.test(gameStatus)) return gameStatus;
  if (/^q[1-4]/i.test(gameStatus) || gameStatus.toLowerCase().includes("halftime") || gameStatus.toLowerCase().includes("ot")) {
    return gameStatus;
  }
  
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
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

interface GamesHorizontalNavProps {
  games: NbaGame[];
  selectedGameIds: string[];
  onToggleGame: (gameId: string) => void;
  onSelectAll: () => void;
  className?: string;
}

export function GamesHorizontalNav({
  games,
  selectedGameIds,
  onToggleGame,
  onSelectAll,
  className,
}: GamesHorizontalNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Group games by date
  const gamesByDate = React.useMemo(() => {
    const grouped: Record<string, NbaGame[]> = {};
    games.forEach((game) => {
      const date = game.game_date || "Unknown";
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(game);
    });
    // Sort dates
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  // Check scroll state
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (ref) ref.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [games]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const isSelected = (gameId: string) => {
    if (selectedGameIds.length === 0) return true; // All games selected
    return selectedGameIds.includes(normalizeGameId(gameId));
  };

  const allSelected = selectedGameIds.length === 0;

  return (
    <div className={cn("relative", className)}>
      {/* All Games Button */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onSelectAll}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            allSelected
              ? "bg-[#0EA5E9] text-white"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          All Games
        </button>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {selectedGameIds.length === 0 
            ? `${games.length} games` 
            : `${selectedGameIds.length} selected`}
        </span>
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full px-2 bg-gradient-to-r from-white dark:from-neutral-950 to-transparent flex items-center"
          >
            <div className="p-1 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-neutral-200 dark:border-neutral-700">
              <ChevronLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
            </div>
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full px-2 bg-gradient-to-l from-white dark:from-neutral-950 to-transparent flex items-center"
          >
            <div className="p-1 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-neutral-200 dark:border-neutral-700">
              <ChevronRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
            </div>
          </button>
        )}

        {/* Games Strip */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
        >
          {gamesByDate.map(([date, dateGames]) => (
            <React.Fragment key={date}>
              {/* Date Separator (only if multiple dates) */}
              {gamesByDate.length > 1 && (
                <div className="flex-shrink-0 flex items-center px-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                    {getDayLabel(date)}
                  </span>
                </div>
              )}
              
              {/* Games for this date */}
              {dateGames.map((game) => {
                const gameId = normalizeGameId(game.game_id);
                const selected = isSelected(gameId);
                const started = hasGameStarted(game);
                const live = isGameLive(game);
                const homeColor = NBA_TEAM_COLORS[game.home_team_tricode?.toUpperCase() || ""] || "#6366f1";
                
                return (
                  <button
                    key={game.game_id}
                    onClick={() => onToggleGame(gameId)}
                    className={cn(
                      "flex-shrink-0 relative rounded-xl border transition-all duration-200 overflow-hidden",
                      "min-w-[140px] p-3",
                      selected && !allSelected
                        ? "border-[#0EA5E9] dark:border-[#7DD3FC] bg-[#0EA5E9]/5 dark:bg-[#7DD3FC]/5 ring-1 ring-[#0EA5E9]/30 dark:ring-[#7DD3FC]/30"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700",
                      started && !selected && "opacity-60"
                    )}
                  >
                    {/* Live indicator */}
                    {live && (
                      <div className="absolute top-2 right-2">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[9px] font-bold text-red-500">LIVE</span>
                        </span>
                      </div>
                    )}

                    {/* Teams */}
                    <div className="space-y-1.5">
                      {/* Away Team */}
                      <div className="flex items-center gap-2">
                        <img
                          src={getTeamLogoUrl(game.away_team_tricode || "", "nba")}
                          alt={game.away_team_tricode || ""}
                          className="h-5 w-5 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                          {game.away_team_tricode}
                        </span>
                      </div>
                      
                      {/* Home Team */}
                      <div className="flex items-center gap-2">
                        <img
                          src={getTeamLogoUrl(game.home_team_tricode || "", "nba")}
                          alt={game.home_team_tricode || ""}
                          className="h-5 w-5 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                          {game.home_team_tricode}
                        </span>
                      </div>
                    </div>

                    {/* Time/Status */}
                    <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <span className={cn(
                        "text-[10px] font-medium",
                        live 
                          ? "text-red-500" 
                          : started 
                            ? "text-neutral-400 dark:text-neutral-500"
                            : "text-neutral-600 dark:text-neutral-400"
                      )}>
                        {formatGameTime(game.game_status, game.game_date)}
                      </span>
                    </div>

                    {/* Selection indicator bar */}
                    {selected && !allSelected && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0EA5E9] dark:bg-[#7DD3FC]"
                      />
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
