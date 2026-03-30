/**
 * Hook for fetching +EV opportunities with multiple custom model support
 * 
 * Similar to useMultiFilterOpportunities for Edge Finder:
 * - Preset Mode: Uses standard sharp preset (e.g., market_average, pinnacle)
 * - Custom Mode: Parallel API calls for each active EV model, merges results
 * 
 * Handles parallel API calls for multiple active custom EV models,
 * merges results, and deduplicates (best EV wins).
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import type {
  PositiveEVOpportunity,
  PositiveEVResponse,
  SharpPreset,
  DevigMethod,
  EVMode,
} from "@/lib/ev/types";
import {
  DEFAULT_DEVIG_METHODS,
  POSITIVE_EV_DEFAULTS,
} from "@/lib/ev/constants";
import { calculateMultiEV } from "@/lib/ev/devig";
import {
  DEFAULT_MODEL_COLOR,
  EV_MODEL_EMPTY_SPORT_MARKET,
  type EvModel,
  parseEvSports,
  parseEvModelSportMarketKey,
} from "@/lib/types/ev-models";
import { normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { isMarketSelected } from "@/lib/utils";

// All supported sports
const ALL_SPORTS = [
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaaf",
  "ncaab",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
];
const PRESET_STALE_TIME_MS = 5_000;
const CUSTOM_STALE_TIME_MS = 45_000;

// =============================================================================
// Types
// =============================================================================

export interface PositiveEVPrefs {
  /** Sports to fetch */
  selectedSports: string[];
  /** Sharp preset (used when no custom models) */
  sharpPreset: SharpPreset;
  /** Devig methods */
  devigMethods: DevigMethod[];
  /** Minimum EV% */
  minEv: number;
  /** Maximum EV% */
  maxEv?: number;
  /** Books to show (exclusion filter applied client-side) */
  selectedBooks: string[];
  /** Markets to show */
  selectedMarkets: string[];
  /** Mode: pregame, live, all */
  mode: EVMode;
  /** Minimum books per side */
  minBooksPerSide: number;
  /** Minimum American odds filter */
  minOdds?: number | null;
  /** Maximum American odds filter */
  maxOdds?: number | null;
  /** Search query */
  searchQuery?: string;
}

export interface EVModelConfig {
  /** Filter parameters for API */
  filters: {
    sports: string[];
    sharpPreset: SharpPreset | null;
    customSharpBooks: string[] | null;
    customBookWeights: Record<string, number> | null;
    devigMethods: DevigMethod[];
    minEV: number;
    maxEV?: number;
    minOdds?: number;
    maxOdds?: number;
    markets: string[] | null;
    marketType: "all" | "player" | "game";
    mode: EVMode;
    minBooksPerSide: number;
    limit: number;
  };
  /** Metadata for display */
  metadata: {
    modelId: string;
    modelName: string;
    isCustom: boolean;
    modelColor?: string | null;
  };
}

