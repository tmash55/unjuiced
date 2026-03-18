"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import crypto from "crypto";

interface TierStats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
}

interface TopWallet {
  anonymousId: string;
  record: string;
  winRate: number;
  roi: number;
  sport: string | null;
}

interface StatsResponse {
  overall: TierStats & { since: string | null };
  byTier: { sharp: TierStats; whale: TierStats };
  bySport: Record<string, TierStats>;
  byTimeframe: Record<string, TierStats>;
  topWallets: TopWallet[];
}

const DEFAULT_EXCLUDED_SPORTS = ["esports"];

function computeConsensus(signals: Array<{
  condition_id: string | null;
  side: string | null;
  bet_size: number | null;
  result: string | null;
  entry_price: number | null;
}>): TierStats {
  const marketSides = new Map<string, { totalFlow: number; result: string; entries: number[] }>();
  for (const s of signals) {
    if (!s.condition_id || !s.side || !s.result) continue;
    const key = `${s.condition_id}::${s.side}`;
    const existing = marketSides.get(key);
    if (existing) {
      existing.totalFlow += s.bet_size ?? 0;
      existing.entries.push(s.entry_price ?? 0);
    } else {
      marketSides.set(key, {
        totalFlow: s.bet_size ?? 0,
        result: s.result,
        entries: [s.entry_price ?? 0],
      });
    }
  }

  const markets = new Map<string, { sides: { side: string; flow: number; result: string; entries: number[] }[] }>();
  for (const [key, val] of marketSides) {
    const [condId, side] = key.split("::");
    if (!markets.has(condId)) markets.set(condId, { sides: [] });
    markets.get(condId)!.sides.push({ side, flow: val.totalFlow, result: val.result, entries: val.entries });
  }

  let wins = 0, losses = 0, totalRoiSum = 0, totalPnl100 = 0;
  for (const [, market] of markets) {
    const totalFlow = market.sides.reduce((s, x) => s + x.flow, 0);
    if (totalFlow === 0) continue;
    const sorted = market.sides.sort((a, b) => b.flow - a.flow);
    const majority = sorted[0];
    const majorityPct = majority.flow / totalFlow;
    if (majorityPct < 0.6 && market.sides.length > 1) continue;
    const avgEntry = majority.entries.reduce((a, b) => a + b, 0) / majority.entries.length;
    if (majority.result === "win") {
      wins++;
      const profit = avgEntry > 0 ? (1 / avgEntry - 1) : 0;
      totalRoiSum += profit;
      totalPnl100 += profit * 100;
    } else {
      losses++;
      totalRoiSum -= 1;
      totalPnl100 -= 100;
    }
  }

  const total = wins + losses;
  return {
    wins, losses, total,
    winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
    roi: total > 0 ? Math.round((totalRoiSum / total) * 1000) / 10 : 0,
    pnl100: Math.round(totalPnl100),
  };
}

