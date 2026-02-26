import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const WINDOW_VALUES = ["season", "last_5", "last_10", "last_20"] as const;

const QuerySchema = z.object({
  batterId: z.coerce.number().int().positive(),
  pitcherId: z.coerce.number().int().positive().optional(),
  batterWindow: z.enum(WINDOW_VALUES).optional().default("season"),
  pitcherWindow: z.enum(WINDOW_VALUES).optional().default("season"),
  season: z.coerce.number().int().min(2000).max(3000).optional(),
});

export type HotZoneWindow = (typeof WINDOW_VALUES)[number];

export interface MlbHotZoneBatterZone {
  zone: number;
  pitches_seen: number | null;
  swing_pct: number | null;
  whiff_pct: number | null;
  contact_pct: number | null;
  temp?: "hot" | "warm" | "lukewarm" | "cold" | string | null;
  value?: number | null;
  color?: string | null;
}

export interface MlbHotZonePitcherZone {
  zone: number;
  pitches_thrown: number | null;
  zone_pct: number | null;
  whiffs_generated: number | null;
  temp?: "hot" | "warm" | "lukewarm" | "cold" | string | null;
  value?: number | null;
  color?: string | null;
}

export interface MlbHotZoneMatchupOverlay {
  zone: number;
  pitcher_zone_pct: number | null;
  batter_whiff_pct: number | null;
  advantage: "batter_advantage" | "pitcher_advantage" | "neutral" | "dead_zone" | string | null;
  temp?: "hot" | "warm" | "lukewarm" | "cold" | string | null;
  value?: number | null;
  color?: string | null;
}

export interface MlbHotZonePitchType {
  pitch_type: string | null;
  pitch_name: string | null;
  pct: number | null;
  usage_pct: number | null;
  whiff_pct: number | null;
  avg_speed: number | null;
  in_zone_pct: number | null;
}

export interface MlbHotZoneBatterTotals {
  total_pitches: number | null;
  swing_pct: number | null;
  whiff_pct: number | null;
  chase_pct: number | null;
  zone_contact_pct: number | null;
}

export interface MlbHotZonePitcherTotals {
  total_pitches: number | null;
  avg_speed: number | null;
  zone_pct: number | null;
  whiff_pct: number | null;
}

export interface MlbHotZoneMatchupResponse {
  batter_zones: MlbHotZoneBatterZone[];
  batter_totals: MlbHotZoneBatterTotals | null;
  batter_vs_pitch_types: MlbHotZonePitchType[];
  pitcher_zones: MlbHotZonePitcherZone[];
  pitcher_pitch_mix: MlbHotZonePitchType[];
  pitcher_totals: MlbHotZonePitcherTotals | null;
  matchup_overlay: MlbHotZoneMatchupOverlay[];
  meta?: {
    requested_season: number;
    resolved_season: number;
    fallback_used: boolean;
    fallback_reason: string | null;
  };
}

const MIN_REQUIRED_BY_WINDOW: Record<HotZoneWindow, number> = {
  season: 1,
  last_5: 5,
  last_10: 10,
  last_20: 20,
};

function getCurrentEtYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(new Date())
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseBatterZone(row: unknown): MlbHotZoneBatterZone | null {
  const obj = toObject(row);
  const zone = toNumber(obj.zone);
  if (zone === null) return null;
  return {
    zone,
    pitches_seen: toNumber(obj.pitches_seen),
    swing_pct: toNumber(obj.swing_pct),
    whiff_pct: toNumber(obj.whiff_pct),
    contact_pct: toNumber(obj.contact_pct),
    temp: typeof obj.temp === "string" ? obj.temp : null,
    value: toNumber(obj.value),
    color: typeof obj.color === "string" ? obj.color : null,
  };
}

function parsePitcherZone(row: unknown): MlbHotZonePitcherZone | null {
  const obj = toObject(row);
  const zone = toNumber(obj.zone);
  if (zone === null) return null;
  return {
    zone,
    pitches_thrown: toNumber(obj.pitches_thrown),
    zone_pct: toNumber(obj.zone_pct),
    whiffs_generated: toNumber(obj.whiffs_generated),
    temp: typeof obj.temp === "string" ? obj.temp : null,
    value: toNumber(obj.value),
    color: typeof obj.color === "string" ? obj.color : null,
  };
}

