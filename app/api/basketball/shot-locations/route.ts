import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z
  .object({
    sport: z.enum(["nba", "wnba"]).default("nba"),
    playerId: z.coerce.number().int().positive(),
    season: z.string().nullish().transform((v) => v || null),
    seasonType: z.string().nullish().transform((v) => v || null),
    lastNGames: z.coerce.number().int().positive().max(82).nullish().transform((v) => v ?? null),
    gameId: z.string().nullish().transform((v) => v || null),
    period: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
    half: z.coerce.number().int().min(1).max(2).nullish().transform((v) => v ?? null),
    madeFilter: z.enum(["all", "made", "missed"]).default("all"),
    limit: z.coerce.number().int().positive().max(2000).nullish().transform((v) => v ?? 750),
  })
  .refine((data) => !(data.period && data.half), {
    message: "Use either period or half, not both",
    path: ["period"],
  });

export interface BasketballShotLocation {
  id: number;
  sequence: number;
  sport: "nba" | "wnba";
  season: string;
  season_type: string;
  game_id: string;
  game_event_id: number;
  game_date: string;
  player_id: number;
  player_name: string | null;
  team_id: number | null;
  team_name: string | null;
  opponent_team_id: number | null;
  period: number | null;
  clock: {
    minutes: number | null;
    seconds: number | null;
    display: string;
  };
  event_type: string | null;
  action_type: string | null;
  shot_type: string | null;
  shot_zone_basic: string | null;
  shot_zone_area: string | null;
  shot_zone_range: string | null;
  shot_distance: number | null;
  loc_x: number | null;
  loc_y: number | null;
  shot_attempted: boolean | null;
  shot_made: boolean | null;
  htm: string | null;
  vtm: string | null;
}

export interface BasketballShotLocationSummary {
  fga: number;
  fgm: number;
  fg_pct: number | null;
  points: number;
}

export interface BasketballShotLocationBucket {
  zone?: string;
  range?: string;
  fga: number;
  fgm: number;
  fg_pct: number | null;
  points: number;
  pct_of_attempts?: number | null;
}

export interface BasketballShotLocationGameSummary extends BasketballShotLocationSummary {
  game_id: string;
  game_date: string;
  team_id: number | null;
  opponent_team_id: number | null;
}

export interface BasketballShotLocationsResponse {
  player: {
    id: number;
    name: string | null;
    team_id: number | null;
    team_name: string | null;
  };
  filters: {
    sport: "nba" | "wnba";
    season: string | null;
    season_type: string | null;
    last_n_games: number | null;
    game_id: string | null;
    period: number | null;
    half: number | null;
    made_filter: "all" | "made" | "missed";
    limit: number;
    date_from: string | null;
    date_to: string | null;
    games_returned: number;
    shots_returned: number;
  };
  summary: BasketballShotLocationSummary;
  shots: BasketballShotLocation[];
  zone_summary: BasketballShotLocationBucket[];
  range_summary: BasketballShotLocationBucket[];
  game_summary: BasketballShotLocationGameSummary[];
}

function defaultSeason(sport: "nba" | "wnba") {
  return sport === "wnba" ? "2026" : "2025-26";
}

type ShotLocationParams = z.infer<typeof QuerySchema>;
type ShotLocationRow = Omit<BasketballShotLocation, "sequence" | "clock"> & {
  minutes_remaining: number | null;
  seconds_remaining: number | null;
};

function makeClock(minutes: number | null, seconds: number | null) {
  return {
    minutes,
    seconds,
    display: `${minutes ?? 0}:${String(seconds ?? 0).padStart(2, "0")}`,
  };
}

function shotPoints(shot: Pick<BasketballShotLocation, "shot_made" | "shot_type">) {
  if (!shot.shot_made) return 0;
  return shot.shot_type === "3PT Field Goal" ? 3 : 2;
}

function summarizeShots(shots: BasketballShotLocation[]): BasketballShotLocationSummary {
  const fga = shots.length;
  const fgm = shots.filter((shot) => shot.shot_made).length;
  return {
    fga,
    fgm,
    fg_pct: fga ? Number((fgm / fga).toFixed(3)) : null,
    points: shots.reduce((sum, shot) => sum + shotPoints(shot), 0),
  };
}

function buildBucketSummary(
  shots: BasketballShotLocation[],
  key: "shot_zone_basic" | "shot_zone_range"
): BasketballShotLocationBucket[] {
  const map = new Map<string, BasketballShotLocation[]>();
  for (const shot of shots) {
    const bucket = shot[key] || "Unknown";
    if (!map.has(bucket)) map.set(bucket, []);
    map.get(bucket)!.push(shot);
  }

  return Array.from(map.entries())
    .map(([bucket, bucketShots]) => {
      const summary = summarizeShots(bucketShots);
      return {
        ...(key === "shot_zone_basic" ? { zone: bucket } : { range: bucket }),
        ...summary,
        pct_of_attempts: shots.length ? Number(((bucketShots.length * 100) / shots.length).toFixed(1)) : null,
      };
    })
    .sort((a, b) => b.fga - a.fga);
}

