"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { TrendingUp, ChevronUp, ChevronDown, ChevronsUpDown, Info, HeartPulse, Loader2, Search, X, ArrowDown, SlidersHorizontal, Check, User } from "lucide-react";
import { usePrefetchPlayer } from "@/hooks/use-prefetch-player";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
import { MiniSparkline, MiniHitIndicator } from "@/components/hit-rates/mini-sparkline";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { useHitRateOdds, type LineOdds } from "@/hooks/use-hit-rate-odds";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl, getStandardAbbreviation } from "@/lib/data/team-mappings";
import { Checkbox } from "@/components/ui/checkbox";

// Map of combo market keys to their full descriptions (only abbreviated combos need tooltips)
const COMBO_MARKET_DESCRIPTIONS: Record<string, string> = {
  "player_points_rebounds_assists": "Points + Rebounds + Assists",
  "player_points_rebounds": "Points + Rebounds",
  "player_points_assists": "Points + Assists",
  "player_rebounds_assists": "Rebounds + Assists",
};

// Check if a market is a combo market that needs a tooltip
const getMarketTooltip = (market: string): string | null => {
  return COMBO_MARKET_DESCRIPTIONS[market] || null;
};

type SortField = "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank";
type SortDirection = "asc" | "desc";

// Market options for filter
const MARKET_OPTIONS = [
  { value: "player_points", label: "Points" },
  { value: "player_rebounds", label: "Rebounds" },
  { value: "player_assists", label: "Assists" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_points_rebounds", label: "P+R" },
  { value: "player_points_assists", label: "P+A" },
  { value: "player_rebounds_assists", label: "R+A" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_steals", label: "Steals" },
  { value: "player_blocks", label: "Blocks" },
  { value: "player_blocks_steals", label: "Blk+Stl" },
  { value: "player_turnovers", label: "Turnovers" },
];

// Position options for filter
const POSITION_OPTIONS = [
  { value: "PG", label: "Point Guard" },
  { value: "SG", label: "Shooting Guard" },
  { value: "SF", label: "Small Forward" },
  { value: "PF", label: "Power Forward" },
  { value: "C", label: "Center" },
];

// Max matchup rank value (0 = all/disabled)
const MAX_MATCHUP_RANK_LIMIT = 30;

interface HitRateTableProps {
  rows: HitRateProfile[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: HitRateProfile) => void;
  // Pagination props
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalCount?: number;
  // Filter props
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Sort props
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  // Scroll position restoration
  scrollRef?: React.RefObject<HTMLDivElement>;
  initialScrollTop?: number;
  // Advanced filter props (controlled from parent)
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  // Callback to report which profiles have odds
  onOddsAvailabilityChange?: (idsWithOdds: Set<string>) => void;
  // Optional upgrade banner to show after filters (for gated access)
  upgradeBanner?: React.ReactNode;
  // Optional content to render after the table (for blurred preview rows)
  bottomContent?: React.ReactNode;
  // Index after which rows should be blurred (for gated access preview)
  blurAfterIndex?: number;
}

const formatPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

// Hit rate badge class - matches alternate lines matrix colors
const hitRateBadgeClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
  }
  if (value >= 60) {
    return "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-500";
  }
  if (value >= 50) {
    return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
  }
  if (value >= 35) {
    return "bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400";
  }
  return "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400";
};

// Hit rate text color - matches alternate lines matrix (text only, no background)
const getHitRateTextColor = (value: number | null) => {
  if (value === null || value === undefined) {
    return "text-neutral-400 dark:text-neutral-500";
  }
  if (value >= 75) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (value >= 60) {
    return "text-emerald-500 dark:text-emerald-500";
  }
  if (value >= 50) {
    return "text-amber-600 dark:text-amber-400";
  }
  if (value >= 35) {
    return "text-orange-500 dark:text-orange-400";
  }
  return "text-red-500 dark:text-red-400";
};

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Check if a game date is tomorrow (in ET timezone)
const isTomorrow = (gameDate: string | null): boolean => {
  if (!gameDate) return false;
  
  // Get today's date in ET
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayET = etFormatter.format(now);
  
  // Get tomorrow's date in ET
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowET = etFormatter.format(tomorrow);
  
  return gameDate === tomorrowET;
};

