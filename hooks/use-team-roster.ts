"use client";

import { useQuery } from "@tanstack/react-query";

export interface TeamRosterPlayer {
  playerId: number;
  name: string;
  position: string;
  jerseyNumber: number | null;
  gamesPlayed: number;
  avgMinutes: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgPra: number;
  avgThrees: number;
  avgSteals: number;
  avgBlocks: number;
  avgUsage: number;
  injuryStatus: string | null;
  injuryNotes: string | null;
}

export interface TeamRosterResponse {
  players: TeamRosterPlayer[];
  teamId: number;
  teamAbbr: string;
  teamName: string;
  playerCount: number;
  season: string;
}

export interface UseTeamRosterOptions {
  teamId: number | null;
  season?: string;
  enabled?: boolean;
}

async function fetchTeamRoster(
  teamId: number,
  season?: string
): Promise<TeamRosterResponse> {
  const params = new URLSearchParams();
  params.set("teamId", String(teamId));
  if (season) params.set("season", season);

  const res = await fetch(`/api/nba/team-roster?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch team roster");
  }

  return res.json();
}

export function useTeamRoster(options: UseTeamRosterOptions) {
  const { teamId, season, enabled = true } = options;

  const query = useQuery<TeamRosterResponse>({
    queryKey: ["team-roster", teamId, season],
    queryFn: () => fetchTeamRoster(teamId!, season),
    enabled: enabled && teamId !== null,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
  });

  return {
    players: query.data?.players ?? [],
    teamId: query.data?.teamId ?? null,
    teamAbbr: query.data?.teamAbbr ?? "",
    teamName: query.data?.teamName ?? "",
    playerCount: query.data?.playerCount ?? 0,
    season: query.data?.season ?? "",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Hook to fetch both player's team and opponent team rosters
 */
export function useGameRosters(options: {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  season?: string;
  enabled?: boolean;
}) {
  const { playerTeamId, opponentTeamId, season, enabled = true } = options;

  const playerTeam = useTeamRoster({
    teamId: playerTeamId,
    season,
    enabled: enabled && playerTeamId !== null,
  });

  const opponentTeam = useTeamRoster({
    teamId: opponentTeamId,
    season,
    enabled: enabled && opponentTeamId !== null,
  });

  return {
    playerTeam,
    opponentTeam,
    isLoading: playerTeam.isLoading || opponentTeam.isLoading,
    isFetching: playerTeam.isFetching || opponentTeam.isFetching,
  };
}

