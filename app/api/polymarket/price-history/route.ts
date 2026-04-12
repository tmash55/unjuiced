import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const TIME_CUTOFFS: Record<string, number> = {
  "1h":  1 * 60 * 60 * 1000,
  "6h":  6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d":  7 * 24 * 60 * 60 * 1000,
};

const CLOB_INTERVAL: Record<string, string> = {
  "1h":  "1h",
  "6h":  "6h",
  "24h": "1d",
  "7d":  "1w",
};

const CLOB_FIDELITY: Record<string, number> = {
  "1h":  1,
  "6h":  1,
  "24h": 5,
  "7d":  10,
};

const CACHE_TTL: Record<string, number> = {
  "1h":  20,
  "6h":  30,
  "24h": 60,
  "7d":  300,
};

/**
 * GET /api/polymarket/price-history?condition_id=xxx&timeRange=24h
 *
 * Returns:
 *  - history:      [{t: epoch_seconds, p: 0-1}]  — CLOB price series (or signal-derived)
 *  - markers:      [{t: epoch_ms, p: 0-1, tier, side, size, outcome}]  — sharp entries
 *  - tokenId:      primary token used for CLOB lookup
 *  - currentPrice: last history price (0-1)
 *  - priceChange:  % change from first to last history price
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const conditionId = searchParams.get("condition_id");
  const timeRange = searchParams.get("timeRange") || "24h";

  if (!conditionId) {
    return NextResponse.json({ error: "condition_id required" }, { status: 400 });
  }

  const cutoffMs = TIME_CUTOFFS[timeRange] ?? TIME_CUTOFFS["24h"];
  const cutoff = new Date(Date.now() - cutoffMs).toISOString();

  const sb = createServerSupabaseClient();

  // Fetch signals for this market within the time window
  const { data: signals, error } = await sb
    .from("polymarket_signals")
    .select("id, tier, side, entry_price, bet_size, created_at, token_id, outcome, wallet_address")
    .eq("condition_id", conditionId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 });
  }

  const signalList = signals ?? [];

  // Build structured markers from signals
  const markers = signalList.map((s) => ({
    t: new Date(s.created_at).getTime(),    // epoch ms
    p: parseFloat(s.entry_price ?? "0"),    // 0-1
    tier: s.tier ?? "burner",
    side: s.side ?? "BUY",
    size: parseFloat(s.bet_size ?? "0"),
    outcome: s.outcome ?? "",
    tokenId: s.token_id ?? null,
  }));

  // Determine the primary token_id: most frequent across signals
  const tokenCounts = new Map<string, number>();
  for (const s of signalList) {
    if (s.token_id) {
      tokenCounts.set(s.token_id, (tokenCounts.get(s.token_id) ?? 0) + 1);
    }
  }
  const primaryTokenId =
    tokenCounts.size > 0
      ? [...tokenCounts.entries()].sort(([, a], [, b]) => b - a)[0][0]
      : null;

  // Fetch CLOB price history for the primary token
  let history: { t: number; p: number }[] = [];
  if (primaryTokenId) {
    try {
      const clobInterval = CLOB_INTERVAL[timeRange] ?? "1d";
      const fidelity = CLOB_FIDELITY[timeRange] ?? 5;
      const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(primaryTokenId)}&interval=${clobInterval}&fidelity=${fidelity}`;
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (res.ok) {
        const data = await res.json();
        history = data.history ?? [];
      }
    } catch {
      // fall through to signal-derived prices below
    }
  }

  // Fallback: synthesize a sparse price series from signal entry prices
  if (history.length === 0 && signalList.length > 0) {
    history = signalList.map((s) => ({
      t: Math.floor(new Date(s.created_at).getTime() / 1000),
      p: parseFloat(s.entry_price ?? "0"),
    }));
  }

  const currentPrice = history.length > 0 ? history[history.length - 1].p : null;
  const startPrice = history.length > 0 ? history[0].p : null;
  const priceChange =
    currentPrice != null && startPrice != null && startPrice > 0
      ? ((currentPrice - startPrice) / startPrice) * 100
      : null;

  return NextResponse.json(
    { history, markers, tokenId: primaryTokenId, currentPrice, priceChange },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_TTL[timeRange] ?? 60}, stale-while-revalidate=60`,
      },
    }
  );
}
