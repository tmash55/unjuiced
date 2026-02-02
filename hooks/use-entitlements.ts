"use client";

import { useQuery } from "@tanstack/react-query";

export type PlanType = "free" | "scout" | "sharp" | "edge" | "admin";

// Legacy plan names for backward compatibility
export type LegacyPlanType = "hit_rate" | "pro";

export type Entitlements = {
  plan: PlanType | LegacyPlanType | string;
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
 * Normalize legacy plan names to new names
 */
function normalizePlan(plan: string | undefined): string {
  if (plan === "hit_rate") return "scout";
  if (plan === "pro") return "sharp";
  return plan || "free";
}

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
 * const isSharp = entitlements?.plan === 'sharp'
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
      const data = await res.json();
      // Normalize legacy plan names
      return {
        ...data,
        plan: normalizePlan(data.plan),
      };
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
 * Helper hook to check if user has Sharp or Edge access (EV, Arb, Edge Finder)
 */
export function useHasSharpAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "sharp" ||
      entitlements?.plan === "edge" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasAccess, isLoading, plan: entitlements?.plan };
}

/**
 * Helper hook to check if user has Edge access (Live Arb, Custom Models)
 */
export function useHasEdgeAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "edge" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasAccess, isLoading, plan: entitlements?.plan };
}

/**
 * Helper hook to check if user has Hit Rates access (Scout, Sharp, or Edge)
 */
export function useHasHitRateAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "scout" ||
      entitlements?.plan === "sharp" ||
      entitlements?.plan === "edge" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasAccess, isLoading, plan: entitlements?.plan };
}

/**
 * Helper hook to check if user has any paid plan
 */
export function useHasPaidPlan() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasPaidPlan =
    !isLoading &&
    (entitlements?.plan === "scout" ||
      entitlements?.plan === "sharp" ||
      entitlements?.plan === "edge" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasPaidPlan, isLoading, plan: entitlements?.plan };
}

/**
 * @deprecated Use useHasSharpAccess instead
 */
export function useIsPro() {
  const { hasAccess, isLoading } = useHasSharpAccess();
  return { isPro: hasAccess, isLoading };
}
