/**
 * Hook for fetching opportunities with multiple filter support
 * 
 * HYBRID APPROACH:
 * - Preset Mode: Fetches broader dataset, filters client-side for instant sports/market/odds changes
 * - Custom Mode: Server-side filtering for custom blend calculations
 * 
 * Handles parallel API calls for multiple active custom filters,
 * merges results, and deduplicates (best edge wins).
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import {
  type Opportunity,
  type OpportunityFilters,
  type FilterConfig,
  type Sport,
  DEFAULT_FILTERS,
  parseOpportunity,
} from "@/lib/types/opportunities";
import { normalizeSportsbookId, getSportsbookById } from "@/lib/data/sportsbooks";
import { DEFAULT_FILTER_COLOR, type FilterPreset, parseSports, getSportIcon } from "@/lib/types/filter-presets";
import { type BestOddsPrefs } from "@/lib/best-odds-schema";
import { isMarketSelected } from "@/lib/utils";

// All supported sports for broad fetching in preset mode
const ALL_SPORTS: Sport[] = ["nba", "nfl", "nhl", "mlb", "ncaaf", "ncaab", "wnba", "soccer_epl"];

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return toStringArray(JSON.parse(trimmed));
      } catch {
        // Ignore parse errors and continue fallback parsing.
      }
    }

    if (trimmed.includes(",")) {
      return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

function toNumberRecord(value: unknown): Record<string, number[]> {
  const normalize = (raw: unknown): Record<string, number[]> => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const out: Record<string, number[]> = {};
    for (const [key, arr] of Object.entries(raw as Record<string, unknown>)) {
      if (!Array.isArray(arr)) continue;
      const nums = arr
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
      if (nums.length > 0) out[key] = nums;
    }
    return out;
  };

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return normalize(JSON.parse(trimmed));
    } catch {
      return {};
    }
  }

  return normalize(value);
}

function toNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

interface UseMultiFilterOptions {
  /**
   * Global user preferences (books to exclude, min edge, search, etc.)
   */
  prefs: BestOddsPrefs;
  /**
   * Active custom filter presets
   */
  activePresets: FilterPreset[];
  /**
   * Whether user has pro access
   */
  isPro: boolean;
  /**
   * Optional result limit override (default: 200 for Pro, 50 for free)
   */
  limit?: number;
  /**
   * Enable/disable the query
   */
  enabled?: boolean;
}

interface UseMultiFilterResult {
  // Data
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
  
  // Active filters info
  activeFilters: FilterConfig[];
  isCustomMode: boolean;
  
  // State
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  
  /** Timestamp of last successful data fetch (for freshness indicator) */
  dataUpdatedAt: number | null;
  /** Whether data is stale and being refreshed in background */
  isStale: boolean;
  /** Progressive loading: true when initial batch loaded but full batch still loading */
  isLoadingMore: boolean;
  /** Progressive loading: percentage of full data loaded (0-100) */
  loadProgress: number;
  
  // Actions
  refetch: () => Promise<void>;
  /** Prefetch data for a preset (call on hover for faster activation) */
  prefetchPreset: (preset: FilterPreset) => Promise<void>;
}

// Progressive loading configuration
const INITIAL_BATCH_SIZE = 50; // Show first 50 results fast
const FULL_BATCH_SIZE = 500; // Then load all in background

/**
 * Build filter configurations from active presets
 * 
 * HYBRID APPROACH for Preset Mode:
 * - Fetches ALL sports, ALL market types with broad odds range
 * - Client-side filtering for sports, markets, odds (instant changes)
 * - Only comparison mode changes trigger new API calls
 */
