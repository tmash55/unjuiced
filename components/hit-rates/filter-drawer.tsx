"use client";

import React, { useEffect, useState, useMemo } from "react";
import { X, ChevronDown, ChevronUp, Info, AlertCircle, Clock, CheckCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartFilters, ChartFiltersState, DEFAULT_FILTERS } from "./chart-filters";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { InjuryFilter } from "./roster-and-injuries";
import { Tooltip } from "@/components/tooltip";
import type { PlayTypeData } from "@/hooks/use-team-play-type-ranks";
import type { ShotZoneData } from "@/hooks/use-team-shot-zone-ranks";

// Matchup filter types
export type MatchupLabel = "tough" | "neutral" | "favorable";

export interface PlayTypeFilter {
  playType: string;
  label: MatchupLabel;
}

export interface ShotZoneFilter {
  zone: string;
  label: MatchupLabel;
}

// Custom icons
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

const LineupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="7" r="3"/>
    <circle cx="15" cy="7" r="3"/>
    <path d="M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" strokeLinecap="round"/>
  </svg>
);

const PerformanceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 7h4v4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MatchupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Quick filter type
type QuickFilterKey = "home" | "away" | "win" | "loss" | "wonBy10" | "lostBy10" | "primetime" | "dvpTough" | "dvpAverage" | "dvpWeak";

// Teammate for lineup context - extended with injury status
interface TeammateInfo {
  playerId: number;
  name: string;
  teamId: number | null;
  gamesOut: number;
  avgImpact?: number | null;
  injuryStatus?: string | null; // "Out", "Game Time Decision", "Day-To-Day", etc.
  seasonAvg?: number | null;
}

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
  allSeasonGames?: BoxScoreGame[]; // Full season games for range calculation
  market: string;
  // DvP data
  hasDvpData?: boolean;
  // Play type and shooting zone matchup data (for current opponent context)
  playTypeMatchup?: { play_types: Array<{ play_type: string; display_name: string; opponent_def_rank: number | null; player_ppg: number }> };
  shotZoneMatchup?: { zones: Array<{ zone: string; display_name: string; opponent_def_rank: number | null; player_pct_of_total: number }> };
  opponentTeamAbbr?: string | null;
  // Play type and shot zone ranks (for ALL teams - used for filtering)
  playTypeRanks?: PlayTypeData[];
  playTypeDisplayNames?: Record<string, string>;
  shotZoneRanks?: ShotZoneData[];
  // Play type / shot zone filters
  playTypeFilters?: PlayTypeFilter[];
  onPlayTypeFiltersChange?: (filters: PlayTypeFilter[]) => void;
  shotZoneFilters?: ShotZoneFilter[];
  onShotZoneFiltersChange?: (filters: ShotZoneFilter[]) => void;
  // Active filter counts
  activeQuickFiltersCount: number;
  activeChartFiltersCount: number;
  activeInjuryFiltersCount: number;
  // Lineup Context
  injuryFilters?: InjuryFilter[];
  onInjuryFiltersChange?: (filters: InjuryFilter[]) => void;
  availableTeammates?: TeammateInfo[];
  // Filter impact preview
  filteredGamesCount?: number;
  totalGamesCount?: number;
  filteredHitRate?: number | null;
  // Filter mode
  filterMode?: "simple" | "advanced" | "research";
  onFilterModeChange?: (mode: "simple" | "advanced" | "research") => void;
}

// Smart presets config - use {min, max} format for FilterRange
const SMART_PRESETS = [
  { id: "highUsage", label: "High Usage", desc: "25%+ usage", tooltip: "Games where player had 25%+ usage rate (high ball involvement)", chartFilter: { usage: { min: 0.25, max: 1.0 } } },
  { id: "heavyMinutes", label: "Heavy Mins", desc: "34+ min", tooltip: "Games where player played 34+ minutes (full workload)", chartFilter: { minutes: { min: 34, max: 48 } } },
  { id: "scoringRole", label: "Scoring Role", desc: "15+ FGA", tooltip: "Games where player took 15+ field goal attempts (primary scorer)", chartFilter: { fga: { min: 15, max: 40 } } },
  { id: "blowoutWins", label: "Blowouts", desc: "Won 10+", tooltip: "Games where team won by 10+ points (often reduced minutes late)", quickFilter: "wonBy10" as QuickFilterKey },
] as const;

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

