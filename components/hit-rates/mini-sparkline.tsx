"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GameLog {
  game_id?: string;
  date?: string;
  market_stat: number;
  [key: string]: unknown;
}

interface MiniSparklineProps {
  gameLogs: GameLog[] | null;
  line: number | null;
  count?: 5 | 10; // How many games to show
  className?: string;
  showDivider?: boolean; // Show a divider between L10 and L5 sections
}

/**
 * Mini sparkline showing game-by-game performance as tiny bars
 * Green bars = hit (stat >= line)
 * Red bars = miss (stat < line)
 */
export function MiniSparkline({ gameLogs, line, count = 5, className, showDivider = false }: MiniSparklineProps) {
  if (!gameLogs || gameLogs.length === 0 || line === null) {
    return null;
  }

  // Take the most recent games (gameLogs should be sorted newest first)
  const recentGames = gameLogs.slice(0, count);
  
  // Calculate max stat for scaling bars
  const stats = recentGames.map(g => g.market_stat ?? 0);
  const maxStat = Math.max(...stats, line * 1.2); // Use at least 120% of line for scale
  const minStat = 0;
  
  // Calculate bar heights as percentage (min 15%, max 100%)
  const getBarHeight = (stat: number): number => {
    if (maxStat === minStat) return 50;
    const normalized = (stat - minStat) / (maxStat - minStat);
    return Math.max(15, Math.min(100, normalized * 100));
  };

  // Reverse so oldest game is on the left, newest on the right
  const orderedGames = [...recentGames].reverse();
  
  // For 10 games, use thinner bars
  const barWidth = count === 10 ? "w-[4px]" : "w-[5px]";
  const gapSize = count === 10 ? "gap-[2px]" : "gap-[3px]";

  return (
    <div className={cn("flex items-end", gapSize, className)}>
      {orderedGames.map((game, idx) => {
        const stat = game.market_stat ?? 0;
        const isHit = stat >= line;
        const height = getBarHeight(stat);
        
        // Add a subtle divider after game 5 (index 4) when showing 10 games
        const showDividerAfter = count === 10 && idx === 4;
        
        return (
          <React.Fragment key={game.game_id || idx}>
            <div
              className={cn(
                barWidth,
                "rounded-sm transition-all",
                isHit 
                  ? "bg-emerald-500 dark:bg-emerald-400" 
                  : "bg-red-400 dark:bg-red-500"
              )}
              style={{ height: `${height}%` }}
              title={`Game ${count - idx}: ${stat} ${isHit ? "✓" : "✗"}`}
            />
            {showDividerAfter && (
              <div className="w-[1px] h-full bg-neutral-300 dark:bg-neutral-600 mx-[1px]" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Compact version with just hit/miss indicators (dots or blocks)
 * More space-efficient for L10/L20 columns
 */
export function MiniHitIndicator({ gameLogs, line, count = 10, className }: MiniSparklineProps) {
  if (!gameLogs || gameLogs.length === 0 || line === null) {
    return null;
  }

  // Take the most recent games
  const recentGames = gameLogs.slice(0, count);
  
  // Reverse so oldest game is on the left, newest on the right
  const orderedGames = [...recentGames].reverse();

  return (
    <div className={cn("flex items-center gap-[1px]", className)}>
      {orderedGames.map((game, idx) => {
        const stat = game.market_stat ?? 0;
        const isHit = stat >= line;
        
        return (
          <div
            key={game.game_id || idx}
            className={cn(
              "w-[4px] h-[8px] rounded-[1px]",
              isHit 
                ? "bg-emerald-500 dark:bg-emerald-400" 
                : "bg-red-400 dark:bg-red-500"
            )}
            title={`${stat} ${isHit ? "✓" : "✗"}`}
          />
        );
      })}
    </div>
  );
}

