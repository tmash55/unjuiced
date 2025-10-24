"use client";

import { useQuery } from "@tanstack/react-query";

export type Entitlements = {
  plan: "free" | "pro" | "admin" | string;
  entitlement_source?: "subscription" | "trial" | "none" | string;
  trial?: {
    trial_used?: boolean;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    is_trial_active?: boolean;
  } | null;
  authenticated: boolean;
};

export function useEntitlements() {
  return useQuery<Entitlements>({
    queryKey: ["me-plan"],
    queryFn: async () => {
      const res = await fetch("/api/me/plan", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load entitlements");
      return res.json();
    },
    staleTime: 5 * 60_000, // 5 minutes VC-grade cache
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}


