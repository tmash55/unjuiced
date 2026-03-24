"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
  type: z.enum(["batter", "pitcher", "all"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
});

export interface MlbPlayerSearchResult {
  player_id: number;
  name: string;
  team_abbr: string | null;
  team_name: string | null;
  position: string | null;
}

export interface MlbPlayerSearchResponse {
  players: MlbPlayerSearchResult[];
  query: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      q: searchParams.get("q"),
      type: searchParams.get("type") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { q, type, limit } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Search mlb_players_hr table — use ilike for case-insensitive search
    let query = supabase
      .from("mlb_players_hr")
      .select("mlb_player_id, name, odds_team_abbr, odds_team_name, position")
      .ilike("name", `%${q}%`)
      .limit(limit);

    // Filter by position if type is specified
    if (type === "pitcher") {
      query = query.eq("position", "P");
    } else if (type === "batter") {
      query = query.neq("position", "P");
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/mlb/player-search] Error:", error.message);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const players: MlbPlayerSearchResult[] = (data ?? []).map((row: any) => ({
      player_id: row.mlb_player_id,
      name: row.name,
      team_abbr: row.odds_team_abbr || null,
      team_name: row.odds_team_name || null,
      position: row.position || null,
    }));

    return NextResponse.json(
      { players, query: q } as MlbPlayerSearchResponse,
      { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200" } }
    );
  } catch (error: any) {
    console.error("[/api/mlb/player-search] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
