"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import type { FeedResponse, WalletTier } from "@/lib/polymarket/types";
import { computeSignalScore } from "@/lib/polymarket/score";

/**
 * GET /api/polymarket/feed
 *
 * Returns real-time whale bet feed enriched with wallet scores.
 * Elite-tier only.
 *
 * Query params:
 *   limit         - signals per page (default 50, max 200)
 *   offset        - pagination offset (default 0)
 *   sport         - filter by sport (e.g. "nba", "soccer")
 *   tier          - filter by wallet tier: S, A, B, C, FADE, NEW (comma-separated)
 *   minStake      - minimum bet_size in USD (default 0)
 *   minQuality    - minimum quality_score 1-5 (default 0)
 *   resolved      - "true" | "false" | "all" (default "all")
 *   wallet        - filter by specific wallet_address
 *   showNew       - include NEW/burner wallet bets (default "true")
 *   today         - only today's bets (default "false")
 *   sort          - "score" | "recent" | "stake" (default "score")
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

    // Parse query params
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(sp.get("offset") || "0", 10), 0);
    const sport = sp.get("sport") || undefined;
    const tierFilter = sp.get("tier")?.split(",").filter(Boolean) || undefined;
    const minStake = parseFloat(sp.get("minStake") || "0") || 0;
    const minQuality = parseInt(sp.get("minQuality") || "0", 10) || 0;
    const resolvedFilter = sp.get("resolved") || "all";
    const walletFilter = sp.get("wallet") || undefined;
    const showNew = sp.get("showNew") !== "false";
    const todayOnly = sp.get("today") === "true";
    const sortBy = sp.get("sort") || "score";

    // Build signals query
    let query = supabase
      .from("polymarket_signals")
      .select(
        `id, tier, wallet_address, wallet_username, wallet_pnl,
         market_title, market_type, sport, outcome, side,
         entry_price, american_odds, bet_size, implied_probability,
         game_start_time, game_date,
         book_name, book_price, best_book, best_book_price, best_book_decimal,
         resolved, result, pnl,
         quality_score, created_at`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filters
    if (sport) query = query.eq("sport", sport);
    if (walletFilter) query = query.eq("wallet_address", walletFilter);
    if (minStake > 0) query = query.gte("bet_size", minStake);
    if (minQuality > 0) query = query.gte("quality_score", minQuality);

    if (resolvedFilter === "true") query = query.eq("resolved", true);
    else if (resolvedFilter === "false") query = query.eq("resolved", false);

    if (todayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte("created_at", `${today}T00:00:00Z`);
    }

    const { data: signals, error, count } = await query;

    if (error) {
      console.error("[/api/polymarket/feed] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({ signals: [], total: 0 });
    }

    // Enrich signals with wallet scores
    const walletAddresses = [...new Set(signals.map((s) => s.wallet_address))];
    const { data: walletScores } = await supabase
      .from("polymarket_wallet_scores")
      .select("wallet_address, rank, tier, roi, wins, losses, avg_stake, is_new_account")
      .in("wallet_address", walletAddresses);

    const scoreMap = new Map(
      (walletScores ?? []).map((w) => [w.wallet_address, w])
    );

    // Filter by tier if specified (applied after join since tier comes from wallet_scores)
    const enriched = signals
      .map((s) => {
        const ws = scoreMap.get(s.wallet_address);
        const walletTier = (ws?.tier ?? "C") as WalletTier;
        const stakeVsAvg =
          ws?.avg_stake && s.bet_size
            ? Math.round((s.bet_size / ws.avg_stake) * 10) / 10
            : null;
        const bookDecimal = s.best_book_decimal;
        const bookImplied = bookDecimal ? 1 / bookDecimal : null;

        // Compute composite signal score
        const scoreResult = computeSignalScore({
          tier: s.tier,
          bet_size: s.bet_size ?? 0,
          wallet_avg_stake: ws?.avg_stake ?? null,
          wallet_roi: ws?.roi ?? null,
          wallet_win_rate: ws ? ws.wins / Math.max(ws.wins + ws.losses, 1) : null,
          wallet_total_bets: ws ? ws.wins + ws.losses : null,
          clv_avg: null, // TODO: wire up CLV from wallet scores
          american_odds: s.american_odds,
          entry_price: s.entry_price,
          book_implied: bookImplied,
          quality_score: s.quality_score,
          created_at: s.created_at,
        });

        return {
          ...s,
          wallet_rank: ws?.rank ?? null,
          wallet_tier: walletTier,
          wallet_roi: ws?.roi ?? null,
          wallet_record: ws ? `${ws.wins}-${ws.losses}` : null,
          stake_vs_avg: stakeVsAvg,
          is_new_account: ws?.is_new_account ?? false,
          signal_score: scoreResult.total,
          signal_label: scoreResult.label,
          score_breakdown: scoreResult.breakdown,
        };
      })
      .filter((s) => {
        // Apply tier filter
        if (tierFilter && tierFilter.length > 0 && !tierFilter.includes(s.wallet_tier)) {
          return false;
        }
        // Filter new accounts if disabled
        if (!showNew && s.is_new_account) return false;
        return true;
      });

    // Sort
    if (sortBy === "score") {
      enriched.sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0));
    } else if (sortBy === "stake") {
      enriched.sort((a, b) => (b.bet_size ?? 0) - (a.bet_size ?? 0));
    }
    // "recent" = default DB order (created_at desc), no re-sort needed

    const response: FeedResponse = {
      signals: enriched,
      total: count ?? 0,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    console.error("[/api/polymarket/feed] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
