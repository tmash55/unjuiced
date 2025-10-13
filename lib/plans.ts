import { User } from "@supabase/supabase-js";
import { createClient } from "@/libs/supabase/server";

/**
 * User plan tiers
 */
export type UserPlan = "anonymous" | "free" | "pro";

/**
 * Feature access limits by plan
 */
export const PLAN_LIMITS = {
  anonymous: {
    arbitrage: {
      maxResults: 5,
      refreshRate: 60000, // 60 seconds
      canFilter: false,
      canExport: false,
    },
    odds: {
      maxLeagues: 1,
      refreshRate: 30000,
      canCompare: false,
    },
    positiveEV: {
      maxResults: 0, // No access
      refreshRate: 0,
    },
  },
  free: {
    arbitrage: {
      maxResults: 25,
      refreshRate: 10000, // 10 seconds
      canFilter: true,
      canExport: false,
    },
    odds: {
      maxLeagues: 3,
      refreshRate: 5000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: 10,
      refreshRate: 30000,
    },
  },
  pro: {
    arbitrage: {
      maxResults: -1, // Unlimited
      refreshRate: 2000, // 2 seconds
      canFilter: true,
      canExport: true,
    },
    odds: {
      maxLeagues: -1, // Unlimited
      refreshRate: 2000,
      canCompare: true,
    },
    positiveEV: {
      maxResults: -1, // Unlimited
      refreshRate: 5000,
    },
  },
} as const;

/**
 * Get user's plan tier
 */
export async function getUserPlan(user: User | null): Promise<UserPlan> {
  if (!user) {
    return "anonymous";
  }

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Error fetching user profile:", error);
      return "free"; // Default to free if profile not found
    }

    return (profile.plan as UserPlan) || "free";
  } catch (error) {
    console.error("Error in getUserPlan:", error);
    return "free";
  }
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
): typeof PLAN_LIMITS.anonymous[T] {
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
    return `Upgrade to Pro for unlimited ${feature} access with faster updates!`;
  }
  
  return "";
}

