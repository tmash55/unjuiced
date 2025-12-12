"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Target, LayoutGrid, BarChart3, TrendingUp, HelpCircle, X, Check } from "lucide-react";
import { DvpSampleSize } from "@/hooks/use-dvp-rankings";
import { Position, DvpViewMode, TrendStat } from "./dvp-filters";

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

const POSITIONS: { value: Position; label: string }[] = [
  { value: "PG", label: "Point Guard" },
  { value: "SG", label: "Shooting Guard" },
  { value: "SF", label: "Small Forward" },
  { value: "PF", label: "Power Forward" },
  { value: "C", label: "Center" },
];

const VIEW_MODES: { value: DvpViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "basic", label: "Basic", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "advanced", label: "Advanced", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" /> },
];

const SAMPLE_SIZE_OPTIONS: { value: DvpSampleSize; label: string; shortLabel: string }[] = [
  { value: "season", label: "Full Season", shortLabel: "Season" },
  { value: "l5", label: "Last 5 Games", shortLabel: "L5" },
  { value: "l10", label: "Last 10 Games", shortLabel: "L10" },
  { value: "l15", label: "Last 15 Games", shortLabel: "L15" },
  { value: "l20", label: "Last 20 Games", shortLabel: "L20" },
];

// Trend stat options grouped
const TREND_STAT_GROUPS = [
  {
    category: "Basic",
    options: [
      { value: "pts" as TrendStat, label: "Points", shortLabel: "PTS" },
      { value: "reb" as TrendStat, label: "Rebounds", shortLabel: "REB" },
      { value: "ast" as TrendStat, label: "Assists", shortLabel: "AST" },
      { value: "fg3m" as TrendStat, label: "3-Pointers", shortLabel: "3PM" },
      { value: "stl" as TrendStat, label: "Steals", shortLabel: "STL" },
      { value: "blk" as TrendStat, label: "Blocks", shortLabel: "BLK" },
    ],
  },
  {
    category: "Combo",
    options: [
      { value: "pra" as TrendStat, label: "PTS+REB+AST", shortLabel: "PRA" },
      { value: "pr" as TrendStat, label: "PTS+REB", shortLabel: "P+R" },
      { value: "pa" as TrendStat, label: "PTS+AST", shortLabel: "P+A" },
      { value: "ra" as TrendStat, label: "REB+AST", shortLabel: "R+A" },
    ],
  },
  {
    category: "Volume",
    options: [
      { value: "fga" as TrendStat, label: "FG Attempts", shortLabel: "FGA" },
      { value: "fta" as TrendStat, label: "FT Attempts", shortLabel: "FTA" },
      { value: "minutes" as TrendStat, label: "Minutes", shortLabel: "MIN" },
    ],
  },
];

const ALL_TREND_STATS = TREND_STAT_GROUPS.flatMap(g => g.options);

