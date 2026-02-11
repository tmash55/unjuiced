import { useQuery } from "@tanstack/react-query";
import type { GetSharpPresetsResponse } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

export function useSharpPresets() {
  const { session } = useAuth();

  return useQuery<GetSharpPresetsResponse>({
    queryKey: ["sharp-presets"],
    queryFn: async () => {
      return api.getSharpPresets({
        accessToken: session?.access_token
      });
    },
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