function getTimeframeCutoff(tf: string): string | null {
  const now = Date.now();
  if (tf === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (tf === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null; // "all"
}

function anonymize(wallet: string): string {
  return crypto.createHash("sha256").update(wallet).digest("hex").slice(0, 8);
}

const emptyTier: TierStats = { wins: 0, losses: 0, total: 0, winRate: 0, roi: 0, pnl100: 0 };

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ent } = await supabase
      .from("current_entitlements")
      .select("current_plan")
      .eq("user_id", user.id)
      .single();

    const normalized = normalizePlanName(String(ent?.current_plan || "free"));
    const plan: UserPlan =
      normalized === "anonymous" || normalized === "free" || normalized === "scout" || normalized === "sharp" || normalized === "elite"
        ? normalized : "free";

    if (!hasEliteAccess(plan)) {
      return NextResponse.json({ error: "Elite tier required" }, { status: 403 });
    }

    // Parse params
    const sp = req.nextUrl.searchParams;
    const sportFilter = sp.get("sport") || undefined;
    const timeframe = sp.get("timeframe") || "all";
    const excludeSportsParam = sp.get("excludeSports")?.split(",").filter(Boolean);
    const includeSportsParam = sp.get("includeSports")?.split(",").filter(Boolean);

    // Build excluded sports list
    let excludedSports = excludeSportsParam ?? [...DEFAULT_EXCLUDED_SPORTS];
    if (includeSportsParam) {
      excludedSports = excludedSports.filter((s) => !includeSportsParam.includes(s));
    }

    // Fetch all resolved signals
    let query = supabase
      .from("polymarket_signals")
      .select("condition_id, side, bet_size, result, entry_price, created_at, tier, sport, wallet_address")
      .eq("resolved", true)
      .not("result", "is", null);

    if (sportFilter) query = query.eq("sport", sportFilter);

    const { data: signals, error } = await query;

    if (error) {
      console.error("[/api/polymarket/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      const empty: StatsResponse = {
        overall: { ...emptyTier, since: null },
        byTier: { sharp: { ...emptyTier }, whale: { ...emptyTier } },
        bySport: {},
        byTimeframe: { "7d": { ...emptyTier }, "30d": { ...emptyTier }, all: { ...emptyTier } },
        topWallets: [],
      };
      return NextResponse.json(empty);
    }

    // Filter out excluded sports
    const filtered = signals.filter((s) => !excludedSports.includes(s.sport ?? ""));

    // Apply timeframe filter for primary stats
    const tfCutoff = getTimeframeCutoff(timeframe);
    const tfFiltered = tfCutoff
      ? filtered.filter((s) => s.created_at && s.created_at >= tfCutoff)
      : filtered;

    // Overall
    const overall = computeConsensus(tfFiltered);
    const earliest = tfFiltered.reduce((min, s) => {
      if (!s.created_at) return min;
      return !min || s.created_at < min ? s.created_at : min;
    }, null as string | null);

    // By tier
    const byTier = {
      sharp: computeConsensus(tfFiltered.filter((s) => s.tier === "sharp")),
      whale: computeConsensus(tfFiltered.filter((s) => s.tier === "whale")),
    };

    // By sport
    const sports = [...new Set(tfFiltered.map((s) => s.sport).filter(Boolean))] as string[];
    const bySport: Record<string, TierStats> = {};
    for (const sport of sports) {
      bySport[sport] = computeConsensus(tfFiltered.filter((s) => s.sport === sport));
    }

    // By timeframe (always compute all three regardless of current filter)
    const byTimeframe: Record<string, TierStats> = {};
    for (const tf of ["7d", "30d", "all"] as const) {
      const cutoff = getTimeframeCutoff(tf);
      const subset = cutoff
        ? filtered.filter((s) => s.created_at && s.created_at >= cutoff)
        : filtered;
      byTimeframe[tf] = computeConsensus(subset);
    }

    // Top wallets by ROI (min 10 bets)
    const walletBets = new Map<string, { wins: number; losses: number; sport: string | null; roiSum: number }>();
    for (const s of tfFiltered) {
      if (!s.wallet_address || !s.result) continue;
      const existing = walletBets.get(s.wallet_address);
      if (existing) {
        if (s.result === "win") {
          existing.wins++;
          existing.roiSum += s.entry_price && s.entry_price > 0 ? (1 / s.entry_price - 1) : 0;
        } else {
          existing.losses++;
          existing.roiSum -= 1;
        }
      } else {
        walletBets.set(s.wallet_address, {
          wins: s.result === "win" ? 1 : 0,
          losses: s.result === "loss" ? 1 : 0,
          sport: s.sport,
          roiSum: s.result === "win" ? (s.entry_price && s.entry_price > 0 ? (1 / s.entry_price - 1) : 0) : -1,
        });
      }
    }

    const topWallets: TopWallet[] = [...walletBets.entries()]
      .filter(([, v]) => v.wins + v.losses >= 10)
      .map(([addr, v]) => {
        const total = v.wins + v.losses;
        return {
          anonymousId: anonymize(addr),
          record: `${v.wins}-${v.losses}`,
          winRate: Math.round((v.wins / total) * 1000) / 10,
          roi: Math.round((v.roiSum / total) * 1000) / 10,
          sport: v.sport,
        };
      })
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);

    const response: StatsResponse = {
      overall: { ...overall, since: earliest },
      byTier,
      bySport,
      byTimeframe,
      topWallets,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/polymarket/stats] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
