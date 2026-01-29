"use client";

/**
 * useEdgeFinderMultiStream Hook
 * 
 * Real-time SSE streaming hook for Edge Finder with multi-preset support.
 * Uses signal-based refreshing via the odds_updates pub/sub infrastructure.
 * 
 * Features:
 * - State machine for connection management
 * - Multi-preset parallel fetching with error isolation
 * - Intelligent merge/deduplication (best edge wins)
 * - Signal-based refresh with debouncing
 * - Change/add/stale row tracking for animations
 * - Graceful degradation on failures
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Opportunity } from "@/lib/types/opportunities";
import type { FilterPreset } from "@/lib/types/filter-presets";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { parseSports } from "@/lib/types/filter-presets";
import { useSSE } from "@/hooks/use-sse";
import { normalizeSportsbookId } from "@/lib/data/sportsbooks";

// =============================================================================
// Types
// =============================================================================

/** Connection state machine */
type ConnectionState = 
  | "idle"           // Auto-refresh disabled
  | "connecting"     // Establishing SSE connection
  | "connected"      // SSE active, ready for updates
  | "fetching"       // Currently fetching data
  | "reconnecting"   // Lost connection, attempting reconnect
  | "failed";        // Max retries exceeded

/** Change direction for animations */
type Direction = "up" | "down";

/** Per-row change tracking */
interface RowChange {
  edge?: Direction;
  price?: Direction;
}

/** Opportunity with metadata for caching */
interface CachedOpportunity extends Opportunity {
  _sourcePreset?: string;  // Which preset contributed this
  _fetchedAt: number;      // When this was fetched
}

/** Cache type */
type Cache = Map<string, CachedOpportunity>;
type ChangeMap = Map<string, RowChange>;

/** SSE message format from odds_updates channel */
interface OddsUpdateMessage {
  type: "update";
  keys: string[];
  count: number;
  timestamp?: string;
}

/** Fetch result from API */
interface FetchResult {
  opportunities: Opportunity[];
  total_scanned?: number;
  total_after_filters?: number;
  timing_ms?: number;
  _presetId?: string;
  _presetName?: string;
}

// =============================================================================
// Constants
// =============================================================================

const FLASH_DURATION = 5000;    // 5s for change highlights
const ADDED_DURATION = 10000;   // 10s for new row highlights
const DEBOUNCE_MS = 2000;       // Debounce refresh requests (longer to batch more updates)
const MIN_REFRESH_INTERVAL = 30000; // Minimum 30s between refreshes to avoid overwhelming API

// All supported sports for broad fetching
const ALL_SPORTS = ["nba", "nfl", "nhl", "mlb", "ncaaf", "ncaab", "wnba", "soccer_epl"];

// =============================================================================
// Options & Result Types
// =============================================================================

export interface UseEdgeFinderMultiStreamOptions {
  prefs: BestOddsPrefs;
  activePresets: FilterPreset[];
  isPro: boolean;
  autoRefresh: boolean;
  limit?: number;
  enabled?: boolean;
}

export interface UseEdgeFinderMultiStreamResult {
  // Data
  rows: Opportunity[];
  ids: string[];
  
  // Animation state
  changes: ChangeMap;
  added: Set<string>;
  stale: Set<string>;
  
  // Metadata
  version: number;
  lastUpdated: number;
  meta: {
    totalScanned: number;
    totalAfterFilters: number;
    activeModelCount: number;
    failedModels: string[];
  };
  
  // Connection state
  connectionState: ConnectionState;
  connected: boolean;
  isReconnecting: boolean;
  hasFailed: boolean;
  
  // Loading states
  loading: boolean;
  isFetching: boolean;
  
  // Error handling
  error: string | null;
  