// Glossary definitions
const GLOSSARY_SECTIONS = [
  {
    title: "How to Read",
    items: [
      { term: "Color Coding", definition: "Green = allows MORE (good for overs). Red = allows LESS (tough matchup). Based on rank 1-30." },
      { term: "Rank 1-10", definition: "Tough defense - allows the least in the league for this stat." },
      { term: "Rank 11-20", definition: "Average defense - middle of the pack." },
      { term: "Rank 21-30", definition: "Weak defense - allows the most, favorable for player props." },
      { term: "Avg vs Ranks", definition: "Toggle between seeing actual stat values or league rank (1-30)." },
    ],
  },
  {
    title: "Basic Stats",
    items: [
      { term: "PTS", definition: "Points allowed per game to this position." },
      { term: "REB", definition: "Rebounds allowed per game to this position." },
      { term: "AST", definition: "Assists allowed per game to this position." },
      { term: "3PM", definition: "3-pointers made allowed per game." },
      { term: "FTA", definition: "Free throw attempts allowed per game." },
      { term: "STL", definition: "Steals allowed per game to this position." },
      { term: "BLK", definition: "Blocks allowed per game to this position." },
      { term: "TO", definition: "Turnovers forced per game from this position." },
    ],
  },
  {
    title: "Advanced Stats",
    items: [
      { term: "FG%", definition: "Field goal percentage allowed to this position." },
      { term: "FGA", definition: "Field goal attempts allowed per game." },
      { term: "3P%", definition: "3-point percentage allowed to this position." },
      { term: "3PA", definition: "3-point attempts allowed per game." },
      { term: "OREB", definition: "Offensive rebounds allowed per game." },
      { term: "DREB", definition: "Defensive rebounds allowed per game." },
    ],
  },
  {
    title: "Combo Stats",
    items: [
      { term: "PRA", definition: "Points + Rebounds + Assists combined." },
      { term: "P+R", definition: "Points + Rebounds combined." },
      { term: "P+A", definition: "Points + Assists combined." },
      { term: "R+A", definition: "Rebounds + Assists combined." },
      { term: "BLK+STL", definition: "Blocks + Steals combined (stocks)." },
      { term: "DD%", definition: "Double-double percentage allowed." },
    ],
  },
  {
    title: "Trends View",
    items: [
      { term: "Season", definition: "Full season average for the selected stat." },
      { term: "L5/L10/L15/L20", definition: "Average over the last 5, 10, 15, or 20 games." },
      { term: "Δ L5 vs SZN", definition: "Difference between L5 and Season average. Positive = defense getting worse (good for overs)." },
      { term: "+Δ (Green)", definition: "Defense is allowing MORE recently - trending favorable for overs." },
      { term: "-Δ (Red)", definition: "Defense is allowing LESS recently - trending tougher." },
    ],
  },
];

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
  const [showPositionSheet, setShowPositionSheet] = useState(false);
  const [showSampleSheet, setShowSampleSheet] = useState(false);
  const [showDisplaySheet, setShowDisplaySheet] = useState(false);
  const [showStatSheet, setShowStatSheet] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  
  const positionSheetRef = useRef<HTMLDivElement>(null);
  const sampleSheetRef = useRef<HTMLDivElement>(null);
  const displaySheetRef = useRef<HTMLDivElement>(null);
  const statSheetRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);

  // Close sheets when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (positionSheetRef.current && !positionSheetRef.current.contains(event.target as Node)) {
        setShowPositionSheet(false);
      }
      if (sampleSheetRef.current && !sampleSheetRef.current.contains(event.target as Node)) {
        setShowSampleSheet(false);
      }
      if (displaySheetRef.current && !displaySheetRef.current.contains(event.target as Node)) {
        setShowDisplaySheet(false);
      }
      if (statSheetRef.current && !statSheetRef.current.contains(event.target as Node)) {
        setShowStatSheet(false);
      }
      if (glossaryRef.current && !glossaryRef.current.contains(event.target as Node)) {
        setShowGlossary(false);
      }
    }
    if (showPositionSheet || showSampleSheet || showDisplaySheet || showStatSheet || showGlossary) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPositionSheet, showSampleSheet, showDisplaySheet, showStatSheet, showGlossary]);

  const currentSampleSize = SAMPLE_SIZE_OPTIONS.find(s => s.value === sampleSize) || SAMPLE_SIZE_OPTIONS[0];
  const currentStat = ALL_TREND_STATS.find(s => s.value === trendStat) || ALL_TREND_STATS[0];
  
  // Display label for the display mode dropdown
  const displayLabel = displayMode === "values" ? "Avg" : "Ranks";

  return (
    <>
      <div className="bg-white dark:bg-neutral-950 border-b border-neutral-200/60 dark:border-neutral-800/60">
        {/* Row 1: Three Primary Dropdowns */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          {/* Position Dropdown */}
          <button
            type="button"
            onClick={() => setShowPositionSheet(true)}
            className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 transition-all active:scale-[0.98]"
          >
            <span>{position}</span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>

          {/* Sample Size Dropdown */}
          <button
            type="button"
            onClick={() => setShowSampleSheet(true)}
            className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 transition-all active:scale-[0.98]"
          >
            <span>{currentSampleSize.shortLabel}</span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>

          {/* Display Mode Dropdown */}
          <button
            type="button"
            onClick={() => setShowDisplaySheet(true)}
            className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 transition-all active:scale-[0.98]"
          >
            <span>{displayLabel}</span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>

          {/* Help Button */}
          <button
            type="button"
            onClick={() => setShowGlossary(true)}
            className="p-2.5 rounded-lg text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all active:scale-[0.98]"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: View Mode Selector */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => onViewModeChange(mode.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]",
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
        </div>

        {/* Row 3: Stat Selector (Trends only) + Legend */}
        <div className="px-3 pb-2 flex items-center gap-3 border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
          {/* Stat Selector - Only for Trends */}
          {viewMode === "trends" && (
            <button
              type="button"
              onClick={() => setShowStatSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand/10 text-brand border border-brand/30 transition-all active:scale-[0.97]"
            >
              <Target className="w-3.5 h-3.5" />
              <span>{currentStat.shortLabel}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-red-500" />
              <span className="text-neutral-500">Tough</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-neutral-400" />
              <span className="text-neutral-500">Neutral</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span className="text-neutral-500">Good</span>
            </div>
          </div>
        </div>
      </div>

      {/* Position Selection Bottom Sheet */}
      {showPositionSheet && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={positionSheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Position</h3>
              <button type="button" onClick={() => setShowPositionSheet(false)} className="text-xs text-brand font-semibold">Done</button>
            </div>
            <div className="p-3 space-y-1">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => { onPositionChange(pos.value); setShowPositionSheet(false); }}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] flex items-center justify-between",
                    position === pos.value
                      ? "bg-brand text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base">{pos.value}</span>
                    <span className="text-sm opacity-70">{pos.label}</span>
                  </div>
                  {position === pos.value && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sample Size Selection Bottom Sheet */}
      {showSampleSheet && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={sampleSheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Timeframe</h3>
              <button type="button" onClick={() => setShowSampleSheet(false)} className="text-xs text-brand font-semibold">Done</button>
            </div>
            <div className="p-3 space-y-1">
              {SAMPLE_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onSampleSizeChange(option.value); setShowSampleSheet(false); }}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] flex items-center justify-between",
                    sampleSize === option.value
                      ? "bg-brand text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{option.shortLabel}</span>
                    <span className="text-sm opacity-70">{option.label}</span>
                  </div>
                  {sampleSize === option.value && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Display Mode Selection Bottom Sheet */}
      {showDisplaySheet && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={displaySheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Display Mode</h3>
              <button type="button" onClick={() => setShowDisplaySheet(false)} className="text-xs text-brand font-semibold">Done</button>
            </div>
            <div className="p-3 space-y-1">
              <button
                type="button"
                onClick={() => { onDisplayModeChange("values"); setShowDisplaySheet(false); }}
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] flex items-center justify-between",
                  displayMode === "values"
                    ? "bg-brand text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                )}
              >
                <div>
                  <span className="font-bold">Averages</span>
                  <p className="text-xs opacity-70 mt-0.5">Show stat values (e.g., 25.3 PTS)</p>
                </div>
                {displayMode === "values" && <Check className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={() => { onDisplayModeChange("ranks"); setShowDisplaySheet(false); }}
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] flex items-center justify-between",
                  displayMode === "ranks"
                    ? "bg-brand text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                )}
              >
                <div>
                  <span className="font-bold">Ranks</span>
                  <p className="text-xs opacity-70 mt-0.5">Show league rank (1-30)</p>
                </div>
                {displayMode === "ranks" && <Check className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat Selection Bottom Sheet */}
      {showStatSheet && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={statSheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300"
          >
            <div className="shrink-0 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Select Stat</h3>
              <button type="button" onClick={() => setShowStatSheet(false)} className="text-xs text-brand font-semibold">Done</button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-4">
              {TREND_STAT_GROUPS.map((group) => (
                <div key={group.category}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-1">
                    {group.category}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { onTrendStatChange(option.value); setShowStatSheet(false); }}
                        className={cn(
                          "px-3 py-3 rounded-xl text-center transition-all active:scale-[0.96]",
                          trendStat === option.value
                            ? "bg-brand text-neutral-900 shadow-md"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        <div className="font-bold text-sm">{option.shortLabel}</div>
                        <div className="text-[10px] opacity-60 mt-0.5">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Glossary Bottom Sheet */}
      {showGlossary && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
          <div 
            ref={glossaryRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300"
          >
            <div className="shrink-0 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">How to Read</h3>
              </div>
              <button type="button" onClick={() => setShowGlossary(false)} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
              {GLOSSARY_SECTIONS.map((section, idx) => (
                <div key={section.title}>
                  {idx > 0 && <div className="border-t border-neutral-200 dark:border-neutral-700 -mx-4 mb-4" />}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-3">{section.title}</h4>
                  <div className="space-y-2.5">
                    {section.items.map((item) => (
                      <div key={item.term} className="flex gap-3">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-white shrink-0 w-24">{item.term}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.definition}</span>
                      </div>
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
