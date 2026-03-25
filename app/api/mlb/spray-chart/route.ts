import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z.object({
  playerId: z.coerce.number().int().positive(),
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
});

// ─── Exported Interfaces ──────────────────────────────────────────────────────

export interface BattedBallEvent {
  coord_x: number | null;
  coord_y: number | null;
  exit_velocity: number | null;
  launch_angle: number | null;
  hit_distance: number | null;
  trajectory: string | null;
  result: string | null;
  is_barrel: boolean | null;
  is_hard_hit: boolean | null;
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
  season: number | null;
}

export interface MlbSprayChartResponse {
  events: BattedBallEvent[];
  zone_summary: ZoneSummary[];
  trajectory_summary: TrajectorySummary[];
  hard_contact: HardContactSummary | null;
  stadium_geometry: StadiumGeometry | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      playerId: searchParams.get("playerId"),
      seasons: searchParams.get("seasons") ?? undefined,
      minExitVelo: searchParams.get("minExitVelo") ?? undefined,
      gameId: searchParams.get("gameId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, seasons, minExitVelo, gameId } = parsed.data;
    const supabase = createServerSupabaseClient();

    // ── Fetch spray chart data via RPC ──
    const rpcParams: Record<string, unknown> = { p_player_id: playerId };
    if (seasons && seasons.length > 0) rpcParams.p_seasons = seasons;
    if (minExitVelo != null) rpcParams.p_min_exit_velo = minExitVelo;

    const { data, error } = await supabase.rpc("get_mlb_spray_chart", rpcParams);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch MLB spray chart", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Fetch stadium geometry if gameId provided ──
    let stadiumGeometry: StadiumGeometry | null = null;

    if (gameId) {
      const { data: gameData } = await supabase
        .from("mlb_games")
        .select("venue_id")
        .eq("game_id", gameId)
        .single();

      const venueId = gameData?.venue_id ? Number(gameData.venue_id) : null;

      if (venueId && Number.isFinite(venueId)) {
        const { data: geometries } = await supabase
          .from("mlb_stadium_geometries")
          .select(
            "venue_id, season, outfield_outer, outfield_inner, infield_outer, infield_inner, foul_lines, home_plate"
          )
          .eq("venue_id", venueId)
          .order("season", { ascending: false })
          .limit(1);

        if (geometries && geometries.length > 0) {
          const g = geometries[0];
          stadiumGeometry = {
            outfieldOuter: g.outfield_outer ?? [],
            outfieldInner: g.outfield_inner ?? [],
            infieldOuter: g.infield_outer ?? [],
            infieldInner: g.infield_inner ?? [],
            foulLines: g.foul_lines ?? [],
            homePlate: g.home_plate ?? [],
            season: g.season ?? null,
          };
        }
      }
    }

    const raw = data ?? {};
    const toArray = (v: unknown): unknown[] =>
      Array.isArray(v) ? v : typeof v === "string" ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];

    // RPC returns `batted_balls` — map to our `BattedBallEvent` shape
    const rawBalls = toArray(raw.batted_balls);
    const events: BattedBallEvent[] = rawBalls.map((bb: any) => ({
      coord_x: bb.coord_x ?? null,
      coord_y: bb.coord_y ?? null,
      exit_velocity: bb.exit_velocity ?? null,
      launch_angle: bb.launch_angle ?? null,
      hit_distance: bb.total_distance ?? bb.hit_distance ?? null,
      trajectory: bb.trajectory ?? null,
      result: bb.event ?? bb.result ?? null,
      is_barrel: bb.is_barrel ?? null,
      is_hard_hit: bb.hardness === "hard" || (bb.exit_velocity != null && bb.exit_velocity >= 95),
      zone: bb.zone ?? null,
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
