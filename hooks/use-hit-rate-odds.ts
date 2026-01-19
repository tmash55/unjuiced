"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useEffect, useRef, useCallback, useState } from "react";

/**
 * New Stable Key System for Hit Rate Odds
 * 
 * Uses the stable key from odds_selection_id for lookups.
 * This key never changes, even when betting lines move.
 */

export interface BookOddsData {
  price: number;
  url: string | null;
  mobileUrl: string | null;
  sgp?: string | null;  // SGP token for same-game parlay API
}

export interface LineOdds {
  stableKey: string;
  eventId: string | null;    // For fetching full link data
  market: string | null;     // For fetching full link data
  primaryLine: number | null;
  currentLine: number | null;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp?: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp?: string | null } | null;
  allLines: Array<{
    line: number;
    bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp?: string | null } | null;
    bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp?: string | null } | null;
    books: Record<string, { over?: BookOddsData; under?: BookOddsData }>;
  }>;
  live: boolean;
  timestamp: number | null;
}

interface OddsRequest {
  stableKey: string;
  line?: number;
}

interface OddsResponse {
  odds: Record<string, LineOdds>;
}

// Batch size for progressive loading
const INITIAL_BATCH_SIZE = 100; // Increased to ensure filtering works correctly on initial load
const BACKGROUND_BATCH_SIZE = 100;
const STARTUP_DELAY_MS = 150; // Let profiles render before fetching odds

async function fetchHitRateOdds(selections: OddsRequest[]): Promise<OddsResponse> {
  if (!selections.length) {
    return { odds: {} };
  }

  const res = await fetch("/api/nba/hit-rates/odds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch odds");
  }

  return res.json();
}

interface RowData {
  oddsSelectionId: string | null;  // This is now the stable key
  line: number | null;
}

