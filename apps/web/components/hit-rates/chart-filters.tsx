"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, X } from "lucide-react";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Filter range type
interface FilterRange {
  min: number;
  max: number;
}

// All available filters
export interface ChartFiltersState {
  minutes: FilterRange | null;
  usage: FilterRange | null;
  homeAway: "home" | "away" | null;
  winLoss: "win" | "loss" | null;
  daysRest: number[] | null;
  points: FilterRange | null;
  rebounds: FilterRange | null;
  assists: FilterRange | null;
  steals: FilterRange | null;
  blocks: FilterRange | null;
  turnovers: FilterRange | null;
  oreb: FilterRange | null;
  dreb: FilterRange | null;
  potentialReb: FilterRange | null;
  passes: FilterRange | null;
  fga: FilterRange | null;
  fgm: FilterRange | null;
  fg3a: FilterRange | null;
  fg3m: FilterRange | null;
  fta: FilterRange | null;
  ftm: FilterRange | null;
  plusMinus: FilterRange | null;
  tsPct: FilterRange | null;
  efgPct: FilterRange | null;
}

interface ChartFiltersProps {
  games: BoxScoreGame[];
  allSeasonGames?: BoxScoreGame[]; // Full season games for range calculation
  filters: ChartFiltersState;
  onFiltersChange: (filters: ChartFiltersState) => void;
  market?: string;
  className?: string;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  hideControls?: boolean;
}

// Default empty filters
export const DEFAULT_FILTERS: ChartFiltersState = {
  minutes: null,
  usage: null,
  homeAway: null,
  winLoss: null,
  daysRest: null,
  points: null,
  rebounds: null,
  assists: null,
  steals: null,
  blocks: null,
  turnovers: null,
  oreb: null,
  dreb: null,
  potentialReb: null,
  passes: null,
  fga: null,
  fgm: null,
  fg3a: null,
  fg3m: null,
  fta: null,
  ftm: null,
  plusMinus: null,
  tsPct: null,
  efgPct: null,
};

// Filter config type
interface FilterConfig {
  key: keyof ChartFiltersState;
  label: string;
  category: "opportunity" | "scoring" | "playmaking" | "rebounding" | "defense" | "efficiency";
  getValue: (g: BoxScoreGame) => number;
  isPercentage?: boolean;
  step?: number;
  description: string;
}

// All filter configurations
const ALL_FILTERS: FilterConfig[] = [
  // OPPORTUNITY
  { key: "minutes", label: "Minutes", category: "opportunity", getValue: g => g.minutes, step: 1, description: "Minutes played in game" },
  { key: "usage", label: "Usage %", category: "opportunity", getValue: g => g.usagePct, isPercentage: true, step: 0.01, description: "Percentage of team plays used while on court" },
  { key: "fga", label: "FGA", category: "opportunity", getValue: g => g.fga, step: 1, description: "Field goal attempts" },
  { key: "fg3a", label: "3PA", category: "opportunity", getValue: g => g.fg3a, step: 1, description: "Three-point attempts" },
  { key: "fta", label: "FTA", category: "opportunity", getValue: g => g.fta, step: 1, description: "Free throw attempts" },
  
  // SCORING
  { key: "points", label: "Points", category: "scoring", getValue: g => g.pts, step: 1, description: "Total points scored" },
  { key: "fgm", label: "FGM", category: "scoring", getValue: g => g.fgm, step: 1, description: "Field goals made" },
  { key: "fg3m", label: "3PM", category: "scoring", getValue: g => g.fg3m, step: 1, description: "Three-pointers made" },
  { key: "ftm", label: "FTM", category: "scoring", getValue: g => g.ftm, step: 1, description: "Free throws made" },
  
  // PLAYMAKING
  { key: "assists", label: "Assists", category: "playmaking", getValue: g => g.ast, step: 1, description: "Assists recorded" },
  { key: "passes", label: "Passes", category: "playmaking", getValue: g => g.passes, step: 1, description: "Total passes made" },
  { key: "turnovers", label: "Turnovers", category: "playmaking", getValue: g => g.tov, step: 1, description: "Turnovers committed" },
  
  // REBOUNDING
  { key: "rebounds", label: "Total Reb", category: "rebounding", getValue: g => g.reb, step: 1, description: "Total rebounds" },
  { key: "oreb", label: "Off Reb", category: "rebounding", getValue: g => g.oreb, step: 1, description: "Offensive rebounds" },
  { key: "dreb", label: "Def Reb", category: "rebounding", getValue: g => g.dreb, step: 1, description: "Defensive rebounds" },
  { key: "potentialReb", label: "Potential Reb", category: "rebounding", getValue: g => g.potentialReb, step: 1, description: "Rebound opportunities" },
  
  // DEFENSE
  { key: "steals", label: "Steals", category: "defense", getValue: g => g.stl, step: 1, description: "Steals recorded" },
  { key: "blocks", label: "Blocks", category: "defense", getValue: g => g.blk, step: 1, description: "Blocks recorded" },
  { key: "plusMinus", label: "+/-", category: "defense", getValue: g => g.plusMinus, step: 1, description: "Plus/minus while on court" },
  
  // EFFICIENCY
  { key: "tsPct", label: "TS%", category: "efficiency", getValue: g => g.tsPct, isPercentage: true, step: 0.01, description: "True shooting percentage" },
  { key: "efgPct", label: "eFG%", category: "efficiency", getValue: g => g.efgPct, isPercentage: true, step: 0.01, description: "Effective field goal percentage" },
];

