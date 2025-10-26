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

/**
 * VC-Grade Entitlements Hook
 * 
 * Centralized, cached user plan/entitlements fetching.
 * - Single source of truth across the app
 * - 5-minute cache to minimize API calls
 * - Automatic refetch on window focus and reconnect
 * - Optimistic initial state (assumes free until proven otherwise)
 * 
 * Usage:
 * const { data: entitlements, isLoading } = useEntitlements()
 * const isPro = entitlements?.plan === 'pro'
 */
export function useEntitlements() {
  return useQuery<Entitlements>({
    queryKey: ["me-plan"],
    queryFn: async () => {
      const res = await fetch("/api/me/plan", {
        cache: "no-store",
        credentials: "include", // Ensure cookies are sent
      });
      if (!res.ok) {
        // Don't throw on 401/403 - treat as unauthenticated
        if (res.status === 401 || res.status === 403) {
          return { plan: "free", authenticated: false };
        }
        throw new Error("Failed to load entitlements");
      }
      return res.json();
    },
    // Keep caching aggressive, but always refetch on mount to avoid stale plan after auth transitions
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * Helper hook to get just the isPro status
 * More ergonomic for components that only need this
 */
export function useIsPro() {
  const { data: entitlements, isLoading } = useEntitlements();
  const isPro = !isLoading && (
    entitlements?.plan === "pro" || 
    entitlements?.plan === "admin" || 
    entitlements?.plan === "unlimited"
  );
  return { isPro, isLoading };
}


