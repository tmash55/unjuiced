import { useQuery } from "@tanstack/react-query";
import type { TripleDoubleSheetResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

export function useTripleDoubleSheet() {
  const { session, user } = useAuth();

  return useQuery<TripleDoubleSheetResponse>({
    queryKey: ["triple-double-sheet", user?.id],
    queryFn: async () => {
      return api.getTripleDoubleSheet({
        accessToken: session?.access_token
      });
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 1
  });
}
