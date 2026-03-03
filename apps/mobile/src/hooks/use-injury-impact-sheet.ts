import { useQuery } from "@tanstack/react-query";
import type { InjuryImpactResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseInjuryImpactOptions = {
  dates?: string[];
  markets?: string[];
  minGames?: number;
  minTeammateMinutes?: number;
};

export function useInjuryImpact(options?: UseInjuryImpactOptions) {
  const { session, user } = useAuth();

  return useQuery<InjuryImpactResponse>({
    queryKey: [
      "injury-impact-sheet",
      user?.id,
      options?.dates ?? [],
      options?.markets ?? [],
      options?.minGames ?? "",
      options?.minTeammateMinutes ?? ""
    ],
    queryFn: async () => {
      return api.getInjuryImpact({
        accessToken: session?.access_token,
        dates: options?.dates,
        markets: options?.markets,
        minGames: options?.minGames,
        minTeammateMinutes: options?.minTeammateMinutes
      });
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1
  });
}
