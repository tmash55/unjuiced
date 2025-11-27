"use client";

import { useQuery } from "@tanstack/react-query";

export interface PlayerInfo {
  playerId: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number | null;
  teamId: number;
  teamAbbr: string;
  teamName: string;
  injuryStatus: string | null;
  injuryNotes: string | null;
}

export interface SeasonSummary {
  gamesPlayed: number;
  record: string;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgThrees: number;
  avgMinutes: number;
  avgPra: number;
  avgUsage: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
}

export interface BoxScoreGame {
  gameId: string;
  date: string;
  seasonType: string;
  homeAway: "H" | "A";
  opponentTeamId: number;
  opponentAbbr: string;
  opponentName: string;
  result: "W" | "L";
  margin: number;
  teamScore: number;
  opponentScore: number;
  // Core stats
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  // Shooting
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  // Rebounds breakdown
  oreb: number;
  dreb: number;
  // Advanced
  plusMinus: number;
  usagePct: number;
  tsPct: number;
  efgPct: number;
  offRating: number;
  defRating: number;
  netRating: number;
  pace: number;
  pie: number;
  // Tracking
  passes: number;
  potentialReb: number;
  // Combo stats
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
}

export interface PlayerBoxScoresResponse {
  player: PlayerInfo | null;
  season: string;
  seasonSummary: SeasonSummary | null;
  games: BoxScoreGame[];
}

export interface UsePlayerBoxScoresOptions {
  playerId: number | null;
  season?: string;
  limit?: number;
  enabled?: boolean;
}

async function fetchPlayerBoxScores(
  playerId: number,
  season?: string,
  limit?: number
): Promise<PlayerBoxScoresResponse> {
  const params = new URLSearchParams();
  params.set("playerId", String(playerId));
  if (season) params.set("season", season);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/nba/player-box-scores?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch box scores");
  }

  return res.json();
}

export function usePlayerBoxScores(options: UsePlayerBoxScoresOptions) {
  const { playerId, season, limit, enabled = true } = options;

  const query = useQuery<PlayerBoxScoresResponse>({
    queryKey: ["player-box-scores", playerId, season, limit],
    queryFn: () => fetchPlayerBoxScores(playerId!, season, limit),
    enabled: enabled && playerId !== null,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
  });

  return {
    player: query.data?.player ?? null,
    season: query.data?.season ?? "",
    seasonSummary: query.data?.seasonSummary ?? null,
    games: query.data?.games ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

