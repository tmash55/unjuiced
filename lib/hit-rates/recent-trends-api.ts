import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";

type RecentTrendSport = "nba" | "wnba";

const QuerySchema = z.object({
  playerIds: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).nullish().transform((value) => value ?? 10),
  season: z.string().nullish(),
});

const RPC_BY_SPORT: Record<RecentTrendSport, string> = {
  nba: "get_player_box_scores",
  wnba: "get_wnba_player_box_scores",
};

const DEFAULT_SEASON_BY_SPORT: Record<RecentTrendSport, string | null> = {
  nba: "2025-26",
  wnba: null,
};

function parsePlayerIds(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  ).slice(0, 60);
}

function mapGame(game: any) {
  return {
    gameId: String(game.game_id ?? ""),
    date: String(game.date ?? ""),
    seasonType: String(game.season_type ?? ""),
    homeAway: game.home_away === "H" ? "H" : "A",
    opponentTeamId: Number(game.opponent_team_id ?? 0),
    opponentAbbr: String(game.opponent_abbr ?? ""),
    opponentName: String(game.opponent_name ?? ""),
    result: game.result === "W" ? "W" : "L",
    margin: Number(game.margin ?? 0),
    teamScore: Number(game.team_score ?? 0),
    opponentScore: Number(game.opponent_score ?? 0),
    minutes: Number(game.minutes ?? 0),
    pts: Number(game.pts ?? 0),
    reb: Number(game.reb ?? 0),
    ast: Number(game.ast ?? 0),
    stl: Number(game.stl ?? 0),
    blk: Number(game.blk ?? 0),
    tov: Number(game.tov ?? 0),
    fouls: Number(game.fouls ?? 0),
    fgm: Number(game.fgm ?? 0),
    fga: Number(game.fga ?? 0),
    fgPct: Number(game.fg_pct ?? 0),
    fg3m: Number(game.fg3m ?? 0),
    fg3a: Number(game.fg3a ?? 0),
    fg3Pct: Number(game.fg3_pct ?? 0),
    ftm: Number(game.ftm ?? 0),
    fta: Number(game.fta ?? 0),
    ftPct: Number(game.ft_pct ?? 0),
    oreb: Number(game.oreb ?? 0),
    dreb: Number(game.dreb ?? 0),
    plusMinus: Number(game.plus_minus ?? 0),
    usagePct: Number(game.usage_pct ?? 0),
    tsPct: Number(game.ts_pct ?? 0),
    efgPct: Number(game.efg_pct ?? 0),
    offRating: Number(game.off_rating ?? 0),
    defRating: Number(game.def_rating ?? 0),
    netRating: Number(game.net_rating ?? 0),
    pace: Number(game.pace ?? 0),
    pie: Number(game.pie ?? 0),
    passes: Number(game.passes ?? 0),
    potentialReb: Number(game.potential_reb ?? 0),
    potentialAssists: null as number | null, // hydrated after RPC via separate select
    pra: Number(game.pra ?? 0),
    pr: Number(game.pr ?? 0),
    pa: Number(game.pa ?? 0),
    ra: Number(game.ra ?? 0),
    bs: Number(game.bs ?? 0),
    q1Pts: undefined as number | undefined,
    q1Reb: undefined as number | undefined,
    q1Ast: undefined as number | undefined,
  };
}

const PERIOD_TABLE_BY_SPORT: Record<RecentTrendSport, string> = {
  nba: "nba_player_period_box_scores",
  wnba: "wnba_player_period_box_scores",
};

