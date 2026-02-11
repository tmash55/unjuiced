"use client";

import { useQuery } from "@tanstack/react-query";

// =============================================================================
// TYPES
// =============================================================================

export interface BookOddsDetail {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
  sgp_over?: string | null;
  sgp_under?: string | null;
}

export interface OddsLineResponse {
  line: number;
  best: {
    book: string;
    over: number | null;
    under: number | null;
    links?: {
      mobile?: string | null;
      desktop?: string | null;
    };
  } | null;
  books: BookOddsDetail[];
  book_count: number;
  updated_at: number;
}

interface UseOddsLineParams {
  eventId: string | null;
  market: string | null;
  playerId: string | null;
  line: number | null;
  includeSgp?: boolean;
  enabled?: boolean;
}

// =============================================================================
// FETCH FUNCTION
// =============================================================================

async function fetchOddsLine(
  eventId: string,
  market: string,
  playerId: string,
  line: number,
  includeSgp: boolean = false
): Promise<OddsLineResponse> {
  const params = new URLSearchParams({
    event_id: eventId,
    market: market,
    player_id: playerId,
    line: String(line),
  });
  
  if (includeSgp) {
    params.set("include_sgp", "true");
  }
  
  const response = await fetch(`/api/nba/props/odds-line?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch odds line");
  }
  
  return response.json();
}

// =============================================================================
// HOOK
// =============================================================================

export function useOddsLine({
  eventId,
  market,
  playerId,
  line,
  includeSgp = false,
  enabled = true,
}: UseOddsLineParams) {
  const isValid = Boolean(eventId && market && playerId && line !== null);
  
  const query = useQuery({
    queryKey: ["odds-line", eventId, market, playerId, line, includeSgp],
    queryFn: () => fetchOddsLine(eventId!, market!, playerId!, line!, includeSgp),
    enabled: enabled && isValid,
    staleTime: 10_000, // 10 seconds
    gcTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  });
  
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
