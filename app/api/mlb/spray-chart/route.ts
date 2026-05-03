import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
  playerType: z.enum(["batter", "pitcher"]).optional().default("batter"),
  seasons: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map(Number)
            .filter((n) => Number.isFinite(n) && n > 2000)
        : undefined
    ),
  minExitVelo: z.coerce.number().optional(),
  gameId: z.coerce.number().int().positive().optional(),
  eventId: z.string().trim().min(1).optional(),
});

// ─── Exported Interfaces ──────────────────────────────────────────────────────

export interface BattedBallEvent {
  id: number | null;
  game_id: number | null;
  inning: number | null;
  batter_id: number | null;
  batter_name: string | null;
  batter_hand: string | null;
  pitcher_id: number | null;
  pitcher_name: string | null;
  pitcher_hand: string | null;
  pitch_type: string | null;
  pitch_speed: number | null;
  coord_x: number | null;
  coord_y: number | null;
  exit_velocity: number | null;
  launch_angle: number | null;
  hit_distance: number | null;
  trajectory: string | null;
  result: string | null;
  event_type: string | null;
  is_hit: boolean | null;
  is_barrel: boolean | null;
  is_hard_hit: boolean | null;
  hardness: string | null;
  zone: string | null;
  season: number | null;
  game_date: string | null;
}

export interface ZoneSummary {
  zone: string;
  count: number;
  hits: number;
  avg: number | null;
  hr: number;
}

export interface TrajectorySummary {
  trajectory: string;
  count: number;
  pct: number;
}

export interface HardContactSummary {
  count: number;
  avg: number | null;
  hr: number;
  barrels: number;
  avg_ev: number | null;
  avg_distance: number | null;
}

export interface StadiumGeometry {
  outfieldOuter: unknown[];
  outfieldInner: unknown[];
  infieldOuter: unknown[];
  infieldInner: unknown[];
  foulLines: unknown[];
  homePlate: unknown[];
  fieldDistances?: {
    leftLine: number | null;
    leftCenter: number | null;
    centerField: number | null;
    rightCenter: number | null;
    rightLine: number | null;
  };
  season: number | null;
}

export interface MlbSprayChartResponse {
  events: BattedBallEvent[];
  zone_summary: ZoneSummary[];
  trajectory_summary: TrajectorySummary[];
  hard_contact: HardContactSummary | null;
  stadium_geometry: StadiumGeometry | null;
}

const MLBAM_HP_X = 125.42;
const MLBAM_HP_Y = 199.27;
const FAIR_START = Math.PI * 0.25;
const FAIR_END = Math.PI * 0.75;
const ZONE_STEP = (FAIR_END - FAIR_START) / 5;
const ZONE_ORDER_RHB = ["oppo", "oppo_center", "center", "pull_center", "pull"] as const;
const ZONE_ORDER_LHB = ["pull", "pull_center", "center", "oppo_center", "oppo"] as const;