export interface UseMultiEvModelOptions {
  /** User preferences */
  prefs: PositiveEVPrefs;
  /** Active custom EV models */
  activeModels: EvModel[];
  /** Whether user has pro access */
  isPro: boolean;
  /** Result limit */
  limit?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseMultiEvModelResult {
  /** Filtered opportunities */
  opportunities: PositiveEVOpportunity[];
  /** Total found before limit */
  totalFound: number;
  /** Total returned */
  totalReturned: number;
  /** Response metadata for preset mode */
  meta: PositiveEVResponse["meta"] | null;
  
  /** Active model configs */
  activeConfigs: EVModelConfig[];
  /** Whether using custom models */
  isCustomMode: boolean;
  
  /** Loading state */
  isLoading: boolean;
  /** Fetching state */
  isFetching: boolean;
  /** Error */
  error: Error | null;
  
  /** Data updated timestamp */
  dataUpdatedAt: number | null;
  /** Whether data is stale */
  isStale: boolean;
  
  /** Refetch */
  refetch: () => Promise<void>;
  /** Fresh refetch (bypasses server cache) */
  freshRefetch: () => Promise<void>;
  /** Prefetch model on hover */
  prefetchModel: (model: EvModel) => Promise<void>;
}

// =============================================================================
// Build Model Configs
// =============================================================================

/**
 * Build EVModelConfig array from active models or preset
 */
function buildModelConfigs(
  prefs: PositiveEVPrefs,
  activeModels: EvModel[],
  isPro: boolean,
  limit: number
): EVModelConfig[] {
  // Safety: if user doesn't have pro (Elite) access, ignore custom models
  // Custom models require Elite plan – the server would 403 anyway
  if (!isPro && activeModels.length > 0) {
    console.warn("[useMultiEvModel] Custom models require Elite access – falling back to preset mode");
  }
  
  // If no active models (or not Elite), use preset mode (standard fetch)
  if (activeModels.length === 0 || !isPro) {
    return [{
      filters: {
        sports: prefs.selectedSports.length > 0 ? prefs.selectedSports : ALL_SPORTS,
        sharpPreset: prefs.sharpPreset,
        customSharpBooks: null,
        customBookWeights: null,
        devigMethods: prefs.devigMethods,
        minEV: prefs.minEv,
        maxEV: prefs.maxEv,
        markets: null, // Market filtering is client-side only
        marketType: "all",
        mode: prefs.mode,
        minBooksPerSide: prefs.minBooksPerSide,
        minOdds: prefs.minOdds ?? undefined,
        maxOdds: prefs.maxOdds ?? undefined,
        limit,
      },
      metadata: {
        modelId: "default",
        modelName: prefs.sharpPreset,
        isCustom: false,
        modelColor: null,
      },
    }];
  }

  // Build configs for each active model
  const configs: EVModelConfig[] = [];
  
  for (const model of activeModels) {
    const modelSports = parseEvSports(model.sport);
    const sports = modelSports.length > 0 
      ? modelSports 
      : (prefs.selectedSports.length > 0 ? prefs.selectedSports : ALL_SPORTS);
    const parsedCompositeMarkets = (model.markets || [])
      .map(parseEvModelSportMarketKey)
      .filter((value): value is { sport: string; market: string } => value !== null);
    const hasCompositeMarkets = parsedCompositeMarkets.length > 0;
    const perSportLimit = Math.max(1, Math.ceil(limit / activeModels.length / Math.max(1, sports.length)));
    
    console.log(`[useMultiEvModel] Building config for model "${model.name}":`, {
      sports,
      sharpBooks: model.sharp_books,
      weights: model.book_weights,
      marketType: model.market_type,
      markets: model.markets,
      hasCompositeMarkets,
    });

    if (hasCompositeMarkets) {
      sports.forEach((sport) => {
        const sportEntries = parsedCompositeMarkets.filter((entry) => entry.sport === sport);
        const sportMarkets = sportEntries
          .map((entry) => entry.market)
          .filter((market) => market !== EV_MODEL_EMPTY_SPORT_MARKET);
        const hasSportCustomization = sportEntries.length > 0;

        if (hasSportCustomization && sportMarkets.length === 0) {
          return;
        }

        configs.push({
          filters: {
            sports: [sport],
            sharpPreset: null,
            customSharpBooks: model.sharp_books,
            customBookWeights: model.book_weights,
            devigMethods: prefs.devigMethods,
            minEV: prefs.minEv,
            maxEV: prefs.maxEv,
            minOdds: model.min_odds ?? -500,
            maxOdds: model.max_odds ?? 500,
            markets: hasSportCustomization ? sportMarkets : null,
            marketType: "all",
            mode: prefs.mode,
            minBooksPerSide: model.min_books_reference || prefs.minBooksPerSide,
            limit: perSportLimit,
          },
          metadata: {
            modelId: model.id,
            modelName: model.name,
            isCustom: true,
            modelColor: model.color || DEFAULT_MODEL_COLOR,
          },
        });
      });
      continue;
    }

    configs.push({
      filters: {
        sports,
        sharpPreset: null, // Not used when custom sharp books are provided
        customSharpBooks: model.sharp_books,
        customBookWeights: model.book_weights,
        devigMethods: prefs.devigMethods, // Use global devig methods
        minEV: prefs.minEv, // Use global min EV
        maxEV: prefs.maxEv, // Use global max EV
        minOdds: model.min_odds ?? -500,
        maxOdds: model.max_odds ?? 500,
        markets: model.markets,
        marketType: model.market_type,
        mode: prefs.mode,
        minBooksPerSide: model.min_books_reference || prefs.minBooksPerSide,
        limit: Math.ceil(limit / activeModels.length), // Split limit across models
      },
      metadata: {
        modelId: model.id,
        modelName: model.name,
        isCustom: true,
        modelColor: model.color || DEFAULT_MODEL_COLOR,
      },
    });
  }
  
  return configs;
}

// =============================================================================
// API Fetching
// =============================================================================

/**
 * Build query params for +EV API
 */
function buildQueryParams(config: EVModelConfig, isPro: boolean, fresh: boolean = false): URLSearchParams {
  const params = new URLSearchParams();
  const { filters } = config;
  
  // Sports
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }
  
