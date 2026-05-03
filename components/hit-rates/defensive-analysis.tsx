"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useTeamDefenseRanks } from "@/hooks/use-team-defense-ranks";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Tooltip } from "@/components/tooltip";

interface DefensiveAnalysisProps {
  playerId: number;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  position: string | null;
  className?: string;
  sport?: "nba" | "wnba";
}

const NBA_POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const WNBA_POSITIONS = ["G", "F", "C"];
const WNBA_SEASONS = ["2025", "2026"] as const;

type ViewMode = "ranks" | "values";

const ALL_MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes_made",
  "player_steals",
  "player_blocks",
  "player_points_rebounds_assists",
];

// LOW rank (1-10) = tough defense = HARD for player (red)
// HIGH rank (21-30) = weak defense = GOOD for player (green)
const getRankBuckets = (totalTeams: number) => {
  const total = Math.max(totalTeams || 30, 1);
  return {
    toughMax: Math.ceil(total / 3),
    neutralMax: Math.ceil((total * 2) / 3),
    total,
  };
};

const getRankColor = (rank: number | null, totalTeams: number) => {
  if (!rank) return "text-neutral-400";
  const { toughMax, neutralMax } = getRankBuckets(totalTeams);
  if (rank <= toughMax) return "text-red-600 dark:text-red-400";
  if (rank <= neutralMax) return "text-neutral-600 dark:text-neutral-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const getValueColor = (rank: number | null, totalTeams: number) => {
  if (!rank) return "text-neutral-900 dark:text-white";
  const { toughMax, neutralMax } = getRankBuckets(totalTeams);
  if (rank <= toughMax) return "text-red-600 dark:text-red-400";
  if (rank <= neutralMax) return "text-neutral-900 dark:text-white";
  return "text-emerald-600 dark:text-emerald-400";
};