function inferBattedBallZone(coordX: number | null | undefined, coordY: number | null | undefined, batterHand: string | null | undefined) {
  if (coordX == null || coordY == null) return null;
  const angle = Math.atan2(MLBAM_HP_Y - Number(coordY), Number(coordX) - MLBAM_HP_X);
  if (!Number.isFinite(angle)) return null;

  const order = String(batterHand ?? "").toUpperCase().startsWith("L") ? ZONE_ORDER_LHB : ZONE_ORDER_RHB;
  const clamped = Math.max(FAIR_START, Math.min(FAIR_END - 0.0001, angle));
  const index = Math.floor((clamped - FAIR_START) / ZONE_STEP);
  return order[index] ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      playerType: searchParams.get("playerType") ?? undefined,
      seasons: searchParams.get("seasons") ?? undefined,
      minExitVelo: searchParams.get("minExitVelo") ?? undefined,
      gameId: searchParams.get("gameId") ?? undefined,
      eventId: searchParams.get("eventId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, playerType, seasons, minExitVelo, gameId, eventId } = parsed.data;
    const supabase = createServerSupabaseClient();

    // ── Fetch spray chart data via RPC ──
    let data: any = {};
    if (playerType === "batter") {
      const rpcParams: Record<string, unknown> = { p_player_id: playerId };
      if (seasons && seasons.length > 0) rpcParams.p_seasons = seasons;
      if (minExitVelo != null) rpcParams.p_min_exit_velo = minExitVelo;

      const rpcResult = await supabase.rpc("get_mlb_spray_chart", rpcParams);

      if (rpcResult.error) {
        return NextResponse.json(
          { error: "Failed to fetch MLB spray chart", details: rpcResult.error.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      data = rpcResult.data ?? {};
    }

    // ── Fetch stadium geometry from MLB game id or live odds event id ──
    let stadiumGeometry: StadiumGeometry | null = null;

    if (gameId || eventId) {
      let gameQuery = supabase
        .from("mlb_games")
        .select("venue_id")
        .limit(1);

      gameQuery = gameId
        ? gameQuery.eq("game_id", gameId)
        : gameQuery.eq("odds_game_id", eventId);

      const { data: gameData } = await gameQuery.maybeSingle();

      const venueId = gameData?.venue_id ? Number(gameData.venue_id) : null;

      if (venueId && Number.isFinite(venueId)) {
        const [geometriesResult, venueResult] = await Promise.all([
          supabase
            .from("mlb_stadium_geometries")
            .select(
              "venue_id, season, outfield_outer, outfield_inner, infield_outer, infield_inner, foul_lines, home_plate"
            )
            .eq("venue_id", venueId)
            .order("season", { ascending: false })
            .limit(1),
          supabase
            .from("mlb_venues")
            .select("left_line, left_center, center_field, right_center, right_line")
            .eq("venue_id", venueId)
            .maybeSingle(),
        ]);

        const geometries = geometriesResult.data;
        const venue = venueResult.data;
        if (geometries && geometries.length > 0) {
          const g = geometries[0];
          stadiumGeometry = {
            outfieldOuter: g.outfield_outer ?? [],
            outfieldInner: g.outfield_inner ?? [],
            infieldOuter: g.infield_outer ?? [],
            infieldInner: g.infield_inner ?? [],
            foulLines: g.foul_lines ?? [],
            homePlate: g.home_plate ?? [],
            fieldDistances: {
              leftLine: venue?.left_line != null ? Number(venue.left_line) : null,
              leftCenter: venue?.left_center != null ? Number(venue.left_center) : null,
              centerField: venue?.center_field != null ? Number(venue.center_field) : null,
              rightCenter: venue?.right_center != null ? Number(venue.right_center) : null,
              rightLine: venue?.right_line != null ? Number(venue.right_line) : null,
            },
            season: g.season ?? null,
          };
        }
      }
    }

    const raw = data ?? {};
    const toArray = (v: unknown): unknown[] =>
      Array.isArray(v) ? v : typeof v === "string" ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];

    // Query the source table for richer event-level details used by the modal BIP table.
    let directBalls: any[] | null = null;
    let directQuery = supabase
      .from("mlb_batted_balls")
      .select(
        "id, game_id, season, game_date, inning, batter_id, batter_hand, pitcher_id, pitcher_hand, coord_x, coord_y, exit_velocity, launch_angle, total_distance, trajectory, hardness, pitch_type, pitch_speed, event, event_type, is_hit, is_barrel"
      )
      .eq(playerType === "pitcher" ? "pitcher_id" : "batter_id", playerId)
      .not("coord_x", "is", null)
      .not("coord_y", "is", null)
      .order("game_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);

    if (seasons && seasons.length > 0) {
      directQuery = directQuery.in("season", seasons);
    }
    if (minExitVelo != null) {
      directQuery = directQuery.gte("exit_velocity", minExitVelo);
    }

    const { data: directData, error: directError } = await directQuery;
    if (!directError && Array.isArray(directData) && directData.length > 0) {
      directBalls = directData;
    } else if (playerType === "pitcher" && !directError) {
      directBalls = [];
    }

    const playerNameMap = new Map<number, string>();
    const missingPlayerIds = new Set<number>();
    for (const bb of directBalls ?? []) {
      if (bb.pitcher_id) missingPlayerIds.add(Number(bb.pitcher_id));
      if (bb.batter_id) missingPlayerIds.add(Number(bb.batter_id));
    }
    if (missingPlayerIds.size > 0) {
      const { data: playerRows } = await supabase
        .from("mlb_players")
        .select("player_id, full_name")
        .in("player_id", Array.from(missingPlayerIds));

      for (const player of playerRows ?? []) {
        if (player.player_id && player.full_name) {
          playerNameMap.set(Number(player.player_id), player.full_name);
        }
      }
    }

    // RPC returns `batted_balls` — map to our `BattedBallEvent` shape when direct rows are unavailable.
    const rawBalls = toArray(raw.batted_balls);
    const sourceBalls = directBalls ?? rawBalls;
    const events: BattedBallEvent[] = sourceBalls.map((bb: any) => ({
      id: bb.id != null ? Number(bb.id) : null,
      game_id: bb.game_id != null ? Number(bb.game_id) : null,
      inning: bb.inning != null ? Number(bb.inning) : null,
      batter_id: bb.batter_id != null ? Number(bb.batter_id) : null,
      batter_name: bb.batter_id ? playerNameMap.get(Number(bb.batter_id)) ?? null : null,
      batter_hand: bb.batter_hand ?? null,
      pitcher_id: bb.pitcher_id != null ? Number(bb.pitcher_id) : null,
      pitcher_name: bb.pitcher_id ? playerNameMap.get(Number(bb.pitcher_id)) ?? null : null,
      pitcher_hand: bb.pitcher_hand ?? null,
      pitch_type: bb.pitch_type ?? null,
      pitch_speed: bb.pitch_speed != null ? Number(bb.pitch_speed) : null,
      coord_x: bb.coord_x ?? null,
      coord_y: bb.coord_y ?? null,
      exit_velocity: bb.exit_velocity ?? null,
      launch_angle: bb.launch_angle ?? null,
      hit_distance: bb.total_distance ?? bb.hit_distance ?? null,
      trajectory: bb.trajectory ?? null,
      result: bb.event ?? bb.result ?? null,
      event_type: bb.event_type ?? bb.event ?? bb.result ?? null,
      is_hit: bb.is_hit ?? null,
      is_barrel: bb.is_barrel ?? null,
      is_hard_hit: bb.hardness === "hard" || (bb.exit_velocity != null && bb.exit_velocity >= 95),
      hardness: bb.hardness ?? null,
      zone: bb.zone ?? inferBattedBallZone(bb.coord_x, bb.coord_y, bb.batter_hand),
      season: bb.season ?? null,
      game_date: bb.game_date ?? null,
    }));

    // RPC hard_contact uses different field names
    const rawHc = raw.hard_contact;
    const hardContact: HardContactSummary | null =
      rawHc && typeof rawHc === "object"
        ? {
            count: rawHc.count ?? 0,
            avg: rawHc.avg ?? (rawHc.hit_count != null && rawHc.count ? rawHc.hit_count / rawHc.count : null),
            hr: rawHc.hr ?? rawHc.hr_count ?? 0,
            barrels: rawHc.barrels ?? rawHc.barrel_count ?? 0,
            avg_ev: rawHc.avg_ev ?? rawHc.avg_exit_velo ?? null,
            avg_distance: rawHc.avg_distance ?? null,
          }
        : null;

    // RPC returns zone_summary as a flat object
    const zoneNames = ["pull", "pull_center", "center", "oppo_center", "oppo"] as const;
    const rawZone = raw.zone_summary && typeof raw.zone_summary === "object" ? raw.zone_summary : {};
    const zoneSummary: ZoneSummary[] = zoneNames
      .map((zone) => {
        const count = Number(rawZone[zone]) || 0;
        return { zone, count, hits: 0, avg: null, hr: 0 };
      })
      .filter((z) => z.count > 0);

    // RPC returns trajectory_summary as a flat object
    const trajNames = ["ground_ball", "line_drive", "fly_ball", "popup"] as const;
    const trajPctKeys: Record<string, string> = { ground_ball: "gb_pct", line_drive: "ld_pct", fly_ball: "fb_pct", popup: "popup_pct" };
    const rawTraj = raw.trajectory_summary && typeof raw.trajectory_summary === "object" ? raw.trajectory_summary : {};
    const trajSummary: TrajectorySummary[] = trajNames
      .map((trajectory) => {
        const count = Number(rawTraj[trajectory]) || 0;
        const pct = Number(rawTraj[trajPctKeys[trajectory]]) || 0;
        return { trajectory, count, pct };
      })
      .filter((t) => t.count > 0);

    const response: MlbSprayChartResponse = {
      events,
      zone_summary: zoneSummary,
      trajectory_summary: trajSummary,
      hard_contact: hardContact,
      stadium_geometry: stadiumGeometry,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