function buildFilterConfigs(
  prefs: BestOddsPrefs,
  activePresets: FilterPreset[],
  isPro: boolean,
  limit: number
): FilterConfig[] {
  const leagueToSport: Record<string, Sport> = {
    nba: "nba",
    nfl: "nfl",
    ncaaf: "ncaaf",
    ncaab: "ncaab",
    nhl: "nhl",
    mlb: "mlb",
    wnba: "wnba",
    soccer_epl: "soccer_epl",
  };

  // If no active presets, use preset mode (single filter from prefs)
  // HYBRID: Fetch broader data for client-side filtering
  if (activePresets.length === 0) {
    let preset: string | null = null;
    let filterName: string;

    // Map comparison mode to preset and generate filter name
    if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
      preset = prefs.comparisonBook;
      const book = getSportsbookById(prefs.comparisonBook);
      filterName = `vs ${book?.name || prefs.comparisonBook}`;
    } else if (prefs.comparisonMode === "next_best") {
      preset = "next_best";
      filterName = "vs Next Best";
    } else {
      preset = "average";
      filterName = "vs Average";
    }

    // HYBRID: Fetch ALL sports, ALL market types
    // Use user preferences for odds range when set, otherwise use broad fallback
    const broadLimit = isPro ? Math.max(limit, 500) : Math.max(limit, 100);
    
    // Use user's preferences for odds if set, otherwise use broad defaults
    const serverMinOdds = prefs.minOdds ?? -10000;
    const serverMaxOdds = prefs.maxOdds ?? 20000;

    const safeMarketLines = toNumberRecord(prefs.marketLines as unknown);

    return [{
      filters: {
        ...DEFAULT_FILTERS,
        sports: ALL_SPORTS, // Fetch ALL sports
        preset,
        blend: null,
        limit: broadLimit, // Larger batch for client-side filtering
        minEdge: 0, // Fetch all edges, filter client-side
        minOdds: serverMinOdds, // Use user preference or broad fallback
        maxOdds: serverMaxOdds, // Use user preference or broad fallback
        searchQuery: "", // Search is client-side
        selectedBooks: [], // Book exclusions are client-side
        selectedMarkets: [], // Send empty to get ALL markets
        selectedLeagues: [], // Sport filtering is client-side
        marketLines: safeMarketLines, // Market lines stay server-side (specific line filters)
        minBooksPerSide: 2,
        requireFullBlend: false,
        marketType: "all", // Fetch both player and game, filter client-side
      },
      metadata: {
        filterId: "default",
        filterName,
        filterIcon: ALL_SPORTS.join(","),
        isCustom: false,
        filterColor: null,
      },
    }];
  }

  // Build filter configs for each active preset
  // For multi-sport presets, split into separate configs per sport for balanced results
  const configs: FilterConfig[] = [];
  
  for (const preset of activePresets) {
    const presetSports = parseSports(typeof preset.sport === "string" ? preset.sport : "");
    // Convert to lowercase for mapping (handles both "NBA" and "nba")
    const sports = presetSports
      .map(s => leagueToSport[s.toLowerCase()])
      .filter((s): s is Sport => !!s);
    
    // Build blend from preset's sharp_books and book_weights
    const presetSharpBooks = toStringArray((preset as any).sharp_books);
    const presetBookWeights = toNumberMap((preset as any).book_weights);
    let blend: Array<{ book: string; weight: number }> | null = null;
    if (presetSharpBooks.length > 0) {
      const weights = presetBookWeights;
      if (weights && Object.keys(weights).length > 0) {
        blend = presetSharpBooks.map(book => ({
          book,
          weight: (weights[book] || 0) / 100,
        })).filter(b => b.weight > 0);
        
        const totalWeight = blend.reduce((sum, b) => sum + b.weight, 0);
        if (totalWeight > 0) {
          blend = blend.map(b => ({ ...b, weight: b.weight / totalWeight }));
        }
      } else {
        const weight = 1 / presetSharpBooks.length;
        blend = presetSharpBooks.map(book => ({ book, weight }));
      }
    }

    // Use preset's custom markets if defined, otherwise use global or empty
    const presetMarkets = toStringArray((preset as any).markets);
    
    const validSports = sports.length > 0 ? sports : ["nba"] as Sport[];
    
    // For multi-sport presets, create separate configs per sport for balanced results
    if (validSports.length > 1) {
      // Split limit evenly across sports (with minimum of 50 per sport)
      const perSportLimit = Math.max(50, Math.floor(limit / validSports.length));
      
      console.log(`[useMultiFilter] Multi-sport preset "${preset.name}" - splitting into ${validSports.length} separate fetches (${perSportLimit} per sport)`);
      
      for (const sport of validSports) {
        configs.push({
          filters: {
            ...DEFAULT_FILTERS,
            sports: [sport],
            preset: null,
            blend,
            limit: perSportLimit,
            minEdge: prefs.minImprovement || 0,
            minOdds: preset.min_odds ?? -500,
            maxOdds: preset.max_odds ?? 500,
            searchQuery: prefs.searchQuery || "",
            selectedBooks: prefs.selectedBooks || [],
            selectedMarkets: presetMarkets,
            selectedLeagues: [],
            marketLines: {},
            minBooksPerSide: preset.min_books_reference || 2,
            requireFullBlend: preset.fallback_mode !== "use_fallback",
            marketType: preset.market_type || "all",
          },
          metadata: {
            filterId: preset.id,
            filterName: preset.name,
            filterIcon: validSports.join(","), // Keep full icon list for display
            isCustom: true,
            filterColor: preset.color || DEFAULT_FILTER_COLOR,
          },
        });
      }
    } else {
      // Single sport - create one config
      console.log(`[useMultiFilter] Building config for preset "${preset.name}":`, {
        sports: validSports,
        presetMarkets: presetMarkets.length > 0 ? presetMarkets : '(all markets)',
        marketType: preset.market_type,
        blendBooks: blend?.map(b => b.book),
      });

      configs.push({
        filters: {
          ...DEFAULT_FILTERS,
          sports: validSports,
          preset: null,
          blend,
          limit,
          minEdge: prefs.minImprovement || 0,
          minOdds: preset.min_odds ?? -500,
          maxOdds: preset.max_odds ?? 500,
          searchQuery: prefs.searchQuery || "",
          selectedBooks: prefs.selectedBooks || [],
          selectedMarkets: presetMarkets,
          selectedLeagues: [],
          marketLines: {},
          minBooksPerSide: preset.min_books_reference || 2,
          requireFullBlend: preset.fallback_mode !== "use_fallback",
          marketType: preset.market_type || "all",
        },
        metadata: {
          filterId: preset.id,
          filterName: preset.name,
          filterIcon: validSports.join(","),
          isCustom: true,
          filterColor: preset.color || DEFAULT_FILTER_COLOR,
        },
      });
    }
  }
  
  return configs;
}

