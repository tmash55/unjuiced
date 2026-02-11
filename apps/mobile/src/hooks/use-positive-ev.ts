import { useQuery } from "@tanstack/react-query";
import type { EVMode, PositiveEVResponse, SharpPreset } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type UsePositiveEVOptions = {
  sports?: string[];
  books?: string[];
  markets?: string[];
  sharpPreset?: SharpPreset;
  mode?: EVMode;
  minEV?: number;
  maxEV?: number;
  minBooksPerSide?: number;
  limit?: number;
  autoRefreshEnabled?: boolean;
  autoRefreshMs?: number;
};

export function usePositiveEV(options?: UsePositiveEVOptions) {
  const { session, user } = useAuth();
  const sports = options?.sports ?? ["nba"];
  const books = options?.books ?? [];
  const markets = options?.markets ?? [];
  const sharpPreset = options?.sharpPreset ?? "pinnacle";
  const mode = options?.mode ?? "pregame";
  const minEV = options?.minEV ?? 2;
  const maxEV = options?.maxEV;
  const minBooksPerSide = options?.minBooksPerSide ?? 2;
  const limit = options?.limit ?? 100;
  const autoRefreshEnabled = options?.autoRefreshEnabled ?? false;
  const autoRefreshMs = options?.autoRefreshMs ?? 15_000;

  return useQuery<PositiveEVResponse>({
    queryKey: [
      "positive-ev",
      user?.id,
      sports.join(","),
      books.join(","),
      markets.join(","),
      sharpPreset,
      mode,
      minEV,
      maxEV,
      minBooksPerSide,
      limit
    ],
    queryFn: async () => {
      return api.getPositiveEV({
        accessToken: session?.access_token,
        sports,
        books,
        markets,
        sharpPreset,
        mode,
        minEV,
        maxEV,
        minBooksPerSide,
        limit
      });
    },
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    refetchInterval: autoRefreshEnabled ? autoRefreshMs : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