function buildGameSummary(shots: BasketballShotLocation[]): BasketballShotLocationGameSummary[] {
  const map = new Map<string, BasketballShotLocation[]>();
  for (const shot of shots) {
    if (!map.has(shot.game_id)) map.set(shot.game_id, []);
    map.get(shot.game_id)!.push(shot);
  }

  return Array.from(map.entries())
    .map(([gameId, gameShots]) => {
      const first = gameShots[0];
      return {
        game_id: gameId,
        game_date: first?.game_date ?? "",
        team_id: first?.team_id ?? null,
        opponent_team_id: first?.opponent_team_id ?? null,
        ...summarizeShots(gameShots),
      };
    })
    .sort((a, b) => `${a.game_date}-${a.game_id}`.localeCompare(`${b.game_date}-${b.game_id}`));
}

function transformShotRows(rows: ShotLocationRow[]): BasketballShotLocation[] {
  return rows
    .slice()
    .sort((a, b) => {
      const dateCompare = String(a.game_date).localeCompare(String(b.game_date));
      if (dateCompare) return dateCompare;
      const gameCompare = String(a.game_id).localeCompare(String(b.game_id));
      if (gameCompare) return gameCompare;
      const periodCompare = (a.period ?? 0) - (b.period ?? 0);
      if (periodCompare) return periodCompare;
      const aClock = (a.minutes_remaining ?? 0) * 60 + (a.seconds_remaining ?? 0);
      const bClock = (b.minutes_remaining ?? 0) * 60 + (b.seconds_remaining ?? 0);
      if (aClock !== bClock) return bClock - aClock;
      return (a.game_event_id ?? 0) - (b.game_event_id ?? 0);
    })
    .map((row, index) => ({
      id: row.id,
      sequence: index + 1,
      sport: row.sport,
      season: row.season,
      season_type: row.season_type,
      game_id: row.game_id,
      game_event_id: row.game_event_id,
      game_date: row.game_date,
      player_id: row.player_id,
      player_name: row.player_name,
      team_id: row.team_id,
      team_name: row.team_name,
      opponent_team_id: row.opponent_team_id,
      period: row.period,
      clock: makeClock(row.minutes_remaining, row.seconds_remaining),
      event_type: row.event_type,
      action_type: row.action_type,
      shot_type: row.shot_type,
      shot_zone_basic: row.shot_zone_basic,
      shot_zone_area: row.shot_zone_area,
      shot_zone_range: row.shot_zone_range,
      shot_distance: row.shot_distance,
      loc_x: row.loc_x,
      loc_y: row.loc_y,
      shot_attempted: row.shot_attempted,
      shot_made: row.shot_made,
      htm: row.htm,
      vtm: row.vtm,
    }));
}

async function fetchShotLocationsDirect(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  params: ShotLocationParams,
  shotPlayerId: number
): Promise<BasketballShotLocationsResponse> {
  const selectColumns =
    "id,sport,season,season_type,game_id,game_event_id,game_date,player_id,player_name,team_id,team_name,opponent_team_id,period,minutes_remaining,seconds_remaining,event_type,action_type,shot_type,shot_zone_basic,shot_zone_area,shot_zone_range,shot_distance,loc_x,loc_y,shot_attempted,shot_made,htm,vtm";

  let gameIds: string[] | null = null;
  if (!params.gameId && params.lastNGames) {
    let gamesQuery = supabase
      .from("basketball_player_shot_locations")
      .select("game_id,game_date")
      .eq("sport", params.sport)
      .eq("player_id", shotPlayerId)
      .order("game_date", { ascending: false })
      .order("game_id", { ascending: false })
      .limit(2000);

    if (params.season) gamesQuery = gamesQuery.eq("season", params.season);
    if (params.seasonType) gamesQuery = gamesQuery.eq("season_type", params.seasonType);

    const { data: gameRows, error: gameError } = await gamesQuery;
    if (gameError) throw gameError;

    gameIds = [];
    for (const row of gameRows ?? []) {
      const gameId = String(row.game_id);
      if (!gameIds.includes(gameId)) gameIds.push(gameId);
      if (gameIds.length >= params.lastNGames) break;
    }
  }

  let shotQuery = supabase
    .from("basketball_player_shot_locations")
    .select(selectColumns)
    .eq("sport", params.sport)
    .eq("player_id", shotPlayerId)
    .order("game_date", { ascending: false })
    .order("game_id", { ascending: false })
    .order("period", { ascending: false })
    .order("game_event_id", { ascending: false })
    .limit(params.limit);

  if (params.season) shotQuery = shotQuery.eq("season", params.season);
  if (params.seasonType) shotQuery = shotQuery.eq("season_type", params.seasonType);
  if (params.gameId) shotQuery = shotQuery.eq("game_id", params.gameId);
  if (gameIds) {
    if (gameIds.length === 0) {
      return buildEmptyResponse(params);
    }
    shotQuery = shotQuery.in("game_id", gameIds);
  }
  if (params.period) shotQuery = shotQuery.eq("period", params.period);
  if (params.half === 1) shotQuery = shotQuery.in("period", [1, 2]);
  if (params.half === 2) shotQuery = shotQuery.in("period", [3, 4]);
  if (params.madeFilter === "made") shotQuery = shotQuery.eq("shot_made", true);
  if (params.madeFilter === "missed") shotQuery = shotQuery.eq("shot_made", false);

  const { data: shotRows, error: shotError } = await shotQuery;
  if (shotError) throw shotError;

  const shots = transformShotRows((shotRows ?? []) as ShotLocationRow[]);
  const firstShot = shots[0];
  const summary = summarizeShots(shots);

  return {
    player: {
      id: params.playerId,
      name: firstShot?.player_name ?? null,
      team_id: firstShot?.team_id ?? null,
      team_name: firstShot?.team_name ?? null,
    },
    filters: {
      sport: params.sport,
      season: params.season,
      season_type: params.seasonType,
      last_n_games: params.lastNGames,
      game_id: params.gameId,
      period: params.period,
      half: params.half,
      made_filter: params.madeFilter,
      limit: params.limit,
      date_from: shots[0]?.game_date ?? null,
      date_to: shots[shots.length - 1]?.game_date ?? null,
      games_returned: new Set(shots.map((shot) => shot.game_id)).size,
      shots_returned: shots.length,
    },
    summary,
    shots,
    zone_summary: buildBucketSummary(shots, "shot_zone_basic"),
    range_summary: buildBucketSummary(shots, "shot_zone_range"),
    game_summary: buildGameSummary(shots),
  };
}

