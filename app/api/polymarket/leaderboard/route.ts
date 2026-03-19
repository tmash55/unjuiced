"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import type { LeaderboardResponse, WalletTier } from "@/lib/polymarket/types";

/**
 * GET /api/polymarket/leaderboard
 *
 * Returns the whale leaderboard ranked by composite score.
 * Elite-tier only.
 *
 * Query params:
 *   limit      - number of wallets (default 25, max 100)
 *   offset     - pagination offset (default 0)
 *   tier       - filter by tier: S, A, B, C, FADE, NEW (comma-separated)
 *   sport      - filter by primary_sport (e.g. "nba", "soccer")
 *   minBets    - minimum total_bets threshold (default 0)
 *   sortBy     - "rank" | "roi" | "profit" | "win_rate" | "total_wagered" (default "rank")
 *   showNew    - include NEW (burner) accounts (default "true")
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

    // Plan check — Elite only
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
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "25", 10), 1), 100);
    const offset = Math.max(parseInt(sp.get("offset") || "0", 10), 0);
    const tierFilter = sp.get("tier")?.split(",").filter(Boolean) as WalletTier[] | undefined;
    const sportFilter = sp.get("sport") || undefined;
    const minBets = Math.max(parseInt(sp.get("minBets") || "0", 10), 0);
    const showNew = sp.get("showNew") !== "false";
    const sortBy = sp.get("sortBy") || "rank";
    const walletFilter = sp.get("wallet") || undefined;

    // Build query
    let query = supabase
      .from("polymarket_wallet_scores")
      .select("*", { count: "exact" });

    // Direct wallet lookup — skip all other filters
    if (walletFilter) {
      query = query.eq("wallet_address", walletFilter);
      const { data, error, count } = await query;
      if (error) {
        return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
      }
      return NextResponse.json({ wallets: data ?? [], total: count ?? 0, updated_at: data?.[0]?.updated_at || null });
    }

    // Filters
    if (tierFilter && tierFilter.length > 0) {
      query = query.in("tier", tierFilter);
    } else if (!showNew) {
      query = query.neq("tier", "NEW");
    }

    if (sportFilter) {
      query = query.eq("primary_sport", sportFilter);
    }

    if (minBets > 0) {
      query = query.gte("total_bets", minBets);
    }

    // Sort
    const sortMap: Record<string, string> = {
      rank: "rank",
      roi: "roi",
      profit: "total_profit",
      win_rate: "win_rate",
      total_wagered: "total_wagered",
      composite_score: "composite_score",
    };
    const sortColumn = sortMap[sortBy] || "rank";
    const ascending = sortBy === "rank"; // rank is ascending (1 = best), everything else desc
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[/api/polymarket/leaderboard] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }

    // Get most recent update time
    const updatedAt = data?.[0]?.updated_at || null;

    const response: LeaderboardResponse = {
      wallets: data ?? [],
      total: count ?? 0,
      updated_at: updatedAt,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[/api/polymarket/leaderboard] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
