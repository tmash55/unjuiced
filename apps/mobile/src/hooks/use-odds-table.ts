import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { mobileEnv } from "@/src/config/env";
import { useAuth } from "@/src/providers/auth-provider";

type OddsBookSide = {
  price: number;
  line: number;
  u?: string;
  m?: string;
  sgp?: string;
  limit_max?: number | null;
  locked?: boolean;
};

export type OddsTableRow = {
  sid?: string;
  eid: string;
  ent: string;
  player: string | null;
  team: string | null;
  position: string | null;
  mkt: string;
  ln: number;
  ev: {
    dt: string;
    live: boolean;
    home: {
      id: string;
      name: string;
      abbr: string;
    };
    away: {
      id: string;
      name: string;
      abbr: string;
    };
  };
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
  avg?: {
    over?: number;
    under?: number;
  };
  books?: Record<
    string,
    {
      over?: OddsBookSide;
      under?: OddsBookSide;
    }
  >;
  ts?: number;
};

type OddsTableResponse = {
  sids: string[];
  rows: OddsTableRow[];
  nextCursor: string | null;
  meta?: {
    sport: string;
    market: string;
    market_display?: string;
    scope: string;
    count: number;
  };
};

type UseOddsTableOptions = {
  sport: string;
  market: string;
  scope?: "pregame" | "live";
  limit?: number;
  enabled?: boolean;
};

export function useOddsTable({
  sport,
  market,
  scope = "pregame",
  limit = 300,
  enabled = true
}: UseOddsTableOptions) {
  const { session, user } = useAuth();

  return useQuery<OddsTableResponse>({
    queryKey: ["odds-table", user?.id, sport, market, scope, limit],
    enabled: enabled && Boolean(sport) && Boolean(market),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sport", sport);
      params.set("market", market);
      params.set("scope", scope);
      params.set("limit", String(limit));

      const headers: Record<string, string> = { Accept: "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl}/api/v2/props/table?${params.toString()}`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch props table: ${response.status}`);
      }

      return (await response.json()) as OddsTableResponse;
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 2
  });
}
