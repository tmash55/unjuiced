"use client";

/**
 * Positive EV Finder - Find +EV betting opportunities using sharp reference lines
 * 
 * Uses de-vigging methods (Power, Multiplicative) to calculate fair probabilities
 * from sharp books (Pinnacle, Circa, etc.) and identify +EV opportunities.
 * 
 * URL: /positive-ev
 */

import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { LoadingState } from "@/components/common/loading-state";
import { Tooltip } from "@/components/tooltip";
import { 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  ChevronRight,
  RefreshCw, 
  Calculator,
  Info,
  ExternalLink,
  Percent,
  Loader2,
  Pin,
  Zap,
  Eye,
  EyeOff,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// Hooks and types
import { usePositiveEV } from "@/hooks/use-positive-ev";
import { usePositiveEVStream } from "@/hooks/use-positive-ev-stream";
import type { PositiveEVOpportunity, SharpPreset, DevigMethod, EVMode } from "@/lib/ev/types";
import { DEFAULT_DEVIG_METHODS } from "@/lib/ev/constants";
import { SHARP_PRESETS, DEVIG_METHODS } from "@/lib/ev/constants";
import { americanToImpliedProb, impliedProbToAmerican } from "@/lib/ev/devig";
import { applyBoostToDecimalOdds } from "@/lib/utils/kelly";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { shortenPeriodPrefix } from "@/lib/types/opportunities";
import { getLeagueName } from "@/lib/data/sports";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";

// Auth & entitlements
import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";
import { useIsMobile } from "@/hooks/use-media-query";

// Favorites
import { useFavorites } from "@/hooks/use-favorites";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { SportIcon } from "@/components/icons/sport-icons";

// Hidden edges
import { useHiddenEdges } from "@/hooks/use-hidden-edges";

// Player profile modal
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import { usePrefetchPlayerByOddsId } from "@/hooks/use-prefetch-player";

// Mobile components
import { MobilePositiveEV } from "@/components/positive-ev/mobile";

// Sportsbooks and markets
import { X } from "lucide-react";
import { useAvailableMarkets, FALLBACK_MARKETS } from "@/hooks/use-available-markets";
import { usePositiveEvPreferences, useEvPreferences } from "@/context/preferences-context";
import { UnifiedFilters, type PositiveEVSettings, type FilterChangeEvent } from "@/components/shared/unified-filters";
import { UnifiedFilterBar } from "@/components/shared/filter-bar";
import { Checkbox } from "@/components/ui/checkbox";

// Constants
const AVAILABLE_SPORTS = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb"];
const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5, 10];

// Loading messages for +EV finder
const EV_LOADING_MESSAGES = [
  "De-vigging sharp lines...",
  "Calculating fair probabilities...",
  "Finding +EV opportunities...",
  "Comparing to Pinnacle...",
  "Analyzing market edges...",
  "Scanning sportsbooks...",
];

/**
 * Format timestamp as relative time (e.g., "5s ago", "2m ago")
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Format EV percentage with color coding and intensity scaling
 * Higher EV = more intense/saturated colors
 */
function formatEVPercent(ev: number): { text: string; color: string; bgClass: string; accentClass: string; tier: "elite" | "great" | "good" | "solid" } {
  const text = `+${ev.toFixed(1)}%`;
  
  // Elite tier: 15%+ (rare, exceptional)
  if (ev >= 15) return { 
    text, 
    color: "text-emerald-800 dark:text-emerald-300", 
    bgClass: "bg-emerald-200 dark:bg-emerald-800/50",
    accentClass: "border-l-emerald-500",
    tier: "elite"
  };
  // Great tier: 8-15% (very good)
  if (ev >= 8) return { 
    text, 
    color: "text-emerald-700 dark:text-emerald-400", 
    bgClass: "bg-emerald-100 dark:bg-emerald-900/40",
    accentClass: "border-l-emerald-400",
    tier: "great"
  };
  // Good tier: 4-8% (solid)
  if (ev >= 4) return { 
    text, 
    color: "text-green-700 dark:text-green-400", 
    bgClass: "bg-green-100/80 dark:bg-green-900/30",
    accentClass: "border-l-green-400",
    tier: "good"
  };
  // Solid tier: <4% (standard)
  return { 
    text, 
    color: "text-sky-700 dark:text-sky-400", 
    bgClass: "bg-sky-100/80 dark:bg-sky-900/30",
    accentClass: "border-l-sky-400",
    tier: "solid"
  };
}

/**
 * Format American odds with sign
 */
function formatOdds(price: number): string {
  return price >= 0 ? `+${price}` : `${price}`;
}

/**
 * Convert fair probability to American odds
 */
function fairProbToAmerican(prob: number): string {
  if (prob <= 0 || prob >= 1) return "—";
  // Convert probability to American odds
  if (prob >= 0.5) {
    // Favorite: negative odds
    const american = Math.round(-100 * prob / (1 - prob));
    return `${american}`;
  } else {
    // Underdog: positive odds
    const american = Math.round(100 * (1 - prob) / prob);
    return `+${american}`;
  }
}

/**
 * Get team logo URL
 */
function getTeamLogoUrl(teamName: string, sport: string): string {
  if (!teamName) return "";
  const abbr = getStandardAbbreviation(teamName, sport);
  const logoSport = sport.toLowerCase() === "ncaab" ? "ncaaf" : sport;
  return `/team-logos/${logoSport}/${abbr.toUpperCase()}.svg`;
}

/**
 * Check if sport has team logos
 */
function hasTeamLogos(sportKey: string): boolean {
  const sportsWithLogos = ["nfl", "nhl", "nba", "ncaaf", "ncaab"];
  return sportsWithLogos.includes(sportKey.toLowerCase());
}

/**
 * Helper to choose link based on device
 */
function chooseBookLink(desktop?: string | null, mobile?: string | null, fallback?: string | null): string | undefined {
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? (mobile || desktop || fallback || undefined) : (desktop || mobile || fallback || undefined);
}

/**
 * Get sportsbook logo
 */
function getBookLogo(bookId?: string) {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || sb?.image?.long || null;
}

/**
 * Get sportsbook name
 */
function getBookName(bookId?: string) {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
}

/**
 * Calculate boosted EV percentage
 * Applies profit boost to odds, then recalculates EV
 */
function calculateBoostedEV(
  baseEV: number, 
  decimalOdds: number, 
  fairProb: number, 
  boostPercent: number
): number {
  if (boostPercent <= 0) return baseEV;
  
  // Apply boost to decimal odds
  const boostedOdds = applyBoostToDecimalOdds(decimalOdds, boostPercent);
  
  // Recalculate EV with boosted odds
  // EV% = (fairProb × boostedOdds - 1) × 100
  const boostedEV = (fairProb * boostedOdds - 1) * 100;
  
  return boostedEV;
}

/**
 * Get fallback URL for book
 */
function getBookFallbackUrl(bookId?: string): string | undefined {
  if (!bookId) return undefined;
  const sb = getSportsbookById(bookId);
  if (!sb) return undefined;
  const base = (sb.affiliate && sb.affiliateLink) ? sb.affiliateLink : (sb.links?.desktop || undefined);
  if (!base) return undefined;
  if (sb.requiresState && base.includes("{state}")) return base.replace(/\{state\}/g, "nj");
  return base;
}

