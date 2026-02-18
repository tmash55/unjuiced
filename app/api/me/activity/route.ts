import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { identifyCustomer } from "@/libs/customerio";

/**
 * POST /api/me/activity
 *
 * Updates the authenticated user's last_active_at and total_sessions
 * in the profiles table. Only writes if the last activity was more
 * than 30 minutes ago to avoid hammering on every page navigation.
 *
 * Also syncs last_active_at to Customer.io (non-blocking).
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // Fetch current last_active_at to decide if we should update
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_active_at")
      .eq("id", user.id)
      .single();

    const now = new Date();
    const lastActive = profile?.last_active_at
      ? new Date(profile.last_active_at)
      : null;

    // Only update if more than 30 minutes since last activity
    const THIRTY_MINUTES = 30 * 60 * 1000;
    if (lastActive && now.getTime() - lastActive.getTime() < THIRTY_MINUTES) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Update profiles: set last_active_at and increment total_sessions
    const { error: updateError } = await supabase.rpc("increment_activity", {
      p_user_id: user.id,
    });

    if (updateError) {
      // Fallback: direct update without increment RPC
      console.warn("[activity] RPC failed, falling back to direct update:", updateError.message);
      await supabase
        .from("profiles")
        .update({
          last_active_at: now.toISOString(),
          total_sessions: (profile as any)?.total_sessions
            ? (profile as any).total_sessions + 1
            : 1,
        })
        .eq("id", user.id);
    }

    // Sync to Customer.io (non-blocking)
    const totalSessions = (profile as any)?.total_sessions
      ? (profile as any).total_sessions + 1
      : 1;
    identifyCustomer(user.id, {
      last_active_at: Math.floor(now.getTime() / 1000), // Unix timestamp for Customer.io
      total_sessions: totalSessions,
      email: user.email,
    }).catch(() => {});

    return NextResponse.json({ ok: true, skipped: false });
  } catch (error) {
    console.error("[activity] Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
