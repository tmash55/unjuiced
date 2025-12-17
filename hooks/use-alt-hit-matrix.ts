"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Alt Hit Matrix Hook
 * 
 * Fetches hit rates across multiple line thresholds for multiple players.
 */

export interface AltHitMatrixHitRate {
  line: number;
  offset: number;
  hitRate: number | null;
  hits: number;
  games: number;
}

export interface AltHitMatrixRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  opponentAbbr: string;
  homeAway: string;
  position: string;
  line: number;
  market: string;
  gameId: number;
  gameDate: string;
  oddsSelectionId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  hitRates: AltHitMatrixHitRate[];
  bestOdds: number | null;
  bestBook: string | null;
}

export interface AltHitMatrixResponse {
  rows: AltHitMatrixRow[];
  market: string;
  timeWindow: string;
  lineOffsets: number[];
}

export type AltHitMatrixTimeWindow = "last_5" | "last_10" | "last_20" | "season";

export interface UseAltHitMatrixOptions {
  market?: string;
  gameDate?: string;
  timeWindow?: AltHitMatrixTimeWindow;
  enabled?: boolean;
}

async function fetchAltHitMatrix(options: UseAltHitMatrixOptions): Promise<AltHitMatrixResponse> {
  const res = await fetch("/api/nba/alt-hit-matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market: options.market || "player_points",
      gameDate: options.gameDate,
      timeWindow: options.timeWindow || "last_10",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch alt hit matrix");
  }

  return res.json();
}

export function useAltHitMatrix(options: UseAltHitMatrixOptions = {}) {
  const { market = "player_points", gameDate, timeWindow = "last_10", enabled = true } = options;

  const query = useQuery<AltHitMatrixResponse>({
    queryKey: ["alt-hit-matrix", market, gameDate, timeWindow],
    queryFn: () => fetchAltHitMatrix({ market, gameDate, timeWindow }),
    enabled,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });

  return {
    rows: query.data?.rows ?? [],
    market: query.data?.market ?? market,
    timeWindow: query.data?.timeWindow ?? timeWindow,
    lineOffsets: query.data?.lineOffsets ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

// Color utility functions for the matrix
export function getHitRateColor(hitRate: number | null): string {
  if (hitRate === null) return "bg-neutral-200 dark:bg-neutral-700";
  if (hitRate >= 80) return "bg-emerald-600 dark:bg-emerald-600";
  if (hitRate >= 70) return "bg-emerald-500 dark:bg-emerald-500";
  if (hitRate >= 60) return "bg-emerald-400 dark:bg-emerald-400";
  if (hitRate >= 50) return "bg-amber-400 dark:bg-amber-500";
  if (hitRate >= 40) return "bg-orange-400 dark:bg-orange-500";
  if (hitRate >= 30) return "bg-red-400 dark:bg-red-500";
  return "bg-red-600 dark:bg-red-600";
}

export function getHitRateTextColor(hitRate: number | null): string {
  if (hitRate === null) return "text-neutral-500";
  if (hitRate >= 50) return "text-white";
  return "text-white";
}

// Market display labels
export const ALT_MATRIX_MARKETS = [
  { value: "player_points", label: "Points", abbr: "PTS" },
  { value: "player_rebounds", label: "Rebounds", abbr: "REB" },
  { value: "player_assists", label: "Assists", abbr: "AST" },
  { value: "player_points_rebounds_assists", label: "PRA", abbr: "PRA" },
  { value: "player_points_rebounds", label: "P+R", abbr: "P+R" },
  { value: "player_points_assists", label: "P+A", abbr: "P+A" },
  { value: "player_rebounds_assists", label: "R+A", abbr: "R+A" },
  { value: "player_threes_made", label: "3PM", abbr: "3PM" },
  { value: "player_steals", label: "Steals", abbr: "STL" },
  { value: "player_blocks", label: "Blocks", abbr: "BLK" },
  { value: "player_blocks_steals", label: "Blk+Stl", abbr: "B+S" },
];

export const TIME_WINDOW_OPTIONS = [
  { value: "last_5" as const, label: "L5", shortLabel: "L5" },
  { value: "last_10" as const, label: "L10", shortLabel: "L10" },
  { value: "last_20" as const, label: "L20", shortLabel: "L20" },
  { value: "season" as const, label: "Season", shortLabel: "SZN" },
];

