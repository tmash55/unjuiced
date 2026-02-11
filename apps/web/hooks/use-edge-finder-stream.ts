"use client";

/**
 * useEdgeFinderStream Hook
 * 
 * Real-time SSE streaming hook for Edge Finder opportunities.
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
import {
  type Opportunity,
  type OpportunityFilters,
  DEFAULT_FILTERS,
  parseOpportunity,
  type Sport,
} from "@/lib/types/opportunities";
import { useSSE } from "@/hooks/use-sse";
// BestOddsPrefs type is not used - we define StreamPrefs locally with just the fields we need
import { normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { isMarketSelected } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

type Cache = Map<string, Opportunity>;
type Direction = "up" | "down";
type Change = { edge?: Direction; price?: Direction };
type ChangeMap = Map<string, Change>;

// SSE message format from odds_updates channel
interface OddsUpdateMessage {
  type: "update";
  keys: string[];
  count: number;
  timestamp?: string;
}

// All supported sports
const ALL_SPORTS: Sport[] = ["nba", "nfl", "nhl", "mlb", "ncaaf", "ncaab", "wnba", "soccer_epl"];

const FLASH_MS = 5000; // Highlight duration for changes
const DEBOUNCE_MS = 1000; // Debounce refresh requests

// =============================================================================
// Helpers
// =============================================================================

function dir(a: number | undefined | null, b: number | undefined | null): Direction | undefined {
  if (a == null || b == null) return undefined;
  if (b > a) return "up";
  if (b < a) return "down";
  return undefined;
}

function buildQueryParams(prefs: StreamPrefs, isPro: boolean, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  
  // Fetch ALL sports for broad coverage
  params.set("sports", ALL_SPORTS.join(","));
  
  // Comparison mode/preset
  if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
    params.set("preset", prefs.comparisonBook);
  } else if (prefs.comparisonMode === "next_best") {
    params.set("preset", "next_best");
  } else {
    params.set("preset", "average");
  }
  
  // Market lines (server-side)
  if (prefs.marketLines && Object.keys(prefs.marketLines).length > 0) {
    params.set("marketLines", JSON.stringify(prefs.marketLines));
  }
  
  // Use user's preferences for odds range
  const serverMinOdds = prefs.minOdds ?? -10000;
  const serverMaxOdds = prefs.maxOdds ?? 20000;
  params.set("minOdds", String(serverMinOdds));
  params.set("maxOdds", String(serverMaxOdds));
  
  // Broad fetch - filter client-side
  params.set("minEdge", "0");
  params.set("minBooksPerSide", "2");
  params.set("sort", "edge");
  params.set("limit", String(limit));
  
  return params;
}

/**
 * Apply client-side filters
 */
