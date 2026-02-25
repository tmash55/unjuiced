"use client";

import { useQuery } from "@tanstack/react-query";

export interface TripleDoubleBestPrice {
  book: string;
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export interface TripleDoubleSheetRow {
  id: string;
  player: string;
  team: string | null;
  matchup: string;
  eventId: string;
  startTime: string;
  sgp_ra: TripleDoubleBestPrice | null;
  sgp_pra: TripleDoubleBestPrice | null;
  td: TripleDoubleBestPrice | null;
  hasAllThreeLegs: boolean;
  booksWithRa: number;
  booksWithPra: number;
}

export interface TripleDoubleSheetData {
  rows: TripleDoubleSheetRow[];
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

interface TripleDoubleSheetResponse {
  data: TripleDoubleSheetData | null;
  source: "l1_cache" | "redis_cache" | "computed" | "empty";
  timestamp: number;
  message?: string;
}

const COMPUTE_FALLBACK_COOLDOWN_MS = 2 * 60 * 1000;
let lastComputeFallbackAt = 0;

async function fetchSheet(): Promise<TripleDoubleSheetResponse> {
  const primary = await fetch("/api/dashboard/triple-double-sheet");
  if (!primary.ok) {
    throw new Error("Failed to fetch triple-double sheet");
  }
  const primaryData = (await primary.json()) as TripleDoubleSheetResponse;

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
    const fallback = await fetch("/api/dashboard/triple-double-sheet?compute=true");
    if (!fallback.ok) return primaryData;
    const fallbackData = (await fallback.json()) as TripleDoubleSheetResponse;
    return fallbackData;
  } catch {
    return primaryData;
  }
}

export function useTripleDoubleSheet() {
  return useQuery({
    queryKey: ["triple-double-sheet"],
    queryFn: fetchSheet,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