// Check if a game has started (10 minutes after scheduled time)
const hasGameStarted = (gameStatus: string | null, gameDate: string | null): boolean => {
  if (!gameStatus || !gameDate) return false;
  
  // Try to parse scheduled time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    // Can't parse as scheduled time - might be in progress status, hide odds
    return true;
  }
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create scheduled game time in ET
  // Note: Using -05:00 for EST, games during EDT would be -04:00
  const scheduledTime = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Add 10 minutes buffer
  const bufferMs = 10 * 60 * 1000;
  const gameStartedTime = new Date(scheduledTime.getTime() + bufferMs);
  
  // Compare to current time
  return Date.now() > gameStartedTime.getTime();
};

// Convert ET time string (e.g., "7:00 pm ET") to user's local timezone
const formatGameTime = (gameStatus: string | null, gameDate: string | null) => {
  if (!gameStatus) return "TBD";
  
  // Check if it's a final score or other non-time status
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;
  
  // Try to parse time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create a date object in ET (Eastern Time)
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Format in user's local timezone
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatSpread = (spread: number | null) => {
  if (spread === null || spread === undefined) return "—";
  return spread > 0 ? `+${spread}` : spread.toString();
};

// Get color class for average vs line comparison
const getAvgColorClass = (avg: number | null, line: number | null) => {
  if (avg === null || line === null) return "text-neutral-700 dark:text-neutral-300";
  if (avg > line) return "text-emerald-600 dark:text-emerald-400"; // Green - over the line
  if (avg < line) return "text-red-500 dark:text-red-400"; // Red - under the line
  return "text-neutral-700 dark:text-neutral-300"; // Neutral - exactly at the line
};

// Position labels for display
const POSITION_LABELS: Record<string, string> = {
  'PG': 'Point Guard',
  'SG': 'Shooting Guard',
  'SF': 'Small Forward',
  'PF': 'Power Forward',
  'C': 'Center',
  'G': 'Guard',
  'F': 'Forward',
  'GF': 'Guard-Forward',
  'FC': 'Forward-Center',
};

const formatPosition = (position: string | null) => {
  if (!position) return "—";
  return position; // Now just return the position code (PG, SG, SF, PF, C, etc.)
};

const getPositionLabel = (position: string | null): string => {
  if (!position) return "Unknown";
  return POSITION_LABELS[position] || position;
};

const getStatusBorderClass = (status: string | null) => {
  // All players get the same neutral border - no colored borders
  return "border border-neutral-200 dark:border-neutral-700";
};

const isPlayerOut = (status: string | null) => status === "out";

// Get injury icon color class based on status
const getInjuryIconColorClass = (status: string | null): string => {
  if (!status || status === "active" || status === "available") return "";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game_time_decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "";
};

// Check if player has an injury status worth showing
const hasInjuryStatus = (status: string | null): boolean => {
  if (!status) return false;
  return status !== "active" && status !== "available";
};

// Get matchup tier based on rank (5-tier system)
// LOW rank (1-10) = tough defense = HARD for player (red)
// HIGH rank (21-30) = weak defense = GOOD for player (green)
type MatchupTier = "elite" | "strong" | "neutral" | "bad" | "worst" | null;

const getMatchupTier = (rank: number | null): MatchupTier => {
  if (rank === null) return null;
  if (rank <= 5) return "worst";      // 1-5: Toughest defense (FADE)
  if (rank <= 10) return "bad";       // 6-10: Hard matchup
  if (rank <= 20) return "neutral";   // 11-20: Neutral matchup
  if (rank <= 25) return "strong";    // 21-25: Good matchup
  return "elite";                      // 26-30: Easiest matchup (SMASH)
};

// Get matchup background classes (5-tier system) - More vivid for top/bottom 5
const getMatchupBgClass = (rank: number | null): string => {
  const tier = getMatchupTier(rank);
  if (!tier) return "";
  switch (tier) {
    case "elite":
      // Bold green - easiest matchup (26-30)
      return "bg-emerald-200 dark:bg-emerald-700/40 ring-1 ring-emerald-400/50 dark:ring-emerald-500/30";
    case "strong":
      return "bg-emerald-50 dark:bg-emerald-900/20";
    case "neutral":
      return "bg-neutral-100/40 dark:bg-neutral-700/20";
    case "bad":
      return "bg-red-50 dark:bg-red-900/20";
    case "worst":
      // Bold red - toughest matchup (1-5)
      return "bg-red-200 dark:bg-red-700/40 ring-1 ring-red-400/50 dark:ring-red-500/30";
    default:
      return "";
  }
};

// Get matchup rank text color (5-tier system)
const getMatchupRankColor = (rank: number | null): string => {
  const tier = getMatchupTier(rank);
  if (!tier) return "text-neutral-500 dark:text-neutral-400";
  switch (tier) {
    case "elite":
      // Bold green text - easiest matchup
      return "text-emerald-800 dark:text-emerald-200 font-bold";
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "neutral":
      return "text-neutral-500 dark:text-neutral-400";
    case "bad":
      return "text-red-500 dark:text-red-400";
    case "worst":
      // Bold red text - toughest matchup
      return "text-red-800 dark:text-red-200 font-bold";
    default:
      return "text-neutral-500 dark:text-neutral-400";
  }
};

// Column definitions for sortable headers
const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "line", label: "Prop" },
  { key: "l5Avg", label: "L5 Avg" },
  { key: "l10Avg", label: "L10 Avg" },
  { key: "seasonAvg", label: "25/26 Avg" },
  { key: "streak", label: "Streak" },
  { key: "l5Pct", label: "L5" },
  { key: "l10Pct", label: "L10" },
  { key: "l20Pct", label: "L20" },
  { key: "seasonPct", label: "25/26" },
];