export default function PositiveEVPage() {
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
  const isMobile = useIsMobile();
  const stablePlanRef = useRef(isPro);

  useEffect(() => {
    if (!planLoading) {
      stablePlanRef.current = isPro;
    }
  }, [planLoading, isPro]);

  const effectiveIsPro = planLoading ? stablePlanRef.current : isPro;
  const locked = !effectiveIsPro;
  
  // Debug logging for lock status
  useEffect(() => {
    console.log('[Devig] Lock status:', { isPro, planLoading, effectiveIsPro, locked });
  }, [isPro, planLoading, effectiveIsPro, locked]);

  // Get saved preferences
  const { filters: savedFilters, updateFilters: updateSavedFilters, isLoading: prefsLoading } = usePositiveEvPreferences();
  
  // Get EV preferences (bankroll, kelly %) for stake calculation
  const { filters: evPrefs, updateFilters: updateEvPrefs } = useEvPreferences();
  const bankroll = evPrefs.bankroll || 0;
  const kellyPercent = evPrefs.kellyPercent || 25;
  const showStakeColumn = bankroll > 0;
  
  // Total column count (base 10 + stake column if shown)
  const totalColumns = showStakeColumn ? 11 : 10;
  
  // Dynamically fetch available markets
  const { data: marketsData } = useAvailableMarkets(AVAILABLE_SPORTS);
  const availableMarkets = useMemo(() => {
    return marketsData?.markets && marketsData.markets.length > 0 
      ? marketsData.markets 
      : FALLBACK_MARKETS;
  }, [marketsData?.markets]);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(100);
  const [showMethodInfo, setShowMethodInfo] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [boostPercent, setBoostPercent] = useState(0); // Profit boost %
  
  // Sorting state for table columns
  const [sortColumn, setSortColumn] = useState<"ev" | "time" | "stake" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Toggle sort column
  const handleSort = useCallback((column: "ev" | "time" | "stake") => {
    if (sortColumn === column) {
      // Toggle direction or clear if already desc
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn, sortDirection]);
  
  // Player quick view modal state (for NBA hit rates)
  const [selectedPlayer, setSelectedPlayer] = useState<{
    odds_player_id: string;
    player_name: string;
    market: string;
    event_id: string;
    line?: number;
    odds?: {
      over?: { price: number; line: number; book?: string; mobileLink?: string | null };
      under?: { price: number; line: number; book?: string; mobileLink?: string | null };
    };
  } | null>(null);
  
  // Prefetch player data on hover
  const prefetchPlayer = usePrefetchPlayerByOddsId();
  
  // Disable auto-refresh if not pro
  useEffect(() => {
    if (!effectiveIsPro) {
      setAutoRefresh(false);
    }
  }, [effectiveIsPro]);
  
  // Debug logging
  useEffect(() => {
    console.log('[Devig] Preferences:', { 
      prefsLoading, 
      sharpPreset: savedFilters.sharpPreset,
      selectedSports: savedFilters.selectedSports,
    });
  }, [prefsLoading, savedFilters]);
  
  // Handler for filters change from UnifiedFilters component
  const handleFiltersChange = useCallback((filters: FilterChangeEvent) => {
    // Build update object - only include defined values
    const updates: Parameters<typeof updateSavedFilters>[0] = {};
    
    if (filters.selectedBooks !== undefined) updates.selectedBooks = filters.selectedBooks;
    if (filters.selectedSports !== undefined) updates.selectedSports = filters.selectedSports;
    if (filters.selectedMarkets !== undefined) updates.selectedMarkets = filters.selectedMarkets;
    if (filters.sharpPreset !== undefined) updates.sharpPreset = filters.sharpPreset;
    if (filters.devigMethods !== undefined) updates.devigMethods = filters.devigMethods;
    if (filters.evCase !== undefined) (updates as any).evCase = filters.evCase;
    if (filters.minEv !== undefined) updates.minEv = filters.minEv;
    if (filters.maxEv !== undefined) updates.maxEv = filters.maxEv;
    if (filters.mode !== undefined) updates.mode = filters.mode;
    // minBooksPerSide is passed separately if the context supports it
    if (filters.minBooksPerSide !== undefined) {
      (updates as any).minBooksPerSide = filters.minBooksPerSide;
    }
    if (filters.minLiquidity !== undefined) {
      (updates as any).minLiquidity = filters.minLiquidity;
    }
    if (filters.showHidden !== undefined) {
      (updates as any).showHidden = filters.showHidden;
    }
    
    console.log('[PositiveEV Page] handleFiltersChange - updates:', updates);
    updateSavedFilters(updates);
  }, [updateSavedFilters]);

  // Favorites hook
  const { toggleFavorite, isFavorited, isToggling: isTogglingAny } = useFavorites();
  
  // Track which row is being toggled
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Hidden edges hook
  const { hideEdge, unhideEdge, isHidden, hiddenCount } = useHiddenEdges();
  
  // Show hidden opportunities - use preference value
  const showHidden = savedFilters.showHidden;

  // Count active filters for the pills display
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (savedFilters.selectedBooks.length > 0) count++;
    if (savedFilters.selectedMarkets.length > 0) count++;
    if (savedFilters.maxEv) count++;
    // Check if devigMethods differs from default
    const defaultMethods = ['power', 'multiplicative'];
    const currentMethods = savedFilters.devigMethods || defaultMethods;
    const methodsChanged = currentMethods.length !== defaultMethods.length || 
      !currentMethods.every(m => defaultMethods.includes(m));
    if (methodsChanged) count++;
    return count;
  }, [savedFilters.selectedBooks, savedFilters.selectedMarkets, savedFilters.maxEv, savedFilters.devigMethods]);

  // Memoize filters object
  const filters = useMemo(() => {
    const f = {
      sports: savedFilters.selectedSports,
      sharpPreset: savedFilters.sharpPreset as SharpPreset,
      devigMethods: savedFilters.devigMethods as DevigMethod[] || DEFAULT_DEVIG_METHODS,
      minEV: savedFilters.minEv,
      maxEV: savedFilters.maxEv,
      books: savedFilters.selectedBooks.length > 0 ? savedFilters.selectedBooks : null,
      markets: savedFilters.selectedMarkets.length > 0 ? savedFilters.selectedMarkets : null,
      limit,
      mode: savedFilters.mode,
      minBooksPerSide: savedFilters.minBooksPerSide,
    };
    console.log('[Devig] Filters object updated:', f);
    return f;
  }, [savedFilters, limit]);

  // Standard fetch (used when auto-refresh is disabled)
  const {
    opportunities: standardData,
    totalFound: standardTotalFound,
    totalReturned: standardTotalReturned,
    isLoading: standardIsLoading,
    isFetching: standardIsFetching,
    error: standardError,
    refetch: standardRefetch,
    freshRefetch: standardFreshRefetch,
    dataUpdatedAt: standardDataUpdatedAt,
  } = usePositiveEV({
    filters,
    isPro: effectiveIsPro,
    enabled: !planLoading && !prefsLoading && !autoRefresh, // Don't fetch if auto-refresh is enabled
  });

  // Streaming hook (used when auto-refresh is enabled)
  const {
    rows: streamRows,
    changes: streamChanges,
    added: streamAdded,
    stale: streamStale,
    loading: streamLoading,
    connected: streamConnected,
    isReconnecting: streamIsReconnecting,
    hasFailed: streamHasFailed,
    lastUpdated: streamLastUpdated,
    error: streamError,
    refresh: streamRefresh,
    reconnect: streamReconnect,
    meta: streamMeta,
  } = usePositiveEVStream({
    filters,
    isPro: effectiveIsPro,
    autoRefresh,
    enabled: !planLoading && !prefsLoading && autoRefresh,
  });

  // Unified data access - use stream when auto-refresh is on, otherwise use standard
  // SMART FALLBACK: Keep showing previous data during mode transitions to avoid jarring skeleton
  const data = useMemo(() => {
    if (autoRefresh) {
      // Prefer stream data, but fallback to standard during initial stream load
      return streamRows.length > 0 ? streamRows : (standardData || []);
    } else {
      // Prefer standard data, but fallback to stream during initial standard load
      return (standardData && standardData.length > 0) ? standardData : streamRows;
    }
  }, [autoRefresh, streamRows, standardData]);
  
  const totalFound = autoRefresh ? streamMeta.totalFound : standardTotalFound;
  const totalReturned = autoRefresh ? streamMeta.returned : standardTotalReturned;
  
  // Only show loading skeleton when NEITHER source has data (first load only)
  const isLoading = autoRefresh 
    ? (streamLoading && streamRows.length === 0 && (!standardData || standardData.length === 0))
    : (standardIsLoading && (!standardData || standardData.length === 0) && streamRows.length === 0);
  
  const isFetching = autoRefresh ? false : standardIsFetching;
  const error = autoRefresh ? (streamError ? new Error(streamError) : null) : standardError;
  const refetch = autoRefresh ? streamRefresh : standardRefetch;
  // Use freshRefetch for manual refresh button (bypasses server cache)
  const baseFreshRefetch = autoRefresh ? streamRefresh : standardFreshRefetch;
  const dataUpdatedAt = autoRefresh ? streamLastUpdated : standardDataUpdatedAt;
  
  // Local state for manual refresh spinning
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  
  // Wrapped freshRefetch that tracks loading state
  const freshRefetch = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await baseFreshRefetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [baseFreshRefetch]);
  
  // Combined fetching state for UI
  const isRefreshing = isFetching || isManualRefreshing || (autoRefresh && streamLoading);

  // Toggle sport selection
  const toggleSport = useCallback((sport: string) => {
    const current = savedFilters.selectedSports;
    const next = current.includes(sport)
      ? (current.length > 1 ? current.filter(s => s !== sport) : current)
      : [...current, sport];
    updateSavedFilters({ selectedSports: next });
  }, [savedFilters.selectedSports, updateSavedFilters]);

  // Track expanded rows for all books view
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Track pinned positions for expanded rows (stores index when row was expanded)
  const [pinnedPositions, setPinnedPositions] = useState<Map<string, number>>(new Map());
  
  // Track expanded rows that have had odds changes (persists until dismissed)
  const [oddsChangedRows, setOddsChangedRows] = useState<Set<string>>(new Set());
  
  // Filter opportunities by search and handle pinning expanded rows
  // Pinned rows stay at their position during auto-refresh
  const filteredOpportunities = useMemo(() => {
    if (!data) return [];
    
    // First, apply search filter
    let filtered = data;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = data.filter((opp) => 
        opp.playerName?.toLowerCase().includes(query) ||
        opp.playerTeam?.toLowerCase().includes(query) ||
        opp.market?.toLowerCase().includes(query) ||
        opp.homeTeam?.toLowerCase().includes(query) ||
        opp.awayTeam?.toLowerCase().includes(query)
      );
    }
    
    // Filter out hidden opportunities (unless showHidden is true)
    if (!showHidden) {
      filtered = filtered.filter((opp) => !isHidden(opp.id));
    }
    
    // Min liquidity filter - filter out opportunities where best book's max stake is below threshold
    const minLiquidity = savedFilters.minLiquidity ?? 0;
    if (minLiquidity > 0) {
      filtered = filtered.filter((opp) => {
        const maxStake = opp.book.limits?.max;
        // If limits are unknown (null/undefined), include the opportunity
        if (maxStake == null) return true;
        // Otherwise, only include if max stake meets threshold
        return maxStake >= minLiquidity;
      });
    }
    
    // If no expanded rows, return as-is (normal sort order)
    if (expandedRows.size === 0) {
      return filtered;
    }
    
    // Separate pinned (expanded) rows from unpinned rows
    const pinnedRows: Array<{ opp: typeof filtered[0]; pinnedIndex: number }> = [];
    const unpinnedRows: typeof filtered = [];
    
    for (const opp of filtered) {
      if (expandedRows.has(opp.id)) {
        const pinnedIndex = pinnedPositions.get(opp.id) ?? -1;
        if (pinnedIndex >= 0) {
          pinnedRows.push({ opp, pinnedIndex });
        } else {
          // Expanded but no pinned position yet (shouldn't happen, but handle gracefully)
          unpinnedRows.push(opp);
        }
      } else {
        unpinnedRows.push(opp);
      }
    }
    
    // If no pinned rows, return filtered as-is
    if (pinnedRows.length === 0) {
      return filtered;
    }
    
    // Sort pinned rows by their pinned index
    pinnedRows.sort((a, b) => a.pinnedIndex - b.pinnedIndex);
    
    // Rebuild the list with pinned rows at their positions
    const result: typeof filtered = [];
    let unpinnedIndex = 0;
    let pinnedIdx = 0;
    
    // Calculate max position we need to fill
    const maxPinnedIndex = Math.max(...pinnedRows.map(p => p.pinnedIndex));
    const totalLength = Math.max(maxPinnedIndex + 1, unpinnedRows.length + pinnedRows.length);
    
    for (let i = 0; i < totalLength && (unpinnedIndex < unpinnedRows.length || pinnedIdx < pinnedRows.length); i++) {
      // Check if there's a pinned row at this position
      if (pinnedIdx < pinnedRows.length && pinnedRows[pinnedIdx].pinnedIndex === i) {
        result.push(pinnedRows[pinnedIdx].opp);
        pinnedIdx++;
      } else if (unpinnedIndex < unpinnedRows.length) {
        result.push(unpinnedRows[unpinnedIndex]);
        unpinnedIndex++;
      }
    }
    
    // Add any remaining unpinned rows
    while (unpinnedIndex < unpinnedRows.length) {
      result.push(unpinnedRows[unpinnedIndex]);
      unpinnedIndex++;
    }
    
    return result;
  }, [data, searchQuery, expandedRows, pinnedPositions, showHidden, isHidden, savedFilters.minLiquidity]);
  
  // Apply sorting to filtered opportunities
  const sortedOpportunities = useMemo(() => {
    if (!sortColumn || filteredOpportunities.length === 0) {
      return filteredOpportunities;
    }
    
    const sorted = [...filteredOpportunities].sort((a, b) => {
      let comparison = 0;
      const evCaseLocal = savedFilters.evCase as "worst" | "best";
      
      if (sortColumn === "ev") {
        // Sort by EV percentage
        const evA = evCaseLocal === "best" ? a.evCalculations.evBest : a.evCalculations.evWorst;
        const evB = evCaseLocal === "best" ? b.evCalculations.evBest : b.evCalculations.evWorst;
        comparison = (evA || 0) - (evB || 0);
      } else if (sortColumn === "time") {
        // Sort by start time
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortColumn === "stake") {
        // Sort by kelly stake value
        const getStake = (opp: typeof a) => {
          const evPercent = evCaseLocal === "best" 
            ? opp.evCalculations.evBest 
            : opp.evCalculations.evWorst;
          if (!evPercent || bankroll <= 0) return 0;
          const decimalOdds = opp.book.price > 0 
            ? (opp.book.price / 100) + 1 
            : (100 / Math.abs(opp.book.price)) + 1;
          const p = 1 / decimalOdds + (evPercent / 100);
          const b = decimalOdds - 1;
          const q = 1 - p;
          const kellyFraction = Math.max(0, (p * b - q) / b);
          return Math.round(bankroll * kellyFraction * (kellyPercent / 100));
        };
        comparison = getStake(a) - getStake(b);
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredOpportunities, sortColumn, sortDirection, savedFilters.evCase, bankroll, kellyPercent]);
  
  // When streaming changes occur on expanded rows, mark them as oddsChanged
  useEffect(() => {
    if (!autoRefresh || streamChanges.size === 0) return;
    
    // Find any expanded rows that have changes
    const changedExpandedRows: string[] = [];
    for (const [id] of streamChanges) {
      if (expandedRows.has(id)) {
        changedExpandedRows.push(id);
      }
    }
    
    if (changedExpandedRows.length > 0) {
      setOddsChangedRows(prev => {
        const next = new Set(prev);
        for (const id of changedExpandedRows) {
          next.add(id);
        }
        return next;
      });
    }
  }, [streamChanges, expandedRows, autoRefresh]);
  
  // Loading message rotation
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  useEffect(() => {
    if (!isLoading && !isFetching) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % EV_LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading, isFetching]);

  // Toggle row expansion with pinning support
  // When expanding, we pin the row at its current index so it doesn't move during auto-refresh
  // When collapsing, we unpin it and it returns to its natural sorted position
  const toggleRow = useCallback((id: string, currentIndex?: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Collapsing - clear pinned position
        next.delete(id);
        setPinnedPositions((pins) => {
          const nextPins = new Map(pins);
          nextPins.delete(id);
          return nextPins;
        });
        // Clear oddsChanged state when collapsing
        setOddsChangedRows((oc) => {
          const nextOc = new Set(oc);
          nextOc.delete(id);
          return nextOc;
        });
      } else {
        // Expanding - pin at current position
        next.add(id);
        if (currentIndex !== undefined && currentIndex >= 0) {
          setPinnedPositions((pins) => {
            const nextPins = new Map(pins);
            nextPins.set(id, currentIndex);
            return nextPins;
          });
        }
      }
      return next;
    });
  }, []);
  
  // Dismiss odds changed state without collapsing
  const dismissOddsChanged = useCallback((id: string) => {
    setOddsChangedRows((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(async (opp: PositiveEVOpportunity) => {
    setTogglingId(opp.id);
    
    try {
      const oddsKey = `odds:${opp.sport}:${opp.eventId}:${opp.market}`;
      const oddsSelectionId = `${opp.playerName?.toLowerCase().replace(/\s+/g, "_")}|${opp.side}|${opp.line}`;
      
      // Build books snapshot from allBooks
      const booksSnapshot: Record<string, { price: number; u: string | null; m: string | null; sgp: string | null }> = {};
      opp.allBooks.forEach((book) => {
        booksSnapshot[book.bookId] = {
          price: book.price,
          u: book.link || null,
          m: book.mobileLink || null,
          sgp: book.sgp || null,
        };
      });

      await toggleFavorite({
        type: opp.playerId ? "player" : "game",
        sport: opp.sport,
        event_id: opp.eventId,
        game_date: opp.startTime ? new Date(opp.startTime).toISOString().split("T")[0] : undefined,
        home_team: opp.homeTeam,
        away_team: opp.awayTeam,
        start_time: opp.startTime,
        player_id: opp.playerId,
        player_name: opp.playerName,
        player_team: opp.playerTeam,
        player_position: opp.playerPosition,
        market: opp.market,
        line: opp.line,
        side: opp.side,
        odds_key: oddsKey,
        odds_selection_id: oddsSelectionId,
        books_snapshot: booksSnapshot,
        best_price_at_save: opp.book.price,
        best_book_at_save: opp.book.bookId,
        source: "positive_ev",
      });
    } finally {
      setTogglingId(null);
    }
  }, [toggleFavorite]);
  
  // Open bet link (uses mobile link on mobile devices)
  const openLink = useCallback((bookId?: string, link?: string | null, mobileLink?: string | null) => {
    const fallback = getBookFallbackUrl(bookId);
    const target = chooseBookLink(link ?? undefined, mobileLink ?? undefined, fallback ?? undefined);
    if (!target) return;
    try {
      window.open(target, "_blank", "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes");
    } catch { void 0; }
  }, []);

  if (planLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState message="Loading Positive EV Finder..." />
      </div>
    );
  }

  // Mobile View - Full-screen app-like experience
  if (isMobile) {
    return (
      <>
        <MobilePositiveEV
          opportunities={sortedOpportunities}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          onRefresh={freshRefetch}
          onPlayerClick={(opp) => {
            // Only show modal for NBA player props
            if (opp.sport === "nba" && opp.playerId && opp.playerName) {
              setSelectedPlayer({
                odds_player_id: opp.playerId,
                player_name: opp.playerName,
                market: opp.market,
                event_id: opp.eventId,
                line: opp.line,
                odds: {
                  [opp.side]: {
                    price: opp.book.price,
                    line: opp.line,
                    book: opp.book.bookId,
                    mobileLink: opp.book.mobileLink,
                  },
                },
              });
            }
          }}
          onHideEdge={(opp) => hideEdge({ edgeKey: opp.id, eventId: opp.eventId, sport: opp.sport, playerName: opp.playerName })}
          onUnhideEdge={unhideEdge}
          isHidden={isHidden}
          bankroll={evPrefs.bankroll}
          kellyPercent={evPrefs.kellyPercent}
          isPro={effectiveIsPro}
          dataUpdatedAt={dataUpdatedAt ?? undefined}
          sharpPreset={(savedFilters.sharpPreset as SharpPreset) ?? "pinnacle"}
          devigMethods={(savedFilters.devigMethods as DevigMethod[]) ?? ["power", "multiplicative"]}
          evCase={savedFilters.evCase ?? "worst"}
          mode={savedFilters.mode ?? "pregame"}
          onSharpPresetChange={(preset) => updateSavedFilters({ sharpPreset: preset })}
          onDevigMethodsChange={(methods) => updateSavedFilters({ devigMethods: methods })}
          onEvCaseChange={(evCase) => updateSavedFilters({ evCase } as any)}
          onModeChange={(mode) => updateSavedFilters({ mode })}
          boostPercent={boostPercent}
          onBoostChange={setBoostPercent}
          onBankrollChange={(value) => updateEvPrefs({ bankroll: value })}
          onKellyPercentChange={(value) => updateEvPrefs({ kellyPercent: value })}
          hiddenCount={hiddenCount}
          showHidden={showHidden}
          onShowHiddenChange={(show) => updateSavedFilters({ showHidden: show } as any)}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          streamConnected={streamConnected}
        />
        
        {/* Player Quick View Modal (NBA Hit Rates) - Mobile */}
        {selectedPlayer && (
          <PlayerQuickViewModal
            odds_player_id={selectedPlayer.odds_player_id}
            player_name={selectedPlayer.player_name}
            initial_market={selectedPlayer.market}
            initial_line={selectedPlayer.line}
            event_id={selectedPlayer.event_id}
            odds={selectedPlayer.odds ?? undefined}
            open={!!selectedPlayer}
            onOpenChange={(open) => {
              if (!open) setSelectedPlayer(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <ToolHeading>Positive EV</ToolHeading>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ToolSubheading>
              {isLoading
                ? "Loading +EV opportunities..."
                : isFetching
                ? "Updating..."
                : `${sortedOpportunities.length}+ opportunities found`}
            </ToolSubheading>
            {/* Method info badge */}
            <button
              onClick={() => setShowMethodInfo(!showMethodInfo)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Power + Multiplicative</span>
              <Info className="w-3 h-3 opacity-60" />
            </button>
          </div>
          {/* Freshness Indicator */}
          {dataUpdatedAt && !isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              {autoRefresh && streamConnected && (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-green-600 dark:text-green-400">Live</span>
                  <span className="mx-1 text-neutral-300 dark:text-neutral-600">•</span>
                </>
              )}
              <span>Updated {formatTimeAgo(dataUpdatedAt)}</span>
              {(isFetching || (autoRefresh && streamIsReconnecting)) && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unified Filter Bar */}
      <UnifiedFilterBar
        tool="positive-ev"
        className="mb-5"
        // Mode
        mode={savedFilters.mode}
        onModeChange={(mode) => updateSavedFilters({ mode })}
        // Search
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        // Boost
        boostPercent={boostPercent}
        onBoostChange={setBoostPercent}
        // Sports
        selectedSports={savedFilters.selectedSports}
        onSportsChange={(sports) => updateSavedFilters({ selectedSports: sports })}
        availableSports={AVAILABLE_SPORTS}
        // Markets
        selectedMarkets={savedFilters.selectedMarkets}
        onMarketsChange={(markets) => updateSavedFilters({ selectedMarkets: markets })}
        availableMarkets={availableMarkets.map(m => ({ key: m, label: formatMarketLabelShort(m) }))}
        // Sportsbooks
        selectedBooks={savedFilters.selectedBooks}
        onBooksChange={(books) => updateSavedFilters({ selectedBooks: books })}
        sportsbookCounts={(() => {
          const counts: Record<string, number> = {};
          data.forEach((opp) => {
            const bookId = opp.book.bookId;
            counts[bookId] = (counts[bookId] || 0) + 1;
          });
          return counts;
        })()}
        // Sharp preset (Comparing Against)
        sharpPreset={savedFilters.sharpPreset as SharpPreset}
        onSharpPresetChange={(preset) => updateSavedFilters({ sharpPreset: preset })}
        // De-vig methods
        devigMethods={savedFilters.devigMethods as DevigMethod[]}
        onDevigMethodsChange={(methods) => updateSavedFilters({ devigMethods: methods })}
        evCase={savedFilters.evCase as "worst" | "best"}
        onEvCaseChange={(evCase) => updateSavedFilters({ evCase } as any)}
        // Global settings
        minEv={savedFilters.minEv}
        onMinEvChange={(minEv) => updateSavedFilters({ minEv })}
        maxEv={savedFilters.maxEv}
        onMaxEvChange={(maxEv) => updateSavedFilters({ maxEv })}
        minBooksPerSide={savedFilters.minBooksPerSide}
        onMinBooksPerSideChange={(minBooksPerSide) => updateSavedFilters({ minBooksPerSide } as any)}
        minLiquidity={savedFilters.minLiquidity ?? 0}
        onMinLiquidityChange={(minLiquidity) => updateSavedFilters({ minLiquidity } as any)}
        // Kelly
        bankroll={evPrefs.bankroll}
        kellyPercent={evPrefs.kellyPercent}
        onBankrollChange={(value) => updateEvPrefs({ bankroll: value })}
        onKellyPercentChange={(value) => updateEvPrefs({ kellyPercent: value })}
        // Hidden
        showHidden={showHidden}
        hiddenCount={hiddenCount}
        onToggleShowHidden={() => handleFiltersChange({ showHidden: !showHidden })}
        // Auto refresh
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        isConnected={streamConnected}
        isReconnecting={streamIsReconnecting}
        hasFailed={streamHasFailed}
        // Refresh
        onRefresh={freshRefetch}
        isRefreshing={isRefreshing}
        // Reset
        onReset={() => {
          updateSavedFilters({
            mode: "pregame",
            selectedSports: AVAILABLE_SPORTS,
            selectedBooks: [],
            selectedMarkets: [],
            sharpPreset: "pinnacle",
            devigMethods: ["power", "multiplicative"],
            evCase: "worst",
            minEv: 0,
            maxEv: undefined,
            minBooksPerSide: 2,
            minLiquidity: 0,
          } as any);
          setBoostPercent(0);
          setSearchQuery("");
        }}
        // UI state
        locked={locked}
        isPro={effectiveIsPro}
      />

      {/* Method Info Panel */}
      <AnimatePresence>
        {showMethodInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-2">De-Vig Methods</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                <div>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">Power Method</p>
                  <p>Finds an exponent k to renormalize probabilities. Handles favorite/longshot bias better than simple rescaling.</p>
                </div>
                <div>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">Multiplicative Method</p>
                  <p>Rescales implied probabilities proportionally to sum to 1. Simple, stable baseline for most player props.</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                <strong>Worst-case EV</strong> is shown by default (minimum across both methods) for conservative estimates.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Active Filters Pills - Show only important/meaningful filters */}
      {(savedFilters.maxEv || savedFilters.selectedMarkets.length > 0 || boostPercent > 0 || (savedFilters.devigMethods && savedFilters.devigMethods.length !== 2)) && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mr-1">Active:</span>
          
          {savedFilters.maxEv && (
            <button
              onClick={() => updateSavedFilters({ maxEv: undefined })}
              className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            >
              Max {savedFilters.maxEv}%
              <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          )}
          
          {savedFilters.selectedMarkets.length > 0 && (
            <button
              onClick={() => updateSavedFilters({ selectedMarkets: [] })}
              className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              {savedFilters.selectedMarkets.length} Market{savedFilters.selectedMarkets.length > 1 ? "s" : ""}
              <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          )}
          
          {/* De-vig methods pill - show if not default */}
          {(() => {
            const defaultMethods = ['power', 'multiplicative'];
            const currentMethods = savedFilters.devigMethods || defaultMethods;
            const methodsChanged = currentMethods.length !== defaultMethods.length || 
              !currentMethods.every(m => defaultMethods.includes(m));
            return methodsChanged ? (
              <button
                onClick={() => updateSavedFilters({ devigMethods: ['power', 'multiplicative'] })}
                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                {currentMethods.map(m => m.charAt(0).toUpperCase()).join("+")} Devig
                <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </button>
            ) : null;
          })()}

          {/* Boost pill */}
          {boostPercent > 0 && (
            <button
              onClick={() => setBoostPercent(0)}
              className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300/50 dark:border-amber-700/50 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <Zap className="w-3 h-3" />
              +{boostPercent}% Boost
              <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            </button>
          )}
          
          <button
            onClick={() => {
              updateSavedFilters({
                selectedMarkets: [],
                maxEv: undefined,
                devigMethods: ['power', 'multiplicative'],
              });
              setBoostPercent(0);
            }}
            className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive mb-6">
          Error: {error.message}
        </div>
      )}

      {/* Results Table - Premium Design */}
      <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-sm">
        <table className="min-w-full text-sm table-fixed">
          <colgroup><col style={{ width: 100 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 190 }} /><col style={{ width: 70 }} /><col style={{ width: 130 }} /><col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} />{showStakeColumn && <col style={{ width: 85 }} />}<col style={{ width: 120 }} /></colgroup>
          <thead className="sticky top-0 z-[5]">
            <tr className="bg-gradient-to-r from-neutral-50 via-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800/50">
              <th 
                className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                onClick={() => handleSort("ev")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span>EV %</span>
                  {sortColumn === "ev" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
                    )
                  ) : (
                    <Tooltip content="Expected Value % based on de-vigged fair probability. Worst-case (conservative) shown by default.">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                        <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                      </svg>
                    </Tooltip>
                  )}
                </div>
              </th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">League</th>
              <th 
                className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                onClick={() => handleSort("time")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Time</span>
                  {sortColumn === "time" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Selection</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Line</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Market</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Best Book</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-center gap-1.5">
                  <span>Sharp</span>
                  <Tooltip content="Sharp reference odds used for de-vigging (e.g., Pinnacle).">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-center gap-1.5">
                  <span>Fair</span>
                  <Tooltip content="De-vigged fair odds (no-vig true probability). Calculated using the Power method by default. Hover over EV% to see all method calculations.">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              {showStakeColumn && (
                <th 
                  className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                  onClick={() => handleSort("stake")}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Stake</span>
                    {sortColumn === "stake" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
                      )
                    ) : (
                      <Tooltip content={`Recommended bet size using Kelly Criterion (${kellyPercent}% Kelly). Based on your bankroll of $${bankroll.toLocaleString()}.`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                          <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                        </svg>
                      </Tooltip>
                    )}
                  </div>
                </th>
              )}
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading State */}
            {isLoading && (
              <>
                {/* Loading message row */}
                <tr>
                  <td colSpan={totalColumns} className="p-0">
                    <div className="flex items-center justify-center py-4 bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/50 dark:from-emerald-950/20 dark:via-neutral-900 dark:to-emerald-950/20">
                      <div className="flex items-center gap-3">
                        <div className="relative w-5 h-5">
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-200 dark:border-emerald-800" />
                          <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={loadingMessageIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.25 }}
                            className="text-sm font-medium text-neutral-600 dark:text-neutral-400"
                          >
                            {EV_LOADING_MESSAGES[loadingMessageIndex]}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  </td>
                </tr>
                {/* Skeleton rows */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr 
                    key={`skeleton-${i}`} 
                    className={cn(
                      i % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-100/70 dark:bg-neutral-800/40"
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-14 h-7 rounded-lg bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-16 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="space-y-1.5">
                        <div className="w-12 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-16 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="space-y-2">
                        <div className="w-32 h-5 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-24 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-14 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="w-20 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-14 h-6 rounded bg-emerald-100 dark:bg-emerald-900/30 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-5 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-8 h-2 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-12 h-5 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                    {/* Stake column skeleton (conditional) */}
                    {showStakeColumn && (
                      <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                        <div className="flex justify-center">
                          <div className="w-16 h-5 rounded bg-amber-100 dark:bg-amber-900/30 animate-pulse" />
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex justify-center gap-2">
                        <div className="w-14 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 animate-pulse" />
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && sortedOpportunities.length === 0 && (
              <tr>
                <td colSpan={totalColumns}>
                  <div className="flex flex-col items-center justify-center py-20 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center mb-5 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50">
                      <TrendingUp className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1.5">
                      No +EV opportunities found
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
                      Try lowering your minimum EV threshold, selecting more sports, or check back later for new opportunities.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {!isLoading && sortedOpportunities.map((opp, index) => {
              // Get base EV based on evCase setting (worst or best)
              // The API returns evWorst, evBest, and evDisplay - we use evCase to select
              const evCase = savedFilters.evCase as "worst" | "best";
              const baseEV = evCase === "best" 
                ? opp.evCalculations.evBest 
                : opp.evCalculations.evWorst;
              
              // Calculate boosted EV if boost is active
              const decimalOdds = opp.book.priceDecimal || 
                (opp.book.price > 0 ? 1 + opp.book.price / 100 : 1 + 100 / Math.abs(opp.book.price));
              const fairProbability = opp.evCalculations.power?.fairProb || opp.evCalculations.multiplicative?.fairProb || 0;
              const displayEV = boostPercent > 0 
                ? calculateBoostedEV(baseEV, decimalOdds, fairProbability, boostPercent) 
                : baseEV;
              
              const evFormat = formatEVPercent(displayEV);
              const book = getSportsbookById(opp.book.bookId);
              const isExpanded = expandedRows.has(opp.id);
              const showLogos = hasTeamLogos(opp.sport);
              
              // Streaming state - check if this row has changes, was just added, or is stale
              const isStale = autoRefresh && streamStale.has(opp.id);
              const isNewlyAdded = autoRefresh && streamAdded.has(opp.id);
              const hasChange = autoRefresh && streamChanges.has(opp.id);
              const change = hasChange ? streamChanges.get(opp.id) : undefined;
              
              // Odds changed on expanded row (persists until dismissed)
              const isOddsChanged = oddsChangedRows.has(opp.id);
              
              // Check if this row is hidden (only shown when showHidden is true)
              const isHiddenRow = showHidden && isHidden(opp.id);
              
              // Determine if row should be greyed out (stale or odds changed or hidden)
              const isGreyedOut = isStale || (isExpanded && isOddsChanged) || isHiddenRow;
              
              // If row is stale and not expanded, skip it (will be removed from display)
              if (isStale && !isExpanded) {
                return null;
              }
              
              // Get fair probability and convert to American odds
              const fairProb = opp.evCalculations.power?.fairProb || opp.evCalculations.multiplicative?.fairProb || 0;
              const fairOdds = fairProbToAmerican(fairProb);
              
              // Get all method EV values for tooltip (apply boost if active)
              const methodEVs = {
                power: opp.evCalculations.power?.evPercent !== undefined 
                  ? (boostPercent > 0 
                      ? calculateBoostedEV(opp.evCalculations.power.evPercent, decimalOdds, opp.evCalculations.power.fairProb || 0, boostPercent)
                      : opp.evCalculations.power.evPercent)
                  : undefined,
                multiplicative: opp.evCalculations.multiplicative?.evPercent !== undefined 
                  ? (boostPercent > 0 
                      ? calculateBoostedEV(opp.evCalculations.multiplicative.evPercent, decimalOdds, opp.evCalculations.multiplicative.fairProb || 0, boostPercent)
                      : opp.evCalculations.multiplicative.evPercent)
                  : undefined,
                additive: opp.evCalculations.additive?.evPercent !== undefined 
                  ? (boostPercent > 0 
                      ? calculateBoostedEV(opp.evCalculations.additive.evPercent, decimalOdds, opp.evCalculations.additive.fairProb || 0, boostPercent)
                      : opp.evCalculations.additive.evPercent)
                  : undefined,
                probit: opp.evCalculations.probit?.evPercent !== undefined 
                  ? (boostPercent > 0 
                      ? calculateBoostedEV(opp.evCalculations.probit.evPercent, decimalOdds, opp.evCalculations.probit.fairProb || 0, boostPercent)
                      : opp.evCalculations.probit.evPercent)
                  : undefined,
              };
              const evWorst = boostPercent > 0 
                ? calculateBoostedEV(opp.evCalculations.evWorst, decimalOdds, fairProbability, boostPercent)
                : opp.evCalculations.evWorst;
              const evBest = boostPercent > 0 
                ? calculateBoostedEV(opp.evCalculations.evBest, decimalOdds, fairProbability, boostPercent)
                : opp.evCalculations.evBest;
              
              // Determine which method gave the displayed EV (worst or best based on evCase)
              const displayMethod = evCase === "best"
                ? Object.entries(methodEVs)
                    .filter(([, v]) => v !== undefined)
                    .sort(([, a], [, b]) => (b || 0) - (a || 0))[0]?.[0] || "power" // Best = highest
                : Object.entries(methodEVs)
                    .filter(([, v]) => v !== undefined)
                    .sort(([, a], [, b]) => (a || 0) - (b || 0))[0]?.[0] || "power"; // Worst = lowest
              
              // Format game time
              const gameDate = opp.startTime ? new Date(opp.startTime) : null;
              const isToday = gameDate ? (() => {
                const today = new Date();
                return gameDate.getDate() === today.getDate() &&
                       gameDate.getMonth() === today.getMonth() &&
                       gameDate.getFullYear() === today.getFullYear();
              })() : false;
              const dateStr = gameDate ? (isToday ? "Today" : gameDate.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })) : "TBD";
              const timeStr = gameDate ? gameDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
              
              // Is this favorited?
              const isFav = isFavorited({
                event_id: opp.eventId,
                type: opp.playerId ? "player" : "game",
                player_id: opp.playerId,
                market: opp.market,
                line: opp.line,
                side: opp.side,
              });
              const isTogglingThis = togglingId === opp.id;

              return (
                <React.Fragment key={opp.id}>
                  {/* Stale banner row (shown when row is stale and expanded) */}
                  {isStale && isExpanded && (
                    <tr className="bg-amber-50 dark:bg-amber-900/20">
                      <td colSpan={totalColumns} className="py-2 px-4">
                        <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/>
                          </svg>
                          <span className="text-sm font-medium">This opportunity is no longer available</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(opp.id, index); // Pass index to maintain pinning logic
                            }}
                            className="ml-2 text-xs underline hover:no-underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* Odds changed banner (shown when expanded row has odds changes) */}
                  {!isStale && isExpanded && isOddsChanged && (
                    <tr className="bg-amber-50/80 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/50">
                      <td colSpan={totalColumns} className="py-2 px-4">
                        <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                          </svg>
                          <span className="text-sm font-medium">Odds have changed since you opened this</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissOddsChanged(opp.id);
                            }}
                            className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 rounded hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                          >
                            Got it
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  <tr
                    onClick={() => toggleRow(opp.id, index)}
                    className={cn(
                      "group/row transition-all duration-200 cursor-pointer border-l-4",
                      // EV-based left accent border for quick visual scanning
                      !isGreyedOut && evFormat.accentClass,
                      isGreyedOut && "border-l-neutral-300 dark:border-l-neutral-700",
                      !isGreyedOut && "hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-emerald-50/20 dark:hover:from-emerald-950/40 dark:hover:to-emerald-950/10",
                      index % 2 === 0 
                        ? "bg-white dark:bg-neutral-900" 
                        : "bg-neutral-50/80 dark:bg-neutral-800/30",
                      isExpanded && !isGreyedOut && "!bg-gradient-to-r !from-emerald-50 !to-emerald-50/30 dark:!from-emerald-950/50 dark:!to-emerald-950/20",
                      // Greyed out states (stale, odds changed on expanded, or hidden)
                      isGreyedOut && !isHiddenRow && "opacity-50 bg-neutral-200/50 dark:bg-neutral-800/50",
                      // Hidden row state - more subtle grey
                      isHiddenRow && "opacity-40 bg-neutral-100 dark:bg-neutral-900 cursor-pointer",
                      isStale && "cursor-not-allowed line-through",
                      isOddsChanged && isExpanded && "cursor-default",
                      // Streaming states (only when not greyed out)
                      !isGreyedOut && isNewlyAdded && "ring-2 ring-emerald-400/50 ring-inset bg-emerald-50/50 dark:bg-emerald-900/20",
                      !isGreyedOut && hasChange && change?.ev === "up" && "ring-1 ring-green-400/50 ring-inset",
                      !isGreyedOut && hasChange && change?.ev === "down" && "ring-1 ring-amber-400/50 ring-inset"
                    )}
                  >
                    {/* EV% */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        {/* Pin indicator for expanded rows */}
                        {isExpanded && autoRefresh && (
                          <Tooltip content="Row pinned - won't move during refresh">
                            <Pin className="w-3 h-3 text-emerald-500 dark:text-emerald-400 -rotate-45" />
                          </Tooltip>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(opp.id, index);
                          }}
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shrink-0",
                            "hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 hover:scale-110",
                            "text-neutral-400 dark:text-neutral-500",
                            isExpanded && "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rotate-90"
                          )}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <ChevronRight className="w-4 h-4 transition-transform" />
                        </button>
                        <Tooltip 
                          content={
                            <div className="px-4 py-3 min-w-[180px] space-y-2.5">
                              <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm font-semibold text-neutral-900 dark:text-white">EV by Method</span>
                                {boostPercent > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                    <Zap className="w-3 h-3" />
                                    +{boostPercent}%
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {methodEVs.power !== undefined && (
                                  <div className={cn(
                                    "flex justify-between items-center text-xs",
                                    displayMethod === "power" 
                                      ? "font-semibold text-emerald-600 dark:text-emerald-400" 
                                      : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    <span>Power:</span>
                                    <span className="tabular-nums">+{methodEVs.power.toFixed(2)}%</span>
                                  </div>
                                )}
                                {methodEVs.multiplicative !== undefined && (
                                  <div className={cn(
                                    "flex justify-between items-center text-xs",
                                    displayMethod === "multiplicative" 
                                      ? "font-semibold text-emerald-600 dark:text-emerald-400" 
                                      : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    <span>Multiplicative:</span>
                                    <span className="tabular-nums">+{methodEVs.multiplicative.toFixed(2)}%</span>
                                  </div>
                                )}
                                {methodEVs.additive !== undefined && (
                                  <div className={cn(
                                    "flex justify-between items-center text-xs",
                                    displayMethod === "additive" 
                                      ? "font-semibold text-emerald-600 dark:text-emerald-400" 
                                      : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    <span>Additive:</span>
                                    <span className="tabular-nums">+{methodEVs.additive.toFixed(2)}%</span>
                                  </div>
                                )}
                                {methodEVs.probit !== undefined && (
                                  <div className={cn(
                                    "flex justify-between items-center text-xs",
                                    displayMethod === "probit" 
                                      ? "font-semibold text-emerald-600 dark:text-emerald-400" 
                                      : "text-neutral-600 dark:text-neutral-400"
                                  )}>
                                    <span>Probit:</span>
                                    <span className="tabular-nums">+{methodEVs.probit.toFixed(2)}%</span>
                                  </div>
                                )}
                              </div>
                              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 space-y-1">
                                <div className="flex justify-between items-center text-[11px] text-neutral-500 dark:text-neutral-400">
                                  <span>Range:</span>
                                  <span className="tabular-nums">+{evWorst.toFixed(2)}% → +{evBest.toFixed(2)}%</span>
                                </div>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                  Showing {evCase === "best" ? "best" : "worst"}-case ({displayMethod})
                                </div>
                              </div>
                              {boostPercent > 0 && (
                                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                    <Zap className="w-3 h-3" />
                                    <span>Base EV: +{baseEV.toFixed(2)}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          }
                        >
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-bold tabular-nums cursor-help",
                            "shadow-sm border",
                            boostPercent > 0 
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300/50 dark:border-amber-700/50 ring-1 ring-amber-400/30"
                              : cn(evFormat.bgClass, evFormat.color, "border-emerald-200/50 dark:border-emerald-800/50")
                          )}>
                            {boostPercent > 0 && <Zap className="w-3 h-3 text-amber-500" />}
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M6 0L12 10H0L6 0Z" />
                            </svg>
                            {evFormat.text}
                          </div>
                        </Tooltip>
                      </div>
                    </td>

                    {/* League */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/50 shadow-sm">
                        <SportIcon sport={opp.sport} className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
                          {getLeagueName(opp.sport)}
                        </span>
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-sm font-semibold tracking-tight",
                          isToday ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {dateStr}
                        </span>
                        {timeStr && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-500 tabular-nums">
                            {timeStr}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Selection */}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {/* NBA player names are clickable to show hit rate modal */}
                          {opp.sport === "nba" && opp.playerId && opp.playerName ? (
                            <button
                              onMouseEnter={() => prefetchPlayer(opp.playerId)}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPlayer({
                                  odds_player_id: opp.playerId!,
                                  player_name: opp.playerName!,
                                  market: opp.market,
                                  event_id: opp.eventId,
                                  line: opp.line,
                                  odds: {
                                    [opp.side]: {
                                      price: opp.book.price,
                                      line: opp.line,
                                      book: opp.book.bookId,
                                      mobileLink: opp.book.mobileLink,
                                    },
                                  },
                                });
                              }}
                              className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight hover:text-brand dark:hover:text-brand transition-colors text-left"
                            >
                              {opp.playerName}
                            </button>
                          ) : (
                            <span className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight">
                              {opp.playerName || "Game"}
                            </span>
                          )}
                          {opp.playerPosition && (
                            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                              {opp.playerPosition}
                            </span>
                          )}
                        </div>
                        {opp.awayTeam && opp.homeTeam && (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {showLogos && (
                              <img
                                src={getTeamLogoUrl(opp.awayTeam, opp.sport)}
                                alt={opp.awayTeam}
                                className="w-4 h-4 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <span className={cn(
                              "transition-colors",
                              opp.playerTeam === opp.awayTeam && "font-semibold text-neutral-700 dark:text-neutral-200"
                            )}>
                              {opp.awayTeam}
                            </span>
                            <span className="text-neutral-300 dark:text-neutral-600">@</span>
                            {showLogos && (
                              <img
                                src={getTeamLogoUrl(opp.homeTeam, opp.sport)}
                                alt={opp.homeTeam}
                                className="w-4 h-4 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <span className={cn(
                              "transition-colors",
                              opp.playerTeam === opp.homeTeam && "font-semibold text-neutral-700 dark:text-neutral-200"
                            )}>
                              {opp.homeTeam}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Line */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      {(() => {
                        // Determine if this is a binary/yes-no market (e.g., double_double, triple_double)
                        const isBinaryMarket = opp.line === 0.5 && (
                          opp.market.includes("double_double") ||
                          opp.market.includes("triple_double") ||
                          opp.market.includes("to_score") ||
                          opp.market.includes("first_basket") ||
                          opp.market.includes("first_touchdown") ||
                          opp.market.includes("anytime") ||
                          opp.market.includes("to_record")
                        );
                        
                        const lineDisplay = opp.side === "yes" ? "Yes" : 
                          opp.side === "no" ? "No" :
                          isBinaryMarket ? (opp.side === "over" ? "Yes" : "No") :
                          `${opp.side === "over" ? "O" : "U"} ${opp.line}`;
                        
                        return (
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide",
                            "bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50",
                            "border border-neutral-200/50 dark:border-neutral-700/50",
                            "text-neutral-700 dark:text-neutral-300 shadow-sm"
                          )}>
                            {lineDisplay}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Market */}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 truncate block max-w-[120px]">
                        {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketLabelShort(opp.market) || opp.market}
                      </span>
                    </td>

                    {/* Best Book */}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      {(() => {
                        // Find all books with the same best EV (ties)
                        const bestEV = opp.book.evPercent ?? opp.evCalculations.evWorst;
                        const tiedBooks = opp.allBooks
                          .filter(b => !b.isSharpRef && Math.abs((b.evPercent ?? 0) - bestEV) < 0.01)
                          .slice(0, 4); // Max 4 for display
                        const extraCount = opp.allBooks.filter(b => !b.isSharpRef && Math.abs((b.evPercent ?? 0) - bestEV) < 0.01).length - 4;
                        
                        return (
                          <div className="flex items-center justify-center gap-2">
                            {/* Overlapping logos for tied books */}
                            <div className="flex items-center -space-x-2">
                              {tiedBooks.map((book, idx) => {
                                const logo = getBookLogo(book.bookId);
                                if (!logo) return null;
                                return (
                                  <Tooltip 
                                    key={book.bookId}
                                    content={
                                      book.limits?.max
                                        ? `${getBookName(book.bookId)} • Max: $${book.limits.max.toLocaleString()}`
                                        : getBookName(book.bookId) || book.bookId
                                    }
                                  >
                                    <div 
                                      className="relative flex-shrink-0 ring-2 ring-white dark:ring-neutral-900 rounded-md"
                                      style={{ zIndex: tiedBooks.length - idx }}
                                    >
                                      <img 
                                        src={logo} 
                                        alt={getBookName(book.bookId) || book.bookId} 
                                        className="h-7 w-7 object-contain rounded-md bg-white dark:bg-neutral-800"
                                      />
                                    </div>
                                  </Tooltip>
                                );
                              })}
                              {/* "+X" badge for additional tied books */}
                              {extraCount > 0 && (
                                <Tooltip content={`${extraCount} more books with same odds`}>
                                  <div 
                                    className="relative flex-shrink-0 ring-2 ring-white dark:ring-neutral-900 rounded-md h-7 w-7 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
                                    style={{ zIndex: 0 }}
                                  >
                                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">+{extraCount}</span>
                                  </div>
                                </Tooltip>
                              )}
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                                {formatOdds(opp.book.price)}
                              </span>
                              {opp.book.limits?.max && (
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                                  Max ${opp.book.limits.max >= 1000 ? `${(opp.book.limits.max / 1000).toFixed(0)}k` : opp.book.limits.max}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Sharp */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      {(() => {
                        const sharpOdds = opp.side === "over" || opp.side === "yes" ? opp.sharpReference.overOdds : opp.sharpReference.underOdds;
                        const sharpSource = opp.sharpReference.source?.split(" ")[0]?.toLowerCase() || savedFilters.sharpPreset?.toLowerCase();
                        // Handle blends like "pinnacle_circa" - just show first book's logo
                        const sharpBookId = sharpSource?.includes("_") ? sharpSource.split("_")[0] : sharpSource;
                        const sharpLogo = getBookLogo(sharpBookId);
                        const sharpName = getBookName(sharpBookId) || sharpSource?.toUpperCase() || "Sharp";
                        
                        return (
                          <div className="flex items-center justify-center gap-2">
                            {sharpLogo ? (
                              <Tooltip content={sharpName}>
                                <img 
                                  src={sharpLogo} 
                                  alt={sharpName} 
                                  className="h-7 w-7 object-contain rounded-md bg-white dark:bg-neutral-800"
                                />
                              </Tooltip>
                            ) : (
                              <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                {sharpName}
                              </span>
                            )}
                            <span className="text-[15px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                              {formatOdds(sharpOdds)}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Fair Odds */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100/80 dark:bg-neutral-800/60">
                        <span className="text-[14px] font-semibold text-neutral-600 dark:text-neutral-400 tabular-nums">
                          {fairOdds}
                        </span>
                      </div>
                    </td>

                    {/* Stake */}
                    {showStakeColumn && (
                      <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                        {(() => {
                          // Get EV% and decimal odds for Kelly calculation
                          // Use boosted values when boost is active
                          const effectiveDecimalOdds = boostPercent > 0 
                            ? applyBoostToDecimalOdds(decimalOdds, boostPercent)
                            : decimalOdds;
                          const evPercent = displayEV; // Already boosted if boost is active
                          
                          if (evPercent <= 0 || effectiveDecimalOdds <= 1) {
                            return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
                          }
                          
                          // Kelly ≈ EV / (decimal_odds - 1)
                          // EV = p*b - 1, Kelly = EV / (b-1)
                          const fullKellyPct = (evPercent / 100) / (effectiveDecimalOdds - 1) * 100;
                          
                          if (fullKellyPct <= 0 || !isFinite(fullKellyPct)) {
                            return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
                          }
                          
                          // Apply user's kelly percentage (fractional Kelly)
                          const fractionalKellyPct = fullKellyPct * (kellyPercent / 100);
                          const stake = bankroll * (fractionalKellyPct / 100);
                          
                          if (stake < 0.5) {
                            return <span className="text-xs text-neutral-400 dark:text-neutral-500">&lt;$1</span>;
                          }
                          
                          // Format stake
                          const display = stake < 10 ? `$${Math.round(stake)}` :
                            stake < 100 ? `$${Math.round(stake / 5) * 5}` :
                            `$${Math.round(stake / 10) * 10}`;
                          
                          const tooltipText = boostPercent > 0
                            ? `Full Kelly: ${fullKellyPct.toFixed(1)}% • ${kellyPercent}% Kelly: ${display} • +${boostPercent}% boosted`
                            : `Full Kelly: ${fullKellyPct.toFixed(1)}% • ${kellyPercent}% Kelly: ${display}`;
                          
                          // Kelly % tier for visual emphasis (consistent across all bankrolls)
                          // High: 3%+ full Kelly = strong bet
                          // Medium: 1.5-3% full Kelly = solid bet
                          // Standard: <1.5% full Kelly = smaller edge
                          const isHighKelly = fullKellyPct >= 3;
                          const isMediumKelly = fullKellyPct >= 1.5 && fullKellyPct < 3;
                          
                          return (
                            <Tooltip content={tooltipText}>
                              <div className={cn(
                                "inline-flex items-center gap-0.5 px-2 py-1 rounded-md cursor-help transition-colors",
                                boostPercent > 0 
                                  ? "bg-amber-100/80 dark:bg-amber-900/30"
                                  : isHighKelly 
                                    ? "bg-amber-100 dark:bg-amber-900/40"
                                    : isMediumKelly 
                                      ? "bg-amber-50 dark:bg-amber-900/20"
                                      : "bg-neutral-100/60 dark:bg-neutral-800/40"
                              )}>
                                {boostPercent > 0 && <Zap className="w-3 h-3 text-amber-500" />}
                                <span className={cn(
                                  "text-sm font-bold tabular-nums",
                                  boostPercent > 0 
                                    ? "text-amber-600 dark:text-amber-400"
                                    : isHighKelly 
                                      ? "text-amber-700 dark:text-amber-400"
                                      : isMediumKelly 
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-neutral-600 dark:text-neutral-400"
                                )}>
                                  {display}
                                </span>
                              </div>
                            </Tooltip>
                          );
                        })()}
                      </td>
                    )}

                    {/* Action */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="relative flex items-center justify-center gap-2">
                        <Tooltip content={`Place bet on ${book?.name || opp.book.bookName}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLink(opp.book.bookId, opp.book.link, opp.book.mobileLink);
                            }}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg",
                              "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
                              "text-white font-semibold text-xs shadow-sm",
                              "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                              "transition-all duration-200",
                              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-1"
                            )}
                          >
                            <span>Bet</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </Tooltip>
                        
                        {/* Add to Betslip Button */}
                        <Tooltip content={isFav ? "Remove from betslip" : "Add to betslip"} side="left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(opp);
                            }}
                            disabled={isTogglingThis}
                            className={cn(
                              "p-1.5 rounded-lg transition-all duration-200",
                              "hover:scale-110 active:scale-95",
                              isFav
                                ? "bg-red-500/10 hover:bg-red-500/20"
                                : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            )}
                          >
                            {isTogglingThis ? (
                              <HeartFill className="w-4 h-4 text-red-400 animate-pulse" />
                            ) : isFav ? (
                              <HeartFill className="w-4 h-4 text-red-500" />
                            ) : (
                              <Heart className="w-4 h-4 text-neutral-400 hover:text-red-400" />
                            )}
                          </button>
                        </Tooltip>

                        {/* Hide/Unhide Button */}
                        <Tooltip content={isHidden(opp.id) ? "Unhide this opportunity" : "Hide this opportunity"}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isHidden(opp.id)) {
                                unhideEdge(opp.id);
                              } else {
                                hideEdge({
                                  edgeKey: opp.id,
                                  eventId: opp.eventId,
                                  eventDate: opp.startTime,
                                  sport: opp.sport,
                                  playerName: opp.playerName,
                                  market: opp.market,
                                  line: opp.line,
                                  autoUnhideHours: 24
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg transition-all duration-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-110 active:scale-95"
                          >
                            {isHidden(opp.id) ? (
                              <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row - Premium Full Market View */}
                  <AnimatePresence>
                    {isExpanded && (() => {
                      
                      // Get all unique book IDs from both sides
                      const allBookIds = new Set<string>();
                      opp.allBooks.forEach(b => allBookIds.add(b.bookId));
                      opp.oppositeBooks?.forEach(b => allBookIds.add(b.bookId));
                      
                      // Create maps for quick lookup
                      const currentSideMap = new Map(opp.allBooks.map(b => [b.bookId, b]));
                      const oppositeSideMap = new Map((opp.oppositeBooks || []).map(b => [b.bookId, b]));
                      
                      // Sort books by best odds on the +EV side
                      const sortedBookIds = Array.from(allBookIds).sort((a, b) => {
                        const aBook = currentSideMap.get(a);
                        const bBook = currentSideMap.get(b);
                        return (bBook?.priceDecimal || 0) - (aBook?.priceDecimal || 0);
                      });
                      
                      // Determine which row is Over and which is Under
                      const isOverSide = opp.side === "over" || opp.side === "yes";
                      const overMap = isOverSide ? currentSideMap : oppositeSideMap;
                      const underMap = isOverSide ? oppositeSideMap : currentSideMap;
                      
                      // Calculate best and average for each side
                      const overBooks = Array.from(overMap.values());
                      const underBooks = Array.from(underMap.values());
                      const bestOver = overBooks.length > 0 ? Math.max(...overBooks.map(b => b.price)) : null;
                      const bestUnder = underBooks.length > 0 ? Math.max(...underBooks.map(b => b.price)) : null;
                      
                      // Calculate average using implied probabilities (correct method)
                      // Can't average American odds directly - must convert to probs first
                      const avgOver = overBooks.length > 0 
                        ? impliedProbToAmerican(
                            overBooks.reduce((sum, b) => sum + americanToImpliedProb(b.price), 0) / overBooks.length
                          )
                        : null;
                      const avgUnder = underBooks.length > 0 
                        ? impliedProbToAmerican(
                            underBooks.reduce((sum, b) => sum + americanToImpliedProb(b.price), 0) / underBooks.length
                          )
                        : null;
                      
                      // Find best book for highlighting
                      const bestOverBook = overBooks.find(b => b.price === bestOver);
                      const bestUnderBook = underBooks.find(b => b.price === bestUnder);
                      
                      return (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                          <td colSpan={totalColumns} className="p-0">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: isOddsChanged ? 0.5 : 1 }}
                              transition={{ delay: 0.1 }}
                              className={cn(
                                "bg-gradient-to-b from-neutral-50 to-neutral-100/80 dark:from-neutral-900 dark:to-neutral-950 border-b border-neutral-200 dark:border-neutral-800",
                                isOddsChanged && "grayscale pointer-events-none select-none"
                              )}
                            >
                              {/* Full Width Container */}
                              <div className="w-full flex flex-col items-center">
                                {/* Header Row with Gradient Accent */}
                                <div className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      isOddsChanged ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                                    )} />
                                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                                      {isOddsChanged ? "Odds Changed" : "Market Odds Comparison"}
                                    </span>
                                  </div>
                                  <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 dark:from-neutral-700 to-transparent" />
                                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-500">
                                    <span>Line: <strong className="text-neutral-700 dark:text-neutral-300">{opp.line}</strong></span>
                                    <span className="w-px h-3 bg-neutral-300 dark:bg-neutral-700" />
                                    <span>Fair: <strong className="text-emerald-600 dark:text-emerald-400">{fairOdds}</strong></span>
                                  </div>
                                </div>

                                {/* Odds Table - Centered */}
                                <div className="flex w-full justify-center">
                                  <div className="flex max-w-full">
                                  {/* Fixed Left Column - Side Labels */}
                                  <div className="flex-shrink-0 w-28 border-r border-neutral-200/60 dark:border-neutral-800/60 bg-white/30 dark:bg-black/20">
                                    {/* Header spacer */}
                                    <div className="h-12 border-b border-neutral-200/40 dark:border-neutral-800/40" />
                                    {/* Over Label */}
                                    <div className={cn(
                                      "h-14 flex items-center px-4 border-b border-neutral-200/40 dark:border-neutral-800/40",
                                      isOverSide && "bg-emerald-50/50 dark:bg-emerald-950/20"
                                    )}>
                                      <div className="flex flex-col">
                                        <span className={cn(
                                          "text-sm font-semibold tracking-tight",
                                          isOverSide ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                                        )}>
                                          Over
                                        </span>
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">{opp.line}</span>
                                      </div>
                                    </div>
                                    {/* Under Label */}
                                    <div className={cn(
                                      "h-14 flex items-center px-4",
                                      !isOverSide && "bg-emerald-50/50 dark:bg-emerald-950/20"
                                    )}>
                                      <div className="flex flex-col">
                                        <span className={cn(
                                          "text-sm font-semibold tracking-tight",
                                          !isOverSide ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                                        )}>
                                          Under
                                        </span>
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 -mt-0.5">{opp.line}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Fixed Best Column */}
                                  <div className="flex-shrink-0 w-20 border-r border-neutral-200/60 dark:border-neutral-800/60 bg-emerald-50/30 dark:bg-emerald-950/10">
                                    <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Best</span>
                                    </div>
                                    <div className={cn(
                                      "h-14 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                                      isOverSide && "bg-emerald-100/50 dark:bg-emerald-900/20"
                                    )}>
                                      {bestOver !== null && (
                                        <Tooltip content={`Best odds at ${getBookName(bestOverBook?.bookId)}`}>
                                          <div className="flex items-center gap-1">
                                            {bestOverBook && getBookLogo(bestOverBook.bookId) && (
                                              <img src={getBookLogo(bestOverBook.bookId)!} alt="" className="w-4 h-4 object-contain opacity-60" />
                                            )}
                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                              {formatOdds(bestOver)}
                                            </span>
                                          </div>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <div className={cn(
                                      "h-14 flex items-center justify-center",
                                      !isOverSide && "bg-emerald-100/50 dark:bg-emerald-900/20"
                                    )}>
                                      {bestUnder !== null && (
                                        <Tooltip content={`Best odds at ${getBookName(bestUnderBook?.bookId)}`}>
                                          <div className="flex items-center gap-1">
                                            {bestUnderBook && getBookLogo(bestUnderBook.bookId) && (
                                              <img src={getBookLogo(bestUnderBook.bookId)!} alt="" className="w-4 h-4 object-contain opacity-60" />
                                            )}
                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                              {formatOdds(bestUnder)}
                                            </span>
                                          </div>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>

                                  {/* Fixed Average Column */}
                                  <div className="flex-shrink-0 w-16 border-r border-neutral-200/60 dark:border-neutral-800/60">
                                    <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Avg</span>
                                    </div>
                                    <div className="h-14 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                        {avgOver !== null ? formatOdds(avgOver) : "—"}
                                      </span>
                                    </div>
                                    <div className="h-14 flex items-center justify-center">
                                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                        {avgUnder !== null ? formatOdds(avgUnder) : "—"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Scrollable Sportsbooks */}
                                  <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 dark:hover:scrollbar-thumb-neutral-600">
                                    <div className="inline-flex min-w-full">
                                      {sortedBookIds.map((bookId, bookIndex) => {
                                        const bookLogo = getBookLogo(bookId);
                                        const overOffer = overMap.get(bookId);
                                        const underOffer = underMap.get(bookId);
                                        const isOverBest = overOffer && overOffer.price === bestOver;
                                        const isUnderBest = underOffer && underOffer.price === bestUnder;
                                        
                                        return (
                                          <div 
                                            key={bookId} 
                                            className={cn(
                                              "flex-shrink-0 w-[72px] border-r border-neutral-100 dark:border-neutral-800/40 last:border-r-0",
                                              "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30 transition-colors"
                                            )}
                                          >
                                            {/* Book Logo Header */}
                                            <div className="h-12 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40 px-2">
                                              <Tooltip content={getBookName(bookId)}>
                                                {bookLogo ? (
                                                  <img
                                                    src={bookLogo}
                                                    alt={bookId}
                                                    className="h-6 w-6 object-contain opacity-90 hover:opacity-100 transition-opacity"
                                                  />
                                                ) : (
                                                  <span className="text-[10px] font-medium text-neutral-500 truncate">
                                                    {getBookName(bookId)?.slice(0, 6)}
                                                  </span>
                                                )}
                                              </Tooltip>
                                            </div>
                                            {/* Over Odds */}
                                            <div className={cn(
                                              "h-14 flex flex-col items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                                              isOverBest && "bg-emerald-50 dark:bg-emerald-950/30",
                                              overOffer?.isSharpRef && "opacity-50"
                                            )}>
                                              {overOffer ? (
                                                <>
                                                  <button
                                                    onClick={() => openLink(bookId, overOffer.link, overOffer.mobileLink)}
                                                    className={cn(
                                                      "text-sm font-semibold tabular-nums transition-all px-2 py-0.5 rounded",
                                                      "hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:scale-105",
                                                      isOverBest
                                                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                        : "text-neutral-700 dark:text-neutral-300"
                                                    )}
                                                  >
                                                    {formatOdds(overOffer.price)}
                                                  </button>
                                                  {/* EV% for this book - only show for the +EV side if it's positive */}
                                                  {isOverSide && overOffer.evPercent !== undefined && overOffer.evPercent > 0 && (
                                                    <span className={cn(
                                                      "text-[9px] font-bold tabular-nums",
                                                      overOffer.isSharpRef 
                                                        ? "text-neutral-400 dark:text-neutral-500"
                                                        : "text-emerald-600 dark:text-emerald-400"
                                                    )}>
                                                      {overOffer.isSharpRef ? "REF" : `+${overOffer.evPercent.toFixed(1)}%`}
                                                    </span>
                                                  )}
                                                  {overOffer.limits?.max && !isOverSide && (
                                                    <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-medium">
                                                      Max ${overOffer.limits.max >= 1000 ? `${(overOffer.limits.max / 1000).toFixed(0)}k` : overOffer.limits.max}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                              )}
                                            </div>
                                            {/* Under Odds */}
                                            <div className={cn(
                                              "h-14 flex flex-col items-center justify-center",
                                              isUnderBest && "bg-emerald-50 dark:bg-emerald-950/30",
                                              underOffer?.isSharpRef && "opacity-50"
                                            )}>
                                              {underOffer ? (
                                                <>
                                                  <button
                                                    onClick={() => openLink(bookId, underOffer.link, underOffer.mobileLink)}
                                                    className={cn(
                                                      "text-sm font-semibold tabular-nums transition-all px-2 py-0.5 rounded",
                                                      "hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:scale-105",
                                                      isUnderBest
                                                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                        : "text-neutral-700 dark:text-neutral-300"
                                                    )}
                                                  >
                                                    {formatOdds(underOffer.price)}
                                                  </button>
                                                  {/* EV% for this book - only show for the +EV side if it's positive */}
                                                  {!isOverSide && underOffer.evPercent !== undefined && underOffer.evPercent > 0 && (
                                                    <span className={cn(
                                                      "text-[9px] font-bold tabular-nums",
                                                      underOffer.isSharpRef 
                                                        ? "text-neutral-400 dark:text-neutral-500"
                                                        : "text-emerald-600 dark:text-emerald-400"
                                                    )}>
                                                      {underOffer.isSharpRef ? "REF" : `+${underOffer.evPercent.toFixed(1)}%`}
                                                    </span>
                                                  )}
                                                  {underOffer.limits?.max && isOverSide && (
                                                    <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-medium">
                                                      Max ${underOffer.limits.max >= 1000 ? `${(underOffer.limits.max / 1000).toFixed(0)}k` : underOffer.limits.max}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      );
                    })()}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {totalReturned >= limit && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setLimit((prev) => prev + 100)}
            className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
            disabled={isLoading || isFetching}
          >
            Load more results ({totalFound - totalReturned} more available)
          </button>
        </div>
      )}

      {/* Pro Upgrade CTA */}
      {!effectiveIsPro && (
        <div className="text-center py-8 border-t mt-8">
          <p className="text-muted-foreground mb-2">
            {isLoggedIn 
              ? "Upgrade to Pro to unlock all +EV opportunities"
              : "Sign up for Pro to unlock all +EV opportunities"}
          </p>
          <a
            href="/pricing"
            className="inline-block px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-md font-medium hover:from-emerald-600 hover:to-teal-700 transition-all"
          >
            {isLoggedIn ? "Upgrade to Pro" : "View Plans"}
          </a>
        </div>
      )}

      {/* Player Quick View Modal (NBA Hit Rates) */}
      {selectedPlayer && (
        <PlayerQuickViewModal
          odds_player_id={selectedPlayer.odds_player_id}
          player_name={selectedPlayer.player_name}
          initial_market={selectedPlayer.market}
          initial_line={selectedPlayer.line}
          event_id={selectedPlayer.event_id}
          odds={selectedPlayer.odds ?? undefined}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}
    </div>
  );
}
