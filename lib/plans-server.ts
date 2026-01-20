import { User } from "@supabase/supabase-js";
import { createClient } from "@/libs/supabase/server";
import type { UserPlan } from "./plans";

/**
 * Get user's plan tier using the v_user_entitlements view
 * This accounts for both active subscriptions AND active trials
 * 
 * NOTE: This is a server-only function. Use getClientUserPlan for client components.
 */
export async function getUserPlan(user: User | null): Promise<UserPlan> {
  if (!user) {
    return "anonymous";
  }

  try {
    const supabase = await createClient();
    
    // Use current_entitlements view to get effective plan
    const { data: entitlement, error } = await supabase
      .from("current_entitlements")
      .select("current_plan")
      .eq("user_id", user.id)
      .single();

    if (error || !entitlement) {
      console.error("Error fetching user entitlement:", error);
      return "free"; // Default to free if entitlement not found
    }

    return (entitlement.current_plan as UserPlan) || "free";
  } catch (error) {
    console.error("Error in getUserPlan:", error);
    return "free";
  }
}
