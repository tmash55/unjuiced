"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, ArrowRight } from "lucide-react";

interface BetCardProps {
  player: string;
  team: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent?: number | null;
  edgePercent?: number | null;
  sport: "nba" | "nfl" | "nhl";
  compact?: boolean;
  isPro?: boolean;
}

const SPORT_CONFIG = {
  nba: { label: "NBA", bgClass: "bg-orange-500/10", textClass: "text-orange-600 dark:text-orange-400" },
  nfl: { label: "NFL", bgClass: "bg-green-600/10", textClass: "text-green-600 dark:text-green-400" },
  nhl: { label: "NHL", bgClass: "bg-blue-500/10", textClass: "text-blue-600 dark:text-blue-400" },
};

const BOOK_DISPLAY: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  pointsbet: "PointsBet",
  bet365: "bet365",
  pinnacle: "Pinnacle",
  circa: "Circa",
  "hard-rock": "Hard Rock",
  "bally-bet": "Bally Bet",
  betrivers: "BetRivers",
  espnbet: "ESPN BET",
  fanatics: "Fanatics",
  fliff: "Fliff",
};

export function BetCard({
  player,
  team,
  market,
  marketDisplay,
  line,
  side,
  bestOdds,
  bestOddsFormatted,
  book,
  evPercent,
  edgePercent,
  sport,
  compact = false,
  isPro = true,
}: BetCardProps) {
  const sportConfig = SPORT_CONFIG[sport];
  const bookDisplay = BOOK_DISPLAY[book] || book;
  
  // Show blur on EV/Edge if not pro
  const showValueBlur = !isPro && (evPercent != null || edgePercent != null);
  
  return (
    <div className={cn(
      "rounded-lg border border-neutral-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-900",
      "transition-all hover:border-neutral-300 dark:hover:border-neutral-700",
      "hover:shadow-sm",
      compact ? "p-3" : "p-4"
    )}>
      {/* Sport Badge + Book */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
          sportConfig.bgClass,
          sportConfig.textClass
        )}>
          {sportConfig.label}
        </span>
        
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {bookDisplay}
        </span>
      </div>
      
      {/* Player & Team */}
      <div className="mb-2.5">
        <p className={cn(
          "font-semibold text-neutral-900 dark:text-neutral-100 truncate",
          compact ? "text-sm" : "text-[15px]"
        )}>
          {player}
        </p>
        {team && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {team}
          </p>
        )}
      </div>
      
      {/* Market & Line */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
          )}>
            {marketDisplay}
          </span>
          <span className={cn(
            "text-sm font-semibold",
            side === "over" 
              ? "text-emerald-600 dark:text-emerald-400" 
              : "text-rose-600 dark:text-rose-400"
          )}>
            {side === "over" ? "O" : "U"} {line}
          </span>
        </div>
        
        {/* Best Odds */}
        <span className={cn(
          "text-lg font-bold tabular-nums",
          bestOdds > 0 
            ? "text-emerald-600 dark:text-emerald-400" 
            : "text-neutral-900 dark:text-neutral-100"
        )}>
          {bestOddsFormatted}
        </span>
      </div>
      
      {/* EV/Edge Stats */}
      <div className="relative">
        <div className={cn(
          "flex items-center gap-3 py-2 px-3 rounded-lg",
          "bg-neutral-50 dark:bg-neutral-800/50"
        )}>
          {evPercent != null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">EV</span>
              <span className={cn(
                "text-sm font-bold tabular-nums",
                evPercent > 5 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-blue-600 dark:text-blue-400"
              )}>
                +{evPercent.toFixed(1)}%
              </span>
            </div>
          )}
          
          {edgePercent != null && (
            <div className="flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Edge</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                +{edgePercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Blur overlay for non-pro users */}
        {showValueBlur && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-white/50 dark:bg-neutral-900/50 rounded-lg">
            <span className="text-xs font-medium text-neutral-500">Pro</span>
          </div>
        )}
      </div>
    </div>
  );
}
