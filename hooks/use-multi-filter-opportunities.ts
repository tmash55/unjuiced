/**
 * Hook for fetching opportunities with multiple filter support
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
import { type FilterPreset, parseSports, getSportIcon } from "@/lib/types/filter-presets";
import { type BestOddsPrefs } from "@/lib/best-odds-schema";

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
  
  // Actions
  refetch: () => Promise<void>;
}

/**
 * Build filter configurations from active presets
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
  };

  // If no active presets, use preset mode (single filter from prefs)
  if (activePresets.length === 0) {
    let sports: Sport[];
    let preset: string | null = null;
    let filterName: string;

    // Derive sports from selected leagues
    if (prefs.selectedLeagues.length > 0) {
      sports = [...new Set(
        prefs.selectedLeagues
          .map(l => leagueToSport[l])
          .filter((s): s is Sport => !!s)
      )];
    } else {
      sports = ["nba", "nfl"];
    }

    // Map comparison mode to preset and generate filter name
    if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
      preset = prefs.comparisonBook;
      // Get the sportsbook display name
      const book = getSportsbookById(prefs.comparisonBook);
      filterName = `vs ${book?.name || prefs.comparisonBook}`;
    } else if (prefs.comparisonMode === "next_best") {
      preset = "next_best";
      filterName = "vs Next Best";
    } else {
      preset = "average";
      filterName = "vs Average";
    }

    return [{
      filters: {
        ...DEFAULT_FILTERS,
        sports,
        preset,
        blend: null,
        limit,
        minEdge: prefs.minImprovement || 0,
        minOdds: prefs.minOdds ?? -500,
        maxOdds: prefs.maxOdds ?? 500,
        searchQuery: prefs.searchQuery || "",
        selectedBooks: prefs.selectedBooks || [],
        selectedMarkets: prefs.selectedMarkets || [],
        selectedLeagues: prefs.selectedLeagues || [],
        marketLines: prefs.marketLines || {}, // Pass global market line filters
        minBooksPerSide: 2,
        requireFullBlend: false,
        marketType: "all",
      },
      metadata: {
        filterId: "default",
        filterName,
        filterIcon: sports.join(","),
        isCustom: false,
      },
    }];
  }

  // Build filter configs for each active preset
  // For multi-sport presets, split into separate configs per sport for balanced results
  const configs: FilterConfig[] = [];
  
  for (const preset of activePresets) {
    const presetSports = parseSports(preset.sport);
    // Convert to lowercase for mapping (handles both "NBA" and "nba")
    const sports = presetSports
      .map(s => leagueToSport[s.toLowerCase()])
      .filter((s): s is Sport => !!s);
    
    // Build blend from preset's sharp_books and book_weights
    let blend: Array<{ book: string; weight: number }> | null = null;
    if (preset.sharp_books && preset.sharp_books.length > 0) {
      const weights = preset.book_weights;
      if (weights && Object.keys(weights).length > 0) {
        blend = preset.sharp_books.map(book => ({
          book,
          weight: (weights[book] || 0) / 100,
        })).filter(b => b.weight > 0);
        
        const totalWeight = blend.reduce((sum, b) => sum + b.weight, 0);
        if (totalWeight > 0) {
          blend = blend.map(b => ({ ...b, weight: b.weight / totalWeight }));
        }
      } else {
        const weight = 1 / preset.sharp_books.length;
        blend = preset.sharp_books.map(book => ({ book, weight }));
      }
    }

    // Use preset's custom markets if defined, otherwise use global or empty
    const presetMarkets = preset.markets && preset.markets.length > 0 ? preset.markets : [];
    
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

  if (filters.selectedMarkets.length > 0) {
    console.log(`[useMultiFilter] Sending ${filters.selectedMarkets.length} markets to API:`, filters.selectedMarkets.slice(0, 5), filters.selectedMarkets.length > 5 ? '...' : '');
    params.set("markets", filters.selectedMarkets.join(","));
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
  if (filters.marketLines && Object.keys(filters.marketLines).length > 0) {
    params.set("marketLines", JSON.stringify(filters.marketLines));
  }
  
  params.set("minBooksPerSide", String(filters.minBooksPerSide));

  if (filters.minOdds !== -500) params.set("minOdds", String(filters.minOdds));
  if (filters.maxOdds !== 500) params.set("maxOdds", String(filters.maxOdds));

  const sortValue = filters.sortBy === "ev_pct" ? "ev" : "edge";
  params.set("sort", sortValue);
  params.set("limit", String(filters.limit || (isPro ? 200 : 50)));

  return params;
}

/**
 * Fetch opportunities for a single filter
 */
