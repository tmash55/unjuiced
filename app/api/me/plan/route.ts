import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/me/plan
 * Returns the user's plan from the profiles table
 * Returns "free" if not authenticated or if plan is not set
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

    // Get user's plan from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { plan: "free", authenticated: true, error: "Profile not found" },
        { 
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
        }
      );
    }

    return NextResponse.json(
      { 
        plan: profile.plan || "free", 
        authenticated: true,
        userId: user.id 
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