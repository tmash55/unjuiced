"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Grid3X3, LayoutList } from "lucide-react";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Filter range type
interface FilterRange {
  min: number;
  max: number;
}

// All available filters
export interface ChartFiltersState {
  // Always available
  minutes: FilterRange | null;
  usage: FilterRange | null;
  homeAway: "home" | "away" | null;
  winLoss: "win" | "loss" | null;
  daysRest: number[] | null; // [0, 1, 2, 3] where 3 means 3+
  // Core stats
  points: FilterRange | null;
  rebounds: FilterRange | null;
  assists: FilterRange | null;
  steals: FilterRange | null;
  blocks: FilterRange | null;
  turnovers: FilterRange | null;
  // Rebounds breakdown
  oreb: FilterRange | null;
  dreb: FilterRange | null;
  potentialReb: FilterRange | null;
  // Tracking
  passes: FilterRange | null;
  // Shooting stats
  fga: FilterRange | null;
  fgm: FilterRange | null;
  fg3a: FilterRange | null;
  fg3m: FilterRange | null;
  fta: FilterRange | null;
  ftm: FilterRange | null;
  // Advanced
  plusMinus: FilterRange | null;
  tsPct: FilterRange | null;
  efgPct: FilterRange | null;
}

interface ChartFiltersProps {
  games: BoxScoreGame[];
  filters: ChartFiltersState;
  onFiltersChange: (filters: ChartFiltersState) => void;
  market?: string; // Current market to determine which filters to show
  className?: string;
  // External control for expanded state
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  // Hide internal controls if header is external
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

// Check if market is points-related (needs shooting stat filters)
const isPointsMarket = (market?: string): boolean => {
  if (!market) return false;
  return [
    "player_points",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_points_assists",
  ].includes(market);
};

// Check if market involves rebounds
const isReboundsMarket = (market?: string): boolean => {
  if (!market) return false;
  return [
    "player_rebounds",
    "player_points_rebounds_assists",
    "player_points_rebounds",
    "player_rebounds_assists",
  ].includes(market);
};

// Check if market involves assists
const isAssistsMarket = (market?: string): boolean => {
  if (!market) return false;
  return [
    "player_assists",
    "player_points_rebounds_assists",
    "player_points_assists",
    "player_rebounds_assists",
  ].includes(market);
};

// Check if market involves steals
const isStealsMarket = (market?: string): boolean => {
  if (!market) return false;
  return ["player_steals", "player_blocks_steals"].includes(market);
};

// Check if market involves blocks
const isBlocksMarket = (market?: string): boolean => {
  if (!market) return false;
  return ["player_blocks", "player_blocks_steals"].includes(market);
};

// Check if market is turnovers
const isTurnoversMarket = (market?: string): boolean => {
  return market === "player_turnovers";
};

// Check if market is threes
const isThreesMarket = (market?: string): boolean => {
  return market === "player_threes_made";
};

// Format date for tooltip
const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Preset chip type for dual-mode filters
type PresetChip = {
  label: string;
  getRange: (min: number, max: number, avg: number) => FilterRange;
};

// Default preset chips for common filters
const DEFAULT_PRESET_CHIPS: PresetChip[] = [
  { 
    label: "Low", 
    getRange: (min, max) => ({ min, max: min + (max - min) * 0.33 })
  },
  { 
    label: "Avg", 
    getRange: (min, max) => ({ min: min + (max - min) * 0.33, max: min + (max - min) * 0.67 })
  },
  { 
    label: "High", 
    getRange: (min, max) => ({ min: min + (max - min) * 0.67, max })
  },
];

// Mini bar chart component showing individual game bars with tooltips
function MiniBarChart({
  title,
  games,
  getValue,
  avgValue,
  selectedRange,
  onRangeChange,
  unit = "",
  decimals = 0,
  isPercentage = false,
  isInteger = false,
  useRelativeScale = false, // Scale bars based on data range, not from 0
  showPresetChips = false, // Show Low/Avg/High chips
}: {
  title: string;
  games: BoxScoreGame[];
  getValue: (game: BoxScoreGame) => number;
  avgValue: number;
  selectedRange: FilterRange | null;
  onRangeChange: (range: FilterRange | null) => void;
  unit?: string;
  decimals?: number;
  isPercentage?: boolean;
  isInteger?: boolean;
  useRelativeScale?: boolean; // When true, bars scale from min to max instead of 0 to max
  showPresetChips?: boolean; // When true, show Low/Avg/High quick selection chips
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<"min" | "max" | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  
  // Games are already in chronological order (newest first), reverse for display (oldest left, newest right)
  // Must call ALL hooks before any early returns
  const orderedGames = useMemo(() => [...games].reverse(), [games]);
  const values = useMemo(() => orderedGames.map(g => getValue(g)), [orderedGames, getValue]);
  
  // Calculate min/max from values (handle empty arrays safely)
  const { minVal, maxVal, range, maxStatVal } = useMemo(() => {
    if (values.length === 0) {
      return { minVal: 0, maxVal: 1, range: 1, maxStatVal: 1 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      minVal: min,
      maxVal: max,
      range: max - min || 1,
      maxStatVal: Math.max(max, 1),
    };
  }, [values]);
  
  // Current range values (use full range if no filter)
  const currentMin = selectedRange?.min ?? minVal;
  const currentMax = selectedRange?.max ?? maxVal;
  
  // Use refs to avoid stale closures in drag handlers
  const currentMinRef = useRef(currentMin);
  const currentMaxRef = useRef(currentMax);
  currentMinRef.current = currentMin;
  currentMaxRef.current = currentMax;
  
  // Check if a value is in the selected range
  const isValueInRange = useCallback((val: number) => {
    return val >= currentMin && val <= currentMax;
  }, [currentMin, currentMax]);
  
  // Convert position to value
  const positionToValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return minVal;
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return minVal + percentage * range;
  }, [minVal, range]);
  
  // Handle mouse/touch move - use refs to avoid stale closures
  const handleMove = useCallback((clientX: number, handle: "min" | "max") => {
    const value = positionToValue(clientX);
    const currMin = currentMinRef.current;
    const currMax = currentMaxRef.current;
    const step = range / 20; // Smaller step for smoother dragging
    
    if (handle === "min") {
      const newMin = Math.min(value, currMax - step);
      onRangeChange({ min: Math.max(minVal, newMin), max: currMax });
    } else {
      const newMax = Math.max(value, currMin + step);
      onRangeChange({ min: currMin, max: Math.min(maxVal, newMax) });
    }
  }, [positionToValue, minVal, maxVal, range, onRangeChange]);
  
  // Early return for empty data - AFTER all hooks
  if (games.length === 0) {
    return (
      <div className="flex-shrink-0 min-w-[280px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h4>
        </div>
        <div className="h-24 flex items-center justify-center text-xs text-neutral-400">
          No data
        </div>
      </div>
    );
  }
  
  // Handle mouse down on handle
  const handleMouseDown = (handle: "min" | "max") => (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveHandle(handle);
    
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, handle);
    const handleMouseUp = () => {
      setActiveHandle(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  
  // Handle touch events
  const handleTouchStart = (handle: "min" | "max") => (e: React.TouchEvent) => {
    setActiveHandle(handle);
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, handle);
    };
    const handleTouchEnd = () => {
      setActiveHandle(null);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
    
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  };
  
  const clearFilter = () => onRangeChange(null);
  
  // Calculate handle positions as percentages
  const minHandlePos = ((currentMin - minVal) / range) * 100;
  const maxHandlePos = ((currentMax - minVal) / range) * 100;
  
  // Format a value for display (handle percentage conversion and integers)
  const formatValue = (val: number) => {
    if (isPercentage) {
      return Math.round(val * 100) + "%";
    }
    if (isInteger) {
      return Math.round(val) + unit;
    }
    return val.toFixed(decimals) + unit;
  };
  
  // Check if a preset chip matches the current filter
  const isPresetActive = (preset: PresetChip) => {
    if (!selectedRange) return false;
    const presetRange = preset.getRange(minVal, maxVal, avgValue);
    return Math.abs(selectedRange.min - presetRange.min) < 0.01 && 
           Math.abs(selectedRange.max - presetRange.max) < 0.01;
  };
  
  return (
    <div className="flex-shrink-0 min-w-[280px] sm:min-w-[300px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            Avg: <span className="font-semibold text-neutral-600 dark:text-neutral-300">{formatValue(avgValue)}</span>
          </span>
          {selectedRange && (
            <button
              onClick={clearFilter}
              className="text-[10px] text-red-500 hover:text-red-600 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {/* Preset Chips (Low/Avg/High) */}
      {showPresetChips && (
        <div className="flex items-center gap-1.5 mb-3">
          {DEFAULT_PRESET_CHIPS.map((preset) => {
            const isActive = isPresetActive(preset);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (isActive) {
                    onRangeChange(null); // Toggle off
                  } else {
                    onRangeChange(preset.getRange(minVal, maxVal, avgValue));
                  }
                }}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all",
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Individual game bars (oldest left, newest right) */}
      <div className="relative mb-4">
        {/* Bars with values */}
        <div className="h-20 flex items-end gap-px pt-4">
          {orderedGames.map((game, idx) => {
            const value = getValue(game);
            // Calculate height - relative scale uses min-max range, absolute uses 0-max
            let heightPercent: number;
            if (useRelativeScale && range > 0) {
              // Scale from min to max (with 10% padding at bottom for min values)
              heightPercent = 10 + ((value - minVal) / range) * 90;
            } else {
              heightPercent = maxStatVal > 0 ? (value / maxStatVal) * 100 : 0;
            }
            const barAreaHeight = 64; // px for bar area (h-16)
            const heightPx = Math.max((heightPercent / 100) * barAreaHeight, 3);
            const isInRange = isValueInRange(value);
            const isHovered = hoveredBar === idx;
            
            // Format compact value for display above bar
            const safeValue = value ?? 0;
            const compactValue = isPercentage 
              ? Math.round(safeValue * 100)
              : isInteger 
                ? Math.round(safeValue) 
                : safeValue.toFixed(decimals);
            
            return (
              <div
                key={game.gameId || idx}
                className="flex-1 relative group flex flex-col items-center justify-end"
                style={{ height: barAreaHeight + 16 }} // bar area + space for value
                onMouseEnter={() => setHoveredBar(idx)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {/* Value above bar - always visible */}
                <span className={cn(
                  "text-[8px] font-semibold mb-0.5",
                  isHovered 
                    ? "text-neutral-800 dark:text-neutral-100" 
                    : "text-neutral-500 dark:text-neutral-400"
                )}>
                  {compactValue}
                </span>
                
                {/* Bar */}
                <div
                  className={cn(
                    "w-full rounded-t transition-all cursor-pointer",
                    isInRange
                      ? "bg-neutral-400 dark:bg-neutral-500"
                      : "bg-neutral-200 dark:bg-neutral-700",
                    isHovered && "ring-1 ring-neutral-500 dark:ring-neutral-400"
                  )}
                  style={{ height: `${heightPx}px` }}
                />
                
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none">
                    <div className="bg-neutral-800 dark:bg-neutral-700 text-white text-[10px] px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
                      <div className="font-semibold flex items-center gap-1">
                        <span>{formatShortDate(game.date)}</span>
                        <span className="text-neutral-400">•</span>
                        <span className="text-neutral-300">
                          {game.homeAway === "H" ? "vs" : "@"} {game.opponentAbbr}
                        </span>
                      </div>
                      <div className="text-white font-bold mt-0.5">{formatValue(value)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Dual range slider */}
      <div ref={sliderRef} className="relative h-8 px-2">
        {/* Track background */}
        <div className="absolute left-2 right-2 top-3 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
        
        {/* Selected range track */}
        <div
          className="absolute top-3 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full"
          style={{
            left: `calc(${minHandlePos}% + 8px)`,
            width: `${maxHandlePos - minHandlePos}%`,
          }}
        />
        
        {/* Min handle */}
        <div
          className={cn(
            "absolute top-1 w-5 h-5 bg-white dark:bg-neutral-200 border-2 border-neutral-400 dark:border-neutral-500 rounded-full cursor-grab shadow-md transition-transform",
            "hover:scale-110 hover:border-neutral-500 dark:hover:border-neutral-400 active:cursor-grabbing active:scale-110",
            activeHandle === "min" && "scale-110 ring-4 ring-neutral-300 dark:ring-neutral-600"
          )}
          style={{ left: `calc(${minHandlePos}% - 2px)` }}
          onMouseDown={handleMouseDown("min")}
          onTouchStart={handleTouchStart("min")}
        />
        
        {/* Max handle */}
        <div
          className={cn(
            "absolute top-1 w-5 h-5 bg-white dark:bg-neutral-200 border-2 border-neutral-400 dark:border-neutral-500 rounded-full cursor-grab shadow-md transition-transform",
            "hover:scale-110 hover:border-neutral-500 dark:hover:border-neutral-400 active:cursor-grabbing active:scale-110",
            activeHandle === "max" && "scale-110 ring-4 ring-neutral-300 dark:ring-neutral-600"
          )}
          style={{ left: `calc(${maxHandlePos}% - 2px)` }}
          onMouseDown={handleMouseDown("max")}
          onTouchStart={handleTouchStart("max")}
        />
      </div>
      
      {/* Range labels */}
      <div className="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
        <span>{formatValue(minVal)}</span>
        {selectedRange ? (
          <span className="font-semibold text-neutral-600 dark:text-neutral-300">
            {formatValue(currentMin)} – {formatValue(currentMax)}
          </span>
        ) : (
          <span className="text-neutral-400">Drag to filter</span>
        )}
        <span>{formatValue(maxVal)}</span>
      </div>
    </div>
  );
}

export function ChartFilters({
  games,
  filters,
  onFiltersChange,
  market,
  className,
  isExpanded: externalIsExpanded,
  onExpandedChange,
  hideControls = false,
}: ChartFiltersProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const isExpandedState = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpandedState = (value: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(value);
    } else {
      setInternalIsExpanded(value);
    }
  };
  
  // Check if this is a points market (show shooting stats)
  const showShootingStats = isPointsMarket(market);
  
  // Update arrow visibility on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);
  
  // Scroll handlers
  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  };
  
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  };
  
  // Calculate averages for each stat
  const calcAvg = (getValue: (g: BoxScoreGame) => number) => {
    if (games.length === 0) return 0;
    return games.reduce((sum, g) => sum + getValue(g), 0) / games.length;
  };
  
  // Calculate min/max for each stat (used for clamping filters when games change)
  const statsRanges = useMemo(() => {
    if (games.length === 0) return null;
    
    const calcRange = (getValue: (g: BoxScoreGame) => number) => {
      const values = games.map(getValue);
      return {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    };
    
    return {
      minutes: calcRange(g => g.minutes),
      usage: calcRange(g => g.usagePct),
      points: calcRange(g => g.pts),
      rebounds: calcRange(g => g.reb),
      assists: calcRange(g => g.ast),
      steals: calcRange(g => g.stl),
      blocks: calcRange(g => g.blk),
      turnovers: calcRange(g => g.tov),
      fga: calcRange(g => g.fga),
      fgm: calcRange(g => g.fgm),
      fg3a: calcRange(g => g.fg3a),
      fg3m: calcRange(g => g.fg3m),
      fta: calcRange(g => g.fta),
      ftm: calcRange(g => g.ftm),
      oreb: calcRange(g => g.oreb),
      dreb: calcRange(g => g.dreb),
      potentialReb: calcRange(g => g.potentialReb),
      passes: calcRange(g => g.passes),
      plusMinus: calcRange(g => g.plusMinus),
      tsPct: calcRange(g => g.tsPct),
      efgPct: calcRange(g => g.efgPct),
    };
  }, [games]);
  
  // Clamp filter values to new data range when games change
  // This prevents slider handles from appearing outside the valid range
  useEffect(() => {
    if (!statsRanges) return;
    
    const rangeFilterKeys: Array<keyof typeof statsRanges> = [
      'minutes', 'usage', 'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
      'fga', 'fgm', 'fg3a', 'fg3m', 'fta', 'ftm', 'oreb', 'dreb', 'potentialReb',
      'passes', 'plusMinus', 'tsPct', 'efgPct'
    ];
    
    let hasChanges = false;
    const newFilters = { ...filters };
    
    for (const key of rangeFilterKeys) {
      const filterValue = filters[key as keyof typeof filters] as FilterRange | null;
      const statRange = statsRanges[key];
      
      if (filterValue && statRange) {
        // Check if filter is completely outside the new range - clear it
        if (filterValue.max < statRange.min || filterValue.min > statRange.max) {
          (newFilters as any)[key] = null;
          hasChanges = true;
        }
        // Check if filter needs clamping to fit within new range
        else if (filterValue.min < statRange.min || filterValue.max > statRange.max) {
          (newFilters as any)[key] = {
            min: Math.max(filterValue.min, statRange.min),
            max: Math.min(filterValue.max, statRange.max),
          };
          hasChanges = true;
        }
      }
    }
    
    if (hasChanges) {
      onFiltersChange(newFilters);
    }
  }, [statsRanges]); // Only run when stats change, not filters (to avoid infinite loop)
  
  const avgMinutes = calcAvg(g => g.minutes);
  const avgUsage = calcAvg(g => g.usagePct);
  // Core stats
  const avgPoints = calcAvg(g => g.pts);
  const avgRebounds = calcAvg(g => g.reb);
  const avgAssists = calcAvg(g => g.ast);
  const avgSteals = calcAvg(g => g.stl);
  const avgBlocks = calcAvg(g => g.blk);
  const avgTurnovers = calcAvg(g => g.tov);
  // Shooting stats
  const avgFga = calcAvg(g => g.fga);
  const avgFgm = calcAvg(g => g.fgm);
  const avgFg3a = calcAvg(g => g.fg3a);
  const avgFg3m = calcAvg(g => g.fg3m);
  const avgFta = calcAvg(g => g.fta);
  const avgFtm = calcAvg(g => g.ftm);
  // Rebounds breakdown
  const avgOreb = calcAvg(g => g.oreb);
  const avgDreb = calcAvg(g => g.dreb);
  const avgPotentialReb = calcAvg(g => g.potentialReb);
  // Tracking
  const avgPasses = calcAvg(g => g.passes);
  // Advanced
  const avgPlusMinus = calcAvg(g => g.plusMinus);
  const avgTsPct = calcAvg(g => g.tsPct);
  const avgEfgPct = calcAvg(g => g.efgPct);
  
  // Determine priority order based on market
  const getFilterPriority = (filterKey: string): number => {
    // Base filters always first
    if (filterKey === "minutes") return 0;
    if (filterKey === "usage") return 1;
    
    // Market-specific priorities
    const marketLower = market?.toLowerCase() || "";
    
    // Points markets
    if (marketLower.includes("points")) {
      if (filterKey === "points") return 2;
      if (["fga", "fgm", "fg3a", "fg3m", "fta", "ftm"].includes(filterKey)) return 3;
      if (filterKey === "tsPct" || filterKey === "efgPct") return 4;
    }
    
    // Rebounds markets
    if (marketLower.includes("rebounds")) {
      if (filterKey === "rebounds") return 2;
      if (filterKey === "oreb" || filterKey === "dreb" || filterKey === "potentialReb") return 3;
    }
    
    // Assists markets
    if (marketLower.includes("assists")) {
      if (filterKey === "assists") return 2;
      if (filterKey === "passes") return 3;
    }
    
    // Steals market
    if (marketLower.includes("steals")) {
      if (filterKey === "steals") return 2;
    }
    
    // Blocks market
    if (marketLower.includes("blocks")) {
      if (filterKey === "blocks") return 2;
    }
    
    // Turnovers market
    if (marketLower === "player_turnovers") {
      if (filterKey === "turnovers") return 2;
    }
    
    // Threes market
    if (marketLower === "player_threes_made") {
      if (filterKey === "fg3m") return 2;
      if (filterKey === "fg3a") return 3;
    }
    
    // Default priority for remaining filters
    return 10;
  };
  
  // Count active filters (homeAway and winLoss are now quick filters on bar chart)
  const activeFilterCount = [
    filters.minutes,
    filters.usage,
    filters.daysRest,
    filters.points,
    filters.rebounds,
    filters.assists,
    filters.steals,
    filters.blocks,
    filters.turnovers,
    filters.oreb,
    filters.dreb,
    filters.potentialReb,
    filters.passes,
    filters.fga,
    filters.fgm,
    filters.fg3a,
    filters.fg3m,
    filters.fta,
    filters.ftm,
    filters.plusMinus,
    filters.tsPct,
    filters.efgPct,
  ].filter(Boolean).length;
  
  // Build array of ALL filter configs - always show all, sorted by relevance to market
  const filterConfigs = useMemo(() => {
    type FilterConfig = {
      key: string;
      title: string;
      getValue: (g: BoxScoreGame) => number;
      avgValue: number;
      selectedRange: FilterRange | null;
      filterKey: keyof ChartFiltersState;
      isPercentage?: boolean;
      isInteger?: boolean;
      useRelativeScale?: boolean;
      decimals?: number;
      category: "opportunity" | "efficiency" | "playmaking" | "rebounding" | "defense";
      showPresetChips?: boolean; // Show Low/Avg/High chips for key filters
    };
    
    const allConfigs: FilterConfig[] = [
      // OPPORTUNITY - Minutes, Usage, FGA, FG3A
      {
        key: "minutes",
        title: "Minutes",
        getValue: (g) => g.minutes,
        avgValue: avgMinutes,
        selectedRange: filters.minutes,
        filterKey: "minutes",
        decimals: 1,
        category: "opportunity",
        showPresetChips: true, // Key filter
      },
      {
        key: "usage",
        title: "Usage %",
        getValue: (g) => g.usagePct,
        avgValue: avgUsage,
        selectedRange: filters.usage,
        filterKey: "usage",
        isPercentage: true,
        useRelativeScale: true,
        category: "opportunity",
        showPresetChips: true, // Key filter
      },
      {
        key: "fga",
        title: "FGA",
        getValue: (g) => g.fga,
        avgValue: avgFga,
        selectedRange: filters.fga,
        filterKey: "fga",
        isInteger: true,
        category: "opportunity",
        showPresetChips: true, // Key filter
      },
      {
        key: "fg3a",
        title: "3PA",
        getValue: (g) => g.fg3a,
        avgValue: avgFg3a,
        selectedRange: filters.fg3a,
        filterKey: "fg3a",
        isInteger: true,
        category: "opportunity",
      },
      // EFFICIENCY - FGM, 3PM, TS%, eFG%
      {
        key: "fgm",
        title: "FGM",
        getValue: (g) => g.fgm,
        avgValue: avgFgm,
        selectedRange: filters.fgm,
        filterKey: "fgm",
        isInteger: true,
        category: "efficiency",
      },
      {
        key: "fg3m",
        title: "3PM",
        getValue: (g) => g.fg3m,
        avgValue: avgFg3m,
        selectedRange: filters.fg3m,
        filterKey: "fg3m",
        isInteger: true,
        category: "efficiency",
      },
      {
        key: "tsPct",
        title: "TS%",
        getValue: (g) => g.tsPct,
        avgValue: avgTsPct,
        selectedRange: filters.tsPct,
        filterKey: "tsPct",
        isPercentage: true,
        useRelativeScale: true,
        category: "efficiency",
      },
      {
        key: "efgPct",
        title: "eFG%",
        getValue: (g) => g.efgPct,
        avgValue: avgEfgPct,
        selectedRange: filters.efgPct,
        filterKey: "efgPct",
        isPercentage: true,
        useRelativeScale: true,
        category: "efficiency",
      },
      // PLAYMAKING - Assists, Passes, Turnovers
      {
        key: "assists",
        title: "Assists",
        getValue: (g) => g.ast,
        avgValue: avgAssists,
        selectedRange: filters.assists,
        filterKey: "assists",
        isInteger: true,
        category: "playmaking",
      },
      {
        key: "passes",
        title: "Passes",
        getValue: (g) => g.passes,
        avgValue: avgPasses,
        selectedRange: filters.passes,
        filterKey: "passes",
        isInteger: true,
        category: "playmaking",
      },
      {
        key: "turnovers",
        title: "Turnovers",
        getValue: (g) => g.tov,
        avgValue: avgTurnovers,
        selectedRange: filters.turnovers,
        filterKey: "turnovers",
        isInteger: true,
        category: "playmaking",
      },
      // REBOUNDING - Total, OREB, DREB, Potential
      {
        key: "rebounds",
        title: "Rebounds",
        getValue: (g) => g.reb,
        avgValue: avgRebounds,
        selectedRange: filters.rebounds,
        filterKey: "rebounds",
        isInteger: true,
        category: "rebounding",
      },
      {
        key: "oreb",
        title: "Off Reb",
        getValue: (g) => g.oreb,
        avgValue: avgOreb,
        selectedRange: filters.oreb,
        filterKey: "oreb",
        isInteger: true,
        category: "rebounding",
      },
      {
        key: "dreb",
        title: "Def Reb",
        getValue: (g) => g.dreb,
        avgValue: avgDreb,
        selectedRange: filters.dreb,
        filterKey: "dreb",
        isInteger: true,
        category: "rebounding",
      },
      {
        key: "potentialReb",
        title: "Potential Reb",
        getValue: (g) => g.potentialReb,
        avgValue: avgPotentialReb,
        selectedRange: filters.potentialReb,
        filterKey: "potentialReb",
        isInteger: true,
        category: "rebounding",
      },
      // DEFENSE - Steals, Blocks
      {
        key: "steals",
        title: "Steals",
        getValue: (g) => g.stl,
        avgValue: avgSteals,
        selectedRange: filters.steals,
        filterKey: "steals",
        isInteger: true,
        category: "defense",
      },
      {
        key: "blocks",
        title: "Blocks",
        getValue: (g) => g.blk,
        avgValue: avgBlocks,
        selectedRange: filters.blocks,
        filterKey: "blocks",
        isInteger: true,
        category: "defense",
      },
      // SCORING (Points + FTA/FTM)
      {
        key: "points",
        title: "Points",
        getValue: (g) => g.pts,
        avgValue: avgPoints,
        selectedRange: filters.points,
        filterKey: "points",
        isInteger: true,
        category: "efficiency",
      },
      {
        key: "fta",
        title: "FTA",
        getValue: (g) => g.fta,
        avgValue: avgFta,
        selectedRange: filters.fta,
        filterKey: "fta",
        isInteger: true,
        category: "opportunity",
      },
      {
        key: "ftm",
        title: "FTM",
        getValue: (g) => g.ftm,
        avgValue: avgFtm,
        selectedRange: filters.ftm,
        filterKey: "ftm",
        isInteger: true,
        category: "efficiency",
      },
      // Plus/Minus - Defense
      {
        key: "plusMinus",
        title: "+/-",
        getValue: (g) => g.plusMinus,
        avgValue: avgPlusMinus,
        selectedRange: filters.plusMinus,
        filterKey: "plusMinus",
        isInteger: true,
        category: "defense",
      },
    ];
    
    // Sort configs based on market relevance
    return allConfigs.sort((a, b) => {
      const priorityA = getFilterPriority(a.filterKey as string);
      const priorityB = getFilterPriority(b.filterKey as string);
      return priorityA - priorityB;
    });
  }, [
    filters, market,
    avgMinutes, avgUsage, avgPoints, avgRebounds, avgOreb, avgDreb, avgPotentialReb,
    avgAssists, avgPasses, avgSteals, avgBlocks, avgTurnovers,
    avgFga, avgFgm, avgFg3a, avgFg3m, avgFta, avgFtm,
    avgPlusMinus, avgTsPct, avgEfgPct, getFilterPriority,
  ]);
  
  // Helper to render a filter chart
  const renderFilterChart = (config: typeof filterConfigs[0], inGrid: boolean = false) => (
    <MiniBarChart
      key={config.key}
      title={config.title}
      games={games}
      getValue={config.getValue}
      avgValue={config.avgValue}
      selectedRange={config.selectedRange}
      onRangeChange={(range) => onFiltersChange({ ...filters, [config.filterKey]: range })}
      isPercentage={config.isPercentage}
      isInteger={config.isInteger}
      useRelativeScale={config.useRelativeScale}
      decimals={config.decimals}
      showPresetChips={config.showPresetChips}
    />
  );
  
  // Placeholder component
  const PlaceholderCard = ({ title }: { title: string }) => (
    <div className={cn(
      "rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-5",
      isExpandedState ? "" : "flex-shrink-0 w-[45%] sm:w-[320px] lg:w-[31%] min-w-[280px]"
    )}>
      <h4 className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 mb-3">
        {title}
      </h4>
      <div className="h-24 flex items-center justify-center text-xs text-neutral-400 dark:text-neutral-500">
        Coming soon
      </div>
    </div>
  );
  
  if (games.length === 0) return null;
  
  return (
    <div className={cn("relative", className)}>
      {/* Controls Row - only show if not hidden */}
      {!hideControls && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold text-white bg-brand px-2 py-0.5 rounded-full">
                {activeFilterCount} active
              </span>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={() => onFiltersChange(DEFAULT_FILTERS)}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
          {/* View toggle */}
          <button
            onClick={() => setIsExpandedState(!isExpandedState)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
              isExpandedState
                ? "bg-brand/10 border-brand text-brand"
                : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
            )}
          >
            {isExpandedState ? (
              <>
                <LayoutList className="h-3.5 w-3.5" />
                <span>Scroll View</span>
              </>
            ) : (
              <>
                <Grid3X3 className="h-3.5 w-3.5" />
                <span>View All</span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Collapsed: Scrollable view */}
      {!isExpandedState && (
        <div className="relative">
          {/* Left arrow */}
          {showLeftArrow && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
            </button>
          )}
          
          {/* Charts container - horizontal scroll */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-5 overflow-x-auto scrollbar-hide pb-2 px-1"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {filterConfigs.map((config) => renderFilterChart(config))}
            
            {/* Placeholders */}
            <PlaceholderCard title="Days Rest" />
            <PlaceholderCard title="Opp Defense Rank" />
            <PlaceholderCard title="Game Pace" />
          </div>
          
          {/* Right arrow */}
          {showRightArrow && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full shadow-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
            </button>
          )}
        </div>
      )}
      
      {/* Expanded: Grid view */}
      {isExpandedState && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filterConfigs.map((config) => renderFilterChart(config, true))}
          
          {/* Placeholders */}
          <PlaceholderCard title="Days Rest" />
          <PlaceholderCard title="Opp Defense Rank" />
          <PlaceholderCard title="Game Pace" />
        </div>
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
    // Minutes filter
    if (filters.minutes) {
      if (game.minutes < filters.minutes.min || game.minutes > filters.minutes.max) {
        return false;
      }
    }
    
    // Usage filter
    if (filters.usage) {
      if (game.usagePct < filters.usage.min || game.usagePct > filters.usage.max) {
        return false;
      }
    }
    
    // Home/Away filter
    if (filters.homeAway) {
      const isHome = game.homeAway === "H";
      if (filters.homeAway === "home" && !isHome) return false;
      if (filters.homeAway === "away" && isHome) return false;
    }
    
    // Win/Loss filter
    if (filters.winLoss) {
      const isWin = game.result === "W";
      if (filters.winLoss === "win" && !isWin) return false;
      if (filters.winLoss === "loss" && isWin) return false;
    }
    
    // Core stats filters
    if (filters.points) {
      if (game.pts < filters.points.min || game.pts > filters.points.max) return false;
    }
    if (filters.rebounds) {
      if (game.reb < filters.rebounds.min || game.reb > filters.rebounds.max) return false;
    }
    if (filters.assists) {
      if (game.ast < filters.assists.min || game.ast > filters.assists.max) return false;
    }
    if (filters.steals) {
      if (game.stl < filters.steals.min || game.stl > filters.steals.max) return false;
    }
    if (filters.blocks) {
      if (game.blk < filters.blocks.min || game.blk > filters.blocks.max) return false;
    }
    if (filters.turnovers) {
      if (game.tov < filters.turnovers.min || game.tov > filters.turnovers.max) return false;
    }
    
    // Rebounds breakdown
    if (filters.oreb) {
      if (game.oreb < filters.oreb.min || game.oreb > filters.oreb.max) return false;
    }
    if (filters.dreb) {
      if (game.dreb < filters.dreb.min || game.dreb > filters.dreb.max) return false;
    }
    if (filters.potentialReb) {
      if (game.potentialReb < filters.potentialReb.min || game.potentialReb > filters.potentialReb.max) return false;
    }
    
    // Tracking stats
    if (filters.passes) {
      if (game.passes < filters.passes.min || game.passes > filters.passes.max) return false;
    }
    
    // Shooting stats filters
    if (filters.fga) {
      if (game.fga < filters.fga.min || game.fga > filters.fga.max) return false;
    }
    if (filters.fgm) {
      if (game.fgm < filters.fgm.min || game.fgm > filters.fgm.max) return false;
    }
    if (filters.fg3a) {
      if (game.fg3a < filters.fg3a.min || game.fg3a > filters.fg3a.max) return false;
    }
    if (filters.fg3m) {
      if (game.fg3m < filters.fg3m.min || game.fg3m > filters.fg3m.max) return false;
    }
    if (filters.fta) {
      if (game.fta < filters.fta.min || game.fta > filters.fta.max) return false;
    }
    if (filters.ftm) {
      if (game.ftm < filters.ftm.min || game.ftm > filters.ftm.max) return false;
    }
    
    // Advanced stats
    if (filters.plusMinus) {
      if (game.plusMinus < filters.plusMinus.min || game.plusMinus > filters.plusMinus.max) return false;
    }
    if (filters.tsPct) {
      if (game.tsPct < filters.tsPct.min || game.tsPct > filters.tsPct.max) return false;
    }
    if (filters.efgPct) {
      if (game.efgPct < filters.efgPct.min || game.efgPct > filters.efgPct.max) return false;
    }
    
    return true;
  });
}