function applyClientFilters(
  opportunities: Opportunity[],
  prefs: StreamPrefs
): Opportunity[] {
  const leagueToSport: Record<string, string> = {
    nba: "nba", nfl: "nfl", ncaaf: "ncaaf", ncaab: "ncaab",
    nhl: "nhl", mlb: "mlb", wnba: "wnba", soccer_epl: "soccer_epl",
  };
  
  // Build set of selected sports for fast lookup
  const selectedSports = new Set<string>();
  if (prefs.selectedLeagues.length > 0) {
    for (const league of prefs.selectedLeagues) {
      const sport = leagueToSport[league.toLowerCase()];
      if (sport) selectedSports.add(sport);
    }
  }
  
  return opportunities.filter((opp) => {
    // Sport filter
    if (selectedSports.size > 0) {
      const oppSport = (opp.sport || "").toLowerCase();
      if (!selectedSports.has(oppSport)) return false;
    }
    
    // Min edge filter
    if (prefs.minImprovement && prefs.minImprovement > 0) {
      if ((opp.edgePct || 0) < prefs.minImprovement) return false;
    }
    
    // Odds range filter
    const minOdds = prefs.minOdds ?? -10000;
    const maxOdds = prefs.maxOdds ?? 20000;
    const oppOdds = typeof opp.bestPrice === "string"
      ? Number.parseInt(opp.bestPrice, 10) || 0
      : 0;
    if (oppOdds < minOdds || oppOdds > maxOdds) return false;
    
    // Selected markets filter
    if (prefs.selectedMarkets) {
      if (!isMarketSelected(prefs.selectedMarkets, opp.sport || "", opp.market || "")) return false;
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

    // Book exclusions
    if (prefs.selectedBooks.length > 0) {
      const booksWithBestOdds = (opp.allBooks || []).filter(b => b.decimal === opp.bestDecimal);
      const hasSelectedBookWithBestOdds = booksWithBestOdds.some(b => {
        const normalizedBook = normalizeSportsbookId(b.book);
        return !prefs.selectedBooks.includes(normalizedBook);
      });
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
 * Check if an odds update key is relevant to our current filters
 */
function isRelevantUpdate(key: string, sports: string[], markets?: string[]): boolean {
  const parts = key.split(":");
  if (parts.length < 4) return false;
  
  const [, keySport, , keyMarket] = parts;
  
  // Check if sport matches (allow all if no specific filter)
  if (sports.length > 0 && !sports.includes(keySport)) return false;
  
  // If we have market filters, check if market matches
  if (markets && markets.length > 0) {
    if (!isMarketSelected(markets, keySport || "", keyMarket || "")) return false;
  }
  
  return true;
}

// =============================================================================
// Main Hook
// =============================================================================

// Subset of BestOddsPrefs that the stream hook actually uses
interface StreamPrefs {
  selectedLeagues: string[];
  selectedMarkets: string[];
  selectedBooks: string[];
  minImprovement?: number;
  minOdds?: number;
  maxOdds?: number;
  searchQuery?: string;
  hideCollegePlayerProps?: boolean;
  comparisonMode?: 'average' | 'book' | 'next_best';
  comparisonBook?: string | null;
  marketLines?: Record<string, number[]>;
}

export interface UseEdgeFinderStreamOptions {
  prefs: StreamPrefs;
  isPro: boolean;
  autoRefresh: boolean;
  limit?: number;
  enabled?: boolean;
}

export interface UseEdgeFinderStreamResult {
  /** Current opportunities */
  rows: Opportunity[];
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
    totalScanned: number;
    totalAfterFilters: number;
  };
}

export function useEdgeFinderStream({
  prefs,
  isPro,
  autoRefresh,
  limit = 500,
  enabled = true,
}: UseEdgeFinderStreamOptions): UseEdgeFinderStreamResult {
  // State
  const [version, setVersion] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeMap>(new Map());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [stale, setStale] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ totalScanned: number; totalAfterFilters: number }>({ 
    totalScanned: 0, 
    totalAfterFilters: 0 
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
      c.edge = dir(was.edgePct, now.edgePct);
      const nowPrice = typeof now.bestPrice === "string" ? parseInt(now.bestPrice, 10) : now.bestPrice;
      const wasPrice = typeof was.bestPrice === "string" ? parseInt(was.bestPrice, 10) : was.bestPrice;
      c.price = dir(wasPrice, nowPrice);
      
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
      const params = buildQueryParams(prefs, isPro, limit);
      // Add refresh=true for SSE-triggered refreshes to invalidate server cache
      if (!isInitial) {
        params.set("refresh", "true");
      }
      const response = await fetch(`/api/v2/opportunities?${params.toString()}`, { 
        cache: "no-store" 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data = await response.json();
      const cache = cacheRef.current;
      const prev = prevRef.current;
      
      // Parse opportunities
      const rawOpportunities = (data.opportunities || []).map((raw: Record<string, unknown>) => 
        parseOpportunity(raw)
      );
      
      // Apply client-side filters
      const filteredOpportunities = applyClientFilters(rawOpportunities, prefs);
      
      if (isInitial) {
        // Initial load - just populate cache
        cache.clear();
        prev.clear();
        
        const newIds: string[] = [];
        for (const opp of filteredOpportunities) {
          const id = opp.id || `${opp.eventId}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
          cache.set(id, opp);
          prev.set(id, opp);
          newIds.push(id);
          lastUpdateTimeRef.current.set(id, Date.now());
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
        for (const opp of filteredOpportunities) {
          const id = opp.id || `${opp.eventId}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
          newIdSet.add(id);
          
          const existed = cache.has(id);
          const prevOpp = prev.get(id);
          
          // Check if this is an update (odds changed)
          if (existed && prevOpp) {
            const prevPrice = typeof prevOpp.bestPrice === "string" ? parseInt(prevOpp.bestPrice, 10) : prevOpp.bestPrice;
            const newPrice = typeof opp.bestPrice === "string" ? parseInt(opp.bestPrice, 10) : opp.bestPrice;
            const priceChanged = prevPrice !== newPrice;
            const edgeChanged = Math.abs((prevOpp.edgePct || 0) - (opp.edgePct || 0)) > 0.01;
            
            if (priceChanged || edgeChanged) {
              updatedIds.push(id);
            }
          } else {
            addedIds.push(id);
          }
          
          cache.set(id, opp);
          lastUpdateTimeRef.current.set(id, Date.now());
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
        for (const opp of filteredOpportunities) {
          const id = opp.id || `${opp.eventId}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
          prev.set(id, opp);
        }
        
        if (process.env.NODE_ENV === "development" && (addedIds.length > 0 || updatedIds.length > 0 || deletedIds.length > 0)) {
          console.log(`[edge-finder-stream] 📊 +${addedIds.length} ~${updatedIds.length} -${deletedIds.length}`);
        }
      }
      
      // Update version and timestamp
      setVersion((v) => v + 1);
      setLastUpdated(Date.now());
      setMeta({
        totalScanned: data.total_scanned || 0,
        totalAfterFilters: filteredOpportunities.length,
      });
      
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
      console.error("[edge-finder-stream] Fetch error:", e);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [prefs, isPro, limit, enabled, registerDiffs, markForHighlight]);

  // Initial load and filter changes
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Build SSE URL for multi-sport subscription
  const sseUrl = useMemo(() => {
    // Subscribe to all sports for Edge Finder
    return `/api/v2/sse/props?sports=${ALL_SPORTS.join(",")}`;
  }, []);

  // Handle SSE message - debounced refresh
  const handleSSEMessage = useCallback((message: OddsUpdateMessage) => {
    // Only process update messages
    if (message.type !== "update" || !Array.isArray(message.keys) || message.keys.length === 0) {
      return;
    }
    
    // Build list of selected sports/leagues
    const leagueToSport: Record<string, string> = {
      nba: "nba", nfl: "nfl", ncaaf: "ncaaf", ncaab: "ncaab",
      nhl: "nhl", mlb: "mlb", wnba: "wnba", soccer_epl: "soccer_epl",
    };
    
    const selectedSports: string[] = [];
    if (prefs.selectedLeagues.length > 0) {
      for (const league of prefs.selectedLeagues) {
        const sport = leagueToSport[league.toLowerCase()];
        if (sport) selectedSports.push(sport);
      }
    }
    
    // Filter keys to see if any are relevant to our current view
    const relevantKeys = message.keys.filter((key) => 
      isRelevantUpdate(key, selectedSports, prefs.selectedMarkets)
    );
    
    if (relevantKeys.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[edge-finder-stream] Skipping ${message.count} updates (no match)`);
      }
      return;
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[edge-finder-stream] 📡 ${relevantKeys.length}/${message.count} relevant updates`);
    }
    
    // Debounce the refresh to prevent request storms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchData(false);
    }, DEBOUNCE_MS);
  }, [prefs.selectedLeagues, prefs.selectedMarkets, fetchData]);

  // Handle SSE error
  const handleSSEError = useCallback((error: Event) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[edge-finder-stream] SSE error:", error);
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
      .filter(Boolean) as Opportunity[];
  }, [ids]);

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
  };
}
