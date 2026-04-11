import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface ActivePlay {
  id: number;
  condition_id: string;
  token_id: string;
  market_title: string;
  event_slug: string;
  sport: string;
  outcome: string;
  side: string;
  play_score: number;
  play_label: string;
  estimated_edge: string | null;
  estimated_true_prob: string | null;
  current_poly_price: string | null;
  sportsbook_implied: string | null;
  sharp_count: number;
  s_tier_count: number;
  a_tier_count: number;
  b_tier_count: number;
  total_sharp_volume: string | null;
  avg_entry_price: string | null;
  sportsbook_odds: any | null;
  first_signal_at: string;
  latest_signal_at: string;
  updated_at: string;
  is_active: boolean;
  is_resolved: boolean;
  result: string | null;
  market_type: string | null;
  game_start_time: string | null;
  game_date: string | null;
  signal_ids: string[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minScore = Number(searchParams.get("min_score") ?? 0);
    const sport = searchParams.get("sport");
    const label = searchParams.get("label");
    const limit = Number(searchParams.get("limit") ?? 100);
    const hideAfterHours = Number(searchParams.get("hide_after") ?? 0);

    const sb = createServerSupabaseClient();

    let query = sb
      .from("polymarket_active_plays")
      .select("*")
      .eq("is_active", true)
      .gte("play_score", minScore)
      .order("play_score", { ascending: false })
      .limit(limit);

    if (sport) query = query.eq("sport", sport);
    if (label) query = query.eq("play_label", label);

    // Filter by game start time:
    // -1 = show all (no filtering)
    // 0 = hide games that already started (default)
    // 1,2,3 = show games up to X hours after start
    if (hideAfterHours >= 0) {
      const cutoff = new Date(Date.now() - hideAfterHours * 60 * 60 * 1000).toISOString();
      query = query.or(`game_start_time.is.null,game_start_time.gte.${cutoff}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Active Plays API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      plays: data ?? [],
      meta: {
        total: data?.length ?? 0,
        minScore,
      },
    });
  } catch (err: any) {
    console.error("[Active Plays API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
