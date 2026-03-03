import { useQuery } from "@tanstack/react-query";
import type { CheatSheetResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UseCheatSheetOptions = {
  timeWindow?: string;
  minHitRate?: number;
  oddsFloor?: number;
  oddsCeiling?: number;
  markets?: string[];
  dates?: string[];
};

export function useCheatSheet(options?: UseCheatSheetOptions) {
  const { session, user } = useAuth();

  return useQuery<CheatSheetResponse>({
    queryKey: [
      "cheat-sheet",
      user?.id,
      options?.timeWindow ?? "",
      options?.minHitRate ?? "",
      options?.markets ?? [],
      options?.dates ?? []
    ],
    queryFn: async () => {
      return api.getCheatSheet({
        accessToken: session?.access_token,
        timeWindow: options?.timeWindow,
        minHitRate: options?.minHitRate,
        oddsFloor: options?.oddsFloor,
        oddsCeiling: options?.oddsCeiling,
        markets: options?.markets,
        dates: options?.dates
      });
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 1
  });
}
