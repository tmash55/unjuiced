"use client";

import React, { useState } from "react";
import { ChevronDown, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayTypeMatchup } from "@/hooks/use-play-type-matchup";

interface MobilePlayTypeAnalysisProps {
  playerId: number | null;
  opponentTeamId: number | null;
  opponentTeamAbbr: string | null;
  playerName: string;
}

// Get rank text color matching Alternate Lines hit rate colors
function getRankColorClass(rank: number | null) {
  if (rank === null) return "text-neutral-400 dark:text-neutral-500";
  if (rank >= 21) return "text-emerald-600 dark:text-emerald-400"; // Favorable - defense struggles
  if (rank <= 10) return "text-red-500 dark:text-red-400"; // Tough - defense excels
  return "text-amber-600 dark:text-amber-400"; // Neutral
}

// Get rank badge background matching Alternate Lines style
function getRankBadgeBg(rank: number | null) {
  if (rank === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (rank >= 21) return "bg-emerald-100 dark:bg-emerald-900/40"; // Favorable
  if (rank <= 10) return "bg-red-100 dark:bg-red-900/40"; // Tough
  return "bg-amber-100 dark:bg-amber-900/40"; // Neutral
}

// Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function MobilePlayTypeAnalysis({ playerId, opponentTeamId, opponentTeamAbbr, playerName }: MobilePlayTypeAnalysisProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, error } = usePlayTypeMatchup({
    playerId,
    opponentTeamId,
    enabled: !!playerId && !!opponentTeamId,
  });

  if (!playerId || !opponentTeamId) return null;

  const playerLastName = playerName.split(" ").pop();
  const playTypesCount = data?.play_types?.length || 0;
  
  // Calculate summary
  const favorableCount = data?.play_types?.filter(pt => pt.opponent_def_rank !== null && pt.opponent_def_rank >= 21).length || 0;
  const toughCount = data?.play_types?.filter(pt => pt.opponent_def_rank !== null && pt.opponent_def_rank <= 10).length || 0;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
          <span className="text-sm font-bold text-neutral-900 dark:text-white">
            Play Type Analysis
          </span>
          <span className="text-xs text-neutral-400">vs {opponentTeamAbbr}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && playTypesCount > 0 && !collapsed && (
            <div className="flex items-center gap-1">
              {favorableCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  {favorableCount} good
                </span>
              )}
              {toughCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400">
                  {toughCount} tough
                </span>
              )}
            </div>
          )}
          <ChevronDown className={cn(
            "h-4 w-4 text-neutral-400 transition-transform",
            !collapsed && "rotate-180"
          )} />
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60">
          {isLoading ? (
            <div className="px-4 py-8 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-4 w-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                <span className="text-[10px] text-neutral-400">Loading...</span>
              </div>
            </div>
          ) : error || !data?.play_types?.length ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-neutral-400">No play type data available</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_70px_50px_24px] items-center px-4 py-2 bg-neutral-100/80 dark:bg-neutral-800/50 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Play Type
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 text-right">
                  Pts
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 text-center leading-tight">
                  Def<br/>Rank
                </span>
                <span></span>
              </div>

              {/* Play Types List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {data.play_types.map((playType, idx) => {
                  const isExpanded = expandedRow === playType.play_type;
                  const isFreeThrows = playType.is_free_throws;
                  
                  return (
                    <div key={playType.play_type}>
                      {/* Main Row */}
                      <button
                        type="button"
                        onClick={() => setExpandedRow(isExpanded ? null : playType.play_type)}
                        className={cn(
                          "w-full px-4 py-3 grid grid-cols-[1fr_70px_50px_24px] items-center transition-colors",
                          idx % 2 === 0 
                            ? "bg-neutral-50/50 dark:bg-neutral-800/20" 
                            : "bg-white dark:bg-neutral-900",
                          "active:bg-neutral-100 dark:active:bg-neutral-800/50",
                          isFreeThrows && "bg-blue-50/30 dark:bg-blue-900/10"
                        )}
                      >
                        {/* Play Type Name */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {playType.display_name}
                          </span>
                          {playType.player_percentile && playType.player_percentile >= 80 && (
                            <Zap className="h-3 w-3 text-violet-500 shrink-0" />
                          )}
                          {isFreeThrows && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold shrink-0">
                              FT
                            </span>
                          )}
                        </div>
                        
                        {/* Points */}
                        <div className="text-right">
                          <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
                            {playType.player_ppg.toFixed(1)}
                          </span>
                        </div>
                        
                        {/* Defense Rank */}
                        <div className="flex justify-center">
                          <span className={cn(
                            "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold tabular-nums",
                            getRankBadgeBg(playType.opponent_def_rank),
                            getRankColorClass(playType.opponent_def_rank)
                          )}>
                            {playType.opponent_def_rank ?? "—"}
                          </span>
                        </div>
                        
                        <ChevronDown className={cn(
                          "h-4 w-4 text-neutral-400 transition-transform shrink-0",
                          isExpanded && "rotate-180"
                        )} />
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Left: Player Stats */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-2">
                                {playerLastName}'s Stats
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-500">PPP</span>
                                <span className={cn(
                                  "font-semibold",
                                  playType.player_ppp >= 1.0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                                )}>
                                  {playType.player_ppp.toFixed(3)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-500">{isFreeThrows ? "FT%" : "FG%"}</span>
                                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                  {isFreeThrows && playType.ft_pct !== null 
                                    ? `${playType.ft_pct.toFixed(1)}%`
                                    : `${playType.player_fg_pct.toFixed(1)}%`
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-neutral-500">% of Pts</span>
                                <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.player_pct_of_total.toFixed(0)}%</span>
                              </div>
                              {playType.player_percentile && (
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-neutral-500">Percentile</span>
                                  <span className={cn(
                                    "font-semibold",
                                    playType.player_percentile >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                                    playType.player_percentile >= 50 ? "text-amber-600 dark:text-amber-400" : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    {getOrdinalSuffix(Math.round(playType.player_percentile))}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Right: Opponent Defense */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide mb-2">
                                {opponentTeamAbbr} Defense
                              </div>
                              {playType.opponent_ppp_allowed !== null && (
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-neutral-500">PPP Allowed</span>
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.opponent_ppp_allowed.toFixed(3)}</span>
                                </div>
                              )}
                              {playType.opponent_fg_pct_allowed !== null && !isFreeThrows && (
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-neutral-500">FG% Allowed</span>
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.opponent_fg_pct_allowed.toFixed(1)}%</span>
                                </div>
                              )}
                              {playType.opponent_fta_per_game !== null && (
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-neutral-500">FTA Allowed/G</span>
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.opponent_fta_per_game.toFixed(1)}</span>
                                </div>
                              )}
                              {playType.opponent_def_rank !== null && (
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-neutral-500">Def Rank</span>
                                  <span className={cn(
                                    "font-bold",
                                    getRankColorClass(playType.opponent_def_rank)
                                  )}>
                                    {getOrdinalSuffix(playType.opponent_def_rank)}
                                  </span>
                                </div>
                              )}
                              {playType.opponent_ppp_allowed !== null && (
                                <div className="flex justify-between text-[11px] pt-1 mt-1 border-t border-neutral-200 dark:border-neutral-700">
                                  <span className="text-neutral-500">Edge</span>
                                  <span className={cn(
                                    "font-bold",
                                    playType.player_ppp > playType.opponent_ppp_allowed
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-red-500"
                                  )}>
                                    {playType.player_ppp > playType.opponent_ppp_allowed ? "+" : ""}
                                    {(playType.player_ppp - playType.opponent_ppp_allowed).toFixed(3)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-800/30 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex items-center justify-center gap-3 text-[9px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">21-30 Favorable</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">11-20 Neutral</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-red-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">1-10 Tough</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
