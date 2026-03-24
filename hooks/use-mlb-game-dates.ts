"use client";

import { useQuery } from "@tanstack/react-query";

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function fetchGameDates(): Promise<string[]> {
  const today = getTodayET();
  const res = await fetch(`/api/mlb/game-dates?from=${today}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.dates ?? [];
}

export function useMlbGameDates() {
  const query = useQuery<string[]>({
    queryKey: ["mlb-game-dates"],
    queryFn: fetchGameDates,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return query.data ?? [];
}
