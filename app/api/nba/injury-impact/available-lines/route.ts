import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Get Available Lines for a Player
 * 
 * Returns all betting lines available for a player on a specific date.
 * Used to populate the market dropdown when user changes market for a specific row.
 */

const RequestSchema = z.object({
  playerId: z.number(),
  gameDate: z.string().optional().nullable(),
});

export interface AvailableLine {
  market: string;
  marketDisplay: string;
  line: number;
  overOdds: string | null;
  overOddsDecimal: number | null;
  underOdds: string | null;
  underOddsDecimal: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, gameDate } = parsed.data;

    const supabase = await createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_player_available_lines", {
      p_player_id: playerId,
      p_game_date: gameDate || null,
    });

    if (error) {
      console.error("[/api/nba/injury-impact/available-lines] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch available lines", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Transform snake_case to camelCase
    const lines: AvailableLine[] = (data || []).map((row: any) => ({
      market: row.market,
      marketDisplay: row.market_display,
      line: parseFloat(row.line),
      overOdds: row.over_odds,
      overOddsDecimal: row.over_odds_decimal ? parseFloat(row.over_odds_decimal) : null,
      underOdds: row.under_odds,
      underOddsDecimal: row.under_odds_decimal ? parseFloat(row.under_odds_decimal) : null,
    }));

    return NextResponse.json({ lines }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/injury-impact/available-lines] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

