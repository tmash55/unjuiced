"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LineOdds } from "./use-hit-rate-odds";

interface V2AlternatesResponse {
  all_lines?: Array<{
    ln: number;
    books?: Record<string, {
      over?: { price: number; u?: string | null; m?: string | null };
      under?: { price: number; u?: string | null; m?: string | null };
    }>;
    best?: {
      over?: { bk: string; price: number };
      under?: { bk: string; price: number };
    };
  }>;
}

interface UseEnrichedLineOddsOptions {
  baseOdds: LineOdds | null;
  sport: "nba" | "wnba" | "mlb";
  eventId?: string | number | null;
  market?: string | null;
  playerName?: string | null;
  enabled?: boolean;
}

/**
 * Lift the v2 alternates merge that lives inside OddsPanel into a hook so the
 * modal's DrilldownHeader can read off the same enriched LineOdds. Without
 * this, the header would fall back to profile.bestOdds (a single-line legacy
 * value at any line) while the OddsPanel showed accurate per-line best odds —
 * causing the OVER/UNDER readouts to disagree across surfaces.
 */
export function useEnrichedLineOdds({
  baseOdds,
  sport,
  eventId,
  market,
  playerName,
  enabled = true,
}: UseEnrichedLineOddsOptions): LineOdds | null {
  const v2PlayerKey = useMemo(() => {
    if (!playerName) return null;
    return playerName.toLowerCase().replace(/\s+/g, "_");
  }, [playerName]);

  const query = useQuery<V2AlternatesResponse>({
    queryKey: ["enriched-line-odds", sport, eventId, market, v2PlayerKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        sport,
        eventId: String(eventId!),
        market: String(market!),
        player: v2PlayerKey!,
      });
      const res = await fetch(`/api/v2/props/alternates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load alternates");
      return res.json();
    },
    enabled: enabled && !!eventId && !!market && !!v2PlayerKey,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  return useMemo(() => {
    const v2Entries = query.data?.all_lines ?? [];
    if (v2Entries.length === 0) return baseOdds;
    const v2Mapped = v2Entries.map((entry) => ({
      line: entry.ln,
      bestOver: entry.best?.over
        ? { book: entry.best.over.bk, price: entry.best.over.price, url: null, mobileUrl: null }
        : null,
      bestUnder: entry.best?.under
        ? { book: entry.best.under.bk, price: entry.best.under.price, url: null, mobileUrl: null }
        : null,
      books: Object.fromEntries(
        Object.entries(entry.books ?? {}).map(([book, sides]) => [
          book,
          {
            over: sides.over
              ? { price: sides.over.price, url: sides.over.u ?? null, mobileUrl: sides.over.m ?? null }
              : undefined,
            under: sides.under
              ? { price: sides.under.price, url: sides.under.u ?? null, mobileUrl: sides.under.m ?? null }
              : undefined,
          },
        ]),
      ),
    }));
    // v2 wins for lines present in both — its book coverage is more complete.
    const baseLines = baseOdds?.allLines ?? [];
    const byLine = new Map<number, (typeof baseLines)[number]>();
    for (const line of baseLines) byLine.set(line.line, line);
    for (const v2 of v2Mapped) byLine.set(v2.line, v2 as (typeof baseLines)[number]);
    const mergedLines = Array.from(byLine.values()).sort((a, b) => a.line - b.line);

    // Re-derive top-level bestOver / bestUnder from the v2-enriched primary
    // line so the header pulls the right book + price for the current line.
    const primaryLine = baseOdds?.primaryLine ?? baseOdds?.currentLine ?? null;
    const primaryEntry = primaryLine !== null
      ? mergedLines.find((l) => Math.abs(l.line - primaryLine) < 0.001)
      : null;

    return {
      stableKey: baseOdds?.stableKey ?? "",
      eventId: baseOdds?.eventId ?? null,
      market: baseOdds?.market ?? null,
      primaryLine: baseOdds?.primaryLine ?? null,
      currentLine: baseOdds?.currentLine ?? null,
      bestOver: primaryEntry?.bestOver ?? baseOdds?.bestOver ?? null,
      bestUnder: primaryEntry?.bestUnder ?? baseOdds?.bestUnder ?? null,
      allLines: mergedLines,
      live: baseOdds?.live ?? false,
      timestamp: baseOdds?.timestamp ?? null,
    } as LineOdds;
  }, [baseOdds, query.data]);
}
