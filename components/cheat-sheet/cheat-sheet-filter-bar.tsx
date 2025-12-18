"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  Filter, 
  X, 
  HelpCircle,
  AlertCircle,
  Calendar,
  Flame
} from "lucide-react";
import { 
  TimeWindow, 
  TIME_WINDOW_OPTIONS, 
  CHEAT_SHEET_MARKETS,
  HIT_RATE_OPTIONS 
} from "@/hooks/use-cheat-sheet";
import { CheatSheetFilterState } from "./cheat-sheet-filters";

// Controlled number input that allows clearing during typing
function OddsInput({ 
  value, 
  onChange, 
  placeholder,
  className 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  placeholder: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  
  // Sync from parent when value changes externally
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;
        setLocalValue(val); // Always update local display
        
        // Only update parent if valid number
        const num = parseInt(val);
        if (!isNaN(num)) {
          onChange(num);
        }
      }}
      onBlur={() => {
        // On blur, if empty or invalid, reset to current filter value
        const num = parseInt(localValue);
        if (isNaN(num)) {
          setLocalValue(String(value));
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/tooltip";
import { Lock } from "lucide-react";

interface CheatSheetFilterBarProps {
  filters: CheatSheetFilterState;
  onFiltersChange: (filters: CheatSheetFilterState) => void;
  resultCount?: number;
  onGlossaryOpen?: () => void;
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  noOddsCount?: number;
  isGated?: boolean; // If true, disable filters and show upgrade tooltips
}

const DATE_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "tomorrow" as const, label: "Tomorrow" },
  { value: "all" as const, label: "All" },
];

const CONFIDENCE_OPTIONS = [
  { value: "A+", label: "A+" },
  { value: "A", label: "A" },
  { value: "B+", label: "B+" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

const MATCHUP_OPTIONS = [
  { value: "all", label: "All Matchups" },
  { value: "favorable", label: "Easy (21-30)" },
  { value: "neutral", label: "Neutral (11-20)" },
  { value: "unfavorable", label: "Tough (1-10)" },
];

const TREND_OPTIONS = [
  { value: "hot", label: "Hot", icon: Flame, tooltip: "Players on 5+ game hit streaks" },
];

export function CheatSheetFilterBar({ 
  filters, 
  onFiltersChange,
  resultCount,
  onGlossaryOpen,
  hideNoOdds,
  onHideNoOddsChange,
  noOddsCount = 0,
  isGated = false,
}: CheatSheetFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  
  // Upgrade tooltip content for gated users
  const upgradeTooltip = "Upgrade to Hit Rate or Pro plan to unlock all filters";

  // Close market dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const selectAllMarkets = () => {
    updateFilter("markets", CHEAT_SHEET_MARKETS.map((m) => m.value));
  };

  const deselectAllMarkets = () => {
    // Default to Points when deselecting all
    updateFilter("markets", ["player_points"]);
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
      markets: ["player_points"], // Default to Points only
      hideAlternates: false,
      matchupFilter: "all",
      confidenceFilter: [],
      hideInjured: false,
      hideB2B: false,
      hideNoOdds: true,
      trendFilter: [],
      dateFilter: "today",
    });
  };

  const activeFilterCount = [
    // Markets is active if not just Points (the default)
    !(filters.markets.length === 1 && filters.markets[0] === "player_points"),
    filters.minHitRate !== 0.80,
    filters.oddsFloor !== -250 || filters.oddsCeiling !== 250,
    filters.hideAlternates,
    filters.matchupFilter !== "all",
    filters.confidenceFilter.length > 0,
    filters.hideInjured,
    filters.hideB2B,
    filters.trendFilter.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      {/* Header Row */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
            NBA Hit Rate Cheat Sheet
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            High-confidence props ranked by our scoring system
          </p>
        </div>
        <div className="flex items-center gap-3">
          {resultCount !== undefined && (
            <div className="text-xs text-neutral-500">
              <span className="font-bold text-neutral-900 dark:text-white">{resultCount}</span> props
            </div>
          )}
          {onGlossaryOpen && (
            <button
              onClick={onGlossaryOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              How It Works
            </button>
          )}
        </div>
      </div>

      {/* Primary Filters Row */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-4">
        {/* Date Filter */}
        {isGated ? (
          <Tooltip content={upgradeTooltip}>
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-neutral-400">
                <Lock className="w-3 h-3" />
                <span>Today</span>
              </div>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateFilter("dateFilter", opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                  filters.dateFilter === opt.value
                    ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

        {/* Time Window */}
        {isGated ? (
          <Tooltip content={upgradeTooltip}>
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-neutral-400">
                <Lock className="w-3 h-3" />
                <span>Last 10%</span>
              </div>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            {TIME_WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateFilter("timeWindow", opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                  filters.timeWindow === opt.value
                    ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

        {/* Market Filter - Inline */}
        {isGated ? (
          <Tooltip content={upgradeTooltip}>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-50 cursor-not-allowed">
              <Lock className="w-3 h-3" />
              <span>Points Only</span>
            </div>
          </Tooltip>
        ) : (
          <div ref={marketDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                filters.markets.length !== CHEAT_SHEET_MARKETS.length
                  ? "bg-brand/10 text-brand"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              <span>
                {filters.markets.length === 0 || filters.markets.length === CHEAT_SHEET_MARKETS.length
                  ? "All Markets"
                  : filters.markets.length === 1
                  ? CHEAT_SHEET_MARKETS.find(o => o.value === filters.markets[0])?.label ?? "1 Market"
                  : `${filters.markets.length} Markets`}
              </span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", marketDropdownOpen && "rotate-180")} />
            </button>

            {marketDropdownOpen && (
              <div className="absolute left-0 top-full z-[100] mt-1 w-[220px] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-2">
                  <button type="button" onClick={selectAllMarkets} className="text-xs font-medium text-brand hover:underline">
                    Select All
                  </button>
                  <button type="button" onClick={deselectAllMarkets} className="text-xs font-medium text-neutral-400 hover:underline">
                    Clear
                  </button>
                </div>
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                  {CHEAT_SHEET_MARKETS.map((market) => {
                    const isSelected = filters.markets.includes(market.value);
                    return (
                      <label
                        key={market.value}
                        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMarket(market.value)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{market.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

        {/* Hit Rate Threshold */}
        {isGated ? (
          <Tooltip content={upgradeTooltip}>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-50 cursor-not-allowed">
              <Lock className="w-3 h-3" />
              <span>≥80%</span>
            </div>
          </Tooltip>
        ) : (
          <div className="relative">
            <select
              value={filters.minHitRate}
              onChange={(e) => updateFilter("minHitRate", parseFloat(e.target.value))}
              className="appearance-none bg-neutral-100 dark:bg-neutral-800 rounded-lg px-2.5 py-1.5 pr-7 text-xs font-semibold cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300"
            >
              {HIT_RATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
          </div>
        )}

        {/* Odds Range - Compact */}
        {isGated ? (
          <Tooltip content={upgradeTooltip}>
            <div className="flex items-center gap-1 text-xs opacity-50 cursor-not-allowed">
              <Lock className="w-3 h-3 text-neutral-400" />
              <span className="text-neutral-400 font-medium">Odds: All</span>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-400 font-medium">Odds:</span>
            <OddsInput
              value={filters.oddsFloor}
              onChange={(val) => updateFilter("oddsFloor", val)}
              placeholder="-250"
              className="w-14 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-center text-neutral-700 dark:text-neutral-300"
            />
            <span className="text-neutral-300 dark:text-neutral-600">→</span>
            <OddsInput
              value={filters.oddsCeiling}
              onChange={(val) => updateFilter("oddsCeiling", val)}
              placeholder="+250"
              className="w-14 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-center text-neutral-700 dark:text-neutral-300"
            />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Advanced Filters Toggle - Always clickable, filters locked for gated users */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
            showAdvanced || activeFilterCount > 0
              ? "bg-brand/10 text-brand"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          <Filter className="w-3 h-3" />
          Filters
          {activeFilterCount > 0 && !isGated && (
            <span className="bg-brand text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && !isGated && (
          <button
            onClick={resetFilters}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Reset filters"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Advanced Filters Panel - Visible for all, but locked for gated users */}
      {showAdvanced && (
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
          {/* Upgrade banner for gated users */}
          {isGated && (
            <div className="flex items-center gap-2 p-2.5 mb-3 rounded-lg bg-brand/10 border border-brand/20">
              <Lock className="w-3.5 h-3.5 text-brand shrink-0" />
              <span className="text-xs text-neutral-600 dark:text-neutral-300">
                <a href="/pricing" className="font-semibold text-brand hover:underline">Upgrade</a> to unlock all filters
              </span>
            </div>
          )}
          
          <div className={cn("flex flex-wrap items-end justify-between gap-4", isGated && "opacity-50 pointer-events-none")}>
            {/* Matchup (DvP) */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                Matchup
              </label>
              <div className="flex gap-1">
                {MATCHUP_OPTIONS.map((opt) => (
                  <Tooltip key={opt.value} content={`Defense vs Position rank ${opt.value === "favorable" ? "21-30 (weak defense)" : opt.value === "neutral" ? "11-20" : opt.value === "unfavorable" ? "1-10 (strong defense)" : "Show all"}`} side="top">
                    <button
                      onClick={() => !isGated && updateFilter("matchupFilter", opt.value as any)}
                      disabled={isGated}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        filters.matchupFilter === opt.value
                          ? "bg-brand text-white"
                          : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                      )}
                    >
                      {opt.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                Confidence
              </label>
              <div className="flex gap-1">
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <Tooltip key={opt.value} content={`Filter by ${opt.value} confidence grade`} side="top">
                    <button
                      onClick={() => !isGated && toggleConfidence(opt.value)}
                      disabled={isGated}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        filters.confidenceFilter.includes(opt.value)
                          ? "bg-brand text-white"
                          : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                      )}
                    >
                      {opt.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Quick Filters */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                Quick Filters
              </label>
              <div className="flex gap-1">
                {TREND_OPTIONS.map((opt) => (
                  <Tooltip key={opt.value} content={opt.tooltip} side="top">
                    <button
                      onClick={() => !isGated && toggleTrend(opt.value)}
                      disabled={isGated}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        filters.trendFilter.includes(opt.value)
                          ? "bg-brand text-white"
                          : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-brand"
                      )}
                    >
                      {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                      {opt.label}
                    </button>
                  </Tooltip>
                ))}
                <Tooltip content="Hide players with injury designations" side="top">
                  <button
                    onClick={() => !isGated && updateFilter("hideInjured", !filters.hideInjured)}
                    disabled={isGated}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      filters.hideInjured
                        ? "bg-red-500 text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-red-500"
                    )}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    No Injured
                  </button>
                </Tooltip>
                <Tooltip content="Hide players on back-to-back games" side="top">
                  <button
                    onClick={() => !isGated && updateFilter("hideB2B", !filters.hideB2B)}
                    disabled={isGated}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      filters.hideB2B
                        ? "bg-orange-500 text-white"
                        : "bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-orange-500"
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    No B2B
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grade Legend Row */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-800/10">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-neutral-400 font-medium">Grades:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-5 h-4 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[9px]">A+</span>
              <span className="text-neutral-500">90+</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-4 rounded bg-green-500/20 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-[9px]">A</span>
              <span className="text-neutral-500">80-89</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-4 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold flex items-center justify-center text-[9px]">B+</span>
              <span className="text-neutral-500">70-79</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-4 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center text-[9px]">B</span>
              <span className="text-neutral-500">60-69</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-5 h-4 rounded bg-neutral-500/20 text-neutral-500 font-bold flex items-center justify-center text-[9px]">C</span>
              <span className="text-neutral-500">&lt;60</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Hide/Show without odds toggle */}
          {onHideNoOddsChange && (
            <button
              onClick={() => onHideNoOddsChange(!hideNoOdds)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                hideNoOdds
                  ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                  : "bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20"
              )}
            >
              {hideNoOdds ? (
                <>Show {noOddsCount} without odds</>
              ) : (
                <>Hide {noOddsCount} without odds</>
              )}
            </button>
          )}
          
          {/* Matchup legend */}
          <div className="flex items-center gap-3 text-[10px] text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Easy matchup
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Tough
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

