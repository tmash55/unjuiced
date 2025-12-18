"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  Filter, 
  X, 
  Flame, 
  TrendingUp, 
  AlertCircle,
  Calendar
} from "lucide-react";
import { 
  TimeWindow, 
  TIME_WINDOW_OPTIONS, 
  CHEAT_SHEET_MARKETS,
  HIT_RATE_OPTIONS 
} from "@/hooks/use-cheat-sheet";

export interface CheatSheetFilterState {
  timeWindow: TimeWindow;
  minHitRate: number;
  oddsFloor: number;
  oddsCeiling: number;
  markets: string[];
  hideAlternates: boolean;
  matchupFilter: "all" | "favorable" | "neutral" | "unfavorable";
  confidenceFilter: string[];
  hideInjured: boolean;
  hideB2B: boolean;
  trendFilter: string[];
  dateFilter: "today" | "tomorrow" | "all";
}

// Helper to get formatted date string (YYYY-MM-DD) in Eastern Time
// NBA games are scheduled in ET, so we need to use ET for date calculations
function getDateStringET(daysFromNow: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  
  // Format in Eastern Time (NBA schedule timezone)
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return etFormatter.format(date);
}

// Get current hour in Eastern Time (0-23)
function getCurrentHourET(): number {
  const now = new Date();
  const etTimeString = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(etTimeString, 10);
}

// Determine smart default date: "tomorrow" if all today's games likely started (after 8pm ET)
export function getSmartDefaultDateFilter(): "today" | "tomorrow" {
  const hourET = getCurrentHourET();
  // NBA games typically start between 7pm-10pm ET
  // If it's after 8pm ET, most/all games have started, show tomorrow
  return hourET >= 20 ? "tomorrow" : "today";
}

// Get dates array based on filter selection
export function getDateFilterDates(filter: "today" | "tomorrow" | "all"): string[] | undefined {
  switch (filter) {
    case "today":
      return [getDateStringET(0)];
    case "tomorrow":
      return [getDateStringET(1)];
    case "all":
      return undefined;
  }
}

const DATE_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "tomorrow" as const, label: "Tomorrow" },
  { value: "all" as const, label: "All Dates" },
];

interface CheatSheetFiltersProps {
  filters: CheatSheetFilterState;
  onFiltersChange: (filters: CheatSheetFilterState) => void;
  resultCount?: number;
}

