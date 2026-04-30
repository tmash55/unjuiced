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
import { resolveSgpTokensForLegs } from "@/lib/sgp/token-resolver";

interface EnrichRequest {
  sport: string;
  event_id: string;
  market: string;
  player_name: string;
  line: number | null;
  side: string;
  books: string[]; // Book IDs to enrich
}

export async function POST(request: NextRequest) {
  try {
    const body: EnrichRequest = await request.json();
    const { sport, event_id, market, player_name, line, side, books } = body;

    if (!sport || !event_id || !market || !books?.length) {
      return NextResponse.json({ sgp_tokens: {} });
    }

    const resolved = await resolveSgpTokensForLegs(
      [
        {
          sport,
          event_id,
          market,
          player_name,
          line,
          side,
        },
      ],
      {
        books,
        loggerPrefix: "[enrich-sgp]",
      }
    );

    const sgpTokens = resolved.legs[0]?.sgp_tokens || {};

    return NextResponse.json({ sgp_tokens: sgpTokens }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[enrich-sgp] Error:", err);
    return NextResponse.json({ sgp_tokens: {} });
  }
}
