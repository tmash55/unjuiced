"use client";

import { useQuery } from "@tanstack/react-query";

export interface MlbGame {
  game_id: string;
  game_date: string;
  home_team_name: string;
  away_team_name: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number | null;
  away_team_score: number | null;
  game_status: string;
  is_primetime: boolean | null;
  national_broadcast: string | null;
  neutral_site: boolean | null;
  season_type: string | null;
}

interface GamesResponse {
  games: MlbGame[];
  dates: string[];
  primaryDate: string;
}

async function fetchMlbGames(): Promise<GamesResponse> {
  const res = await fetch("/api/mlb/games", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

export function useMlbGames(enabled = true) {
  const query = useQuery<GamesResponse>({
    queryKey: ["mlb-games"],
    queryFn: fetchMlbGames,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    games: query.data?.games || [],
    gamesDates: query.data?.dates || [],
    primaryDate: query.data?.primaryDate || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
