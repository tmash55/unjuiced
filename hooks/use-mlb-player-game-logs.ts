"use client";

import { useQuery } from "@tanstack/react-query";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

export interface MlbDrilldownLogEntry {
  gameId: string;
  date: string;
  season: number;
  homeAway: "H" | "A";
  opponentAbbr: string;
  opponentName: string;
  result: "W" | "L";
  teamScore: number | null;
  opponentScore: number | null;
  marketValue: number;
  atBats?: number;
  plateAppearances?: number;
  hits?: number;
  homeRuns?: number;
  runs?: number;
  rbi?: number;
  totalBases?: number;
  walks?: number;
  strikeOuts?: number;
  battingAvg?: number | null;
  obp?: number | null;
  slg?: number | null;
  inningsPitched?: number | null;
  hitsAllowed?: number;
  earnedRuns?: number;
  eraGame?: number | null;
  whipGame?: number | null;
}

interface MlbPlayerGameLogsResponse {
  playerId: number;
  market: string;
  season: number;
  logType: "batter" | "pitcher";
  entries: MlbDrilldownLogEntry[];
  games: BoxScoreGame[];
}

interface UseMlbPlayerGameLogsOptions {
  playerId: number | null;
  market?: string | null;
  season?: number;
  limit?: number;
  includePrior?: boolean;
  enabled?: boolean;
}

async function fetchMlbPlayerGameLogs(options: {
  playerId: number;
  market: string;
  season?: number;
  limit?: number;
  includePrior?: boolean;
}): Promise<MlbPlayerGameLogsResponse> {
  const params = new URLSearchParams({
    playerId: String(options.playerId),
    market: options.market,
  });

  if (typeof options.season === "number") {
    params.set("season", String(options.season));
  }

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  if (options.includePrior === false) {
    params.set("includePrior", "false");
  }

  const res = await fetch(`/api/mlb/player-game-logs?${params.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch MLB player game logs");
  }

  return res.json();
}

export function useMlbPlayerGameLogs(options: UseMlbPlayerGameLogsOptions) {
  const {
    playerId,
    market,
    season,
    limit = 40,
    includePrior = true,
    enabled = true,
  } = options;

  const query = useQuery<MlbPlayerGameLogsResponse>({
    queryKey: ["mlb-player-game-logs", playerId, market, season, limit, includePrior],
    queryFn: () =>
      fetchMlbPlayerGameLogs({
        playerId: playerId!,
        market: market!,
        season,
        limit,
        includePrior,
      }),
    enabled: enabled && typeof playerId === "number" && !!market,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    entries: query.data?.entries ?? [],
    games: query.data?.games ?? [],
    logType: query.data?.logType ?? "batter",
    season: query.data?.season ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
