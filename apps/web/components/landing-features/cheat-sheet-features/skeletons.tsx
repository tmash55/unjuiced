"use client";
import React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// HIT RATE MATRIX SKELETON
// Shows the cheat sheet table interface
// ============================================================================

export const HitRateMatrixSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white">Hit Rate Cheat Sheet</div>
            <div className="text-xs text-neutral-500 mt-0.5">42 props • Sorted by confidence</div>
          </div>
          <div className="flex gap-2">
            {["Points", "Rebounds", "Assists"].map((market, i) => (
              <div 
                key={market}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium",
                  i === 0 
                    ? "bg-brand text-white" 
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                )}
              >
                {market}
              </div>
            ))}
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          <div className="col-span-2">Player</div>
          <div className="text-center">Prop</div>
          <div className="text-center">Hit Rate</div>
          <div className="text-center">Avg</div>
          <div className="text-center">Grade</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {[
            { name: "Shai Gilgeous-Alexander", team: "OKC", prop: "32.5 PTS", hitRate: "90%", avg: "34.2", grade: "A+", gradeColor: "bg-green-500" },
            { name: "Anthony Edwards", team: "MIN", prop: "26.5 PTS", hitRate: "85%", avg: "28.1", grade: "A", gradeColor: "bg-green-500" },
            { name: "LaMelo Ball", team: "CHA", prop: "24.5 PTS", hitRate: "80%", avg: "26.8", grade: "B+", gradeColor: "bg-blue-500" },
            { name: "Trae Young", team: "ATL", prop: "27.5 PTS", hitRate: "75%", avg: "28.9", grade: "B", gradeColor: "bg-blue-500" },
            { name: "Tyrese Maxey", team: "PHI", prop: "25.5 PTS", hitRate: "70%", avg: "26.2", grade: "B", gradeColor: "bg-yellow-500" },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-6 gap-4 px-6 py-3 items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">{row.name}</div>
                  <div className="text-xs text-neutral-500">{row.team}</div>
                </div>
              </div>
              <div className="text-center">
                <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {row.prop}
                </span>
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{row.hitRate}</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{row.avg}</span>
              </div>
              <div className="text-center">
                <span className={cn("px-2 py-1 rounded text-xs font-bold text-white", row.gradeColor)}>
                  {row.grade}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INJURY IMPACT SKELETON
// Shows the injury impact table interface
// ============================================================================

export const InjuryImpactSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-neutral-900 dark:text-white">Injury Impact</div>
              <div className="text-xs text-neutral-500 mt-0.5">Props boosted when teammates are out</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">12 injury impacts</span>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-7 gap-3 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          <div className="col-span-2">Player</div>
          <div>Teammate Out</div>
          <div className="text-center">Hit %</div>
          <div className="text-center">Boost</div>
          <div className="text-center">Games</div>
          <div className="text-center">Grade</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {[
            { name: "Keldon Johnson", team: "SAS", teammateOut: "V. Wembanyama", hitRate: "87%", boost: "+6.2", games: "8", grade: "A", status: "OUT" },
            { name: "Devin Vassell", team: "SAS", teammateOut: "V. Wembanyama", hitRate: "83%", boost: "+4.8", games: "8", grade: "A", status: "OUT" },
            { name: "Tyrese Maxey", team: "PHI", teammateOut: "J. Embiid", hitRate: "80%", boost: "+5.1", games: "12", grade: "B+", status: "GTD" },
            { name: "Austin Reaves", team: "LAL", teammateOut: "A. Davis", hitRate: "75%", boost: "+3.4", games: "6", grade: "B", status: "OUT" },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-7 gap-3 px-6 py-3 items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">{row.name}</div>
                  <div className="text-xs text-neutral-500">{row.team}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold",
                  row.status === "OUT" ? "bg-red-500/20 text-red-500" : "bg-yellow-500/20 text-yellow-600"
                )}>
                  {row.status}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{row.teammateOut}</span>
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{row.hitRate}</span>
              </div>
              <div className="text-center">
                <span className="text-sm font-bold text-green-500">{row.boost}</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{row.games}</span>
              </div>
              <div className="text-center">
                <span className="px-2 py-1 rounded bg-green-500 text-xs font-bold text-white">
                  {row.grade}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ALT LINE GRID SKELETON
// Shows the alternate lines matrix interface
// ============================================================================

export const AltLineGridSkeleton = () => {
  const lines = [18.5, 20.5, 22.5, 24.5, 26.5, 28.5];
  
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div>
                <div className="text-lg font-bold text-neutral-900 dark:text-white">Anthony Edwards</div>
                <div className="text-xs text-neutral-500">MIN • Points • vs LAL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500">Current Line</div>
              <div className="text-xl font-bold text-brand">24.5</div>
            </div>
          </div>
        </div>

        {/* Alt Lines Grid */}
        <div className="p-6">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Hit Rates by Line
          </div>
          
          <div className="grid grid-cols-6 gap-3">
            {lines.map((line, i) => {
              const hitRate = 95 - (i * 10);
              const isCurrentLine = line === 24.5;
              
              return (
                <div 
                  key={line}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                    isCurrentLine 
                      ? "border-brand bg-brand/5" 
                      : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                  )}
                >
                  <div className={cn(
                    "text-lg font-bold",
                    isCurrentLine ? "text-brand" : "text-neutral-900 dark:text-white"
                  )}>
                    {line}+
                  </div>
                  <div className={cn(
                    "text-2xl font-black mt-1",
                    hitRate >= 80 ? "text-green-500" :
                    hitRate >= 60 ? "text-yellow-500" :
                    "text-red-500"
                  )}>
                    {hitRate}%
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {Math.round(hitRate / 10)}/10
                  </div>
                  {isCurrentLine && (
                    <div className="mt-2 px-2 py-0.5 rounded-full bg-brand/20 text-brand text-[10px] font-semibold">
                      PRIMARY
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Insight */}
          <div className="mt-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="text-xl">💡</div>
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-300">Lower Line Opportunity</div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  20.5+ has a 95% hit rate over L10 games. Consider the safer floor if odds are favorable.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

