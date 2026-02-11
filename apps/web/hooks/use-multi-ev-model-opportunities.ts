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
import { DEFAULT_MODEL_COLOR, type EvModel, parseEvSports } from "@/lib/types/ev-models";
import { normalizeSportsbookId } from "@/lib/data/sportsbooks";

// All supported sports
const ALL_SPORTS = ["nba", "nfl", "nhl", "mlb", "ncaaf", "ncaab", "wnba", "soccer_epl"];

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
        markets: prefs.selectedMarkets.length > 0 ? prefs.selectedMarkets : null,
        marketType: "all",
        mode: prefs.mode,
        minBooksPerSide: prefs.minBooksPerSide,
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
    // If model has no sports, use user's selected sports or all
    const sports = modelSports.length > 0 
      ? modelSports 
      : (prefs.selectedSports.length > 0 ? prefs.selectedSports : ALL_SPORTS);
    
    // For multi-sport models, we could split into separate fetches like Edge Finder
    // For now, we'll fetch all sports together and let server handle it
    
    console.log(`[useMultiEvModel] Building config for model "${model.name}":`, {
      sports,
      sharpBooks: model.sharp_books,
      weights: model.book_weights,
      marketType: model.market_type,
      markets: model.markets,
    });

    configs.push({
      filters: {
        sports,
        sharpPreset: null, // Not used when custom sharp books are provided
        customSharpBooks: model.sharp_books,
        customBookWeights: model.book_weights,
        devigMethods: prefs.devigMethods, // Use global devig methods
        minEV: prefs.minEv, // Use global min EV
        maxEV: prefs.maxEv, // Use global max EV
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
  config: EVModelConfig;
}> {
  const params = buildQueryParams(config, isPro, fresh);
  const url = `/api/v2/positive-ev?${params.toString()}`;
  
  console.log(`[useMultiEvModel] Fetching for model "${config.metadata.modelName}":`, url);
  
  const response = await fetch(url, { 
    cache: "no-store",
    signal,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch +EV opportunities: ${response.statusText}`);
  }
  
  const data: PositiveEVResponse = await response.json();
  
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
  
  // Book exclusions (selectedBooks contains EXCLUDED books for +EV)
  // Actually for +EV, selectedBooks might be "show only" - check context
  // For now, assume it's an inclusion filter if set
  if (prefs.selectedBooks && prefs.selectedBooks.length > 0) {
    filtered = filtered.filter((opp) => {
      const bookId = opp.book?.bookId || "";
      const normalizedBook = normalizeSportsbookId(bookId);
      return prefs.selectedBooks.includes(normalizedBook);
    });
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
        isPro,
      ];
    }
  }, [isCustomMode, modelConfigs, prefs, isPro]);
  
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
      };
    },
    staleTime: isCustomMode ? 45_000 : 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
        };
      },
      staleTime: 45_000,
    });
  }, [prefs, isPro, effectiveLimit, queryClient]);
  
  return {
    opportunities,
    totalFound: data?.totalFound || 0,
    totalReturned: data?.totalReturned || 0,
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
