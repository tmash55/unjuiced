import { useQuery } from "@tanstack/react-query";
import { mobileEnv } from "@/src/config/env";
import { useAuth } from "@/src/providers/auth-provider";

export type OddsEvent = {
  event_id: string;
  is_live: boolean;
  commence_time: string;
  home_team_id: string;
  home_team: string;
  home_team_name: string;
  away_team_id: string;
  away_team: string;
  away_team_name: string;
  updated: string;
};

type OddsEventsResponse = {
  events: OddsEvent[];
  count: number;
  sport: string;
};

type UseOddsEventsOptions = {
  sport: string;
  enabled?: boolean;
};

/**
 * Fetch ALL active events for a sport (no server-side date filtering).
 * Date filtering is done client-side in the component so the device's
 * local timezone is used, matching how the web app works.
 */
export function useOddsEvents({ sport, enabled = true }: UseOddsEventsOptions) {
  const { session, user } = useAuth();

  return useQuery<OddsEventsResponse>({
    queryKey: ["odds-events", user?.id, sport],
    enabled: enabled && Boolean(sport),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("include_started", "true");

      const headers: Record<string, string> = { Accept: "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl}/api/v2/events/${sport}?${params.toString()}`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch odds events: ${response.status}`);
      }

      return (await response.json()) as OddsEventsResponse;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
