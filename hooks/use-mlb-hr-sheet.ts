"use client";

import { useQuery } from "@tanstack/react-query";
import type { HRSheetPlayer, HRSheetResponse } from "@/app/api/mlb/hr-power-sheet/route";

interface UseMlbHRSheetOptions {
  date?: string;
  enabled?: boolean;
  limit?: number;
}

async function fetchHRSheet(date?: string, limit?: number): Promise<HRSheetResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`/api/mlb/hr-power-sheet?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch HR sheet");
  }
  return res.json();
}

export function useMlbHRSheet({ date, enabled = true, limit }: UseMlbHRSheetOptions = {}) {
  const query = useQuery({
    queryKey: ["mlb-hr-sheet", date ?? "today", limit],
    queryFn: () => fetchHRSheet(date, limit),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    players: query.data?.players ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export type { HRSheetPlayer };
