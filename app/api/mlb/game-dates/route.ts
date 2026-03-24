import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const maxDate = new Date(new Date(from + "T00:00:00").getTime() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);

  const sb = createServerSupabaseClient();
  const { data } = await sb
    .from("mlb_games")
    .select("game_date")
    .gte("game_date", from)
    .lte("game_date", maxDate)
    .order("game_date", { ascending: true });

  const dates = [...new Set((data ?? []).map((r: any) => r.game_date as string))];

  return NextResponse.json(
    { dates },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
