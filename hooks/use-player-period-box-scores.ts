"use client";

import { useQuery } from "@tanstack/react-query";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

export interface PlayerPeriodBoxScoresResponse {
  period: number;
  season: string;
  games: BoxScoreGame[];
}

export interface UsePlayerPeriodBoxScoresOptions {
  playerId: number | null;
  sport?: "nba" | "wnba";
  /** Period to fetch (1 = Q1). Defaults to 1 since that's the only market today. */
  period?: 1 | 2 | 3 | 4;
  season?: string;
  limit?: number;
  enabled?: boolean;
}

async function fetchPlayerPeriodBoxScores(
  sport: "nba" | "wnba",
  playerId: number,
  period: number,
  season?: string,
  limit?: number
): Promise<PlayerPeriodBoxScoresResponse> {
  const params = new URLSearchParams();
  params.set("playerId", String(playerId));
  params.set("period", String(period));
  if (season) params.set("season", season);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/${sport}/player-period-box-scores?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch period box scores");
  }
  return res.json();
}

export function usePlayerPeriodBoxScores(options: UsePlayerPeriodBoxScoresOptions) {
  const { playerId, sport = "nba", period = 1, season, limit, enabled = true } = options;

  const query = useQuery<PlayerPeriodBoxScoresResponse>({
    queryKey: ["player-period-box-scores", sport, playerId, period, season, limit],
    queryFn: () => fetchPlayerPeriodBoxScores(sport, playerId!, period, season, limit),
    enabled: enabled && playerId !== null,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    period: query.data?.period ?? period,
    season: query.data?.season ?? "",
    games: query.data?.games ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
