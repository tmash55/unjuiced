"use client";

/**
 * useMultiEvModelStream Hook
 * 
 * Real-time SSE streaming hook for Positive EV opportunities with multi-model support.
 * Uses signal-based refreshing via the odds_updates pub/sub infrastructure.
 * 
 * Features:
 * - SSE connection to odds_updates channels
 * - Signal-based refresh (only fetches when odds change)
 * - Multi-model support (parallel fetches, merged results)
 * - Model metadata tagging (modelId, modelName on each opportunity)
 * - Debounced updates to prevent request storms
 * - Stale/unavailable row tracking for expanded rows
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PositiveEVOpportunity, PositiveEVResponse, SharpPreset, DevigMethod, EVMode } from "@/lib/ev/types";
import { SHARP_PRESETS, DEFAULT_DEVIG_METHODS } from "@/lib/ev/constants";
import { DEFAULT_MODEL_COLOR, type EvModel, parseEvSports } from "@/lib/types/ev-models";
import { useSSE } from "@/hooks/use-sse";
import { isMarketSelected } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface MultiEvModelStreamPrefs {
  selectedSports: string[];
  sharpPreset: SharpPreset;
  devigMethods: DevigMethod[];
  minEv: number;
  maxEv?: number;
  selectedBooks: string[];
  selectedMarkets: string[];
  mode: EVMode;
  minBooksPerSide: number;
  searchQuery?: string;
}

interface ModelConfig {
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
  metadata: {
    modelId: string;
    modelName: string;
    isCustom: boolean;
    modelColor?: string | null;
  };
}

type Cache = Map<string, PositiveEVOpportunity>;
type Direction = "up" | "down";
type Change = { ev?: Direction; price?: Direction };
type ChangeMap = Map<string, Change>;

interface OddsUpdateMessage {
  type: "update";
  keys: string[];
  count: number;
  timestamp?: string;
}

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
const FLASH_MS = 5000;
const DEBOUNCE_MS = 1000;

// =============================================================================
// Helpers
// =============================================================================

function dir(a: number | undefined, b: number | undefined): Direction | undefined {
  if (a == null || b == null) return undefined;
  if (b > a) return "up";
  if (b < a) return "down";
  return undefined;
}

function getOpportunityEV(opp: PositiveEVOpportunity): number {
  return opp.evCalculations?.evWorst ?? opp.evCalculations?.evBest ?? -Infinity;
}

function buildModelConfigs(
  prefs: MultiEvModelStreamPrefs,
  activeModels: EvModel[],
  isPro: boolean,
  limit: number
): ModelConfig[] {
  // Safety: if user doesn't have pro (Elite) access, ignore custom models
  if (!isPro && activeModels.length > 0) {
    console.warn("[useMultiEvModelStream] Custom models require Elite access – falling back to preset mode");
  }
  
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

  const configs: ModelConfig[] = [];
  
  for (const model of activeModels) {
    const modelSports = parseEvSports(model.sport);
    const sports = modelSports.length > 0 
      ? modelSports 
      : (prefs.selectedSports.length > 0 ? prefs.selectedSports : ALL_SPORTS);

    configs.push({
      filters: {
        sports,
        sharpPreset: null,
        customSharpBooks: model.sharp_books,
        customBookWeights: model.book_weights,
        devigMethods: prefs.devigMethods,
        minEV: prefs.minEv,
        maxEV: prefs.maxEv,
        markets: model.markets,
        marketType: model.market_type,
        mode: prefs.mode,
        minBooksPerSide: model.min_books_reference || prefs.minBooksPerSide,
        limit: Math.ceil(limit / activeModels.length),
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

function buildQueryParams(config: ModelConfig, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();
  const { filters } = config;
  
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }
  
  if (filters.markets && filters.markets.length > 0) {
    params.set("markets", filters.markets.join(","));
  }
  
  if (filters.marketType && filters.marketType !== "all") {
    params.set("marketType", filters.marketType);
  }
  
  if (filters.customSharpBooks && filters.customSharpBooks.length > 0) {
    params.set("customSharpBooks", filters.customSharpBooks.join(","));
    if (filters.customBookWeights && Object.keys(filters.customBookWeights).length > 0) {
      params.set("customBookWeights", JSON.stringify(filters.customBookWeights));
    }
  } else if (filters.sharpPreset) {
    params.set("sharpPreset", filters.sharpPreset);
  }
  
  if (filters.devigMethods && filters.devigMethods.length > 0) {
    params.set("devigMethods", filters.devigMethods.join(","));
  }
  
  if (filters.minEV > 0) {
    params.set("minEV", String(filters.minEV));
  }
  if (filters.maxEV) {
    params.set("maxEV", String(filters.maxEV));
  }
  
  if (filters.mode) {
    params.set("mode", filters.mode);
  }
  
  if (filters.minBooksPerSide !== undefined) {
    params.set("minBooksPerSide", String(filters.minBooksPerSide));
  }
  
  params.set("limit", String(filters.limit));
  // Stream refreshes should bypass API response cache to avoid stale rows.
  params.set("fresh", "true");
  
  return params;
}

async function fetchModelOpportunities(
  config: ModelConfig,
  isPro: boolean
): Promise<{
  opportunities: PositiveEVOpportunity[];
  totalFound: number;
  totalReturned: number;
  config: ModelConfig;
}> {
  const params = buildQueryParams(config, isPro);
  const url = `/api/v2/positive-ev?${params.toString()}`;
  
  const response = await fetch(url, { cache: "no-store" });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  
  const data: PositiveEVResponse = await response.json();
  
  // Tag opportunities with model metadata
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

function mergeOpportunities(
  results: Array<{
    opportunities: PositiveEVOpportunity[];
    config: ModelConfig;
  }>
): PositiveEVOpportunity[] {
  const oppMap = new Map<string, PositiveEVOpportunity>();
  
  for (const result of results) {
    for (const opp of result.opportunities) {
      const key = `${opp.eventId}:${opp.playerName || 'game'}:${opp.market}:${opp.line}:${opp.side}:${opp.book?.bookId || 'unknown'}`;
      
      const existing = oppMap.get(key);
      
      if (!existing) {
        oppMap.set(key, opp);
      } else {
        const existingEV = getOpportunityEV(existing);
        const newEV = getOpportunityEV(opp);
        
        if (newEV > existingEV) {
          oppMap.set(key, opp);
        }
      }
    }
  }
  
  return Array.from(oppMap.values()).sort((a, b) => {
    const evA = getOpportunityEV(a);
    const evB = getOpportunityEV(b);
    return evB - evA;
  });
}

function isRelevantUpdate(key: string, sports: string[], markets?: string[] | null): boolean {
  const parts = key.split(":");
  if (parts.length < 4) return false;
  
  const [, keySport, , keyMarket] = parts;
  
  if (!sports.includes(keySport)) return false;
  
  if (markets && markets.length > 0) {
    if (!isMarketSelected(markets, keySport || "", keyMarket || "")) return false;
  }
  
  return true;
}

// =============================================================================
// Main Hook
// =============================================================================

export interface UseMultiEvModelStreamOptions {
  prefs: MultiEvModelStreamPrefs;
  activeModels: EvModel[];
  isPro: boolean;
  limit?: number;
  autoRefresh: boolean;
  enabled?: boolean;
}

export interface UseMultiEvModelStreamResult {
  rows: PositiveEVOpportunity[];
  ids: string[];
  changes: ChangeMap;
  added: Set<string>;
  stale: Set<string>;
  version: number;
  loading: boolean;
  connected: boolean;
  isReconnecting: boolean;
  hasFailed: boolean;
  lastUpdated: number;
  error: string | null;
  refresh: () => Promise<boolean>;
  reconnect: () => void;
  meta: {
    totalFound: number;
    returned: number;
    minBooksPerSide?: number;
  };
  isCustomMode: boolean;
  activeConfigs: ModelConfig[];
}

export function useMultiEvModelStream({
  prefs,
  activeModels,
  isPro,
  limit = 200,
  autoRefresh,
  enabled = true,
}: UseMultiEvModelStreamOptions): UseMultiEvModelStreamResult {
  // State
  const [version, setVersion] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeMap>(new Map());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [stale, setStale] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ totalFound: number; returned: number; minBooksPerSide?: number }>({ 
    totalFound: 0, 
    returned: 0 
  });
  
  // Refs
  const cacheRef = useRef<Cache>(new Map());
  const prevRef = useRef<Cache>(new Map());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<Map<string, number>>(new Map());
  
  // Computed
  const isCustomMode = activeModels.length > 0;
  const effectiveLimit = limit ?? (isPro ? 200 : 50);
  
  const modelConfigs = useMemo(
    () => buildModelConfigs(prefs, activeModels, isPro, effectiveLimit),
    [prefs, activeModels, isPro, effectiveLimit]
  );
  
  // Get all sports from all active configs for SSE filtering
  const allSports = useMemo(() => {
    const sports = new Set<string>();
    for (const config of modelConfigs) {
      for (const sport of config.filters.sports) {
        sports.add(sport);
      }
    }
    return Array.from(sports);
  }, [modelConfigs]);
  
  // Register changes for animations
  const registerDiffs = useCallback((changedIds: string[]) => {
    if (!changedIds.length) return;
    
    const next = new Map<string, Change>(changes);
    const cache = cacheRef.current;
    const prev = prevRef.current;
    
    for (const id of changedIds) {
      const now = cache.get(id);
      const was = prev.get(id);
      if (!now || !was) continue;
      
      const c: Change = {};
      c.ev = dir(was.evCalculations?.evWorst, now.evCalculations?.evWorst);
      c.price = dir(was.book?.price, now.book?.price);
      
      for (const k of Object.keys(c) as (keyof Change)[]) {
        if (!c[k]) delete c[k];
      }
      
      if (Object.keys(c).length) next.set(id, c);
    }
    
    if (next.size) {
      setChanges(next);
      setTimeout(() => {
        setChanges((cur) => {
          const clone = new Map(cur);
          for (const id of changedIds) clone.delete(id);
          return clone;
        });
      }, FLASH_MS);
    }
    
    for (const id of changedIds) {
      const now = cache.get(id);
      if (now) prev.set(id, now);
    }
  }, [changes]);

  const markForHighlight = useCallback((newIds: string[]) => {
    if (!newIds || newIds.length === 0) return;
    setAdded((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
    setTimeout(() => {
      setAdded((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
    }, 10000);
  }, []);

  // Multi-model fetch with diffing
  const fetchData = useCallback(async (isInitial: boolean = false) => {
    if (!enabled) return;
    
    if (isInitial) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Fetch all models in parallel
      const results = await Promise.all(
        modelConfigs.map(config => fetchModelOpportunities(config, isPro))
      );
      
      // Merge and deduplicate
      const merged = mergeOpportunities(results);
      
      const cache = cacheRef.current;
      const prev = prevRef.current;
      
      if (isInitial) {
        cache.clear();
        prev.clear();
        
        const newIds: string[] = [];
        for (const opp of merged) {
          cache.set(opp.id, opp);
          prev.set(opp.id, opp);
          newIds.push(opp.id);
          lastUpdateTimeRef.current.set(opp.id, Date.now());
        }
        
        setIds(newIds);
        setStale(new Set());
      } else {
        const newIdSet = new Set<string>();
        const addedIds: string[] = [];
        const updatedIds: string[] = [];
        const deletedIds: string[] = [];
        
        for (const opp of merged) {
          newIdSet.add(opp.id);
          
          const existed = cache.has(opp.id);
          const prevOpp = prev.get(opp.id);
          
          if (existed && prevOpp) {
            const priceChanged = prevOpp.book?.price !== opp.book?.price;
            const evChanged = Math.abs((prevOpp.evCalculations?.evWorst || 0) - (opp.evCalculations?.evWorst || 0)) > 0.01;
            
            if (priceChanged || evChanged) {
              updatedIds.push(opp.id);
            }
          } else {
            addedIds.push(opp.id);
          }
          
          cache.set(opp.id, opp);
          lastUpdateTimeRef.current.set(opp.id, Date.now());
        }
        
        for (const [id] of cache) {
          if (!newIdSet.has(id)) {
            deletedIds.push(id);
          }
        }
        
        if (deletedIds.length > 0) {
          setStale((prevStale) => {
            const next = new Set(prevStale);
            for (const id of deletedIds) next.add(id);
            return next;
          });
          
          for (const id of deletedIds) {
            cache.delete(id);
            prev.delete(id);
          }
        }
        
        setIds(Array.from(newIdSet));
        
        if (addedIds.length > 0 || updatedIds.length > 0) {
          setStale((prevStale) => {
            const next = new Set(prevStale);
            for (const id of [...addedIds, ...updatedIds]) next.delete(id);
            return next;
          });
        }
        
        if (updatedIds.length > 0) {
          registerDiffs(updatedIds);
        }
        if (addedIds.length > 0) {
          markForHighlight(addedIds);
        }
        
        for (const opp of merged) {
          prev.set(opp.id, opp);
        }
        
        if (process.env.NODE_ENV === "development" && (addedIds.length > 0 || updatedIds.length > 0 || deletedIds.length > 0)) {
          console.log(`[multi-ev-stream] 📊 +${addedIds.length} ~${updatedIds.length} -${deletedIds.length}`);
        }
      }
      
      setVersion((v) => v + 1);
      setLastUpdated(Date.now());
      setMeta({
        totalFound: results.reduce((sum, r) => sum + r.totalFound, 0),
        returned: merged.length,
      });
      
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
      console.error("[multi-ev-stream] Fetch error:", e);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [modelConfigs, isPro, enabled, registerDiffs, markForHighlight]);

  // Initial load and config changes
  useEffect(() => {
    if (!enabled) return;
    fetchData(true);
  }, [enabled, JSON.stringify(modelConfigs)]);

  // Build SSE URL for multi-sport subscription
  const sseUrl = useMemo(() => {
    if (!autoRefresh || !enabled || allSports.length === 0) return "";
    return `/api/v2/sse/props?sports=${allSports.join(",")}`;
  }, [allSports, autoRefresh, enabled]);
  
  // Handle SSE message - debounced refresh
  const handleSSEMessage = useCallback((message: OddsUpdateMessage) => {
    if (message.type !== "update" || !message.keys?.length) return;
    
    // Check if any keys are relevant
    const hasRelevant = message.keys.some(key => 
      isRelevantUpdate(key, allSports, prefs.selectedMarkets.length > 0 ? prefs.selectedMarkets : null)
    );
    
    if (!hasRelevant) return;
    
    // Debounce refresh
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      fetchData(false);
    }, DEBOUNCE_MS);
  }, [allSports, prefs.selectedMarkets, fetchData]);
  
  // SSE connection - only when autoRefresh is enabled
  const sseEnabled = autoRefresh && enabled && sseUrl !== "";
  
  const {
    isConnected: sseConnected,
    isReconnecting: sseReconnecting,
    hasFailed: sseFailed,
    reconnect: sseReconnect,
  } = useSSE(sseUrl, {
    enabled: sseEnabled,
    onMessage: handleSSEMessage,
  });

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchData(false);
    return true;
  }, [fetchData]);

  // Get rows from cache
  const rows = useMemo(() => {
    const cache = cacheRef.current;
    return ids.map(id => cache.get(id)!).filter(Boolean);
  }, [ids, version]);

  return {
    rows,
    ids,
    changes,
    added,
    stale,
    version,
    loading,
    connected: sseConnected,
    isReconnecting: sseReconnecting,
    hasFailed: sseFailed,
    lastUpdated,
    error,
    refresh,
    reconnect: sseReconnect,
    meta,
    isCustomMode,
    activeConfigs: modelConfigs,
  };
}
