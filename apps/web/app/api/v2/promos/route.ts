import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { PromoType, PromosApiResponse, SportsbookPromo } from "@/lib/promos-schema";

// Use Node runtime — edge does not support the service-role supabase client pattern here.
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    // ── Parse query params ──────────────────────────────────────────────────
    const sportsbooksParam = searchParams.get("sportsbooks");
    const sportsParam = searchParams.get("sports");
    const promoTypesParam = searchParams.get("promo_types");
    const newUserOnly = searchParams.get("new_user_only") === "true";
    const dailyOnly = searchParams.get("daily_only") === "true";
    const dateParam = searchParams.get("date");

    const sportsbooks = sportsbooksParam
      ? sportsbooksParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const sports = sportsParam
      ? sportsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const promoTypes = promoTypesParam
      ? (promoTypesParam.split(",").map((s) => s.trim()).filter(Boolean) as PromoType[])
      : [];

    // Default date to today in CT (America/Chicago)
    const collectedDate =
      dateParam ??
      new Date()
        .toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

    // ── Build query ─────────────────────────────────────────────────────────
    const supabase = createServerSupabaseClient();
    let query = supabase
      .from("sportsbook_promos")
      .select("*")
      .eq("collected_date", collectedDate)
      .order("sportsbook", { ascending: true })
      .order("promo_type", { ascending: true });

    if (sportsbooks.length > 0) {
      query = query.in("sportsbook", sportsbooks);
    }

    // Sport filter: if "All" is included, skip sport filtering
    if (sports.length > 0 && !sports.includes("All")) {
      query = query.in("sport", sports);
    }

    if (promoTypes.length > 0) {
      query = query.in("promo_type", promoTypes);
    }

    if (newUserOnly) {
      query = query.eq("is_new_user_only", true);
    }

    if (dailyOnly) {
      query = query.eq("is_daily", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/v2/promos] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch promos", detail: error.message },
        { status: 500 }
      );
    }

    const promos = (data ?? []) as SportsbookPromo[];

    // ── Build metadata ──────────────────────────────────────────────────────
    const counts_by_sportsbook: Record<string, number> = {};
    for (const promo of promos) {
      counts_by_sportsbook[promo.sportsbook] =
        (counts_by_sportsbook[promo.sportsbook] ?? 0) + 1;
    }

    const response: PromosApiResponse = {
      promos,
      total: promos.length,
      counts_by_sportsbook,
      collected_date: collectedDate,
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 minutes at the CDN layer; allow stale-while-revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v2/promos] Unexpected error:", message);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}