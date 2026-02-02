import { useAuth } from "@/components/auth/auth-provider";
import { 
  getClientUserPlan, 
  canAccessFeature, 
  getFeatureLimits, 
  exceedsLimit,
  getUpgradeMessage,
  UserPlan,
  PLAN_LIMITS
} from "@/lib/plans";
import { useMemo } from "react";

/**
 * Hook to get user's current plan
 */
export function useUserPlan(): UserPlan {
  const { user } = useAuth();
  return useMemo(() => getClientUserPlan(user), [user]);
}

/**
 * Hook to check feature access and get limits
 */
export function useFeatureAccess(feature: keyof typeof PLAN_LIMITS.anonymous) {
  const { user } = useAuth();
  const plan = useUserPlan();

  const hasAccess = useMemo(
    () => canAccessFeature(plan, feature),
    [plan, feature]
  );

  const limits = useMemo(
    () => getFeatureLimits(plan, feature),
    [plan, feature]
  );

  const checkLimit = useMemo(
    () => (count: number) => exceedsLimit(plan, feature, count),
    [plan, feature]
  );

  const upgradeMessage = useMemo(
    () => getUpgradeMessage(plan, feature),
    [plan, feature]
  );

  return {
    plan,
    hasAccess,
    limits,
    checkLimit,
    upgradeMessage,
    isAnonymous: plan === "anonymous",
    isFree: plan === "free",
    isScout: plan === "scout",
    isSharp: plan === "sharp",
    isEdge: plan === "edge",
    // isPro = has any paid plan (scout, sharp, or edge)
    isPro: plan === "scout" || plan === "sharp" || plan === "edge",
    isAuthenticated: !!user,
  };
}

/**
 * Hook specifically for arbitrage feature
 */
export function useArbitrageAccess() {
  return useFeatureAccess("arbitrage");
}

/**
 * Hook specifically for odds feature
 */
export function useOddsAccess() {
  return useFeatureAccess("odds");
}

/**
 * Hook specifically for positive EV feature
 */
export function usePositiveEVAccess() {
  return useFeatureAccess("positiveEV");
}