interface UseHitRateOddsOptions {
  /** Array of rows with oddsSelectionId (stable key) and line */
  rows: RowData[];
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Progressive odds loading hook using the new stable key system
 * 
 * Strategy:
 * 1. Immediately fetch odds for first N rows (visible on screen)
 * 2. Background fetch remaining rows in batches
 * 3. Merge results into a single cache
 */
// Global cache for odds - persists across component remounts and navigation
// This ensures we don't lose odds when navigating to/from drilldown
const globalOddsCache: Record<string, LineOdds> = {};

export function useHitRateOdds({ rows, enabled = true }: UseHitRateOddsOptions) {
  const queryClient = useQueryClient();
  const backgroundFetchRef = useRef<boolean>(false);
  const allOddsRef = useRef<Record<string, LineOdds>>(globalOddsCache);
  
  // Force re-render when global cache updates
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // Check if we have any cached odds (including from global cache)
  const hasCachedOdds = Object.keys(globalOddsCache).length > 0;
  
  // Delay odds loading to let profiles render first (better perceived performance)
  // But if we already have cached odds, skip the delay
  const [isReady, setIsReady] = useState(hasCachedOdds);
  
  useEffect(() => {
    if (enabled && rows.length > 0) {
      // Skip delay if we already have cached odds (e.g., returning from drilldown)
      if (hasCachedOdds) {
        setIsReady(true);
        return;
      }
      const timer = setTimeout(() => setIsReady(true), STARTUP_DELAY_MS);
      return () => clearTimeout(timer);
    }
    // Don't reset isReady to false when rows temporarily empty (navigation)
    // Only reset if explicitly disabled
    if (!enabled) {
      setIsReady(false);
    }
  }, [enabled, rows.length, hasCachedOdds]);

  // Build unique selections from rows
  const allSelections = useMemo(() => {
    const seen = new Set<string>();
    const result: OddsRequest[] = [];

    for (const row of rows) {
      if (!row.oddsSelectionId) continue;
      
      const key = row.oddsSelectionId;
      if (seen.has(key)) continue;
      
      seen.add(key);
      result.push({
        stableKey: row.oddsSelectionId,
        line: row.line ?? undefined,
      });
    }

    return result;
  }, [rows]);

  // Split into initial batch (immediate) and remaining (background)
  const initialSelections = useMemo(
    () => allSelections.slice(0, INITIAL_BATCH_SIZE),
    [allSelections]
  );

  const remainingSelections = useMemo(
    () => allSelections.slice(INITIAL_BATCH_SIZE),
    [allSelections]
  );

  // Query key for initial batch
  const initialQueryKey = useMemo(() => {
    const sortedKeys = initialSelections.map((s) => s.stableKey).sort();
    return ["hit-rate-odds-initial", sortedKeys.join(",")];
  }, [initialSelections]);

  // Fetch initial batch after startup delay (let profiles render first)
  const initialQuery = useQuery<OddsResponse>({
    queryKey: initialQueryKey,
    queryFn: () => fetchHitRateOdds(initialSelections),
    enabled: isReady && initialSelections.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Background fetch remaining batches
  const fetchRemainingBatches = useCallback(async () => {
    if (backgroundFetchRef.current || remainingSelections.length === 0) return;
    backgroundFetchRef.current = true;

    try {
      for (let i = 0; i < remainingSelections.length; i += BACKGROUND_BATCH_SIZE) {
        const batch = remainingSelections.slice(i, i + BACKGROUND_BATCH_SIZE);
        if (batch.length === 0) continue;

        const result = await fetchHitRateOdds(batch);
        
        if (result.odds) {
          // Update both ref and global cache
          Object.assign(globalOddsCache, result.odds);
          allOddsRef.current = globalOddsCache;
          // Trigger re-render
          setCacheVersion(v => v + 1);
        }

        queryClient.setQueryData<OddsResponse>(
          ["hit-rate-odds-merged"],
          { odds: { ...globalOddsCache } }
        );

        if (i + BACKGROUND_BATCH_SIZE < remainingSelections.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    } catch (error) {
      console.error("[useHitRateOdds] Background fetch error:", error);
    }
  }, [remainingSelections, queryClient]);

  // Track the previous selections to detect meaningful changes
  const prevSelectionsRef = useRef<string>("");
  
  // Merge initial data into global cache when it arrives
  useEffect(() => {
    if (initialQuery.data?.odds) {
      Object.assign(globalOddsCache, initialQuery.data.odds);
      allOddsRef.current = globalOddsCache;
      setCacheVersion(v => v + 1);
    }
  }, [initialQuery.data]);
  
  // Start background fetch after initial data loads
  useEffect(() => {
    if (initialQuery.data && remainingSelections.length > 0 && !backgroundFetchRef.current) {
      const timer = setTimeout(fetchRemainingBatches, 200);
      return () => clearTimeout(timer);
    }
  }, [initialQuery.data, remainingSelections.length, fetchRemainingBatches]);

  // Only reset when selections ACTUALLY change (not just length)
  // This prevents losing odds when navigating back from drilldown
  useEffect(() => {
    const currentSelectionKey = allSelections.map(s => s.stableKey).sort().join(",");
    
    // Only reset if the actual keys changed significantly (>50% different)
    if (prevSelectionsRef.current && currentSelectionKey) {
      const prevKeys = new Set(prevSelectionsRef.current.split(","));
      const currentKeys = new Set(currentSelectionKey.split(","));
      
      // Check overlap - if most keys are the same, don't reset
      let overlap = 0;
      for (const key of currentKeys) {
        if (prevKeys.has(key)) overlap++;
      }
      
      const overlapRatio = currentKeys.size > 0 ? overlap / currentKeys.size : 0;
      
      // Only reset if less than 50% overlap (significant change in data)
      if (overlapRatio < 0.5) {
        backgroundFetchRef.current = false;
        // Don't clear allOddsRef - keep cached odds for keys that still exist
      }
    }
    
    prevSelectionsRef.current = currentSelectionKey;
  }, [allSelections]);

  // Subscribe to merged query for updates
  const mergedQuery = useQuery<OddsResponse>({
    queryKey: ["hit-rate-odds-merged"],
    queryFn: () => Promise.resolve({ odds: allOddsRef.current }),
    enabled: false,
    staleTime: Infinity,
  });

  // Combine all odds sources - global cache is the primary source
  // cacheVersion triggers re-render when cache updates
  const combinedOdds = useMemo(() => {
    // Use global cache as the source of truth
    return { ...globalOddsCache };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheVersion, initialQuery.data, mergedQuery.data]);

  // Create a lookup function by stable key
  const getOdds = useCallback(
    (stableKey: string | null): LineOdds | null => {
      if (!stableKey) return null;
      return combinedOdds[stableKey] || null;
    },
    [combinedOdds]
  );

  return {
    oddsMap: combinedOdds,
    getOdds,
    isLoading: initialQuery.isLoading,
    isFetching: initialQuery.isFetching,
    isLoadingMore: backgroundFetchRef.current && remainingSelections.length > 0,
    loadedCount: Object.keys(combinedOdds).length,
    totalCount: allSelections.length,
    error: initialQuery.error as Error | null,
    refetch: initialQuery.refetch,
  };
}
