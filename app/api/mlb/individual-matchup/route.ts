"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { PitchArsenalRow, PitcherProfile, PitcherHandSplit, ArsenalHandSplit, BatterMatchup, BatterPitchSplit } from "@/app/api/mlb/game-matchup/route";

// Re-export types for consumers
export type { PitchArsenalRow, PitcherProfile, PitcherHandSplit, ArsenalHandSplit, BatterMatchup, BatterPitchSplit };

// ── Types ────────────────────────────────────────────────────────────────────

const PITCH_TYPE_NAMES: Record<string, string> = {
  FF: "4-Seam", SI: "Sinker", FC: "Cutter", SL: "Slider",
  CU: "Curveball", CH: "Changeup", FS: "Splitter", KC: "Knuckle Curve",
  ST: "Sweeper", SV: "Slurve", KN: "Knuckleball", EP: "Eephus", SC: "Screwball",
};

export interface IndividualMatchupResponse {
  pitcher: PitcherProfile;
  batter: BatterMatchup;
  meta: {
    sample: string;
    pitcher_pitch_types: string[];
    season_used: number;
  };
}

// ── Query Schema ────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  batterId: z.coerce.number().int().positive(),
  pitcherId: z.coerce.number().int().positive(),
  sample: z.enum(["season", "30", "15", "7"]).optional().default("season"),
});

// ── Helpers (same as game-matchup) ──────────────────────────────────────────

function getCurrentSeason(): number {
  // Use prior year until April to avoid spring training data pollution.
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 3=Apr
  return month < 3 ? now.getFullYear() - 1 : now.getFullYear();
}