  // Actions
  refresh: () => Promise<boolean>;
  reconnect: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function dir(a: number | undefined, b: number | undefined): Direction | undefined {
  if (a == null || b == null) return undefined;
  if (b > a) return "up";
  if (b < a) return "down";
  return undefined;
}

function parsePrice(price: string | number | undefined | null): number {
  if (price === undefined || price === null) return 0;
  if (typeof price === "number") return price;
  return parseInt(String(price).replace("+", ""), 10) || 0;
}

/**
 * Check if an odds update key is relevant to our current filters
 * Key format: odds:{sport}:{eventId}:{market}:{book}
 */
function isRelevantUpdate(key: string, sports: Set<string>): boolean {
  const parts = key.split(":");
  if (parts.length < 4) return false;
  const [, keySport] = parts;
  return sports.has(keySport?.toLowerCase() || "");
}

/**
 * Build query params for preset mode (no active custom models)
 */
function buildPresetModeParams(
  prefs: BestOddsPrefs,
  limit: number
): URLSearchParams {
  const params = new URLSearchParams();
  
  // Fetch ALL sports for client-side filtering (hybrid approach)
  params.set("sports", ALL_SPORTS.join(","));
  
  // Set comparison mode
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
  
  // Broad fetch, filter client-side
  params.set("minOdds", String(prefs.minOdds ?? -10000));
  params.set("maxOdds", String(prefs.maxOdds ?? 20000));
  params.set("minEdge", "0");
  params.set("minBooksPerSide", "2");
  params.set("sort", "edge");
  params.set("limit", String(limit));
  
  return params;
}

/**
 * Build query params for a single custom preset
 */
function buildCustomPresetParams(
  preset: FilterPreset,
  prefs: BestOddsPrefs,
  limit: number
): URLSearchParams {
  const params = new URLSearchParams();
  
  // Get sports from preset
  const presetSports = parseSports(preset.sport);
  params.set("sports", presetSports.join(","));
  
  // Build blend from preset's sharp_books and book_weights
  if (preset.sharp_books && preset.sharp_books.length > 0) {
    const weights = preset.book_weights || {};
    const blend = preset.sharp_books.map(book => {
      const weight = (weights[book] || 0) / 100;
      return `${book}:${weight > 0 ? weight : (1 / preset.sharp_books!.length)}`;
    }).join(",");
    params.set("blend", blend);
  }
  
  // Markets from preset
  if (preset.markets && preset.markets.length > 0) {
    params.set("markets", preset.markets.join(","));
  }
  
  // Filter params
  params.set("minOdds", String(preset.min_odds ?? -500));
  params.set("maxOdds", String(preset.max_odds ?? 500));
  params.set("minEdge", String(prefs.minImprovement || 0));
  params.set("minBooksPerSide", String(preset.min_books_reference || 2));
  params.set("requireFullBlend", preset.fallback_mode !== "use_fallback" ? "true" : "false");
  
  if (preset.market_type && preset.market_type !== "all") {
    params.set("marketType", preset.market_type);
  }
  
  params.set("sort", "edge");
  params.set("limit", String(limit));
  
  return params;
}

/**
 * Apply global client-side filters
 */
function applyClientFilters(
  opportunities: CachedOpportunity[],
  prefs: BestOddsPrefs,
  isCustomMode: boolean
): CachedOpportunity[] {
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
    // Sport filter (client-side for preset mode)
    if (!isCustomMode && selectedSports.size > 0) {
      const oppSport = (opp.sport || "").toLowerCase();
      if (!selectedSports.has(oppSport)) return false;
    }
    
    // Min edge filter (client-side)
    // Skip for custom mode - custom presets handle their own filtering server-side
    if (!isCustomMode && prefs.minImprovement && prefs.minImprovement > 0) {
      if ((opp.edgePct || 0) < prefs.minImprovement) return false;
    }
    
    // Odds range filter (client-side)
    // Skip for custom mode - custom presets have their own min/max odds that were applied server-side
    if (!isCustomMode) {
      const minOdds = prefs.minOdds ?? -10000;
      const maxOdds = prefs.maxOdds ?? 20000;
      const oppOdds = parsePrice(opp.bestPrice);
      if (oppOdds < minOdds || oppOdds > maxOdds) return false;
    }
    
    // Markets filter (client-side for preset mode)
    if (!isCustomMode && prefs.selectedMarkets && prefs.selectedMarkets.length > 0) {
      const oppMarket = (opp.market || "").toLowerCase();
      const marketMatches = prefs.selectedMarkets.some(m => 
        oppMarket.includes(m.toLowerCase()) || m.toLowerCase().includes(oppMarket)
      );
      if (!marketMatches) return false;
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

// =============================================================================
// Main Hook
// =============================================================================

export function useEdgeFinderMultiStream({
  prefs,
  activePresets,
  isPro,
  autoRefresh,
  limit = 200,
  enabled = true,
}: UseEdgeFinderMultiStreamOptions): UseEdgeFinderMultiStreamResult {
  // ===== State =====
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [version, setVersion] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeMap>(new Map());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [stale, setStale] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{
    totalScanned: number;
    totalAfterFilters: number;
    activeModelCount: number;
    failedModels: string[];
  }>({ totalScanned: 0, totalAfterFilters: 0, activeModelCount: 0, failedModels: [] });

  // ===== Refs (mutable without re-renders) =====
  const cacheRef = useRef<Cache>(new Map());
  const prevRef = useRef<Cache>(new Map());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingRefreshRef = useRef<boolean>(false); // Track if updates came in during fetch
  const lastFetchTimeRef = useRef<number>(0); // Rate limiting for expensive API calls

  const isCustomMode = activePresets.length > 0;

  // ===== Derived: Get relevant sports for SSE subscription =====
  const relevantSports = useMemo(() => {
    const sports = new Set<string>();
    
    if (isCustomMode) {
      // Union of all preset sports
      for (const preset of activePresets) {
        parseSports(preset.sport).forEach(s => sports.add(s.toLowerCase()));
      }
    } else if (prefs.selectedLeagues.length > 0) {
      // User's selected leagues
      prefs.selectedLeagues.forEach(s => sports.add(s.toLowerCase()));
    } else {
      // Default: all sports
      ALL_SPORTS.forEach(s => sports.add(s));
    }
    
    return sports;
  }, [isCustomMode, activePresets, prefs.selectedLeagues]);

  // ===== SSE URL =====
  const sseUrl = useMemo(() => {
    if (relevantSports.size === 0) return "";
    return `/api/v2/sse/props?sports=${Array.from(relevantSports).join(",")}`;
  }, [relevantSports]);

  // ===== Register changes for animations =====
  const registerDiffs = useCallback((
    newOpps: CachedOpportunity[],
    addedIds: string[],
    changedIds: string[]
  ) => {
    const cache = cacheRef.current;
    const prev = prevRef.current;
    
    // Process changed rows
    if (changedIds.length > 0) {
      const nextChanges = new Map<string, RowChange>(changes);
      
      for (const id of changedIds) {
        const now = cache.get(id);
        const was = prev.get(id);
        if (!now || !was) continue;
        
        const change: RowChange = {};
        
        // Edge change detection
        const prevEdge = was.edgePct ?? 0;
        const currEdge = now.edgePct ?? 0;
        if (Math.abs(currEdge - prevEdge) > 0.01) {
          change.edge = currEdge > prevEdge ? "up" : "down";
        }
        
        // Price change detection
        const prevPrice = parsePrice(was.bestPrice);
        const currPrice = parsePrice(now.bestPrice);
        if (prevPrice !== currPrice) {
          change.price = currPrice > prevPrice ? "up" : "down";
        }
        
        if (change.edge || change.price) {
          nextChanges.set(id, change);
        }
      }
      
      if (nextChanges.size > 0) {
        setChanges(nextChanges);
        setTimeout(() => {
          setChanges(cur => {
            const clone = new Map(cur);
            for (const id of changedIds) clone.delete(id);
            return clone;
          });
        }, FLASH_DURATION);
      }
    }
    
    // Process added rows
    if (addedIds.length > 0) {
      setAdded(prev => {
        const next = new Set(prev);
        for (const id of addedIds) next.add(id);
        return next;
      });
      setTimeout(() => {
        setAdded(prev => {
          const next = new Set(prev);
          for (const id of addedIds) next.delete(id);
          return next;
        });
      }, ADDED_DURATION);
    }
    
    // Update prev cache for next comparison
    for (const opp of newOpps) {
      prev.set(opp.id, opp);
    }
  }, [changes]);

  // ===== Fetch: Preset Mode (single API call) =====
  const fetchPresetMode = useCallback(async (
    signal: AbortSignal
  ): Promise<FetchResult> => {
    const params = buildPresetModeParams(prefs, limit);
    const response = await fetch(`/api/v2/opportunities?${params}`, {
      signal,
      cache: "no-store",
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }, [prefs, limit]);

  // ===== Fetch: Custom Mode (parallel API calls per preset) =====
  const fetchCustomMode = useCallback(async (
    signal: AbortSignal
  ): Promise<{ successful: FetchResult[]; failed: string[] }> => {
    // Parallel fetch with isolated error handling
    const results = await Promise.allSettled(
      activePresets.map(async (preset): Promise<FetchResult> => {
        const params = buildCustomPresetParams(preset, prefs, Math.max(50, Math.floor(limit / activePresets.length)));
        const response = await fetch(`/api/v2/opportunities?${params}`, {
          signal,
          cache: "no-store",
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return {
          ...data,
          _presetId: preset.id,
          _presetName: preset.name,
        };
      })
    );
    
    // Collect successful results and track failures
    const successful: FetchResult[] = [];
    const failed: string[] = [];
    
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        successful.push(result.value);
      } else {
        failed.push(activePresets[i].id);
        console.error(`[EdgeFinder] Preset "${activePresets[i].name}" failed:`, result.reason);
      }
    });
    
    return { successful, failed };
  }, [activePresets, prefs, limit]);

  // ===== Merge & Deduplicate =====
  const mergeResults = useCallback((results: FetchResult[]): CachedOpportunity[] => {
    const merged = new Map<string, CachedOpportunity>();
    const now = Date.now();
    
    for (const result of results) {
      for (const opp of result.opportunities) {
        const key = opp.id;
        const existing = merged.get(key);
        
        // Keep best edge (deduplication strategy)
        if (!existing || (opp.edgePct ?? 0) > (existing.edgePct ?? 0)) {
          merged.set(key, {
            ...opp,
            _sourcePreset: result._presetId,
            _fetchedAt: now,
          });
        }
      }
    }
    
    // Sort by edge descending
    return Array.from(merged.values())
      .sort((a, b) => (b.edgePct ?? 0) - (a.edgePct ?? 0));
  }, []);

  // ===== Main Fetch Function =====
  const fetchData = useCallback(async (isInitial: boolean = false) => {
    if (!enabled) return false;
    
    // If a fetch is already in progress, mark that we need a refresh when it completes
    if (fetchInProgressRef.current) {
      pendingRefreshRef.current = true;
      if (process.env.NODE_ENV === "development") {
        console.log("[edge-finder-stream] ⏳ Fetch in progress, queueing refresh");
      }
      return false;
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    fetchInProgressRef.current = true;
    if (isInitial) setLoading(true);
    setIsFetching(true);
    setError(null);
    if (autoRefresh && connectionState === "connected") {
      setConnectionState("fetching");
    }
    
    try {
      let allOpportunities: CachedOpportunity[];
      let failedModels: string[] = [];
      let totalScanned = 0;
      let totalAfterFilters = 0;
      
      if (isCustomMode) {
        // Custom mode: parallel fetch per preset
        const { successful, failed } = await fetchCustomMode(signal);
        failedModels = failed;
        
        const merged = mergeResults(successful);
        totalScanned = successful.reduce((sum, r) => sum + (r.total_scanned || 0), 0);
        allOpportunities = merged;
      } else {
        // Preset mode: single API call
        const result = await fetchPresetMode(signal);
        totalScanned = result.total_scanned || 0;
        totalAfterFilters = result.total_after_filters || 0;
        
        const now = Date.now();
        allOpportunities = result.opportunities.map(opp => ({
          ...opp,
          _fetchedAt: now,
        }));
      }
      
      // Apply client-side filters
      const filtered = applyClientFilters(allOpportunities, prefs, isCustomMode);
      
      const cache = cacheRef.current;
      const prev = prevRef.current;
      
      if (isInitial) {
        // Initial load - just populate cache
        cache.clear();
        prev.clear();
        
        const newIds: string[] = [];
        for (const opp of filtered) {
          cache.set(opp.id, opp);
          prev.set(opp.id, opp);
          newIds.push(opp.id);
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
        for (const opp of filtered) {
          newIdSet.add(opp.id);
          
          const existed = cache.has(opp.id);
          const prevOpp = prev.get(opp.id);
          
          if (existed && prevOpp) {
            // Check if this is an update
            const priceChanged = parsePrice(prevOpp.bestPrice) !== parsePrice(opp.bestPrice);
            const edgeChanged = Math.abs((prevOpp.edgePct || 0) - (opp.edgePct || 0)) > 0.01;
            
            if (priceChanged || edgeChanged) {
              updatedIds.push(opp.id);
            }
          } else {
            addedIds.push(opp.id);
          }
          
          cache.set(opp.id, opp);
        }
        
        // Find deleted IDs
        for (const [id] of cache) {
          if (!newIdSet.has(id)) {
            deletedIds.push(id);
          }
        }
        
        // Handle deletions - mark as stale
        if (deletedIds.length > 0) {
          setStale(prevStale => {
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
          setStale(prevStale => {
            const next = new Set(prevStale);
            for (const id of [...addedIds, ...updatedIds]) next.delete(id);
            return next;
          });
        }
        
        // Trigger animations
        registerDiffs(filtered, addedIds, updatedIds);
        
        if (process.env.NODE_ENV === "development" && (addedIds.length > 0 || updatedIds.length > 0 || deletedIds.length > 0)) {
          console.log(`[edge-finder-stream] 📊 +${addedIds.length} ~${updatedIds.length} -${deletedIds.length}`);
        }
      }
      
      // Update metadata
      setVersion(v => v + 1);
      setLastUpdated(Date.now());
      setMeta({
        totalScanned,
        totalAfterFilters: filtered.length,
        activeModelCount: isCustomMode ? activePresets.length : 1,
        failedModels,
      });
      
      if (autoRefresh) {
        setConnectionState("connected");
      }
      
      return true;
    } catch (e: any) {
      if (e.name === "AbortError") {
        // Request was cancelled, not an error
        return false;
      }
      setError(e.message || "Failed to fetch");
      console.error("[edge-finder-stream] Fetch error:", e);
      return false;
    } finally {
      fetchInProgressRef.current = false;
      if (isInitial) setLoading(false);
      setIsFetching(false);
      
      // Check if updates came in during the fetch - if so, trigger another refresh
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        if (process.env.NODE_ENV === "development") {
          console.log("[edge-finder-stream] 🔄 Processing queued refresh");
        }
        // Use setTimeout to avoid potential stack overflow and let state settle
        setTimeout(() => fetchData(false), 100);
      }
    }
  }, [
    enabled, autoRefresh, connectionState, isCustomMode, activePresets,
    fetchPresetMode, fetchCustomMode, mergeResults, prefs, registerDiffs
  ]);

  // ===== Initial load and filter changes =====
  useEffect(() => {
    fetchData(true);
    
    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    // Re-fetch on these changes
    prefs.comparisonMode,
    prefs.comparisonBook,
    JSON.stringify(prefs.marketLines),
    JSON.stringify(activePresets.map(p => p.id)),
    isPro,
    enabled,
  ]);

  // ===== Connection state management =====
  useEffect(() => {
    if (autoRefresh && enabled) {
      setConnectionState("connecting");
    } else {
      setConnectionState("idle");
    }
  }, [autoRefresh, enabled]);

  // ===== Handle SSE message - debounced refresh =====
  const handleSSEMessage = useCallback((message: OddsUpdateMessage) => {
    // Only process update messages
    if (message.type !== "update" || !Array.isArray(message.keys) || message.keys.length === 0) {
      return;
    }
    
    // Filter keys to see if any are relevant to our current view
    const relevantKeys = message.keys.filter(key => isRelevantUpdate(key, relevantSports));
    
    if (relevantKeys.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[edge-finder-stream] Skipping ${message.count} updates (no match for sports: ${Array.from(relevantSports).join(",")})`);
      }
      return;
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[edge-finder-stream] 📡 ${relevantKeys.length}/${message.count} relevant updates, fetchInProgress: ${fetchInProgressRef.current}`);
    }
    
    // If a fetch is already in progress, mark for refresh when it completes
    if (fetchInProgressRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    
    // Debounce the refresh to prevent request storms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchData(false);
    }, DEBOUNCE_MS);
  }, [relevantSports, fetchData]);

  // ===== Handle SSE error =====
  const handleSSEError = useCallback((error: Event) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[edge-finder-stream] SSE error:", error);
    }
  }, []);

  // ===== Handle SSE connection change =====
  const handleSSEConnectionChange = useCallback((connected: boolean) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[edge-finder-stream] 🔌 Connection changed: ${connected ? "connected" : "disconnected"}, URL: ${sseUrl}`);
    }
    if (connected) {
      setConnectionState("connected");
      // Refresh data on reconnection
      fetchData(false);
    }
  }, [fetchData, sseUrl]);

  // ===== SSE connection - only when autoRefresh is enabled and Pro =====
  const sseEnabled = isPro && autoRefresh && enabled && sseUrl !== "";
  
  // Debug logging for SSE configuration
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[edge-finder-stream] 🔧 SSE Config: enabled=${sseEnabled}, isPro=${isPro}, autoRefresh=${autoRefresh}, url=${sseUrl}`);
      console.log(`[edge-finder-stream] 🔧 Relevant sports: ${Array.from(relevantSports).join(",")}`);
    }
  }, [sseEnabled, isPro, autoRefresh, sseUrl, relevantSports]);
  
