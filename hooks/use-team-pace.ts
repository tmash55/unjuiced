"use client";

import { useQuery } from "@tanstack/react-query";

export interface TeamPaceWindow {
  pace: number | null;
  rank: number | null;
  gamesPlayed: number | null;
}

export interface TeamPace {
  l5: TeamPaceWindow;
  l10: TeamPaceWindow;
  season: TeamPaceWindow;
}

export interface TeamPaceResponse {
  league: "nba";
  season: string;
  totalTeams: number;
  teams: Record<string, TeamPace>;
}

export interface UseTeamPaceOptions {
  teamIds: number[];
  sport?: "nba";
  season?: string;
  enabled?: boolean;
}

async function fetchTeamPace(
  teamIds: number[],
  season: string | undefined
): Promise<TeamPaceResponse> {
  const params = new URLSearchParams();
  params.set("teamIds", teamIds.join(","));
  if (season) params.set("season", season);
  const res = await fetch(`/api/nba/team-pace?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch team pace");
  }
  return res.json();
}

export function useTeamPace(options: UseTeamPaceOptions) {
  const { teamIds, season, enabled = true } = options;
  const sortedIds = [...teamIds].sort((a, b) => a - b);
  const idsKey = sortedIds.join(",");

  const query = useQuery<TeamPaceResponse>({
    queryKey: ["team-pace", "nba", idsKey, season],
    queryFn: () => fetchTeamPace(sortedIds, season),
    enabled: enabled && teamIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    teams: query.data?.teams ?? {},
    totalTeams: query.data?.totalTeams ?? 30,
    season: query.data?.season ?? "",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  };
}
