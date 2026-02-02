"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  Filter, 
  X, 
  Flame,
  AlertCircle,
  Calendar,
  BookOpen,
  ExternalLink,
  SlidersHorizontal,
  BarChart3,
  TrendingUp,
  UserMinus,
  ArrowUpDown,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
} from "lucide-react";
import Chart from "@/icons/chart";
import Link from "next/link";
import { CheatSheetRow } from "@/hooks/use-cheat-sheet";
import { CheatSheetFilterState } from "../cheat-sheet-filters";
import { TIME_WINDOW_OPTIONS, CHEAT_SHEET_MARKETS, HIT_RATE_OPTIONS } from "@/hooks/use-cheat-sheet";
import { Tooltip } from "@/components/tooltip";
import { PlayerHeadshot } from "@/components/player-headshot";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { useFavorites, createFavoriteKey, type AddFavoriteParams } from "@/hooks/use-favorites";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

// Helper to get sportsbook name
const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

interface MobileCheatSheetProps {
  rows: CheatSheetRow[];
  isLoading: boolean;
  filters: CheatSheetFilterState;
  onFiltersChange: (filters: CheatSheetFilterState) => void;
  onGlossaryOpen: () => void;
  onRowClick?: (row: CheatSheetRow) => void;
  /** Click handler for player name to open hit rate modal */
  onPlayerClick?: (row: CheatSheetRow) => void;
  sport?: string;
  currentSheet?: string;
  isGated?: boolean; // If true, show upgrade banners and disable filters
}

const DATE_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "tomorrow" as const, label: "Tomorrow" },
  { value: "all" as const, label: "All" },
];

// Sort options for mobile
const SORT_OPTIONS = [
  { value: "confidence", label: "Grade", key: "confidenceScore" },
  { value: "hitRate", label: "Hit %", key: "hitRate" },
  { value: "edge", label: "Edge", key: "edge" },
  { value: "dvp", label: "DvP", key: "dvpRank" },
  { value: "odds", label: "Odds", key: "odds" },
] as const;

type SortOption = typeof SORT_OPTIONS[number]["value"];

// Market short labels
const MARKET_SHORT_LABELS: Record<string, string> = {
  "player_points": "PTS",
  "player_rebounds": "REB",
  "player_assists": "AST",
  "player_points_rebounds_assists": "PRA",
  "player_points_rebounds": "P+R",
  "player_points_assists": "P+A",
  "player_rebounds_assists": "R+A",
  "player_threes_made": "3PM",
  "player_steals": "STL",
  "player_blocks": "BLK",
  "player_blocks_steals": "B+S",
  "player_turnovers": "TO",
};

// Common name suffixes to preserve
const NAME_SUFFIXES = ["Jr.", "Jr", "Sr.", "Sr", "II", "III", "IV", "V"];

