"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useTeamDefenseRanks } from "@/hooks/use-team-defense-ranks";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Shield } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

interface DefensiveAnalysisProps {
  playerId: number;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  position: string | null;
  className?: string;
}

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

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
const getRankColor = (rank: number | null) => {
  if (!rank) return "text-neutral-400";
  if (rank <= 10) return "text-red-600 dark:text-red-400";
  if (rank <= 20) return "text-neutral-600 dark:text-neutral-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const getValueColor = (rank: number | null) => {
  if (!rank) return "text-neutral-900 dark:text-white";
  if (rank <= 10) return "text-red-600 dark:text-red-400";
  if (rank <= 20) return "text-neutral-900 dark:text-white";
  return "text-emerald-600 dark:text-emerald-400";
};

const getCellBgColor = (rank: number | null, isPlayerPosition: boolean) => {
  if (isPlayerPosition) {
    return "bg-brand/10 dark:bg-brand/20";
  }
  return "";
};

export function DefensiveAnalysis({
  playerId,
  opponentTeamId,
  opponentTeamAbbr,
  position,
  className,
}: DefensiveAnalysisProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("ranks");
  
  // Fetch team defense ranks for all positions
  const { positions, isLoading, isFetching, error } = useTeamDefenseRanks({
    opponentTeamId,
    enabled: !!opponentTeamId,
  });

  const opponentLogo = opponentTeamAbbr ? getTeamLogoUrl(opponentTeamAbbr, "nba") : null;
  
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
                  Defense vs all positions
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle - Premium */}
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
              {POSITIONS.map((pos) => (
                <th 
                  key={pos} 
                  className={cn(
                    "px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider",
                    pos === position 
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
            {ALL_MARKETS.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No defensive data available
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
                  {POSITIONS.map((pos) => {
                    const data = getMarketDataByPosition(market, pos);
                    const isPlayerPos = pos === position;
                    
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
                              getRankColor(data?.rank ?? null)
                            )}>
                              {data?.rank ? `#${data.rank}` : "—"}
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip content={`Rank: ${data?.rank ?? "N/A"}`} side="top">
                            <span className={cn(
                              "text-sm font-semibold tabular-nums cursor-help",
                              getValueColor(data?.rank ?? null)
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
            Season rankings out of 30 teams
          </p>
          {/* Legend - Premium Pills */}
          <div className="flex items-center gap-2 text-[9px]">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-medium text-red-700 dark:text-red-400">Tough 1-10</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">Neutral 11-20</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Good 21-30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