const CONFIDENCE_OPTIONS = [
  { value: "A+", label: "A+" },
  { value: "A", label: "A" },
  { value: "B+", label: "B+" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

const TREND_OPTIONS = [
  { value: "hot", label: "Hot", icon: "🔥" },
  { value: "improving", label: "Improving", icon: "📈" },
  { value: "stable", label: "Stable", icon: "➡️" },
];

const MATCHUP_OPTIONS = [
  { value: "all", label: "All Matchups" },
  { value: "favorable", label: "Favorable (21-30)" },
  { value: "neutral", label: "Neutral (11-20)" },
  { value: "unfavorable", label: "Tough (1-10)" },
];

export function CheatSheetFilters({ 
  filters, 
  onFiltersChange,
  resultCount 
}: CheatSheetFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof CheatSheetFilterState>(
    key: K, 
    value: CheatSheetFilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleMarket = (market: string) => {
    const newMarkets = filters.markets.includes(market)
      ? filters.markets.filter((m) => m !== market)
      : [...filters.markets, market];
    updateFilter("markets", newMarkets);
  };

  const toggleConfidence = (grade: string) => {
    const newGrades = filters.confidenceFilter.includes(grade)
      ? filters.confidenceFilter.filter((g) => g !== grade)
      : [...filters.confidenceFilter, grade];
    updateFilter("confidenceFilter", newGrades);
  };

  const toggleTrend = (trend: string) => {
    const newTrends = filters.trendFilter.includes(trend)
      ? filters.trendFilter.filter((t) => t !== trend)
      : [...filters.trendFilter, trend];
    updateFilter("trendFilter", newTrends);
  };

  const resetFilters = () => {
    onFiltersChange({
      timeWindow: "last_10_pct",
      minHitRate: 0.80,
      oddsFloor: -250,
      oddsCeiling: 250,
      markets: CHEAT_SHEET_MARKETS.map(m => m.value),
      hideAlternates: false,
      matchupFilter: "all",
      confidenceFilter: [],
      hideInjured: false,
      hideB2B: false,
      trendFilter: [],
      dateFilter: "today",
    });
  };

  const activeFilterCount = [
    filters.markets.length !== CHEAT_SHEET_MARKETS.length,
    filters.minHitRate !== 0.80,
    filters.oddsFloor !== -250 || filters.oddsCeiling !== 250,
    filters.hideAlternates,
    filters.matchupFilter !== "all",
    filters.confidenceFilter.length > 0,
    filters.hideInjured,
    filters.hideB2B,
    filters.trendFilter.length > 0,
    filters.dateFilter !== "today", // Show as active if not today
  ].filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      {/* Primary Filters Row */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateFilter("dateFilter", opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                filters.dateFilter === opt.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Time Window */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {TIME_WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateFilter("timeWindow", opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                filters.timeWindow === opt.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>

        {/* Hit Rate Threshold */}
        <div className="relative">
          <select
            value={filters.minHitRate}
            onChange={(e) => updateFilter("minHitRate", parseFloat(e.target.value))}
            className="appearance-none bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 pr-8 text-xs font-semibold cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {HIT_RATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} Hit Rate
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>

        {/* Odds Range */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500 font-medium">Odds:</span>
          <input
            type="number"
            value={filters.oddsFloor}
            onChange={(e) => updateFilter("oddsFloor", parseInt(e.target.value) || -250)}
            className="w-16 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-semibold text-center"
            placeholder="-250"
          />
          <span className="text-neutral-400">to</span>
          <input
            type="number"
            value={filters.oddsCeiling}
            onChange={(e) => updateFilter("oddsCeiling", parseInt(e.target.value) || 250)}
            className="w-16 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-semibold text-center"
            placeholder="+250"
          />
        </div>

        {/* Hide Alternates Toggle */}
        <button
          onClick={() => updateFilter("hideAlternates", !filters.hideAlternates)}
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
            filters.hideAlternates
              ? "bg-brand/10 text-brand border-brand/30"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          Hide Alt Lines
        </button>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
            showAdvanced || activeFilterCount > 0
              ? "bg-brand/10 text-brand border-brand/30"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-brand text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Results Count */}
        {resultCount !== undefined && (
          <div className="ml-auto text-xs text-neutral-500">
            <span className="font-bold text-neutral-900 dark:text-white">{resultCount}</span> props found
          </div>
        )}

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="px-4 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Markets */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 block">
                Markets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CHEAT_SHEET_MARKETS.slice(0, 8).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => toggleMarket(m.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-medium transition-all",
                      filters.markets.includes(m.value)
                        ? "bg-brand text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matchup Difficulty */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 block">
                Matchup (DvP)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MATCHUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("matchupFilter", opt.value as any)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-medium transition-all",
                      filters.matchupFilter === opt.value
                        ? "bg-brand text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 block">
                Confidence Grade
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleConfidence(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-bold transition-all",
                      filters.confidenceFilter.includes(opt.value)
                        ? "bg-brand text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trend & Extras */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 block">
                Trend & Filters
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TREND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleTrend(opt.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                      filters.trendFilter.includes(opt.value)
                        ? "bg-brand text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                    )}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => updateFilter("hideInjured", !filters.hideInjured)}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                    filters.hideInjured
                      ? "bg-red-500 text-white"
                      : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-red-500"
                  )}
                >
                  <AlertCircle className="w-3 h-3" />
                  Hide Injured
                </button>
                <button
                  onClick={() => updateFilter("hideB2B", !filters.hideB2B)}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1",
                    filters.hideB2B
                      ? "bg-orange-500 text-white"
                      : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-orange-500"
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  Hide B2B
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Default filter state
export const DEFAULT_CHEAT_SHEET_FILTERS: CheatSheetFilterState = {
  timeWindow: "last_10_pct",
  minHitRate: 0.80,
  oddsFloor: -250,
  oddsCeiling: 250,
  markets: CHEAT_SHEET_MARKETS.map(m => m.value),
  hideAlternates: false,
  matchupFilter: "all",
  confidenceFilter: [],
  hideInjured: false,
  hideB2B: false,
  trendFilter: [],
  dateFilter: "today",
};

