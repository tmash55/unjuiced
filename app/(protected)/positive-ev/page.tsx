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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// Hooks and types
import { usePositiveEV } from "@/hooks/use-positive-ev";
import type { PositiveEVOpportunity, SharpPreset, DevigMethod } from "@/lib/ev/types";
import { SHARP_PRESETS, DEVIG_METHODS } from "@/lib/ev/constants";
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

// Constants
const AVAILABLE_SPORTS = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb"];
const MIN_EV_OPTIONS = [0, 1, 2, 3, 5, 10];

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

  // Filter state
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "nfl"]);
  const [sharpPreset, setSharpPreset] = useState<SharpPreset>("pinnacle");
  const [minEV, setMinEV] = useState(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(100);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showMethodInfo, setShowMethodInfo] = useState(false);

  // Favorites hook
  const { toggleFavorite, isFavorited, isToggling: isTogglingAny } = useFavorites();
  
  // Track which row is being toggled
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch positive EV opportunities
  const {
    opportunities: data,
    totalFound,
    totalReturned,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = usePositiveEV({
    filters: {
      sports: selectedSports,
      sharpPreset,
      minEV,
      limit,
    },
    isPro: effectiveIsPro,
    enabled: !planLoading,
  });

  // Filter opportunities by search (client-side search is handled by hook, but we can do extra filtering)
  const filteredOpportunities = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((opp) => 
      opp.playerName?.toLowerCase().includes(query) ||
      opp.playerTeam?.toLowerCase().includes(query) ||
      opp.market?.toLowerCase().includes(query) ||
      opp.homeTeam?.toLowerCase().includes(query) ||
      opp.awayTeam?.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Toggle sport selection
  const toggleSport = useCallback((sport: string) => {
    setSelectedSports((prev) => {
      if (prev.includes(sport)) {
        return prev.length > 1 ? prev.filter((s) => s !== sport) : prev;
      }
      return [...prev, sport];
    });
  }, []);

  // Track expanded rows for all books view
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Loading message rotation
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  useEffect(() => {
    if (!isLoading && !isFetching) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % EV_LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading, isFetching]);

  // Toggle row expansion
  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
              <span>Updated {formatTimeAgo(dataUpdatedAt)}</span>
              {isFetching && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
          )}
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

            {/* Sports Pills */}
            <div className="flex items-center gap-1.5">
              {AVAILABLE_SPORTS.map((sport) => (
                <button
                  key={sport}
                  onClick={() => toggleSport(sport)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    selectedSports.includes(sport)
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                  disabled={locked}
                >
                  <SportIcon sport={sport} className="w-4 h-4" />
                  <span className="uppercase text-xs">{sport}</span>
                </button>
              ))}
            </div>
          </FiltersBarSection>

          <FiltersBarSection align="right">
            {/* Sharp Preset Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                disabled={locked}
              >
                <span className="text-neutral-500 dark:text-neutral-400">Sharp:</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {SHARP_PRESETS[sharpPreset]?.label || sharpPreset}
                </span>
                <ChevronDown className="w-4 h-4 opacity-60" />
              </button>

              <AnimatePresence>
                {showPresetDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full right-0 mt-1 z-50 min-w-[240px] bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-2"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-2 py-1 mb-1">
                      Sharp Reference
                    </p>
                    {Object.entries(SHARP_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSharpPreset(key as SharpPreset);
                          setShowPresetDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 rounded-md text-left text-sm transition-colors",
                          sharpPreset === key
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        )}
                      >
                        <div className="font-medium">{preset.label}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {preset.books.join(", ")}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Min EV Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Min EV:</span>
              <select
                value={minEV}
                onChange={(e) => setMinEV(Number(e.target.value))}
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

            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
                "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </FiltersBarSection>
        </FiltersBar>
      </div>

      {/* Close dropdown on click outside */}
      {showPresetDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowPresetDropdown(false)} 
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive mb-6">
          Error: {error.message}
        </div>
      )}

      {/* Results Table - Edge Finder Style */}
      <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: 90 }} />  {/* EV% */}
            <col style={{ width: 70 }} />  {/* League */}
            <col style={{ width: 90 }} />  {/* Time */}
            <col style={{ width: 200 }} /> {/* Selection */}
            <col style={{ width: 80 }} />  {/* Line */}
            <col style={{ width: 130 }} /> {/* Market */}
            <col style={{ width: 140 }} /> {/* Best Book */}
            <col style={{ width: 90 }} />  {/* Sharp */}
            <col style={{ width: 90 }} />  {/* Fair Odds */}
            <col style={{ width: 110 }} /> {/* Action */}
          </colgroup>
          <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-[5]">
            <tr>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-center gap-1">
                  <span>EV %</span>
                  <Tooltip content="Expected Value % based on de-vigged fair probability. Worst-case (conservative) shown by default.">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">League</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Time</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Selection</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Line</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">Market</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">Best Book</th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-center gap-1">
                  <span>Sharp</span>
                  <Tooltip content="Sharp reference odds used for de-vigging (e.g., Pinnacle).">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-center gap-1">
                  <span>Fair Odds</span>
                  <Tooltip content="De-vigged fair odds (no-vig true probability). Calculated using Power method.">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300" aria-hidden>
                      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z" />
                    </svg>
                  </Tooltip>
                </div>
              </th>
              <th className="font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider h-14 p-2 text-center border-b border-neutral-200 dark:border-neutral-800">Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading State */}
            {isLoading && (
              <>
                {/* Loading message row */}
                <tr>
                  <td colSpan={10} className="p-0 border-b border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="flex items-center justify-center py-3 bg-neutral-50/50 dark:bg-neutral-800/30">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={loadingMessageIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm text-neutral-500 dark:text-neutral-400"
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
                  <tr key={`skeleton-${i}`} className={i % 2 === 0 ? "table-row-even" : "table-row-odd"}>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                        <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-12 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="space-y-1">
                        <div className="w-12 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                        <div className="w-16 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="space-y-1.5">
                        <div className="w-32 h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                        <div className="w-24 h-3 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="w-20 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                        <div className="w-14 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex justify-center">
                        <div className="w-12 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                    <td className="p-2 border-b border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex justify-center gap-2">
                        <div className="w-12 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                        <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && filteredOpportunities.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="flex flex-col items-center justify-center py-16 text-neutral-500 dark:text-neutral-400">
                    <TrendingUp className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">No +EV opportunities found</p>
                    <p className="text-sm">Try lowering your minimum EV threshold or selecting more sports</p>
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
              
              // Get fair probability and convert to American odds
              const fairProb = opp.evCalculations.power?.fairProb || opp.evCalculations.multiplicative?.fairProb || 0;
              const fairOdds = fairProbToAmerican(fairProb);
              
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
              
              // All books sorted by price
              const sortedBooks = [...opp.allBooks].sort((a, b) => b.priceDecimal - a.priceDecimal);

              return (
                <React.Fragment key={opp.id}>
                  <tr
                    onClick={() => toggleRow(opp.id)}
                    className={cn(
                      "group/row transition-colors cursor-pointer hover:!bg-neutral-100 dark:hover:!bg-neutral-800/50",
                      index % 2 === 0 ? "table-row-even" : "table-row-odd"
                    )}
                  >
                    {/* EV% */}
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(opp.id);
                          }}
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-md transition-all shrink-0",
                            "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                            "text-neutral-500 dark:text-neutral-400",
                            isExpanded && "bg-neutral-100 dark:bg-neutral-800"
                          )}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <motion.div
                            initial={false}
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </motion.div>
                        </button>
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-bold",
                          evFormat.bgClass,
                          evFormat.color
                        )}>
                          <span className="text-[10px]">▲</span>
                          {evFormat.text}
                        </span>
                      </div>
                    </td>

                    {/* League */}
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <SportIcon sport={opp.sport} className="h-3.5 w-3.5" />
                        {getLeagueName(opp.sport)}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">{dateStr}</div>
                        {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-500">{timeStr}</div>}
                      </div>
                    </td>

                    {/* Selection */}
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="text-sm md:text-base font-medium text-neutral-900 dark:text-neutral-100">
                        {opp.playerName || "Game"}
                        {opp.playerPosition && (
                          <span className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                            ({opp.playerPosition})
                          </span>
                        )}
                      </div>
                      {opp.awayTeam && opp.homeTeam && (
                        <div className="flex items-center gap-1 text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
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
                            opp.playerTeam === opp.awayTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                          )}>
                            {opp.awayTeam}
                          </span>
                          <span className="mx-0.5">@</span>
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
                            opp.playerTeam === opp.homeTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                          )}>
                            {opp.homeTeam}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Line */}
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                        {opp.side === "yes" ? "Yes" : 
                         opp.side === "no" ? "No" : 
                         `${opp.side === "over" ? "O" : "U"} ${opp.line}`}
                      </span>
                    </td>

                    {/* Market */}
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 truncate max-w-[120px]">
                        {opp.marketDisplay ? shortenPeriodPrefix(opp.marketDisplay) : formatMarketLabel(opp.market) || opp.market}
                      </span>
                    </td>

                    {/* Best Book */}
                    <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-2">
                        {book?.image?.square && (
                          <img 
                            src={book.image.square} 
                            alt={book.name} 
                            className="h-6 w-6 object-contain"
                            title={book.name}
                          />
                        )}
                        <div className="flex flex-col items-center leading-tight">
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                            {formatOdds(opp.book.price)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sharp */}
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
                          {formatOdds(opp.side === "over" || opp.side === "yes" ? opp.sharpReference.overOdds : opp.sharpReference.underOdds)}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          {opp.sharpReference.source?.split(" ")[0] || sharpPreset}
                        </span>
                      </div>
                    </td>

                    {/* Fair Odds */}
                    <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="font-bold text-base text-neutral-700 dark:text-neutral-300">
                        {fairOdds}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="p-2 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="relative flex items-center justify-center gap-2">
                        <Tooltip content={`Place bet on ${book?.name || opp.book.bookName}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLink(opp.book.bookId, opp.book.link);
                            }}
                            className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all font-medium text-sm"
                          >
                            <span>Bet</span>
                            <ExternalLink className="h-3.5 w-3.5" />
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
                              "p-2 rounded-lg transition-all",
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

                  {/* Expanded Row - All Books */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          index % 2 === 0 ? "table-row-even" : "table-row-odd"
                        )}
                      >
                        <td colSpan={10} className="px-4 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            {sortedBooks.map((bookItem) => {
                              const bookLogo = getBookLogo(bookItem.bookId);
                              const isBest = bookItem.bookId === opp.book.bookId;
                              const hasLink = !!bookItem.link || !!getBookFallbackUrl(bookItem.bookId);
                              
                              return (
                                <Tooltip 
                                  key={`${opp.id}-${bookItem.bookId}`}
                                  content={hasLink ? `Place bet on ${getBookName(bookItem.bookId)}` : `${getBookName(bookItem.bookId)} - No link available`}
                                >
                                  <button
                                    onClick={() => openLink(bookItem.bookId, bookItem.link)}
                                    disabled={!hasLink}
                                    className={cn(
                                      "flex items-center gap-2.5 px-4 py-3 rounded-lg border transition-all",
                                      hasLink ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                                      isBest
                                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 shadow-sm"
                                        : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md"
                                    )}
                                  >
                                    {bookLogo && (
                                      <img
                                        src={bookLogo}
                                        alt={bookItem.bookId}
                                        className="h-6 w-6 object-contain shrink-0"
                                      />
                                    )}
                                    <div className="flex flex-col items-start">
                                      <span className={cn(
                                        "text-base font-bold",
                                        isBest
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-neutral-900 dark:text-neutral-100"
                                      )}>
                                        {formatOdds(bookItem.price)}
                                      </span>
                                    </div>
                                    {hasLink && (
                                      <ExternalLink className="h-4 w-4 text-neutral-400 dark:text-neutral-500 ml-1" />
                                    )}
                                  </button>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </td>
                      </motion.tr>
                    )}
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
