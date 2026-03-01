/**
 * Cron Job: Daily Customer.io Sync
 *
 * Syncs all entitled users to Customer.io with fresh attributes
 * and fires lifecycle events for inactive users.
 *
 * Add to vercel.json:
 * {
 *   "path": "/api/cron/sync-customerio",
 *   "schedule": "0 14 * * *"   // 9 AM CT daily
 * }
 *
 * Requires CRON_SECRET env var for auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { identifyCustomer, trackEvent } from "@/libs/customerio";

const CRON_SECRET = process.env.CRON_SECRET;

interface EntitledUser {
  user_id: string;
  current_plan: string;
  entitlement_source: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
}

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_active_at: string | null;
  total_sessions: number | null;
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const supabase = createServerSupabaseClient();
  const now = new Date();

  try {
    // Get all users with active entitlements (subscription, grant, or trial)
    const { data: entitlements, error: entError } = await supabase
      .from("current_entitlements")
      .select("user_id, current_plan, entitlement_source, trial_started_at, trial_ends_at")
      .in("entitlement_source", ["subscription", "grant", "trial"]);

    if (entError) {
      console.error("[sync-customerio] Error fetching entitlements:", entError);
      return NextResponse.json({ error: "Failed to fetch entitlements" }, { status: 500 });
    }

    if (!entitlements || entitlements.length === 0) {
      return NextResponse.json({ synced: 0, events: 0, duration_ms: Date.now() - startTime });
    }

    // Get profiles for all entitled users
    const userIds = entitlements.map((e: EntitledUser) => e.user_id);
    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_active_at, total_sessions")
      .in("id", userIds);

    if (profError) {
      console.error("[sync-customerio] Error fetching profiles:", profError);
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    const profileMap = new Map<string, Profile>(
      (profiles || []).map((p: Profile) => [p.id, p])
    );

    let synced = 0;
    let eventsFired = 0;

    // Process each entitled user
    const promises = entitlements.map(async (ent: EntitledUser) => {
      const profile = profileMap.get(ent.user_id);
      if (!profile || !profile.email) return;

      const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null;
      const daysInactive = lastActive
        ? Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Identify customer with fresh attributes
      await identifyCustomer(ent.user_id, {
        email: profile.email,
        first_name: profile.first_name || undefined,
        plan: ent.current_plan,
        subscription_status: ent.entitlement_source,
        days_inactive: daysInactive,
        last_active_at: lastActive
          ? Math.floor(lastActive.getTime() / 1000)
          : undefined,
        total_sessions: profile.total_sessions || 0,
      });
      synced++;

      // Fire lifecycle events based on inactivity thresholds
      // Use day-range checks so events fire once (when crossing the threshold day)
      if (daysInactive === null) return;

      const isTrial = ent.entitlement_source === "trial";

      if (isTrial && daysInactive >= 1 && daysInactive <= 2) {
        // Trial user inactive 1+ days — critical during short trial
        await trackEvent(ent.user_id, "trial_inactive", {
          days_inactive: daysInactive,
          plan: ent.current_plan,
          trial_ends_at: ent.trial_ends_at,
        });
        eventsFired++;
      }

      if (!isTrial && daysInactive >= 7 && daysInactive <= 8) {
        await trackEvent(ent.user_id, "user_going_cold", {
          days_inactive: daysInactive,
          plan: ent.current_plan,
        });
        eventsFired++;
      }

      if (!isTrial && daysInactive >= 14 && daysInactive <= 15) {
        await trackEvent(ent.user_id, "user_at_risk", {
          days_inactive: daysInactive,
          plan: ent.current_plan,
        });
        eventsFired++;
      }
    });

    await Promise.all(promises);

    const result = {
      synced,
      events: eventsFired,
      total_entitled: entitlements.length,
      duration_ms: Date.now() - startTime,
    };

    console.log("[sync-customerio] Complete:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sync-customerio] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
