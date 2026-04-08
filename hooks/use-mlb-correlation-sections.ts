"use client";

import { useQuery } from "@tanstack/react-query";
import type { PropStack } from "@/app/api/mlb/correlations/prop-stacks/route";
import type { LineupChainLink } from "@/app/api/mlb/correlations/lineup-chain/route";
import type { PitcherImpactRow } from "@/app/api/mlb/correlations/pitcher-impact/route";
import type { TeamScoringRow } from "@/app/api/mlb/correlations/team-scoring/route";

const STALE = 5 * 60_000;
const GC = 15 * 60_000;

// ── Section 1: Prop Stacks ──────────────────────────────────────────────────

interface PropStacksResponse {
  stacks: PropStack[];
  away_team_id?: number;
  home_team_id?: number;
}

export function usePropStacks(gameId: number | null, teamId?: number | null) {
  return useQuery<PropStacksResponse>({
    queryKey: ["corr-prop-stacks", gameId, teamId ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ game_id: String(gameId) });
      if (teamId) params.set("team_id", String(teamId));
      const res = await fetch(`/api/mlb/correlations/prop-stacks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch prop stacks");
      return res.json();
    },
    enabled: !!gameId,
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
  });
}

// ── Section 2: Lineup Chain ─────────────────────────────────────────────────

export function useLineupChain(gameId: number | null, teamId: number | null) {
  return useQuery<LineupChainLink[]>({
    queryKey: ["corr-lineup-chain", gameId, teamId],
    queryFn: async () => {
      const res = await fetch(`/api/mlb/correlations/lineup-chain?game_id=${gameId}&team_id=${teamId}`);
      if (!res.ok) throw new Error("Failed to fetch lineup chain");
      const data = await res.json();
      return data.chain ?? [];
    },
    enabled: !!gameId && !!teamId,
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
  });
}

// ── Section 3: Teammate Props ───────────────────────────────────────────────

export function useTeammateProps(gameId: number | null, teamId?: number | null, enabled = false) {
  return useQuery({
    queryKey: ["corr-teammate-props", gameId, teamId ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ game_id: String(gameId) });
      if (teamId) params.set("team_id", String(teamId));
      const res = await fetch(`/api/mlb/correlations/teammate-props?${params}`);
      if (!res.ok) throw new Error("Failed to fetch teammate props");
      const data = await res.json();
      return data.props ?? [];
    },
    enabled: enabled && !!gameId,
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
  });
}

// ── Section 4: Pitcher Impact ───────────────────────────────────────────────

export function usePitcherImpact(
  params: { pitcherId?: number | null; gameId?: number | null; side?: "home" | "away" },
  enabled = false
) {
  const { pitcherId, gameId, side } = params;
  return useQuery<PitcherImpactRow[]>({
    queryKey: ["corr-pitcher-impact", pitcherId ?? `${gameId}-${side}`],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (pitcherId) qs.set("pitcher_id", String(pitcherId));
      else if (gameId && side) { qs.set("game_id", String(gameId)); qs.set("side", side); }
      const res = await fetch(`/api/mlb/correlations/pitcher-impact?${qs}`);
      if (!res.ok) throw new Error("Failed to fetch pitcher impact");
      const data = await res.json();
      return data.impact ?? [];
    },
    enabled: enabled && !!(pitcherId || (gameId && side)),
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
  });
}

// ── Section 5: Team Scoring ─────────────────────────────────────────────────

export function useTeamScoring(teamId: number | null, season = 2026, enabled = false) {
  return useQuery<TeamScoringRow[]>({
    queryKey: ["corr-team-scoring", teamId, season],
    queryFn: async () => {
      const res = await fetch(`/api/mlb/correlations/team-scoring?team_id=${teamId}&season=${season}`);
      if (!res.ok) throw new Error("Failed to fetch team scoring");
      const data = await res.json();
      return data.scoring ?? [];
    },
    enabled: enabled && !!teamId,
    staleTime: STALE,
    gcTime: GC,
    refetchOnWindowFocus: false,
  });
}
