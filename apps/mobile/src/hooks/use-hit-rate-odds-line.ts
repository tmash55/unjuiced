import { useQuery } from "@tanstack/react-query";
import { mobileEnv } from "@/src/config/env";
import { useAuth } from "@/src/providers/auth-provider";

export type HitRateOddsLineBook = {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
  sgp_over?: string | null;
  sgp_under?: string | null;
};

export type HitRateOddsLineResponse = {
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
  books: HitRateOddsLineBook[];
  book_count: number;
  updated_at: number;
};

type UseHitRateOddsLineOptions = {
  eventId: string | null;
  market: string | null;
  playerKey: string | null;
  line: number | null;
  enabled?: boolean;
};

export function useHitRateOddsLine({
  eventId,
  market,
  playerKey,
  line,
  enabled = true,
}: UseHitRateOddsLineOptions) {
  const { session, user } = useAuth();

  return useQuery<HitRateOddsLineResponse>({
    queryKey: ["hit-rate-odds-line", user?.id, eventId, market, playerKey, line],
    enabled: enabled && Boolean(eventId) && Boolean(market) && Boolean(playerKey) && line !== null,
    queryFn: async () => {
      const params = new URLSearchParams({
        event_id: eventId!,
        market: market!,
        player_id: playerKey!,
        line: String(line!),
      });

      const headers: Record<string, string> = { Accept: "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl}/api/nba/props/odds-line?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch odds line: ${response.status}`);
      }

      return (await response.json()) as HitRateOddsLineResponse;
    },
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
