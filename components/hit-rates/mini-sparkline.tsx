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
  count?: 5 | 10 | 20; // How many games to show
  className?: string;
  showDivider?: boolean; // Show a divider between sections
}

/**
 * Mini sparkline showing game-by-game performance as tiny bars
 * Green bars = hit (stat >= line)
 * Red bars = miss (stat < line)
 * Gray bars = no data (placeholder for games not yet played)
 */
export function MiniSparkline({ gameLogs, line, count = 5, className, showDivider = false }: MiniSparklineProps) {
  if (line === null) {
    return null;
  }

  // Take the most recent games (gameLogs should be sorted newest first)
  const recentGames = (gameLogs || []).slice(0, count);
  const actualGameCount = recentGames.length;
  
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

  // Create array with placeholders for missing games
  // Placeholders go at the start (oldest positions), actual games at the end (most recent)
  const placeholderCount = count - actualGameCount;
  
  // Reverse actual games so oldest is first, then we'll display left to right
  const orderedGames = [...recentGames].reverse();
  
  // Bar sizing based on count - larger bars for visual impact
  const barWidth = count === 20 ? "w-[5px]" : count === 10 ? "w-[6px]" : "w-[8px]";
  const gapSize = count === 20 ? "gap-[2px]" : count === 10 ? "gap-[3px]" : "gap-[4px]";

  // Divider positions: for 20 games, show dividers after L20 (idx 9) and L10 (idx 14)
  // For 10 games, show divider after L10 (idx 4)
  const getDividerAfter = (idx: number): boolean => {
    if (count === 20) {
      // idx 9 = between game 10 and 11 (L20|L10 boundary)
      // idx 14 = between game 15 and 16 (L10|L5 boundary)
      return idx === 9 || idx === 14;
    }
    if (count === 10) {
      return idx === 4; // Between game 5 and 6 (L10|L5 boundary)
    }
    return false;
  };

  return (
    <div className={cn("flex items-end", gapSize, className)}>
      {/* Placeholder bars for games not yet played */}
      {Array.from({ length: placeholderCount }).map((_, idx) => {
        const showDividerAfter = getDividerAfter(idx);
        return (
          <React.Fragment key={`placeholder-${idx}`}>
            <div
              className={cn(
                barWidth,
                "rounded-sm bg-neutral-200 dark:bg-neutral-700/50"
              )}
              style={{ height: "20%" }}
              title="No game data"
            />
            {showDividerAfter && (
              <div className="w-[1px] h-full bg-neutral-300 dark:bg-neutral-600 mx-[0.5px]" />
            )}
          </React.Fragment>
        );
      })}
      
      {/* Actual game bars */}
      {orderedGames.map((game, idx) => {
        const stat = game.market_stat ?? 0;
        const isHit = stat >= line;
        const height = getBarHeight(stat);
        
        // Adjust index for divider calculation (account for placeholders)
        const totalIdx = placeholderCount + idx;
        const showDividerAfter = getDividerAfter(totalIdx);
        
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
              title={`Game ${actualGameCount - idx}: ${stat} ${isHit ? "✓" : "✗"}`}
            />
            {showDividerAfter && (
              <div className="w-[1px] h-full bg-neutral-300 dark:bg-neutral-600 mx-[0.5px]" />
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

