"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Info, HeartPulse, Loader2, Search, X, ArrowDown, SlidersHorizontal, Check, User } from "lucide-react";
import Chart from "@/icons/chart";
// Disabled: usePrefetchPlayer was causing excessive API calls on hover
// import { usePrefetchPlayer } from "@/hooks/use-prefetch-player";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
// MiniSparkline removed - using color-coded percentage cells instead for performance
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
  // Optional games filter element
  gamesFilter?: React.ReactNode;
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

// Get progress bar color based on hit rate
const getProgressBarColor = (value: number | null) => {
  if (value === null || value === undefined) return "bg-neutral-300 dark:bg-neutral-600";
  if (value >= 75) return "bg-emerald-500";
  if (value >= 60) return "bg-emerald-400";
  if (value >= 50) return "bg-amber-400";
  if (value >= 35) return "bg-orange-400";
  return "bg-red-400";
};

// Premium Hit Rate Cell with progress bar
const HitRateCell = ({ 
  value, 
  isBlurred = false 
}: { 
  value: number | null; 
  isBlurred?: boolean;
}) => {
  const percentage = value ?? 0;
  const barColor = getProgressBarColor(value);
  const textColor = value === null ? "text-neutral-400" :
    value >= 60 ? "text-emerald-500 dark:text-emerald-400" :
    value >= 50 ? "text-amber-500 dark:text-amber-400" :
    value >= 35 ? "text-orange-500 dark:text-orange-400" :
    "text-red-500 dark:text-red-400";
  
  return (
    <div className={cn("flex flex-col items-center gap-1", isBlurred && "blur-[3px] opacity-60")}>
      {/* Percentage value */}
      <span className={cn("text-sm font-bold tabular-nums", textColor)}>
        {value !== null ? `${Math.round(value)}%` : "—"}
      </span>
      {/* Progress bar */}
      <div className="w-12 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};

// getHitRateTextColor removed - using hitRateBadgeClass for all hit rate displays

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
  gamesFilter,
}: HitRateTableProps) {
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Disabled: Prefetch was causing excessive API calls on every row hover
  // const prefetchPlayer = usePrefetchPlayer();
  
  // Advanced filter states
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [maxMatchupRank, setMaxMatchupRank] = useState<number>(0); // 0 = all
  // Support both controlled and uncontrolled hideNoOdds
  // Default to false so we show all players while odds are loading
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
  }, [setHideNoOdds]);

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
    // Default back to points when deselecting all
    onMarketsChange(["player_points"]);
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

  // Apply advanced filters only (sorting is consolidated in sortedRows)
  const filteredRows = useMemo(() => {
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
    
    return result;
  }, [rows, selectedPositions, maxMatchupRank]);

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
  
  // Sort rows: All sorting consolidated here
  // Priority: 1) "Out" players to bottom, 2) Primary sort field, 3) Odds availability (tiebreaker)
  const sortedRows = useMemo(() => {
    // Get sort field mapping
    const fieldMap: Record<string, keyof HitRateProfile> = {
      line: "line",
      l5Avg: "last5Avg",
      l10Avg: "last10Avg",
      seasonAvg: "seasonAvg",
      streak: "hitStreak",
      l5Pct: "last5Pct",
      l10Pct: "last10Pct",
      l20Pct: "last20Pct",
      seasonPct: "seasonPct",
      h2hPct: "h2hPct",
      matchupRank: "matchupRank",
    };
    
    const sortFieldKey = sortField ? fieldMap[sortField] : null;
    const multiplier = sortDirection === "asc" ? 1 : -1;
    
    return [...filteredRows].sort((a, b) => {
      // 0. ALWAYS push "out" players to the bottom
      const aIsOut = a.injuryStatus?.toLowerCase() === "out";
      const bIsOut = b.injuryStatus?.toLowerCase() === "out";
      if (aIsOut && !bIsOut) return 1;
      if (!aIsOut && bIsOut) return -1;
      
      // 1. PRIMARY SORT: by user's selected field (L10%, etc.)
      if (sortFieldKey) {
        const aVal = a[sortFieldKey] as number | null;
        const bVal = b[sortFieldKey] as number | null;
        
        // Push nulls to the end (regardless of sort direction)
        if (aVal === null && bVal !== null) return 1;
        if (aVal !== null && bVal === null) return -1;
        
        // If both have values, compare them
        if (aVal !== null && bVal !== null) {
          const diff = (aVal - bVal) * multiplier;
          if (diff !== 0) return diff;
        }
        // If both are null, fall through to secondary sort
      }
      
      // 2. SECONDARY SORT (tiebreaker): prefer rows with odds
      // Only apply when odds have finished loading
      if (!oddsLoading) {
        const aOdds = getOdds(a.oddsSelectionId);
        const bOdds = getOdds(b.oddsSelectionId);
        
        const aHasOdds = !!(aOdds && (aOdds.bestOver || aOdds.bestUnder));
        const bHasOdds = !!(bOdds && (bOdds.bestOver || bOdds.bestUnder));
        
        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }
      
      return 0;
    });
  }, [filteredRows, getOdds, oddsLoading, sortField, sortDirection]);

  // Report which profiles have odds (for filtering in other components like sidebar)
  // Use a ref to track previous value and avoid infinite loops
  const prevOddsIdsRef = useRef<string>("");
  
  useEffect(() => {
    if (!onOddsAvailabilityChange || oddsLoading) return;
    
    const idsWithOdds = new Set<string>();
    for (const row of rows) {
      if (row.oddsSelectionId) {
        const odds = getOdds(row.oddsSelectionId);
        // Only count as having odds if there are actual betting lines
        if (odds && (odds.bestOver || odds.bestUnder)) {
        idsWithOdds.add(row.oddsSelectionId);
        }
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

  // Render filter bar component (extracted for reuse) - Premium styling
  // z-[20] ensures dropdowns appear above the sticky table header (z-[5])
  const filterBar = (
    <div className="relative z-[20] flex items-center gap-4 px-5 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-r from-white via-neutral-50/50 to-white dark:from-neutral-900 dark:via-neutral-800/30 dark:to-neutral-900 shrink-0 backdrop-blur-sm">
        {/* Markets Dropdown - Premium */}
        <div ref={dropdownRef} className="relative z-[9998]">
          <button
            type="button"
            onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 w-[190px]",
              "bg-white dark:bg-neutral-800/90 shadow-sm hover:shadow-md",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
              marketDropdownOpen && "ring-2 ring-brand/30 border-brand/50"
            )}
          >
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
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
            <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform duration-200 shrink-0", marketDropdownOpen && "rotate-180 text-brand")} />
          </button>

          {marketDropdownOpen && (
            <div className="absolute left-0 top-full z-[9999] mt-2 w-[220px] rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-xl p-2 shadow-2xl dark:border-neutral-700/80 dark:bg-neutral-900/95 ring-1 ring-black/5 dark:ring-white/5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2 mb-2 px-1">
                <button type="button" onClick={selectAllMarkets} className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors">
                  Select All
                </button>
                <button type="button" onClick={deselectAllMarkets} className="text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors">
                  Clear All
                </button>
              </div>
              <div className="flex flex-col gap-0.5 max-h-64 overflow-auto">
                {MARKET_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <Checkbox checked={selectedMarkets.includes(opt.value)} onCheckedChange={() => toggleMarket(opt.value)} />
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Games Filter Dropdown */}
        {gamesFilter}

        {/* Search Input - Premium */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-10 pr-9 py-2.5 text-sm rounded-xl shadow-sm",
              "bg-white dark:bg-neutral-800/90",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
              "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
              "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50",
              "dark:text-white transition-all duration-200"
            )}
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Advanced Filters Button - Premium */}
        <div ref={filterPopupRef} className="relative z-[9998]">
          <button
            type="button"
            onClick={() => setShowFilterPopup(!showFilterPopup)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
              showFilterPopup || hasActiveFilters
                ? "bg-brand/10 border-brand/40 text-brand shadow-sm shadow-brand/10 dark:bg-brand/20 dark:border-brand/50"
                : "bg-white dark:bg-neutral-800/90 border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm hover:shadow-md",
              "border ring-1 ring-black/[0.03] dark:ring-white/[0.03]"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            )}
          </button>

          {/* Filter Popup - Premium */}
          {showFilterPopup && (
            <div className="absolute right-0 top-full z-[9999] mt-2 w-[340px] rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-xl shadow-2xl dark:border-neutral-700/80 dark:bg-neutral-900/95 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
              {/* Header with gradient */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">Advanced Filters</span>
                <button 
                  onClick={() => setShowFilterPopup(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Position Filter */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-3">
                  Position
                </div>
                <div className="flex flex-wrap gap-2">
                  {POSITION_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => togglePosition(value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all duration-200",
                        selectedPositions.has(value)
                          ? "bg-gradient-to-r from-brand to-brand/90 text-white shadow-md shadow-brand/20"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200/60 dark:border-neutral-700/60"
                      )}
                    >
                      {selectedPositions.has(value) && <Check className="w-3 h-3" />}
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matchup Rank Filter - Number Input */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Top Matchups Only
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {maxMatchupRank > 0 ? `Showing top ${maxMatchupRank} matchups` : "Showing all matchups"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.max(0, maxMatchupRank - 1))}
                      disabled={maxMatchupRank === 0}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
                        maxMatchupRank === 0
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:shadow-sm"
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
                      className="w-16 h-8 text-center text-sm font-bold rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxMatchupRank(Math.min(MAX_MATCHUP_RANK_LIMIT, maxMatchupRank + 1))}
                      disabled={maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-xl border transition-all duration-200",
                        maxMatchupRank >= MAX_MATCHUP_RANK_LIMIT
                          ? "border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:shadow-sm"
                      )}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Hide No Odds Toggle */}
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Hide Players Without Odds
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Only show props with available betting lines
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideNoOdds}
                    onClick={() => setHideNoOdds(!hideNoOdds)}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 dark:focus:ring-offset-neutral-900",
                      hideNoOdds ? "bg-gradient-to-r from-brand to-brand/90 shadow-inner" : "bg-neutral-200 dark:bg-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-all duration-200",
                        hideNoOdds ? "translate-x-[26px]" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <div className="px-5 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30">
                  <button
                    onClick={resetFilters}
                    className="w-full py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-xl hover:bg-white dark:hover:bg-neutral-800 transition-all duration-200 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Count indicator - Premium pill style */}
        <div className="ml-auto px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60">
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          {hasActiveFilters || selectedMarkets.length < MARKET_OPTIONS.length ? (
            // Filters active - show filtered count
            <>{filteredRows.length} props</>
          ) : totalCount !== undefined ? (
            // All markets, no filters - show pagination info
            <>{rows.length} of {totalCount} props</>
          ) : (
            <>{rows.length} props</>
          )}
          </span>
        </div>
      </div>
  );

  // Loading state - Premium
  if (loading) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-16 flex-1 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
          <div className="text-center">
            <div className="relative inline-flex">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand" />
              <Chart className="absolute inset-0 m-auto h-5 w-5 text-brand/60" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading hit rates...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - Premium
  if (error) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-16 flex-1">
          <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50 to-red-100/50 p-6 text-red-800 dark:border-red-900/40 dark:from-red-950/40 dark:to-red-900/20 dark:text-red-200 shadow-sm max-w-sm">
            <p className="font-bold text-lg">Unable to load hit rates</p>
            <p className="text-sm mt-2 opacity-80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no markets selected or no data) - Premium
  if (!rows.length) {
    return (
      <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
        {filterBar}
        <div className="flex items-center justify-center py-20 flex-1 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-5 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50 mx-auto">
              <Chart className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
              {selectedMarkets.length === 0 ? "No markets selected" : "No hit rates available"}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
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
    <div className="flex flex-col h-full rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
      {filterBar}
      
      {/* Optional upgrade banner for gated access */}
      {upgradeBanner}

      {/* Table - Premium styling */}
      <div ref={scrollRef} className="overflow-auto flex-1">
      <table className="min-w-full text-sm table-fixed">
          <colgroup><col style={{ width: 250 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 45 }} /><col style={{ width: 320 }} /><col style={{ width: 75 }} /></colgroup>
        <thead className="sticky top-0 z-[5]">
          <tr className="bg-gradient-to-r from-neutral-50 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-800/50 dark:to-neutral-900 backdrop-blur-sm">
            {/* Non-sortable columns */}
            <th className="h-14 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Player
            </th>
            {/* Sortable: Matchup */}
            <th
              onClick={() => handleSort("matchupRank")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                Matchup
                <SortIcon field="matchupRank" />
              </div>
            </th>
            
            {/* Sortable: Prop (line) */}
            <th
              onClick={() => handleSort("line")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                Prop
                <SortIcon field="line" />
              </div>
            </th>
            
            {/* Sortable: L5 Avg */}
            <th
              onClick={() => handleSort("l5Avg")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L5 Avg
                <SortIcon field="l5Avg" />
              </div>
            </th>
            
            {/* Sortable: L10 Avg */}
            <th
              onClick={() => handleSort("l10Avg")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L10 Avg
                <SortIcon field="l10Avg" />
              </div>
            </th>
            
            {/* Sortable: 25/26 Avg (Season Avg) */}
            <th
              onClick={() => handleSort("seasonAvg")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                25/26 Avg
                <SortIcon field="seasonAvg" />
              </div>
            </th>
            
            {/* Sortable: Streak */}
            <th
              onClick={() => handleSort("streak")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <Tooltip content="Hit Streak - Consecutive games hitting this line" side="top">
                <div className="flex items-center justify-center gap-0.5">
                  <span>Str</span>
                <SortIcon field="streak" />
              </div>
              </Tooltip>
            </th>
            
            {/* Sortable: L5 */}
            <th
              onClick={() => handleSort("l5Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200 w-16 min-w-[64px]"
            >
              <div className="flex items-center justify-center gap-1">
                L5
                <SortIcon field="l5Pct" />
              </div>
            </th>
            
            {/* Sortable: L10 */}
            <th
              onClick={() => handleSort("l10Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L10
                <SortIcon field="l10Pct" />
              </div>
            </th>
            
            {/* Sortable: L20 */}
            <th
              onClick={() => handleSort("l20Pct")}
              className="h-14 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                L20
                <SortIcon field="l20Pct" />
              </div>
            </th>
            
            {/* Sortable: 25/26 % (Season %) */}
            <th
              onClick={() => handleSort("seasonPct")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                25/26
                <SortIcon field="seasonPct" />
              </div>
            </th>
            
            {/* H2H % (Head to Head) */}
            <th
              onClick={() => handleSort("h2hPct")}
              className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 select-none transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-1">
                H2H
                <SortIcon field="h2hPct" />
              </div>
            </th>
            
            {/* Non-sortable: Odds (last column) */}
            <th className="h-14 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-800/80">
              Odds
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const odds = getOdds(row.oddsSelectionId);
            
            // Apply hideNoOdds filter - skip rows without actual betting odds
            // Check for bestOver or bestUnder since the API returns an object even when no odds exist
            // Don't apply filter while odds are still loading
            const hasActualOdds = odds && (odds.bestOver || odds.bestUnder);
            if (hideNoOdds && !oddsLoading && !hasActualOdds) return null;
            
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
                onClick={() => !isBlurred && onRowClick?.(row)}
                className={cn(
                  "border-b border-neutral-100/80 dark:border-neutral-800/80 transition-all duration-200 group",
                  idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-50/50 dark:bg-neutral-900/50",
                  isBlurred 
                    ? "cursor-default select-none pointer-events-none" 
                    : "cursor-pointer hover:bg-brand/[0.04] dark:hover:bg-brand/10 hover:shadow-[inset_4px_0_0_0_rgba(99,102,241,0.5)]",
                  isHighConfidence && !isBlurred && "shadow-[inset_4px_0_0_0_rgba(16,185,129,0.6)]"
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
                      
                      {/* DvP Rank Number */}
                      {row.matchupRank !== null && (
                        <span className={cn(
                          "text-xs font-bold mt-0.5 tabular-nums",
                          getMatchupRankColor(row.matchupRank)
                        )}>
                          #{row.matchupRank}
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

                {/* L5 % - Premium cell with progress bar */}
                <td className="px-2 py-3 align-middle text-center">
                  <HitRateCell value={row.last5Pct} isBlurred={isBlurred} />
                </td>

                {/* L10 % - Premium cell with progress bar */}
                <td className="px-2 py-3 align-middle text-center">
                  <HitRateCell value={row.last10Pct} isBlurred={isBlurred} />
                </td>

                {/* L20 % - Premium cell with progress bar */}
                <td className="px-2 py-3 align-middle text-center">
                  <HitRateCell value={row.last20Pct} isBlurred={isBlurred} />
                </td>

                {/* Season % - Premium cell with progress bar */}
                <td className="px-2 py-3 align-middle text-center">
                  <HitRateCell value={row.seasonPct} isBlurred={isBlurred} />
                </td>
                
                {/* H2H % - Premium cell with progress bar */}
                <td className="px-2 py-3 align-middle text-center">
                  <HitRateCell value={row.h2hPct} isBlurred={isBlurred} />
                </td>
                
                {/* Odds Column (last column) */}
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
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Load More Button - Premium */}
      {hasMore && onLoadMore && (
        <div className="sticky bottom-0 flex items-center justify-center py-5 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-neutral-900 dark:via-neutral-900/95">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200",
              "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
              "hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:shadow-lg",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.03]",
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