export async function handleRecentTrends(req: NextRequest, sport: RecentTrendSport) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerIds: searchParams.get("playerIds"),
      limit: searchParams.get("limit"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const playerIds = parsePlayerIds(parsed.data.playerIds);
    if (playerIds.length === 0) {
      return NextResponse.json({ trends: {} }, { headers: { "Cache-Control": "no-store" } });
    }

    const supabase = createServerSupabaseClient();
    const rpcName = RPC_BY_SPORT[sport];
    const season = parsed.data.season ?? DEFAULT_SEASON_BY_SPORT[sport];

    const entries = await Promise.all(
      playerIds.map(async (playerId) => {
        const { data, error } = await supabase.rpc(rpcName, {
          p_player_id: playerId,
          p_season: season,
          p_limit: parsed.data.limit,
        });

        if (error) {
          console.error(`[${sport} recent-trends] RPC error for player ${playerId}:`, error.message);
          return [String(playerId), []] as const;
        }

        const games = Array.isArray(data?.games) ? data.games.map(mapGame) : [];
        return [String(playerId), games] as const;
      })
    );

    // Hydrate Q1 stats so the table's recent-trend bars for 1st_quarter_*
    // markets render real first-quarter values instead of falling back to
    // full-game totals. Both sports keep these in `{sport}_player_period_box_scores`.
    {
      const periodTable = PERIOD_TABLE_BY_SPORT[sport];
      const flatGameIds = [
        ...new Set(
          entries.flatMap(([, games]) =>
            games
              .map((g: { gameId: string }) => Number(g.gameId))
              .filter((id: number) => Number.isFinite(id) && id > 0)
          )
        ),
      ];
      if (flatGameIds.length > 0 && playerIds.length > 0) {
        const { data: q1Data, error: q1Error } = await supabase
          .from(periodTable)
          .select("player_id, game_id, pts, reb, ast")
          .eq("period", 1)
          .in("player_id", playerIds)
          .in("game_id", flatGameIds);

        if (q1Error) {
          console.error(`[${sport} recent-trends] Q1 lookup error:`, q1Error.message);
        } else if (q1Data) {
          const q1Map = new Map<string, { pts: number; reb: number; ast: number }>();
          for (const row of q1Data as Array<{
            player_id: number;
            game_id: number | string;
            pts: number | null;
            reb: number | null;
            ast: number | null;
          }>) {
            q1Map.set(`${row.player_id}:${row.game_id}`, {
              pts: Number(row.pts ?? 0),
              reb: Number(row.reb ?? 0),
              ast: Number(row.ast ?? 0),
            });
          }
          for (const [pid, games] of entries) {
            for (const g of games) {
              const q1 = q1Map.get(`${pid}:${g.gameId}`);
              if (q1) {
                g.q1Pts = q1.pts;
                g.q1Reb = q1.reb;
                g.q1Ast = q1.ast;
              }
            }
          }
        }
      }
    }

    // NBA only: hydrate potential_assists from the box-score table (the RPC doesn't
    // return it). WNBA box scores don't track these advanced fields, so we skip the
    // fetch entirely and let the tooltip gracefully omit those rows.
    if (sport === "nba") {
      const flatGameIds = [
        ...new Set(
          entries.flatMap(([, games]) =>
            games
              .map((g: { gameId: string }) => Number(g.gameId))
              .filter((id: number) => Number.isFinite(id) && id > 0)
          )
        ),
      ];
      if (flatGameIds.length > 0 && playerIds.length > 0) {
        const { data: paData, error: paError } = await supabase
          .from("nba_player_box_scores")
          .select("player_id, game_id, potential_assists")
          .in("player_id", playerIds)
          .in("game_id", flatGameIds);

        if (paError) {
          console.error(`[nba recent-trends] Potential assists lookup error:`, paError.message);
        } else if (paData) {
          const paMap = new Map<string, number>();
          for (const row of paData) {
            if (row.potential_assists !== null && row.potential_assists !== undefined) {
              paMap.set(`${row.player_id}:${row.game_id}`, Number(row.potential_assists));
            }
          }
          for (const [pid, games] of entries) {
            for (const g of games) {
              const value = paMap.get(`${pid}:${g.gameId}`);
              if (value !== undefined) g.potentialAssists = value;
            }
          }
        }
      }
    }

    return NextResponse.json(
      { trends: Object.fromEntries(entries) },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error(`[${sport} recent-trends] Error:`, error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
