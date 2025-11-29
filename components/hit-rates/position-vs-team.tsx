"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { usePositionVsTeam, PositionVsTeamPlayer } from "@/hooks/use-position-vs-team";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Users, Calendar, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

export function PositionVsTeam({
  position,
  opponentTeamId,
  opponentTeamAbbr,
  market,
  currentLine,
  className,
}: PositionVsTeamProps) {
  const { 
    players, 
    avgStat, 
    minStat,
    maxStat,
    totalGames, 
    playerCount,
    isLoading, 
    error 
  } = usePositionVsTeam({
    position,
    opponentTeamId,
    market,
    limit: 50,
    enabled: !!position && !!opponentTeamId && !!market,
  });

  const opponentLogo = opponentTeamAbbr ? getTeamLogoUrl(opponentTeamAbbr, "nba") : null;

  // Calculate hit rate vs this opponent from recent games
  const hitsVsOpponent = currentLine !== null 
    ? players.filter(p => p.stat > currentLine).length 
    : 0;
  const hitRateVsOpponent = players.length > 0 && currentLine !== null
    ? Math.round((hitsVsOpponent / players.length) * 100)
    : null;

  if (isLoading) {
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

  if (players.length === 0) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No matchup data available for {position} vs {opponentTeamAbbr}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {position} vs
            </h3>
            {opponentLogo && (
              <img
                src={opponentLogo}
                alt={opponentTeamAbbr || ""}
                className="h-5 w-5 object-contain"
              />
            )}
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {opponentTeamAbbr}
            </span>
          </div>
          
          {/* Summary Stats */}
          <div className="flex items-center gap-4 text-xs">
            <Tooltip content={`Range: ${minStat} - ${maxStat}`} side="top">
              <div className="flex items-center gap-1.5 cursor-help">
                <span className="text-neutral-500">Avg:</span>
                <span className={cn(
                  "font-bold",
                  getStatVsLineClass(avgStat, currentLine)
                )}>
                  {avgStat.toFixed(1)}
                </span>
              </div>
            </Tooltip>
            {hitRateVsOpponent !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Hit Rate:</span>
                <span className={cn(
                  "font-bold",
                  hitRateVsOpponent >= 60 ? "text-emerald-600 dark:text-emerald-400" :
                  hitRateVsOpponent >= 40 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-500 dark:text-red-400"
                )}>
                  {hitRateVsOpponent}%
                </span>
              </div>
            )}
            <Tooltip content={`${playerCount} unique players`} side="top">
              <span className="text-neutral-400 cursor-help">
                {totalGames} games
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800/80 backdrop-blur-sm">
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
            {players.map((player, idx) => (
              <PlayerMatchupRow 
                key={`${player.gameDate}-${player.playerName}-${idx}`} 
                player={player} 
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with market context */}
      <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30">
        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
          {formatMarketLabel(market || "")} for <span className="font-medium">{position}</span> vs <span className="font-medium">{opponentTeamAbbr}</span> this season
          {currentLine !== null && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-medium">
              Line: {currentLine}+
            </span>
          )}
        </p>
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
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          N/A
        </span>
      </td>

      {/* Stat */}
      <td className="px-4 py-2.5 text-right">
        <span className={cn(
          "text-base font-bold tabular-nums",
          getStatVsLineClass()
        )}>
          {player.stat}
        </span>
      </td>
    </tr>
  );
}