/**
 * Build query params from filters
 */
function buildQueryParams(filters: OpportunityFilters, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }

  const selectedMarkets = toStringArray(filters.selectedMarkets as unknown);
  if (selectedMarkets.length > 0) {
    console.log(`[useMultiFilter] Sending ${selectedMarkets.length} markets to API:`, selectedMarkets.slice(0, 5), selectedMarkets.length > 5 ? '...' : '');
    params.set("markets", selectedMarkets.join(","));
  } else {
    console.log(`[useMultiFilter] No market filter - will return all markets`);
  }

  if (filters.blend && filters.blend.length > 0) {
    params.set("blend", filters.blend.map((b) => `${b.book}:${b.weight}`).join(","));
  } else if (filters.preset) {
    params.set("preset", filters.preset);
  }

  if (filters.minEdge > 0) params.set("minEdge", String(filters.minEdge));
  if (filters.minEV !== null) params.set("minEV", String(filters.minEV));
  if (filters.requireTwoWay) params.set("requireTwoWay", "true");
  if (filters.requireFullBlend) params.set("requireFullBlend", "true");
  if (filters.marketType && filters.marketType !== "all") {
    params.set("marketType", filters.marketType);
  }
  
  // Market line filters (e.g., {"touchdowns": [0.5]} to only show "Anytime" touchdowns)
  const marketLines = toNumberRecord(filters.marketLines as unknown);
  if (Object.keys(marketLines).length > 0) {
    params.set("marketLines", JSON.stringify(marketLines));
  }
  
  params.set("minBooksPerSide", String(filters.minBooksPerSide));

  // Always send odds range (server defaults may differ)
  params.set("minOdds", String(filters.minOdds));
  params.set("maxOdds", String(filters.maxOdds));

  const sortValue = filters.sortBy === "ev_pct" ? "ev" : "edge";
  params.set("sort", sortValue);
  params.set("limit", String(filters.limit || (isPro ? 200 : 50)));

  return params;
}

/**
 * Fetch opportunities for a single filter
 * Supports AbortController for request cancellation (billion-dollar UX)
 */
