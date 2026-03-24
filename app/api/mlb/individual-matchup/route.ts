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
  const now = new Date();
  const month = now.getMonth();
  return month < 2 ? now.getFullYear() - 1 : now.getFullYear();
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

    // Pitcher pitch type summary (whiff%, k%, put_away)
    const pitchTypeSummaryQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitcher_pitch_type_summary")
        .select("pitch_type, whiff_percent, k_percent, put_away, pitch_usage, pitches")
        .eq("player_id", pitcherId)
        .eq("season_year", s)
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
    const pitchSummaryMap = new Map<string, { whiff_pct: number | null; k_pct: number | null; put_away: number | null }>();
    for (const row of pitchSummaryRows) {
      if (row.pitch_type) {
        pitchSummaryMap.set(row.pitch_type, {
          whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
          k_pct: row.k_percent != null ? Number(row.k_percent) : null,
          put_away: row.put_away != null ? Number(row.put_away) : null,
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

    const pitcherHand = pitcherBBs.length > 0 ? pitcherBBs[0].pitcher_hand : null;

    // Pitcher arsenal
    const pitchGroups = new Map<string, any[]>();
    for (const bb of pitcherBBs) {
      if (!bb.pitch_type) continue;
      const arr = pitchGroups.get(bb.pitch_type) || [];
      arr.push(bb);
      pitchGroups.set(bb.pitch_type, arr);
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

    const arsenal: PitchArsenalRow[] = [];
    for (const [pt, bbs] of pitchGroups.entries()) {
      const speeds = bbs.map((b: any) => b.pitch_speed).filter((s: any) => s != null && s > 0);
      const seasonUsage = totalPitcherBBs > 0 ? Math.round((bbs.length / totalPitcherBBs) * 100) : 0;
      const l30Bbs = l30PitchGroups.get(pt) || [];
      const l30Usage = totalL30BBs > 0 ? Math.round((l30Bbs.length / totalL30BBs) * 100) : null;
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
      const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);

      const summary = pitchSummaryMap.get(pt);

      arsenal.push({
        pitch_type: pt,
        pitch_name: PITCH_TYPE_NAMES[pt] || pt,
        usage_pct: seasonUsage,
        avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
        baa: computeAVGFromBBs(bbs),
        slg: computeSLGFromEvents(bbs),
        whiff_pct: summary?.whiff_pct ?? null,
        k_pct: summary?.k_pct ?? null,
        put_away: summary?.put_away ?? null,
        total_batted_balls: bbs.length,
        gb_pct: bbs.length >= 5 ? Math.round((gbCount / bbs.length) * 1000) / 10 : null,
        fb_pct: bbs.length >= 5 ? Math.round((fbCount / bbs.length) * 1000) / 10 : null,
        hard_hit_pct: bbs.length >= 5 ? Math.round((hardCount / bbs.length) * 1000) / 10 : null,
        avg_ev: evs.length > 0 ? Math.round(evs.reduce((a: number, b: number) => a + b, 0) / evs.length * 10) / 10 : null,
        woba: computeWOBA(bbs),
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
      if (hBBs.length < 5) return [];
      const groups = new Map<string, any[]>();
      for (const bb of hBBs) {
        if (!bb.pitch_type) continue;
        const arr = groups.get(bb.pitch_type) || [];
        arr.push(bb);
        groups.set(bb.pitch_type, arr);
      }
      const totalH = hBBs.length;
      const results: ArsenalHandSplit[] = [];
      for (const [pt, bbs] of groups.entries()) {
        const speeds = bbs.map((b: any) => b.pitch_speed).filter((s: any) => s != null && s > 0);
        const avg = computeAVGFromBBs(bbs);
        const slg = computeSLGFromEvents(bbs);
        const woba = computeWOBA(bbs);
        results.push({
          pitch_type: pt,
          pitch_name: PITCH_TYPE_NAMES[pt] || pt,
          usage_pct: totalH > 0 ? Math.round((bbs.length / totalH) * 100) : 0,
          avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
          baa: avg != null ? Math.round(avg * 1000) / 1000 : null,
          slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
          iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
          woba: woba != null ? Math.round(woba * 1000) / 1000 : null,
          bbs: bbs.length,
        });
      }
      results.sort((a, b) => b.usage_pct - a.usage_pct);
      return results;
    }

    const arsenalSplits = pitcherBBs.length >= 10 ? {
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

    // Pitch splits
    const pitchSplits: BatterPitchSplit[] = pitcherPitchTypes.map((pt) => {
      const ptBBs = batterBBs.filter((b: any) => b.pitch_type === pt);
      const ptAvg = computeAVGFromBBs(ptBBs);
      const ptSlg = computeSLGFromEvents(ptBBs);
      const ptWoba = computeWOBA(ptBBs);
      const ptEV = computeAvgEV(ptBBs);
      const ptHardHit = computeHardHitPct(ptBBs);
      return {
        pitch_type: pt,
        pitch_name: PITCH_TYPE_NAMES[pt] || pt,
        avg: ptAvg != null ? Math.round(ptAvg * 1000) / 1000 : null,
        slg: ptSlg != null ? Math.round(ptSlg * 1000) / 1000 : null,
        iso: ptAvg != null && ptSlg != null ? Math.round((ptSlg - ptAvg) * 1000) / 1000 : null,
        batted_balls: ptBBs.length,
        hrs: ptBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
        barrel_pct: computeBarrelPct(ptBBs),
        woba: ptWoba != null ? Math.round(ptWoba * 1000) / 1000 : null,
        avg_ev: ptEV != null ? Math.round(ptEV * 10) / 10 : null,
        hard_hit_pct: ptHardHit != null ? Math.round(ptHardHit * 10) / 10 : null,
      };
    });

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
      h2h = {
        pa: h2hBBs.length,
        hits: h2hBBs.filter((b: any) => b.is_hit || (b.event_type || "").toLowerCase() === "home_run").length,
        hrs: h2hBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
        avg: (() => { const v = computeAVGFromBBs(h2hBBs); return v != null ? Math.round(v * 1000) / 1000 : null; })(),
        slg: (() => { const v = computeSLGFromEvents(h2hBBs); return v != null ? Math.round(v * 1000) / 1000 : null; })(),
        last_meetings: lastMeetings,
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
      avg: avg != null ? Math.round(avg * 1000) / 1000 : null,
      slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
      iso: iso != null ? Math.round(iso * 1000) / 1000 : null,
      hr_count: hrs,
      barrel_pct: barrelPct != null ? Math.round(barrelPct * 10) / 10 : null,
      hard_hit_pct: hardHitPct != null ? Math.round(hardHitPct * 10) / 10 : null,
      avg_exit_velo: avgEV != null ? Math.round(avgEV * 10) / 10 : null,
      woba: woba != null ? Math.round(woba * 1000) / 1000 : null,
      total_batted_balls: batterBBs.length,
      pitch_splits: pitchSplits,
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
          };
        }
        return { vs_rhp: computeHS("R"), vs_lhp: computeHS("L") };
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