const getSortValue = (row: HitRateProfile, field: SortField): number | null => {
  switch (field) {
    case "line": return row.line;
    case "l5Avg": return row.last5Avg;
    case "l10Avg": return row.last10Avg;
    case "seasonAvg": return row.seasonAvg;
    case "streak": return row.hitStreak;
    case "l5Pct": return row.last5Pct;
    case "l10Pct": return row.last10Pct;
    case "l20Pct": return row.last20Pct;
    case "seasonPct": return row.seasonPct;
    case "h2hPct": return row.h2hPct;
    case "matchupRank": return row.matchupRank;
    default: return null;
  }
};

export function HitRateTable({ 
  rows, 
  loading, 
  error, 
  onRowClick,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
  selectedMarkets,
  onMarketsChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  scrollRef,
  initialScrollTop,
  hideNoOdds: hideNoOddsControlled,
  onHideNoOddsChange,
  onOddsAvailabilityChange,
  upgradeBanner,
  bottomContent,
  blurAfterIndex,
}: HitRateTableProps) {
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Prefetch player data on hover for faster drilldown loading
  const prefetchPlayer = usePrefetchPlayer();
  
  // Advanced filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [maxMatchupRank, setMaxMatchupRank] = useState<number>(0); // 0 = all
  // Support both controlled and uncontrolled hideNoOdds
  const [hideNoOddsInternal, setHideNoOddsInternal] = useState(false);
  const hideNoOdds = hideNoOddsControlled ?? hideNoOddsInternal;
  const setHideNoOdds = onHideNoOddsChange ?? setHideNoOddsInternal;
  const filterPopupRef = useRef<HTMLDivElement>(null);
  
  // Check if any advanced filters are active
  const hasActiveFilters = selectedPositions.size > 0 || maxMatchupRank > 0 || hideNoOdds;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target as Node)) {
        setShowFilterPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Toggle position selection
  const togglePosition = useCallback((pos: string) => {
    setSelectedPositions(prev => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }, []);
  
  // Reset all advanced filters
  const resetFilters = useCallback(() => {
    setSelectedPositions(new Set());
    setMaxMatchupRank(0);
    setHideNoOdds(false);
  }, []);

  // Restore scroll position when returning from drilldown
  useEffect(() => {
    if (scrollRef?.current && initialScrollTop !== undefined && initialScrollTop > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: initialScrollTop, behavior: "instant" });
      });
    }
  }, [initialScrollTop, scrollRef]);

  const toggleMarket = useCallback((value: string) => {
    onMarketsChange(
      selectedMarkets.includes(value) 
        ? selectedMarkets.filter((v) => v !== value) 
        : [...selectedMarkets, value]
    );
  }, [selectedMarkets, onMarketsChange]);

  const selectAllMarkets = useCallback(() => {
    onMarketsChange(MARKET_OPTIONS.map((o) => o.value));
  }, [onMarketsChange]);

  const deselectAllMarkets = useCallback(() => {
    onMarketsChange([]);
  }, [onMarketsChange]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      const newDirection = sortDirection === "asc" ? "desc" : "asc";
      onSortChange(field, newDirection);
    } else {
      // New field - always default to descending
      // For matchupRank: desc = best matchups first (30, 29, 28... = weak defense)
      // For all other fields: desc = highest values first
      onSortChange(field, "desc");
    }
  }, [sortField, sortDirection, onSortChange]);

  // Apply advanced filters first, then sort
  const filteredAndSortedRows = useMemo(() => {
    let result = rows;
    
    // Filter by position
    if (selectedPositions.size > 0) {
      result = result.filter(row => {
        const pos = row.position?.toUpperCase();
        if (!pos) return false;
        // Handle positions like "G" (guard) matching PG/SG, "F" matching SF/PF
        if (pos === "G") return selectedPositions.has("PG") || selectedPositions.has("SG");
        if (pos === "F") return selectedPositions.has("SF") || selectedPositions.has("PF");
        return selectedPositions.has(pos);
      });
    }
    
    // Filter by matchup rank (top N best matchups = highest ranks = weakest defense)
    // With our logic: high rank (21-30) = good for player, low rank (1-10) = bad for player
    // So "top 10 matchups" means ranks 21-30 (the 10 easiest matchups)
    if (maxMatchupRank > 0) {
      const minRankThreshold = 31 - maxMatchupRank; // top 10 = ranks >= 21, top 5 = ranks >= 26
      result = result.filter(row => 
        row.matchupRank !== null && row.matchupRank >= minRankThreshold
      );
    }
    
    // Note: hideNoOdds filter is applied in render since odds are fetched separately
    
    // Sort
    if (sortField) {
      result = [...result].sort((a, b) => {
        // Push "out" players to the bottom regardless of sort order
        const aIsOut = a.injuryStatus?.toLowerCase() === "out";
        const bIsOut = b.injuryStatus?.toLowerCase() === "out";
        if (aIsOut && !bIsOut) return 1;
        if (!aIsOut && bIsOut) return -1;
        
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        
        // Handle nulls - push them to the end
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        const diff = aVal - bVal;
        return sortDirection === "asc" ? diff : -diff;
      });
    }
    
    return result;
  }, [rows, sortField, sortDirection, selectedPositions, maxMatchupRank]);
  
  // Keep sortedRows for backwards compatibility (used elsewhere)
  const sortedRows = filteredAndSortedRows;

  // Fetch odds for all rows using the new stable key system
  // The oddsSelectionId is now a stable hash that never changes
  // Progressive odds loading - first 50 rows load immediately, rest in background
  const { getOdds, isLoading: oddsLoading, loadedCount, totalCount: oddsTotalCount } = useHitRateOdds({
    rows: rows.map((r) => ({ 
      oddsSelectionId: r.oddsSelectionId, 
      line: r.line 
    })),
    enabled: rows.length > 0,
  });

  // Report which profiles have odds (for filtering in other components like sidebar)
  // Use a ref to track previous value and avoid infinite loops
  const prevOddsIdsRef = useRef<string>("");
  
  useEffect(() => {
    if (!onOddsAvailabilityChange || oddsLoading) return;
    
    const idsWithOdds = new Set<string>();
    for (const row of rows) {
      if (row.oddsSelectionId && getOdds(row.oddsSelectionId)) {
        idsWithOdds.add(row.oddsSelectionId);
      }
    }
    
    // Only call callback if the set actually changed
    const idsString = Array.from(idsWithOdds).sort().join(",");
    if (idsString !== prevOddsIdsRef.current) {
      prevOddsIdsRef.current = idsString;
      onOddsAvailabilityChange(idsWithOdds);
    }
  }, [rows, getOdds, oddsLoading, onOddsAvailabilityChange]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  // Render filter bar component (extracted for reuse)
  const filterBar = (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-900/80 shrink-0">
        {/* Markets Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 w-[180px]"
            )}
          >
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {selectedMarkets.length === 0
                ? "No markets"
                : selectedMarkets.length === MARKET_OPTIONS.length
                ? "All Markets"
                : selectedMarkets.length === 1
                ? MARKET_OPTIONS.find(o => o.value === selectedMarkets[0])?.label ?? "1 selected"
                : selectedMarkets.length === 2
                ? selectedMarkets.map(m => MARKET_OPTIONS.find(o => o.value === m)?.label).filter(Boolean).join(", ")
                : `${selectedMarkets.length} selected`}
            </span>
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform shrink-0", marketDropdownOpen && "rotate-180")} />
          </button>

          {marketDropdownOpen && (
            <div className="absolute left-0 top-full z-[100] mt-1 w-[200px] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-2">
                <button type="button" onClick={selectAllMarkets} className="text-xs font-medium text-brand hover:underline">
                  Select All
                </button>
                <button type="button" onClick={deselectAllMarkets} className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                  Deselect All
                </button>
              </div>
              <div className="flex flex-col gap-0.5 max-h-64 overflow-auto">
                {MARKET_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                    <Checkbox checked={selectedMarkets.includes(opt.value)} onCheckedChange={() => toggleMarket(opt.value)} />
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-neutral-200 bg-white shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand dark:border-neutral-700 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:text-white"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Advanced Filters Button */}
        <div ref={filterPopupRef} className="relative">
          <button
            type="button"
            onClick={() => setShowFilterPopup(!showFilterPopup)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all",
              showFilterPopup || hasActiveFilters
                ? "bg-brand/10 border-brand/30 text-brand dark:bg-brand/20 dark:border-brand/40"
                : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            )}
          </button>

          {/* Filter Popup */}
          {showFilterPopup && (
            <div className="absolute right-0 top-full z-[100] mt-2 w-[320px] rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Advanced Filters</span>
                <button 
                  onClick={() => setShowFilterPopup(false)}
                  className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Position Filter */}
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                  Position
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POSITION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => togglePosition(value)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        selectedPositions.has(value)
                          ? "bg-brand text-white shadow-sm"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {selectedPositions.has(value) && <Check className="w-3 h-3" />}
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matchup Rank Filter - Number Input */}
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Top Matchups Only
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {maxMatchupRank > 0 ? `Showing top ${maxMatchupRank} matchups` : "Showing all matchups"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.max(0, maxMatchupRank - 1))}
                      disabled={maxMatchupRank === 0}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-lg border transition-colors",
                        maxMatchupRank === 0
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={MAX_MATCHUP_RANK_LIMIT}
                      value={maxMatchupRank || ""}
                      placeholder="All"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 0) {
                          setMaxMatchupRank(0);
                        } else {
                          setMaxMatchupRank(Math.min(val, MAX_MATCHUP_RANK_LIMIT));
                        }
                      }}
                      className="w-14 h-7 text-center text-sm font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.min(MAX_MATCHUP_RANK_LIMIT, maxMatchupRank + 1))}
                      disabled={maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-lg border transition-colors",
                        maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Hide No Odds Toggle */}
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Hide Players Without Odds
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Only show props with available betting lines
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideNoOdds}
                    onClick={() => setHideNoOdds(!hideNoOdds)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 dark:focus:ring-offset-neutral-900",
                      hideNoOdds ? "bg-brand" : "bg-neutral-200 dark:bg-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform",
                        hideNoOdds ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </label>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <div className="px-4 py-3 bg-neutral-50/50 dark:bg-neutral-800/30">
                  <button
                    onClick={resetFilters}
                    className="w-full py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Count indicator - show filtered count when markets are filtered */}
        <div className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto">
          {hasActiveFilters || selectedMarkets.length < MARKET_OPTIONS.length ? (
            // Filters active - show filtered count
            <span>{filteredAndSortedRows.length} props</span>
          ) : totalCount !== undefined ? (
            // All markets, no filters - show pagination info
            <span>{rows.length} of {totalCount} props</span>
          ) : (
            <span>{rows.length} props</span>
          )}
        </div>
      </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {filterBar}
        <div className="flex items-center justify-center py-12 flex-1">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent mb-4" />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading hit rates...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {filterBar}
        <div className="flex items-center justify-center py-12 flex-1">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-semibold">Unable to load hit rates</p>
        <p className="text-sm mt-1 opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no markets selected or no data)
  if (!rows.length) {
    return (
      <div className="flex flex-col h-full rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {filterBar}
        <div className="flex items-center justify-center py-12 flex-1">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
              {selectedMarkets.length === 0 ? "No markets selected" : "No hit rates available"}
            </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {selectedMarkets.length === 0 
                ? "Select one or more markets from the dropdown above."
                : "Check back closer to tip-off or adjust your filters."}
          </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {filterBar}
      
      {/* Optional upgrade banner for gated access */}
      {upgradeBanner}

      {/* Table */}
      <div ref={scrollRef} className="overflow-auto flex-1">
      <table className="min-w-full text-sm table-fixed">
          <colgroup><col style={{ width: 240 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 45 }} /><col style={{ width: 320 }} /><col style={{ width: 75 }} /></colgroup>
        <thead className="table-header-gradient sticky top-0 z-10">
          <tr>
            {/* Non-sortable columns */}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              Player
            </th>
            {/* Sortable: Matchup */}
            <th
              onClick={() => handleSort("matchupRank")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                Matchup
                <SortIcon field="matchupRank" />
              </div>
            </th>
            
            {/* Sortable: Prop (line) */}
            <th
              onClick={() => handleSort("line")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                Prop
                <SortIcon field="line" />
              </div>
            </th>
            
            {/* Sortable: L5 Avg */}
            <th
              onClick={() => handleSort("l5Avg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L5 Avg
                <SortIcon field="l5Avg" />
              </div>
            </th>
            
            {/* Sortable: L10 Avg */}
            <th
              onClick={() => handleSort("l10Avg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L10 Avg
                <SortIcon field="l10Avg" />
              </div>
            </th>
            
            {/* Sortable: 25/26 Avg (Season Avg) */}
            <th
              onClick={() => handleSort("seasonAvg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                25/26 Avg
                <SortIcon field="seasonAvg" />
              </div>
            </th>
            
            {/* Non-sortable: Odds */}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              Odds
            </th>
            
            {/* Sortable: Streak */}
            <th
              onClick={() => handleSort("streak")}
              className="h-12 px-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <Tooltip content="Hit Streak - Consecutive games hitting this line" side="top">
                <div className="flex items-center justify-center gap-0.5">
                  <span>Str</span>
                <SortIcon field="streak" />
              </div>
              </Tooltip>
            </th>
            
            {/* Sortable: L20 / L10 / L5 - Each clickable individually */}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSort("l20Pct")}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-colors",
                    sortField === "l20Pct" 
                      ? "bg-brand/20 text-brand font-bold" 
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  L20
                </button>
                <span className="text-neutral-300 dark:text-neutral-600">/</span>
                <button
                  type="button"
                  onClick={() => handleSort("l10Pct")}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-colors",
                    sortField === "l10Pct" 
                      ? "bg-brand/20 text-brand font-bold" 
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  L10
                </button>
                <span className="text-neutral-300 dark:text-neutral-600">/</span>
                <button
                  type="button"
                  onClick={() => handleSort("l5Pct")}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-colors",
                    sortField === "l5Pct" 
                      ? "bg-brand/20 text-brand font-bold" 
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  L5
                </button>
                {(sortField === "l20Pct" || sortField === "l10Pct" || sortField === "l5Pct") && (
                  sortDirection === "asc" 
                    ? <ChevronUp className="h-3.5 w-3.5 text-brand" />
                    : <ChevronDown className="h-3.5 w-3.5 text-brand" />
                )}
              </div>
            </th>
            
            {/* Sortable: 25/26 % (Season %) */}
            <th
              onClick={() => handleSort("seasonPct")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                25/26
                <SortIcon field="seasonPct" />
              </div>
            </th>
            
            {/* H2H % (Head to Head) */}
            <th
              onClick={() => handleSort("h2hPct")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                H2H
                <SortIcon field="h2hPct" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const odds = getOdds(row.oddsSelectionId);
            
            // Apply hideNoOdds filter - skip rows without odds
            if (hideNoOdds && !odds) return null;
            
            const opponent = row.opponentTeamAbbr ?? row.opponentTeamName ?? "Opponent";
            const matchup = row.teamAbbr ? `${row.teamAbbr} vs ${opponent}` : opponent;
            const isHighConfidence = (row.last10Pct ?? 0) >= 70;
            // Use composite key with index to guarantee uniqueness
            // (same player can have duplicate profiles for same game in data)
            const rowKey = `${row.id}-${row.gameId ?? "no-game"}-${row.market}-${idx}`;
            
            // Check if this row should be blurred (for gated access)
            const isBlurred = blurAfterIndex !== undefined && idx >= blurAfterIndex;

            return (
              <tr
                key={rowKey}
                onMouseEnter={() => !isBlurred && prefetchPlayer(row.playerId)}
                onClick={() => !isBlurred && onRowClick?.(row)}
                className={cn(
                  "border-b border-neutral-100 dark:border-neutral-800 transition-all duration-150 group",
                  idx % 2 === 0 ? "table-row-even" : "table-row-odd",
                  isBlurred 
                    ? "cursor-default select-none pointer-events-none" 
                    : "cursor-pointer hover:bg-brand/5 dark:hover:bg-brand/10 hover:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]",
                  isHighConfidence && !isBlurred && "shadow-[inset_0_1px_0_rgba(16,185,129,0.2)]"
                )}
              >
                {/* Player Column: Headshot + Name + Position/Jersey */}
                <td className="px-3 py-4">
                  {isBlurred ? (
                    // Blurred placeholder content
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                        <User className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-neutral-400 dark:text-neutral-500 leading-tight blur-[2px]">
                            Player Name
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium blur-[2px]">
                          <span>Team</span>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span>Position</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Normal content
                    <div className={cn(
                      "flex items-center gap-3",
                      isPlayerOut(row.injuryStatus) && "opacity-50"
                    )}>
                      {(() => {
                        const hasInjury = row.injuryStatus && row.injuryStatus !== "active" && row.injuryStatus !== "available";
                        const injuryTooltip = hasInjury
                          ? `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                          : "";
                        
                        const headshotElement = (
                          <div 
                            className={cn(
                              "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-[1.03]",
                              hasInjury && "cursor-pointer",
                              getStatusBorderClass(row.injuryStatus)
                            )}
                            style={{ 
                              background: row.primaryColor && row.secondaryColor 
                                ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                                : row.primaryColor || undefined 
                            }}
                          >
                            <PlayerHeadshot
                              nbaPlayerId={row.playerId}
                              name={row.playerName}
                              size="small"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        );

                        return hasInjury ? (
                          <Tooltip content={injuryTooltip} side="right">
                            {headshotElement}
                          </Tooltip>
                        ) : (
                          headshotElement
                        );
                      })()}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">
                            {row.playerName}
                          </span>
                          {hasInjuryStatus(row.injuryStatus) && (() => {
                            const isGLeague = row.injuryNotes?.toLowerCase().includes("g league") || 
                                              row.injuryNotes?.toLowerCase().includes("g-league") ||
                                              row.injuryNotes?.toLowerCase().includes("gleague");
                            return (
                              <Tooltip 
                                content={isGLeague 
                                  ? `G League${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                                  : `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                                }
                                side="top"
                              >
                                {isGLeague ? (
                                  <ArrowDown className="h-4 w-4 cursor-help text-blue-500" />
                                ) : (
                                  <HeartPulse className={cn(
                                    "h-4 w-4 cursor-help",
                                    getInjuryIconColorClass(row.injuryStatus)
                                  )} />
                                )}
                              </Tooltip>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                          {row.teamAbbr && (
                            <img
                              src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                              alt={row.teamAbbr}
                              className="h-4 w-4 object-contain"
                            />
                          )}
                          <Tooltip content={getPositionLabel(row.position)} side="top">
                            <span className="cursor-help">{formatPosition(row.position)}</span>
                          </Tooltip>
                          <span className="text-neutral-300 dark:text-neutral-600">•</span>
                          <span>#{row.jerseyNumber ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </td>

                {/* Matchup Column */}
                <td className={cn(
                  "px-3 py-3 text-center rounded-lg",
                  isBlurred ? "" : getMatchupBgClass(row.matchupRank)
                )}>
                  {isBlurred ? (
                    // Blurred placeholder
                    <div className="flex flex-col items-center gap-1.5 opacity-50 blur-[2px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xs text-neutral-400 font-medium">vs</span>
                        <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400">—</span>
                    </div>
                  ) : (
                    // Normal content
                    <div className="flex flex-col items-center gap-1.5">
                      {/* Tomorrow label */}
                      {isTomorrow(row.gameDate) && (
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Tomorrow
                        </span>
                      )}
                      
                      {/* Opponent with vs/@ */}
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xs text-neutral-400 font-medium">
                          {row.homeAway === "H" ? "vs" : "@"}
                        </span>
                        {row.opponentTeamAbbr && (
                          <img
                            src={`/team-logos/nba/${row.opponentTeamAbbr.toUpperCase()}.svg`}
                            alt={row.opponentTeamAbbr}
                            className="h-6 w-6 object-contain"
                          />
                        )}
                      </div>
                      
                      {/* Matchup Rank */}
                      {row.matchupRankLabel && (
                        <span className={cn(
                          "text-[10px] font-semibold mt-0.5",
                          getMatchupRankColor(row.matchupRank)
                        )}>
                          {row.matchupRankLabel}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Prop Column */}
                <td className="px-3 py-4 align-middle text-center">
                  {isBlurred ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50 opacity-50 blur-[2px]">
                      <span className="font-semibold">00.0+</span>
                      PTS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {row.line !== null && (
                        <span className="font-semibold text-neutral-900 dark:text-white">{row.line}+</span>
                      )}
                      {formatMarketLabel(row.market)}
                      {getMarketTooltip(row.market) && (
                        <Tooltip content={getMarketTooltip(row.market)!}>
                          <Info className="h-3 w-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 cursor-help" />
                        </Tooltip>
                      )}
                    </span>
                  )}
                </td>

                {/* L5 Avg Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isBlurred ? "text-neutral-400 opacity-50 blur-[2px]" : getAvgColorClass(row.last5Avg, row.line)
                  )}>
                    {isBlurred ? "00.0" : (row.last5Avg !== null ? row.last5Avg.toFixed(1) : "—")}
                  </span>
                </td>

                {/* L10 Avg Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isBlurred ? "text-neutral-400 opacity-50 blur-[2px]" : getAvgColorClass(row.last10Avg, row.line)
                  )}>
                    {isBlurred ? "00.0" : (row.last10Avg !== null ? row.last10Avg.toFixed(1) : "—")}
                  </span>
                </td>

                {/* 25/26 Avg (Season Avg) Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn(
                    "text-sm font-medium",
                    isBlurred ? "text-neutral-400 opacity-50 blur-[2px]" : getAvgColorClass(row.seasonAvg, row.line)
                  )}>
                    {isBlurred ? "00.0" : (row.seasonAvg !== null ? row.seasonAvg.toFixed(1) : "—")}
                  </span>
                </td>

                {/* Odds Column */}
                <td className="px-3 py-4 align-middle text-center">
                  {isBlurred ? (
                    <span className="text-xs text-neutral-400 opacity-50 blur-[2px]">+000</span>
                  ) : hasGameStarted(row.gameStatus, row.gameDate) ? (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>
                  ) : (
                    <OddsDropdown 
                      odds={odds} 
                      loading={oddsLoading} 
                    />
                  )}
                </td>

                {/* Streak Column */}
                <td className="px-1 py-4 align-middle text-center">
                  {isBlurred ? (
                    <span className="text-sm font-medium text-neutral-400 opacity-50 blur-[2px]">0</span>
                  ) : row.hitStreak !== null && row.hitStreak !== undefined ? (
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {row.hitStreak}
                    </span>
                  ) : (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">—</span>
                  )}
                </td>

                {/* L20 / L10 / L5 Combined with full 20-game sparkline */}
                <td className="px-3 py-4 align-middle text-center">
                  <div className={cn("flex flex-col items-center gap-2", isBlurred && "blur-[3px] opacity-60")}>
                    {/* Full 20-game sparkline - oldest on left, newest on right */}
                    <MiniSparkline 
                      gameLogs={row.gameLogs as any} 
                      line={row.line} 
                      count={20} 
                      className="h-8"
                    />
                    {/* All three percentages below */}
                    <div className="flex items-center gap-1.5 text-[10px] font-medium">
                      <span className={getHitRateTextColor(row.last20Pct)}>
                        L20: {formatPercentage(row.last20Pct)}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-600">|</span>
                      <span className={getHitRateTextColor(row.last10Pct)}>
                        L10: {formatPercentage(row.last10Pct)}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-600">|</span>
                      <span className={getHitRateTextColor(row.last5Pct)}>
                        L5: {formatPercentage(row.last5Pct)}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Season % - Show real values with blur for locked users */}
                <td className="px-3 py-4 align-middle text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold",
                      hitRateBadgeClass(row.seasonPct),
                      isBlurred && "blur-[3px] opacity-60"
                    )}
                  >
                    {formatPercentage(row.seasonPct)}
                  </span>
                </td>
                
                {/* H2H % - Show real values with blur for locked users */}
                <td className="px-3 py-4 align-middle text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold",
                      hitRateBadgeClass(row.h2hPct),
                      isBlurred && "blur-[3px] opacity-60"
                    )}
                  >
                    {formatPercentage(row.h2hPct)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="sticky bottom-0 flex items-center justify-center py-4 bg-gradient-to-t from-white via-white dark:from-neutral-900 dark:via-neutral-900">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all",
              "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700",
              isLoadingMore && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
                {totalCount !== undefined && (
                  <span className="text-neutral-400 dark:text-neutral-500">
                    ({rows.length} of {totalCount})
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Optional bottom content (for gated CTA) */}
      {bottomContent}
      </div>
    </div>
  );
}

