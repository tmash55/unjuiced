"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import type { WalletDetailResponse, WhaleSignal } from "@/lib/polymarket/types";

/**
 * GET /api/polymarket/wallet?address=0x...
 *
 * Returns detailed wallet profile + recent bets.
 * Elite-tier only.
 *
 * Query params:
 *   address   - wallet address (required)
 *   betLimit  - number of recent bets to return (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan check
    const { data: ent } = await supabase
      .from("current_entitlements")
      .select("current_plan")
      .eq("user_id", user.id)
      .single();

    const normalized = normalizePlanName(String(ent?.current_plan || "free"));
    const plan: UserPlan =
      normalized === "anonymous" ||
      normalized === "free" ||
      normalized === "scout" ||
      normalized === "sharp" ||
      normalized === "elite"
        ? normalized
        : "free";

    if (!hasEliteAccess(plan)) {
      return NextResponse.json(
        { error: "Elite tier required for Whale Board" },
        { status: 403 }
      );
    }

    // Parse params
    const sp = req.nextUrl.searchParams;
    const address = sp.get("address");
    const betLimit = Math.min(
      Math.max(parseInt(sp.get("betLimit") || "20", 10), 1),
      100
    );

    if (!address) {
      return NextResponse.json(
        { error: "address parameter required" },
        { status: 400 }
      );
    }

    // Fetch wallet score
    const { data: wallet, error: walletErr } = await supabase
      .from("polymarket_wallet_scores")
      .select("*")
      .eq("wallet_address", address)
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // Fetch recent bets
    const { data: recentBets, error: betsErr } = await supabase
      .from("polymarket_signals")
      .select(
        `id, tier, wallet_address, wallet_username,
         market_title, market_type, sport, outcome, side,
         entry_price, american_odds, bet_size, implied_probability,
         game_start_time, game_date,
         best_book, best_book_price, best_book_decimal,
         resolved, result, pnl, resolution_price,
         quality_score, created_at`
      )
      .eq("wallet_address", address)
      .order("created_at", { ascending: false })
      .limit(betLimit);

    if (betsErr) {
      console.error("[/api/polymarket/wallet] Bets fetch error:", betsErr);
    }

    // Enrich bets with stake_vs_avg
    const enrichedBets = (recentBets ?? []).map((b) => ({
      ...b,
      wallet_rank: wallet.rank,
      wallet_tier: wallet.tier,
      wallet_roi: wallet.roi,
      wallet_record: `${wallet.wins}-${wallet.losses}`,
      stake_vs_avg:
        wallet.avg_stake && b.bet_size
          ? Math.round((b.bet_size / wallet.avg_stake) * 10) / 10
          : null,
    }));

    const response: WalletDetailResponse = {
      wallet,
      recent_bets: enrichedBets as unknown as WhaleSignal[],
      sport_stats: wallet.sport_breakdown ?? {},
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/polymarket/wallet] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
