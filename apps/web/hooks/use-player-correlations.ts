"use client";

import { useQuery } from "@tanstack/react-query";

// Types matching the API response
export interface SplitStats {
  games: number;
  hits: number;
  hitRate: number | null;
  display: string;
}

export interface HitRateStats {
  lineUsed: number;
  timesHit: number;
  games: number;
  pct: number | null;
  display: string;
  // Odds data (from get_player_correlations_with_odds)
  selectionId?: string | null;
  eventId?: string | null;
  overPrice?: number | null;
  underPrice?: number | null;
  overPriceDecimal?: number | null;
  underPriceDecimal?: number | null;
}

export interface StatCorrelation {
  avgOverall: number | null;
  avgWhenHit: number | null;
  avgWhenMiss: number | null;
  diff: number | null;
  strength?: "strong" | "moderate" | "weak";
  hitRateWhenAnchorHits?: HitRateStats;
}

// Individual game log for a teammate
export interface TeammateGameLog {
  gameId: string;
  gameDate: string;
  anchorHit: boolean;
  homeAway: "home" | "away";
  isBackToBack: boolean;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    fg3m: number;
    stl: number;
    blk: number;
    tov: number;
    pra: number;
    pr: number;
    pa: number;
    ra: number;
    bs: number;
    minutes: number;
  };
}

export interface TeammateCorrelation {
  playerId: number;
  playerName: string;
  position: string;
  minutesAvg: number | null;
  // Injury status (optional - from roster data)
  injuryStatus?: string | null;
  injuryNotes?: string | null;
  sample: {
    totalGames: number;
    whenAnchorHits: number;
    whenAnchorMisses: number;
  };
  // Core stats - all have full StatCorrelation with hitRateWhenAnchorHits
  points: StatCorrelation;
  rebounds: StatCorrelation;
  assists: StatCorrelation;
  // Extra stats
  threes: StatCorrelation;
  steals: StatCorrelation;
  blocks: StatCorrelation;
  turnovers: StatCorrelation; // Note: lower_is_better for unders
  // Combo stats
  pra: StatCorrelation;
  pointsRebounds: StatCorrelation;
  pointsAssists: StatCorrelation;
  reboundsAssists: StatCorrelation;
  blocksSteals: StatCorrelation;
  // Game-by-game data for accurate charts
  gameLogs: TeammateGameLog[];
}

// Self-correlation stat for anchor's OTHER markets
export interface SelfCorrelationStat {
  avgWhenHit: number | null;
  avgWhenMiss: number | null;
  diff: number | null;
  hitRateWhenAnchorHits?: {
    lineUsed: number;
    timesHit: number;
    games: number;
    pct: number | null;
  };
}

// How anchor's other markets correlate when they hit their primary line
export interface AnchorSelfCorrelations {
  points: SelfCorrelationStat;
  rebounds: SelfCorrelationStat;
  assists: SelfCorrelationStat;
  threes: SelfCorrelationStat;
  pra: SelfCorrelationStat;
}

export interface PlayerCorrelationsData {
  version: string;
  filters: {
    lastNGames: number | null;
    season: string;
    isFiltered: boolean;
  };
  anchorPlayer: {
    playerId: number;
    playerName: string;
    position: string;
    teamId: number;
    market: string;
    line: number;
  };
  anchorPerformance: {
    gamesAnalyzed: number;
    timesHit: number;
    timesMissed: number;
    hitRate: number | null;
    avgStat: number | null;
    display: string;
    splits: {
      home: SplitStats;
      away: SplitStats;
      backToBack: SplitStats;
      rested: SplitStats;
    };
  };
  teammateCorrelations: TeammateCorrelation[];
  headline: {
    anchor: string;
    topTeammate: string | null;
  };
  // Self-correlations: how anchor's OTHER markets behave when they hit their primary line
  anchorSelfCorrelations?: AnchorSelfCorrelations;
}

export interface UsePlayerCorrelationsOptions {
  playerId: number | null;
  market: string | null;
  line: number | null;
  gameId?: string | number | null; // New: pass gameId to get odds data
  lastNGames?: number | null;
  season?: string;
  enabled?: boolean;
}

async function fetchPlayerCorrelations(
  playerId: number,
  market: string,
  line: number,
  gameId?: number | null,
  lastNGames?: number | null,
  season?: string
): Promise<PlayerCorrelationsData> {
  const res = await fetch("/api/nba/player-correlations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      market,
      line,
      gameId: gameId ?? undefined,
      lastNGames: lastNGames ?? undefined,
      season: season ?? undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch correlations");
  }

  return res.json();
}

export function usePlayerCorrelations(options: UsePlayerCorrelationsOptions) {
  const { playerId, market, line, gameId, lastNGames, season, enabled = true } = options;

  // Normalize gameId to number
  const normalizedGameId = gameId ? (typeof gameId === "string" ? parseInt(gameId, 10) : gameId) : null;
  
  const isValid = playerId !== null && market !== null && line !== null;

  const query = useQuery<PlayerCorrelationsData>({
    queryKey: ["player-correlations", playerId, market, line, normalizedGameId, lastNGames, season],
    queryFn: () => fetchPlayerCorrelations(playerId!, market!, line!, normalizedGameId, lastNGames, season),
    enabled: enabled && isValid,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
  });

  return {
    data: query.data ?? null,
    anchorPlayer: query.data?.anchorPlayer ?? null,
    anchorPerformance: query.data?.anchorPerformance ?? null,
    teammateCorrelations: query.data?.teammateCorrelations ?? [],
    headline: query.data?.headline ?? null,
    anchorSelfCorrelations: query.data?.anchorSelfCorrelations ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

