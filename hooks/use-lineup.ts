"use client";

import { useQuery } from "@tanstack/react-query";
import type { LineupResponse } from "@/lib/api/lineup-handler";

export type {
  LineupPlayer,
  TeamLineup,
  LineupResponse,
} from "@/lib/api/lineup-handler";

export interface UseLineupOptions {
  gameId?: number | string | null;
  teamId?: number | null;
  date?: string | null;
  sport: "nba" | "wnba";
  enabled?: boolean;
}

async function fetchLineup(
  sport: "nba" | "wnba",
  gameId?: number | string | null,
  teamId?: number | null,
  date?: string | null,
): Promise<LineupResponse> {
  const params = new URLSearchParams();
  if (gameId !== undefined && gameId !== null && String(gameId).length > 0) {
    params.set("gameId", String(gameId));
  } else {
    if (teamId !== undefined && teamId !== null)
      params.set("teamId", String(teamId));
    if (date !== undefined && date !== null) params.set("date", date);
  }
  const res = await fetch(`/api/${sport}/lineup?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch lineup");
  }
  return res.json();
}

export function useLineup(options: UseLineupOptions) {
  const { gameId, teamId, date, sport, enabled = true } = options;
  // We need EITHER a gameId or (teamId + date) — disable the query otherwise.
  const hasIdentifier =
    (gameId !== undefined && gameId !== null && String(gameId).length > 0) ||
    (teamId !== undefined &&
      teamId !== null &&
      date !== undefined &&
      date !== null);

  const query = useQuery<LineupResponse>({
    queryKey: ["lineup", sport, gameId ?? null, teamId ?? null, date ?? null],
    queryFn: () => fetchLineup(sport, gameId, teamId, date),
    enabled: enabled && hasIdentifier,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    teams: query.data?.teams ?? [],
    gameId: query.data?.gameId ?? null,
    gameDate: query.data?.gameDate ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
