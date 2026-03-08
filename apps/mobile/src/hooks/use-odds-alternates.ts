import { useQuery } from "@tanstack/react-query";
import { mobileEnv } from "@/src/config/env";
import { useAuth } from "@/src/providers/auth-provider";

type AlternateBookSide = {
  price: number;
  decimal?: number;
  link?: string | null;
  limit_max?: number | null;
};

export type OddsAlternateLine = {
  ln: number;
  books: Record<
    string,
    {
      over?: AlternateBookSide;
      under?: AlternateBookSide;
    }
  >;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
};

type OddsAlternatesResponse = {
  eventId: string;
  sport: string;
  market: string;
  player: string | null;
  team: string | null;
  position: string | null;
  primary_ln: number | null;
  alternates: OddsAlternateLine[];
  all_lines: OddsAlternateLine[];
};

type UseOddsAlternatesOptions = {
  sport: string;
  eventId: string | null;
  market: string | null;
  playerKey: string | null;
  primaryLine?: number | null;
  enabled?: boolean;
};

export function useOddsAlternates({
  sport,
  eventId,
  market,
  playerKey,
  primaryLine,
  enabled = true,
}: UseOddsAlternatesOptions) {
  const { session, user } = useAuth();

  return useQuery<OddsAlternatesResponse>({
    queryKey: ["odds-alternates", user?.id, sport, eventId, market, playerKey, primaryLine],
    enabled: enabled && Boolean(sport) && Boolean(eventId) && Boolean(market) && Boolean(playerKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sport", sport);
      params.set("eventId", eventId!);
      params.set("market", market!);
      params.set("player", playerKey!);
      if (primaryLine != null) {
        params.set("primaryLine", String(primaryLine));
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl}/api/v2/props/alternates?${params.toString()}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch alternates: ${response.status}`);
      }

      return (await response.json()) as OddsAlternatesResponse;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