const CATEGORY_LABELS: Record<string, string> = {
  opportunity: "Opportunity",
  scoring: "Scoring",
  playmaking: "Playmaking",
  rebounding: "Rebounding",
  defense: "Defense",
  efficiency: "Efficiency",
};

// Active filter slider component
function FilterSlider({
  config,
  minVal,
  maxVal,
  avgVal,
  selectedRange,
  onRangeChange,
  onClose,
}: {
  config: FilterConfig;
  minVal: number;
  maxVal: number;
  avgVal: number;
  selectedRange: FilterRange | null;
  onRangeChange: (range: FilterRange | null) => void;
  onClose: () => void;
}) {
  const [minInput, setMinInput] = useState<string>("");
  const [maxInput, setMaxInput] = useState<string>("");
  
  const currentMin = selectedRange?.min ?? minVal;
  const currentMax = selectedRange?.max ?? maxVal;
  const range = maxVal - minVal || 1;
  const step = config.step || 1;
  
  const formatVal = (val: number) => {
    if (config.isPercentage) return `${Math.round(val * 100)}%`;
    return step < 1 ? val.toFixed(1) : Math.round(val).toString();
  };
  
  const parseInput = (val: string) => {
    if (config.isPercentage) {
      const num = parseFloat(val);
      return isNaN(num) ? null : num / 100;
    }
    return parseFloat(val) || null;
  };
  
  const handleSliderChange = (type: "min" | "max", e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (type === "min") {
      const newMin = Math.min(value, currentMax - step);
      onRangeChange({ min: Math.max(minVal, newMin), max: currentMax });
    } else {
      const newMax = Math.max(value, currentMin + step);
      onRangeChange({ min: currentMin, max: Math.min(maxVal, newMax) });
    }
  };
  
  const handleInputBlur = (type: "min" | "max") => {
    const inputVal = type === "min" ? minInput : maxInput;
    if (!inputVal) return;
    
    const parsed = parseInput(inputVal);
    if (parsed === null) {
      setMinInput("");
      setMaxInput("");
      return;
    }
    
    const clamped = Math.max(minVal, Math.min(maxVal, parsed));
    
    if (type === "min") {
      onRangeChange({ min: Math.min(clamped, currentMax - step), max: currentMax });
      setMinInput("");
    } else {
      onRangeChange({ min: currentMin, max: Math.max(clamped, currentMin + step) });
      setMaxInput("");
    }
  };
  
  const minPercent = ((currentMin - minVal) / range) * 100;
  const maxPercent = ((currentMax - minVal) / range) * 100;
  
  return (
    <div className="p-3 bg-brand/5 dark:bg-brand/10 rounded-lg border border-brand/20 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-neutral-900 dark:text-white">{config.label}</div>
          <div className="text-[9px] text-neutral-500">{config.description}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <X className="h-3.5 w-3.5 text-neutral-400" />
        </button>
      </div>
      
      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-neutral-500">Range: {formatVal(minVal)} – {formatVal(maxVal)}</span>
        <span className="text-neutral-500">Avg: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{formatVal(avgVal)}</span></span>
      </div>
      
      {/* Input boxes */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[9px] text-neutral-500 mb-0.5 block">Min</label>
          <input
            type="text"
            placeholder={formatVal(minVal)}
            value={minInput || formatVal(currentMin).replace("%", "")}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={() => handleInputBlur("min")}
            onKeyDown={(e) => e.key === "Enter" && handleInputBlur("min")}
            className="w-full px-2 py-1.5 text-xs font-medium text-center rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <span className="text-neutral-400 mt-4">–</span>
        <div className="flex-1">
          <label className="text-[9px] text-neutral-500 mb-0.5 block">Max</label>
          <input
            type="text"
            placeholder={formatVal(maxVal)}
            value={maxInput || formatVal(currentMax).replace("%", "")}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={() => handleInputBlur("max")}
            onKeyDown={(e) => e.key === "Enter" && handleInputBlur("max")}
            className="w-full px-2 py-1.5 text-xs font-medium text-center rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        {config.isPercentage && <span className="text-neutral-400 text-xs mt-4">%</span>}
      </div>
      
      {/* Dual range slider */}
      <div className="relative h-8 px-1 mt-1">
        {/* Track background */}
        <div className="absolute left-1 right-1 top-3.5 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
        {/* Active track */}
        <div
          className="absolute top-3.5 h-2 bg-brand rounded-full pointer-events-none"
          style={{
            left: `calc(${minPercent}% + 4px)`,
            width: `calc(${maxPercent - minPercent}%)`,
          }}
        />
        {/* Min thumb */}
        <div
          className="absolute top-1.5 w-5 h-5 rounded-full bg-white border-2 border-brand shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          style={{ left: `calc(${minPercent}% - 6px)`, zIndex: currentMin >= currentMax - step ? 1 : 3 }}
          onMouseDown={(e) => {
            e.preventDefault();
            const track = e.currentTarget.parentElement!;
            const rect = track.getBoundingClientRect();
            const handleMove = (moveE: MouseEvent) => {
              const pct = Math.max(0, Math.min(1, (moveE.clientX - rect.left - 4) / (rect.width - 8)));
              const newVal = minVal + pct * range;
              const snapped = Math.round(newVal / step) * step;
              const clamped = Math.max(minVal, Math.min(currentMax - step, snapped));
              onRangeChange({ min: clamped, max: currentMax });
            };
            const handleUp = () => {
              document.removeEventListener("mousemove", handleMove);
              document.removeEventListener("mouseup", handleUp);
            };
            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
          }}
        />
        {/* Max thumb */}
        <div
          className="absolute top-1.5 w-5 h-5 rounded-full bg-white border-2 border-brand shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          style={{ left: `calc(${maxPercent}% - 6px)`, zIndex: currentMin >= currentMax - step ? 3 : 1 }}
          onMouseDown={(e) => {
            e.preventDefault();
            const track = e.currentTarget.parentElement!;
            const rect = track.getBoundingClientRect();
            const handleMove = (moveE: MouseEvent) => {
              const pct = Math.max(0, Math.min(1, (moveE.clientX - rect.left - 4) / (rect.width - 8)));
              const newVal = minVal + pct * range;
              const snapped = Math.round(newVal / step) * step;
              const clamped = Math.max(currentMin + step, Math.min(maxVal, snapped));
              onRangeChange({ min: currentMin, max: clamped });
            };
            const handleUp = () => {
              document.removeEventListener("mousemove", handleMove);
              document.removeEventListener("mouseup", handleUp);
            };
            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
          }}
        />
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => onRangeChange(null)}
          className="text-[10px] text-red-500 hover:text-red-600 font-medium"
        >
          Clear filter
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-[10px] font-semibold text-white bg-brand rounded hover:bg-brand/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function ChartFilters({
  games,
  allSeasonGames,
  filters,
  onFiltersChange,
  market,
  className,
}: ChartFiltersProps) {
  const [expandedFilter, setExpandedFilter] = useState<keyof ChartFiltersState | null>(null);
  
  // Use allSeasonGames for range calculation if available, otherwise use games
  const rangeGames = allSeasonGames && allSeasonGames.length > 0 ? allSeasonGames : games;
  
  // Calculate stats from full season games (for slider ranges)
  const stats = useMemo(() => {
    if (rangeGames.length === 0) return null;
    
    const result: Record<string, { min: number; max: number; avg: number }> = {};
    
    for (const config of ALL_FILTERS) {
      const values = rangeGames.map(config.getValue).filter(v => !isNaN(v) && v !== undefined && v !== null);
      if (values.length === 0) {
        result[config.key] = { min: 0, max: 100, avg: 50 };
      } else {
        result[config.key] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }
    
    return result;
  }, [rangeGames]);
  
  if (!stats || rangeGames.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-neutral-500">
        No game data available
      </div>
    );
  }
  
  // Group filters by category
  const filtersByCategory = useMemo(() => {
    const grouped: Record<string, FilterConfig[]> = {};
    for (const config of ALL_FILTERS) {
      if (!grouped[config.category]) grouped[config.category] = [];
      grouped[config.category].push(config);
    }
    return grouped;
  }, []);
  
  // Count active filters
  const activeCount = ALL_FILTERS.filter(c => filters[c.key] !== null).length;
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Active filter slider */}
      {expandedFilter && stats[expandedFilter] && (
        <FilterSlider
          config={ALL_FILTERS.find(c => c.key === expandedFilter)!}
          minVal={stats[expandedFilter].min}
          maxVal={stats[expandedFilter].max}
          avgVal={stats[expandedFilter].avg}
          selectedRange={filters[expandedFilter] as FilterRange | null}
          onRangeChange={(range) => onFiltersChange({ ...filters, [expandedFilter]: range })}
          onClose={() => setExpandedFilter(null)}
        />
      )}
      
      {/* Filter list by category */}
      {Object.entries(filtersByCategory).map(([category, categoryFilters]) => (
        <div key={category}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
            {CATEGORY_LABELS[category]}
          </div>
          <div className="flex flex-wrap gap-1">
            {categoryFilters.map((config) => {
              const isActive = filters[config.key] !== null;
              const isExpanded = expandedFilter === config.key;
              const stat = stats[config.key];
              
              return (
                <button
                  key={config.key}
                  type="button"
                  onClick={() => setExpandedFilter(isExpanded ? null : config.key)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border transition-all",
                    isExpanded
                      ? "bg-brand text-white border-brand"
                      : isActive
                        ? "bg-brand/10 text-brand border-brand/30"
                        : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-brand/30"
                  )}
                >
                  <span>{config.label}</span>
                  {isActive && !isExpanded && (
                    <span className="text-[8px] opacity-75">
                      {filters[config.key] && `${Math.round((filters[config.key] as FilterRange).min)}${config.isPercentage ? "%" : ""}`}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "h-3 w-3 transition-transform",
                    isExpanded && "rotate-90"
                  )} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      
      {/* Clear all */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          className="w-full py-1.5 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
        >
          Clear all {activeCount} filters
        </button>
      )}
    </div>
  );
}

// Helper function to apply filters to games
export function applyChartFilters(
  games: BoxScoreGame[],
  filters: ChartFiltersState
): BoxScoreGame[] {
  return games.filter((game) => {
    for (const config of ALL_FILTERS) {
      const filterVal = filters[config.key];
      if (filterVal && typeof filterVal === "object" && "min" in filterVal) {
        const gameVal = config.getValue(game);
        if (gameVal < filterVal.min || gameVal > filterVal.max) return false;
      }
    }
    
    // Legacy filters
    if (filters.homeAway) {
      const isHome = game.homeAway === "H";
      if (filters.homeAway === "home" && !isHome) return false;
      if (filters.homeAway === "away" && isHome) return false;
    }
    if (filters.winLoss) {
      const isWin = game.result === "W";
      if (filters.winLoss === "win" && !isWin) return false;
      if (filters.winLoss === "loss" && isWin) return false;
    }
    
    return true;
  });
}
