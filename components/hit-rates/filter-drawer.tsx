"use client";

import React, { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartFilters, ChartFiltersState, DEFAULT_FILTERS } from "./chart-filters";
import { SmartPresets, SmartPreset, applyPreset } from "./smart-presets";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Custom section icons (unique designs, not generic)
const QuickFilterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-emerald-500" stroke="currentColor" strokeWidth="2">
    <path d="M3 4h18M7 9h10M10 14h4M11 19h2" strokeLinecap="round"/>
  </svg>
);

const PresetsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-amber-500" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <circle cx="6.5" cy="6.5" r="1" fill="currentColor"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
  </svg>
);

const PerformanceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-purple-500" stroke="currentColor" strokeWidth="2">
    <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FiltersHeaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-brand" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h10M4 18h4" strokeLinecap="round"/>
    <circle cx="18" cy="12" r="2"/>
    <circle cx="12" cy="18" r="2"/>
  </svg>
);

const FilterButtonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h10M4 18h4" strokeLinecap="round"/>
    <circle cx="18" cy="12" r="2"/>
    <circle cx="12" cy="18" r="2"/>
  </svg>
);

// Quick filter type
type QuickFilterKey = "home" | "away" | "win" | "loss" | "wonBy10" | "lostBy10" | "primetime" | "dvpTough" | "dvpAverage" | "dvpWeak";

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Quick filters
  quickFilters: Set<string>;
  onQuickFilterToggle: (key: QuickFilterKey) => void;
  onQuickFiltersClear: () => void;
  // Chart filters
  chartFilters: ChartFiltersState;
  onChartFiltersChange: (filters: ChartFiltersState) => void;
  gamesForFilters: BoxScoreGame[];
  market: string;
  // DvP data
  hasDvpData?: boolean;
  // Active filter counts
  activeQuickFiltersCount: number;
  activeChartFiltersCount: number;
  activeInjuryFiltersCount: number;
}

const QUICK_FILTERS: { key: QuickFilterKey; label: string; group: "location" | "result" | "margin" | "dvp" }[] = [
  { key: "home", label: "Home", group: "location" },
  { key: "away", label: "Away", group: "location" },
  { key: "win", label: "Win", group: "result" },
  { key: "loss", label: "Loss", group: "result" },
  { key: "wonBy10", label: "Won 10+", group: "margin" },
  { key: "lostBy10", label: "Lost 10+", group: "margin" },
  { key: "dvpTough", label: "DvP 1-10", group: "dvp" },
  { key: "dvpAverage", label: "DvP 11-20", group: "dvp" },
  { key: "dvpWeak", label: "DvP 21-30", group: "dvp" },
];

// Human-readable labels for quick filters
const QUICK_FILTER_LABELS: Record<string, string> = {
  home: "Home",
  away: "Away",
  win: "Win",
  loss: "Loss",
  wonBy10: "Won 10+",
  lostBy10: "Lost 10+",
  dvpTough: "Tough Def",
  dvpAverage: "Avg Def",
  dvpWeak: "Weak Def",
};

