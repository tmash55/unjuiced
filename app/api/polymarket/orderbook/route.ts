import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/polymarket/orderbook?token_id=xxx
 * Proxies Polymarket CLOB order book
 */
export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("token_id");
  if (!tokenId) {
    return NextResponse.json({ error: "token_id required" }, { status: 400 });
  }

  try {
    const url = `https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`;
    const res = await fetch(url, { next: { revalidate: 30 } });

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const data = await res.json();

    // Normalize bids/asks to numbers for frontend
    const bids = (data.bids ?? []).map((b: { price: string; size: string }) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    const asks = (data.asks ?? []).map((a: { price: string; size: string }) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));

    const lastTradePrice = data.last_trade_price ? parseFloat(data.last_trade_price) : null;
    const spread = bids.length > 0 && asks.length > 0
      ? asks[0].price - bids[0].price
      : null;

    return NextResponse.json(
      { bids, asks, spread, lastTradePrice },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=10" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch order book" }, { status: 500 });
  }
}
