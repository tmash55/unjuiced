"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useEffect, useRef, useCallback } from "react";

export interface BookOdds {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
}

export interface LineOdds {
  sid: string;
  resolvedSid: string | null;
  line: number;
  bestBook: string | null;
  bestPrice: number | null;
  bestUrl: string | null;
  books: BookOdds[];
}

interface SelectionRequest {
  sid: string;
  playerId: number;
  market: string;
  line: number;
}

interface OddsResponse {
  odds: Record<string, LineOdds>;
}

// Batch size for progressive loading
const INITIAL_BATCH_SIZE = 50;  // First batch - immediate
const BACKGROUND_BATCH_SIZE = 100; // Background batches

async function fetchHitRateOdds(selections: SelectionRequest[]): Promise<OddsResponse> {
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
  oddsSelectionId: string | null;
  playerId: number | null;
  market: string | null;
  line: number | null;
}

interface UseHitRateOddsOptions {
  /** Array of rows with oddsSelectionId, playerId, market, and line */
  rows: RowData[];
  /** Whether to enable the query */
  enabled?: boolean;
}

/**
 * Progressive odds loading hook
 * 
 * Strategy:
 * 1. Immediately fetch odds for first N rows (visible on screen)
 * 2. Background fetch remaining rows in batches
 * 3. Merge results into a single cache
 * 
 * This gives instant perceived performance while loading the rest.
 */
export function useHitRateOdds({ rows, enabled = true }: UseHitRateOddsOptions) {
  const queryClient = useQueryClient();
  const backgroundFetchRef = useRef<boolean>(false);
  const allOddsRef = useRef<Record<string, LineOdds>>({});

  // Build unique selections from rows
  const allSelections = useMemo(() => {
    const seen = new Set<string>();
    const result: SelectionRequest[] = [];

    for (const row of rows) {
      if (!row.oddsSelectionId || row.line === null || !row.playerId || !row.market) continue;
      
      const key = `${row.playerId}:${row.market}:${row.line}`;
      if (seen.has(key)) continue;
      
      seen.add(key);
      result.push({
        sid: row.oddsSelectionId,
        playerId: row.playerId,
        market: row.market,
        line: row.line,
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
    const sortedKeys = initialSelections.map((s) => `${s.playerId}:${s.market}:${s.line}`).sort();
    return ["hit-rate-odds-initial", sortedKeys.join(",")];
  }, [initialSelections]);

  // Fetch initial batch immediately
  const initialQuery = useQuery<OddsResponse>({
    queryKey: initialQueryKey,
    queryFn: () => fetchHitRateOdds(initialSelections),
    enabled: enabled && initialSelections.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Background fetch remaining batches
  const fetchRemainingBatches = useCallback(async () => {
    if (backgroundFetchRef.current || remainingSelections.length === 0) return;
    backgroundFetchRef.current = true;

    try {
      // Process in batches
      for (let i = 0; i < remainingSelections.length; i += BACKGROUND_BATCH_SIZE) {
        const batch = remainingSelections.slice(i, i + BACKGROUND_BATCH_SIZE);
        if (batch.length === 0) continue;

        const result = await fetchHitRateOdds(batch);
        
        // Merge into ref
        if (result.odds) {
          allOddsRef.current = { ...allOddsRef.current, ...result.odds };
        }

        // Update the query cache to trigger re-render
        queryClient.setQueryData<OddsResponse>(
          ["hit-rate-odds-merged"],
          { odds: { ...allOddsRef.current } }
        );

        // Small delay between batches to not overwhelm
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
      // Merge initial data into ref
      allOddsRef.current = { ...initialQuery.data.odds };
      
      // Start background fetch after a short delay
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
    enabled: false, // Only updated via setQueryData
    staleTime: Infinity,
  });

  // Combine initial + merged odds
  const combinedOdds = useMemo(() => {
    return {
      ...(initialQuery.data?.odds || {}),
      ...(mergedQuery.data?.odds || {}),
    };
  }, [initialQuery.data, mergedQuery.data]);

  // Create a lookup function
  const getOdds = useCallback(
    (sid: string | null): LineOdds | null => {
      if (!sid) return null;
      return combinedOdds[sid] || null;
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
