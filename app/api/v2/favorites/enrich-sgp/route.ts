/**
 * POST /api/v2/favorites/enrich-sgp
 *
 * Called at save-time (when user clicks heart) to fetch live SGP tokens
 * from Redis for all books in a single opportunity. Returns enriched
 * books_snapshot with SGP tokens populated.
 *
 * This keeps the hot path (opportunities API) fast and only does the
 * extra Redis work when the user explicitly saves a favorite.
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

interface EnrichRequest {
  sport: string;
  event_id: string;
  market: string;
  player_name: string;
  line: number | null;
  side: string;
  books: string[]; // Book IDs to enrich
}

interface SSESelection {
  player: string;
  line: number;
  side: string;
  price: string;
  price_decimal: number;
  sgp?: string;
  link?: string;
  mobile_link?: string;
  locked?: boolean;
}

function normalizePlayerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  try {
    const body: EnrichRequest = await request.json();
    const { sport, event_id, market, player_name, line, side, books } = body;

    if (!sport || !event_id || !market || !books?.length) {
      return NextResponse.json({ sgp_tokens: {} });
    }

    // Build Redis keys for all requested books
    const redisKeys = books.map((bookId) => `odds:${sport}:${event_id}:${market}:${bookId}`);

    // Single batch fetch
    const values = await redis.mget<(string | Record<string, any> | null)[]>(...redisKeys);

    const sgpTokens: Record<string, string> = {};
    const playerNorm = normalizePlayerName(player_name || "");

    for (let i = 0; i < values.length; i++) {
      const raw = values[i];
      if (!raw) continue;

      const data: Record<string, SSESelection> =
        typeof raw === "string" ? JSON.parse(raw) : raw;
      const bookId = books[i];

      // Find matching selection by player + line + side
      for (const sel of Object.values(data)) {
        if (!sel || typeof sel !== "object" || !sel.sgp) continue;

        const selPlayer = normalizePlayerName(sel.player || "");
        if (!selPlayer.includes(playerNorm) && !playerNorm.includes(selPlayer)) continue;
        if (line != null && sel.line !== line) continue;
        if (sel.side !== side) continue;

        sgpTokens[bookId] = sel.sgp;
        break;
      }
    }

    return NextResponse.json({ sgp_tokens: sgpTokens }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[enrich-sgp] Error:", err);
    return NextResponse.json({ sgp_tokens: {} });
  }
}