async function fetchFilterOpportunities(
  config: FilterConfig,
  isPro: boolean,
  signal?: AbortSignal
): Promise<{
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
  config: FilterConfig;
}> {
  const params = buildQueryParams(config.filters, isPro);
  const url = `/api/v2/opportunities?${params.toString()}`;

  const response = await fetch(url, { 
    cache: "no-store",
    signal, // Support request cancellation
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
  }

  const data = await response.json();

  // Parse and tag each opportunity with filter metadata
  const opportunities = (data.opportunities || []).map((raw: Record<string, unknown>) => {
    const opp = parseOpportunity(raw);
    return {
      ...opp,
      filterId: config.metadata.filterId,
      filterName: config.metadata.filterName,
      filterIcon: config.metadata.filterIcon,
      filterColor: config.metadata.filterColor,
    };
  });

  return {
    opportunities,
    totalScanned: data.total_scanned || 0,
    totalAfterFilters: data.total_after_filters || 0,
    timingMs: data.timing_ms || 0,
    config,
  };
}

/**
 * Merge opportunities from multiple filters
 * - Deduplicates by keeping the one with best edge
 * - Preserves filter metadata for display
 */
function mergeOpportunities(
  results: Array<{
    opportunities: Opportunity[];
    config: FilterConfig;
  }>
): Opportunity[] {
  // Map by unique opportunity key
  const oppMap = new Map<string, Opportunity>();

  for (const result of results) {
    for (const opp of result.opportunities) {
      // Create unique key for deduplication
      // Key: eventId + player + market + line + side
      const key = `${opp.eventId}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
      
      const existing = oppMap.get(key);
      
      if (!existing) {
        // First time seeing this opportunity
        oppMap.set(key, opp);
      } else {
        // Duplicate - keep the one with better edge
        const existingEdge = existing.edgePct ?? -Infinity;
        const newEdge = opp.edgePct ?? -Infinity;
        
        if (newEdge > existingEdge) {
          oppMap.set(key, opp);
        }
      }
    }
  }

  // Sort by edge descending after merging
  return Array.from(oppMap.values()).sort((a, b) => {
    const edgeA = a.edgePct ?? -Infinity;
    const edgeB = b.edgePct ?? -Infinity;
    return edgeB - edgeA;
  });
}

/**
 * Apply global filters (book exclusions, search, etc.)
 * 
 * HYBRID APPROACH: These filters run client-side for instant response
 * - Sports selection
 * - Market type (player/game)
 * - Min/max odds
 * - Min edge
 * - Book exclusions
 * - Search
 */
function applyGlobalFilters(
  opportunities: Opportunity[],
  prefs: BestOddsPrefs,
  isCustomMode: boolean
): Opportunity[] {
  const leagueToSport: Record<string, string> = {
    nba: "nba",
    nfl: "nfl",
    ncaaf: "ncaaf",
    ncaab: "ncaab",
    nhl: "nhl",
    mlb: "mlb",
    wnba: "wnba",
    soccer_epl: "soccer_epl",
  };
  
  // Build set of selected sports for fast lookup
  const selectedSports = new Set<string>();
  const selectedLeagues = toStringArray(prefs.selectedLeagues as unknown);
  if (selectedLeagues.length > 0) {
    for (const league of selectedLeagues) {
      const sport = leagueToSport[league.toLowerCase()];
      if (sport) selectedSports.add(sport);
    }
  }
  const selectedBooks = toStringArray(prefs.selectedBooks as unknown);
  const selectedMarkets = toStringArray(prefs.selectedMarkets as unknown);
  
  return opportunities.filter((opp) => {
    // HYBRID: Sport filter (client-side for preset mode)
    // Only filter if user has selected specific leagues
    if (!isCustomMode && selectedSports.size > 0) {
      const oppSport = (opp.sport || "").toLowerCase();
      if (!selectedSports.has(oppSport)) return false;
    }
    
    // HYBRID: Min edge filter (client-side)
    // Skip for custom mode - custom presets handle their own filtering server-side
    if (!isCustomMode && prefs.minImprovement && prefs.minImprovement > 0) {
      if ((opp.edgePct || 0) < prefs.minImprovement) return false;
    }
    
    // HYBRID: Odds range filter (client-side)
    // Skip for custom mode - custom presets have their own min/max odds that were applied server-side
    if (!isCustomMode) {
      // Default to very permissive range if user hasn't set preferences
      const minOdds = prefs.minOdds ?? -10000;
      const maxOdds = prefs.maxOdds ?? 20000;
      const oppOdds =
        typeof opp.bestPrice === "string"
          ? Number.parseInt(opp.bestPrice, 10) || 0
          : 0;
      if (oppOdds < minOdds || oppOdds > maxOdds) return false;
    }
    
    // HYBRID: Selected markets filter (client-side)
    // Empty = all markets selected
    if (!isCustomMode && selectedMarkets.length > 0) {
      if (!isMarketSelected(selectedMarkets, opp.sport || "", opp.market || "")) {
        return false;
      }
    }
    
    // Search filter
    if (prefs.searchQuery) {
      const q = prefs.searchQuery.toLowerCase();
      const matches =
        (opp.player || "").toLowerCase().includes(q) ||
        (opp.homeTeam || "").toLowerCase().includes(q) ||
        (opp.awayTeam || "").toLowerCase().includes(q) ||
        (opp.market || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Book exclusions (selectedBooks contains EXCLUDED books)
    // Only filter out if ALL books with the best odds are excluded
    if (selectedBooks.length > 0) {
      // Get all books that have the best (same) odds
      const booksWithBestOdds = (opp.allBooks || []).filter(b => b.decimal === opp.bestDecimal);
      
      // Check if at least one book with best odds is NOT excluded
      const hasSelectedBookWithBestOdds = booksWithBestOdds.some(b => {
        const normalizedBook = normalizeSportsbookId(b.book);
        return !selectedBooks.includes(normalizedBook);
      });
      
      // If all books with best odds are excluded, filter out this opportunity
      if (!hasSelectedBookWithBestOdds) return false;
    }

    // College player props filter
    if (prefs.hideCollegePlayerProps) {
      const isCollege = opp.sport === "ncaaf" || opp.sport === "ncaab";
      const isPlayerProp = opp.player && opp.player !== "" && opp.player.toLowerCase() !== "game";
      if (isCollege && isPlayerProp) return false;
    }

    return true;
  });
}

/**
 * Main hook for multi-filter opportunities
 * 
 * HYBRID APPROACH:
 * - Preset Mode: Query key only changes on comparison mode change
 *   Sports, markets, odds filtered client-side for instant response
 * - Custom Mode: Query key changes on preset changes (server-side blend calculations)
 */
export function useMultiFilterOpportunities({
  prefs,
  activePresets,
  isPro,
  limit,
  enabled = true,
}: UseMultiFilterOptions): UseMultiFilterResult {
  const queryClient = useQueryClient();

  const effectiveLimit = limit ?? (isPro ? 200 : 50);
  const isCustomMode = activePresets.length > 0;
  
  // PROGRESSIVE LOADING: Use smaller batch for initial fast load
  const useProgressiveLoading = effectiveLimit > INITIAL_BATCH_SIZE && isPro;
  const initialLimit = useProgressiveLoading ? INITIAL_BATCH_SIZE : effectiveLimit;
  const fullLimit = useProgressiveLoading ? Math.min(effectiveLimit, FULL_BATCH_SIZE) : effectiveLimit;

  // Build filter configs - one for initial fast load, one for full load
  const initialFilterConfigs = useMemo(
    () => buildFilterConfigs(prefs, activePresets, isPro, initialLimit),
    [activePresets, isPro, initialLimit, prefs.comparisonMode, prefs.comparisonBook, prefs.marketLines]
  );
  
  const fullFilterConfigs = useMemo(
    () => buildFilterConfigs(prefs, activePresets, isPro, fullLimit),
    [activePresets, isPro, fullLimit, prefs.comparisonMode, prefs.comparisonBook, prefs.marketLines]
  );
  
  // For backwards compatibility, expose the full configs
  const filterConfigs = fullFilterConfigs;

  // Build query keys for both initial and full queries
  const buildQueryKey = useCallback((phase: "initial" | "full") => {
    const configs = phase === "initial" ? initialFilterConfigs : fullFilterConfigs;
    if (isCustomMode) {
      return [
        "multi-filter-opportunities",
        phase,
        "custom",
        configs.map(c => JSON.stringify({
          ...c.filters,
          id: c.metadata.filterId,
        })),
        isPro,
      ];
    } else {
      return [
        "multi-filter-opportunities",
        phase,
        "preset",
        prefs.comparisonMode,
        prefs.comparisonBook || "none",
        JSON.stringify(prefs.marketLines || {}),
        prefs.minOdds ?? -10000,
        prefs.maxOdds ?? 20000,
        isPro,
      ];
    }
  }, [isCustomMode, initialFilterConfigs, fullFilterConfigs, prefs.comparisonMode, prefs.comparisonBook, prefs.marketLines, prefs.minOdds, prefs.maxOdds, isPro]);

  const initialQueryKey = useMemo(() => buildQueryKey("initial"), [buildQueryKey]);
  const fullQueryKey = useMemo(() => buildQueryKey("full"), [buildQueryKey]);

  // PROGRESSIVE LOADING: Phase 1 - Fast initial batch
  const {
    data: initialData,
    isLoading: isLoadingInitial,
    isFetching: isFetchingInitial,
    error: initialError,
    dataUpdatedAt: initialDataUpdatedAt,
    isStale: isStaleInitial,
  } = useQuery({
    queryKey: initialQueryKey,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        initialFilterConfigs.map(config => fetchFilterOpportunities(config, isPro, signal))
      );
      const merged = mergeOpportunities(results);
      return {
        opportunities: merged,
        totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
        totalAfterFilters: merged.length,
        timingMs: Math.max(...results.map(r => r.timingMs)),
      };
    },
    staleTime: isCustomMode ? 45_000 : 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
    retry: 3,
    enabled,
  });

  // PROGRESSIVE LOADING: Phase 2 - Full batch in background
  // Only starts AFTER initial batch is loaded
  const {
    data: fullData,
    isLoading: isLoadingFull,
    isFetching: isFetchingFull,
    error: fullError,
    refetch: fullRefetch,
    dataUpdatedAt: fullDataUpdatedAt,
    isStale: isStaleFull,
  } = useQuery({
    queryKey: fullQueryKey,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        fullFilterConfigs.map(config => fetchFilterOpportunities(config, isPro, signal))
      );
      const merged = mergeOpportunities(results);
      return {
        opportunities: merged,
        totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
        totalAfterFilters: merged.length,
        timingMs: Math.max(...results.map(r => r.timingMs)),
      };
    },
    staleTime: isCustomMode ? 45_000 : 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
    retry: 3,
    // Only fetch full batch after initial is done (or if not using progressive loading)
    enabled: enabled && (!useProgressiveLoading || !!initialData),
  });

  // Combine data: Use full data if available, otherwise initial
  const data = fullData || initialData;
  const isLoading = isLoadingInitial;
  const isFetching = isFetchingInitial || isFetchingFull;
  const error = fullError || initialError;
  const dataUpdatedAt = fullDataUpdatedAt || initialDataUpdatedAt;
  const isStale = useProgressiveLoading ? isStaleFull : isStaleInitial;
  
  // Progressive loading state
  const isLoadingMore = useProgressiveLoading && !!initialData && isLoadingFull;
  const loadProgress = useProgressiveLoading 
    ? (fullData ? 100 : initialData ? Math.round((INITIAL_BATCH_SIZE / fullLimit) * 100) : 0)
    : 100;

  // Refetch function that refetches both queries
  const queryRefetch = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: initialQueryKey }),
      queryClient.invalidateQueries({ queryKey: fullQueryKey }),
    ]);
  }, [queryClient, initialQueryKey, fullQueryKey]);

  // OPTIMIZATION: Prefetch function for presets on hover
  const prefetchPreset = useCallback(async (preset: FilterPreset) => {
    // Build configs for this preset
    const presetConfigs = buildFilterConfigs(prefs, [preset], isPro, effectiveLimit);
    const presetQueryKey = [
      "multi-filter-opportunities",
      "custom",
      presetConfigs.map(c => JSON.stringify({
        ...c.filters,
        id: c.metadata.filterId,
      })),
      isPro,
    ];

    // Check if data is already cached and fresh
    const cachedData = queryClient.getQueryData(presetQueryKey);
    if (cachedData) return; // Already cached

    // Prefetch in background
    await queryClient.prefetchQuery({
      queryKey: presetQueryKey,
      queryFn: async () => {
        const results = await Promise.all(
          presetConfigs.map(config => fetchFilterOpportunities(config, isPro))
        );
        const merged = mergeOpportunities(results);
        return {
          opportunities: merged,
          totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
          totalAfterFilters: merged.length,
          timingMs: Math.max(...results.map(r => r.timingMs)),
        };
      },
      staleTime: 45_000, // Same as custom mode
    });
  }, [prefs, isPro, effectiveLimit, queryClient]);

  // HYBRID: Apply client-side filters for instant response
  // This includes sports, markets, odds, search, book exclusions
  const opportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    return applyGlobalFilters(data.opportunities, prefs, isCustomMode);
  }, [data?.opportunities, prefs, isCustomMode]);

  // Sort by edge (best first)
  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => (b.edgePct || 0) - (a.edgePct || 0));
  }, [opportunities]);

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    opportunities: sortedOpportunities,
    totalScanned: data?.totalScanned || 0,
    totalAfterFilters: data?.totalAfterFilters || 0,
    timingMs: data?.timingMs || 0,
    activeFilters: filterConfigs,
    isCustomMode,
    isLoading,
    isFetching,
    error: error as Error | null,
    dataUpdatedAt: dataUpdatedAt || null,
    isStale,
    isLoadingMore,
    loadProgress,
    refetch,
    prefetchPreset,
  };
}
