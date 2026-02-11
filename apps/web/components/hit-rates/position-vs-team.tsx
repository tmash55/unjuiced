"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePositionVsTeam, PositionVsTeamPlayer } from "@/hooks/use-position-vs-team";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Users, Calendar, Clock, TrendingUp, TrendingDown, Minus, SlidersHorizontal, X } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

interface PositionVsTeamProps {
  position: string | null;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  market: string | null;
  currentLine: number | null;
  className?: string;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatMinutes = (minutes: number) => {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getStatVsLineClass = (stat?: number | null, line?: number | null) => {
  if (stat == null || line == null) {
    return "text-neutral-900 dark:text-white";
  }
  if (stat >= line) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  return "text-neutral-900 dark:text-white";
};

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export function PositionVsTeam({
  position,
  opponentTeamId,
  opponentTeamAbbr,
  market,
  currentLine,
  className,
}: PositionVsTeamProps) {
  // Local state for filters
  const [selectedPosition, setSelectedPosition] = useState<string | null>(position);
  const [showFilters, setShowFilters] = useState(false);
  const [gameLimit, setGameLimit] = useState(50);
  const [minMinutes, setMinMinutes] = useState(0);
  
  // Sync selectedPosition with position prop when it changes (e.g., when selecting a different player from sidebar)
  useEffect(() => {
    setSelectedPosition(position);
  }, [position]);
  
  const { 
    players, 
    avgStat, 
    minStat,
    maxStat,
    totalGames, 
    playerCount,
    avgClosingLine,
    gamesWithLines,
    overHitCount,
    overHitRate,
    isLoading, 
    isFetching,
    error 
  } = usePositionVsTeam({
    position: selectedPosition,
    opponentTeamId,
    market,
    limit: gameLimit,
    minMinutes,
    enabled: !!selectedPosition && !!opponentTeamId && !!market,
  });

  const opponentLogo = opponentTeamAbbr ? getTeamLogoUrl(opponentTeamAbbr, "nba") : null;

  // Calculate hit rate vs this opponent from recent games
  const hitsVsOpponent = currentLine !== null 
    ? players.filter(p => p.stat > currentLine).length 
    : 0;
  const hitRateVsOpponent = players.length > 0 && currentLine !== null
    ? Math.round((hitsVsOpponent / players.length) * 100)
    : null;

  // Show full loading only on initial load (no data yet)
  if (isLoading && players.length === 0) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading matchup data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-red-500">Failed to load matchup data</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-blue-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-blue-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    Position Matchup
                  </h3>
                  {opponentLogo && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-700/50">
                      <span className="text-[10px] font-medium text-neutral-500">vs</span>
                      <img
                        src={opponentLogo}
                        alt={opponentTeamAbbr || ""}
                        className="h-4 w-4 object-contain"
                      />
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {opponentTeamAbbr}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Historical performance data
                </p>
              </div>
            </div>
          
            {/* Summary Stats */}
            <div className="flex items-center gap-4 text-xs">
            <Tooltip content={`Range: ${minStat} - ${maxStat}`} side="top">
              <div className="flex items-center gap-1.5 cursor-help">
                <span className="text-neutral-500">Avg:</span>
                <span className={cn(
                  "font-bold transition-opacity",
                  getStatVsLineClass(avgStat, currentLine),
                  isFetching && "opacity-50"
                )}>
                  {avgStat.toFixed(1)}
                </span>
              </div>
            </Tooltip>
            {/* Closing Line Over Hit Rate - only show if we have data */}
            {overHitRate !== null && gamesWithLines > 0 && (
              <Tooltip 
                content={`${overHitCount}/${gamesWithLines} games beat the closing line${avgClosingLine ? `. Avg line: ${avgClosingLine.toFixed(1)}` : ''}`} 
                side="top"
              >
                <div className="flex items-center gap-1.5 cursor-help">
                  <span className="text-neutral-500">Over %:</span>
                  <span className={cn(
                    "font-bold transition-opacity",
                    overHitRate >= 60 ? "text-emerald-600 dark:text-emerald-400" :
                    overHitRate >= 40 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-500 dark:text-red-400",
                    isFetching && "opacity-50"
                  )}>
                    {overHitRate}%
                  </span>
                </div>
              </Tooltip>
            )}
            {/* Fallback to current line hit rate if no closing line data */}
            {(overHitRate === null || gamesWithLines === 0) && hitRateVsOpponent !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Hit Rate:</span>
                <span className={cn(
                  "font-bold transition-opacity",
                  hitRateVsOpponent >= 60 ? "text-emerald-600 dark:text-emerald-400" :
                  hitRateVsOpponent >= 40 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-500 dark:text-red-400",
                  isFetching && "opacity-50"
                )}>
                  {hitRateVsOpponent}%
                </span>
              </div>
            )}
            <Tooltip content={`${playerCount} unique players in ${totalGames} games`} side="top">
              <span className={cn(
                "text-neutral-400 cursor-help transition-opacity",
                isFetching && "opacity-50"
              )}>
                {totalGames} games • {playerCount} players
              </span>
            </Tooltip>
            
            {/* Filter Button - Shows position badge */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors active:scale-95",
                showFilters 
                  ? "bg-blue-600 text-white" 
                  : "bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{selectedPosition}</span>
            </button>
            </div>
          </div>
        
          {/* Filter Panel - Now includes Position Selector */}
          {showFilters && (
          <div className="mt-3 p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Filters</h4>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-neutral-500" />
              </button>
            </div>
            
            {/* Position Selector - Now inside filter panel */}
            <div className="mb-3">
              <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                Position
              </label>
              <div className="flex items-center gap-1">
                {POSITIONS.map((pos) => {
                  const isSelected = pos === selectedPosition;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setSelectedPosition(pos)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                        isSelected
                          ? "bg-brand text-white shadow-sm"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Game Limit */}
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Game Limit
                </label>
                <div className="flex gap-1">
                  {[10, 20, 50].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => setGameLimit(limit)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                        gameLimit === limit
                          ? "bg-brand/10 text-brand border border-brand/30"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {limit}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Min Minutes */}
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Min Minutes
                </label>
                <div className="flex gap-1">
                  {[0, 15, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setMinMinutes(mins)}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                        minMinutes === mins
                          ? "bg-brand/10 text-brand border border-brand/30"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {mins}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[320px] overflow-y-auto relative">
        {/* Loading Overlay */}
        {isFetching && (
          <div className="absolute inset-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Loading...</span>
            </div>
          </div>
        )}
        
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800/80 backdrop-blur-sm z-[5]">
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Date
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Player
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Min
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Line
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {formatMarketLabel(market || "").split(" ")[0]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {players.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No matchup data available for {selectedPosition} vs {opponentTeamAbbr}
                  </p>
                </td>
              </tr>
            ) : (
              players.map((player, idx) => (
              <PlayerMatchupRow 
                key={`${player.gameDate}-${player.playerName}-${idx}`} 
                player={player} 
              />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer - Premium */}
      <div className="px-5 py-3 border-t border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50/80 via-white/60 to-neutral-50/80 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50">
        <div className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span>{formatMarketLabel(market || "")} for</span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold">{position}</span>
          <span>vs</span>
          <span className="font-bold text-neutral-700 dark:text-neutral-300">{opponentTeamAbbr}</span>
          <span>this season</span>
          {currentLine !== null && (
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 font-bold text-neutral-700 dark:text-neutral-300">
              Line: {currentLine}+
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerMatchupRow({ 
  player, 
}: { 
  player: PositionVsTeamPlayer; 
}) {
  return (
    <tr className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/30">
      {/* Date */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {formatDate(player.gameDate)}
        </span>
      </td>

      {/* Player Name + Team Logo + Position */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {player.teamAbbr && (
            <img
              src={getTeamLogoUrl(player.teamAbbr, "nba")}
              alt={player.teamAbbr}
              className="w-5 h-5 object-contain shrink-0"
            />
          )}
          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate max-w-[120px]">
            {player.playerName}
          </span>
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">
            {player.position}
          </span>
        </div>
      </td>

      {/* Minutes */}
      <td className="px-3 py-2.5 text-center">
        <Tooltip content={formatMinutes(player.minutes)} side="top">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 cursor-help tabular-nums">
            {Math.floor(player.minutes)}
          </span>
        </Tooltip>
      </td>

      {/* Line */}
      <td className="px-3 py-2.5 text-center">
        {player.closingLine !== null ? (
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
            {player.closingLine}
          </span>
        ) : (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
            —
        </span>
        )}
      </td>

      {/* Stat */}
      <td className="px-4 py-2.5 text-right">
        <span className={cn(
          "text-base font-bold tabular-nums",
          player.closingLine !== null
            ? player.hitOver === true
              ? "text-emerald-600 dark:text-emerald-400"
              : player.hitOver === false
                ? "text-red-500 dark:text-red-400"
                : "text-neutral-600 dark:text-neutral-400" // push
            : "text-neutral-900 dark:text-white"
        )}>
          {player.stat}
        </span>
      </td>
    </tr>
  );
}

