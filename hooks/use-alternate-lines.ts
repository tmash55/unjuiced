"use client";

import { useQuery } from "@tanstack/react-query";

export interface BookOdds {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
}

export interface AlternateLine {
  line: number;
  l5Pct: number | null;
  l10Pct: number | null;
  l20Pct: number | null;
  seasonPct: number | null;
  l5Avg: number | null;
  l10Avg: number | null;
  l20Avg: number | null;
  seasonAvg: number | null;
  bestBook: string | null;
  bestPrice: number | null;
  bestUrl: string | null;
  books: BookOdds[];
  isCurrentLine: boolean;
  edge: "strong" | "moderate" | null;
}

export interface AlternateLinesResponse {
  lines: AlternateLine[];
  playerName: string;
  market: string;
  currentLine: number | null;
  error?: string;
}

export interface UseAlternateLinesOptions {
  sid: string | null;
  playerId: number | null;
  market: string | null;
  currentLine?: number | null;
  enabled?: boolean;
}

async function fetchAlternateLines(
  sid: string,
  playerId: number,
  market: string,
  currentLine?: number | null
): Promise<AlternateLinesResponse> {
  const res = await fetch("/api/nba/alternate-lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sid,
      playerId,
      market,
      currentLine: currentLine ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch alternate lines");
  }

  return res.json();
}

export function useAlternateLines(options: UseAlternateLinesOptions) {
  const { sid, playerId, market, currentLine, enabled = true } = options;

  const isValid = !!sid && !!playerId && !!market;

  const query = useQuery<AlternateLinesResponse>({
    queryKey: ["alternate-lines", sid, playerId, market, currentLine],
    queryFn: () => fetchAlternateLines(sid!, playerId!, market!, currentLine),
    enabled: enabled && isValid,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });

  return {
    lines: query.data?.lines ?? [],
    playerName: query.data?.playerName ?? "",
    market: query.data?.market ?? "",
    currentLine: query.data?.currentLine ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

