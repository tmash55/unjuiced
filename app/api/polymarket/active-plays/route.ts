import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface ActivePlay {
  id: number;
  condition_id: string;
  token_id?: string;
  market_question: string;
  market_title?: string; // legacy alias
  event_slug?: string;
  sport: string;
  league?: string;
  recommended_side: string;
  outcome?: string; // legacy alias
  side?: string; // BUY/SELL
  combined_score: number;
  play_score?: number; // legacy alias
  play_label: "NUCLEAR" | "STRONG" | "LEAN" | "WATCH" | "INFO";
  estimated_edge: string | null;
  estimated_true_prob: string | null;
  current_poly_price: string | null;
  sportsbook_implied: string | null;
  net_sentiment: "strong_yes" | "lean_yes" | "split" | "lean_no" | "strong_no" | null;
  wallet_count: number;
  sharp_count?: number; // legacy alias
  s_tier_count?: number;
  a_tier_count?: number;
  b_tier_count?: number;
  total_volume: string | null;
  total_sharp_volume?: string | null; // legacy alias
  avg_entry_price: string | null;
  sportsbook_odds: unknown | null;
  first_signal_at: string;
  last_signal_at: string;
  latest_signal_at?: string; // legacy alias
  created_at: string;
  updated_at?: string;
  is_active: boolean;
  is_resolved?: boolean;
  result?: string | null;
  market_type?: string | null;
  game_start_time?: string | null;
  game_date?: string | null;
  signal_ids?: string[];
  conflicting_signal?: boolean | null;
  top_wallets: Array<{
    wallet_address: string;
    tier: "S" | "A" | "B" | "C";
    score: number;
  }> | null;
  opposing_side_summary: {
    conflict_status?: "clear" | "split";
    opposing_score?: number;
    score_gap?: number;
    opposing_outcome?: string;
    opposing_side?: string;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minScore = Number(searchParams.get("min_score") ?? 0);
    const sport = searchParams.get("sport");
    const label = searchParams.get("label");
    const sort = searchParams.get("sort") ?? "score"; // score | newest | edge
    const limit = Number(searchParams.get("limit") ?? 100);
    const hideAfterHours = Number(searchParams.get("hide_after") ?? 0);

    const sb = createServerSupabaseClient();

    let query = sb
      .from("polymarket_active_plays")
      .select("*")
      .eq("is_active", true)
      .limit(limit);

    // Score filter — try combined_score first, fall back to play_score
    query = query.gte("combined_score", minScore);

    if (sport) query = query.eq("sport", sport);
    if (label) query = query.eq("play_label", label);

    // Suppress weaker side of clear-conflict plays (server-side filter)
    // conflict_status = "clear" + this play is the weaker side = suppressed
    query = query.or("conflicting_signal.is.null,conflicting_signal.eq.false");

    // Game start time filter
    if (hideAfterHours >= 0) {
      const cutoff = new Date(
        Date.now() - hideAfterHours * 60 * 60 * 1000
      ).toISOString();
      query = query.or(`game_start_time.is.null,game_start_time.gte.${cutoff}`);
    }

    // Sort
    if (sort === "newest") {
      query = query.order("last_signal_at", { ascending: false });
    } else if (sort === "edge") {
      query = query.order("estimated_edge", { ascending: false, nullsFirst: false });
    } else {
      // default: score desc
      query = query.order("combined_score", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      // Try fallback with legacy field name play_score
      console.error("[Active Plays API] Query error (may be schema mismatch):", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize legacy field names → canonical names
    const plays = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      // Canonical name aliases
      combined_score: (row.combined_score ?? row.play_score ?? 0) as number,
      market_question: (row.market_question ?? row.market_title ?? "") as string,
      recommended_side: (row.recommended_side ?? row.outcome ?? "") as string,
      wallet_count: (row.wallet_count ?? row.sharp_count ?? 0) as number,
      total_volume: (row.total_volume ?? row.total_sharp_volume ?? null) as string | null,
      last_signal_at: (row.last_signal_at ?? row.latest_signal_at ?? row.created_at ?? "") as string,
    }));

    return NextResponse.json({
      plays,
      meta: { total: plays.length, minScore, sort },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[Active Plays API] Unexpected:", message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
