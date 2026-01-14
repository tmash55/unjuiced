"use client";

/**
 * usePositiveEVStream Hook
 * 
 * Real-time SSE streaming hook for Positive EV opportunities.
 * Uses signal-based refreshing via the odds_updates pub/sub infrastructure.
 * 
 * Features:
 * - SSE connection to odds_updates channels
 * - Signal-based refresh (only fetches when odds change)
 * - Debounced updates to prevent request storms
 * - Stale/unavailable row tracking for expanded rows
 * - Auto-refresh toggle
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PositiveEVOpportunity, PositiveEVResponse, SharpPreset, DevigMethod, EVMode } from "@/lib/ev/types";
import { SHARP_PRESETS, DEFAULT_DEVIG_METHODS, POSITIVE_EV_DEFAULTS } from "@/lib/ev/constants";
import { useSSE } from "@/hooks/use-sse";

// =============================================================================
// Types
// =============================================================================

interface PositiveEVFilters {
  sports: string[];
  markets?: string[] | null;
  sharpPreset: SharpPreset;
  devigMethods?: DevigMethod[];
  minEV: number;
  maxEV?: number;
  books?: string[] | null;
  limit?: number;
  search?: string;
  mode?: EVMode;
  minBooksPerSide?: number;
}

type Cache = Map<string, PositiveEVOpportunity>;
type Direction = "up" | "down";
type Change = { ev?: Direction; price?: Direction };
type ChangeMap = Map<string, Change>;

// SSE message format from odds_updates channel
interface OddsUpdateMessage {
  type: "update";
  keys: string[];
  count: number;
  timestamp?: string;
}

const FLASH_MS = 5000; // Highlight duration for changes
const DEBOUNCE_MS = 1000; // Debounce refresh requests

// =============================================================================
// Helpers
// =============================================================================

function dir(a: number | undefined, b: number | undefined): Direction | undefined {
  if (a == null || b == null) return undefined;
  if (b > a) return "up";
  if (b < a) return "down";
  return undefined;
}

function buildQueryParams(filters: PositiveEVFilters, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }
  if (filters.markets && filters.markets.length > 0) {
    params.set("markets", filters.markets.join(","));
  }
  params.set("sharpPreset", filters.sharpPreset);
  if (filters.devigMethods && filters.devigMethods.length > 0) {
    params.set("devigMethods", filters.devigMethods.join(","));
  }
  if (filters.minEV > 0) {
    params.set("minEV", String(filters.minEV));
  }
  if (filters.maxEV) {
    params.set("maxEV", String(filters.maxEV));
  }
  if (filters.books && filters.books.length > 0) {
    params.set("books", filters.books.join(","));
  }
  if (filters.mode) {
    params.set("mode", filters.mode);
  }
  if (filters.minBooksPerSide !== undefined) {
    params.set("minBooksPerSide", String(filters.minBooksPerSide));
  }
  const limit = filters.limit || (isPro ? 200 : 50);
  params.set("limit", String(limit));
  
  return params;
}

/**
 * Check if an odds update key is relevant to our current filters
 * Key format: odds:{sport}:{eventId}:{market}:{book}
 */
function isRelevantUpdate(key: string, sports: string[], markets?: string[] | null): boolean {
  const parts = key.split(":");
  if (parts.length < 4) return false;
  
  const [, keySport, , keyMarket] = parts;
  
  // Check if sport matches
  if (!sports.includes(keySport)) return false;
  
  // If we have market filters, check if market matches
  if (markets && markets.length > 0) {
    if (!markets.includes(keyMarket)) return false;
  }
  
  return true;
}

// =============================================================================
// Main Hook
// =============================================================================

export interface UsePositiveEVStreamOptions {
  filters: PositiveEVFilters;
  isPro: boolean;
  autoRefresh: boolean;
  enabled?: boolean;
}

