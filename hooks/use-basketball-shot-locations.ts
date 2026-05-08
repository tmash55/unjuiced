"use client";

import { useQuery } from "@tanstack/react-query";
import type { BasketballShotLocationsResponse } from "@/app/api/basketball/shot-locations/route";

export type BasketballShotLocationsSport = "nba" | "wnba";
export type BasketballShotMadeFilter = "all" | "made" | "missed";

interface UseBasketballShotLocationsOptions {
  sport?: BasketballShotLocationsSport;
  playerId: number | null | undefined;
  season?: string | null;
  seasonType?: string | null;
  lastNGames?: number | null;
  gameId?: string | number | null;
  period?: number | null;
  half?: 1 | 2 | null;
  madeFilter?: BasketballShotMadeFilter;
  limit?: number;
  enabled?: boolean;
}

async function fetchBasketballShotLocations({
  sport = "nba",
  playerId,
  season,
  seasonType,
  lastNGames,
  gameId,
  period,
  half,
  madeFilter = "all",
  limit = 750,
}: UseBasketballShotLocationsOptions): Promise<BasketballShotLocationsResponse> {
  if (typeof playerId !== "number") {
    throw new Error("playerId is required");
  }

  const params = new URLSearchParams({
    sport,
    playerId: String(playerId),
    madeFilter,
    limit: String(limit),
  });

  if (season) params.set("season", season);
  if (seasonType) params.set("seasonType", seasonType);
  if (lastNGames != null) params.set("lastNGames", String(lastNGames));
  if (gameId != null) params.set("gameId", String(gameId));
  if (period != null) params.set("period", String(period));
  if (half != null) params.set("half", String(half));

  const res = await fetch(`/api/basketball/shot-locations?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || body?.message || "Failed to fetch basketball shot locations");
  }

  return res.json();
}

export function useBasketballShotLocations(options: UseBasketballShotLocationsOptions) {
  const {
    sport = "nba",
    playerId,
    season,
    seasonType,
    lastNGames,
    gameId,
    period,
    half,
    madeFilter = "all",
    limit = 750,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: [
      "basketball-shot-locations",
      sport,
      playerId,
      season,
      seasonType,
      lastNGames,
      gameId,
      period,
      half,
      madeFilter,
      limit,
    ],
    queryFn: () =>
      fetchBasketballShotLocations({
        sport,
        playerId,
        season,
        seasonType,
        lastNGames,
        gameId,
        period,
        half,
        madeFilter,
        limit,
      }),
    enabled: enabled && typeof playerId === "number",
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export type { BasketballShotLocationsResponse };