export function DefensiveAnalysis({
  opponentTeamId,
  opponentTeamAbbr,
  position,
  className,
  sport = "nba",
}: DefensiveAnalysisProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("ranks");
  const [wnbaSeason, setWnbaSeason] = useState<(typeof WNBA_SEASONS)[number]>("2025");
  const positionsToShow = sport === "wnba" ? WNBA_POSITIONS : NBA_POSITIONS;
  const selectedSeason = sport === "wnba" ? wnbaSeason : undefined;
  
  // Fetch team defense ranks for all positions
  const { positions, meta, isLoading, isFetching, error } = useTeamDefenseRanks({
    opponentTeamId,
    sport,
    season: selectedSeason,
    enabled: !!opponentTeamId,
  });

  const opponentLogo = opponentTeamAbbr ? getTeamLogoUrl(opponentTeamAbbr, sport) : null;
  const totalTeams = sport === "wnba" ? (meta?.totalTeams || 13) : 30;
  const rankBuckets = getRankBuckets(totalTeams);
  const currentPosition = sport === "wnba"
    ? (position === "C" ? "C" : position === "F" ? "F" : "G")
    : position;
  const hasDefenseData = positionsToShow.some((pos) => !!positions[pos]);
  const showWnbaHistoricalEmptyState = sport === "wnba" && wnbaSeason === "2025" && !hasDefenseData;
  
  // Get market data organized by market name
  const getMarketDataByPosition = (market: string, pos: string) => {
    return positions[pos]?.[market] ?? { rank: null, avgAllowed: null };
  };

  // Show full loading only on initial load
  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading defensive stats...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-red-500">Failed to load defensive analysis</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5", className)}>
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-red-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-red-900/10" />
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-red-500 to-rose-600 shadow-sm shadow-red-500/30" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    Defensive Analysis
                  </h3>
                  {opponentLogo && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-700/50">
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
                  {sport === "wnba" ? "Defense vs G, F, C" : "Defense vs all positions"}
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle - Premium */}
            <div className="flex items-center gap-2">
              {sport === "wnba" && (
                <div className="flex items-center gap-1 bg-neutral-100/50 dark:bg-neutral-800/30 p-1 rounded-xl">
                  {WNBA_SEASONS.map((season) => (
                    <button
                      key={season}
                      type="button"
                      onClick={() => setWnbaSeason(season)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        wnbaSeason === season
                          ? "bg-white dark:bg-neutral-700 text-red-700 dark:text-red-400 shadow-md ring-1 ring-red-200/50 dark:ring-red-700/30"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                      )}
                    >
                      {season}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 bg-neutral-100/50 dark:bg-neutral-800/30 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("ranks")}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-bold transition-all",
                    viewMode === "ranks"
                      ? "bg-white dark:bg-neutral-700 text-red-700 dark:text-red-400 shadow-md ring-1 ring-red-200/50 dark:ring-red-700/30"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  Ranks
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("values")}
                  className={cn(
                    "px-3.5 py-2 rounded-lg text-xs font-bold transition-all",
                    viewMode === "values"
                      ? "bg-white dark:bg-neutral-700 text-red-700 dark:text-red-400 shadow-md ring-1 ring-red-200/50 dark:ring-red-700/30"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  Values
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Table */}
      <div className="max-h-[320px] overflow-y-auto overflow-x-auto relative">
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
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 sticky left-0 bg-neutral-50 dark:bg-neutral-800/80 backdrop-blur-sm">
                Stat
              </th>
              {positionsToShow.map((pos) => (
                <th 
                  key={pos} 
                  className={cn(
                    "px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider",
                    pos === currentPosition 
                      ? "text-brand dark:text-brand" 
                      : "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  {pos}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/50 dark:divide-neutral-700/30">
            {!hasDefenseData && !isFetching ? (
              <tr>
                <td colSpan={positionsToShow.length + 1} className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {showWnbaHistoricalEmptyState
                      ? `No 2025 defensive profile for ${opponentTeamAbbr || "this opponent"}`
                      : `No defensive data available for ${sport === "wnba" ? wnbaSeason : "this season"}`}
                  </p>
                  <p className="mt-1 max-w-md mx-auto text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {showWnbaHistoricalEmptyState
                      ? "New expansion teams do not have prior-season G/F/C defensive splits yet. Switch to 2026 once games are played to see current-season ranks."
                      : "Check back once game logs are available for this team and season."}
                  </p>
                </td>
              </tr>
            ) : (
              ALL_MARKETS.map((market, idx) => (
                <tr 
                  key={market}
                  className={cn(
                    "transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-700/20",
                    idx % 2 === 0 ? "bg-transparent" : "bg-neutral-50/30 dark:bg-neutral-800/20"
                  )}
                >
                  {/* Stat Name */}
                  <td className={cn(
                    "px-4 py-2.5 sticky left-0 border-r border-neutral-100 dark:border-neutral-700/30",
                    idx % 2 === 0 ? "bg-white dark:bg-neutral-800" : "bg-neutral-50/50 dark:bg-neutral-800/80"
                  )}>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                      {formatMarketLabel(market)}
                    </span>
                  </td>
                  
                  {/* Position Columns */}
                  {positionsToShow.map((pos) => {
                    const data = getMarketDataByPosition(market, pos);
                    const isPlayerPos = pos === currentPosition;
                    
                    return (
                      <td 
                        key={pos}
                        className={cn(
                          "px-3 py-2.5 text-center transition-colors",
                          isPlayerPos && "bg-brand/5 dark:bg-brand/10"
                        )}
                      >
                        {viewMode === "ranks" ? (
                          <Tooltip content={`Rank ${data?.rank ?? "N/A"} - Avg: ${data?.avgAllowed?.toFixed(1) ?? "—"}`} side="top">
                            <span className={cn(
                              "text-sm font-bold tabular-nums cursor-help",
                              getRankColor(data?.rank ?? null, totalTeams)
                            )}>
                              {data?.rank ? `#${data.rank}` : "—"}
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip content={`Rank: ${data?.rank ?? "N/A"}`} side="top">
                            <span className={cn(
                              "text-sm font-semibold tabular-nums cursor-help",
                              getValueColor(data?.rank ?? null, totalTeams)
                            )}>
                              {data?.avgAllowed?.toFixed(1) ?? "—"}
                            </span>
                          </Tooltip>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with Legend - Premium */}
      <div className="px-5 py-3 border-t border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50/80 via-white/60 to-neutral-50/80 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
            {sport === "wnba" ? wnbaSeason : "Season"} rankings out of {totalTeams} teams
          </p>
          {/* Legend - Premium Pills */}
          <div className="flex items-center gap-2 text-[9px]">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-red-700 dark:text-red-400">Tough 1-{rankBuckets.toughMax}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">Neutral {rankBuckets.toughMax + 1}-{rankBuckets.neutralMax}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Good {rankBuckets.neutralMax + 1}-{rankBuckets.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