  // Markets
  if (filters.markets && filters.markets.length > 0) {
    params.set("markets", filters.markets.join(","));
  }
  
  // Market type
  if (filters.marketType && filters.marketType !== "all") {
    params.set("marketType", filters.marketType);
  }
  
  // Sharp reference - either preset or custom
  if (filters.customSharpBooks && filters.customSharpBooks.length > 0) {
    params.set("customSharpBooks", filters.customSharpBooks.join(","));
    if (filters.customBookWeights && Object.keys(filters.customBookWeights).length > 0) {
      params.set("customBookWeights", JSON.stringify(filters.customBookWeights));
    }
  } else if (filters.sharpPreset) {
    params.set("sharpPreset", filters.sharpPreset);
  }
  
  // Devig methods
  if (filters.devigMethods && filters.devigMethods.length > 0) {
    params.set("devigMethods", filters.devigMethods.join(","));
  }
  
  // EV thresholds
  if (filters.minEV > 0) {
    params.set("minEV", String(filters.minEV));
  }
  if (filters.maxEV) {
    params.set("maxEV", String(filters.maxEV));
  }
  if (filters.minOdds !== undefined) {
    params.set("minOdds", String(filters.minOdds));
  }
  if (filters.maxOdds !== undefined) {
    params.set("maxOdds", String(filters.maxOdds));
  }
  
  // Mode
  if (filters.mode) {
    params.set("mode", filters.mode);
  }
  
  // Min books per side
  if (filters.minBooksPerSide !== undefined) {
    params.set("minBooksPerSide", String(filters.minBooksPerSide));
  }
  
  // Limit
  params.set("limit", String(filters.limit));
  
  // Fresh flag
  if (fresh) {
    params.set("fresh", "true");
  }
  
  return params;
}

/**
 * Fetch opportunities for a single model config
 */
async function fetchModelOpportunities(
  config: EVModelConfig,
  isPro: boolean,
  fresh: boolean = false,
  signal?: AbortSignal
): Promise<{
  opportunities: PositiveEVOpportunity[];
  totalFound: number;
  totalReturned: number;
  meta: PositiveEVResponse["meta"];
  config: EVModelConfig;
}> {
  const params = buildQueryParams(config, isPro, fresh);
  const url = `/api/v2/positive-ev?${params.toString()}`;
  
  console.log(`[useMultiEvModel] Fetching for model "${config.metadata.modelName}":`, url);
  
  const response = await fetch(url, { 
    cache: "no-store",
    signal,
  });
  
  const data = (await response.json().catch(() => null)) as PositiveEVResponse | { error?: string; message?: string } | null;
  if (!response.ok) {
    const message =
      (data && "message" in data && typeof data.message === "string" && data.message) ||
      (data && "error" in data && typeof data.error === "string" && data.error) ||
      `Failed to fetch +EV opportunities: ${response.statusText}`;
    throw new Error(message);
  }
  if (!data || !("meta" in data)) {
    throw new Error("Invalid +EV response");
  }
  
  // Tag each opportunity with model metadata
  const opportunities = (data.opportunities || []).map((opp) => ({
    ...opp,
    modelId: config.metadata.modelId,
    modelName: config.metadata.modelName,
    modelColor: config.metadata.modelColor,
  }));
  
  return {
    opportunities,
    totalFound: data.meta?.totalFound || 0,
    totalReturned: data.meta?.returned || 0,
    meta: data.meta,
    config,
  };
}

// =============================================================================
// Merge & Deduplicate
// =============================================================================

/**
 * Get the EV value from an opportunity
 * Uses evCalculations.evWorst as the primary sort value (conservative estimate)
 */
function getOpportunityEV(opp: PositiveEVOpportunity): number {
  // Use evWorst (conservative) for sorting and deduplication
  return opp.evCalculations?.evWorst ?? opp.evCalculations?.evBest ?? -Infinity;
}

/**
 * Merge opportunities from multiple models
 * Deduplicates by keeping the one with best EV
 */
