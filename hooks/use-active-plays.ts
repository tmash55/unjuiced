"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";

export interface ActivePlaysOptions {
  minScore?: number;
  sport?: string | null;
  label?: string | null;
  sort?: "score" | "newest" | "edge";
  /** -1 = show all, 0 = hide started (default), N = show up to N hours after start */
  hideAfterHours?: number;
}

export function useActivePlays(opts: ActivePlaysOptions = {}) {
  const { minScore = 0, sport, label, sort = "score", hideAfterHours = 0 } = opts;

  return useQuery<{ plays: ActivePlay[]; meta: { total: number; minScore: number; sort: string } }>({
    queryKey: ["active-plays", minScore, sport ?? "all", label ?? "all", sort, hideAfterHours],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minScore > 0) params.set("min_score", String(minScore));
      if (sport) params.set("sport", sport);
      if (label) params.set("label", label);
      if (sort !== "score") params.set("sort", sort);
      if (hideAfterHours != null) params.set("hide_after", String(hideAfterHours));

      const res = await fetch(`/api/polymarket/active-plays?${params}`);
      if (!res.ok) throw new Error("Failed to fetch active plays");
      return res.json();
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
