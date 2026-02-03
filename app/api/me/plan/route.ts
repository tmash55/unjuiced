import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, normalizePlanName, type UserPlan } from "@/lib/plans";

/**
 * GET /api/me/plan
 * Returns the user's effective plan using the v_user_entitlements view
 * This accounts for both active subscriptions AND active trials
 * Returns "free" if not authenticated or if no entitlements found
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { plan: "free", authenticated: false },
        { 
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
        }
      );
    }

    // Get user's effective plan from current_entitlements view
    // This view calculates the plan based on active subscriptions OR trial status
    const { data: entitlement, error: entitlementError } = await supabase
      .from("current_entitlements")
      .select("current_plan, entitlement_source, trial_started_at, trial_ends_at, trial_used")
      .eq("user_id", user.id)
      .single();

    if (entitlementError || !entitlement) {
      console.error("Error fetching entitlement:", entitlementError);
      return NextResponse.json(
        { plan: "free", authenticated: true, error: "Entitlement not found" },
        { 
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
        }
      );
    }

    const normalized = normalizePlanName(String(entitlement.current_plan || "free"));
    const plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";

    return NextResponse.json(
      { 
        plan, 
        authenticated: true,
        userId: user.id,
        entitlement_source: entitlement.entitlement_source,
        trial: {
          trial_used: entitlement.trial_used,
          trial_started_at: entitlement.trial_started_at,
          trial_ends_at: entitlement.trial_ends_at,
          is_trial_active: entitlement.entitlement_source === 'trial',
        },
      },
      { 
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
      }
    );
  } catch (error) {
    console.error("Error in /api/me/plan:", error);
    return NextResponse.json(
      { plan: "free", authenticated: false, error: "Server error" },
      { 
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
      }
    );
  }
}
