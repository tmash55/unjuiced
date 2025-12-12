"use client";

import React, { useState } from "react";
import { ChevronDown, Info, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayTypeMatchup } from "@/hooks/use-play-type-matchup";
import { Tooltip } from "@/components/tooltip";

interface PlayTypeAnalysisProps {
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

export function PlayTypeAnalysis({ playerId, opponentTeamId, opponentTeamAbbr, playerName }: PlayTypeAnalysisProps) {
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

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800 overflow-hidden shadow-sm h-full">
      {/* Header - Matching Alternate Lines style */}
      <div className="px-4 py-2 border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50 to-transparent dark:from-neutral-800/50 dark:to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Play Type Analysis
            </h3>
            <Tooltip
              content={
                <div className="max-w-[280px] p-1">
                  <p className="text-xs font-semibold text-white mb-1.5">Play Type Matchups</p>
                  <p className="text-[11px] text-neutral-300 mb-2">
                    Shows how the player scores by play type and how {opponentTeamAbbr} defends each one.
                  </p>
                  <div className="space-y-1 text-[10px] mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                      <span className="text-neutral-300">21-30 = Favorable (defense struggles)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-amber-500" />
                      <span className="text-neutral-300">11-20 = Neutral</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-red-500" />
                      <span className="text-neutral-300">1-10 = Tough (defense excels)</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-neutral-700 text-[10px] text-neutral-400">
                    <span className="font-semibold text-neutral-300">PPP</span> = Points Per Possession. 
                    League avg is ~1.0. Above 1.1 is excellent.
                  </div>
                </div>
              }
              side="right"
            >
              <Info className="h-3 w-3 text-neutral-400 cursor-help" />
            </Tooltip>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              vs {opponentTeamAbbr}
            </span>
            {!isLoading && playTypesCount > 0 && (
              <>
                <span className="text-xs text-neutral-400">•</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {playTypesCount} types
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
            >
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-neutral-500 transition-transform",
                !collapsed && "rotate-180"
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <>
          {isLoading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-4 w-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                <span className="text-[10px] text-neutral-400">Loading...</span>
              </div>
            </div>
          ) : error || !data?.play_types?.length ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-neutral-400">No data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                {/* Table Header - Matching other components */}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-neutral-100/70 dark:bg-neutral-800/70 border-b border-neutral-200 dark:border-neutral-700">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Play Type
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      <Tooltip content="Points per game from this play type" side="top">
                        <span className="cursor-help">Player Pts</span>
                      </Tooltip>
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      <Tooltip content="Opponent's defensive rank (1=best defense, 30=worst)" side="top">
                        <span className="cursor-help">Opp Def Rank</span>
                      </Tooltip>
                    </th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.play_types.map((playType, idx) => {
                    const isExpanded = expandedRow === playType.play_type;
                    const isFreeThrows = playType.is_free_throws;
                    
                    return (
                      <React.Fragment key={playType.play_type}>
                        {/* Main Row - matching Alternate Lines striping */}
                        <tr 
                          className={cn(
                            "group transition-colors border-b border-neutral-100/50 dark:border-neutral-800/50 last:border-0 cursor-pointer",
                            idx % 2 === 0 
                              ? "bg-neutral-50/50 dark:bg-neutral-800/20" 
                              : "bg-white dark:bg-neutral-900/20",
                            "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30",
                            isFreeThrows && "bg-blue-50/30 dark:bg-blue-900/10"
                          )}
                          onClick={() => setExpandedRow(isExpanded ? null : playType.play_type)}
                        >
                          {/* Play Type Name */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-medium text-neutral-900 dark:text-white">
                                {playType.display_name}
                              </span>
                              {playType.player_percentile && playType.player_percentile >= 80 && (
                                <Tooltip content={`${getOrdinalSuffix(Math.round(playType.player_percentile))} percentile`}>
                                  <Zap className="h-3 w-3 text-violet-500 shrink-0" />
                                </Tooltip>
                              )}
                              {isFreeThrows && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
                                  FT
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Points (PPG + %) */}
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-xs font-bold tabular-nums text-neutral-900 dark:text-white">
                              {playType.player_ppg.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-neutral-400 ml-1">
                              ({playType.player_pct_of_total.toFixed(0)}%)
                            </span>
                          </td>

                          {/* Defensive Rank - matching Alternate Lines colors */}
                          <td className="px-3 py-2.5">
                            <div className="flex justify-center">
                              <span className={cn(
                                "inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold tabular-nums",
                                getRankBadgeBg(playType.opponent_def_rank),
                                getRankColorClass(playType.opponent_def_rank)
                              )}>
                                {playType.opponent_def_rank ?? "—"}
                              </span>
                            </div>
                          </td>

                          {/* Expand Arrow */}
                          <td className="px-2 py-2.5">
                            <ChevronDown className={cn(
                              "h-3.5 w-3.5 text-neutral-400 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          </td>
                        </tr>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <tr className="bg-neutral-50/80 dark:bg-neutral-800/40">
                            <td colSpan={4} className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
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
                                    <span className="text-neutral-500">Possessions</span>
                                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.player_possessions}</span>
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
                                  {playType.opponent_possessions !== null && (
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-neutral-500">Possessions</span>
                                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">{playType.opponent_possessions}</span>
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
