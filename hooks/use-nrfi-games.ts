"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { NrfiResponse } from "@/lib/nrfi-data";

interface NrfiOptions {
  date?: string;
  seasons?: string;       // "2025" or "2023-2025"
  lastStarts?: number;
}

async function fetchNrfiGames(opts: NrfiOptions): Promise<NrfiResponse> {
  const params = new URLSearchParams();
  if (opts.date) params.set("date", opts.date);
  if (opts.seasons) params.set("seasons", opts.seasons);
  if (opts.lastStarts) params.set("last_starts", String(opts.lastStarts));
  const qs = params.toString();
  const res = await fetch(`/api/mlb/nrfi${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch NRFI data");
  }
  return res.json();
}

export function useNrfiGames(opts: NrfiOptions = {}) {
  const query = useQuery<NrfiResponse>({
    queryKey: ["mlb-nrfi", opts.date ?? "today", opts.seasons ?? "2025", opts.lastStarts ?? 3],
    queryFn: () => fetchNrfiGames(opts),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  return {
    games: query.data?.games ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
