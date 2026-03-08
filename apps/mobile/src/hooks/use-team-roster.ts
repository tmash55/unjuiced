import { useQuery } from "@tanstack/react-query";
import type { TeamRosterResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

interface UseTeamRosterOptions {
  teamId: number | null;
  season?: string;
  enabled?: boolean;
}

export function useTeamRoster(options: UseTeamRosterOptions) {
  const { session } = useAuth();
  const { teamId, season, enabled = true } = options;

  const query = useQuery<TeamRosterResponse>({
    queryKey: ["team-roster", teamId, season],
    queryFn: () =>
      api.getTeamRoster({
        accessToken: session?.access_token,
        teamId: teamId!,
        season,
      }),
    enabled: enabled && teamId !== null,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  return {
    players: query.data?.players ?? [],
    isLoading: query.isLoading,
  };
}