  const {
    isConnected: sseConnected,
    isReconnecting: sseReconnecting,
    hasFailed: sseFailed,
    reconnect: sseReconnect,
  } = useSSE(sseUrl, {
    enabled: sseEnabled,
    onMessage: handleSSEMessage,
    onError: handleSSEError,
    onConnectionChange: handleSSEConnectionChange,
  });

  // ===== Update connection state based on SSE state =====
  useEffect(() => {
    if (!sseEnabled) return;
    
    if (sseFailed) {
      setConnectionState("failed");
    } else if (sseReconnecting) {
      setConnectionState("reconnecting");
    } else if (sseConnected) {
      setConnectionState("connected");
    }
  }, [sseEnabled, sseFailed, sseReconnecting, sseConnected]);

  // ===== Cleanup debounce on unmount =====
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ===== Manual refresh =====
  const refresh = useCallback(async () => {
    return fetchData(false);
  }, [fetchData]);

  // ===== Manual reconnect =====
  const reconnect = useCallback(() => {
    sseReconnect();
    fetchData(false);
  }, [sseReconnect, fetchData]);

  // ===== Build rows from cache =====
  const rows = useMemo(() => {
    return ids
      .map(id => cacheRef.current.get(id))
      .filter(Boolean) as Opportunity[];
  }, [ids]);

  return {
    rows,
    ids,
    changes,
    added,
    stale,
    version,
    lastUpdated,
    meta,
    connectionState,
    connected: sseEnabled ? sseConnected : false,
    isReconnecting: sseEnabled ? sseReconnecting : false,
    hasFailed: sseEnabled ? sseFailed : false,
    loading,
    isFetching,
    error,
    refresh,
    reconnect,
  };
}
