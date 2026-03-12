import { useQuery } from "@tanstack/react-query";
import { mobileEnv } from "@/src/config/env";
import { useAuth } from "@/src/providers/auth-provider";

export type HitRateAlternateBook = {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
  underPrice?: number | null;
  underUrl?: string | null;
  underMobileUrl?: string | null;
  isSharp?: boolean;
};

export type HitRateAlternateLine = {
  line: number;
  l5Pct: number | null;
  l10Pct: number | null;
  l20Pct: number | null;
  seasonPct: number | null;
  l5Avg: number | null;
  l10Avg: number | null;
  l20Avg: number | null;
  seasonAvg: number | null;
  bestBook: string | null;
  bestPrice: number | null;
  bestUrl: string | null;
  books: HitRateAlternateBook[];
  isCurrentLine: boolean;
  edge: "strong" | "moderate" | null;
  evPercent: number | null;
  fairOdds: number | null;
  sharpBook: string | null;
};

type HitRateAlternateLinesResponse = {
  lines: HitRateAlternateLine[];
  playerName: string;
  market: string;
  currentLine: number | null;
  error?: string;
};

type UseHitRateAlternateLinesOptions = {
  eventId: string | null;
  selKey: string | null;
  playerId: number | null;
  market: string | null;
  currentLine?: number | null;
  enabled?: boolean;
};

export function useHitRateAlternateLines({
  eventId,
  selKey,
  playerId,
  market,
  currentLine,
  enabled = true,
}: UseHitRateAlternateLinesOptions) {
  const { session, user } = useAuth();

  return useQuery<HitRateAlternateLinesResponse>({
    queryKey: ["hit-rate-alternate-lines", user?.id, eventId, selKey, playerId, market, currentLine],
    enabled: enabled && Boolean(eventId) && Boolean(selKey) && Boolean(playerId) && Boolean(market),
    queryFn: async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl}/api/nba/alternate-lines`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId,
          selKey,
          playerId,
          market,
          currentLine: currentLine ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alternate lines: ${response.status}`);
      }

      return (await response.json()) as HitRateAlternateLinesResponse;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