function mergeOpportunities(
  results: Array<{
    opportunities: PositiveEVOpportunity[];
    config: EVModelConfig;
  }>
): PositiveEVOpportunity[] {
  // Map by unique opportunity key
  const oppMap = new Map<string, PositiveEVOpportunity>();
  
  for (const result of results) {
    for (const opp of result.opportunities) {
      // Create unique key for deduplication
      // Key: eventId + player + market + line + side + book (include book to show same opp from different models)
      const key = `${opp.eventId}:${opp.playerName || 'game'}:${opp.market}:${opp.line}:${opp.side}:${opp.book?.bookId || 'unknown'}`;
      
      const existing = oppMap.get(key);
      
      if (!existing) {
        // First time seeing this opportunity
        oppMap.set(key, opp);
      } else {
        // Duplicate - keep the one with better EV
        const existingEV = getOpportunityEV(existing);
        const newEV = getOpportunityEV(opp);
        
        if (newEV > existingEV) {
          oppMap.set(key, opp);
        }
      }
    }
  }
  
  // Sort by EV descending after merging (using evWorst for conservative sorting)
  return Array.from(oppMap.values()).sort((a, b) => {
    const evA = getOpportunityEV(a);
    const evB = getOpportunityEV(b);
    return evB - evA;
  });
}

// =============================================================================
// Client-Side Filtering
// =============================================================================

/**
 * Apply client-side filters (search, book exclusions, etc.)
 */
