import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LayoutGrid, TrendingUp, BarChart3, ChevronDown, Clock, Target } from "lucide-react";
import { DvpSampleSize } from "@/hooks/use-dvp-rankings";

// Types
export type DvpViewMode = "basic" | "advanced" | "trends";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type TrendCompareBaseline = "season" | "l10" | "l20";
export type TrendStat = 
  | "pts" | "reb" | "ast" | "pra" | "fg3m" | "stl" | "blk" | "tov"
  | "pr" | "pa" | "ra" | "bs"
  | "fga" | "fg3a" | "fta" | "minutes";

interface DvpFiltersProps {
  position: Position;
  onPositionChange: (pos: Position) => void;
  viewMode: DvpViewMode;
  onViewModeChange: (mode: DvpViewMode) => void;
  sampleSize: DvpSampleSize;
  onSampleSizeChange: (size: DvpSampleSize) => void;
  trendBaseline: TrendCompareBaseline;
  onTrendBaselineChange: (baseline: TrendCompareBaseline) => void;
  trendStat: TrendStat;
  onTrendStatChange: (stat: TrendStat) => void;
  season: string;
  onSeasonChange: (season: string) => void;
}

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

const VIEW_MODES: { value: DvpViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "basic", label: "Basic", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "advanced", label: "Advanced", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" /> },
];

// Sample size options with nice labels
const SAMPLE_SIZE_OPTIONS: { value: DvpSampleSize; label: string; shortLabel: string }[] = [
  { value: "season", label: "'25-26 Season", shortLabel: "'25-26" },
  { value: "l5", label: "Last 5 Games", shortLabel: "L5" },
  { value: "l10", label: "Last 10 Games", shortLabel: "L10" },
  { value: "l15", label: "Last 15 Games", shortLabel: "L15" },
  { value: "l20", label: "Last 20 Games", shortLabel: "L20" },
];

// Trend stat options grouped by category
const TREND_STAT_OPTIONS: { category: string; options: { value: TrendStat; label: string; shortLabel: string }[] }[] = [
  {
    category: "Basic Stats",
    options: [
      { value: "pts", label: "Points", shortLabel: "PTS" },
      { value: "reb", label: "Rebounds", shortLabel: "REB" },
      { value: "ast", label: "Assists", shortLabel: "AST" },
      { value: "fg3m", label: "3-Pointers Made", shortLabel: "3PM" },
      { value: "stl", label: "Steals", shortLabel: "STL" },
      { value: "blk", label: "Blocks", shortLabel: "BLK" },
      { value: "tov", label: "Turnovers", shortLabel: "TO" },
    ],
  },
  {
    category: "Combo Stats",
    options: [
      { value: "pra", label: "Points + Rebounds + Assists", shortLabel: "PRA" },
      { value: "pr", label: "Points + Rebounds", shortLabel: "P+R" },
      { value: "pa", label: "Points + Assists", shortLabel: "P+A" },
      { value: "ra", label: "Rebounds + Assists", shortLabel: "R+A" },
      { value: "bs", label: "Blocks + Steals", shortLabel: "BLK+STL" },
    ],
  },
  {
    category: "Volume Stats",
    options: [
      { value: "fga", label: "Field Goal Attempts", shortLabel: "FGA" },
      { value: "fg3a", label: "3-Point Attempts", shortLabel: "3PA" },
      { value: "fta", label: "Free Throw Attempts", shortLabel: "FTA" },
      { value: "minutes", label: "Minutes", shortLabel: "MIN" },
    ],
  },
];

// Flat list for finding current option
const ALL_STAT_OPTIONS = TREND_STAT_OPTIONS.flatMap(g => g.options);

export function DvpFilters({
  position,
  onPositionChange,
  viewMode,
  onViewModeChange,
  sampleSize,
  onSampleSizeChange,
  trendBaseline,
  onTrendBaselineChange,
  trendStat,
  onTrendStatChange,
  season,
  onSeasonChange,
}: DvpFiltersProps) {
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false);
  const [statDropdownOpen, setStatDropdownOpen] = useState(false);
  const sampleDropdownRef = useRef<HTMLDivElement>(null);
  const statDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sampleDropdownRef.current && !sampleDropdownRef.current.contains(event.target as Node)) {
        setSampleDropdownOpen(false);
      }
      if (statDropdownRef.current && !statDropdownRef.current.contains(event.target as Node)) {
        setStatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentSampleOption = SAMPLE_SIZE_OPTIONS.find(s => s.value === sampleSize) || SAMPLE_SIZE_OPTIONS[0];
  const currentStatOption = ALL_STAT_OPTIONS.find(s => s.value === trendStat) || ALL_STAT_OPTIONS[0];

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Position Selector - Pill Style */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => onPositionChange(pos)}
                className={cn(
                  "px-3 py-1.5 text-sm font-bold rounded-md transition-all",
                  position === pos
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Sample Size Dropdown - Only show when NOT in trends view */}
          {viewMode !== "trends" && (
            <div className="relative" ref={sampleDropdownRef}>
              <button 
                onClick={() => setSampleDropdownOpen(!sampleDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <Clock className="w-4 h-4 text-neutral-500" />
                <span>{currentSampleOption.shortLabel}</span>
                <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", sampleDropdownOpen && "rotate-180")} />
              </button>

              {sampleDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-[40] overflow-hidden">
                  {SAMPLE_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSampleSizeChange(option.value);
                        setSampleDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between",
                        sampleSize === option.value 
                          ? "bg-neutral-50 dark:bg-neutral-700 text-brand font-medium" 
                          : "text-neutral-700 dark:text-neutral-300"
                      )}
                    >
                      <span>{option.label}</span>
                      {sampleSize === option.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trend Stat Dropdown - Only show in trends view */}
          {viewMode === "trends" && (
            <div className="relative" ref={statDropdownRef}>
              <button 
                onClick={() => setStatDropdownOpen(!statDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors min-w-[160px]"
              >
                <Target className="w-4 h-4 text-brand" />
                <span className="font-bold text-brand">{currentStatOption.label}</span>
                <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform ml-auto", statDropdownOpen && "rotate-180")} />
              </button>

              {statDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-[40] overflow-hidden max-h-[400px] overflow-y-auto">
                  {TREND_STAT_OPTIONS.map((group, groupIdx) => (
                    <div key={group.category}>
                      {groupIdx > 0 && (
                        <div className="border-t border-neutral-200 dark:border-neutral-700" />
                      )}
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        {group.category}
                      </div>
                      {group.options.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            onTrendStatChange(option.value);
                            setStatDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between",
                            trendStat === option.value 
                              ? "bg-brand/10 dark:bg-brand/20 text-brand font-medium" 
                              : "text-neutral-700 dark:text-neutral-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold w-14 text-xs">{option.shortLabel}</span>
                            <span className="text-neutral-500 dark:text-neutral-400">{option.label}</span>
                          </div>
                          {trendStat === option.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: View Modes */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onViewModeChange(mode.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                viewMode === mode.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {mode.icon}
              <span className="hidden sm:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