export interface UsePositiveEVStreamResult {
  /** Current opportunities */
  rows: PositiveEVOpportunity[];
  /** All row IDs */
  ids: string[];
  /** Change indicators for animation */
  changes: ChangeMap;
  /** Newly added row IDs for highlight */
  added: Set<string>;
  /** Stale/unavailable row IDs */
  stale: Set<string>;
  /** Data version */
  version: number;
  /** Loading state (initial) */
  loading: boolean;
  /** SSE connected */
  connected: boolean;
  /** Reconnecting */
  isReconnecting: boolean;
  /** Connection failed after max retries */
  hasFailed: boolean;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Error message */
  error: string | null;
  /** Refetch function */
  refresh: () => Promise<boolean>;
  /** Manual reconnect */
  reconnect: () => void;
  /** Meta information */
  meta: {
    totalFound: number;
    returned: number;
    minBooksPerSide?: number;
  };
  /** Sharp preset config */
  sharpPresetConfig: typeof SHARP_PRESETS[SharpPreset];
}

export function usePositiveEVStream({
  filters,
  isPro,
  autoRefresh,
  enabled = true,
}: UsePositiveEVStreamOptions): UsePositiveEVStreamResult {
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
      c.ev = dir(was.evPercent, now.evPercent);
      c.price = dir(was.bestPrice, now.bestPrice);
      
      // Clean up undefined values
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
    
    // Update prev cache
    for (const id of changedIds) {
      const now = cache.get(id);
      if (now) prev.set(id, now);
    }
  }, [changes]);

  // Mark rows as added for highlight
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

  // Fetch data with diffing logic
  const fetchData = useCallback(async (isInitial: boolean = false) => {
    if (!enabled) return;
    
    if (isInitial) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const params = buildQueryParams(filters, isPro);
      const response = await fetch(`/api/v2/positive-ev?${params.toString()}`, { 
        cache: "no-store" 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data: PositiveEVResponse = await response.json();
      const cache = cacheRef.current;
      const prev = prevRef.current;
      
      if (isInitial) {
        // Initial load - just populate cache
        cache.clear();
        prev.clear();
        
        const newIds: string[] = [];
        for (const opp of data.opportunities) {
          cache.set(opp.id, opp);
          prev.set(opp.id, opp);
          newIds.push(opp.id);
          lastUpdateTimeRef.current.set(opp.id, Date.now());
        }
        
        setIds(newIds);
        setStale(new Set());
      } else {
        // Signal-triggered refresh - track diffs
        const newIdSet = new Set<string>();
        const addedIds: string[] = [];
        const updatedIds: string[] = [];
        const deletedIds: string[] = [];
        
        // Process new data
        for (const opp of data.opportunities) {
          newIdSet.add(opp.id);
          
          const existed = cache.has(opp.id);
          const prevOpp = prev.get(opp.id);
          
          // Check if this is an update (odds changed)
          if (existed && prevOpp) {
            const priceChanged = prevOpp.bestPrice !== opp.bestPrice;
            const evChanged = Math.abs((prevOpp.evPercent || 0) - (opp.evPercent || 0)) > 0.01;
            
            if (priceChanged || evChanged) {
              updatedIds.push(opp.id);
            }
          } else {
            addedIds.push(opp.id);
          }
          
          cache.set(opp.id, opp);
          lastUpdateTimeRef.current.set(opp.id, Date.now());
        }
        
        // Find deleted IDs (existed before but not in new data)
        for (const [id] of cache) {
          if (!newIdSet.has(id)) {
            deletedIds.push(id);
          }
        }
        
        // Handle deletions - mark as stale
        if (deletedIds.length > 0) {
          setStale((prevStale) => {
            const next = new Set(prevStale);
            for (const id of deletedIds) next.add(id);
            return next;
          });
          
          // Remove from cache
          for (const id of deletedIds) {
            cache.delete(id);
            prev.delete(id);
          }
        }
        
        // Update IDs list
        setIds(Array.from(newIdSet));
        
        // Remove stale status for rows that are back
        if (addedIds.length > 0 || updatedIds.length > 0) {
          setStale((prevStale) => {
            const next = new Set(prevStale);
            for (const id of [...addedIds, ...updatedIds]) next.delete(id);
            return next;
          });
        }
        
        // Trigger animations
        if (updatedIds.length > 0) {
          registerDiffs(updatedIds);
        }
        if (addedIds.length > 0) {
          markForHighlight(addedIds);
        }
        
        // Update prev cache for next comparison
        for (const opp of data.opportunities) {
          prev.set(opp.id, opp);
        }
        
        if (process.env.NODE_ENV === "development" && (addedIds.length > 0 || updatedIds.length > 0 || deletedIds.length > 0)) {
          console.log(`[positive-ev-stream] 📊 +${addedIds.length} ~${updatedIds.length} -${deletedIds.length}`);
        }
      }
      
      // Update version and timestamp
      setVersion((v) => v + 1);
      setLastUpdated(Date.now());
      setMeta({
        totalFound: data.meta.totalFound,
        returned: data.meta.returned,
        minBooksPerSide: data.meta.minBooksPerSide,
      });
      
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
      console.error("[positive-ev-stream] Fetch error:", e);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [filters, isPro, enabled, registerDiffs, markForHighlight]);

  // Initial load and filter changes
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Build SSE URL for multi-sport subscription
  const sseUrl = useMemo(() => {
    if (filters.sports.length === 0) return "";
    return `/api/v2/sse/props?sports=${filters.sports.join(",")}`;
  }, [filters.sports]);

  // Handle SSE message - debounced refresh
  const handleSSEMessage = useCallback((message: OddsUpdateMessage) => {
    // Only process update messages
    if (message.type !== "update" || !Array.isArray(message.keys) || message.keys.length === 0) {
      return;
    }
    
    // Filter keys to see if any are relevant to our current view
    const relevantKeys = message.keys.filter((key) => 
      isRelevantUpdate(key, filters.sports, filters.markets)
    );
    
    if (relevantKeys.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[positive-ev-stream] Skipping ${message.count} updates (no match)`);
      }
      return;
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[positive-ev-stream] 📡 ${relevantKeys.length}/${message.count} relevant updates`);
    }
    
    // Debounce the refresh to prevent request storms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchData(false);
    }, DEBOUNCE_MS);
  }, [filters.sports, filters.markets, fetchData]);

  // Handle SSE error
  const handleSSEError = useCallback((error: Event) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[positive-ev-stream] SSE error:", error);
    }
  }, []);

  // SSE connection - only when autoRefresh is enabled and we're Pro
  const sseEnabled = isPro && autoRefresh && enabled && sseUrl !== "";
  
  const {
    isConnected: sseConnected,
    isReconnecting: sseReconnecting,
    hasFailed: sseFailed,
    reconnect: sseReconnect,
  } = useSSE(sseUrl, {
    enabled: sseEnabled,
    onMessage: handleSSEMessage,
    onError: handleSSEError,
  });

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchData(false);
    return true;
  }, [fetchData]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    sseReconnect();
    // Also refresh data
    fetchData(false);
  }, [sseReconnect, fetchData]);

  // Build rows from cache
  const rows = useMemo(() => {
    return ids
      .map((id) => cacheRef.current.get(id))
      .filter(Boolean) as PositiveEVOpportunity[];
  }, [ids]);

  // Sharp preset config
  const sharpPresetConfig = SHARP_PRESETS[filters.sharpPreset];

  return {
    rows,
    ids,
    changes,
    added,
    stale,
    version,
    loading,
    connected: sseEnabled ? sseConnected : false,
    isReconnecting: sseEnabled ? sseReconnecting : false,
    hasFailed: sseEnabled ? sseFailed : false,
    lastUpdated,
    error,
    refresh,
    reconnect,
    meta,
    sharpPresetConfig,
  };
}
