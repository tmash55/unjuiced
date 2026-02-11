"use client";

import React, { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartFiltersState, DEFAULT_FILTERS } from "./chart-filters";

// Custom SVG icons for premium look
const UsageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round"/>
  </svg>
);

const MinutesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 6v6l4 2" strokeLinecap="round"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 3L4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>
);

const BoltIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
    <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 21h6M12 17v4M6 3h12v6a6 6 0 11-12 0V3z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Preset configuration type
export interface SmartPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  // Quick filters to apply
  quickFilters: string[];
  // Chart filters to apply
  chartFilters: Partial<ChartFiltersState>;
  // Is this a user-saved preset?
  isUserPreset?: boolean;
}

// Default hardcoded presets
// Note: usagePct is stored as decimal (0.25 = 25%)
export const DEFAULT_PRESETS: SmartPreset[] = [
  {
    id: "high-usage",
    name: "High Usage",
    description: "Games with 25%+ usage rate",
    icon: <UsageIcon />,
    color: "from-orange-500 to-amber-400",
    quickFilters: [],
    chartFilters: {
      usage: { min: 0.25, max: 1.0 }, // 25%+ usage (stored as decimal)
    },
  },
  {
    id: "heavy-minutes",
    name: "Heavy Minutes",
    description: "Games with 34+ minutes played",
    icon: <MinutesIcon />,
    color: "from-sky-500 to-blue-400",
    quickFilters: [],
    chartFilters: {
      minutes: { min: 34, max: 48 },
    },
  },
  {
    id: "tough-defense",
    name: "Tough Defense",
    description: "Games vs top-10 defenses (DvP 1-10)",
    icon: <ShieldIcon />,
    color: "from-rose-500 to-red-400",
    quickFilters: ["dvpTough"],
    chartFilters: {},
  },
  {
    id: "soft-matchup",
    name: "Soft Matchup",
    description: "Games vs weak defenses (DvP 21-30)",
    icon: <TargetIcon />,
    color: "from-emerald-500 to-teal-400",
    quickFilters: ["dvpWeak"],
    chartFilters: {},
  },
  {
    id: "scoring-role",
    name: "Scoring Role",
    description: "High FGA (15+) with 22%+ usage",
    icon: <BoltIcon />,
    color: "from-violet-500 to-purple-400",
    quickFilters: [],
    chartFilters: {
      fga: { min: 15, max: 40 },
      usage: { min: 0.22, max: 1.0 }, // 22%+ usage (stored as decimal)
    },
  },
  {
    id: "blowout-wins",
    name: "Blowout Wins",
    description: "Games won by 10+ points",
    icon: <TrophyIcon />,
    color: "from-amber-500 to-yellow-400",
    quickFilters: ["wonBy10"],
    chartFilters: {},
  },
];

interface SmartPresetsProps {
  quickFilters: Set<string>;
  chartFilters: ChartFiltersState;
  onApplyPreset: (preset: SmartPreset) => void;
  userPresets?: SmartPreset[];
  onSavePreset?: (name: string) => void;
  className?: string;
}

export function SmartPresets({
  quickFilters,
  chartFilters,
  onApplyPreset,
  userPresets = [],
  onSavePreset,
  className,
}: SmartPresetsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Check if a preset is currently active
  const isPresetActive = (preset: SmartPreset): boolean => {
    // Check quick filters
    const quickFiltersMatch = preset.quickFilters.every(f => quickFilters.has(f));
    if (!quickFiltersMatch) return false;

    // Check chart filters
    for (const [key, value] of Object.entries(preset.chartFilters)) {
      const currentValue = chartFilters[key as keyof ChartFiltersState];
      if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
        return false;
      }
    }

    return true;
  };

  // Check if there are any active filters (to show save button)
  const hasActiveFilters = quickFilters.size > 0 || Object.values(chartFilters).some(v => v !== null);

  const allPresets = [...DEFAULT_PRESETS, ...userPresets];

  // Count how many presets are currently active (for stacking indicator)
  const activePresetCount = allPresets.filter(p => isPresetActive(p)).length;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Stacking Indicator - Show when multiple presets are stacked */}
      {activePresetCount > 1 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/30">
          <div className="flex items-center -space-x-1">
            {allPresets
              .filter(p => isPresetActive(p))
              .slice(0, 3)
              .map((preset, idx) => (
                <div
                  key={preset.id}
                  className={cn(
                    "w-5 h-5 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[8px] ring-2 ring-white dark:ring-neutral-900",
                    preset.color
                  )}
                  style={{ zIndex: 3 - idx }}
                >
                  ✓
                </div>
              ))}
          </div>
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {activePresetCount} presets stacked
          </span>
        </div>
      )}
      
      {/* Preset Grid */}
      <div className="grid grid-cols-2 gap-2">
        {allPresets.map((preset) => {
          const isActive = isPresetActive(preset);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={cn(
                "relative flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all",
                "hover:shadow-md active:scale-[0.98]",
                isActive
                  ? "bg-gradient-to-br from-brand/5 to-brand/10 border-brand/30 ring-2 ring-brand/30 shadow-sm"
                  : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
              )}
            >
              {/* Icon with gradient background */}
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br text-white shadow-sm shrink-0 transition-transform",
                preset.color,
                isActive && "scale-110"
              )}>
                {isActive ? (
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  preset.icon
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-xs font-bold",
                    isActive ? "text-brand" : "text-neutral-900 dark:text-white"
                  )}>
                    {preset.name}
                  </span>
                  {preset.isUserPreset && (
                    <span className="px-1 py-0.5 text-[8px] font-bold bg-neutral-100 dark:bg-neutral-700 text-neutral-500 rounded">
                      SAVED
                    </span>
                  )}
                  {isActive && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold bg-brand/20 text-brand rounded">
                      ON
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Save Current Filters Button */}
      {onSavePreset && hasActiveFilters && (
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-brand hover:text-brand transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-xs font-semibold">Save Current Filters</span>
        </button>
      )}

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Save Filter Preset</h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Preset name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/50"
              autoFocus
            />
            
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (presetName.trim() && onSavePreset) {
                    onSavePreset(presetName.trim());
                    setPresetName("");
                    setShowSaveModal(false);
                  }
                }}
                disabled={!presetName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-brand rounded-xl hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to apply a preset
export function applyPreset(
  preset: SmartPreset,
  currentQuickFilters: Set<string>,
  currentChartFilters: ChartFiltersState
): { quickFilters: Set<string>; chartFilters: ChartFiltersState } {
  // Start with current filters and merge preset filters
  const newQuickFilters = new Set(currentQuickFilters);
  
  // Toggle preset quick filters
  preset.quickFilters.forEach(filter => {
    if (newQuickFilters.has(filter)) {
      newQuickFilters.delete(filter);
    } else {
      newQuickFilters.add(filter);
    }
  });

  // Merge chart filters
  const newChartFilters = { ...currentChartFilters };
  for (const [key, value] of Object.entries(preset.chartFilters)) {
    const currentValue = newChartFilters[key as keyof ChartFiltersState];
    // Toggle: if same value, clear it; otherwise set it
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
      (newChartFilters as any)[key] = null;
    } else {
      (newChartFilters as any)[key] = value;
    }
  }

  return { quickFilters: newQuickFilters, chartFilters: newChartFilters };
}
