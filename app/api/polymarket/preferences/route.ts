"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { SignalPreferences } from "@/lib/polymarket/types";

const SIGNAL_FIELDS = [
  "signal_followed_wallets",
  "signal_sport_filters",
  "signal_excluded_sports",
  "signal_tier_filters",
  "signal_min_stake",
  "sharp_signals_min_score",
  "signal_sort_by",
  "signal_show_resolved",
  "signal_timeframe",
  "signal_alert_enabled",
  "signal_alert_min_stake",
  "signal_alert_sports",
  "signal_alert_wallets",
  "signal_max_slippage",
  "signal_date_range",
  "signal_min_odds",
  "signal_max_odds",
  "signal_show_hidden",
] as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select(SIGNAL_FIELDS.join(", "))
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[/api/polymarket/preferences] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const prefs: SignalPreferences = {
      signal_followed_wallets: row?.signal_followed_wallets ?? [],
      signal_sport_filters: row?.signal_sport_filters ?? null,
      signal_excluded_sports: row?.signal_excluded_sports ?? ["esports"],
      signal_tier_filters: row?.signal_tier_filters ?? null,
      signal_min_stake: row?.signal_min_stake ?? 0,
      sharp_signals_min_score: row?.sharp_signals_min_score ?? 0,
      signal_sort_by: row?.signal_sort_by ?? "score",
      signal_show_resolved: row?.signal_show_resolved ?? false,
      signal_timeframe: row?.signal_timeframe ?? "30d",
      signal_alert_enabled: row?.signal_alert_enabled ?? false,
      signal_alert_min_stake: row?.signal_alert_min_stake ?? 5000,
      signal_alert_sports: row?.signal_alert_sports ?? null,
      signal_alert_wallets: row?.signal_alert_wallets ?? null,
      signal_max_slippage: row?.signal_max_slippage ?? 0,
      signal_date_range: row?.signal_date_range ?? "all",
      signal_min_odds: row?.signal_min_odds ?? undefined,
      signal_max_odds: row?.signal_max_odds ?? undefined,
      signal_show_hidden: row?.signal_show_hidden ?? true,
    };

    return NextResponse.json(prefs);
  } catch (err) {
    console.error("[/api/polymarket/preferences] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Only allow signal_* fields
    const updates: Record<string, unknown> = {};
    for (const field of SIGNAL_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: false }
      )
      .select(SIGNAL_FIELDS.join(", "))
      .single();

    if (error) {
      console.error("[/api/polymarket/preferences] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/polymarket/preferences] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
