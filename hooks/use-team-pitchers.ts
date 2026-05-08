"use client";

import { useQuery } from "@tanstack/react-query";
import type { TeamPitcher } from "@/app/api/mlb/team-pitchers/route";

export type { TeamPitcher } from "@/app/api/mlb/team-pitchers/route";

export function useTeamPitchers(teamId: number | null) {
  return useQuery<TeamPitcher[]>({
    queryKey: ["mlb-team-pitchers", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/mlb/team-pitchers?teamId=${teamId}`);
      if (!res.ok) throw new Error("Failed to fetch team pitchers");
      const data = await res.json();
      return data.pitchers ?? [];
    },
    enabled: teamId != null,
    staleTime: 60 * 60_000, // 1 hour — roster doesn't change often
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}
