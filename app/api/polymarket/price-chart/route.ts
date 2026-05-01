import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/polymarket/price-chart?token_id=xxx
 * Proxies Polymarket CLOB price history
 */
export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("token_id");
  const interval = req.nextUrl.searchParams.get("interval") || "all";
  if (!tokenId) {
    return NextResponse.json({ error: "token_id required" }, { status: 400 });
  }

  // Map our intervals to Polymarket CLOB params
  // CLOB supports: 1h, 6h, 1d, 1w, 1m, all
  const validIntervals = ["1h", "6h", "1d", "1w", "1m", "all"];
  const clobInterval = validIntervals.includes(interval) ? interval : "all";
  // Use higher fidelity for shorter timeframes
  const fidelity = ["1h", "6h"].includes(clobInterval) ? 1 : clobInterval === "1d" ? 5 : 10;
  const cacheTtl = ["1h", "6h"].includes(clobInterval) ? 60 : 300;

  try {
    const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=${clobInterval}&fidelity=${fidelity}`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const data = await res.json();
    // data.history is array of {t, p}
    return NextResponse.json(
      { history: data.history ?? [] },
      { headers: { "Cache-Control": `public, s-maxage=${cacheTtl}, stale-while-revalidate=60` } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
