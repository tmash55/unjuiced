"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";

interface PlayerStripProps {
  currentPlayer: HitRateProfile;
  allPlayers: HitRateProfile[];
  onPlayerSelect: (player: HitRateProfile) => void;
  className?: string;
}

// Get home/away team abbreviations from profile
function getTeamAbbrs(profile: HitRateProfile): { homeTeamAbbr: string | null; awayTeamAbbr: string | null } {
  const isHome = profile.homeAway === "H";
  if (isHome) {
    return {
      homeTeamAbbr: profile.teamAbbr,
      awayTeamAbbr: profile.opponentTeamAbbr,
    };
  } else {
    return {
      homeTeamAbbr: profile.opponentTeamAbbr,
      awayTeamAbbr: profile.teamAbbr,
    };
  }
}

// Group players by team and dedupe
function getGamePlayers(
  allPlayers: HitRateProfile[], 
  currentPlayer: HitRateProfile
): { home: HitRateProfile[]; away: HitRateProfile[]; homeTeamAbbr: string | null; awayTeamAbbr: string | null } {
  const seenPlayerIds = new Set<number>();
  const home: HitRateProfile[] = [];
  const away: HitRateProfile[] = [];
  
  const currentGameId = currentPlayer.gameId ? String(currentPlayer.gameId) : null;
  const { homeTeamAbbr, awayTeamAbbr } = getTeamAbbrs(currentPlayer);
  
  allPlayers.forEach((player) => {
    // Filter to same game
    if (!currentGameId || String(player.gameId) !== currentGameId) return;
    // Dedupe by player ID
    if (seenPlayerIds.has(player.playerId)) return;
    seenPlayerIds.add(player.playerId);
    
    // Check if this player is on home or away team
    const playerIsHome = player.homeAway === "H";
    if (playerIsHome) {
      home.push(player);
    } else {
      away.push(player);
    }
  });
  
  // Sort by name
  home.sort((a, b) => a.playerName.localeCompare(b.playerName));
  away.sort((a, b) => a.playerName.localeCompare(b.playerName));
  
  return { home, away, homeTeamAbbr, awayTeamAbbr };
}

export function PlayerStrip({
  currentPlayer,
  allPlayers,
  onPlayerSelect,
  className,
}: PlayerStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Get players from the current game
  const { home, away, homeTeamAbbr, awayTeamAbbr } = useMemo(
    () => getGamePlayers(allPlayers, currentPlayer),
    [allPlayers, currentPlayer]
  );

  // All players in display order: away team first, then home team
  const orderedPlayers = useMemo(() => [...away, ...home], [away, home]);

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
  }, [orderedPlayers]);

  // Scroll to current player on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const currentIndex = orderedPlayers.findIndex(p => p.playerId === currentPlayer.playerId);
    if (currentIndex >= 0) {
      const itemWidth = 80; // Approximate width of each player item
      const scrollPosition = Math.max(0, currentIndex * itemWidth - scrollRef.current.clientWidth / 2 + itemWidth / 2);
      scrollRef.current.scrollTo({ left: scrollPosition, behavior: "instant" });
    }
  }, [currentPlayer.playerId, orderedPlayers]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (orderedPlayers.length <= 1) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Game Context Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-1.5">
            <img
              src={getTeamLogoUrl(awayTeamAbbr || "", "nba")}
              alt={awayTeamAbbr || ""}
              className="h-4 w-4 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-medium">{awayTeamAbbr}</span>
          </div>
          <span>@</span>
          <div className="flex items-center gap-1.5">
            <img
              src={getTeamLogoUrl(homeTeamAbbr || "", "nba")}
              alt={homeTeamAbbr || ""}
              className="h-4 w-4 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-medium">{homeTeamAbbr}</span>
          </div>
        </div>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {orderedPlayers.length} players
        </span>
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full px-1 bg-gradient-to-r from-white dark:from-neutral-950 to-transparent flex items-center"
          >
            <div className="p-1 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-neutral-200 dark:border-neutral-700">
              <ChevronLeft className="h-3 w-3 text-neutral-600 dark:text-neutral-400" />
            </div>
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full px-1 bg-gradient-to-l from-white dark:from-neutral-950 to-transparent flex items-center"
          >
            <div className="p-1 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-neutral-200 dark:border-neutral-700">
              <ChevronRight className="h-3 w-3 text-neutral-600 dark:text-neutral-400" />
            </div>
          </button>
        )}

        {/* Players Strip */}
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide py-1"
        >
          {orderedPlayers.map((player) => {
            const isActive = player.playerId === currentPlayer.playerId;
            const isAwayTeam = player.homeAway !== "H";
            
            return (
              <button
                key={player.playerId}
                onClick={() => !isActive && onPlayerSelect(player)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                  "min-w-[72px]",
                  isActive
                    ? "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10 ring-1 ring-[#0EA5E9]/30 dark:ring-[#7DD3FC]/30"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                )}
              >
                <div className="relative">
                  <PlayerHeadshot
                    nbaPlayerId={player.playerId}
                    name={player.playerName}
                    size="small"
                    className={cn(
                      "ring-2",
                      isActive
                        ? "ring-[#0EA5E9] dark:ring-[#7DD3FC]"
                        : isAwayTeam
                          ? "ring-neutral-300 dark:ring-neutral-600"
                          : "ring-neutral-200 dark:ring-neutral-700"
                    )}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-medium text-center leading-tight line-clamp-2 max-w-[64px]",
                  isActive
                    ? "text-[#0EA5E9] dark:text-[#7DD3FC]"
                    : "text-neutral-600 dark:text-neutral-400"
                )}>
                  {player.playerName.split(" ").pop()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
