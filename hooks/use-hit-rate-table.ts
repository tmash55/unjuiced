"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HitRateProfile, HitRateResponse, RawHitRateProfile } from "@/lib/hit-rates-schema";

export interface UseHitRateTableOptions {
  date?: string;
  market?: string;
  minHitRate?: number;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface HitRateTableResult {
  rows: HitRateProfile[];
  count: number;
  meta: HitRateResponse["meta"];
}

async function fetchHitRateTable(params: UseHitRateTableOptions = {}): Promise<HitRateTableResult> {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.market) search.set("market", params.market);
  if (typeof params.minHitRate === "number") search.set("minHitRate", String(params.minHitRate));
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));

  const url = `/api/nba/hit-rates${search.toString() ? `?${search.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load hit rates");
  }

  const payload: HitRateResponse = await res.json();
  return {
    rows: (payload.data || []).map(mapHitRateProfile),
    count: payload.count,
    meta: payload.meta,
  };
}

function mapHitRateProfile(profile: RawHitRateProfile): HitRateProfile {
  const player = profile.nba_players_hr;
  const game = profile.nba_games_hr;
  const team = profile.nba_teams;
  return {
    id: profile.id,
    playerId: player?.nba_player_id ?? profile.player_id,
    playerName: player?.name || profile.team_name || "Unknown",
    teamId: profile.team_id ?? null,
    teamAbbr: profile.team_abbr ?? null,
    teamName: profile.team_name ?? null,
    opponentTeamId: profile.opponent_team_id ?? null,
    opponentTeamAbbr: profile.opponent_team_abbr ?? null,
    opponentTeamName: profile.opponent_team_name ?? null,
    market: profile.market,
    line: profile.line,
    gameId: profile.game_id ?? null,
    hitStreak: profile.hit_streak,
    last5Pct: profile.last_5_pct,
    last10Pct: profile.last_10_pct,
    last20Pct: profile.last_20_pct,
    seasonPct: profile.season_pct,
    last5Avg: profile.last_5_avg,
    last10Avg: profile.last_10_avg,
    last20Avg: profile.last_20_avg,
    seasonAvg: profile.season_avg,
    spread: profile.spread,
    total: profile.total,
    injuryStatus: profile.injury_status,
    injuryNotes: profile.injury_notes,
    position: player?.position ?? profile.position,
    jerseyNumber: player?.jersey_number ?? profile.jersey_number,
    gameDate: game?.game_date ?? profile.game_date,
    gameStatus: game?.game_status ?? null,
    gameLogs: profile.game_logs ?? null,
    homeTeamName: game?.home_team_name ?? null,
    awayTeamName: game?.away_team_name ?? null,
    primaryColor: team?.primary_color ?? null,
    secondaryColor: team?.secondary_color ?? null,
    accentColor: team?.accent_color ?? null,
    isPrimetime: profile.is_primetime ?? null,
    nationalBroadcast: profile.national_broadcast ?? null,
    homeAway: profile.home_away ?? null,
    oddsSelectionId: profile.odds_selection_id ?? null,
  };
}

export function useHitRateTable(options: UseHitRateTableOptions = {}) {
  const { date, market, minHitRate, limit, offset, enabled = true } = options;

  const queryResult = useQuery<HitRateTableResult>({
    queryKey: ["hit-rate-table", { date, market, minHitRate, limit, offset }],
    queryFn: () => fetchHitRateTable({ date, market, minHitRate, limit, offset }),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    keepPreviousData: true,
  });

  const rows = queryResult.data?.rows ?? [];
  const count = queryResult.data?.count ?? 0;
  const meta = queryResult.data?.meta;

  return useMemo(
    () => ({
      rows,
      count,
      meta,
      isLoading: queryResult.isLoading,
      isFetching: queryResult.isFetching,
      error: queryResult.error as Error | null,
      refetch: queryResult.refetch,
    }),
    [rows, count, meta, queryResult.isLoading, queryResult.isFetching, queryResult.error, queryResult.refetch]
  );
}

