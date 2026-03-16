import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/polymarket/price-chart?token_id=xxx
 * Proxies Polymarket CLOB price history
 */
export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("token_id");
  if (!tokenId) {
    return NextResponse.json({ error: "token_id required" }, { status: 400 });
  }

  try {
    const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=1h&fidelity=5`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const data = await res.json();
    // data.history is array of {t, p}
    return NextResponse.json(
      { history: data.history ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
