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
  search?: string; // Player name search (server-side)
  enabled?: boolean;
}

interface HitRateTableResult {
  rows: HitRateProfile[];
  count: number;
  meta: HitRateResponse["meta"];
}

async function fetchHitRateTable(params: UseHitRateTableOptions = {}): Promise<HitRateTableResult> {
  const searchParams = new URLSearchParams();
  if (params.date) searchParams.set("date", params.date);
  if (params.market) searchParams.set("market", params.market);
  if (typeof params.minHitRate === "number") searchParams.set("minHitRate", String(params.minHitRate));
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") searchParams.set("offset", String(params.offset));
  if (params.search?.trim()) searchParams.set("search", params.search.trim());

  const url = `/api/nba/hit-rates${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
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
  const matchup = profile.matchup;
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
    h2hPct: profile.h2h_pct,
    last5Avg: profile.last_5_avg,
    last10Avg: profile.last_10_avg,
    last20Avg: profile.last_20_avg,
    seasonAvg: profile.season_avg,
    spread: profile.spread,
    total: profile.total,
    injuryStatus: profile.injury_status,
    injuryNotes: profile.injury_notes,
    // Prefer depth_chart_pos (PG, SG, SF, PF, C) over generic position (G, F, C)
    position: player?.depth_chart_pos ?? player?.position ?? profile.position,
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
    // Matchup data
    matchupRank: matchup?.matchup_rank ?? null,
    matchupRankLabel: matchup?.rank_label ?? null,
    matchupAvgAllowed: matchup?.avg_allowed ?? null,
    matchupQuality: matchup?.matchup_quality ?? null,
  };
}

export function useHitRateTable(options: UseHitRateTableOptions = {}) {
  const { date, market, minHitRate, limit, offset, search, enabled = true } = options;

  const queryResult = useQuery<HitRateTableResult>({
    queryKey: ["hit-rate-table", { date, market, minHitRate, limit, offset, search }],
    queryFn: () => fetchHitRateTable({ date, market, minHitRate, limit, offset, search }),
    enabled,
    staleTime: 30_000, // 30 seconds - fresher data
    gcTime: 2 * 60_000, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const rows = queryResult.data?.rows ?? [];
  const count = queryResult.data?.count ?? 0;
  const meta = queryResult.data?.meta;
  const availableDates = meta?.availableDates ?? [];

  return useMemo(
    () => ({
      rows,
      count,
      meta,
      availableDates,
      isLoading: queryResult.isLoading,
      isFetching: queryResult.isFetching,
      error: queryResult.error as Error | null,
      refetch: queryResult.refetch,
    }),
    [rows, count, meta, availableDates, queryResult.isLoading, queryResult.isFetching, queryResult.error, queryResult.refetch]
  );
}

