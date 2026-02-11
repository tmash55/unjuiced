"use client";
import React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// HIT RATE CHART SKELETON
// Shows a visual representation of the hit rate bar chart interface
// ============================================================================

export const HitRateChartSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand/20 to-brand/40 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-3 w-24 bg-neutral-100 dark:bg-neutral-800 rounded mt-2" />
          </div>
          <div className="flex gap-2">
            {["L5", "L10", "L20", "SZN"].map((label) => (
              <div 
                key={label}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium",
                  label === "L10" 
                    ? "bg-brand/20 text-brand" 
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Chart Area */}
        <div className="p-6">
          {/* Stat Pills */}
          <div className="flex gap-8 mb-6">
            {[
              { label: "Hit Rate", value: "80%", color: "text-green-500" },
              { label: "Average", value: "24.3", color: "text-neutral-900 dark:text-white" },
              { label: "Line", value: "22.5", color: "text-brand" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="flex items-end gap-2 h-32">
            {[75, 90, 60, 85, 70, 95, 50, 80, 65, 88].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className={cn(
                    "w-full rounded-t transition-all",
                    height >= 70 ? "bg-green-500" : "bg-red-400"
                  )}
                  style={{ height: `${height}%` }}
                />
                <div className="text-[10px] text-neutral-400">{i + 1}</div>
              </div>
            ))}
          </div>

          {/* Line indicator */}
          <div className="relative mt-2">
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-brand/50" style={{ top: "30%" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CONTEXTUAL FILTERS SKELETON
// Shows the filtering interface with game log context
// ============================================================================

export const ContextualFiltersSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Filter Toolbar */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Filters</span>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Home Games", active: true },
              { label: "Without LeBron", active: true },
              { label: "vs East", active: false },
            ].map((filter) => (
              <div 
                key={filter.label}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  filter.active 
                    ? "bg-brand/10 border-brand text-brand" 
                    : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                )}
              >
                {filter.label}
                {filter.active && <span className="ml-1.5">✕</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-semibold text-neutral-900 dark:text-white">6 games</span>
            <span className="text-neutral-500"> match your filters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-500">83%</span>
            <span className="text-xs text-neutral-500">Hit Rate</span>
          </div>
        </div>

        {/* Game Log Preview */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {[
            { date: "Dec 15", opp: "BOS", result: 28, line: 22.5, hit: true },
            { date: "Dec 12", opp: "MIA", result: 31, line: 22.5, hit: true },
            { date: "Dec 8", opp: "NYK", result: 19, line: 22.5, hit: false },
            { date: "Dec 5", opp: "PHI", result: 26, line: 22.5, hit: true },
          ].map((game, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-neutral-500 w-12">{game.date}</span>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">vs {game.opp}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{game.result}</span>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  game.hit ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                )}>
                  {game.hit ? "✓" : "✗"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MATCHUP & DVP SKELETON
// Shows the defense vs position analysis interface
// ============================================================================

export const MatchupDvpSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">Defense vs Position</div>
              <div className="text-xs text-neutral-500 mt-0.5">Points allowed to Point Guards</div>
            </div>
            <div className="flex gap-2">
              {["PG", "SG", "SF", "PF", "C"].map((pos, i) => (
                <div 
                  key={pos}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium",
                    i === 0 
                      ? "bg-brand text-white" 
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  )}
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DvP Rankings */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Easy Matchups */}
            <div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">
                🔥 Easy Matchups (Top 10)
              </div>
              <div className="space-y-2">
                {[
                  { team: "UTA", rank: 1, pts: 28.4 },
                  { team: "POR", rank: 2, pts: 27.8 },
                  { team: "WAS", rank: 3, pts: 27.2 },
                  { team: "SAS", rank: 4, pts: 26.9 },
                ].map((item) => (
                  <div key={item.team} className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 w-4">#{item.rank}</span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">{item.team}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{item.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hard Matchups */}
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">
                🧱 Tough Matchups (Bottom 10)
              </div>
              <div className="space-y-2">
                {[
                  { team: "CLE", rank: 30, pts: 19.2 },
                  { team: "BOS", rank: 29, pts: 19.8 },
                  { team: "MIA", rank: 28, pts: 20.1 },
                  { team: "OKC", rank: 27, pts: 20.5 },
                ].map((item) => (
                  <div key={item.team} className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 w-4">#{item.rank}</span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">{item.team}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{item.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

