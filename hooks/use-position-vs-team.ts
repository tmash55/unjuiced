"use client";

import { useQuery } from "@tanstack/react-query";

export interface PositionVsTeamPlayer {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string; // Player's actual position (PG, SG, SF, PF, C)
  stat: number;
  gameDate: string;
  pts: number;
  reb: number;
  ast: number;
  minutes: number;
}

export interface PositionVsTeamResponse {
  players: PositionVsTeamPlayer[];
  avgStat: number;
  minStat: number;
  maxStat: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  totalGames: number;
  playerCount: number;
  position: string;
  opponentTeamAbbr: string;
  market: string;
  error?: string;
}

export interface UsePositionVsTeamOptions {
  position: string | null;
  opponentTeamId: number | null;
  market: string | null;
  season?: string;
  limit?: number;
  minMinutes?: number;
  enabled?: boolean;
}

async function fetchPositionVsTeam(
  position: string,
  opponentTeamId: number,
  market: string,
  season?: string,
  limit?: number,
  minMinutes?: number
): Promise<PositionVsTeamResponse> {
  const params = new URLSearchParams({
    position,
    opponentTeamId: String(opponentTeamId),
    market,
  });
  
  if (season) {
    params.set("season", season);
  }
  if (limit) {
    params.set("limit", String(limit));
  }
  if (minMinutes !== undefined) {
    params.set("minMinutes", String(minMinutes));
  }

  const res = await fetch(`/api/nba/position-vs-team?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch position vs team data");
  }

  return res.json();
}

export function usePositionVsTeam(options: UsePositionVsTeamOptions) {
  const { position, opponentTeamId, market, season, limit, minMinutes, enabled = true } = options;

  const isValid = !!position && !!opponentTeamId && !!market;

  const query = useQuery<PositionVsTeamResponse>({
    queryKey: ["position-vs-team", position, opponentTeamId, market, season, limit, minMinutes],
    queryFn: () => fetchPositionVsTeam(position!, opponentTeamId!, market!, season, limit, minMinutes),
    enabled: enabled && isValid,
    staleTime: 5 * 60_000, // 5 minutes (historical data doesn't change often)
    gcTime: 10 * 60_000, // 10 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
  });

  return {
    players: query.data?.players ?? [],
    avgStat: query.data?.avgStat ?? 0,
    minStat: query.data?.minStat ?? 0,
    maxStat: query.data?.maxStat ?? 0,
    avgPoints: query.data?.avgPoints ?? 0,
    avgRebounds: query.data?.avgRebounds ?? 0,
    avgAssists: query.data?.avgAssists ?? 0,
    totalGames: query.data?.totalGames ?? 0,
    playerCount: query.data?.playerCount ?? 0,
    position: query.data?.position ?? "",
    opponentTeamAbbr: query.data?.opponentTeamAbbr ?? "",
    market: query.data?.market ?? "",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

