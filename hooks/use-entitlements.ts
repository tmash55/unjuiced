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
        // Don't throw on 401/403 - just return free plan
        if (res.status === 401 || res.status === 403) {
          return { plan: "free", authenticated: false };
        }
        throw new Error("Failed to load entitlements");
      }
      return res.json();
    },
    staleTime: 5 * 60_000, // 5 minutes - balance freshness vs performance
    gcTime: 30 * 60_000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Refetch on network reconnect
    refetchOnMount: false, // Don't refetch on every component mount (use cache)
    retry: 1, // Only retry once on failure
    // Optimistic initial data - assume free until proven otherwise
    placeholderData: { plan: "free", authenticated: false },
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


