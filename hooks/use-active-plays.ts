"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";

interface ActivePlaysOptions {
  minScore?: number;
  sport?: string | null;
  label?: string | null;
}

export function useActivePlays(opts: ActivePlaysOptions = {}) {
  return useQuery<{ plays: ActivePlay[]; meta: { total: number } }>({
    queryKey: ["active-plays", opts.minScore ?? 0, opts.sport ?? "all", opts.label ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts.minScore) params.set("min_score", String(opts.minScore));
      if (opts.sport) params.set("sport", opts.sport);
      if (opts.label) params.set("label", opts.label);
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