function buildEmptyResponse(params: ShotLocationParams): BasketballShotLocationsResponse {
  return {
    player: {
      id: params.playerId,
      name: null,
      team_id: null,
      team_name: null,
    },
    filters: {
      sport: params.sport,
      season: params.season,
      season_type: params.seasonType,
      last_n_games: params.lastNGames,
      game_id: params.gameId,
      period: params.period,
      half: params.half,
      made_filter: params.madeFilter,
      limit: params.limit,
      date_from: null,
      date_to: null,
      games_returned: 0,
      shots_returned: 0,
    },
    summary: { fga: 0, fgm: 0, fg_pct: null, points: 0 },
    shots: [],
    zone_summary: [],
    range_summary: [],
    game_summary: [],
  };
}

async function resolveShotPlayerId(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  params: ShotLocationParams
) {
  if (params.sport !== "wnba") {
    return params.playerId;
  }

  const { data, error } = await supabase
    .from("wnba_players_hr")
    .select("nba_player_id")
    .eq("wnba_player_id", params.playerId)
    .maybeSingle();

  if (error) {
    console.warn("[/api/basketball/shot-locations] WNBA player id lookup failed:", error.message);
    return params.playerId;
  }

  const statsPlayerId = Number(data?.nba_player_id);
  return Number.isFinite(statsPlayerId) && statsPlayerId > 0 ? statsPlayerId : params.playerId;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSport = searchParams.get("sport") ?? "nba";
    const parsed = QuerySchema.safeParse({
      sport: rawSport,
      playerId: searchParams.get("playerId"),
      season: searchParams.get("season") ?? defaultSeason(rawSport === "wnba" ? "wnba" : "nba"),
      seasonType: searchParams.get("seasonType") ?? "Regular Season",
      lastNGames: searchParams.get("lastNGames") ?? null,
      gameId: searchParams.get("gameId") ?? null,
      period: searchParams.get("period") ?? null,
      half: searchParams.get("half") ?? null,
      madeFilter: searchParams.get("madeFilter") ?? "all",
      limit: searchParams.get("limit") ?? "750",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const params = parsed.data;
    const supabase = createServerSupabaseClient();
    const shotPlayerId = await resolveShotPlayerId(supabase, params);

    const { data, error } = await supabase.rpc("get_basketball_shot_locations", {
      p_sport: params.sport,
      p_player_id: shotPlayerId,
      p_season: params.season,
      p_season_type: params.seasonType,
      p_last_n_games: params.lastNGames,
      p_game_id: params.gameId,
      p_period: params.period,
      p_half: params.half,
      p_made_filter: params.madeFilter,
      p_limit: params.limit,
    });

    if (error) {
      console.warn("[/api/basketball/shot-locations] RPC unavailable, using direct query:", error.message);
      const fallbackData = await fetchShotLocationsDirect(supabase, params, shotPlayerId);
      return NextResponse.json(fallbackData, {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
          "X-Shot-Locations-Source": "direct",
        },
      });
    }

    const responseData = data as BasketballShotLocationsResponse;
    if (responseData?.player) {
      responseData.player.id = params.playerId;
    }

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "X-Shot-Locations-Source": "rpc",
      },
    });
  } catch (error: any) {
    console.error("[/api/basketball/shot-locations] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
