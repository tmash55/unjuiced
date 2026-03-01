"use client";

import { useState, useCallback, useMemo } from "react";
import type { LineHistoryContext, LineHistoryBookData, LineHistoryApiRequest, LineHistoryApiResponse } from "@/lib/odds/line-history";
import { computeEVTimeline } from "@/lib/line-history/utils";
import type { EVTimelinePoint } from "@/lib/line-history/types";
import { SHARP_BOOKS } from "@/lib/ev/constants";

const SHARP_BOOK_IDS = Object.keys(SHARP_BOOKS);

interface UseEVTimelineOptions {
  context: LineHistoryContext | null;
  bookDataById: Record<string, LineHistoryBookData>;
}

interface UseEVTimelineResult {
  evTimeline: EVTimelinePoint[];
  showEV: boolean;
  isLoadingOpposite: boolean;
  canShowEV: boolean;
  toggleEV: () => void;
}

/**
 * Hook that computes EV at each timestamp by:
 * 1. Lazily fetching opposite-side data for sharp book(s) on first toggle
 * 2. De-vigging sharp book main+opposite to get fair probability
 * 3. Computing EV against the target (best) book's price at each timestamp
 */
export function useEVTimeline({ context, bookDataById }: UseEVTimelineOptions): UseEVTimelineResult {
  const [showEV, setShowEV] = useState(false);
  const [oppositeData, setOppositeData] = useState<Record<string, LineHistoryBookData>>({});
  const [isLoadingOpposite, setIsLoadingOpposite] = useState(false);

  // Determine if EV overlay is possible: needs a side (two-way market) and sharp book data
  const canShowEV = useMemo(() => {
    if (!context?.side) return false;
    // Must be a two-way side
    const side = context.side;
    if (side !== "over" && side !== "under" && side !== "yes" && side !== "no") return false;
    // Need at least one sharp book with data
    const sharpIds = (context.compareBookIds || []).filter((id) => SHARP_BOOK_IDS.includes(id));
    return sharpIds.some((id) => bookDataById[id]?.entries?.length > 0);
  }, [context, bookDataById]);

  // Find the primary sharp book with data
  const sharpBookId = useMemo(() => {
    if (!context) return null;
    const candidates = (context.compareBookIds || []).filter((id) => SHARP_BOOK_IDS.includes(id));
    return candidates.find((id) => bookDataById[id]?.entries?.length > 0) ?? null;
  }, [context, bookDataById]);

  const fetchOppositeData = useCallback(async () => {
    if (!context || !sharpBookId) return;
    setIsLoadingOpposite(true);
    try {
      const payload: LineHistoryApiRequest & { includeOpposite?: boolean; oppositeBookIds?: string[] } = {
        context,
        books: [sharpBookId],
        includeOpposite: true,
        oppositeBookIds: [sharpBookId],
      };
      const response = await fetch("/api/v2/odds/line-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return;
      const data = (await response.json()) as LineHistoryApiResponse & { oppositeBooks?: LineHistoryBookData[] };
      const incoming = data.oppositeBooks || [];
      const map: Record<string, LineHistoryBookData> = {};
      for (const item of incoming) {
        map[item.bookId] = item;
      }
      setOppositeData(map);
    } catch {
      // Silently fail — EV overlay just won't show data
    } finally {
      setIsLoadingOpposite(false);
    }
  }, [context, sharpBookId]);

  const toggleEV = useCallback(() => {
    if (!showEV && Object.keys(oppositeData).length === 0 && !isLoadingOpposite) {
      void fetchOppositeData();
    }
    setShowEV((prev) => !prev);
  }, [showEV, oppositeData, isLoadingOpposite, fetchOppositeData]);

  // Compute EV timeline when we have opposite data
  const evTimeline = useMemo(() => {
    if (!showEV || !sharpBookId || !context?.bestBookId) return [];
    const sharpData = bookDataById[sharpBookId];
    const oppositeSharp = oppositeData[sharpBookId];
    const targetData = bookDataById[context.bestBookId];
    if (!sharpData?.entries?.length || !oppositeSharp?.entries?.length || !targetData?.entries?.length) return [];
    return computeEVTimeline(sharpData.entries, oppositeSharp.entries, targetData.entries);
  }, [showEV, sharpBookId, bookDataById, oppositeData, context?.bestBookId]);

  return {
    evTimeline,
    showEV,
    isLoadingOpposite,
    canShowEV,
    toggleEV,
  };
}
