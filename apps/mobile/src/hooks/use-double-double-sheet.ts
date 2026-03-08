import { useQuery } from "@tanstack/react-query";
import type { DoubleDoubleSheetResponse } from "@unjuiced/api";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

export function useDoubleDoubleSheet() {
  const { session, user } = useAuth();

  return useQuery<DoubleDoubleSheetResponse>({
    queryKey: ["double-double-sheet", user?.id],
    queryFn: async () => {
      return api.getDoubleDoubleSheet({
        accessToken: session?.access_token
      });
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 1
  });
}
