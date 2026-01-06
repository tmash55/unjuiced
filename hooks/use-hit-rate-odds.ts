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
}

export interface LineOdds {
  stableKey: string;
  primaryLine: number | null;
  currentLine: number | null;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  allLines: Array<{
  line: number;
    bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
    bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
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
const INITIAL_BATCH_SIZE = 25; // Reduced - only load odds for visible rows first
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
export function useHitRateOdds({ rows, enabled = true }: UseHitRateOddsOptions) {
  const queryClient = useQueryClient();
  const backgroundFetchRef = useRef<boolean>(false);
  const allOddsRef = useRef<Record<string, LineOdds>>({});
  
  // Delay odds loading to let profiles render first (better perceived performance)
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (enabled && rows.length > 0) {
      const timer = setTimeout(() => setIsReady(true), STARTUP_DELAY_MS);
      return () => clearTimeout(timer);
    }
    setIsReady(false);
  }, [enabled, rows.length]);

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
          allOddsRef.current = { ...allOddsRef.current, ...result.odds };
        }

        queryClient.setQueryData<OddsResponse>(
          ["hit-rate-odds-merged"],
          { odds: { ...allOddsRef.current } }
        );

        if (i + BACKGROUND_BATCH_SIZE < remainingSelections.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    } catch (error) {
      console.error("[useHitRateOdds] Background fetch error:", error);
    }
  }, [remainingSelections, queryClient]);

  // Start background fetch after initial data loads
  useEffect(() => {
    if (initialQuery.data && remainingSelections.length > 0 && !backgroundFetchRef.current) {
      allOddsRef.current = { ...initialQuery.data.odds };
      
      const timer = setTimeout(fetchRemainingBatches, 200);
      return () => clearTimeout(timer);
    }
  }, [initialQuery.data, remainingSelections.length, fetchRemainingBatches]);

  // Reset background fetch flag when selections change significantly
  useEffect(() => {
    backgroundFetchRef.current = false;
    allOddsRef.current = {};
  }, [allSelections.length]);

  // Subscribe to merged query for updates
  const mergedQuery = useQuery<OddsResponse>({
    queryKey: ["hit-rate-odds-merged"],
    queryFn: () => Promise.resolve({ odds: allOddsRef.current }),
    enabled: false,
    staleTime: Infinity,
  });

  // Combine initial + merged odds
  const combinedOdds = useMemo(() => {
    return {
      ...(initialQuery.data?.odds || {}),
      ...(mergedQuery.data?.odds || {}),
    };
  }, [initialQuery.data, mergedQuery.data]);

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