function parseOverlayZone(row: unknown): MlbHotZoneMatchupOverlay | null {
  const obj = toObject(row);
  const zone = toNumber(obj.zone);
  if (zone === null) return null;
  return {
    zone,
    pitcher_zone_pct: toNumber(obj.pitcher_zone_pct),
    batter_whiff_pct: toNumber(obj.batter_whiff_pct),
    advantage: typeof obj.advantage === "string" ? obj.advantage : null,
    temp: typeof obj.temp === "string" ? obj.temp : null,
    value: toNumber(obj.value),
    color: typeof obj.color === "string" ? obj.color : null,
  };
}

function parsePitchType(row: unknown): MlbHotZonePitchType | null {
  const obj = toObject(row);
  return {
    pitch_type: typeof obj.pitch_type === "string" ? obj.pitch_type : null,
    pitch_name: typeof obj.pitch_name === "string" ? obj.pitch_name : null,
    pct: toNumber(obj.pct),
    usage_pct: toNumber(obj.usage_pct),
    whiff_pct: toNumber(obj.whiff_pct),
    avg_speed: toNumber(obj.avg_speed),
    in_zone_pct: toNumber(obj.in_zone_pct),
  };
}

function parseBatterTotals(value: unknown): MlbHotZoneBatterTotals | null {
  const obj = toObject(value);
  if (Object.keys(obj).length === 0) return null;
  return {
    total_pitches: toNumber(obj.total_pitches),
    swing_pct: toNumber(obj.swing_pct),
    whiff_pct: toNumber(obj.whiff_pct),
    chase_pct: toNumber(obj.chase_pct),
    zone_contact_pct: toNumber(obj.zone_contact_pct),
  };
}

function parsePitcherTotals(value: unknown): MlbHotZonePitcherTotals | null {
  const obj = toObject(value);
  if (Object.keys(obj).length === 0) return null;
  return {
    total_pitches: toNumber(obj.total_pitches),
    avg_speed: toNumber(obj.avg_speed),
    zone_pct: toNumber(obj.zone_pct),
    whiff_pct: toNumber(obj.whiff_pct),
  };
}

function normalizeHotZonePayload(data: unknown): MlbHotZoneMatchupResponse {
  const raw = toObject(data);
  return {
    batter_zones: toArray(raw.batter_zones)
      .map(parseBatterZone)
      .filter((row): row is MlbHotZoneBatterZone => row !== null),
    batter_totals: parseBatterTotals(raw.batter_totals),
    batter_vs_pitch_types: toArray(raw.batter_vs_pitch_types)
      .map(parsePitchType)
      .filter((row): row is MlbHotZonePitchType => row !== null),
    pitcher_zones: toArray(raw.pitcher_zones)
      .map(parsePitcherZone)
      .filter((row): row is MlbHotZonePitcherZone => row !== null),
    pitcher_pitch_mix: toArray(raw.pitcher_pitch_mix)
      .map(parsePitchType)
      .filter((row): row is MlbHotZonePitchType => row !== null),
    pitcher_totals: parsePitcherTotals(raw.pitcher_totals),
    matchup_overlay: toArray(raw.matchup_overlay)
      .map(parseOverlayZone)
      .filter((row): row is MlbHotZoneMatchupOverlay => row !== null),
  };
}

function hasAnyData(response: MlbHotZoneMatchupResponse, needsPitcher: boolean): boolean {
  const hasBatterData =
    response.batter_zones.length > 0 ||
    response.batter_vs_pitch_types.length > 0 ||
    (response.batter_totals?.total_pitches ?? 0) > 0;
  if (!hasBatterData) return false;
  if (!needsPitcher) return true;

  return (
    response.pitcher_zones.length > 0 ||
    response.pitcher_pitch_mix.length > 0 ||
    response.matchup_overlay.length > 0 ||
    (response.pitcher_totals?.total_pitches ?? 0) > 0
  );
}

