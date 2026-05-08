"use client";

import { useQuery } from "@tanstack/react-query";

export interface DoubleDoubleBestPrice {
  book: string;
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export interface DoubleDoubleSheetRow {
  id: string;
  playerId: string;
  player: string;
  team: string | null;
  matchup: string;
  eventId: string;
  startTime: string;
  sgp_pr: DoubleDoubleBestPrice | null;
  sgp_pa: DoubleDoubleBestPrice | null;
  dd: DoubleDoubleBestPrice | null;
  allSgpPr: DoubleDoubleBestPrice[];
  allSgpPa: DoubleDoubleBestPrice[];
  allDd: DoubleDoubleBestPrice[];
  hasAllThreeLegs: boolean;
  booksWithPr: number;
  booksWithPa: number;
}

export interface DoubleDoubleSheetData {
  rows: DoubleDoubleSheetRow[];
  generatedAt: number;
  generatedAtIso: string;
  meta: {
    sport: string;
    targetLine: number;
    candidateCount: number;
    rowCount: number;
    books: string[];
    quoteStats: {
      totalRequests: number;
      vendorCalls: number;
      cacheHits: number;
      staleServed: number;
      errors: number;
    };
  };
}

interface DoubleDoubleSheetResponse {
  data: DoubleDoubleSheetData | null;
  source: "l1_cache" | "redis_cache" | "computed" | "empty";
  timestamp: number;
  message?: string;
}

const COMPUTE_FALLBACK_COOLDOWN_MS = 2 * 60 * 1000;
let lastComputeFallbackAt = 0;

async function fetchSheet(): Promise<DoubleDoubleSheetResponse> {
  const primary = await fetch("/api/dashboard/double-double-sheet");
  if (!primary.ok) {
    throw new Error("Failed to fetch double-double sheet");
  }
  const primaryData = (await primary.json()) as DoubleDoubleSheetResponse;

  if (primaryData.data?.rows?.length) {
    return primaryData;
  }

  const now = Date.now();
  const shouldTryCompute =
    primaryData.source === "empty" &&
    now - lastComputeFallbackAt > COMPUTE_FALLBACK_COOLDOWN_MS;

  if (!shouldTryCompute) return primaryData;

  lastComputeFallbackAt = now;
  try {
    const fallback = await fetch("/api/dashboard/double-double-sheet?compute=true");
    if (!fallback.ok) return primaryData;
    const fallbackData = (await fallback.json()) as DoubleDoubleSheetResponse;
    return fallbackData;
  } catch {
    return primaryData;
  }
}

export function useDoubleDoubleSheet({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["double-double-sheet"],
    queryFn: fetchSheet,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
