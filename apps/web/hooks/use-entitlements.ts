"use client";

import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@unjuiced/api";
import type { Entitlements } from "@unjuiced/types";

const api = createApiClient({ baseUrl: "" });

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
    queryFn: () => api.getMePlan(),
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
 * Helper hook to check if user has Sharp or Elite access (EV, Arb, Edge Finder)
 */
export function useHasSharpAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "sharp" ||
      entitlements?.plan === "elite" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasAccess, isLoading, plan: entitlements?.plan };
}

/**
 * Helper hook to check if user has Elite access (Live Arb, Custom Models)
 */
export function useHasEliteAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "elite" ||
      entitlements?.plan === "admin" ||
      entitlements?.plan === "unlimited");
  return { hasAccess, isLoading, plan: entitlements?.plan };
}

/** @deprecated Use useHasEliteAccess instead */
export function useHasEdgeAccess() {
  return useHasEliteAccess();
}

/**
 * Helper hook to check if user has Hit Rates access (Scout, Sharp, Elite)
 */
export function useHasHitRateAccess() {
  const { data: entitlements, isLoading } = useEntitlements();
  const hasAccess =
    !isLoading &&
    (entitlements?.plan === "scout" ||
      entitlements?.plan === "sharp" ||
      entitlements?.plan === "elite" ||
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
      entitlements?.plan === "elite" ||
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
