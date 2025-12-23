"use client";

import { useQuery } from "@tanstack/react-query";

export interface NbaGame {
  game_id: string;
  game_date: string;
  home_team_name: string;
  away_team_name: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number | null;
  away_team_score: number | null;
  game_status: string; // e.g., "7:00 pm ET" or "Final"
  is_primetime: boolean | null;
  national_broadcast: string | null;
  neutral_site: boolean | null;
  season_type: string | null; // e.g., "Regular Season", "Emirates NBA Cup"
}

interface GamesResponse {
  games: NbaGame[];
  dates: string[]; // Array of dates with games
  primaryDate: string;
}

async function fetchNbaGames(): Promise<GamesResponse> {
  const res = await fetch("/api/nba/games", { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to fetch games");
  }

  return res.json();
}

export function useNbaGames() {
  const query = useQuery<GamesResponse>({
    queryKey: ["nba-games"],
    queryFn: fetchNbaGames,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
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

