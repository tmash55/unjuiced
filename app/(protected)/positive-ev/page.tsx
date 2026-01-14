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
  ChevronRight,
  RefreshCw, 
  Calculator,
  Info,
  ExternalLink,
  Percent,
  Loader2,
  Pin,
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
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabel } from "@/lib/data/markets";
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

// Sportsbooks and markets
import { X } from "lucide-react";
import { useAvailableMarkets, FALLBACK_MARKETS } from "@/hooks/use-available-markets";
import { usePositiveEvPreferences, useEvPreferences } from "@/context/preferences-context";
import { PositiveEVFilters } from "@/components/positive-ev/positive-ev-filters";
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
 * Format EV percentage with color coding
 */
function formatEVPercent(ev: number): { text: string; color: string; bgClass: string } {
  const text = `+${ev.toFixed(1)}%`;
  if (ev >= 10) return { text, color: "text-emerald-700 dark:text-emerald-400", bgClass: "bg-emerald-100 dark:bg-emerald-900/30" };
  if (ev >= 5) return { text, color: "text-green-700 dark:text-green-400", bgClass: "bg-green-100 dark:bg-green-900/30" };
  return { text, color: "text-blue-700 dark:text-blue-400", bgClass: "bg-blue-100 dark:bg-blue-900/30" };
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
  const { filters: evPrefs } = useEvPreferences();
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
  
  // Handler for filters change from PositiveEVFilters component
  const handleFiltersChange = useCallback((filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: SharpPreset;
    devigMethods?: DevigMethod[];
    minEv?: number;
    maxEv?: number | undefined;
    mode?: EVMode;
    minBooksPerSide?: number;
  }) => {
    // Save directly to preferences (context handles optimistic updates)
    updateSavedFilters({
      selectedBooks: filters.selectedBooks,
      selectedSports: filters.selectedSports,
      selectedMarkets: filters.selectedMarkets,
      sharpPreset: filters.sharpPreset,
      devigMethods: filters.devigMethods,
      minEv: filters.minEv,
      maxEv: filters.maxEv,
      mode: filters.mode,
      minBooksPerSide: filters.minBooksPerSide,
    });
  }, [updateSavedFilters]);

  // Favorites hook
  const { toggleFavorite, isFavorited, isToggling: isTogglingAny } = useFavorites();
  
  // Track which row is being toggled
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
  const data = autoRefresh ? streamRows : standardData;
  const totalFound = autoRefresh ? streamMeta.totalFound : standardTotalFound;
  const totalReturned = autoRefresh ? streamMeta.returned : standardTotalReturned;
  const isLoading = autoRefresh ? streamLoading : standardIsLoading;
  const isFetching = autoRefresh ? false : standardIsFetching;
  const error = autoRefresh ? (streamError ? new Error(streamError) : null) : standardError;
  const refetch = autoRefresh ? streamRefresh : standardRefetch;
  const dataUpdatedAt = autoRefresh ? streamLastUpdated : standardDataUpdatedAt;

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
  }, [data, searchQuery, expandedRows, pinnedPositions]);
  
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
  
  // Open bet link
  const openLink = useCallback((bookId?: string, link?: string | null) => {
    const fallback = getBookFallbackUrl(bookId);
    const target = link || fallback;
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
                : `${filteredOpportunities.length}+ opportunities found`}
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

      {/* Pregame / Live Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg w-fit">
          <button
            onClick={() => updateSavedFilters({ mode: "pregame" })}
            disabled={locked}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              savedFilters.mode === "pregame"
                ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            Pregame
          </button>
          <button
            onClick={() => updateSavedFilters({ mode: "live" })}
            disabled={locked}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
              savedFilters.mode === "live"
                ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Live
          </button>
          <button
            onClick={() => updateSavedFilters({ mode: "all" })}
            disabled={locked}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              savedFilters.mode === "all"
                ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            All
          </button>
        </div>
      </div>

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

      {/* Filters */}
      <div className="mb-6 relative z-10">
        <FiltersBar>
          <FiltersBarSection align="left">
            {/* Search */}
            <div className="relative">
              <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              <Input
                placeholder="Search players, teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                disabled={locked}
              />
            </div>
          </FiltersBarSection>

          <FiltersBarSection align="right">
            {/* Devig Reference Selector - Using native select for reliability */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Devig:</span>
              <select
                value={savedFilters.sharpPreset}
                onChange={(e) => {
                  const newPreset = e.target.value as SharpPreset;
                  console.log('[Devig] Select changed to:', newPreset);
                  // Save to preferences
                  updateSavedFilters({ sharpPreset: newPreset }).then(() => {
                    console.log('[Devig] ✅ Saved preset to preferences');
                  }).catch((err) => {
                    console.warn('[Devig] Failed to save preset:', err);
                  });
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                disabled={locked}
              >
                {Object.entries(SHARP_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min EV Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Min EV:</span>
              <select
                value={savedFilters.minEv}
                onChange={(e) => updateSavedFilters({ minEv: Number(e.target.value) })}
                className="px-2 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
                disabled={locked}
              >
                {MIN_EV_OPTIONS.map((val) => (
                  <option key={val} value={val}>
                    {val}%
                  </option>
                ))}
              </select>
            </div>

            {/* Filters Button */}
            <PositiveEVFilters
              selectedBooks={savedFilters.selectedBooks}
              selectedSports={savedFilters.selectedSports}
              selectedMarkets={savedFilters.selectedMarkets}
              sharpPreset={savedFilters.sharpPreset as SharpPreset}
              devigMethods={savedFilters.devigMethods as DevigMethod[]}
              minEv={savedFilters.minEv}
              maxEv={savedFilters.maxEv}
              mode={savedFilters.mode}
              minBooksPerSide={savedFilters.minBooksPerSide}
              onFiltersChange={handleFiltersChange}
              availableSports={AVAILABLE_SPORTS}
              availableMarkets={availableMarkets}
              locked={locked}
              isLoggedIn={isLoggedIn}
              isPro={effectiveIsPro}
              opportunities={data}
            />

            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => effectiveIsPro && setAutoRefresh(!autoRefresh)}
              disabled={!effectiveIsPro}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                autoRefresh && streamConnected && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
                autoRefresh && streamIsReconnecting && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
                autoRefresh && streamHasFailed && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
                !autoRefresh && "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400",
                !effectiveIsPro && "opacity-50 cursor-not-allowed"
              )}
              title={effectiveIsPro ? (autoRefresh ? "Disable auto refresh" : "Enable auto refresh") : "Pro required"}
            >
              <span className={cn(
                "inline-flex h-2 w-2 rounded-full",
                autoRefresh && streamConnected && "bg-green-500",
                autoRefresh && streamIsReconnecting && "bg-amber-500 animate-pulse",
                autoRefresh && streamHasFailed && "bg-red-500",
                !autoRefresh && "bg-neutral-400"
              )} />
              <span>
                {autoRefresh 
                  ? (streamConnected 
                      ? "Live" 
                      : streamIsReconnecting 
                        ? "Reconnecting..." 
                        : streamHasFailed
                          ? "Connection Lost"
                          : "Connecting...")
                  : "Auto Refresh"}
              </span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => autoRefresh ? streamRefresh() : refetch()}
              disabled={isFetching || (autoRefresh && streamLoading)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
                "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", (isFetching || (autoRefresh && streamLoading)) && "animate-spin")} />
              <span>Refresh</span>
            </button>

            {/* Reconnect Button (when connection failed) */}
            {autoRefresh && streamHasFailed && (
              <button
                onClick={streamReconnect}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reconnect</span>
              </button>
            )}
          </FiltersBarSection>
        </FiltersBar>
      </div>


      {/* Active Filters Pills */}
      {activeFilterCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Active filters:</span>
          
          {savedFilters.maxEv && (
            <button
              onClick={() => updateSavedFilters({ maxEv: undefined })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
            >
              Max EV: {savedFilters.maxEv}%
              <X className="w-3 h-3" />
            </button>
          )}
          
          {savedFilters.selectedBooks.length > 0 && (
            <button
              onClick={() => updateSavedFilters({ selectedBooks: [] })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              {savedFilters.selectedBooks.length} Sportsbook{savedFilters.selectedBooks.length > 1 ? "s" : ""}
              <X className="w-3 h-3" />
            </button>
          )}
          
          {savedFilters.selectedMarkets.length > 0 && (
            <button
              onClick={() => updateSavedFilters({ selectedMarkets: [] })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              {savedFilters.selectedMarkets.length} Market{savedFilters.selectedMarkets.length > 1 ? "s" : ""}
              <X className="w-3 h-3" />
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                {currentMethods.length} De-vig method{currentMethods.length > 1 ? "s" : ""}: {currentMethods.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")}
                <X className="w-3 h-3" />
              </button>
            ) : null;
          })()}
          
          <button
            onClick={() => {
              updateSavedFilters({
                selectedBooks: [],
                selectedMarkets: [],
                maxEv: undefined,
                devigMethods: ['power', 'multiplicative'],
              });
            }}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
          >
            Clear all
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
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span>EV %</span>
                  <Tooltip content="Expected Value % based on de-vigged fair probability. Worst-case (conservative) shown by default.">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">League</th>
              <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-left border-b-2 border-neutral-200 dark:border-neutral-700">Time</th>
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
                <th className="font-semibold text-[11px] text-neutral-600 dark:text-neutral-300 uppercase tracking-widest h-12 px-3 py-2 text-center border-b-2 border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Stake</span>
                    <Tooltip content={`Recommended bet size using Kelly Criterion (${kellyPercent}% Kelly). Based on your bankroll of $${bankroll.toLocaleString()}.`}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-emerald-500 transition-colors cursor-help" aria-hidden>
                        <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                      </svg>
                    </Tooltip>
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
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex justify-center gap-2">
                        <div className="w-14 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 animate-pulse" />
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && filteredOpportunities.length === 0 && (
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
            {!isLoading && filteredOpportunities.map((opp, index) => {
              const evFormat = formatEVPercent(opp.evCalculations.evDisplay);
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
              
              // Determine if row should be greyed out (stale or odds changed)
              const isGreyedOut = isStale || (isExpanded && isOddsChanged);
              
              // If row is stale and not expanded, skip it (will be removed from display)
              if (isStale && !isExpanded) {
                return null;
              }
              
              // Get fair probability and convert to American odds
              const fairProb = opp.evCalculations.power?.fairProb || opp.evCalculations.multiplicative?.fairProb || 0;
              const fairOdds = fairProbToAmerican(fairProb);
              
              // Get all method EV values for tooltip
              const methodEVs = {
                power: opp.evCalculations.power?.evPercent,
                multiplicative: opp.evCalculations.multiplicative?.evPercent,
                additive: opp.evCalculations.additive?.evPercent,
                probit: opp.evCalculations.probit?.evPercent,
              };
              const evWorst = opp.evCalculations.evWorst;
              const evBest = opp.evCalculations.evBest;
              
              // Determine which method gave the worst-case (displayed) EV
              const worstMethod = Object.entries(methodEVs)
                .filter(([, v]) => v !== undefined)
                .sort(([, a], [, b]) => (a || 0) - (b || 0))[0]?.[0] || "power";
              
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
                    onClick={() => !isGreyedOut && toggleRow(opp.id, index)}
                    className={cn(
                      "group/row transition-all duration-200",
                      !isGreyedOut && "cursor-pointer",
                      !isGreyedOut && "hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-emerald-50/20 dark:hover:from-emerald-950/40 dark:hover:to-emerald-950/10",
                      index % 2 === 0 
                        ? "bg-white dark:bg-neutral-900" 
                        : "bg-neutral-100/70 dark:bg-neutral-800/40",
                      isExpanded && !isGreyedOut && "!bg-gradient-to-r !from-emerald-50 !to-emerald-50/30 dark:!from-emerald-950/50 dark:!to-emerald-950/20",
                      // Greyed out states (stale or odds changed on expanded)
                      isGreyedOut && "opacity-50 bg-neutral-200/50 dark:bg-neutral-800/50",
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
                            <div className="text-xs space-y-2 min-w-[140px]">
                              <div className="font-semibold border-b border-neutral-600 pb-1 mb-1">EV by Method</div>
                              {methodEVs.power !== undefined && (
                                <div className={cn("flex justify-between", worstMethod === "power" && "font-bold text-emerald-400")}>
                                  <span>Power:</span>
                                  <span>+{methodEVs.power.toFixed(2)}%</span>
                                </div>
                              )}
                              {methodEVs.multiplicative !== undefined && (
                                <div className={cn("flex justify-between", worstMethod === "multiplicative" && "font-bold text-emerald-400")}>
                                  <span>Multiplicative:</span>
                                  <span>+{methodEVs.multiplicative.toFixed(2)}%</span>
                                </div>
                              )}
                              {methodEVs.additive !== undefined && (
                                <div className={cn("flex justify-between", worstMethod === "additive" && "font-bold text-emerald-400")}>
                                  <span>Additive:</span>
                                  <span>+{methodEVs.additive.toFixed(2)}%</span>
                                </div>
                              )}
                              {methodEVs.probit !== undefined && (
                                <div className={cn("flex justify-between", worstMethod === "probit" && "font-bold text-emerald-400")}>
                                  <span>Probit:</span>
                                  <span>+{methodEVs.probit.toFixed(2)}%</span>
                                </div>
                              )}
                              <div className="border-t border-neutral-600 pt-1 mt-1 text-[10px] text-neutral-400">
                                Range: +{evWorst.toFixed(2)}% → +{evBest.toFixed(2)}%
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                Showing worst-case ({worstMethod})
                              </div>
                            </div>
                          }
                        >
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-bold tabular-nums cursor-help",
                            "shadow-sm border",
                            evFormat.bgClass,
                            evFormat.color,
                            "border-emerald-200/50 dark:border-emerald-800/50"
                          )}>
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
                          <span className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight">
                            {opp.playerName || "Game"}
                          </span>
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
                        {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketLabel(opp.market) || opp.market}
                      </span>
                    </td>

                    {/* Best Book */}
                    <td className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        {getBookLogo(opp.book.bookId) && (
                          <Tooltip content={getBookName(opp.book.bookId)}>
                            <div className="relative flex-shrink-0">
                              <img 
                                src={getBookLogo(opp.book.bookId)!} 
                                alt={getBookName(opp.book.bookId) || opp.book.bookId} 
                                className="h-7 w-7 object-contain rounded-md"
                              />
                            </div>
                          </Tooltip>
                        )}
                        <span className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                          {formatOdds(opp.book.price)}
                        </span>
                      </div>
                    </td>

                    {/* Sharp */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <div className="flex flex-col items-center">
                        <span className="text-[15px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                          {formatOdds(opp.side === "over" || opp.side === "yes" ? opp.sharpReference.overOdds : opp.sharpReference.underOdds)}
                        </span>
                        <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                          {opp.sharpReference.source?.split(" ")[0] || sharpPreset}
                        </span>
                      </div>
                    </td>

                    {/* Fair Odds */}
                    <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                      <span className="text-[15px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                        {fairOdds}
                      </span>
                    </td>

                    {/* Stake */}
                    {showStakeColumn && (
                      <td className="px-3 py-3 text-center border-b border-neutral-100 dark:border-neutral-800/50">
                        {(() => {
                          // Get EV% and decimal odds for Kelly calculation
                          const evCalc = opp.evCalculations;
                          const evPercent = evCalc.evDisplay || evCalc.evWorst || 0;
                          const decimalOdds = opp.book.priceDecimal || 
                            (opp.book.price > 0 ? 1 + opp.book.price / 100 : 1 + 100 / Math.abs(opp.book.price));
                          
                          if (evPercent <= 0 || decimalOdds <= 1) {
                            return <span className="text-xs text-neutral-400 dark:text-neutral-500">—</span>;
                          }
                          
                          // Kelly ≈ EV / (decimal_odds - 1)
                          // EV = p*b - 1, Kelly = EV / (b-1)
                          const fullKellyPct = (evPercent / 100) / (decimalOdds - 1) * 100;
                          
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
                          
                          return (
                            <Tooltip content={`Full Kelly: ${fullKellyPct.toFixed(1)}% • ${kellyPercent}% Kelly: ${display}`}>
                              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums cursor-help">
                                {display}
                              </span>
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
                              openLink(opp.book.bookId, opp.book.link);
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
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row - Premium Full Market View */}
                  <AnimatePresence>
                    {isExpanded && (() => {
                      // Debug: Log what books we have in expanded view
                      console.log('[Expanded Row] Books data:', {
                        player: opp.playerName,
                        side: opp.side,
                        sharpPreset: opp.sharpPreset,
                        sharpOverOdds: opp.sharpReference.overOdds,
                        sharpUnderOdds: opp.sharpReference.underOdds,
                        sharpSource: opp.sharpReference.source,
                        allBooksCount: opp.allBooks?.length,
                        allBookIds: opp.allBooks?.map(b => b.bookId),
                        oppositeBooksCount: opp.oppositeBooks?.length,
                        oppositeBookIds: opp.oppositeBooks?.map(b => b.bookId),
                      });
                      
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
                              <div className="w-full">
                                {/* Header Row with Gradient Accent */}
                                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
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

                                {/* Odds Table */}
                                <div className="flex w-full">
                                  {/* Fixed Left Column - Side Labels */}
                                  <div className="flex-shrink-0 w-28 border-r border-neutral-200/60 dark:border-neutral-800/60 bg-white/30 dark:bg-black/20">
                                    {/* Header spacer */}
                                    <div className="h-12 border-b border-neutral-200/40 dark:border-neutral-800/40" />
                                    {/* Over Label */}
                                    <div className={cn(
                                      "h-11 flex items-center px-4 border-b border-neutral-200/40 dark:border-neutral-800/40",
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
                                      "h-11 flex items-center px-4",
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
                                      "h-11 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
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
                                      "h-11 flex items-center justify-center",
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
                                    <div className="h-11 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                                        {avgOver !== null ? formatOdds(avgOver) : "—"}
                                      </span>
                                    </div>
                                    <div className="h-11 flex items-center justify-center">
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
                                              "h-11 flex items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                                              isOverBest && "bg-emerald-50 dark:bg-emerald-950/30"
                                            )}>
                                              {overOffer ? (
                                                <button
                                                  onClick={() => openLink(bookId, overOffer.link)}
                                                  className={cn(
                                                    "text-sm font-semibold tabular-nums transition-all px-2 py-1 rounded",
                                                    "hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:scale-105",
                                                    isOverBest
                                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                      : "text-neutral-700 dark:text-neutral-300"
                                                  )}
                                                >
                                                  {formatOdds(overOffer.price)}
                                                </button>
                                              ) : (
                                                <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                              )}
                                            </div>
                                            {/* Under Odds */}
                                            <div className={cn(
                                              "h-11 flex items-center justify-center",
                                              isUnderBest && "bg-emerald-50 dark:bg-emerald-950/30"
                                            )}>
                                              {underOffer ? (
                                                <button
                                                  onClick={() => openLink(bookId, underOffer.link)}
                                                  className={cn(
                                                    "text-sm font-semibold tabular-nums transition-all px-2 py-1 rounded",
                                                    "hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:scale-105",
                                                    isUnderBest
                                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                      : "text-neutral-700 dark:text-neutral-300"
                                                  )}
                                                >
                                                  {formatOdds(underOffer.price)}
                                                </button>
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
    </div>
  );
}