function hasSufficientWindowData(
  response: MlbHotZoneMatchupResponse,
  params: {
    batterWindow: HotZoneWindow;
    pitcherWindow: HotZoneWindow;
    needsPitcher: boolean;
  }
): boolean {
  const batterMin = MIN_REQUIRED_BY_WINDOW[params.batterWindow];
  const pitcherMin = MIN_REQUIRED_BY_WINDOW[params.pitcherWindow];

  const batterPitches = response.batter_totals?.total_pitches ?? 0;
  const pitcherPitches = response.pitcher_totals?.total_pitches ?? 0;

  const batterOk =
    batterPitches >= batterMin || response.batter_zones.length >= Math.min(3, batterMin);
  const pitcherOk =
    !params.needsPitcher ||
    pitcherPitches >= pitcherMin ||
    response.pitcher_zones.length >= Math.min(3, pitcherMin);

  return batterOk && pitcherOk;
}

function getResponseScore(response: MlbHotZoneMatchupResponse, needsPitcher: boolean): number {
  const batterPitches = response.batter_totals?.total_pitches ?? 0;
  const pitcherPitches = response.pitcher_totals?.total_pitches ?? 0;
  const batterShape = response.batter_zones.length + response.batter_vs_pitch_types.length;
  const pitcherShape =
    response.pitcher_zones.length + response.pitcher_pitch_mix.length + response.matchup_overlay.length;
  return batterPitches + batterShape * 5 + (needsPitcher ? pitcherPitches + pitcherShape * 5 : 0);
}

function buildSeasonCandidates(requestedSeason: number): number[] {
  const candidates = [requestedSeason, requestedSeason - 1, requestedSeason - 2];
  return [...new Set(candidates.filter((s) => Number.isFinite(s) && s >= 2000))];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      batterId: searchParams.get("batterId"),
      pitcherId: searchParams.get("pitcherId") ?? undefined,
      batterWindow: searchParams.get("batterWindow") ?? undefined,
      pitcherWindow: searchParams.get("pitcherWindow") ?? undefined,
      season: searchParams.get("season") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { batterId, pitcherId, batterWindow, pitcherWindow, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const requestedSeason = season ?? getCurrentEtYear();
    const needsPitcher = typeof pitcherId === "number";
    const seasonCandidates = buildSeasonCandidates(requestedSeason);

    let selectedResponse: MlbHotZoneMatchupResponse | null = null;
    let selectedSeason = requestedSeason;
    let fallbackReason: string | null = null;

    let bestCandidate: { season: number; response: MlbHotZoneMatchupResponse; score: number } | null = null;

    for (const candidateSeason of seasonCandidates) {
      const { data, error } = await supabase.rpc("get_mlb_hot_zone_matchup", {
        p_batter_id: batterId,
        p_pitcher_id: pitcherId ?? null,
        p_batter_window: batterWindow,
        p_pitcher_window: pitcherWindow,
        p_season: candidateSeason,
      });

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch MLB hot zone matchup", details: error.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }

      const normalized = normalizeHotZonePayload(data);
      if (!hasAnyData(normalized, needsPitcher)) {
        continue;
      }

      const score = getResponseScore(normalized, needsPitcher);
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { season: candidateSeason, response: normalized, score };
      }

      if (
        hasSufficientWindowData(normalized, {
          batterWindow,
          pitcherWindow,
          needsPitcher,
        })
      ) {
        selectedResponse = normalized;
        selectedSeason = candidateSeason;
        if (candidateSeason !== requestedSeason) {
          fallbackReason = "insufficient_data_in_requested_season";
        }
        break;
      }
    }

    if (!selectedResponse && bestCandidate) {
      selectedResponse = bestCandidate.response;
      selectedSeason = bestCandidate.season;
      fallbackReason = bestCandidate.season !== requestedSeason ? "fallback_to_best_available_season" : null;
    }

    const response: MlbHotZoneMatchupResponse =
      selectedResponse ??
      {
        batter_zones: [],
        batter_totals: null,
        batter_vs_pitch_types: [],
        pitcher_zones: [],
        pitcher_pitch_mix: [],
        pitcher_totals: null,
        matchup_overlay: [],
      };

    response.meta = {
      requested_season: requestedSeason,
      resolved_season: selectedSeason,
      fallback_used: selectedSeason !== requestedSeason,
      fallback_reason: fallbackReason,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
