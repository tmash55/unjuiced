"use server";

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

interface StatsResponse {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
  since: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all resolved signals with tier='sharp' or any tier (consensus from all sharps)
    const { data: signals, error } = await supabase
      .from("polymarket_signals")
      .select("condition_id, side, bet_size, result, entry_price, created_at")
      .eq("resolved", true)
      .not("result", "is", null);

    if (error) {
      console.error("[/api/polymarket/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      const empty: StatsResponse = { wins: 0, losses: 0, total: 0, winRate: 0, roi: 0, pnl100: 0, since: null };
      return NextResponse.json(empty);
    }

    // Group by condition_id + side, sum bet_size
    const marketSides = new Map<string, { totalFlow: number; result: string; avgEntry: number; entries: number[] }>();

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
          avgEntry: 0,
          entries: [s.entry_price ?? 0],
        });
      }
    }

    // Group by condition_id, pick majority side
    const markets = new Map<string, { sides: { side: string; flow: number; result: string; entries: number[] }[] }>();

    for (const [key, val] of marketSides) {
      const [condId, side] = key.split("::");
      if (!markets.has(condId)) markets.set(condId, { sides: [] });
      markets.get(condId)!.sides.push({ side, flow: val.totalFlow, result: val.result, entries: val.entries });
    }

    let wins = 0;
    let losses = 0;
    let totalRoiSum = 0;
    let totalPnl100 = 0;

    for (const [, market] of markets) {
      const totalFlow = market.sides.reduce((s, x) => s + x.flow, 0);
      if (totalFlow === 0) continue;

      // Pick side with most dollar flow
      const sorted = market.sides.sort((a, b) => b.flow - a.flow);
      const majority = sorted[0];
      const majorityPct = majority.flow / totalFlow;

      // Skip near 50/50 splits
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
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const roi = total > 0 ? (totalRoiSum / total) * 100 : 0;

    // Find earliest signal date
    const earliest = signals.reduce((min, s) => {
      if (!s.created_at) return min;
      return !min || s.created_at < min ? s.created_at : min;
    }, null as string | null);

    const response: StatsResponse = {
      wins,
      losses,
      total,
      winRate: Math.round(winRate * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      pnl100: Math.round(totalPnl100),
      since: earliest,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/polymarket/stats] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