function applyClientFilters(
  opportunities: PositiveEVOpportunity[],
  prefs: PositiveEVPrefs
): PositiveEVOpportunity[] {
  let filtered = opportunities;

  const remapOpportunityToSelectedBook = (
    opp: PositiveEVOpportunity,
    selectedBooks: string[],
    devigMethods: DevigMethod[],
  ): PositiveEVOpportunity | null => {
    if (selectedBooks.length === 0) return opp;

    const selectedSet = new Set(selectedBooks.map((book) => normalizeSportsbookId(book)));
    const candidateBooks = (opp.allBooks || [])
      .filter((book) => selectedSet.has(normalizeSportsbookId(book.bookId)))
      .map((book) => ({
        book,
        evCalculations: calculateMultiEV(
          opp.devigResults,
          book,
          opp.side === "under" || opp.side === "no" ? "under" : "over",
          devigMethods
        ),
      }))
      .filter((candidate) => candidate.evCalculations.evWorst > 0)
      .sort((a, b) => {
        const evDiff = b.evCalculations.evWorst - a.evCalculations.evWorst;
        if (evDiff !== 0) return evDiff;
        return b.book.priceDecimal - a.book.priceDecimal;
      });

    const bestCandidate = candidateBooks[0];
    if (!bestCandidate) return null;

    if (normalizeSportsbookId(opp.book?.bookId || "") === normalizeSportsbookId(bestCandidate.book.bookId)) {
      return opp;
    }

    const selectedEv = bestCandidate.evCalculations.evWorst ?? 0;
    return {
      ...opp,
      book: {
        ...bestCandidate.book,
        evPercent: selectedEv,
        isSharpRef: false,
      },
      evCalculations: {
        ...bestCandidate.evCalculations,
      },
    };
  };
  
  // Search filter
  if (prefs.searchQuery && prefs.searchQuery.trim()) {
    const q = prefs.searchQuery.toLowerCase().trim();
    filtered = filtered.filter((opp) => {
      const playerName = opp.playerName?.toLowerCase() || "";
      const market = opp.marketDisplay?.toLowerCase() || opp.market?.toLowerCase() || "";
      const team = opp.playerTeam?.toLowerCase() || "";
      const matchup = `${opp.homeTeam || ""} ${opp.awayTeam || ""}`.toLowerCase();
      
      return (
        playerName.includes(q) ||
        market.includes(q) ||
        team.includes(q) ||
        matchup.includes(q)
      );
    });
  }
  
  // Books are a "show only" filter for +EV. Promote the best selected book
  // within the row instead of dropping the row when the top book differs.
  if (prefs.selectedBooks && prefs.selectedBooks.length > 0) {
    filtered = filtered
      .map((opp) => remapOpportunityToSelectedBook(opp, prefs.selectedBooks, prefs.devigMethods))
      .filter((opp): opp is PositiveEVOpportunity => opp !== null);
  }

  // Market filter (supports both composite and plain market keys)
  if (prefs.selectedMarkets && prefs.selectedMarkets.length > 0) {
    filtered = filtered.filter((opp) =>
      isMarketSelected(
        prefs.selectedMarkets,
        opp.sport || "",
        opp.market || ""
      )
    );
  }
  
  return filtered;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook for fetching +EV opportunities with multi-model support
 */
export function useMultiEvModelOpportunities({
  prefs,
  activeModels,
  isPro,
  limit,
  enabled = true,
}: UseMultiEvModelOptions): UseMultiEvModelResult {
  const queryClient = useQueryClient();
  
  const effectiveLimit = limit ?? (isPro ? 200 : 50);
  const isCustomMode = activeModels.length > 0;
  
  // Build model configs
  const modelConfigs = useMemo(
    () => buildModelConfigs(prefs, activeModels, isPro, effectiveLimit),
    [prefs, activeModels, isPro, effectiveLimit]
  );
  
  // Build query key
  const queryKey = useMemo(() => {
    if (isCustomMode) {
      return [
        "multi-ev-model",
        "custom",
        modelConfigs.map(c => JSON.stringify({
          ...c.filters,
          id: c.metadata.modelId,
        })),
        isPro,
      ];
    } else {
      return [
        "multi-ev-model",
        "preset",
        prefs.sharpPreset,
        prefs.selectedSports.join(","),
        prefs.devigMethods.join(","),
        prefs.minEv,
        prefs.maxEv,
        prefs.mode,
        prefs.minBooksPerSide,
        effectiveLimit,
        isPro,
      ];
    }
  }, [isCustomMode, modelConfigs, prefs, effectiveLimit, isPro]);
  
  // Main query
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: queryRefetch,
    dataUpdatedAt,
    isStale,
  } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      // Fetch all model configs in parallel
      const results = await Promise.all(
        modelConfigs.map(config => fetchModelOpportunities(config, isPro, false, signal))
      );
      
      // Merge and deduplicate
      const merged = mergeOpportunities(results);
      
      return {
        opportunities: merged,
        totalFound: results.reduce((sum, r) => sum + r.totalFound, 0),
        totalReturned: merged.length,
        meta: results.length === 1 ? results[0].meta : null,
      };
    },
    staleTime: isCustomMode ? CUSTOM_STALE_TIME_MS : PRESET_STALE_TIME_MS,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: isCustomMode ? true : "always",
    placeholderData: (prev) => prev,
    retry: 3,
    enabled,
  });
  
  // Apply client-side filters
  const opportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    return applyClientFilters(data.opportunities, prefs);
  }, [data?.opportunities, prefs]);
  
  // Standard refetch
  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);
  
  // Fresh refetch (bypasses server cache)
  const freshRefetch = useCallback(async () => {
    console.log('[useMultiEvModel] Fresh refetch (bypassing server cache)');
    
    const results = await Promise.all(
      modelConfigs.map(config => fetchModelOpportunities(config, isPro, true))
    );
    
    const merged = mergeOpportunities(results);
    
    queryClient.setQueryData(queryKey, {
      opportunities: merged,
      totalFound: results.reduce((sum, r) => sum + r.totalFound, 0),
      totalReturned: merged.length,
      meta: results.length === 1 ? results[0].meta : null,
    });
  }, [modelConfigs, isPro, queryClient, queryKey]);
  
  // Prefetch model on hover
  const prefetchModel = useCallback(async (model: EvModel) => {
    const previewConfigs = buildModelConfigs(prefs, [model], isPro, effectiveLimit);
    const previewQueryKey = [
      "multi-ev-model",
      "custom",
      previewConfigs.map(c => JSON.stringify({
        ...c.filters,
        id: c.metadata.modelId,
      })),
      isPro,
    ];
    
    // Check if already cached
    const cached = queryClient.getQueryData(previewQueryKey);
    if (cached) return;
    
    // Prefetch
    await queryClient.prefetchQuery({
      queryKey: previewQueryKey,
      queryFn: async () => {
        const results = await Promise.all(
          previewConfigs.map(config => fetchModelOpportunities(config, isPro, false))
        );
        const merged = mergeOpportunities(results);
        return {
          opportunities: merged,
          totalFound: results.reduce((sum, r) => sum + r.totalFound, 0),
          totalReturned: merged.length,
          meta: results.length === 1 ? results[0].meta : null,
        };
      },
      staleTime: 45_000,
    });
  }, [prefs, isPro, effectiveLimit, queryClient]);
  
  return {
    opportunities,
    totalFound: data?.totalFound || 0,
    totalReturned: data?.totalReturned || 0,
    meta: data?.meta || null,
    activeConfigs: modelConfigs,
    isCustomMode,
    isLoading,
    isFetching,
    error: error as Error | null,
    dataUpdatedAt: dataUpdatedAt || null,
    isStale,
    refetch,
    freshRefetch,
    prefetchModel,
  };
}
