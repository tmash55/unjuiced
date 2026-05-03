import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchPaceContextsForRows,
  getPaceContextKey,
  type BasketballLeague,
} from "@/lib/basketball/pace-context";

const QuerySchema = z.object({
  league: z.enum(["nba", "wnba"]),
  gameDate: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "gameDate must be YYYY-MM-DD"),
  teamId: z.coerce.number().int().positive(),
  opponentTeamId: z.coerce.number().int().positive(),
  gameId: z.string().optional(),
  seasonType: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    league: url.searchParams.get("league") ?? undefined,
    gameDate: url.searchParams.get("gameDate") ?? undefined,
    teamId: url.searchParams.get("teamId") ?? undefined,
    opponentTeamId: url.searchParams.get("opponentTeamId") ?? undefined,
    gameId: url.searchParams.get("gameId") ?? undefined,
    seasonType: url.searchParams.get("seasonType") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { league, gameDate, teamId, opponentTeamId, gameId, seasonType } = parsed.data;
  const row = {
    game_id: gameId ?? null,
    game_date: gameDate,
    season_type: seasonType ?? null,
    team_id: teamId,
    opponent_team_id: opponentTeamId,
  };

  const supabase = createServerSupabaseClient();
  const contexts = await fetchPaceContextsForRows(supabase, league as BasketballLeague, [row]);
  const paceContext = contexts.get(getPaceContextKey(row)) ?? null;

  return NextResponse.json(
    { paceContext },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
