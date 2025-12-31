import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const RequestSchema = z.object({
  playerIds: z.array(z.string()).min(1).max(500), // Max 500 player IDs per request (should be UUIDs)
});

export interface PlayerInjuryStatus {
  playerId: string; // odds_player_id (UUID)
  playerName: string;
  injuryStatus: string | null;
  injuryNotes: string | null;
}

export interface InjuryLookupResponse {
  players: PlayerInjuryStatus[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[Injury Lookup] Validation error:', parsed.error.flatten());
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerIds } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Query nba_players_hr table for injury status using odds_player_id
    const { data, error } = await supabase
      .from("nba_players_hr")
      .select("odds_player_id, name, injury_status, injury_notes")
      .in("odds_player_id", playerIds);

    if (error) {
      console.error("[Injury Lookup] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch injury data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Create a map for quick lookup by odds_player_id
    const injuryMap = new Map<string, PlayerInjuryStatus>();
    (data || []).forEach((row: any) => {
      injuryMap.set(row.odds_player_id, {
        playerId: row.odds_player_id,
        playerName: row.name,
        injuryStatus: row.injury_status,
        injuryNotes: row.injury_notes,
      });
    });

    // Return results in the same order as requested, with null for missing players
    const players: PlayerInjuryStatus[] = playerIds.map((id) => {
      return injuryMap.get(id) || {
        playerId: id,
        playerName: "", // Unknown player
        injuryStatus: null,
        injuryNotes: null,
      };
    });

    return NextResponse.json(
      { players },
      {
        headers: {
          // Cache for 2 minutes on client, 5 minutes on CDN, allow stale data for 10 minutes
          "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("[Injury Lookup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

