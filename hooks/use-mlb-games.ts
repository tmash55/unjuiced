"use client";

import { useQuery } from "@tanstack/react-query";

export interface MlbGameWeather {
  temperature_f: number | null;
  wind_speed_mph: number | null;
  wind_label: string | null;
  wind_impact: string | null;
  hr_impact_score: number | null;
  roof_type: string | null;
  venue_name: string | null;
}

export interface MlbGameOdds {
  home_ml: string | null;
  away_ml: string | null;
  total: number | null;
  total_over_price: string | null;
  total_under_price: string | null;
  spread: number | null;
  spread_home_price: string | null;
  spread_away_price: string | null;
  home_total: number | null;
  home_total_over_price: string | null;
  home_total_under_price: string | null;
  away_total: number | null;
  away_total_over_price: string | null;
  away_total_under_price: string | null;
}

export interface MlbGame {
  game_id: string;
  game_date: string;
  home_team_name: string;
  away_team_name: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number | null;
  away_team_score: number | null;
  home_team_record: string | null;
  away_team_record: string | null;
  game_status: string;
  venue_id: number | null;
  odds_game_id: string | null;
  home_probable_pitcher: string | null;
  away_probable_pitcher: string | null;
  is_primetime: boolean | null;
  national_broadcast: string | null;
  neutral_site: boolean | null;
  season_type: string | null;
  weather: MlbGameWeather | null;
  park_factor: number | null;
  odds: MlbGameOdds | null;
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
