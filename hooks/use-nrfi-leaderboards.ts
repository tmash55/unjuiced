"use client";

import { useQuery } from "@tanstack/react-query";
import type { NrfiPitcherRow } from "@/app/api/mlb/nrfi/pitchers/route";
import type { NrfiTeamRow } from "@/app/api/mlb/nrfi/teams/route";

export function useNrfiPitchers(params: { minStarts?: number; seasons?: string }, enabled = true) {
  return useQuery<NrfiPitcherRow[]>({
    queryKey: ["nrfi-pitchers", params.minStarts ?? 10, params.seasons ?? "2025,2026"],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.minStarts) qs.set("min_starts", String(params.minStarts));
      if (params.seasons) qs.set("seasons", params.seasons);
      const res = await fetch(`/api/mlb/nrfi/pitchers?${qs}`);
      if (!res.ok) throw new Error("Failed to fetch pitcher leaderboard");
      const data = await res.json();
      return data.pitchers ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useNrfiTeams(params: { seasons?: string }, enabled = true) {
  return useQuery<NrfiTeamRow[]>({
    queryKey: ["nrfi-teams", params.seasons ?? "2025,2026"],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.seasons) qs.set("seasons", params.seasons);
      const res = await fetch(`/api/mlb/nrfi/teams?${qs}`);
      if (!res.ok) throw new Error("Failed to fetch team leaderboard");
      const data = await res.json();
      return data.teams ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
}