// Format player name as "F. LastName" or "F. LastName Jr."
const formatPlayerName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return fullName;
  
  // Check if last part is a suffix
  const lastPart = parts[parts.length - 1];
  const hasSuffix = NAME_SUFFIXES.includes(lastPart);
  
  if (hasSuffix && parts.length >= 3) {
    // "LeBron James Jr." -> "L. James Jr."
    const firstName = parts[0];
    const lastName = parts[parts.length - 2];
    const suffix = lastPart;
    return `${firstName.charAt(0)}. ${lastName} ${suffix}`;
  } else if (parts.length >= 2) {
    // "LeBron James" -> "L. James"
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName.charAt(0)}. ${lastName}`;
  }
  
  return fullName;
};

// Helper functions
const getHitRateColor = (value: number) => {
  if (value >= 0.85) return "text-emerald-500";
  if (value >= 0.75) return "text-green-500";
  if (value >= 0.65) return "text-yellow-500";
  return "text-red-500";
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case "A+": return "bg-emerald-500/10 text-emerald-500";
    case "A": return "bg-green-500/10 text-green-500";
    case "B+": return "bg-yellow-500/10 text-yellow-500";
    case "B": return "bg-orange-500/10 text-orange-500";
    default: return "bg-neutral-500/10 text-neutral-500";
  }
};

const getDvpColor = (rank: number | null) => {
  if (rank === null) return "text-neutral-400 bg-neutral-100 dark:bg-neutral-800";
  if (rank >= 21) return "text-emerald-600 bg-emerald-500/15";
  if (rank >= 11) return "text-yellow-600 bg-yellow-500/15";
  return "text-red-600 bg-red-500/15";
};

const getEdgeColor = (edge: number | null) => {
  if (edge === null) return "text-neutral-400";
  if (edge >= 2) return "text-emerald-500";
  if (edge >= 0) return "text-green-500";
  return "text-red-500";
};

// Format odds display
const formatOdds = (price: number): string => {
  return price >= 0 ? `+${price}` : `${price}`;
};

export function MobileCheatSheet({
  rows,
  isLoading,
  filters,
  onFiltersChange,
  onGlossaryOpen,
  onRowClick,
  onPlayerClick,
  sport = "nba",
  currentSheet = "hit-rates",
  isGated = false,
}: MobileCheatSheetProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [sortBy, setSortBy] = useState<SortOption>("hitRate");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
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

  // Favorites
  const { isFavorited, toggleFavorite, isLoggedIn } = useFavorites();
  const [togglingRowKey, setTogglingRowKey] = useState<string | null>(null);
  
  // Build favorite params from a row
  const buildFavoriteParams = (row: CheatSheetRow): AddFavoriteParams => {
    // Use bestOdds from the row (fetched from Redis in the API)
    const bestPrice = row.bestOdds?.price ?? null;
    const bestBook = row.bestOdds?.book ?? null;
    
    // Build minimal books snapshot from bestOdds
    let booksSnapshot: Record<string, any> | null = null;
    if (bestBook && bestPrice !== null) {
      booksSnapshot = {
        [bestBook]: {
          price: bestPrice,
          u: null, // Links fetched on demand
          m: null,
          sgp: null,
        },
      };
    }
    
    // Build odds_key for Redis lookups: odds:{sport}:{eventId}:{market}
    const eventId = row.eventId || `game_${row.gameId}`;
    const oddsKey = `odds:nba:${eventId}:${row.market}`;
    
    return {
      type: "player",
      sport: "nba",
      event_id: eventId,
      game_date: row.gameDate,
      home_team: row.homeTeamAbbr,
      away_team: row.awayTeamAbbr,
      start_time: null,
      player_id: String(row.playerId),
      player_name: row.playerName,
      player_team: row.teamAbbr,
      player_position: row.playerPosition,
      market: row.market,
      line: row.line,
      side: "over",
      odds_key: oddsKey,
      odds_selection_id: row.oddsSelectionId,
      books_snapshot: booksSnapshot,
      best_price_at_save: bestPrice,
      best_book_at_save: bestBook,
      source: "cheat_sheet_mobile",
    };
  };
  
  const isRowFavorited = (row: CheatSheetRow): boolean => {
    return isFavorited({
      event_id: row.eventId || `game_${row.gameId}`,
      type: "player",
      player_id: String(row.playerId),
      market: row.market,
      line: row.line,
      side: "over",
    });
  };
  
  const isRowToggling = (row: CheatSheetRow): boolean => {
    if (!togglingRowKey) return false;
    const key = createFavoriteKey({
      event_id: row.eventId || `game_${row.gameId}`,
      type: "player",
      player_id: String(row.playerId),
      market: row.market,
      line: row.line,
      side: "over",
    });
    return key === togglingRowKey;
  };
  
  const handleToggleFavorite = async (row: CheatSheetRow, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (!isLoggedIn) return;
    
    const params = buildFavoriteParams(row);
    const key = createFavoriteKey({
      event_id: params.event_id,
      type: params.type,
      player_id: params.player_id,
      market: params.market,
      line: params.line,
      side: params.side,
    });
    
    setTogglingRowKey(key);
    try {
      await toggleFavorite(params);
    } finally {
      setTogglingRowKey(null);
    }
  };

  // Get hit rate based on time window
  const getRowHitRate = (row: CheatSheetRow): number => {
    switch (filters.timeWindow) {
      case "last_5_pct": return row.last5Pct ?? 0;
      case "last_10_pct": return row.last10Pct ?? 0;
      case "last_20_pct": return row.last20Pct ?? 0;
      case "season_pct": return row.seasonPct ?? 0;
      default: return row.last10Pct ?? 0;
    }
  };

  // Helper to check if a row has best odds from Redis
  const hasLiveOdds = (row: CheatSheetRow): boolean => {
    return row.bestOdds !== null && row.bestOdds !== undefined;
  };

  // Count rows without odds for the toggle label
  const noOddsCount = useMemo(() => {
    return rows.filter(row => !hasLiveOdds(row)).length;
  }, [rows]);

  // Sort rows based on selected option
  const sortedRows = useMemo(() => {
    // First filter out rows without odds if hideNoOdds is true
    let filteredRows = rows;
    if (filters.hideNoOdds) {
      filteredRows = rows.filter(row => hasLiveOdds(row));
    }

    const sorted = [...filteredRows];
    
    sorted.sort((a, b) => {
      // Push rows without best odds to the bottom (when hideNoOdds is false)
      if (!filters.hideNoOdds) {
        const aHasOdds = hasLiveOdds(a);
        const bHasOdds = hasLiveOdds(b);
        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }

      // Then sort by selected option
      switch (sortBy) {
        case "confidence":
          return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
        case "hitRate":
          return getRowHitRate(b) - getRowHitRate(a);
        case "edge": {
          const edgeA = a.edge ?? (a.avgStat != null ? a.avgStat - a.line : 0);
          const edgeB = b.edge ?? (b.avgStat != null ? b.avgStat - b.line : 0);
          return edgeB - edgeA;
        }
        case "dvp":
          // Higher rank = easier matchup = better, so sort descending
          return (b.dvpRank ?? 0) - (a.dvpRank ?? 0);
        case "odds":
          // Sort by best over American odds (higher is better: +200 > +100 > -100 > -200)
          return (b.bestOdds?.price ?? -9999) - (a.bestOdds?.price ?? -9999);
        default:
          return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
      }
    });
    
    return sorted;
  }, [rows, sortBy, filters.timeWindow, filters.hideNoOdds]);

  const visibleRows = useMemo(() => sortedRows.slice(0, visibleCount), [sortedRows, visibleCount]);
  const hasMore = sortedRows.length > visibleCount;

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Grade";
  const currentDateLabel = DATE_OPTIONS.find(o => o.value === filters.dateFilter)?.label ?? "Today";

  // Get the relevant hit rate based on time window
  const getHitRateData = (row: CheatSheetRow) => {
    switch (filters.timeWindow) {
      case "last_5_pct": return { pct: row.last5Pct, games: 5 };
      case "last_10_pct": return { pct: row.last10Pct, games: 10 };
      case "last_20_pct": return { pct: row.last20Pct, games: 20 };
      case "season_pct": return { pct: row.seasonPct, games: null };
      default: return { pct: row.last10Pct, games: 10 };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="px-3 pt-2 pb-1.5 space-y-2">
          {/* Row 1: Title + Help Button */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h1 className="text-base font-bold text-neutral-900 dark:text-white">
                Hit Rate Cheat Sheet
              </h1>
              <p className="text-[10px] text-neutral-500">
                High-confidence props ranked by score
              </p>
            </div>
            
            {/* Help Button */}
            <button
              type="button"
              onClick={onGlossaryOpen}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md shrink-0",
                "text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                "text-neutral-500 dark:text-neutral-400",
                "hover:text-neutral-700 dark:hover:text-neutral-300",
                "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Help</span>
            </button>
          </div>

          {/* Row 2: Market Pills - Locked for gated users */}
          {isGated ? (
            <div className="flex items-center gap-2 pb-1">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20">
                <span className="text-xs font-medium text-brand">Points</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <Lock className="w-3 h-3" />
                <span>Upgrade to access all markets</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {/* All Markets */}
              <button
                type="button"
                onClick={() => {
                  const allSelected = filters.markets.length === CHEAT_SHEET_MARKETS.length;
                  if (allSelected) {
                    updateFilter("markets", ["player_points"]);
                  } else {
                    updateFilter("markets", CHEAT_SHEET_MARKETS.map(m => m.value));
                  }
                }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0",
                  "text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                  "border",
                  filters.markets.length === CHEAT_SHEET_MARKETS.length
                    ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                    : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                )}
              >
                All
              </button>
              {CHEAT_SHEET_MARKETS.map((market) => {
                const isOnlyThisSelected = filters.markets.length === 1 && filters.markets[0] === market.value;
                return (
                  <button
                    key={market.value}
                    type="button"
                    onClick={() => {
                      // Single-select: clicking a market selects only that market
                      updateFilter("markets", [market.value]);
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0",
                      "text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                      "border",
                      isOnlyThisSelected
                        ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                        : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                    )}
                  >
                    {MARKET_SHORT_LABELS[market.value] || market.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Row 3: Date, Time Window Toggles, Sort, Filters Button */}
          <div className="flex items-center justify-between gap-2 pb-1">
            {/* Left: Date + Time Window */}
            <div className="flex items-center gap-2">
              {/* Date Dropdown - Locked for gated users */}
              {isGated ? (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg shrink-0 border bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed">
                  <Lock className="h-3 w-3 text-neutral-400" />
                  <span className="text-[11px] font-semibold text-neutral-400">Today</span>
                </div>
              ) : (
                <div ref={dateDropdownRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDateDropdown(!showDateDropdown)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded-lg shrink-0",
                      "border transition-all duration-150 active:scale-[0.96]",
                      "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                    )}
                  >
                    <Calendar className="h-3 w-3 text-neutral-500" />
                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">{currentDateLabel}</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 text-neutral-400 transition-transform",
                      showDateDropdown && "rotate-180"
                    )} />
                  </button>

                  {showDateDropdown && (
                    <div className="absolute left-0 top-full z-[200] mt-1 min-w-[100px] rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                    {DATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          updateFilter("dateFilter", opt.value);
                          setShowDateDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-colors",
                          filters.dateFilter === opt.value
                            ? "bg-brand/10 text-brand"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              )}

              {/* Time Window Toggles - Locked for gated users */}
              {isGated ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 opacity-50 cursor-not-allowed">
                  <Lock className="h-3 w-3 text-neutral-400" />
                  <span className="text-[11px] font-semibold text-neutral-400">L10%</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 shrink-0 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  {TIME_WINDOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateFilter("timeWindow", opt.value)}
                      className={cn(
                        "px-2 py-1 rounded text-[11px] font-semibold transition-all",
                        filters.timeWindow === opt.value
                          ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                          : "text-neutral-500 dark:text-neutral-400"
                      )}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Sort + Filters */}
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <div ref={sortDropdownRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-lg shrink-0",
                    "border transition-all duration-150 active:scale-[0.96]",
                    "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  )}
                >
                  <ArrowUpDown className="h-3 w-3 text-neutral-500" />
                  <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">{currentSortLabel}</span>
                  <ChevronDown className={cn(
                    "h-3 w-3 text-neutral-400 transition-transform",
                    showSortDropdown && "rotate-180"
                  )} />
                </button>

                {showSortDropdown && (
                  <div className="absolute right-0 top-full z-[200] mt-1 min-w-[120px] rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value);
                          setShowSortDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-colors",
                          sortBy === opt.value
                            ? "bg-brand/10 text-brand"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Filters Button - Always clickable, filters locked for gated users */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center justify-center px-2 py-1.5 rounded-lg shrink-0",
                  "border transition-all duration-150 active:scale-[0.96]",
                  showFilters
                    ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                    : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Advanced Filters - Visible for all, but locked for gated users */}
        {showFilters && (
          <div className="px-3 pb-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
            {/* Upgrade banner for gated users */}
            {isGated && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand/10 border border-brand/20">
                <Lock className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                  <Link href="/pricing" className="font-semibold text-brand hover:underline">Upgrade</Link> to unlock all filters
                </span>
              </div>
            )}
            
            {/* Hit Rate */}
            <div className={cn(isGated && "opacity-50 pointer-events-none")}>
              <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Min Hit Rate</label>
              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                {HIT_RATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => !isGated && updateFilter("minHitRate", opt.value)}
                    disabled={isGated}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                      filters.minHitRate === opt.value
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Toggles */}
            <div className={cn(isGated && "opacity-50 pointer-events-none")}>
              <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Quick Filters</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => !isGated && updateFilter("trendFilter", filters.trendFilter.includes("hot") ? [] : ["hot"])}
                  disabled={isGated}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filters.trendFilter.includes("hot")
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Hot Streak
                </button>
                <button
                  type="button"
                  onClick={() => !isGated && updateFilter("hideInjured", !filters.hideInjured)}
                  disabled={isGated}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filters.hideInjured
                      ? "bg-red-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Hide Injured
                </button>
                <button
                  type="button"
                  onClick={() => !isGated && updateFilter("hideB2B", !filters.hideB2B)}
                  disabled={isGated}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filters.hideB2B
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Hide B2B
                </button>
                <button
                  type="button"
                  onClick={() => !isGated && updateFilter("hideNoOdds", !filters.hideNoOdds)}
                  disabled={isGated}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filters.hideNoOdds
                      ? "bg-brand text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  {filters.hideNoOdds ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {filters.hideNoOdds ? `Hide No Odds (${noOddsCount})` : "Show All"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Area */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
            <div className="text-center">
              <div className="relative inline-flex">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand" />
                <Chart className="absolute inset-0 m-auto h-5 w-5 text-brand/60" />
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading cheat sheet...</p>
            </div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex items-center justify-center py-16 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
            <div className="text-center max-w-sm px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-4 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50 mx-auto">
                <SlidersHorizontal className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
                No props match your filters
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Try adjusting your filters to see more results
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Horizontally Scrolling Table */}
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                {/* Table Header */}
                <thead className="bg-neutral-100 dark:bg-neutral-800">
                  <tr className="border-b border-neutral-200/60 dark:border-neutral-700/40">
                    <th className="sticky left-0 z-10 bg-neutral-100 dark:bg-neutral-800 text-left px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[120px] min-w-[120px]">
                      Player
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[70px]">
                      Prop
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[65px]">
                      Grade
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[55px]">
                      Hit %
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[55px]">
                      Avg
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[40px]">
                      DvP
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[75px]">
                      Odds
                    </th>
                    <th className="text-center px-2 py-2.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-[40px]">
                      <Heart className="w-3.5 h-3.5 mx-auto" />
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white dark:bg-neutral-900">
                  {visibleRows.map((row, idx) => {
                    const { pct, games } = getHitRateData(row);
                    const hits = games ? Math.round(pct * games) : null;
                    const pctDisplay = Math.round(pct * 100);
                    const edge = row.edge ?? (row.avgStat != null ? row.avgStat - row.line : null);

                    return (
                      <tr 
                        key={`${row.playerId}-${row.market}-${row.line}-${idx}`}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          "border-b border-neutral-100 dark:border-neutral-800/50",
                          idx % 2 === 0 ? "bg-white dark:bg-[#171717]" : "bg-[#f0f9ff] dark:bg-[#1c1c1f]",
                          "active:bg-neutral-100 dark:active:bg-neutral-800"
                        )}
                      >
                        {/* Player - Sticky (same colors as row to match perfectly) */}
                        <td className={cn(
                          "sticky left-0 z-10 px-2 py-2",
                          idx % 2 === 0 ? "bg-white dark:bg-[#171717]" : "bg-[#f0f9ff] dark:bg-[#1c1c1f]"
                        )}>
                          <div className="flex items-center gap-1.5">
                            {/* Headshot with team logo overlay */}
                            <div className="relative shrink-0">
                              <div 
                                className="w-7 h-7 rounded-full p-[1px]"
                                style={{
                                  background: row.primaryColor 
                                    ? `linear-gradient(135deg, ${row.primaryColor} 0%, ${row.secondaryColor || row.primaryColor} 100%)`
                                    : '#374151'
                                }}
                              >
                                <div 
                                  className="w-full h-full rounded-full overflow-hidden relative"
                                  style={{
                                    background: row.primaryColor && row.secondaryColor
                                      ? `linear-gradient(180deg, ${row.primaryColor}dd 0%, ${row.primaryColor} 50%, ${row.secondaryColor} 100%)`
                                      : row.primaryColor || '#374151'
                                  }}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center scale-[1.4] translate-y-[10%]">
                                    <PlayerHeadshot
                                      nbaPlayerId={row.playerId}
                                      name={row.playerName}
                                      size="small"
                                      className="w-full h-auto"
                                    />
                                  </div>
                                </div>
                              </div>
                              {/* Team logo overlay */}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                                <img
                                  src={`/team-logos/nba/${row.teamAbbr?.toUpperCase()}.svg`}
                                  alt={row.teamAbbr ?? ""}
                                  className="h-1.5 w-1.5 object-contain"
                                  onError={(e) => { 
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            </div>
                            
                            {/* Name & Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-0.5">
                                {onPlayerClick ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPlayerClick(row);
                                    }}
                                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 truncate text-left"
                                  >
                                    {formatPlayerName(row.playerName)}
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-neutral-900 dark:text-white truncate">
                                    {formatPlayerName(row.playerName)}
                                  </span>
                                )}
                                {row.hitStreak >= 5 && (
                                  <Tooltip content={`🔥 ${row.hitStreak} game streak`}>
                                    <button 
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-0.5 -m-0.5"
                                    >
                                      <Flame className="w-2.5 h-2.5 text-orange-500 shrink-0" />
                                    </button>
                                  </Tooltip>
                                )}
                              </div>
                              <div className="text-[9px] text-neutral-500 truncate">
                                {row.homeAway?.toUpperCase() === "H" ? "vs" : "@"} {row.opponentAbbr}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Prop */}
                        <td className="text-center px-2 py-2">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">
                              {row.line}+
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {MARKET_SHORT_LABELS[row.market] || row.market}
                            </span>
                          </div>
                        </td>

                        {/* Grade (with score) */}
                        <td className="text-center px-2 py-2">
                          <div className="flex flex-col items-center">
                            <span className={cn(
                              "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                              getGradeColor(row.confidenceGrade)
                            )}>
                              {row.confidenceGrade}
                            </span>
                            <span className="text-[9px] text-neutral-400 tabular-nums">
                              {Math.round(row.confidenceScore)}
                            </span>
                          </div>
                        </td>

                        {/* Hit Rate */}
                        <td className="text-center px-2 py-2">
                          <div className={cn("text-xs font-bold tabular-nums", getHitRateColor(pct))}>
                            {hits !== null ? `${hits}/${games}` : `${pctDisplay}%`}
                          </div>
                          {hits !== null && (
                            <div className="text-[10px] text-neutral-400 tabular-nums">
                              {pctDisplay}%
                            </div>
                          )}
                        </td>

                        {/* Avg + Edge */}
                        <td className="text-center px-2 py-2">
                          <div className="text-[10px] text-neutral-400 tabular-nums">
                            {row.avgStat?.toFixed(1) ?? "—"}
                          </div>
                          {edge !== null && (
                            <div className={cn("text-xs font-bold tabular-nums", getEdgeColor(edge))}>
                              {edge >= 0 ? "+" : ""}{edge.toFixed(1)}
                            </div>
                          )}
                        </td>

                        {/* DvP */}
                        <td className="text-center px-2 py-2">
                          {row.dvpRank ? (
                            <span className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold",
                              getDvpColor(row.dvpRank)
                            )}>
                              {row.dvpRank}
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>

                        {/* Odds - Simple display using bestOdds from API */}
                        <td className="text-center px-2 py-2">
                          {row.bestOdds ? (
                            <div className="flex items-center justify-center gap-1">
                              {getBookLogo(row.bestOdds.book) && (
                                <img
                                  src={getBookLogo(row.bestOdds.book)!}
                                  alt={getBookName(row.bestOdds.book)}
                                  className="h-4 w-4 rounded object-contain"
                                />
                              )}
                              <span className={cn(
                                "text-xs font-semibold tabular-nums",
                                row.bestOdds.price >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                              )}>
                                {row.bestOdds.price >= 0 ? `+${row.bestOdds.price}` : row.bestOdds.price}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                        
                        {/* Favorites */}
                        <td className="text-center px-1 py-2">
                          {!isLoggedIn ? (
                            <button
                              disabled
                              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Heart className="w-4 h-4 text-neutral-400" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleToggleFavorite(row, e)}
                              disabled={isRowToggling(row)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                isRowFavorited(row)
                                  ? "bg-red-500/10"
                                  : "bg-neutral-100 dark:bg-neutral-800"
                              )}
                            >
                              {isRowToggling(row) ? (
                                <HeartFill className="w-4 h-4 text-red-400 animate-pulse" />
                              ) : isRowFavorited(row) ? (
                                <HeartFill className="w-4 h-4 text-red-500" />
                              ) : (
                                <Heart className="w-4 h-4 text-neutral-400" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Upgrade CTA for gated users */}
            {isGated && (
              <div className="relative">
                {/* Gradient fade */}
                <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none" />
                
                <div className="px-4 py-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 mb-3">
                      <Lock className="w-5 h-5 text-brand" />
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                      Unlock All Props
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
                      Access all markets, filters, and unlimited props
                    </p>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand/25"
                    >
                      Upgrade Now
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Load More - Hidden for gated users */}
            {hasMore && !isGated && (
              <button
                onClick={() => setVisibleCount((prev) => prev + 30)}
                className="w-full py-4 text-sm font-semibold text-brand bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800"
              >
                Load More ({rows.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
