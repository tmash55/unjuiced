import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface TeamPitcher {
  player_id: number;
  name: string;
  throw_hand: string | null;
  position: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json(
      { error: "teamId is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("mlb_players_hr")
    .select("mlb_player_id, name, throw_hand, position, status")
    .eq("team_id", Number(teamId))
    .or("pos_type.eq.Pitcher,position.eq.P")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch pitchers", details: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Filter to active players and map to clean shape
  const pitchers: TeamPitcher[] = (data ?? [])
    .filter((p: any) => !p.status || p.status === "Active" || p.status === "A")
    .map((p: any) => ({
      player_id: p.mlb_player_id,
      name: p.name,
      throw_hand: p.throw_hand,
      position: p.position,
    }));

  return NextResponse.json(
    { pitchers },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200" } }
  );
}
