"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to prefetch player data on hover for faster modal loading
 * 
 * Usage:
 * const prefetch = usePrefetchPlayer();
 * <button onMouseEnter={() => prefetch(playerId)}>View Profile</button>
 */
export function usePrefetchPlayer() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(
    async (nbaPlayerId: number | null | undefined) => {
      if (!nbaPlayerId) return;

      // Prefetch box scores (most expensive call)
      queryClient.prefetchQuery({
        queryKey: ["player-box-scores", nbaPlayerId, undefined, 25],
        queryFn: async () => {
          const params = new URLSearchParams();
          params.set("playerId", String(nbaPlayerId));
          params.set("limit", "25");
          const res = await fetch(`/api/nba/player-box-scores?${params.toString()}`);
          if (!res.ok) return { player: null, season: "", seasonSummary: null, games: [] };
          return res.json();
        },
        staleTime: 10 * 60_000, // 10 minutes
      });

      // Prefetch hit rate profiles
      queryClient.prefetchQuery({
        queryKey: ["hit-rate-table", { player_id: nbaPlayerId, limit: 20 }],
        queryFn: async () => {
          const url = `/api/nba/hit-rates?player_id=${nbaPlayerId}&limit=20`;
          const res = await fetch(url);
          if (!res.ok) return { rows: [], count: 0, meta: {} };
          return res.json();
        },
        staleTime: 60_000, // 1 minute
      });
    },
    [queryClient]
  );

  return prefetch;
}

/**
 * Prefetch by odds_player_id (requires lookup first)
 */
export function usePrefetchPlayerByOddsId() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(
    async (oddsPlayerId: string | null | undefined) => {
      if (!oddsPlayerId) return;

      // First prefetch the lookup
      queryClient.prefetchQuery({
        queryKey: ["player-lookup", oddsPlayerId, undefined],
        queryFn: async () => {
          const response = await fetch('/api/players/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ odds_player_id: oddsPlayerId }),
          });
          if (!response.ok) return { player: null };
          return response.json();
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
      });
    },
    [queryClient]
  );

  return prefetch;
}

