"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Target, LayoutGrid, BarChart3, TrendingUp } from "lucide-react";
import { DvpSampleSize } from "@/hooks/use-dvp-rankings";
import { Position, DvpViewMode, TrendStat, TrendCompareBaseline } from "./dvp-filters";

interface MobileDvpFiltersProps {
  position: Position;
  onPositionChange: (pos: Position) => void;
  viewMode: DvpViewMode;
  onViewModeChange: (mode: DvpViewMode) => void;
  sampleSize: DvpSampleSize;
  onSampleSizeChange: (size: DvpSampleSize) => void;
  trendStat: TrendStat;
  onTrendStatChange: (stat: TrendStat) => void;
  displayMode: "values" | "ranks";
  onDisplayModeChange: (mode: "values" | "ranks") => void;
}

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

const VIEW_MODES: { value: DvpViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "basic", label: "Basic", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { value: "advanced", label: "Adv", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { value: "trends", label: "Trends", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

const SAMPLE_SIZE_OPTIONS: { value: DvpSampleSize; label: string }[] = [
  { value: "season", label: "Season" },
  { value: "l5", label: "L5" },
  { value: "l10", label: "L10" },
  { value: "l15", label: "L15" },
  { value: "l20", label: "L20" },
];

// Trend stat options grouped
const TREND_STAT_GROUPS = [
  {
    category: "Basic",
    options: [
      { value: "pts" as TrendStat, label: "PTS" },
      { value: "reb" as TrendStat, label: "REB" },
      { value: "ast" as TrendStat, label: "AST" },
      { value: "fg3m" as TrendStat, label: "3PM" },
      { value: "stl" as TrendStat, label: "STL" },
      { value: "blk" as TrendStat, label: "BLK" },
    ],
  },
  {
    category: "Combo",
    options: [
      { value: "pra" as TrendStat, label: "PRA" },
      { value: "pr" as TrendStat, label: "P+R" },
      { value: "pa" as TrendStat, label: "P+A" },
      { value: "ra" as TrendStat, label: "R+A" },
    ],
  },
  {
    category: "Volume",
    options: [
      { value: "fga" as TrendStat, label: "FGA" },
      { value: "fta" as TrendStat, label: "FTA" },
      { value: "minutes" as TrendStat, label: "MIN" },
    ],
  },
];

const ALL_TREND_STATS = TREND_STAT_GROUPS.flatMap(g => g.options);

export function MobileDvpFilters({
  position,
  onPositionChange,
  viewMode,
  onViewModeChange,
  sampleSize,
  onSampleSizeChange,
  trendStat,
  onTrendStatChange,
  displayMode,
  onDisplayModeChange,
}: MobileDvpFiltersProps) {
  const [showStatSheet, setShowStatSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close sheet when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        setShowStatSheet(false);
      }
    }
    if (showStatSheet) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStatSheet]);

  const currentStat = ALL_TREND_STATS.find(s => s.value === trendStat) || ALL_TREND_STATS[0];

  return (
    <>
      <div className="bg-white dark:bg-neutral-950 border-b border-neutral-200/60 dark:border-neutral-800/60">
        {/* Row 1: Position Pills */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide shrink-0 mr-1">
              Pos
            </span>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionChange(pos)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 active:scale-[0.96]",
                  position === pos
                    ? "bg-brand text-neutral-900 shadow-sm shadow-brand/25"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                )}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: View Mode Toggle */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            {/* View Mode Pills */}
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onViewModeChange(mode.value)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all active:scale-[0.96]",
                    viewMode === mode.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Stat Selector - Only for Trends */}
            {viewMode === "trends" && (
              <button
                type="button"
                onClick={() => setShowStatSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand/10 text-brand border border-brand/30 transition-all active:scale-[0.96]"
              >
                <Target className="w-3.5 h-3.5" />
                <span>{currentStat.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            )}

            {/* Sample Size - Only for Basic/Advanced */}
            {viewMode !== "trends" && (
              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 ml-auto">
                {SAMPLE_SIZE_OPTIONS.slice(0, 3).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSampleSizeChange(option.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-semibold transition-all",
                      sampleSize === option.value
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Avg/Ranks Toggle */}
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 ml-auto">
              <button
                type="button"
                onClick={() => onDisplayModeChange("values")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-semibold transition-all",
                  displayMode === "values"
                    ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400"
                )}
              >
                Avg
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange("ranks")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-semibold transition-all",
                  displayMode === "ranks"
                    ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400"
                )}
              >
                Rank
              </button>
            </div>
          </div>
        </div>

        {/* Legend Row */}
        <div className="px-3 pb-2 flex items-center gap-3 text-[9px] border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-emerald-500" />
            <span className="text-neutral-500">Good</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-neutral-400" />
            <span className="text-neutral-500">Avg</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-500" />
            <span className="text-neutral-500">Tough</span>
          </div>
          {viewMode === "trends" && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">|</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                <span className="text-neutral-500">+Δ</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 text-red-500 rotate-180" />
                <span className="text-neutral-500">-Δ</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stat Selection Bottom Sheet */}
      {showStatSheet && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl max-h-[70vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            {/* Sheet Header */}
            <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Select Stat</h3>
              <button
                type="button"
                onClick={() => setShowStatSheet(false)}
                className="text-xs text-neutral-500 font-medium"
              >
                Done
              </button>
            </div>

            {/* Stat Options */}
            <div className="overflow-y-auto p-4 space-y-4">
              {TREND_STAT_GROUPS.map((group) => (
                <div key={group.category}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    {group.category}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onTrendStatChange(option.value);
                          setShowStatSheet(false);
                        }}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.96]",
                          trendStat === option.value
                            ? "bg-brand text-neutral-900 shadow-md shadow-brand/25"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

