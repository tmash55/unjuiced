import { User } from "@supabase/supabase-js";

/**
 * User plan tiers
 * - anonymous: Not logged in
 * - free: Logged in, no subscription
 * - scout: $15/mo - Hit rate research tools
 * - sharp: $35/mo - Hit rates + EV/Arb tools (no live arb, no custom models)
 * - edge: $65/mo - Everything including live arb + custom models
 */
export type UserPlan = "anonymous" | "free" | "scout" | "sharp" | "edge" | "elite";

/**
 * Legacy plan type aliases for backward compatibility
 * @deprecated Use UserPlan instead
 */
export type LegacyUserPlan = "hit_rate" | "pro";

/**
 * Map legacy plan names to new plan names.
 * Early adopters get bumped up one tier as a loyalty reward:
 *   hit_rate → sharp  (was scout-level, now gets sharp tools)
 *   pro      → elite  (was sharp-level, now gets full elite access)
 */
export function normalizePlanName(plan: string): UserPlan {
  if (plan === "hit_rate") return "sharp"; // Legacy hit_rate → sharp (bumped up)
  if (plan === "pro") return "elite";      // Legacy pro → elite (bumped up)
  if (plan === "admin") return "elite";    // Admins get full access
  return plan as UserPlan;
}

/**
 * Feature access limits by plan
 */
export const PLAN_LIMITS = {
  anonymous: {
    arbitrage: {
      maxResults: 100, // Limited preview
      refreshRate: 60000, // 60 seconds
      canFilter: false,
      canExport: false,
      hasLiveArb: false,
    },
    odds: {
      maxLeagues: 1,
      refreshRate: 30000,
      canCompare: false,
    },
    positiveEV: {
      maxResults: 0, // No access
      refreshRate: 0,
      hasCustomModels: false,
    },
    hitRates: {
      hasAccess: false,
      hasEVSignals: false,
    },
  },
  free: {
    arbitrage: {
      maxResults: 100, // Limited preview
      refreshRate: 10000, // 10 seconds
      canFilter: true,
      canExport: false,
      hasLiveArb: false,
    },
    odds: {
      maxLeagues: 3,
      refreshRate: 5000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: 10,
      refreshRate: 30000,
      hasCustomModels: false,
    },
    hitRates: {
      hasAccess: false,
      hasEVSignals: false,
    },
  },
  scout: {
    arbitrage: {
      maxResults: 100, // Same as free - no arb access
      refreshRate: 10000,
      canFilter: true,
      canExport: false,
      hasLiveArb: false,
    },
    odds: {
      maxLeagues: 3, // Same as free - limited odds access
      refreshRate: 5000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: 10, // Same as free - limited EV access
      refreshRate: 30000,
      hasCustomModels: false,
    },
    hitRates: {
      hasAccess: true, // Full Hit Rates access
      hasEVSignals: false,
    },
  },
  sharp: {
    arbitrage: {
      maxResults: -1, // Unlimited
      refreshRate: 2000, // 2 seconds
      canFilter: true,
      canExport: true,
      hasLiveArb: false, // No live arb for Sharp
    },
    odds: {
      maxLeagues: -1, // Unlimited
      refreshRate: 2000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: -1, // Unlimited
      refreshRate: 5000,
      hasCustomModels: false, // No custom models for Sharp
    },
    hitRates: {
      hasAccess: true,
      hasEVSignals: false,
    },
  },
  edge: {
    arbitrage: {
      maxResults: -1, // Unlimited
      refreshRate: 2000, // 2 seconds
      canFilter: true,
      canExport: true,
      hasLiveArb: true, // Live arb for Edge
    },
    odds: {
      maxLeagues: -1, // Unlimited
      refreshRate: 2000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: -1, // Unlimited
      refreshRate: 5000,
      hasCustomModels: true, // Custom models for Edge
    },
    hitRates: {
      hasAccess: true,
      hasEVSignals: true, // EV-enhanced hit rates for Edge
    },
  },
  elite: {
    arbitrage: {
      maxResults: -1, // Unlimited
      refreshRate: 2000, // 2 seconds
      canFilter: true,
      canExport: true,
      hasLiveArb: true, // Full access
    },
    odds: {
      maxLeagues: -1, // Unlimited
      refreshRate: 2000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: -1, // Unlimited
      refreshRate: 5000,
      hasCustomModels: true, // Full access
    },
    hitRates: {
      hasAccess: true,
      hasEVSignals: true, // EV-enhanced hit rates
    },
  },
} as const;

/**
 * Check if a plan has access to Hit Rates
 */
export function hasHitRateAccess(plan: UserPlan): boolean {
  return plan === "scout" || plan === "sharp" || plan === "edge";
}

/**
 * Check if a plan has access to sharp tools (EV, Arb, Edge Finder)
 */
export function hasSharpAccess(plan: UserPlan): boolean {
  return plan === "sharp" || plan === "edge" || plan === "elite";
}

/**
 * Check if a plan has access to Edge features (live arb, custom models, EV signals)
 */
export function hasEdgeAccess(plan: UserPlan): boolean {
  return plan === "edge" || plan === "elite";
}

/**
 * Check if a plan has full Sharp features (arb, EV, etc.)
 * @deprecated Use hasSharpAccess or hasEdgeAccess instead
 */
export function hasProAccess(plan: UserPlan): boolean {
  return plan === "sharp" || plan === "edge" || plan === "elite";
}

/**
 * Client-side: Get user's plan from profile (requires user object with profile data)
 */
export function getClientUserPlan(user: User | null): UserPlan {
  if (!user) {
    return "anonymous";
  }

  // Check user metadata for plan (you can store it there or fetch from DB)
  const plan = user.user_metadata?.plan as UserPlan | undefined;
  return plan || "free";
}

/**
 * Check if user can access a feature
 */
export function canAccessFeature(
  plan: UserPlan,
  feature: keyof typeof PLAN_LIMITS.anonymous
): boolean {
  const limits = PLAN_LIMITS[plan][feature];
  
  // Check if feature is accessible at all
  if ("maxResults" in limits) {
    return limits.maxResults !== 0;
  }
  
  return true;
}

/**
 * Get feature limits for a specific plan and feature
 */
export function getFeatureLimits<T extends keyof typeof PLAN_LIMITS.anonymous>(
  plan: UserPlan,
  feature: T
): (typeof PLAN_LIMITS)[UserPlan][T] {
  return PLAN_LIMITS[plan][feature];
}

/**
 * Check if result count exceeds plan limit
 */
export function exceedsLimit(
  plan: UserPlan,
  feature: keyof typeof PLAN_LIMITS.anonymous,
  count: number
): boolean {
  const limits = PLAN_LIMITS[plan][feature];
  
  if ("maxResults" in limits) {
    const maxResults = limits.maxResults;
    // -1 means unlimited
    if (maxResults === -1) return false;
    return count > maxResults;
  }
  
  return false;
}

/**
 * Get upgrade message for a feature
 */
export function getUpgradeMessage(plan: UserPlan, feature: string): string {
  if (plan === "anonymous") {
    return `Sign up for a free account to unlock more ${feature} opportunities!`;
  }

  if (plan === "free") {
    return `Upgrade to Scout for hit rate research or Sharp for full betting tools!`;
  }

  if (plan === "scout") {
    return `Upgrade to Sharp for unlimited ${feature} access with EV and arbitrage tools!`;
  }

  if (plan === "sharp") {
    return `Upgrade to Edge for live arbitrage, custom models, and EV-enhanced hit rates!`;
  }

  return "";
}