async function fetchFilterOpportunities(
  config: FilterConfig,
  isPro: boolean
): Promise<{
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
  config: FilterConfig;
}> {
  const params = buildQueryParams(config.filters, isPro);
  const url = `/api/v2/opportunities?${params.toString()}`;

  const response = await fetch(url, { cache: "no-store" });

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
 */
function applyGlobalFilters(
  opportunities: Opportunity[],
  prefs: BestOddsPrefs
): Opportunity[] {
  // Debug: log search info
  if (prefs.searchQuery) {
    const q = prefs.searchQuery.toLowerCase();
    console.log(`[Search] Searching for "${q}" in ${opportunities.length} opportunities`);
    
    // Sample a few player names for debugging
    const samplePlayers = opportunities.slice(0, 20).map(o => o.player).filter(Boolean);
    console.log('[Search] Sample player names:', samplePlayers);
    
    const matchingOpps = opportunities.filter(opp => {
      const playerMatch = (opp.player || "").toLowerCase().includes(q);
      const homeMatch = (opp.homeTeam || "").toLowerCase().includes(q);
      const awayMatch = (opp.awayTeam || "").toLowerCase().includes(q);
      const marketMatch = (opp.market || "").toLowerCase().includes(q);
      return playerMatch || homeMatch || awayMatch || marketMatch;
    });
    console.log(`[Search] Found ${matchingOpps.length} matches`);
  }
  
  return opportunities.filter((opp) => {
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
    if (prefs.selectedBooks.length > 0) {
      // Get all books that have the best (same) odds
      const booksWithBestOdds = (opp.allBooks || []).filter(b => b.decimal === opp.bestDecimal);
      
      // Check if at least one book with best odds is NOT excluded
      const hasSelectedBookWithBestOdds = booksWithBestOdds.some(b => {
        const normalizedBook = normalizeSportsbookId(b.book);
        return !prefs.selectedBooks.includes(normalizedBook);
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

  // Build filter configs from active presets
  const filterConfigs = useMemo(
    () => buildFilterConfigs(prefs, activePresets, isPro, effectiveLimit),
    [prefs, activePresets, isPro, effectiveLimit]
  );

  const isCustomMode = activePresets.length > 0;

  // Query key includes all filter configs
  const queryKey = useMemo(
    () => [
      "multi-filter-opportunities",
      filterConfigs.map(c => JSON.stringify({
        ...c.filters,
        id: c.metadata.filterId,
      })),
      isPro,
    ],
    [filterConfigs, isPro]
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      // Fetch all filters in parallel
      const results = await Promise.all(
        filterConfigs.map(config => fetchFilterOpportunities(config, isPro))
      );

      // Merge opportunities (best edge wins for duplicates)
      const merged = mergeOpportunities(results);

      // Calculate totals
      const totalScanned = results.reduce((sum, r) => sum + r.totalScanned, 0);
      const totalAfterFilters = merged.length;
      const timingMs = Math.max(...results.map(r => r.timingMs));

      return {
        opportunities: merged,
        totalScanned,
        totalAfterFilters,
        timingMs,
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev) => prev,
    retry: 3,
    enabled,
  });

  // Apply global filters (book exclusions, search, etc.)
  const opportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    return applyGlobalFilters(data.opportunities, prefs);
  }, [data?.opportunities, prefs]);

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
    refetch,
  };
}

