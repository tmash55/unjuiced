"use client";

import { useQuery } from "@tanstack/react-query";

// =============================================================================
// TYPES
// =============================================================================

export interface BookOdds {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
}

export interface LineData {
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
  top_books: BookOdds[];
  book_count: number;
}

export interface OddsLadderResponse {
  event_id: string;
  market: string;
  player_id: string;
  primary_line: number | null;
  lines: LineData[];
  updated_at: number;
}

interface UseOddsLadderParams {
  eventId: string | null;
  market: string | null;
  playerId: string | null;
  limitBooksPerLine?: number;
  enabled?: boolean;
}

// =============================================================================
// FETCH FUNCTION
// =============================================================================

async function fetchOddsLadder(
  eventId: string,
  market: string,
  playerId: string,
  limitBooksPerLine: number = 3
): Promise<OddsLadderResponse> {
  const params = new URLSearchParams({
    event_id: eventId,
    market: market,
    player_id: playerId,
    limit_books_per_line: String(limitBooksPerLine),
  });
  
  const response = await fetch(`/api/nba/props/odds-ladder?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch odds ladder");
  }
  
  return response.json();
}

// =============================================================================
// HOOK
// =============================================================================

export function useOddsLadder({
  eventId,
  market,
  playerId,
  limitBooksPerLine = 3,
  enabled = true,
}: UseOddsLadderParams) {
  const isValid = Boolean(eventId && market && playerId);
  
  const query = useQuery({
    queryKey: ["odds-ladder", eventId, market, playerId, limitBooksPerLine],
    queryFn: () => fetchOddsLadder(eventId!, market!, playerId!, limitBooksPerLine),
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
