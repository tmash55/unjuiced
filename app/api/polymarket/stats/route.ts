"use server";

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

interface TierStats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
}

interface StatsResponse {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
  since: string | null;
  byTier: {
    sharp: TierStats;
    whale: TierStats;
    all: TierStats;
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all resolved signals
    const { data: signals, error } = await supabase
      .from("polymarket_signals")
      .select("condition_id, side, bet_size, result, entry_price, created_at, tier")
      .eq("resolved", true)
      .not("result", "is", null);

    if (error) {
      console.error("[/api/polymarket/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      const emptyTier: TierStats = { wins: 0, losses: 0, total: 0, winRate: 0, roi: 0, pnl100: 0 };
      const empty: StatsResponse = {
        wins: 0, losses: 0, total: 0, winRate: 0, roi: 0, pnl100: 0, since: null,
        byTier: { sharp: { ...emptyTier }, whale: { ...emptyTier }, all: { ...emptyTier } },
      };
      return NextResponse.json(empty);
    }

    // Compute consensus stats for a filtered set of signals
    function computeConsensus(filtered: NonNullable<typeof signals>): TierStats {
      // Group by condition_id + side, sum bet_size
      const marketSides = new Map<string, { totalFlow: number; result: string; entries: number[] }>();
      for (const s of filtered) {
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

      // Group by condition_id, pick majority side
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

    const sharpOnly = signals.filter((s) => s.tier === "sharp");
    const whaleOnly = signals.filter((s) => s.tier === "whale");

    const sharpStats = computeConsensus(sharpOnly);
    const whaleStats = computeConsensus(whaleOnly);
    const allStats = computeConsensus(signals);

    // Find earliest signal date
    const earliest = signals.reduce((min, s) => {
      if (!s.created_at) return min;
      return !min || s.created_at < min ? s.created_at : min;
    }, null as string | null);

    // Primary display = sharp consensus (the product we're selling)
    const response: StatsResponse = {
      ...sharpStats,
      since: earliest,
      byTier: {
        sharp: sharpStats,
        whale: whaleStats,
        all: allStats,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[/api/polymarket/stats] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