function getSampleDateCutoff(sample: string): string | null {
  if (sample === "season") return null;
  const days = parseInt(sample, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeSLGFromEvents(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  let totalBases = 0;
  for (const bb of bbs) {
    const evt = (bb.event_type || "").toLowerCase();
    if (evt === "home_run") totalBases += 4;
    else if (evt === "triple") totalBases += 3;
    else if (evt === "double") totalBases += 2;
    else if (bb.is_hit) totalBases += 1;
  }
  return totalBases / bbs.length;
}

function computeAVGFromBBs(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  const hits = bbs.filter((b: any) => b.is_hit || (b.event_type || "").toLowerCase() === "home_run").length;
  return hits / bbs.length;
}

function computeBarrelPct(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  return (bbs.filter((b: any) => b.is_barrel).length / bbs.length) * 100;
}

function computeHardHitPct(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  return (bbs.filter((b: any) => b.hardness === "hard").length / bbs.length) * 100;
}

function computeAvgEV(bbs: any[]): number | null {
  const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);
  if (evs.length === 0) return null;
  return evs.reduce((a: number, b: number) => a + b, 0) / evs.length;
}

function computeWOBA(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  let weighted = 0;
  for (const bb of bbs) {
    const evt = (bb.event_type || "").toLowerCase();
    if (evt === "home_run") weighted += 2.101;
    else if (evt === "triple") weighted += 1.616;
    else if (evt === "double") weighted += 1.271;
    else if (bb.is_hit) weighted += 0.888;
  }
  return weighted / bbs.length;
}

function gradeMatchup(
  batter: { slg: number | null; iso: number | null; batting_hand: string; barrel_pct: number | null },
  pitcher: { hand: string | null; primary_pitch_type: string | null },
  primaryPitchSLG: number | null
): { grade: "strong" | "neutral" | "weak"; reason: string } {
  const hasPlatoon =
    (batter.batting_hand === "L" && pitcher.hand === "R") ||
    (batter.batting_hand === "R" && pitcher.hand === "L");
  const iso = batter.iso ?? 0;
  const slg = batter.slg ?? 0;
  const pSlg = primaryPitchSLG ?? 0;
  const barrelPct = batter.barrel_pct ?? 0;

  if (pSlg >= 0.450 && (hasPlatoon || iso >= 0.200)) {
    const reason = `${pSlg >= 0.500 ? "elite" : "high"} SLG vs ${pitcher.primary_pitch_type ?? "primary pitch"} (.${Math.round(pSlg * 1000)})${hasPlatoon ? " + platoon advantage" : ""}`;
    return { grade: "strong", reason };
  }
  if (slg >= 0.500 && iso >= 0.200 && barrelPct >= 10) {
    return { grade: "strong", reason: `elite power profile (${slg.toFixed(3)} SLG, ${barrelPct.toFixed(1)}% Brl)` };
  }
  if (pSlg < 0.350 && pSlg > 0) {
    return { grade: "weak", reason: `low SLG vs ${pitcher.primary_pitch_type ?? "primary pitch"} (.${Math.round(pSlg * 1000)})` };
  }
  if (iso < 0.120 && slg < 0.380) {
    return { grade: "weak", reason: `below-avg power (${slg.toFixed(3)} SLG, .${Math.round(iso * 1000)} ISO)` };
  }
  const reasons: string[] = [];
  if (hasPlatoon) reasons.push("platoon advantage");
  if (pSlg >= 0.400) reasons.push(`solid vs ${pitcher.primary_pitch_type ?? "primary"}`);
  if (iso >= 0.180) reasons.push("good power");
  return { grade: "neutral", reason: reasons.length > 0 ? reasons.join(", ") : "mixed signals" };
}

function generateScoutingSummary(p: PitcherProfile): string | null {
  if (!p.arsenal.length) return null;
  const parts: string[] = [];
  const primary = p.arsenal[0];
  const secondary = p.arsenal[1];
  parts.push(`${p.name} is a ${p.hand === "L" ? "left" : "right"}-handed pitcher who relies primarily on his ${primary.pitch_name.toLowerCase()} (${primary.usage_pct}% usage, ${primary.avg_speed ?? "?"} mph).`);
  if (secondary && secondary.usage_pct >= 15) {
    parts.push(`His secondary pitch is the ${secondary.pitch_name.toLowerCase()} at ${secondary.usage_pct}%.`);
  }
  if (p.era != null) {
    if (p.era <= 3.20) parts.push(`He has been dominant this season with a ${p.era} ERA.`);
    else if (p.era >= 4.50) parts.push(`He's been hittable this season with a ${p.era} ERA.`);
  }
  const hittablePitches = p.arsenal.filter((a) => a.slg != null && a.slg >= 0.480 && a.usage_pct >= 10);
  if (hittablePitches.length > 0) {
    const names = hittablePitches.map((a) => `${a.pitch_name.toLowerCase()} (.${Math.round((a.slg ?? 0) * 1000)} SLG)`).join(" and ");
    parts.push(`Batters have hit his ${names} hard this season.`);
  }
  if (p.hr_fb_pct != null && p.hr_fb_pct >= 13) {
    parts.push(`${p.hr_fb_pct}% of his fly balls have left the yard — above average HR vulnerability.`);
  }
  if (p.k_per_9 != null && p.bb_per_9 != null) {
    if (p.k_per_9 >= 10 && p.bb_per_9 <= 2.5) parts.push("He's a strikeout pitcher with excellent command.");
    else if (p.bb_per_9 >= 3.5) parts.push("Control is a concern — he walks too many batters.");
  }
  return parts.join(" ");
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      batterId: searchParams.get("batterId"),
      pitcherId: searchParams.get("pitcherId"),
      sample: searchParams.get("sample") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { batterId, pitcherId, sample } = parsed.data;
    const supabase = createServerSupabaseClient();
    const season = getCurrentSeason();
    const dateCutoff = getSampleDateCutoff(sample);
    const seasonsToTry = [season, season - 1];

    const bbSelect = "batter_id, pitcher_id, exit_velocity, launch_angle, total_distance, trajectory, hardness, pitch_type, pitch_speed, event_type, is_hit, is_barrel, is_out, game_date, pitcher_hand, batter_hand";
    const pitchSelect = "id, game_id, game_date, season, at_bat_index, pitch_number, batter_id, batter_hand, pitcher_id, pitcher_hand, pitch_type, pitch_name, start_speed, call_type, balls_before, strikes_before, is_whiff";

    // ── Parallel queries ──────────────────────────────────────────────────

    const pitcherBBQueries = seasonsToTry.map((s) => {
      let q = supabase.from("mlb_batted_balls").select(bbSelect).eq("pitcher_id", pitcherId).eq("season", s);
      if (dateCutoff && s === season) q = q.gte("game_date", dateCutoff);
      return q;
    });

    const batterBBQueries = seasonsToTry.map((s) => {
      let q = supabase.from("mlb_batted_balls").select(bbSelect).eq("batter_id", batterId).eq("season", s);
      if (dateCutoff && s === season) q = q.gte("game_date", dateCutoff);
      return q;
    });

    const h2hQuery = supabase.from("mlb_batted_balls").select(bbSelect)
      .eq("batter_id", batterId).eq("pitcher_id", pitcherId);

    const pitcherLogsQueries = seasonsToTry.map((s) =>
      supabase.rpc("get_mlb_pitcher_game_logs", {
        p_player_id: pitcherId, p_season: s, p_limit: 50, p_include_prior: false,
      })
    );

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 60);
    const recentBBQueries = seasonsToTry.map((s) =>
      supabase.from("mlb_batted_balls").select(bbSelect)
        .eq("batter_id", batterId).eq("season", s)
        .gte("game_date", recentCutoff.toISOString().slice(0, 10))
    );

    const l30Cutoff = new Date();
    l30Cutoff.setDate(l30Cutoff.getDate() - 30);
    const pitcherL30Queries = seasonsToTry.map((s) =>
      supabase.from("mlb_batted_balls").select(bbSelect)
        .eq("pitcher_id", pitcherId).eq("season", s)
        .gte("game_date", l30Cutoff.toISOString().slice(0, 10))
    );

    // Pitcher pitch type summary (whiff%, k%, put_away, BAA, SLG, wOBA per pitch)
    const pitchTypeSummaryQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitcher_pitchtype_summary")
        .select("pitch_type, whiff_percent, k_percent, bb_percent, put_away, pitch_usage, pitches, ba, obp, slg, woba")
        .eq("player_id", pitcherId)
        .eq("season_year", s)
    );

    // Raw pitcher pitches — drives true pitch mix usage and per-hand metrics
    const pitcherPitchQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitches")
        .select(pitchSelect)
        .eq("pitcher_id", pitcherId)
        .eq("season", s)
        .limit(15000)
    );

    // Get batter name from mlb_players_hr
    const batterNameQuery = supabase
      .from("mlb_players_hr")
      .select("mlb_player_id, name, odds_team_abbr, odds_team_name, position")
      .eq("mlb_player_id", batterId)
      .limit(1);

    const pitcherNameQuery = supabase
      .from("mlb_players_hr")
      .select("mlb_player_id, name, odds_team_abbr, odds_team_name, position")
      .eq("mlb_player_id", pitcherId)
      .limit(1);

    // Batter game logs for K%/BB%
    const batterGameLogQuery = supabase.rpc("get_mlb_batter_game_logs", {
      p_player_id: batterId,
      p_season: season,
      p_limit: 50,
      p_include_prior: false,
    });

    // Pitcher hot zone (3x3 grid)
    const pitcherHotZoneQuery = supabase.rpc("get_mlb_hot_zone_matchup", {
      p_batter_id: batterId,
      p_pitcher_id: pitcherId,
      p_batter_window: "season",
      p_pitcher_window: "season",
      p_season: season,
    });

    const batterPitchHandSplitQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batter_pitchtype_hand_splits")
        .select("player_id, opponent_hand, pitch_type, pa, ba, obp, slg, iso, woba, k_percent, bb_percent, whiff_percent, barrel_percent, hard_hit_percent, avg_exit_velocity, home_runs, xwobacon, wobacon, chase_percent, zone_contact_percent, swstr_percent")
        .eq("player_id", batterId)
        .eq("season_year", s)
    );

    const batterPitchSummaryQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batter_pitchtype_summary")
        .select("player_id, pitch_type, pa, ba, slg, iso, obp, woba, k_percent, whiff_percent, hard_hit_percent, barrel_batted_rate, exit_velocity_avg, pitches")
        .eq("player_id", batterId)
        .eq("season_year", s)
    );

    // Pitcher pitchtype hand splits (whiff%, k%, bb%, barrel%, advanced stats)
    const pitcherPitchHandSplitQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitcher_pitchtype_hand_splits")
        .select("pitch_type, opponent_hand, pitch_percent, release_speed, avg_spin, pitches, pa, ab, hits, ba, obp, slg, iso, woba, k_percent, bb_percent, whiff_percent, barrel_percent, hard_hit_percent, avg_exit_velocity, avg_launch_angle, xwobacon, wobacon, chase_percent, zone_contact_percent, swstr_percent")
        .eq("player_id", pitcherId)
        .eq("season_year", s)
    );

    const allResults = await Promise.all([
      ...pitcherBBQueries,    // [0, 1]
      ...batterBBQueries,     // [2, 3]
      h2hQuery,               // [4]
      ...pitcherLogsQueries,  // [5, 6]
      ...recentBBQueries,     // [7, 8]
      ...pitcherL30Queries,   // [9, 10]
      batterNameQuery,        // [11]
      pitcherNameQuery,       // [12]
      ...pitchTypeSummaryQueries, // [13, 14]
      batterGameLogQuery,     // [15]
      pitcherHotZoneQuery,    // [16]
      ...batterPitchHandSplitQueries, // [17, 18]
      ...batterPitchSummaryQueries,   // [19, 20]
      ...pitcherPitchHandSplitQueries, // [21, 22]
      ...pitcherPitchQueries, // [23, 24]
    ]);

    // Pick season with data
    const pitcherBBs = ((allResults[0].data ?? []) as any[]).length > 0 ? (allResults[0].data as any[]) : (allResults[1].data ?? []) as any[];
    const batterBBs = ((allResults[2].data ?? []) as any[]).length > 0 ? (allResults[2].data as any[]) : (allResults[3].data ?? []) as any[];
    const h2hBBs = (allResults[4].data ?? []) as any[];
    const logs = (Array.isArray(allResults[5].data) && allResults[5].data.length > 0) ? allResults[5].data : (Array.isArray(allResults[6].data) ? allResults[6].data : []);
    const recentBBs = ((allResults[7].data ?? []) as any[]).length > 0 ? (allResults[7].data as any[]) : (allResults[8].data ?? []) as any[];
    const pitcherL30BBs = ((allResults[9].data ?? []) as any[]).length > 0 ? (allResults[9].data as any[]) : (allResults[10].data ?? []) as any[];

    const batterInfo = ((allResults[11].data ?? []) as any[])[0] ?? null;
    const pitcherInfo = ((allResults[12].data ?? []) as any[])[0] ?? null;
    const pitchSummaryRows = ((allResults[13].data ?? []) as any[]).length > 0 ? (allResults[13].data as any[]) : (allResults[14].data ?? []) as any[];
    const batterGameLogs = Array.isArray(allResults[15]?.data) ? allResults[15].data as any[] : [];
    const batterPitchHandRows = ((allResults[17].data ?? []) as any[]).length > 0 ? (allResults[17].data as any[]) : (allResults[18].data ?? []) as any[];
    const batterPitchSummaryRows = ((allResults[19].data ?? []) as any[]).length > 0 ? (allResults[19].data as any[]) : (allResults[20].data ?? []) as any[];
    const pitcherPitchHandRows = ((allResults[21].data ?? []) as any[]).length > 0 ? (allResults[21].data as any[]) : (allResults[22].data ?? []) as any[];
    const pitcherPitches = ((allResults[23].data ?? []) as any[]).length > 0 ? (allResults[23].data as any[]) : (allResults[24].data ?? []) as any[];

    // Build lookup: "pitchType:hand" -> real Savant pitcher hand-split stats
    const pitcherHandSplitMap = new Map<string, any>();
    for (const row of pitcherPitchHandRows) {
      const hand = row.opponent_hand === "L" || row.opponent_hand === "R" ? row.opponent_hand : null;
      if (!row.pitch_type || !hand) continue;
      pitcherHandSplitMap.set(`${row.pitch_type}:${hand}`, row);
    }

    // Extract pitcher hot zone grid
    const hotZoneRaw = allResults[16]?.data;
    let pitchZoneGrid: PitcherProfile["pitch_zone_grid"] = null;
    if (hotZoneRaw && typeof hotZoneRaw === "object") {
      const payload = hotZoneRaw as any;
      const pitcherZones = Array.isArray(payload.pitcher_zones) ? payload.pitcher_zones : [];
      if (pitcherZones.length > 0) {
        pitchZoneGrid = pitcherZones
          .filter((z: any) => z && typeof z === "object" && z.zone != null && z.zone >= 1 && z.zone <= 9)
          .map((z: any) => ({
            zone: Number(z.zone),
            zone_pct: z.zone_pct != null ? Number(z.zone_pct) : null,
            whiffs: z.whiffs_generated != null ? Number(z.whiffs_generated) : null,
            temp: ["hot", "warm", "lukewarm", "cold"].includes(z.temp) ? z.temp : null,
          }))
          .sort((a: any, b: any) => a.zone - b.zone);
      }
    }

    // Compute batter K%/BB% respecting sample filter
    let batterKPct: number | null = null;
    let batterBBPct: number | null = null;
    if (batterGameLogs.length > 0) {
      let filtered = batterGameLogs;
      if (sample !== "season") {
        const limit = Number(sample);
        filtered = batterGameLogs.slice(0, limit);
      }
      let totalPA = 0, totalK = 0, totalBB = 0;
      for (const g of filtered) {
        totalPA += Number(g.plate_appearances ?? 0);
        totalK += Number(g.strike_outs ?? 0);
        totalBB += Number(g.base_on_balls ?? 0);
      }
      if (totalPA >= 10) {
        batterKPct = Math.round((totalK / totalPA) * 1000) / 10;
        batterBBPct = Math.round((totalBB / totalPA) * 1000) / 10;
      }
    }

    // Build pitch type summary lookup
    const pitchSummaryMap = new Map<string, {
      whiff_pct: number | null; k_pct: number | null; bb_pct: number | null;
      put_away: number | null; ba: number | null; obp: number | null;
      slg: number | null; woba: number | null;
      pitch_usage: number | null; pitches: number | null;
    }>();
    for (const row of pitchSummaryRows) {
      if (row.pitch_type) {
        pitchSummaryMap.set(row.pitch_type, {
          whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
          k_pct: row.k_percent != null ? Number(row.k_percent) : null,
          bb_pct: (row as any).bb_percent != null ? Number((row as any).bb_percent) : null,
          put_away: row.put_away != null ? Number(row.put_away) : null,
          ba: (row as any).ba != null ? Number((row as any).ba) : null,
          obp: (row as any).obp != null ? Number((row as any).obp) : null,
          slg: (row as any).slg != null ? Number((row as any).slg) : null,
          woba: (row as any).woba != null ? Number((row as any).woba) : null,
          pitch_usage: row.pitch_usage != null ? Number(row.pitch_usage) : null,
          pitches: row.pitches != null ? Number(row.pitches) : null,
        });
      }
    }

    const usedSeason = ((allResults[0].data ?? []) as any[]).length > 0 ? season : season - 1;

    const batterName = batterInfo?.name || `Player ${batterId}`;
    const batterTeamAbbr = batterInfo?.odds_team_abbr || "";
    const pitcherNameStr = pitcherInfo?.name || `Player ${pitcherId}`;
    const pitcherTeamAbbr = pitcherInfo?.odds_team_abbr || "";
    const pitcherTeamName = pitcherInfo?.odds_team_name || "";

    // ── Process Pitcher ─────────────────────────────────────────────────────

    const pitcherHand = pitcherPitches.length > 0
      ? pitcherPitches[0].pitcher_hand
      : (pitcherBBs.length > 0 ? pitcherBBs[0].pitcher_hand : null);

    // Group raw pitches by pitch_type — drives true usage % (matches game-matchup logic)
    const pitchGroups = new Map<string, any[]>();
    for (const p of pitcherPitches) {
      if (!p.pitch_type) continue;
      const arr = pitchGroups.get(p.pitch_type) || [];
      arr.push(p);
      pitchGroups.set(p.pitch_type, arr);
    }
    const totalPitcherPitches = pitcherPitches.length;

    // Batted balls grouped by pitch type — used for BAA / SLG / hard hit / barrel computations
    const pitchBBGroups = new Map<string, any[]>();
    for (const bb of pitcherBBs) {
      if (!bb.pitch_type) continue;
      const arr = pitchBBGroups.get(bb.pitch_type) || [];
      arr.push(bb);
      pitchBBGroups.set(bb.pitch_type, arr);
    }
    const totalPitcherBBs = pitcherBBs.length;

    // L30 pitcher arsenal
    const l30PitchGroups = new Map<string, any[]>();
    for (const bb of pitcherL30BBs) {
      if (!bb.pitch_type) continue;
      const arr = l30PitchGroups.get(bb.pitch_type) || [];
      arr.push(bb);
      l30PitchGroups.set(bb.pitch_type, arr);
    }
    const totalL30BBs = pitcherL30BBs.length;

    // Build a unified set of pitch types from raw pitches + batted balls + Savant summary
    const pitchTypesUnion = new Set<string>();
    for (const pt of pitchGroups.keys()) pitchTypesUnion.add(pt);
    for (const pt of pitchBBGroups.keys()) pitchTypesUnion.add(pt);
    for (const pt of pitchSummaryMap.keys()) pitchTypesUnion.add(pt);

    const arsenal: PitchArsenalRow[] = [];
    for (const pt of pitchTypesUnion) {
      const pitches = pitchGroups.get(pt) || [];
      const bbs = pitchBBGroups.get(pt) || [];
      const speeds = (pitches.length > 0 ? pitches : bbs)
        .map((row: any) => row.start_speed ?? row.pitch_speed)
        .filter((v: any) => v != null && v > 0);
      const summary = pitchSummaryMap.get(pt);
      // Usage: prefer raw pitch share; fall back to Savant pitch_usage, then to BB share
      const seasonUsage = totalPitcherPitches > 0
        ? Math.round((pitches.length / totalPitcherPitches) * 1000) / 10
        : (summary?.pitch_usage != null
            ? Math.round(summary.pitch_usage * 10) / 10
            : (totalPitcherBBs > 0 ? Math.round((bbs.length / totalPitcherBBs) * 1000) / 10 : 0));
      const l30Bbs = l30PitchGroups.get(pt) || [];
      const l30Usage = totalL30BBs > 0 ? Math.round((l30Bbs.length / totalL30BBs) * 1000) / 10 : null;
      const l30Speeds = l30Bbs.map((b: any) => b.pitch_speed).filter((s: any) => s != null && s > 0);
      let usageTrend: "up" | "down" | "flat" | null = null;
      if (l30Usage != null && totalL30BBs >= 10) {
        const diff = l30Usage - seasonUsage;
        if (diff >= 4) usageTrend = "up";
        else if (diff <= -4) usageTrend = "down";
        else usageTrend = "flat";
      }
      const gbCount = bbs.filter((b: any) => b.trajectory === "ground_ball").length;
      const fbCount = bbs.filter((b: any) => b.trajectory === "fly_ball").length;
      const hardCount = bbs.filter((b: any) => b.hardness === "hard").length;
      const barrelCount = bbs.filter((b: any) => b.is_barrel === true).length;
      const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);
      const las = bbs.map((b: any) => b.launch_angle).filter((v: any) => v != null && Number.isFinite(v));

      arsenal.push({
        pitch_type: pt,
        pitch_name: PITCH_TYPE_NAMES[pt] || pt,
        usage_pct: seasonUsage,
        pitches: pitches.length > 0 ? pitches.length : (summary?.pitches ?? null),
        pa: null,
        ab: null,
        hits: null,
        avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
        baa: summary?.ba != null ? Math.round(summary.ba * 1000) / 1000 : computeAVGFromBBs(bbs),
        slg: summary?.slg != null ? Math.round(summary.slg * 1000) / 1000 : computeSLGFromEvents(bbs),
        whiff_pct: summary?.whiff_pct ?? null,
        k_pct: summary?.k_pct ?? null,
        bb_pct: summary?.bb_pct ?? null,
        put_away: summary?.put_away ?? null,
        total_batted_balls: bbs.length,
        gb_pct: bbs.length >= 5 ? Math.round((gbCount / bbs.length) * 1000) / 10 : null,
        fb_pct: bbs.length >= 5 ? Math.round((fbCount / bbs.length) * 1000) / 10 : null,
        hard_hit_pct: bbs.length >= 5 ? Math.round((hardCount / bbs.length) * 1000) / 10 : null,
        barrel_pct: bbs.length >= 5 ? Math.round((barrelCount / bbs.length) * 1000) / 10 : null,
        avg_ev: evs.length > 0 ? Math.round(evs.reduce((a: number, b: number) => a + b, 0) / evs.length * 10) / 10 : null,
        avg_la: las.length >= 5 ? Math.round(las.reduce((a: number, b: number) => a + b, 0) / las.length * 10) / 10 : null,
        woba: summary?.woba != null ? Math.round(summary.woba * 1000) / 1000 : computeWOBA(bbs),
        xwobacon: null,
        wobacon: null,
        chase_pct: null,
        zone_contact_pct: null,
        swstr_pct: null,
        l30_usage_pct: l30Usage,
        l30_baa: l30Bbs.length > 0 ? computeAVGFromBBs(l30Bbs) : null,
        l30_slg: l30Bbs.length > 0 ? computeSLGFromEvents(l30Bbs) : null,
        l30_avg_speed: l30Speeds.length > 0 ? Math.round(l30Speeds.reduce((a: number, b: number) => a + b, 0) / l30Speeds.length * 10) / 10 : null,
        usage_trend: usageTrend,
      });
    }
    arsenal.sort((a, b) => b.usage_pct - a.usage_pct);

    // Pitcher season stats from game logs
    let pitcherSeasonStats: any = {};
    if (logs.length > 0) {
      let totalIP = 0, totalER = 0, totalH = 0, totalBB = 0, totalK = 0, totalGS = 0;
      let wins = 0, losses = 0;
      for (const log of logs) {
        const ip = Number(log.innings_numeric ?? 0);
        totalIP += ip;
        totalER += Number(log.earned_runs ?? 0);
        totalH += Number(log.hits_allowed ?? 0);
        totalBB += Number(log.base_on_balls ?? 0);
        totalK += Number(log.strike_outs ?? 0);
        totalGS += 1;
        const result = String(log.game_result ?? "").toUpperCase();
        if (result === "W") wins++;
        if (result === "L") losses++;
      }
      const hrFromBBs = pitcherBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;
      const era = totalIP > 0 ? (totalER / totalIP) * 9 : null;
      const whip = totalIP > 0 ? (totalH + totalBB) / totalIP : null;
      const kPer9 = totalIP > 0 ? (totalK / totalIP) * 9 : null;
      const bbPer9 = totalIP > 0 ? (totalBB / totalIP) * 9 : null;
      const hrPer9 = totalIP > 0 ? (hrFromBBs / totalIP) * 9 : null;
      const fip = totalIP > 0 ? ((13 * hrFromBBs + 3 * totalBB - 2 * totalK) / totalIP) + 3.10 : null;
      const flyBalls = pitcherBBs.filter((b: any) => b.trajectory === "fly_ball").length;
      const hrFbPct = flyBalls > 0 ? (hrFromBBs / flyBalls) * 100 : null;

      pitcherSeasonStats = {
        era: era != null ? Math.round(era * 100) / 100 : null,
        whip: whip != null ? Math.round(whip * 100) / 100 : null,
        k_per_9: kPer9 != null ? Math.round(kPer9 * 10) / 10 : null,
        bb_per_9: bbPer9 != null ? Math.round(bbPer9 * 10) / 10 : null,
        hr_per_9: hrPer9 != null ? Math.round(hrPer9 * 100) / 100 : null,
        fip: fip != null ? Math.round(fip * 100) / 100 : null,
        innings_pitched: Math.round(totalIP * 10) / 10,
        games_started: totalGS,
        opp_avg: totalIP > 0 ? Math.round((totalH / (totalIP * 3 + totalH)) * 1000) / 1000 : null,
        wins, losses,
        hr_fb_pct: hrFbPct != null ? Math.round(hrFbPct * 10) / 10 : null,
      };
    }

    const flyBallCount = pitcherBBs.filter((b: any) => b.trajectory === "fly_ball").length;
    const hrBBCount = pitcherBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;

    const hrBBsAllowed = pitcherBBs
      .filter((b: any) => (b.event_type || "").toLowerCase() === "home_run")
      .sort((a: any, b: any) => (b.game_date || "").localeCompare(a.game_date || ""))
      .slice(0, 5)
      .map((b: any) => ({
        batter_name: b.batter_name || null,
        batter_hand: b.batter_hand || null,
        date: b.game_date || "",
        pitch_type: b.pitch_type ? (PITCH_TYPE_NAMES[b.pitch_type] || b.pitch_type) : null,
        exit_velocity: b.exit_velocity != null ? Math.round(b.exit_velocity * 10) / 10 : null,
        distance: b.total_distance != null ? Math.round(b.total_distance) : null,
      }));

    const gbCount = pitcherBBs.filter((b: any) => b.trajectory === "ground_ball").length;
    const ldCount = pitcherBBs.filter((b: any) => b.trajectory === "line_drive").length;
    const puCount = pitcherBBs.filter((b: any) => b.trajectory === "popup").length;

    const zoneData = {
      total_fb: flyBallCount,
      total_gb: gbCount,
      total_ld: ldCount,
      total_pu: puCount,
      hr_pct_fb: flyBallCount > 0 ? Math.round((hrBBCount / flyBallCount) * 1000) / 10 : null,
      hard_hit_pct: (() => { const v = computeHardHitPct(pitcherBBs); return v != null ? Math.round(v * 10) / 10 : null; })(),
      avg_ev_against: (() => { const v = computeAvgEV(pitcherBBs); return v != null ? Math.round(v * 10) / 10 : null; })(),
    };

    // ── Pitcher hand splits (vs LHB / vs RHB) ──────────────────────────────
    function computePitcherHandSplit(hand: string): PitcherHandSplit | null {
      const hBBs = pitcherBBs.filter((b: any) => b.batter_hand === hand);
      if (hBBs.length < 5) return null;
      const avg = computeAVGFromBBs(hBBs);
      const slg = computeSLGFromEvents(hBBs);
      const woba = computeWOBA(hBBs);
      const ev = computeAvgEV(hBBs);
      const brl = computeBarrelPct(hBBs);
      const hard = computeHardHitPct(hBBs);
      const gb = hBBs.filter((b: any) => b.trajectory === "ground_ball").length;
      const hrs = hBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;
      return {
        bbs: hBBs.length,
        avg: avg != null ? Math.round(avg * 1000) / 1000 : null,
        slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
        iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
        woba: woba != null ? Math.round(woba * 1000) / 1000 : null,
        hr: hrs,
        avg_ev: ev != null ? Math.round(ev * 10) / 10 : null,
        hard_hit_pct: hard != null ? Math.round(hard * 10) / 10 : null,
        barrel_pct: brl != null ? Math.round(brl * 10) / 10 : null,
        gb_pct: hBBs.length >= 5 ? Math.round((gb / hBBs.length) * 1000) / 10 : null,
      };
    }

    const pitcherSplits = {
      vs_lhb: computePitcherHandSplit("L"),
      vs_rhb: computePitcherHandSplit("R"),
    };

    function computeArsenalHandSplits(hand: string): ArsenalHandSplit[] {
      const hBBs = pitcherBBs.filter((b: any) => b.batter_hand === hand);
      const hPitches = pitcherPitches.filter((p: any) => p.batter_hand === hand);
      const handRowsBy = new Map<string, any>();
      for (const row of pitcherPitchHandRows) {
        if (row.opponent_hand === hand && row.pitch_type) handRowsBy.set(row.pitch_type, row);
      }
      if (hPitches.length < 5 && hBBs.length < 5 && handRowsBy.size === 0) return [];

      // Build pitch type set in arsenal order, then include any Savant-only/raw-only rows.
      const pitchTypes = new Set<string>();
      for (const row of arsenal) {
        if (row.pitch_type) pitchTypes.add(row.pitch_type);
      }
      for (const pt of handRowsBy.keys()) pitchTypes.add(pt);
      for (const pitch of hPitches) {
        if (pitch.pitch_type) pitchTypes.add(pitch.pitch_type);
      }
      for (const bb of hBBs) {
        if (bb.pitch_type) pitchTypes.add(bb.pitch_type);
      }

      const totalHandPitches = hPitches.length;
      const results: ArsenalHandSplit[] = [];
      for (const pt of pitchTypes) {
        const bbs = hBBs.filter((b: any) => b.pitch_type === pt);
        const ptPitches = hPitches.filter((p: any) => p.pitch_type === pt);
        const speedSource = ptPitches.length > 0 ? ptPitches.map((p: any) => p.start_speed) : bbs.map((b: any) => b.pitch_speed);
        const speeds = speedSource.filter((s: any) => s != null && s > 0);
        const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);
        const las = bbs.map((b: any) => b.launch_angle).filter((v: any) => v != null && Number.isFinite(v));
        const avg = computeAVGFromBBs(bbs);
        const slg = computeSLGFromEvents(bbs);
        const woba = computeWOBA(bbs);
        const real = handRowsBy.get(pt);

        const usagePct = totalHandPitches > 0
          ? Math.round((ptPitches.length / totalHandPitches) * 1000) / 10
          : (hBBs.length > 0 ? Math.round((bbs.length / hBBs.length) * 1000) / 10 : 0);
        const realPitchPercent = real?.pitch_percent != null ? Math.round(Number(real.pitch_percent) * 10) / 10 : null;
        const realReleaseSpeed = real?.release_speed != null ? Math.round(Number(real.release_speed) * 10) / 10 : null;
        const realPitches = real?.pitches != null ? Number(real.pitches) : null;
        const pitchesForRow = realPitches ?? (ptPitches.length > 0 ? ptPitches.length : null);
        const realPa = real?.pa != null ? Number(real.pa) : null;
        const realAb = real?.ab != null ? Number(real.ab) : null;
        const realHits = real?.hits != null ? Number(real.hits) : null;
        const realBaa = real?.ba != null ? Math.round(Number(real.ba) * 1000) / 1000 : null;
        const realSlg = real?.slg != null ? Math.round(Number(real.slg) * 1000) / 1000 : null;
        const realIso = real?.iso != null ? Math.round(Number(real.iso) * 1000) / 1000 : null;
        const realWoba = real?.woba != null ? Math.round(Number(real.woba) * 1000) / 1000 : null;

        const realAvgEv = real?.avg_exit_velocity != null ? Math.round(Number(real.avg_exit_velocity) * 10) / 10 : null;
        const computedAvgEv = evs.length >= 5 ? Math.round(evs.reduce((a: number, b: number) => a + b, 0) / evs.length * 10) / 10 : null;
        const realAvgLa = real?.avg_launch_angle != null ? Math.round(Number(real.avg_launch_angle) * 10) / 10 : null;
        const computedAvgLa = las.length >= 5 ? Math.round(las.reduce((a: number, b: number) => a + b, 0) / las.length * 10) / 10 : null;
        const avgLaRow = realAvgLa ?? computedAvgLa;

        if (sample === "season" && real) {
          results.push({
            pitch_type: pt,
            pitch_name: PITCH_TYPE_NAMES[pt] || pt,
            usage_pct: realPitchPercent ?? usagePct,
            pitches: pitchesForRow,
            pa: realPa,
            ab: realAb,
            hits: realHits,
            avg_speed: realReleaseSpeed ?? (speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null),
            baa: realBaa,
            slg: realSlg,
            iso: realIso,
            woba: realWoba,
            bbs: realPa ?? bbs.length,
            whiff_pct: real.whiff_percent != null ? Math.round(Number(real.whiff_percent) * 10) / 10 : null,
            k_pct: real.k_percent != null ? Math.round(Number(real.k_percent) * 10) / 10 : null,
            bb_pct: real.bb_percent != null ? Math.round(Number(real.bb_percent) * 10) / 10 : null,
            hard_hit_pct: real.hard_hit_percent != null ? Math.round(Number(real.hard_hit_percent) * 10) / 10 : null,
            barrel_pct: real.barrel_percent != null ? Math.round(Number(real.barrel_percent) * 10) / 10 : null,
            avg_ev: realAvgEv ?? computedAvgEv,
            avg_la: avgLaRow,
            xwobacon: real.xwobacon != null ? Math.round(Number(real.xwobacon) * 1000) / 1000 : null,
            wobacon: real.wobacon != null ? Math.round(Number(real.wobacon) * 1000) / 1000 : null,
            chase_pct: real.chase_percent != null ? Math.round(Number(real.chase_percent) * 10) / 10 : null,
            zone_contact_pct: real.zone_contact_percent != null ? Math.round(Number(real.zone_contact_percent) * 10) / 10 : null,
            swstr_pct: real.swstr_percent != null ? Math.round(Number(real.swstr_percent) * 10) / 10 : null,
          });
          continue;
        }

        if (bbs.length === 0 && ptPitches.length === 0) continue;
        results.push({
          pitch_type: pt,
          pitch_name: PITCH_TYPE_NAMES[pt] || pt,
          usage_pct: usagePct,
          pitches: pitchesForRow,
          pa: realPa,
          ab: realAb,
          hits: realHits,
          avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
          baa: avg != null ? Math.round(avg * 1000) / 1000 : realBaa,
          slg: slg != null ? Math.round(slg * 1000) / 1000 : realSlg,
          iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : realIso,
          woba: woba != null ? Math.round(woba * 1000) / 1000 : realWoba,
          bbs: bbs.length > 0 ? bbs.length : (realPa ?? 0),
          whiff_pct: real?.whiff_percent != null ? Math.round(Number(real.whiff_percent) * 10) / 10 : null,
          k_pct: real?.k_percent != null ? Math.round(Number(real.k_percent) * 10) / 10 : null,
          bb_pct: real?.bb_percent != null ? Math.round(Number(real.bb_percent) * 10) / 10 : null,
          hard_hit_pct: real?.hard_hit_percent != null ? Math.round(Number(real.hard_hit_percent) * 10) / 10 : null,
          barrel_pct: real?.barrel_percent != null ? Math.round(Number(real.barrel_percent) * 10) / 10 : null,
          avg_ev: realAvgEv ?? computedAvgEv,
          avg_la: avgLaRow,
          xwobacon: real?.xwobacon != null ? Math.round(Number(real.xwobacon) * 1000) / 1000 : null,
          wobacon: real?.wobacon != null ? Math.round(Number(real.wobacon) * 1000) / 1000 : null,
          chase_pct: real?.chase_percent != null ? Math.round(Number(real.chase_percent) * 10) / 10 : null,
          zone_contact_pct: real?.zone_contact_percent != null ? Math.round(Number(real.zone_contact_percent) * 10) / 10 : null,
          swstr_pct: real?.swstr_percent != null ? Math.round(Number(real.swstr_percent) * 10) / 10 : null,
        });
      }
      results.sort((a, b) => b.usage_pct - a.usage_pct);
      return results;
    }

    const arsenalSplits = (pitcherPitches.length >= 10 || pitcherBBs.length >= 10 || pitcherPitchHandRows.length > 0) ? {
      vs_lhb: computeArsenalHandSplits("L"),
      vs_rhb: computeArsenalHandSplits("R"),
    } : null;

    const pitcherProfile: PitcherProfile = {
      player_id: pitcherId,
      name: pitcherNameStr,
      hand: pitcherHand,
      team_id: null,
      team_name: pitcherTeamName || null,
      team_abbr: pitcherTeamAbbr || null,
      era: pitcherSeasonStats.era ?? null,
      whip: pitcherSeasonStats.whip ?? null,
      k_per_9: pitcherSeasonStats.k_per_9 ?? null,
      bb_per_9: pitcherSeasonStats.bb_per_9 ?? null,
      hr_per_9: pitcherSeasonStats.hr_per_9 ?? null,
      fip: pitcherSeasonStats.fip ?? null,
      innings_pitched: pitcherSeasonStats.innings_pitched ?? null,
      games_started: pitcherSeasonStats.games_started ?? null,
      opp_avg: pitcherSeasonStats.opp_avg ?? null,
      wins: pitcherSeasonStats.wins ?? null,
      losses: pitcherSeasonStats.losses ?? null,
      hr_fb_pct: pitcherSeasonStats.hr_fb_pct ?? (flyBallCount > 0 ? Math.round((hrBBCount / flyBallCount) * 1000) / 10 : null),
      arsenal,
      scouting_summary: null,
      recent_hrs_allowed: hrBBsAllowed,
      pitch_zone_grid: pitchZoneGrid,
      pitcher_splits: pitcherSplits,
      arsenal_splits: arsenalSplits,
      zone_data: zoneData,
    };
    pitcherProfile.scouting_summary = generateScoutingSummary(pitcherProfile);

    // ── Process Batter ──────────────────────────────────────────────────────

    const batterHand = batterBBs.length > 0 ? batterBBs[0].batter_hand || "R" : "R";
    const avg = computeAVGFromBBs(batterBBs);
    const slg = computeSLGFromEvents(batterBBs);
    const iso = avg != null && slg != null ? slg - avg : null;
    const hrs = batterBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;
    const barrelPct = computeBarrelPct(batterBBs);
    const hardHitPct = computeHardHitPct(batterBBs);
    const avgEV = computeAvgEV(batterBBs);
    const woba = computeWOBA(batterBBs);

    const pitcherPitchTypes = arsenal.map((a) => a.pitch_type);
    const primaryPitchType = arsenal.length > 0 ? arsenal[0].pitch_type : null;

    const isEarlySeason = (pitcherSeasonStats.games_started ?? 0) <= 5;
    const MIN_PA_PITCH_TYPE = isEarlySeason ? 1 : 3;

    const batterPitchTotalPitches = batterPitchSummaryRows.reduce((sum: number, row: any) => sum + Number(row.pitches ?? 0), 0);
    const batterPitchTotalPa = batterPitchSummaryRows.reduce((sum: number, row: any) => sum + Number(row.pa ?? 0), 0);
    const batterPitchSummaryMap = new Map<string, {
      ba: number | null; slg: number | null; iso: number | null; woba: number | null;
      obp: number | null; k_pct: number | null; whiff_pct: number | null;
      hard_hit_pct: number | null; barrel_pct: number | null; avg_ev: number | null;
      pa: number; pitches: number; usage_pct: number | null;
    }>();
    for (const row of batterPitchSummaryRows) {
      if (!row.pitch_type) continue;
      const pitches = Number(row.pitches ?? 0);
      const pa = Number(row.pa ?? 0);
      const usageBase = batterPitchTotalPitches > 0 ? pitches : pa;
      const usageTotal = batterPitchTotalPitches > 0 ? batterPitchTotalPitches : batterPitchTotalPa;
      batterPitchSummaryMap.set(row.pitch_type, {
        ba: row.ba != null ? Number(row.ba) : null,
        slg: row.slg != null ? Number(row.slg) : null,
        iso: row.iso != null ? Number(row.iso) : null,
        woba: row.woba != null ? Number(row.woba) : null,
        obp: row.obp != null ? Number(row.obp) : null,
        k_pct: row.k_percent != null ? Number(row.k_percent) : null,
        whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
        hard_hit_pct: row.hard_hit_percent != null ? Number(row.hard_hit_percent) : null,
        barrel_pct: row.barrel_batted_rate != null ? Number(row.barrel_batted_rate) : null,
        avg_ev: row.exit_velocity_avg != null ? Number(row.exit_velocity_avg) : null,
        pa,
        pitches,
        usage_pct: usageTotal > 0 ? Math.round((usageBase / usageTotal) * 1000) / 10 : null,
      });
    }

    const batterPitchHandTotals = new Map<string, number>();
    for (const row of batterPitchHandRows) {
      const hand = row.opponent_hand === "L" || row.opponent_hand === "R" ? row.opponent_hand : null;
      if (!hand) continue;
      batterPitchHandTotals.set(hand, (batterPitchHandTotals.get(hand) ?? 0) + Number(row.pa ?? 0));
    }
    const batterPitchHandMap = new Map<string, {
      ba: number | null; slg: number | null; iso: number | null; woba: number | null;
      obp: number | null; k_pct: number | null; bb_pct: number | null; whiff_pct: number | null;
      hard_hit_pct: number | null; barrel_pct: number | null; avg_ev: number | null;
      hrs: number; pa: number; usage_pct: number | null;
      xwobacon: number | null; wobacon: number | null;
      chase_pct: number | null; zone_contact_pct: number | null; swstr_pct: number | null;
    }>();
    for (const row of batterPitchHandRows) {
      const hand = row.opponent_hand === "L" || row.opponent_hand === "R" ? row.opponent_hand : null;
      if (!row.pitch_type || !hand) continue;
      const pa = Number(row.pa ?? 0);
      const handTotal = batterPitchHandTotals.get(hand) ?? 0;
      batterPitchHandMap.set(`${row.pitch_type}:${hand}`, {
        ba: row.ba != null ? Number(row.ba) : null,
        slg: row.slg != null ? Number(row.slg) : null,
        iso: row.iso != null ? Number(row.iso) : null,
        woba: row.woba != null ? Number(row.woba) : null,
        obp: row.obp != null ? Number(row.obp) : null,
        k_pct: row.k_percent != null ? Number(row.k_percent) : null,
        bb_pct: row.bb_percent != null ? Number(row.bb_percent) : null,
        whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
        hard_hit_pct: row.hard_hit_percent != null ? Number(row.hard_hit_percent) : null,
        barrel_pct: row.barrel_percent != null ? Number(row.barrel_percent) : null,
        avg_ev: row.avg_exit_velocity != null ? Number(row.avg_exit_velocity) : null,
        hrs: Number(row.home_runs ?? 0),
        pa,
        usage_pct: handTotal > 0 ? Math.round((pa / handTotal) * 1000) / 10 : null,
        xwobacon: row.xwobacon != null ? Number(row.xwobacon) : null,
        wobacon: row.wobacon != null ? Number(row.wobacon) : null,
        chase_pct: row.chase_percent != null ? Number(row.chase_percent) : null,
        zone_contact_pct: row.zone_contact_percent != null ? Number(row.zone_contact_percent) : null,
        swstr_pct: row.swstr_percent != null ? Number(row.swstr_percent) : null,
      });
    }

    // Pitch splits
    const pitchSplits: BatterPitchSplit[] = pitcherPitchTypes.map((pt) => {
      const realData = batterPitchSummaryMap.get(pt);
      const ptHRs = batterBBs.filter((b: any) => b.pitch_type === pt && (b.event_type || "").toLowerCase() === "home_run").length;
      const ptLas = batterBBs.filter((b: any) => b.pitch_type === pt).map((b: any) => b.launch_angle).filter((v: any) => v != null && Number.isFinite(v));
      const avgLa = ptLas.length >= 5 ? Math.round(ptLas.reduce((a: number, b: number) => a + b, 0) / ptLas.length * 10) / 10 : null;
      if (realData && realData.pa >= MIN_PA_PITCH_TYPE) {
        return {
          pitch_type: pt,
          pitch_name: PITCH_TYPE_NAMES[pt] || pt,
          usage_pct: realData.usage_pct,
          pitches: realData.pitches,
          pa: realData.pa,
          ab: null,
          hits: null,
          avg: realData.ba != null ? Math.round(realData.ba * 1000) / 1000 : null,
          slg: realData.slg != null ? Math.round(realData.slg * 1000) / 1000 : null,
          iso: realData.iso != null ? Math.round(realData.iso * 1000) / 1000 : null,
          batted_balls: realData.pa,
          hrs: ptHRs,
          k_pct: realData.k_pct != null ? Math.round(realData.k_pct * 10) / 10 : null,
          bb_pct: null,
          barrel_pct: realData.barrel_pct != null ? Math.round(realData.barrel_pct * 10) / 10 : null,
          woba: realData.woba != null ? Math.round(realData.woba * 1000) / 1000 : null,
          avg_ev: realData.avg_ev != null ? Math.round(realData.avg_ev * 10) / 10 : null,
          avg_la: avgLa,
          hard_hit_pct: realData.hard_hit_pct != null ? Math.round(realData.hard_hit_pct * 10) / 10 : null,
          whiff_pct: realData.whiff_pct != null ? Math.round(realData.whiff_pct * 10) / 10 : null,
          xwobacon: null, wobacon: null, chase_pct: null, zone_contact_pct: null, swstr_pct: null,
        };
      }
      return {
        pitch_type: pt,
        pitch_name: PITCH_TYPE_NAMES[pt] || pt,
        usage_pct: null,
        pitches: null,
        pa: null, ab: null, hits: null,
        avg: null,
        slg: null,
        iso: null,
        batted_balls: 0,
        hrs: ptHRs,
        k_pct: null,
        bb_pct: null,
        barrel_pct: null,
        woba: null,
        avg_ev: null,
        avg_la: avgLa,
        hard_hit_pct: null,
        whiff_pct: null,
        xwobacon: null, wobacon: null, chase_pct: null, zone_contact_pct: null, swstr_pct: null,
      };
    });

    function computePitchSplitsForHand(hand: string): BatterPitchSplit[] {
      return pitcherPitchTypes.map((pt) => {
        const realData = batterPitchHandMap.get(`${pt}:${hand}`);
        const ptLas = batterBBs.filter((b: any) => b.pitch_type === pt && b.pitcher_hand === hand).map((b: any) => b.launch_angle).filter((v: any) => v != null && Number.isFinite(v));
        const avgLa = ptLas.length >= 5 ? Math.round(ptLas.reduce((a: number, b: number) => a + b, 0) / ptLas.length * 10) / 10 : null;
        if (realData && realData.pa >= MIN_PA_PITCH_TYPE) {
          return {
            pitch_type: pt,
            pitch_name: PITCH_TYPE_NAMES[pt] || pt,
            usage_pct: realData.usage_pct,
            pitches: null,
            pa: realData.pa,
            ab: null,
            hits: null,
            avg: realData.ba != null ? Math.round(realData.ba * 1000) / 1000 : null,
            slg: realData.slg != null ? Math.round(realData.slg * 1000) / 1000 : null,
            iso: realData.iso != null ? Math.round(realData.iso * 1000) / 1000 : null,
            batted_balls: realData.pa,
            hrs: realData.hrs,
            k_pct: realData.k_pct != null ? Math.round(realData.k_pct * 10) / 10 : null,
            bb_pct: realData.bb_pct != null ? Math.round(realData.bb_pct * 10) / 10 : null,
            barrel_pct: realData.barrel_pct != null ? Math.round(realData.barrel_pct * 10) / 10 : null,
            woba: realData.woba != null ? Math.round(realData.woba * 1000) / 1000 : null,
            avg_ev: realData.avg_ev != null ? Math.round(realData.avg_ev * 10) / 10 : null,
            avg_la: avgLa,
            hard_hit_pct: realData.hard_hit_pct != null ? Math.round(realData.hard_hit_pct * 10) / 10 : null,
            whiff_pct: realData.whiff_pct != null ? Math.round(realData.whiff_pct * 10) / 10 : null,
            xwobacon: realData.xwobacon != null ? Math.round(realData.xwobacon * 1000) / 1000 : null,
            wobacon: realData.wobacon != null ? Math.round(realData.wobacon * 1000) / 1000 : null,
            chase_pct: realData.chase_pct != null ? Math.round(realData.chase_pct * 10) / 10 : null,
            zone_contact_pct: realData.zone_contact_pct != null ? Math.round(realData.zone_contact_pct * 10) / 10 : null,
            swstr_pct: realData.swstr_pct != null ? Math.round(realData.swstr_pct * 10) / 10 : null,
          };
        }
        return {
          pitch_type: pt,
          pitch_name: PITCH_TYPE_NAMES[pt] || pt,
          usage_pct: null,
          pitches: null,
          pa: null, ab: null, hits: null,
          avg: null, slg: null, iso: null, batted_balls: 0, hrs: 0,
          k_pct: null, bb_pct: null, barrel_pct: null, woba: null,
          avg_ev: null, avg_la: avgLa, hard_hit_pct: null, whiff_pct: null,
          xwobacon: null, wobacon: null, chase_pct: null, zone_contact_pct: null, swstr_pct: null,
        };
      });
    }

    const pitchHandSplits = {
      vs_rhp: computePitchSplitsForHand("R"),
      vs_lhp: computePitchSplitsForHand("L"),
    };

    // H2H
    let h2h: BatterMatchup["h2h"] = null;
    if (h2hBBs.length > 0) {
      const h2hByDate = new Map<string, any[]>();
      for (const bb of h2hBBs) {
        const d = bb.game_date || "unknown";
        const arr = h2hByDate.get(d) || [];
        arr.push(bb);
        h2hByDate.set(d, arr);
      }
      const sortedDates = Array.from(h2hByDate.keys()).sort().reverse();
      const lastMeetings = sortedDates.slice(0, 3).map((d) => {
        const mBBs = h2hByDate.get(d)!;
        return {
          date: d,
          pa: mBBs.length,
          hits: mBBs.filter((b: any) => b.is_hit || (b.event_type || "").toLowerCase() === "home_run").length,
          hrs: mBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
        };
      });
      const h2hPitchRows = h2hBBs.filter((bb: any) => bb.game_date >= "2023-01-01" && bb.pitch_type);
      const h2hPitchCounts = new Map<string, number>();
      for (const bb of h2hPitchRows) {
        h2hPitchCounts.set(bb.pitch_type, (h2hPitchCounts.get(bb.pitch_type) ?? 0) + 1);
      }
      const h2hPitchTotal = h2hPitchRows.length;
      h2h = {
        pa: h2hBBs.length,
        hits: h2hBBs.filter((b: any) => b.is_hit || (b.event_type || "").toLowerCase() === "home_run").length,
        hrs: h2hBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
        avg: (() => { const v = computeAVGFromBBs(h2hBBs); return v != null ? Math.round(v * 1000) / 1000 : null; })(),
        slg: (() => { const v = computeSLGFromEvents(h2hBBs); return v != null ? Math.round(v * 1000) / 1000 : null; })(),
        last_meetings: lastMeetings,
        pitch_mix_since_2023: h2hPitchTotal > 0
          ? Array.from(h2hPitchCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([pitchType, count]) => ({
                pitch_type: pitchType,
                pitch_name: PITCH_TYPE_NAMES[pitchType] || pitchType,
                count,
                pct: Math.round((count / h2hPitchTotal) * 1000) / 10,
              }))
          : [],
      };
    }

    // Recent form
    const recentBarrel = computeBarrelPct(recentBBs);
    const recentEV = computeAvgEV(recentBBs);
    const recentHRs = recentBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;

    // EV sparkline
    const recentByDate = new Map<string, any[]>();
    for (const bb of recentBBs) {
      const d = bb.game_date || "unknown";
      const arr = recentByDate.get(d) || [];
      arr.push(bb);
      recentByDate.set(d, arr);
    }
    const sparkDates = Array.from(recentByDate.keys()).sort().slice(-8);
    const recentEvSparkline = sparkDates.map((d) => {
      const dayBBs = recentByDate.get(d)!;
      const ev = computeAvgEV(dayBBs);
      return ev != null ? Math.round(ev * 10) / 10 : 0;
    }).filter((v) => v > 0);

    // Matchup grade
    const primarySplit = pitchSplits.find((s) => s.pitch_type === primaryPitchType);
    const { grade, reason } = gradeMatchup(
      { slg, iso, batting_hand: batterHand, barrel_pct: barrelPct },
      { hand: pitcherHand, primary_pitch_type: primaryPitchType ? (PITCH_TYPE_NAMES[primaryPitchType] || primaryPitchType) : null },
      primarySplit?.slg ?? null
    );

    // HR factors + score
    const hrFactors: { label: string; positive: boolean }[] = [];
    const hasPlatoonAdv =
      (batterHand === "L" && pitcherHand === "R") ||
      (batterHand === "R" && pitcherHand === "L");
    if (hasPlatoonAdv) hrFactors.push({ label: "Platoon advantage", positive: true });
    if (iso != null && iso >= 0.200) hrFactors.push({ label: `.${Math.round(iso * 1000)} ISO (elite power)`, positive: true });
    else if (iso != null && iso < 0.120) hrFactors.push({ label: `.${Math.round(iso * 1000)} ISO (low power)`, positive: false });
    if (barrelPct != null && barrelPct >= 10) hrFactors.push({ label: `${barrelPct.toFixed(1)}% barrel rate`, positive: true });
    if (primarySplit?.slg != null && primarySplit.slg >= 0.500) hrFactors.push({ label: `Crushes ${PITCH_TYPE_NAMES[primaryPitchType!] || primaryPitchType}s (.${Math.round(primarySplit.slg * 1000)} SLG)`, positive: true });
    else if (primarySplit?.slg != null && primarySplit.slg < 0.300 && primarySplit.slg > 0) hrFactors.push({ label: `Struggles vs ${PITCH_TYPE_NAMES[primaryPitchType!] || primaryPitchType}s (.${Math.round(primarySplit.slg * 1000)} SLG)`, positive: false });
    if (h2h && h2h.hrs >= 2) hrFactors.push({ label: `${h2h.hrs} career HR vs pitcher`, positive: true });
    if (pitcherProfile.hr_per_9 != null && pitcherProfile.hr_per_9 >= 1.4) hrFactors.push({ label: "Pitcher allows high HR/9", positive: true });
    if (recentHRs >= 3) hrFactors.push({ label: `${recentHRs} HR in last 60 days`, positive: true });

    let hrScore = 30;
    if (hasPlatoonAdv) hrScore += 8;
    if (iso != null) hrScore += Math.min(Math.max((iso - 0.120) * 200, -15), 20);
    if (barrelPct != null) hrScore += Math.min(Math.max((barrelPct - 5) * 2, -10), 15);
    if (primarySplit?.slg != null) hrScore += Math.min(Math.max((primarySplit.slg - 0.400) * 60, -10), 15);
    if (h2h && h2h.hrs > 0) hrScore += Math.min(h2h.hrs * 3, 10);
    if (pitcherProfile.hr_per_9 != null && pitcherProfile.hr_per_9 >= 1.2) hrScore += 5;
    hrScore = Math.max(5, Math.min(95, Math.round(hrScore)));

    // Overlap score
    const topPitches = arsenal.slice(0, 3);
    let overlapHits = 0;
    let overlapWeightSum = 0;
    for (const ap of topPitches) {
      const s = pitchSplits.find((ps) => ps.pitch_type === ap.pitch_type);
      const weight = ap.usage_pct / 100;
      overlapWeightSum += weight;
      if (s && s.slg != null && s.slg >= 0.400 && s.batted_balls >= 3) {
        overlapHits += weight;
      }
    }
    const overlapScore = overlapWeightSum > 0 ? Math.round((overlapHits / overlapWeightSum) * 100) : null;

    const batter: BatterMatchup = {
      player_id: batterId,
      player_name: batterName,
      team_abbr: batterTeamAbbr,
      batting_hand: batterHand,
      lineup_position: null,
      pa: batterBBs.length,
      avg: avg != null ? Math.round(avg * 1000) / 1000 : null,
      obp: null,
      slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
      ops: null,
      iso: iso != null ? Math.round(iso * 1000) / 1000 : null,
      hr_count: hrs,
      barrel_pct: barrelPct != null ? Math.round(barrelPct * 10) / 10 : null,
      hard_hit_pct: hardHitPct != null ? Math.round(hardHitPct * 10) / 10 : null,
      avg_exit_velo: avgEV != null ? Math.round(avgEV * 10) / 10 : null,
      woba: woba != null ? Math.round(woba * 1000) / 1000 : null,
      total_batted_balls: batterBBs.length,
      pitch_splits: pitchSplits,
      pitch_hand_splits: pitchHandSplits,
      h2h,
      matchup_grade: grade,
      matchup_reason: reason,
      hr_probability_score: hrScore,
      hr_factors: hrFactors,
      overlap_score: overlapScore,
      recent_barrel_pct: recentBarrel != null ? Math.round(recentBarrel * 10) / 10 : null,
      recent_avg_ev: recentEV != null ? Math.round(recentEV * 10) / 10 : null,
      recent_hr_count: recentHRs,
      recent_ev_sparkline: recentEvSparkline,
      k_pct: batterKPct,
      bb_pct: batterBBPct,
      statcast_contact_pct: null,
      statcast_bip_pct: null,
      statcast_avg_ev: (() => {
        const evs = batterBBs.map((b: any) => Number(b.exit_velocity)).filter((v: number) => !isNaN(v) && v > 0);
        return evs.length > 0 ? Math.round(evs.reduce((a: number, b: number) => a + b, 0) / evs.length * 10) / 10 : null;
      })(),
      statcast_hard_hit_pct: batterBBs.length > 0 ? Math.round(batterBBs.filter((b: any) => Number(b.exit_velocity) >= 95).length / batterBBs.length * 1000) / 10 : null,
      statcast_barrel_pct: batterBBs.length > 0 ? Math.round(batterBBs.filter((b: any) => b.is_barrel === true).length / batterBBs.length * 1000) / 10 : null,
      statcast_sweet_spot_pct: batterBBs.length > 0 ? Math.round(batterBBs.filter((b: any) => { const la = Number(b.launch_angle); return !isNaN(la) && la >= 8 && la <= 32; }).length / batterBBs.length * 1000) / 10 : null,
      statcast_max_ev: (() => {
        const evs = batterBBs.map((b: any) => Number(b.exit_velocity)).filter((v: number) => !isNaN(v) && v > 0);
        return evs.length > 0 ? Math.round(Math.max(...evs) * 10) / 10 : null;
      })(),
      hand_splits: (() => {
        function computeHS(hand: string) {
          const hBBs = batterBBs.filter((b: any) => b.pitcher_hand === hand);
          if (hBBs.length === 0) return null;
          const hAvg = computeAVGFromBBs(hBBs);
          const hSlg = computeSLGFromEvents(hBBs);
          const hWoba = computeWOBA(hBBs);
          const hEV = computeAvgEV(hBBs);
          const hBrl = computeBarrelPct(hBBs);
          return {
            avg: hAvg != null ? Math.round(hAvg * 1000) / 1000 : null,
            slg: hSlg != null ? Math.round(hSlg * 1000) / 1000 : null,
            iso: hAvg != null && hSlg != null ? Math.round((hSlg - hAvg) * 1000) / 1000 : null,
            woba: hWoba != null ? Math.round(hWoba * 1000) / 1000 : null,
            hr: hBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
            ev: hEV != null ? Math.round(hEV * 10) / 10 : null,
            brl: hBrl != null ? Math.round(hBrl * 10) / 10 : null,
            bbs: hBBs.length,
            k_pct: null,
            bb_pct: null,
          };
        }
        return { vs_rhp: computeHS("R"), vs_lhp: computeHS("L") };
      })(),
      statcast_splits: (() => {
        if (batterBBs.length < 5) return null;
        function imBucket(bbs: any[]) {
          if (bbs.length < 5) return null;
          const evBalls = bbs.filter((b: any) => b.exit_velocity != null && b.exit_velocity > 0);
          const laBalls = bbs.filter((b: any) => b.launch_angle != null);
          return {
            contact_pct: null as null,
            bip_pct: null as null,
            avg_ev: evBalls.length > 0 ? +(evBalls.reduce((s: number, b: any) => s + b.exit_velocity, 0) / evBalls.length).toFixed(1) : null,
            hard_hit_pct: evBalls.length > 0 ? +(evBalls.filter((b: any) => b.exit_velocity >= 95).length / evBalls.length * 100).toFixed(1) : null,
            barrel_pct: bbs.length > 0 ? +(bbs.filter((b: any) => b.is_barrel === true || b.is_barrel === 1).length / bbs.length * 100).toFixed(1) : null,
            sweet_spot_pct: laBalls.length > 0 ? +(laBalls.filter((b: any) => b.launch_angle >= 8 && b.launch_angle <= 32).length / laBalls.length * 100).toFixed(1) : null,
            max_ev: evBalls.length > 0 ? +Math.max(...evBalls.map((b: any) => b.exit_velocity)).toFixed(1) : null,
            sample_bbs: bbs.length,
          };
        }
        const imPitchTypes = [...new Set(batterBBs.map((b: any) => b.pitch_type).filter(Boolean))] as string[];
        const imByPitch: Record<string, ReturnType<typeof imBucket>> = {};
        for (const pt of imPitchTypes) {
          imByPitch[pt] = imBucket(batterBBs.filter((b: any) => b.pitch_type === pt));
        }
        return {
          vs_rhp: imBucket(batterBBs.filter((b: any) => b.pitcher_hand === "R")),
          vs_lhp: imBucket(batterBBs.filter((b: any) => b.pitcher_hand === "L")),
          by_pitch: imByPitch,
        };
      })(),
    };

    console.log(`[/api/mlb/individual-matchup] ${Date.now() - startTime}ms | batter=${batterId} pitcher=${pitcherId} pitcherBBs=${totalPitcherBBs} batterBBs=${batterBBs.length} h2h=${h2hBBs.length} season=${usedSeason}`);

    return NextResponse.json(
      { pitcher: pitcherProfile, batter, meta: { sample, pitcher_pitch_types: pitcherPitchTypes, season_used: usedSeason } } as IndividualMatchupResponse,
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error: any) {
    console.error("[/api/mlb/individual-matchup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