// Get injury status icon and color
const getInjuryStatusDisplay = (status: string | null | undefined) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("out")) return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500", label: "OUT" };
  if (s.includes("game time") || s.includes("gtd")) return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500", label: "GTD" };
  if (s.includes("day-to-day") || s.includes("dtd")) return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500", label: "DTD" };
  if (s.includes("questionable")) return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500", label: "Q" };
  if (s.includes("doubtful")) return { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500", label: "D" };
  if (s.includes("probable")) return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500", label: "P" };
  return null;
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
  allSeasonGames,
  market,
  hasDvpData = false,
  playTypeMatchup,
  shotZoneMatchup,
  opponentTeamAbbr,
  playTypeRanks = [],
  playTypeDisplayNames = {},
  shotZoneRanks = [],
  playTypeFilters = [],
  onPlayTypeFiltersChange,
  shotZoneFilters = [],
  onShotZoneFiltersChange,
  activeQuickFiltersCount,
  activeChartFiltersCount,
  activeInjuryFiltersCount,
  injuryFilters = [],
  onInjuryFiltersChange,
  availableTeammates = [],
  filteredGamesCount,
  totalGamesCount,
  filteredHitRate,
  filterMode = "simple",
  onFilterModeChange,
}: FilterDrawerProps) {
  // Tab state - Performance vs Lineup vs Matchup
  const [activeTab, setActiveTab] = useState<"performance" | "lineup" | "matchup">("lineup");

  // Check if a smart preset is active
  const isPresetActive = (preset: typeof SMART_PRESETS[number]) => {
    if ("quickFilter" in preset) {
      return quickFilters.has(preset.quickFilter);
    }
    if ("chartFilter" in preset && preset.chartFilter) {
      const [filterKey, filterValue] = Object.entries(preset.chartFilter)[0];
      const currentValue = chartFilters[filterKey as keyof ChartFiltersState];
      if (!currentValue || typeof currentValue !== "object") return false;
      const presetVal = filterValue as { min: number; max: number };
      const currVal = currentValue as { min: number; max: number };
      // Check if min matches (max can vary based on data)
      return currVal.min === presetVal.min;
    }
    return false;
  };

  // Toggle smart preset
  const togglePreset = (preset: typeof SMART_PRESETS[number]) => {
    if ("quickFilter" in preset) {
      onQuickFilterToggle(preset.quickFilter);
    } else if ("chartFilter" in preset && preset.chartFilter) {
      const [filterKey, filterValue] = Object.entries(preset.chartFilter)[0];
      const isActive = isPresetActive(preset);
      if (isActive) {
        onChartFiltersChange({ ...chartFilters, [filterKey]: null });
      } else {
        // Apply the preset filter
        onChartFiltersChange({ ...chartFilters, [filterKey]: filterValue });
      }
    }
  };

  // Sort teammates: injured first (OUT, GTD, DTD), then by season avg descending
  const sortedTeammates = useMemo(() => {
    return [...availableTeammates].sort((a, b) => {
      const getStatusPriority = (status: string | null | undefined) => {
        const s = status?.toLowerCase() || "";
        if (s.includes("out")) return 0;
        if (s.includes("game time") || s.includes("gtd")) return 1;
        if (s.includes("day-to-day") || s.includes("dtd") || s.includes("questionable") || s.includes("doubtful")) return 2;
        if (s.includes("probable")) return 3;
        return 4;
      };
      
      const priorityA = getStatusPriority(a.injuryStatus);
      const priorityB = getStatusPriority(b.injuryStatus);
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      const avgA = a.seasonAvg ?? a.avgImpact ?? 0;
      const avgB = b.seasonAvg ?? b.avgImpact ?? 0;
      return avgB - avgA;
    });
  }, [availableTeammates]);

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

  const totalActiveFilters = activeQuickFiltersCount + activeChartFiltersCount + activeInjuryFiltersCount + playTypeFilters.length + shotZoneFilters.length;
  const activePresetsCount = SMART_PRESETS.filter(p => isPresetActive(p)).length;

  const getDvpColor = (key: QuickFilterKey) => {
    if (key === "dvpTough") return "bg-red-500 border-red-500";
    if (key === "dvpAverage") return "bg-amber-500 border-amber-500";
    if (key === "dvpWeak") return "bg-emerald-500 border-emerald-500";
    return "bg-brand border-brand";
  };

  // Count injured teammates
  const injuredCount = sortedTeammates.filter(t => {
    const s = t.injuryStatus?.toLowerCase() || "";
    return s.includes("out") || s.includes("gtd") || s.includes("dtd") || s.includes("questionable") || s.includes("doubtful");
  }).length;

  return (
    <>
      {/* Backdrop */}
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-brand/10 dark:bg-brand/20">
              <FiltersHeaderIcon />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Filters</h2>
              {totalActiveFilters > 0 && (
                <p className="text-[10px] text-neutral-500">{totalActiveFilters} active</p>
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

        {/* Filter Impact Bar */}
        {totalActiveFilters > 0 && (
          <div className="px-4 py-2 bg-brand/5 dark:bg-brand/10 border-b border-brand/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {filteredGamesCount !== undefined && totalGamesCount !== undefined && (
                  <span className="text-xs">
                    <span className="font-bold text-neutral-900 dark:text-white">{filteredGamesCount}</span>
                    <span className="text-neutral-400">/{totalGamesCount}</span>
                  </span>
                )}
                {filteredHitRate !== undefined && filteredHitRate !== null && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                    filteredHitRate >= 70 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                    filteredHitRate >= 50 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                    "bg-red-100 dark:bg-red-900/30 text-red-500"
                  )}>
                    {filteredHitRate}%
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  onQuickFiltersClear();
                  onChartFiltersChange(DEFAULT_FILTERS);
                  onInjuryFiltersChange?.([]);
                }}
                className="text-[10px] font-semibold text-red-500 hover:text-red-600"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            QUICK FILTERS + SMART PRESETS (Always visible at top)
            ════════════════════════════════════════════════════════════════ */}
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Quick Filters Row */}
          <div className="flex flex-wrap gap-1.5">
            {/* Location */}
            <Tooltip content="Show only home games" side="bottom">
              <button
                type="button"
                onClick={() => onQuickFilterToggle("home")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                  quickFilters.has("home")
                    ? "bg-brand text-white border-brand"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                )}
              >
                Home
              </button>
            </Tooltip>
            <Tooltip content="Show only away games" side="bottom">
              <button
                type="button"
                onClick={() => onQuickFilterToggle("away")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                  quickFilters.has("away")
                    ? "bg-brand text-white border-brand"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                )}
              >
                Away
              </button>
            </Tooltip>
            <span className="text-neutral-200 dark:text-neutral-700">|</span>
            {/* Result */}
            <Tooltip content="Show only games the team won" side="bottom">
              <button
                type="button"
                onClick={() => onQuickFilterToggle("win")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                  quickFilters.has("win")
                    ? "bg-brand text-white border-brand"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                )}
              >
                Win
              </button>
            </Tooltip>
            <Tooltip content="Show only games the team lost" side="bottom">
              <button
                type="button"
                onClick={() => onQuickFilterToggle("loss")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                  quickFilters.has("loss")
                    ? "bg-brand text-white border-brand"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                )}
              >
                Loss
              </button>
            </Tooltip>
            {/* DvP */}
            {hasDvpData && (
              <>
                <span className="text-neutral-200 dark:text-neutral-700">|</span>
                <Tooltip content="Games vs top 10 defenses at this position (harder matchups)" side="bottom">
                  <button
                    type="button"
                    onClick={() => onQuickFilterToggle("dvpTough")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                      quickFilters.has("dvpTough")
                        ? `${getDvpColor("dvpTough")} text-white`
                        : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                    )}
                  >
                    vs Top D
                  </button>
                </Tooltip>
                <Tooltip content="Games vs bottom 10 defenses at this position (easier matchups)" side="bottom">
                  <button
                    type="button"
                    onClick={() => onQuickFilterToggle("dvpWeak")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all",
                      quickFilters.has("dvpWeak")
                        ? `${getDvpColor("dvpWeak")} text-white`
                        : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-brand/50"
                    )}
                  >
                    vs Weak D
                  </button>
                </Tooltip>
              </>
            )}
          </div>

          {/* Smart Presets Row */}
          <div className="flex flex-wrap gap-1.5">
            {SMART_PRESETS.map((preset) => {
              const isActive = isPresetActive(preset);
              return (
                <Tooltip key={preset.id} content={preset.tooltip} side="bottom">
                  <button
                    type="button"
                    onClick={() => togglePreset(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all",
                      isActive
                        ? "bg-purple-500 text-white border-purple-500"
                        : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-purple-300"
                    )}
                  >
                    {preset.label}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB NAVIGATION - Performance / Lineup Impact
            ════════════════════════════════════════════════════════════════ */}
        <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("performance")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                activeTab === "performance"
                  ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <PerformanceIcon />
              Performance
              {activeChartFiltersCount > 0 && (
                <span className="px-1 py-0.5 text-[8px] font-bold bg-purple-500 text-white rounded-full min-w-[14px]">
                  {activeChartFiltersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lineup")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                activeTab === "lineup"
                  ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <LineupIcon />
              Lineup
              {(activeInjuryFiltersCount > 0 || injuredCount > 0) && (
                <span className={cn(
                  "px-1 py-0.5 text-[8px] font-bold text-white rounded-full min-w-[14px]",
                  activeInjuryFiltersCount > 0 ? "bg-orange-500" : "bg-red-500"
                )}>
                  {activeInjuryFiltersCount > 0 ? activeInjuryFiltersCount : injuredCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matchup")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                activeTab === "matchup"
                  ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              <MatchupIcon />
              Matchup
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* PERFORMANCE TAB */}
          {activeTab === "performance" && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-3.5 w-3.5 text-neutral-400" />
                <p className="text-[10px] text-neutral-500">
                  Filter by minutes, usage, FGA and more
                </p>
              </div>
              <ChartFilters
                games={gamesForFilters}
                allSeasonGames={allSeasonGames}
                filters={chartFilters}
                onFiltersChange={onChartFiltersChange}
                market={market}
                isExpanded={true}
                hideControls={true}
              />
            </div>
          )}

          {/* LINEUP IMPACT TAB */}
          {activeTab === "lineup" && (
            <div className="p-4">
              {sortedTeammates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <LineupIcon />
                  </div>
                  <p className="text-sm text-neutral-500">No teammate data available</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-neutral-500 mb-3">
                    Filter games by which teammates were playing or out.
                  </p>
                  
                  {sortedTeammates.map((teammate) => {
                    const currentFilter = injuryFilters.find(f => f.playerId === teammate.playerId);
                    const isWithActive = currentFilter?.mode === "with";
                    const isWithoutActive = currentFilter?.mode === "without";
                    const statusDisplay = getInjuryStatusDisplay(teammate.injuryStatus);
                    
                    return (
                      <div 
                        key={teammate.playerId}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border transition-all",
                          statusDisplay 
                            ? "border-l-2 border-l-red-500/50 dark:border-l-red-500/50 border-neutral-200 dark:border-neutral-700"
                            : isWithActive || isWithoutActive
                              ? "border-brand/30 bg-brand/5"
                              : "border-neutral-200 dark:border-neutral-700"
                        )}
                      >
                        {/* Player Headshot */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700">
                            <img
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${teammate.playerId}.png`}
                              alt={teammate.name}
                              className="w-full h-full object-cover object-top"
                              onError={(e) => {
                                e.currentTarget.src = "/images/player-fallback.png";
                              }}
                            />
                          </div>
                          {/* Injury Status Badge */}
                          {statusDisplay && (
                            <div className={cn(
                              "absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white",
                              statusDisplay.bg
                            )}>
                              {statusDisplay.label}
                            </div>
                          )}
                        </div>
                        
                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                              {teammate.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-neutral-500">
                            {teammate.seasonAvg != null && (
                              <span className="font-medium">{teammate.seasonAvg.toFixed(1)} avg</span>
                            )}
                            {teammate.gamesOut > 0 && (
                              <>
                                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                <span>{teammate.gamesOut}g out</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* With/Without Buttons */}
                        {onInjuryFiltersChange && (
                          <div className="flex gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (isWithActive) {
                                  onInjuryFiltersChange(injuryFilters.filter(f => f.playerId !== teammate.playerId));
                                } else {
                                  const newFilters = injuryFilters.filter(f => f.playerId !== teammate.playerId);
                                  newFilters.push({ playerId: teammate.playerId, playerName: teammate.name, teamId: teammate.teamId, mode: "with" });
                                  onInjuryFiltersChange(newFilters);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 text-[9px] font-bold rounded-l transition-all",
                                isWithActive
                                  ? "bg-emerald-500 text-white"
                                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-emerald-600"
                              )}
                            >
                              With
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isWithoutActive) {
                                  onInjuryFiltersChange(injuryFilters.filter(f => f.playerId !== teammate.playerId));
                                } else {
                                  const newFilters = injuryFilters.filter(f => f.playerId !== teammate.playerId);
                                  newFilters.push({ playerId: teammate.playerId, playerName: teammate.name, teamId: teammate.teamId, mode: "without" });
                                  onInjuryFiltersChange(newFilters);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 text-[9px] font-bold rounded-r transition-all",
                                isWithoutActive
                                  ? "bg-orange-500 text-white"
                                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-orange-600"
                              )}
                            >
                              Out
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {injuryFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onInjuryFiltersChange?.([])}
                      className="w-full mt-2 py-1.5 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      Clear lineup filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MATCHUP CONTEXT TAB */}
          {activeTab === "matchup" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Info className="h-3.5 w-3.5 text-neutral-400" />
                <p className="text-[10px] text-neutral-500">
                  Filter games by opponent defensive rankings{opponentTeamAbbr ? ` (today vs ${opponentTeamAbbr})` : ""}
                </p>
              </div>

              {/* Play Type Filters Section */}
              {playTypeRanks.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Play Type Defense Filters
                    </h4>
                    {playTypeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onPlayTypeFiltersChange?.([])}
                        className="text-[9px] text-red-500 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {playTypeRanks.map(pt => {
                      const activeFilter = playTypeFilters.find(f => f.playType === pt.playType);
                      const displayName = playTypeDisplayNames[pt.playType] || pt.displayName || pt.playType;
                      
                      // Get current opponent's rank for this play type
                      const currentMatchup = playTypeMatchup?.play_types.find(m => m.play_type === pt.playType);
                      const currentRank = currentMatchup?.opponent_def_rank;
                      
                      return (
                        <div 
                          key={pt.playType}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all",
                            activeFilter 
                              ? "border-brand/30 bg-brand/5" 
                              : "border-neutral-200 dark:border-neutral-700"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {displayName}
                              </span>
                              {currentRank && (
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[8px] font-bold tabular-nums",
                                  currentRank >= 21 
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                    : currentRank <= 10 
                                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                                )}>
                                  #{currentRank}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Filter buttons */}
                          {onPlayTypeFiltersChange && (
                            <div className="flex gap-0.5 shrink-0">
                              {(["favorable", "neutral", "tough"] as const).map(label => {
                                const isActive = activeFilter?.label === label;
                                const colors = {
                                  favorable: isActive 
                                    ? "bg-emerald-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-emerald-600",
                                  neutral: isActive 
                                    ? "bg-amber-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-amber-600",
                                  tough: isActive 
                                    ? "bg-red-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-600",
                                };
                                return (
                                  <Tooltip key={label} content={
                                    label === "favorable" ? "Games vs teams ranked 21-30 (weak defense)" :
                                    label === "neutral" ? "Games vs teams ranked 11-20 (average defense)" :
                                    "Games vs teams ranked 1-10 (strong defense)"
                                  }>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isActive) {
                                          onPlayTypeFiltersChange(playTypeFilters.filter(f => f.playType !== pt.playType));
                                        } else {
                                          const newFilters = playTypeFilters.filter(f => f.playType !== pt.playType);
                                          newFilters.push({ playType: pt.playType, label });
                                          onPlayTypeFiltersChange(newFilters);
                                        }
                                      }}
                                      className={cn(
                                        "px-1.5 py-1 text-[8px] font-bold rounded transition-all",
                                        colors[label],
                                        label === "favorable" && "rounded-l",
                                        label === "tough" && "rounded-r"
                                      )}
                                    >
                                      {label === "favorable" ? "Soft" : label === "neutral" ? "Mid" : "Tough"}
                                    </button>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-neutral-400 mt-2">
                    Filter to show games vs teams with specific defensive rankings for each play type
                  </p>
                </div>
              ) : playTypeMatchup?.play_types && playTypeMatchup.play_types.length > 0 ? (
                // Fallback to current opponent display if no filter data
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Today's Opponent: Play Type Defense
                  </h4>
                  <div className="space-y-1">
                    {playTypeMatchup.play_types
                      .filter(pt => pt.opponent_def_rank !== null)
                      .sort((a, b) => (b.opponent_def_rank ?? 0) - (a.opponent_def_rank ?? 0))
                      .slice(0, 8)
                      .map(pt => {
                        const rank = pt.opponent_def_rank ?? 0;
                        const isFavorable = rank >= 21;
                        const isTough = rank <= 10;
                        return (
                          <div 
                            key={pt.play_type}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs",
                              isFavorable 
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30" 
                                : isTough 
                                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30"
                                  : "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/30"
                            )}
                          >
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {pt.display_name}
                            </span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums",
                              isFavorable 
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : isTough 
                                  ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                            )}>
                              {rank}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-lg">
                  <p className="text-[11px] text-neutral-400">No play type data available</p>
                </div>
              )}

              {/* Shot Zone Filters Section */}
              {shotZoneRanks.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Shot Zone Defense Filters
                    </h4>
                    {shotZoneFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onShotZoneFiltersChange?.([])}
                        className="text-[9px] text-red-500 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {shotZoneRanks.map(zone => {
                      const activeFilter = shotZoneFilters.find(f => f.zone === zone.zone);
                      
                      // Get current opponent's rank for this zone
                      const currentMatchup = shotZoneMatchup?.zones.find(z => z.zone === zone.zone);
                      const currentRank = currentMatchup?.opponent_def_rank;
                      
                      return (
                        <div 
                          key={zone.zone}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border transition-all",
                            activeFilter 
                              ? "border-brand/30 bg-brand/5" 
                              : "border-neutral-200 dark:border-neutral-700"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {zone.zone}
                              </span>
                              {currentRank && (
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[8px] font-bold tabular-nums",
                                  currentRank >= 21 
                                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                    : currentRank <= 10 
                                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                                )}>
                                  #{currentRank}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Filter buttons */}
                          {onShotZoneFiltersChange && (
                            <div className="flex gap-0.5 shrink-0">
                              {(["favorable", "neutral", "tough"] as const).map(label => {
                                const isActive = activeFilter?.label === label;
                                const colors = {
                                  favorable: isActive 
                                    ? "bg-emerald-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-emerald-600",
                                  neutral: isActive 
                                    ? "bg-amber-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-amber-600",
                                  tough: isActive 
                                    ? "bg-red-500 text-white" 
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-600",
                                };
                                return (
                                  <Tooltip key={label} content={
                                    label === "favorable" ? "Games vs teams ranked 21-30 (weak defense)" :
                                    label === "neutral" ? "Games vs teams ranked 11-20 (average defense)" :
                                    "Games vs teams ranked 1-10 (strong defense)"
                                  }>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isActive) {
                                          onShotZoneFiltersChange(shotZoneFilters.filter(f => f.zone !== zone.zone));
                                        } else {
                                          const newFilters = shotZoneFilters.filter(f => f.zone !== zone.zone);
                                          newFilters.push({ zone: zone.zone, label });
                                          onShotZoneFiltersChange(newFilters);
                                        }
                                      }}
                                      className={cn(
                                        "px-1.5 py-1 text-[8px] font-bold rounded transition-all",
                                        colors[label],
                                        label === "favorable" && "rounded-l",
                                        label === "tough" && "rounded-r"
                                      )}
                                    >
                                      {label === "favorable" ? "Soft" : label === "neutral" ? "Mid" : "Tough"}
                                    </button>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-neutral-400 mt-2">
                    Filter to show games vs teams with specific defensive rankings for each shot zone
                  </p>
                </div>
              ) : shotZoneMatchup?.zones && shotZoneMatchup.zones.length > 0 ? (
                // Fallback to current opponent display if no filter data
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Today's Opponent: Shot Zone Defense
                  </h4>
                  <div className="space-y-1">
                    {shotZoneMatchup.zones
                      .filter(z => z.opponent_def_rank !== null)
                      .sort((a, b) => (b.opponent_def_rank ?? 0) - (a.opponent_def_rank ?? 0))
                      .map(zone => {
                        const rank = zone.opponent_def_rank ?? 0;
                        const isFavorable = rank >= 21;
                        const isTough = rank <= 10;
                        return (
                          <div 
                            key={zone.zone}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs",
                              isFavorable 
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30" 
                                : isTough 
                                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/30"
                                  : "bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/30"
                            )}
                          >
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {zone.display_name}
                            </span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums",
                              isFavorable 
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : isTough 
                                  ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                            )}>
                              {rank}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-lg">
                  <p className="text-[11px] text-neutral-400">No shot zone data available</p>
                </div>
              )}

              {/* Info note about filtering */}
              <div className="p-3 bg-brand/5 dark:bg-brand/10 rounded-lg border border-brand/20">
                <p className="text-[9px] text-neutral-600 dark:text-neutral-400">
                  <strong className="text-brand">How it works:</strong> Select "Soft" to show games where the player faced teams with weak defense (rank 21-30), 
                  "Mid" for average (11-20), or "Tough" for strong defense (1-10) in that specific play type or zone.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  onQuickFiltersClear();
                  onChartFiltersChange(DEFAULT_FILTERS);
                  onInjuryFiltersChange?.([]);
                  onPlayTypeFiltersChange?.([]);
                  onShotZoneFiltersChange?.([]);
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold text-red-500 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2 text-xs font-bold text-white bg-brand rounded-lg shadow hover:shadow-md transition-all",
                totalActiveFilters > 0 ? "flex-1" : "w-full"
              )}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Premium Filter button
export function FilterButton({
  onClick,
  activeCount,
  hitRate,
  gamesCount,
}: {
  onClick: () => void;
  activeCount: number;
  hitRate?: number | null;
  gamesCount?: { filtered: number; total: number };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all shadow-sm hover:shadow-md",
        activeCount > 0
          ? "bg-gradient-to-r from-brand/10 to-brand/5 border-brand/40 text-brand hover:border-brand/60"
          : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
      )}
    >
      <FilterButtonIcon />
      <span className="font-bold">Filters</span>
      {activeCount > 0 && (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-brand text-white rounded-full min-w-[20px] text-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}

export type { TeammateInfo };
