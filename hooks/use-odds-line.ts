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

export interface FavoriteSnapshotSide {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
  sgp: string | null;
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

export async function fetchOddsLine(
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

export function createBooksSnapshotFromOddsLine(
  oddsLine: OddsLineResponse | null,
  side: "over" | "under"
): Record<string, { price: number; u?: string | null; m?: string | null; sgp?: string | null }> | null {
  if (!oddsLine?.books?.length) return null;

  const snapshot: Record<string, { price: number; u?: string | null; m?: string | null; sgp?: string | null }> = {};

  oddsLine.books.forEach((book) => {
    const price = side === "over" ? book.over : book.under;
    const link = side === "over" ? book.link_over : book.link_under;
    const sgp = side === "over" ? book.sgp_over : book.sgp_under;

    if (price === null) return;

    snapshot[book.book] = {
      price,
      u: link || null,
      m: link || null,
      sgp: sgp || null,
    };
  });

  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

export function getBestSideFromOddsLine(
  oddsLine: OddsLineResponse | null,
  side: "over" | "under"
): FavoriteSnapshotSide | null {
  if (!oddsLine?.books?.length) return null;

  const books = oddsLine.books
    .map((book) => {
      const price = side === "over" ? book.over : book.under;
      if (price === null) return null;

      const link = side === "over" ? book.link_over : book.link_under;
      const sgp = side === "over" ? book.sgp_over : book.sgp_under;

      return {
        book: book.book,
        price,
        url: link || null,
        mobileUrl: link || null,
        sgp: sgp || null,
      };
    })
    .filter(Boolean) as FavoriteSnapshotSide[];

  if (!books.length) return null;

  books.sort((a, b) => b.price - a.price);
  return books[0];
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