export function FilterDrawer({
  isOpen,
  onClose,
  quickFilters,
  onQuickFilterToggle,
  onQuickFiltersClear,
  chartFilters,
  onChartFiltersChange,
  gamesForFilters,
  market,
  hasDvpData = false,
  activeQuickFiltersCount,
  activeChartFiltersCount,
  activeInjuryFiltersCount,
}: FilterDrawerProps) {
  // Expanded sections state
  const [quickExpanded, setQuickExpanded] = useState(true);
  const [presetsExpanded, setPresetsExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Handle preset application
  const handleApplyPreset = (preset: SmartPreset) => {
    const result = applyPreset(preset, quickFilters, chartFilters);
    
    // Apply chart filters
    onChartFiltersChange(result.chartFilters);
    
    // For quick filters, we need to manually apply each one
    // First clear, then apply new ones
    const currentFiltersArray = Array.from(quickFilters).sort();
    const newFiltersArray = Array.from(result.quickFilters).sort();
    
    // Only update if there's an actual change
    if (JSON.stringify(currentFiltersArray) !== JSON.stringify(newFiltersArray)) {
      // Clear all first
      if (quickFilters.size > 0) {
        onQuickFiltersClear();
      }
      
      // Then apply new filters
      if (newFiltersArray.length > 0) {
        newFiltersArray.forEach(filter => {
          onQuickFilterToggle(filter as QuickFilterKey);
        });
      }
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const totalActiveFilters = activeQuickFiltersCount + activeChartFiltersCount + activeInjuryFiltersCount;

  const getDvpColor = (key: QuickFilterKey) => {
    if (key === "dvpTough") return "bg-red-500 border-red-500";
    if (key === "dvpAverage") return "bg-amber-500 border-amber-500";
    if (key === "dvpWeak") return "bg-emerald-500 border-emerald-500";
    return "bg-brand border-brand";
  };

  return (
    <>
      {/* Backdrop - dimmed overlay without blur for better chart visibility */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl z-50",
          "transform transition-transform duration-300 ease-out",
          "border-l border-neutral-200 dark:border-neutral-800",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand/10 dark:bg-brand/20">
              <FiltersHeaderIcon />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Filters</h2>
              {totalActiveFilters > 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {totalActiveFilters} filter{totalActiveFilters !== 1 ? "s" : ""} active
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5 text-neutral-500" />
          </button>
        </div>

        {/* Active Filters Summary Bar */}
        {totalActiveFilters > 0 && (
          <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0">
                  Applied:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(quickFilters).map((filter) => (
                    <span
                      key={filter}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-brand/10 text-brand rounded-md"
                    >
                      {QUICK_FILTER_LABELS[filter] || filter}
                    </span>
                  ))}
                  {activeChartFiltersCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
                      {activeChartFiltersCount} stat filter{activeChartFiltersCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {activeInjuryFiltersCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md">
                      {activeInjuryFiltersCount} teammate{activeInjuryFiltersCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onQuickFiltersClear();
                  onChartFiltersChange(DEFAULT_FILTERS);
                }}
                className="text-[10px] font-bold text-red-500 hover:text-red-600 shrink-0"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick Filters Section */}
          <div className="border-b border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setQuickExpanded(!quickExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <QuickFilterIcon />
                <span className="font-semibold text-neutral-900 dark:text-white">Quick Filters</span>
                {activeQuickFiltersCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-brand/10 text-brand rounded-full">
                    {activeQuickFiltersCount}
                  </span>
                )}
              </div>
              {quickExpanded ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {quickExpanded && (
              <div className="px-5 pb-5 space-y-4">
                {/* Location */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Location</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FILTERS.filter(f => f.group === "location").map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onQuickFilterToggle(key)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                          quickFilters.has(key)
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Result</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FILTERS.filter(f => f.group === "result" || f.group === "margin").map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onQuickFilterToggle(key)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                          quickFilters.has(key)
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DvP (Defense vs Position) */}
                {hasDvpData && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                      Opponent Defense (DvP)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_FILTERS.filter(f => f.group === "dvp").map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onQuickFilterToggle(key)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                            quickFilters.has(key)
                              ? `${getDvpColor(key)} text-white shadow-sm`
                              : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-2">
                      1-10 = Tough defense · 21-30 = Weak defense
                    </p>
                  </div>
                )}

                {/* Clear Quick Filters */}
                {activeQuickFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={onQuickFiltersClear}
                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Clear quick filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Smart Presets Section */}
          <div className="border-b border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setPresetsExpanded(!presetsExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PresetsIcon />
                <span className="font-semibold text-neutral-900 dark:text-white">Smart Presets</span>
              </div>
              {presetsExpanded ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {presetsExpanded && (
              <div className="px-5 pb-5">
                <SmartPresets
                  quickFilters={quickFilters}
                  chartFilters={chartFilters}
                  onApplyPreset={handleApplyPreset}
                />
              </div>
            )}
          </div>

          {/* Advanced Filters Section */}
          <div className="border-b border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setAdvancedExpanded(!advancedExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PerformanceIcon />
                <span className="font-semibold text-neutral-900 dark:text-white">Performance Filters</span>
                {activeChartFiltersCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                    {activeChartFiltersCount}
                  </span>
                )}
              </div>
              {advancedExpanded ? (
                <ChevronUp className="h-4 w-4 text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              )}
            </button>

            {advancedExpanded && (
              <div className="px-5 pb-5">
                <ChartFilters
                  games={gamesForFilters}
                  filters={chartFilters}
                  onFiltersChange={onChartFiltersChange}
                  market={market}
                  isExpanded={true}
                  hideControls={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  onQuickFiltersClear();
                  onChartFiltersChange(DEFAULT_FILTERS);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                Clear All Filters
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-6 py-2.5 text-sm font-bold text-white bg-brand rounded-xl shadow-md hover:shadow-lg transition-all",
                totalActiveFilters > 0 ? "flex-1" : "w-full"
              )}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Filter button to open the drawer
export function FilterButton({
  onClick,
  activeCount,
}: {
  onClick: () => void;
  activeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all",
        activeCount > 0
          ? "bg-brand/10 border-brand/30 text-brand hover:bg-brand/20"
          : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      <FilterButtonIcon />
      <span>Filters</span>
      {activeCount > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand text-white rounded-full min-w-[18px] text-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
