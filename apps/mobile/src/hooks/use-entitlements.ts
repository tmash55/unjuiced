import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";
import type { Entitlements } from "@unjuiced/types";

export function useEntitlements() {
  const { session, user } = useAuth();

  return useQuery<Entitlements>({
    queryKey: ["me-plan", user?.id],
    queryFn: async () => {
      if (!session?.access_token) {
        return { plan: "free", authenticated: false };
      }

      return api.getMePlan({ accessToken: session.access_token });
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1
  });
}
