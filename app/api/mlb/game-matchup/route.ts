"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ── Types ────────────────────────────────────────────────────────────────────

const PITCH_TYPE_NAMES: Record<string, string> = {
  FF: "4-Seam",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  CU: "Curveball",
  CH: "Changeup",
  FS: "Splitter",
  KC: "Knuckle Curve",
  ST: "Sweeper",
  SV: "Slurve",
  KN: "Knuckleball",
  EP: "Eephus",
  SC: "Screwball",
};

export interface PitchArsenalRow {
  pitch_type: string;
  pitch_name: string;
  usage_pct: number;
  avg_speed: number | null;
  baa: number | null;
  slg: number | null;
  whiff_pct: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  put_away: number | null;
  total_batted_balls: number;
  // Enhanced stats
  gb_pct: number | null;
  fb_pct: number | null;
  hard_hit_pct: number | null;
  avg_ev: number | null;
  woba: number | null;
  // L30 trend data
  l30_usage_pct: number | null;
  l30_baa: number | null;
  l30_slg: number | null;
  l30_avg_speed: number | null;
  usage_trend: "up" | "down" | "flat" | null; // vs season
}

export interface PitcherHandSplit {
  bbs: number; // PA (or batted ball count as fallback)
  avg: number | null;
  slg: number | null;
  iso: number | null;
  woba: number | null;
  hr: number;
  avg_ev: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  gb_pct: number | null;
  k_pct?: number | null;
  bb_pct?: number | null;
  obp?: number | null;
}

export interface ArsenalHandSplit {
  pitch_type: string;
  pitch_name: string;
  usage_pct: number;
  avg_speed: number | null;
  baa: number | null;
  slg: number | null;
  iso: number | null;
  woba: number | null;
  bbs: number;
  whiff_pct: number | null;
  k_pct: number | null;
  bb_pct: number | null;
}

export interface PitcherProfile {
  player_id: number;
  name: string;
  hand: string | null;
  team_id: number | null;
  team_name: string | null;
  team_abbr: string | null;
  // Season aggregate stats from game logs
  era: number | null;
  whip: number | null;
  k_per_9: number | null;
  bb_per_9: number | null;
  hr_per_9: number | null;
  fip: number | null;
  innings_pitched: number | null;
  games_started: number | null;
  opp_avg: number | null;
  wins: number | null;
  losses: number | null;
  // Computed from batted balls
  hr_fb_pct: number | null;
  arsenal: PitchArsenalRow[];
  // Scouting summary (auto-generated)
  scouting_summary: string | null;
  // Recent HRs allowed
  recent_hrs_allowed: { batter_name: string | null; batter_hand: string | null; date: string; pitch_type: string | null; exit_velocity: number | null; distance: number | null }[];
  // 3x3 pitch zone heatmap (zones 1-9, standard strike zone grid)
  pitch_zone_grid: {
    zone: number;
    zone_pct: number | null;
    whiffs: number | null;
    temp: "hot" | "warm" | "lukewarm" | "cold" | null;
  }[] | null;
  // Pitcher splits by batter handedness
  pitcher_splits: {
    vs_lhb: PitcherHandSplit | null;
    vs_rhb: PitcherHandSplit | null;
  };
  // Arsenal splits by batter handedness
  arsenal_splits: {
    vs_lhb: ArsenalHandSplit[];
    vs_rhb: ArsenalHandSplit[];
  } | null;
  // Batted ball zone data: pitch location distribution for HR/hits
  zone_data: {
    total_fb: number;   // fly balls
    total_gb: number;   // ground balls
    total_ld: number;   // line drives
    total_pu: number;   // pop ups
    hr_pct_fb: number | null; // HR as % of fly balls
    hard_hit_pct: number | null;
    avg_ev_against: number | null;
  };
}

export interface BatterPitchSplit {
  pitch_type: string;
  pitch_name: string;
  avg: number | null;
  slg: number | null;
  iso: number | null;
  batted_balls: number;
  hrs: number;
  barrel_pct: number | null;
  woba: number | null;
  avg_ev: number | null;
  hard_hit_pct: number | null;
}

export interface BatterMatchup {
  player_id: number;
  player_name: string;
  team_abbr: string;
  batting_hand: string;
  lineup_position: number | null;
  // Traditional stats from game logs (real PA-based)
  pa: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null;
  hr_count: number;
  // Contact quality from batted balls
  barrel_pct: number | null;
  hard_hit_pct: number | null;
  avg_exit_velo: number | null;
  total_batted_balls: number;
  // Per-pitch-type splits (top pitcher pitches)
  pitch_splits: BatterPitchSplit[];
  // H2H career vs this pitcher (from batted balls)
  h2h: {
    pa: number;
    hits: number;
    hrs: number;
    avg: number | null;
    slg: number | null;
    // Last 3 meeting dates with results
    last_meetings: { date: string; hits: number; hrs: number; pa: number }[];
  } | null;
  // wOBA (estimated from batted balls)
  woba: number | null;
  // Matchup assessment
  matchup_grade: "strong" | "neutral" | "weak";
  matchup_reason: string;
  // HR matchup score (0-100, composite of power + matchup factors, NOT a %)
  hr_probability_score: number | null;
  hr_factors: { label: string; positive: boolean }[];
  // Pitch overlap: % of pitcher's top 3 pitches (weighted by usage) batter slugs .400+ vs
  overlap_score: number | null;
  // Recent form (last 60 days)
  recent_barrel_pct: number | null;
  recent_avg_ev: number | null;
  recent_hr_count: number;
  // Sparkline: last ~8 game dates avg EV
  recent_ev_sparkline: number[];
  // Plate discipline (from game logs, respects sample filter)
  k_pct: number | null;
  bb_pct: number | null;
  // Hand splits: vs RHP and vs LHP
  hand_splits: {
    vs_rhp: { avg: number | null; slg: number | null; iso: number | null; woba: number | null; hr: number; ev: number | null; brl: number | null; bbs: number; k_pct: number | null; bb_pct: number | null } | null;
    vs_lhp: { avg: number | null; slg: number | null; iso: number | null; woba: number | null; hr: number; ev: number | null; brl: number | null; bbs: number; k_pct: number | null; bb_pct: number | null } | null;
  };
  // Pitch splits crossed with pitcher handedness (for combined filters)
  pitch_hand_splits?: {
    vs_rhp: BatterPitchSplit[];
    vs_lhp: BatterPitchSplit[];
  };
}

export interface GameMatchupResponse {
  game: {
    game_id: number;
    game_date: string;
    game_datetime: string | null;
    venue_name: string | null;
    venue_id: number | null;
    home_team: { id: number; name: string; abbr: string };
    away_team: { id: number; name: string; abbr: string };
    home_pitcher_id: number | null;
    away_pitcher_id: number | null;
    home_pitcher_name: string | null;
    away_pitcher_name: string | null;
  };
  pitcher: PitcherProfile;
  batters: BatterMatchup[];
  summary: {
    strong_count: number;
    neutral_count: number;
    weak_count: number;
    strong_names: string[];
    key_insight: string | null;
    lineup_grade: string; // A+, A, B+, B, C+, C, D
    top_hr_targets: { name: string; slg: number | null; iso: number | null; hr_count: number }[];
    pitcher_tags: { label: string; type: "vulnerability" | "strength" }[];
  };
  meta: {
    batting_side: "home" | "away";
    sample: string;
    pitcher_pitch_types: string[];
    lineup_confirmed: boolean;
  };
}

// ── Query Schema ────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  gameId: z.coerce.number().int().positive(),
  battingSide: z.enum(["home", "away"]).optional().default("away"),
  sample: z.enum(["season", "30", "15", "7"]).optional().default("season"),
  statSeason: z.coerce.number().int().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCurrentSeason(): number {
  // Use prior year until April to avoid spring training data pollution.
  // Spring training batted balls have tiny samples that produce misleading stats.
  // Regular season data typically starts flowing late March / early April.
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 3=Apr
  return month < 3 ? now.getFullYear() - 1 : now.getFullYear();
}

/**
 * Filter batted balls by sample (game count).
 * "season" = no filter; "30"/"15"/"7" = keep only BBs from the most recent N game dates.
 */
function filterBBsBySample(bbs: any[], sample: string): any[] {
  if (sample === "season" || bbs.length === 0) return bbs;
  const gameLimit = parseInt(sample, 10);
  // Collect unique game dates, sort descending
  const dates = [...new Set(bbs.map((b: any) => b.game_date as string))].sort().reverse();
  const keepDates = new Set(dates.slice(0, gameLimit));
  return bbs.filter((b: any) => keepDates.has(b.game_date));
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
  const barrels = bbs.filter((b: any) => b.is_barrel).length;
  return (barrels / bbs.length) * 100;
}

function computeHardHitPct(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  const hard = bbs.filter((b: any) => b.hardness === "hard").length;
  return (hard / bbs.length) * 100;
}

function computeAvgEV(bbs: any[]): number | null {
  const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);
  if (evs.length === 0) return null;
  return evs.reduce((a: number, b: number) => a + b, 0) / evs.length;
}

// Simplified wOBA from batted ball events (linear weights approximation)
// Using 2024 wOBA weights: 1B=0.888, 2B=1.271, 3B=1.616, HR=2.101
function computeWOBA(bbs: any[]): number | null {
  if (bbs.length === 0) return null;
  let weighted = 0;
  for (const bb of bbs) {
    const evt = (bb.event_type || "").toLowerCase();
    if (evt === "home_run") weighted += 2.101;
    else if (evt === "triple") weighted += 1.616;
    else if (evt === "double") weighted += 1.271;
    else if (bb.is_hit) weighted += 0.888; // single
    // outs contribute 0
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

  // Strong: high SLG vs primary pitch + platoon or high ISO
  if (pSlg >= 0.450 && (hasPlatoon || iso >= 0.200)) {
    const reason = `${pSlg >= 0.500 ? "elite" : "high"} SLG vs ${pitcher.primary_pitch_type ?? "primary pitch"} (.${Math.round(pSlg * 1000)})${hasPlatoon ? " + platoon advantage" : ""}`;
    return { grade: "strong", reason };
  }
  if (slg >= 0.500 && iso >= 0.200 && barrelPct >= 10) {
    return { grade: "strong", reason: `elite power profile (${slg.toFixed(3)} SLG, ${barrelPct.toFixed(1)}% Brl)` };
  }

  // Weak: low SLG vs primary or low ISO
  if (pSlg < 0.350 && pSlg > 0) {
    return { grade: "weak", reason: `low SLG vs ${pitcher.primary_pitch_type ?? "primary pitch"} (.${Math.round(pSlg * 1000)})` };
  }
  if (iso < 0.120 && slg < 0.380) {
    return { grade: "weak", reason: `below-avg power (${slg.toFixed(3)} SLG, .${Math.round(iso * 1000)} ISO)` };
  }

  // Neutral
  const reasons: string[] = [];
  if (hasPlatoon) reasons.push("platoon advantage");
  if (pSlg >= 0.400) reasons.push(`solid vs ${pitcher.primary_pitch_type ?? "primary"}`);
  if (iso >= 0.180) reasons.push("good power");
  return {
    grade: "neutral",
    reason: reasons.length > 0 ? reasons.join(", ") : "mixed signals",
  };
}

function generateKeyInsight(
  pitcher: PitcherProfile,
  batters: BatterMatchup[]
): string | null {
  if (!pitcher.arsenal.length || !batters.length) return null;
  const primary = pitcher.arsenal[0];
  if (!primary) return null;

  const strongBatters = batters.filter((b) => b.matchup_grade === "strong");
  const primarySluggers = batters
    .filter((b) => {
      const split = b.pitch_splits.find((s) => s.pitch_type === primary.pitch_type);
      return split && split.slg != null && split.slg >= 0.450;
    })
    .map((b) => b.player_name.split(" ").pop());

  if (primarySluggers.length >= 2) {
    return `${pitcher.name} throws ${primary.usage_pct}% ${primary.pitch_name}s. ${primarySluggers.join(", ")} all slug over .450 vs ${primary.pitch_name.toLowerCase()}s — ${strongBatters.length} strong HR candidate${strongBatters.length !== 1 ? "s" : ""} in this lineup.`;
  }
  if (strongBatters.length >= 3) {
    return `${strongBatters.length} batters have strong matchups against ${pitcher.name}. Focus on ${strongBatters.slice(0, 3).map((b) => b.player_name.split(" ").pop()).join(", ")}.`;
  }
  if (strongBatters.length === 0) {
    return `Tough matchup for this lineup — ${pitcher.name}'s ${primary.pitch_name.toLowerCase()} (${primary.usage_pct}% usage) neutralizes most of these batters.`;
  }
  return null;
}

function generateScoutingSummary(p: PitcherProfile, zoneBBs: any[], seasonYear?: number): string | null {
  if (!p.arsenal.length) return null;
  const parts: string[] = [];
  const seasonLabel = seasonYear ? `in ${seasonYear}` : "this season";

  // Pitch mix overview
  const primary = p.arsenal[0];
  const secondary = p.arsenal[1];
  parts.push(`${p.name} is a ${p.hand === "L" ? "left" : "right"}-handed pitcher who relies primarily on his ${primary.pitch_name.toLowerCase()} (${primary.usage_pct}% usage, ${primary.avg_speed ?? "?"} mph).`);

  if (secondary && secondary.usage_pct >= 15) {
    parts.push(`His secondary pitch is the ${secondary.pitch_name.toLowerCase()} at ${secondary.usage_pct}%.`);
  }

  // ERA/performance context
  if (p.era != null) {
    if (p.era <= 3.20) parts.push(`He was dominant ${seasonLabel} with a ${p.era} ERA.`);
    else if (p.era >= 4.50) parts.push(`He was hittable ${seasonLabel} with a ${p.era} ERA.`);
  }

  // Vulnerability highlights
  const hittablePitches = p.arsenal.filter((a) => a.slg != null && a.slg >= 0.480 && a.usage_pct >= 10);
  if (hittablePitches.length > 0) {
    const names = hittablePitches.map((a) => `${a.pitch_name.toLowerCase()} (.${Math.round((a.slg ?? 0) * 1000)} SLG)`).join(" and ");
    parts.push(`Batters hit his ${names} hard ${seasonLabel}.`);
  }

  // HR tendency
  if (p.hr_fb_pct != null && p.hr_fb_pct >= 13) {
    parts.push(`${p.hr_fb_pct}% of his fly balls have left the yard — above average HR vulnerability.`);
  }

  // K/BB tendency
  if (p.k_per_9 != null && p.bb_per_9 != null) {
    if (p.k_per_9 >= 10 && p.bb_per_9 <= 2.5) parts.push("He's a strikeout pitcher with excellent command.");
    else if (p.bb_per_9 >= 3.5) parts.push("Control is a concern — he walks too many batters.");
  }

  return parts.join(" ");
}

function computeLineupGrade(batters: BatterMatchup[]): string {
  if (batters.length === 0) return "C";
  // Score: strong=3, neutral=1.5, weak=0
  const score = batters.reduce((s, b) => {
    if (b.matchup_grade === "strong") return s + 3;
    if (b.matchup_grade === "neutral") return s + 1.5;
    return s;
  }, 0);
  const avg = score / batters.length;
  // Also factor in lineup power
  const avgSlg = batters.filter(b => b.slg != null).reduce((s, b) => s + b.slg!, 0) / Math.max(batters.filter(b => b.slg != null).length, 1);
  const powerBonus = avgSlg >= 0.500 ? 0.5 : avgSlg >= 0.450 ? 0.25 : 0;
  const finalScore = avg + powerBonus;

  if (finalScore >= 2.8) return "A+";
  if (finalScore >= 2.4) return "A";
  if (finalScore >= 2.0) return "B+";
  if (finalScore >= 1.6) return "B";
  if (finalScore >= 1.2) return "C+";
  if (finalScore >= 0.8) return "C";
  return "D";
}

function computePitcherTags(pitcher: PitcherProfile): { label: string; type: "vulnerability" | "strength" }[] {
  const tags: { label: string; type: "vulnerability" | "strength" }[] = [];

  // Vulnerabilities (green for batters)
  if (pitcher.hr_per_9 != null && pitcher.hr_per_9 >= 1.4)
    tags.push({ label: `High HR/9 (${pitcher.hr_per_9})`, type: "vulnerability" });
  if (pitcher.hr_fb_pct != null && pitcher.hr_fb_pct >= 14)
    tags.push({ label: `High HR/FB (${pitcher.hr_fb_pct}%)`, type: "vulnerability" });
  if (pitcher.era != null && pitcher.era >= 4.5)
    tags.push({ label: `High ERA (${pitcher.era})`, type: "vulnerability" });
  if (pitcher.bb_per_9 != null && pitcher.bb_per_9 >= 3.5)
    tags.push({ label: `High BB/9 (${pitcher.bb_per_9})`, type: "vulnerability" });
  if (pitcher.whip != null && pitcher.whip >= 1.35)
    tags.push({ label: `High WHIP (${pitcher.whip})`, type: "vulnerability" });

  // Arsenal vulnerabilities
  for (const pitch of pitcher.arsenal.slice(0, 3)) {
    if (pitch.slg != null && pitch.slg >= 0.500 && pitch.usage_pct >= 15)
      tags.push({ label: `${pitch.pitch_name} hittable (.${Math.round(pitch.slg * 1000)} SLG)`, type: "vulnerability" });
  }

  // Strengths (red for batters)
  if (pitcher.k_per_9 != null && pitcher.k_per_9 >= 10)
    tags.push({ label: `Elite K/9 (${pitcher.k_per_9})`, type: "strength" });
  if (pitcher.era != null && pitcher.era <= 3.0)
    tags.push({ label: `Low ERA (${pitcher.era})`, type: "strength" });
  if (pitcher.fip != null && pitcher.fip <= 3.0)
    tags.push({ label: `Elite FIP (${pitcher.fip})`, type: "strength" });
  if (pitcher.whip != null && pitcher.whip <= 1.05)
    tags.push({ label: `Low WHIP (${pitcher.whip})`, type: "strength" });

  for (const pitch of pitcher.arsenal.slice(0, 3)) {
    if (pitch.baa != null && pitch.baa <= 0.200 && pitch.usage_pct >= 15)
      tags.push({ label: `${pitch.pitch_name} dominant (.${Math.round(pitch.baa * 1000)} BAA)`, type: "strength" });
  }

  return tags;
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      gameId: searchParams.get("gameId"),
      battingSide: searchParams.get("battingSide") ?? undefined,
      sample: searchParams.get("sample") ?? undefined,
      statSeason: searchParams.get("statSeason") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { gameId, battingSide, sample, statSeason } = parsed.data;
    const supabase = createServerSupabaseClient();
    const season = statSeason ?? getCurrentSeason();
    // Always show exactly the selected season — no cross-season fallback
    const noFallback = true;
    console.log(`[game-matchup] statSeason=${statSeason}, season=${season}, noFallback=${noFallback}`);
    // ── Round 1: Game info + Lineup (parallel) ──────────────────────────────

    const [gameResult, lineupResult] = await Promise.all([
      supabase
        .from("mlb_games")
        .select(`
          game_id, game_date, game_datetime, venue_id,
          home_name, away_name, home_id, away_id,
          home_probable_pitcher, away_probable_pitcher,
          home_probable_pitcher_id, away_probable_pitcher_id
        `)
        .eq("game_id", gameId)
        .limit(1),
      supabase
        .from("mlb_hit_rate_profiles")
        .select("player_id, player_name, team_id, team_abbr, market, home_away")
        .eq("game_id", gameId),
    ]);

    if (gameResult.error) {
      console.error("[/api/mlb/game-matchup] Game lookup failed:", gameResult.error.message, "gameId:", gameId);
      return NextResponse.json(
        { error: "Game not found", details: gameResult.error.message },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!gameResult.data || gameResult.data.length === 0) {
      console.error("[/api/mlb/game-matchup] No game found for gameId:", gameId);
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const game = gameResult.data[0] as any;
    const homeTeamId = game.home_id;
    const awayTeamId = game.away_id;

    // Get team abbreviations + venue name in parallel
    const teamIds = [homeTeamId, awayTeamId].filter(Boolean);
    const [teamResult, venueResult] = await Promise.all([
      teamIds.length > 0
        ? supabase.from("mlb_teams").select("team_id, abbreviation").in("team_id", teamIds)
        : Promise.resolve({ data: [] }),
      game.venue_id
        ? supabase.from("mlb_venues").select("venue_id, name").eq("venue_id", game.venue_id).limit(1)
        : Promise.resolve({ data: [] }),
    ]);

    const teamMap = new Map<number, string>();
    for (const t of (teamResult.data ?? []) as any[]) {
      teamMap.set(t.team_id, t.abbreviation);
    }
    const homeAbbr = teamMap.get(homeTeamId) || "";
    const awayAbbr = teamMap.get(awayTeamId) || "";
    const venueName = (venueResult.data as any[])?.[0]?.name || null;

    // Determine which team is batting and who is pitching
    const battingTeamId = battingSide === "home" ? homeTeamId : awayTeamId;
    const battingTeamAbbr = battingSide === "home" ? homeAbbr : awayAbbr;
    const pitcherId = battingSide === "home"
      ? game.away_probable_pitcher_id
      : game.home_probable_pitcher_id;
    const pitcherName = battingSide === "home"
      ? game.away_probable_pitcher
      : game.home_probable_pitcher;
    const pitcherTeamId = battingSide === "home" ? awayTeamId : homeTeamId;
    const pitcherTeamAbbr = battingSide === "home" ? awayAbbr : homeAbbr;
    const pitcherTeamName = battingSide === "home" ? game.away_name : game.home_name;

    // Filter lineup to the batting team, deduplicate by player_id
    const allProfiles = (lineupResult.data ?? []) as any[];
    const seenIds = new Set<number>();
    let lineup = allProfiles.filter((p: any) => {
      if (p.team_id !== battingTeamId) return false;
      if (seenIds.has(p.player_id)) return false;
      seenIds.add(p.player_id);
      return true;
    }).map((p: any) => ({
      player_id: p.player_id,
      player_name: p.player_name,
      team_id: p.team_id,
      team_abbr: p.team_abbr || battingTeamAbbr,
      batting_hand: "R", // Will be resolved from batted balls
      lineup_position: null as number | null,
    }));

    // Fallback: if no lineup from hit_rate_profiles for THIS game,
    // get the most recent profiles for this team from ANY game date
    if (lineup.length === 0 && battingTeamId) {
      const { data: fallbackProfiles } = await supabase
        .from("mlb_hit_rate_profiles")
        .select("player_id, player_name, team_id, team_abbr, game_date")
        .eq("team_id", battingTeamId)
        .order("game_date", { ascending: false })
        .limit(500);

      if (fallbackProfiles && fallbackProfiles.length > 0) {
        // Deduplicate — take the most recent entry per player
        const fbSeen = new Set<number>();
        lineup = fallbackProfiles.filter((p: any) => {
          if (fbSeen.has(p.player_id)) return false;
          fbSeen.add(p.player_id);
          return true;
        }).slice(0, 15).map((p: any) => ({
          player_id: p.player_id,
          player_name: p.player_name,
          team_id: p.team_id,
          team_abbr: p.team_abbr || battingTeamAbbr,
          batting_hand: "R", // Will be resolved from batted balls
          lineup_position: null as number | null,
        }));
      }
    }

    // ── Enrich with batting order from mlb_daily_lineups ─────────────────
    const lineupSide = battingSide === "home" ? "home" : "away";
    const { data: dailyLineup } = await supabase
      .from("mlb_daily_lineups")
      .select("player_id, batting_order, is_confirmed")
      .eq("game_id", gameId)
      .eq("side", lineupSide)
      .gt("batting_order", 0)
      .order("batting_order", { ascending: true });

    // Check if any lineup entry is confirmed
    let lineupConfirmed = false;
    if (dailyLineup && dailyLineup.length > 0) {
      lineupConfirmed = dailyLineup.some((dl: any) => dl.is_confirmed === true);
      const orderMap = new Map<number, number>();
      for (const dl of dailyLineup) {
        orderMap.set(dl.player_id, dl.batting_order);
      }
      // Set lineup_position from daily lineups
      for (const p of lineup) {
        const order = orderMap.get(p.player_id);
        if (order != null) p.lineup_position = order;
      }

      // Inject players from daily lineups that are missing from profiles
      // (e.g. new players, traded players not yet in mlb_hit_rate_profiles)
      const existingIds = new Set(lineup.map((p: any) => p.player_id));
      const missingDailyIds = dailyLineup
        .filter((dl: any) => dl.batting_order >= 1 && dl.batting_order <= 9 && !existingIds.has(dl.player_id))
        .map((dl: any) => dl.player_id);

      if (missingDailyIds.length > 0) {
        // Fetch player info from mlb_players_hr
        const { data: missingPlayers } = await supabase
          .from("mlb_players_hr")
          .select("mlb_player_id, name, team_id, bat_hand")
          .in("mlb_player_id", missingDailyIds);

        if (missingPlayers && missingPlayers.length > 0) {
          for (const mp of missingPlayers) {
            const dlEntry = dailyLineup.find((dl: any) => dl.player_id === mp.mlb_player_id);
            lineup.push({
              player_id: mp.mlb_player_id,
              player_name: mp.name,
              team_id: mp.team_id || battingTeamId,
              team_abbr: battingTeamAbbr,
              batting_hand: mp.bat_hand || "R",
              lineup_position: dlEntry ? dlEntry.batting_order : null,
            });
          }
          console.log(`[game-matchup] Injected ${missingPlayers.length} players from daily lineups: ${missingPlayers.map((p: any) => p.name).join(", ")}`);
        }
      }

      // Filter to only starters (batting_order 1-9)
      // Keep all if no one matched (fallback)
      const starters = lineup.filter((p: any) => p.lineup_position != null && p.lineup_position >= 1 && p.lineup_position <= 9);
      if (starters.length >= 5) {
        lineup = starters;
      }
    }

    const batterIds = lineup.map((p: any) => p.player_id);

    console.log(`[/api/mlb/game-matchup] lineup=${lineup.length} (dailyLineup=${dailyLineup?.length ?? 0}) batterIds=[${batterIds.slice(0, 5).join(",")}] battingTeamId=${battingTeamId} allProfiles=${allProfiles.length} profileTeamIds=[${[...new Set(allProfiles.map((p: any) => p.team_id))].join(",")}]`);

    if (!pitcherId) {
      // No probable pitcher set — return basic structure
      return NextResponse.json(
        {
          game: buildGameResponse(game, homeAbbr, awayAbbr, venueName),
          pitcher: null,
          batters: lineup.map((p: any) => buildEmptyBatter(p)),
          summary: { strong_count: 0, neutral_count: 0, weak_count: 0, strong_names: [], key_insight: null, lineup_grade: "C", top_hr_targets: [], pitcher_tags: [] },
          meta: { batting_side: battingSide, sample, pitcher_pitch_types: [], lineup_confirmed: lineupConfirmed },
        },
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
      );
    }

    // ── Round 2: Pitcher data + Batter data (parallel) ──────────────────────

    // Try current season first; if no data, fall back to prior season
    // When user explicitly selects a season, we still query both but skip fallback below
    const seasonsToTry = [season, season - 1];

    const bbSelect = "batter_id, pitcher_id, exit_velocity, launch_angle, total_distance, trajectory, hardness, pitch_type, pitch_speed, event_type, is_hit, is_barrel, is_out, game_date, pitcher_hand, batter_hand";

    // Query both seasons in parallel for pitcher + batter BBs to pick the one with data
    // Always fetch all season data; sample filtering is applied post-query by game count
    const pitcherBBQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batted_balls")
        .select(bbSelect)
        .eq("pitcher_id", pitcherId)
        .eq("season", s)
        .limit(5000) // Pitcher can have ~800 BBs/season
    );

    const batterBBQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batted_balls")
        .select(bbSelect)
        .in("batter_id", batterIds.length > 0 ? batterIds : [0])
        .eq("season", s)
        .limit(10000) // 9 batters * ~500 BBs = ~4500; must exceed Supabase default of 1000
    );

    // H2H: all-time batter vs pitcher (no season filter)
    const h2hQuery = supabase
      .from("mlb_batted_balls")
      .select(bbSelect)
      .in("batter_id", batterIds.length > 0 ? batterIds : [0])
      .eq("pitcher_id", pitcherId);

    // Pitcher game logs — try both seasons
    const pitcherLogsQueries = seasonsToTry.map((s) =>
      supabase.rpc("get_mlb_pitcher_game_logs", {
        p_player_id: pitcherId,
        p_season: s,
        p_limit: 100,
        p_include_prior: false,
      })
    );

    // Recent form: last 60 days (covers offseason gaps)
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 60);
    const recentBBQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batted_balls")
        .select(bbSelect)
        .in("batter_id", batterIds.length > 0 ? batterIds : [0])
        .eq("season", s)
        .gte("game_date", recentCutoff.toISOString().slice(0, 10))
    );

    // L30 pitcher batted balls (for arsenal trend comparison)
    const l30Cutoff = new Date();
    l30Cutoff.setDate(l30Cutoff.getDate() - 30);
    const pitcherL30Queries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batted_balls")
        .select(bbSelect)
        .eq("pitcher_id", pitcherId)
        .eq("season", s)
        .gte("game_date", l30Cutoff.toISOString().slice(0, 10))
    );

    // Pitcher pitch type summary (season stats with whiff%, k%, put_away)
    // Try both table names: original and the new populated table
    const pitchTypeSummaryQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitcher_pitchtype_summary")
        .select("pitch_type, whiff_percent, k_percent, put_away, pitch_usage, pitches, ba, obp, slg, woba")
        .eq("player_id", pitcherId)
        .eq("season_year", s)
    );

    // Pitcher pitch type hand splits (whiff% vs LHB/RHB per pitch type)
    const pitcherHandSplitQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_pitcher_pitchtype_hand_splits")
        .select("pitch_type, opponent_hand, whiff_percent, ba, slg, woba, hard_hit_percent, pitches, pa, ab, hits, home_runs, strikeouts, k_percent, bb_percent, obp, iso, barrel_percent, avg_exit_velocity, singles, doubles, triples")
        .eq("player_id", pitcherId)
        .eq("season_year", s)
    );

    // Pitcher hot zone (3x3 grid) — always season for stable zone distribution
    const pitcherHotZoneQuery = supabase.rpc("get_mlb_hot_zone_matchup", {
      p_batter_id: batterIds[0] ?? 0, // required param, we only use pitcher zones
      p_pitcher_id: pitcherId,
      p_batter_window: "season",
      p_pitcher_window: "season",
      p_season: season,
    });

    // Batter game logs for full traditional stats (one RPC per batter, parallelized)
    // Query both current and prior season so early-season batters fall back to prior year
    const batterGameLogQueries = batterIds.map((bid) =>
      supabase.rpc("get_mlb_batter_game_logs", {
        p_player_id: bid,
        p_season: season,
        p_limit: 500,
        p_include_prior: false,
      })
    );
    // No fallback queries — show only the selected season's data

    // Batter hand splits (real stats from Savant — BA, OBP, SLG, K%, BB% vs L/R)
    const batterHandSplitQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batter_pitchtype_hand_splits")
        .select("player_id, opponent_hand, pitch_type, pa, ab, hits, home_runs, strikeouts, ba, obp, slg, iso, woba, k_percent, bb_percent, whiff_percent, barrel_percent, hard_hit_percent, avg_exit_velocity")
        .in("player_id", batterIds)
        .eq("season_year", s)
    );

    // Batter pitch type summary (real stats per pitch type, NOT split by hand)
    const batterPitchSummaryQueries = seasonsToTry.map((s) =>
      supabase
        .from("mlb_batter_pitchtype_summary")
        .select("player_id, pitch_type, pa, ba, slg, iso, obp, woba, k_percent, whiff_percent, hard_hit_percent, barrel_batted_rate, exit_velocity_avg, pitches")
        .in("player_id", batterIds)
        .eq("season_year", s)
    );

    // Fire all queries in parallel
    const allResults = await Promise.all([
      ...pitcherBBQueries,    // [0, 1] = pitcher BBs for season, season-1
      ...batterBBQueries,     // [2, 3] = batter BBs for season, season-1
      h2hQuery,               // [4]
      ...pitcherLogsQueries,  // [5, 6] = pitcher logs for season, season-1
      ...recentBBQueries,     // [7, 8] = recent BBs for season, season-1
      ...pitcherL30Queries,   // [9, 10] = pitcher L30 BBs for season, season-1
      ...pitchTypeSummaryQueries, // [11, 12] = pitch type summary for season, season-1
      pitcherHotZoneQuery,     // [13] = pitcher hot zone grid
      ...pitcherHandSplitQueries, // [14, 15] = pitcher pitchtype hand splits for season, season-1
      ...batterHandSplitQueries,  // [16, 17] = batter hand splits for season, season-1
      ...batterPitchSummaryQueries, // [18, 19] = batter pitch type summary for season, season-1
      ...batterGameLogQueries, // [20..20+N-1] = batter game logs (one per batter)
    ]);

    // Pick the season that has data (prefer current, fall back to prior)
    const pitcherBBsCurrent = (allResults[0].data ?? []) as any[];
    const pitcherBBsFallback = (allResults[1].data ?? []) as any[];
    const batterBBsCurrent = (allResults[2].data ?? []) as any[];
    const batterBBsFallback = (allResults[3].data ?? []) as any[];
    const h2hResult = allResults[4];
    const pitcherLogsCurrent = Array.isArray(allResults[5].data) ? allResults[5].data : [];
    const pitcherLogsFallback = Array.isArray(allResults[6].data) ? allResults[6].data : [];
    const recentBBsCurrent = (allResults[7].data ?? []) as any[];
    const recentBBsFallback = (allResults[8].data ?? []) as any[];

    const pitcherL30Current = (allResults[9].data ?? []) as any[];
    const pitcherL30Fallback = (allResults[10].data ?? []) as any[];
    const pitchSummaryCurrent = (allResults[11].data ?? []) as any[];
    const pitchSummaryFallback = (allResults[12].data ?? []) as any[];

    // No fallback — use only the selected season's data
    const pitcherBBs = filterBBsBySample(pitcherBBsCurrent, sample);
    const batterBBsRaw = filterBBsBySample(batterBBsCurrent, sample);
    const allLogs = pitcherLogsCurrent;
    const logs = sample !== "season" ? allLogs.slice(0, Number(sample)) : allLogs;
    const recentBBsRaw = recentBBsCurrent;
    const pitcherL30BBs = pitcherL30Current;
    const pitchSummaryRows = pitchSummaryCurrent;

    // Build pitch type summary lookup: pitch_type -> { whiff_percent, k_percent, put_away, ... }
    const pitchSummaryMap = new Map<string, { whiff_pct: number | null; k_pct: number | null; bb_pct: number | null; put_away: number | null; ba: number | null; obp: number | null; slg: number | null; woba: number | null; pitch_usage: number | null; pitches: number | null }>();
    for (const row of pitchSummaryRows) {
      if (row.pitch_type) {
        pitchSummaryMap.set(row.pitch_type, {
          whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
          k_pct: row.k_percent != null ? Number(row.k_percent) : null,
          bb_pct: null, // Not in pitchtype_summary table — enriched from hand splits below
          put_away: row.put_away != null ? Number(row.put_away) : null,
          ba: row.ba != null ? Number(row.ba) : null,
          obp: row.obp != null ? Number(row.obp) : null,
          slg: row.slg != null ? Number(row.slg) : null,
          woba: row.woba != null ? Number(row.woba) : null,
          pitch_usage: row.pitch_usage != null ? Number(row.pitch_usage) : null,
          pitches: row.pitches != null ? Number(row.pitches) : null,
        });
      }
    }

    // Note: bb_pct enrichment for pitchSummaryMap happens below after pitcherHandSplits are resolved

    // Extract pitcher hot zone grid (zones 1-9)
    const hotZoneRaw = allResults[13]?.data;
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

    // Build batter game log lookup: batterId -> full traditional stats (respects sample filter)
    interface BatterTraditionalStats {
      pa: number; ab: number; hits: number; hr: number; doubles: number; triples: number;
      rbi: number; bb: number; k: number; hbp: number; sb: number;
      avg: number | null; obp: number | null; slg: number | null; ops: number | null;
      iso: number | null; k_pct: number | null; bb_pct: number | null;
      total_bases: number; games: number;
    }
    const batterTraditionalMap = new Map<number, BatterTraditionalStats>();
    // Pitcher pitchtype hand splits (whiff% vs LHB/RHB)
    const pitcherHandSplitsCurrent = (allResults[14].data ?? []) as any[];
    const pitcherHandSplitsFallback = (allResults[15].data ?? []) as any[];
    const pitcherHandSplitsRaw = pitcherHandSplitsCurrent;
    // Build lookup: "pitch_type:hand" -> whiff_percent
    const pitcherHandWhiffMap = new Map<string, number | null>();
    for (const row of pitcherHandSplitsRaw) {
      pitcherHandWhiffMap.set(`${row.pitch_type}:${row.opponent_hand}`, row.whiff_percent);
    }

    // Enrich pitchSummaryMap with bb_pct from hand splits (PA-weighted across L/R)
    for (const row of pitcherHandSplitsRaw) {
      if (!row.pitch_type || row.bb_percent == null) continue;
      const existing = pitchSummaryMap.get(row.pitch_type);
      if (existing) {
        const pa = Number(row.pa) || 0;
        if (existing.bb_pct == null) {
          (existing as any)._bbW = Number(row.bb_percent) * pa;
          (existing as any)._bbPA = pa;
          existing.bb_pct = Math.round(Number(row.bb_percent) * 10) / 10;
        } else {
          const prevW = (existing as any)._bbW || 0;
          const prevPA = (existing as any)._bbPA || 0;
          const totalPA = prevPA + pa;
          if (totalPA > 0) {
            existing.bb_pct = Math.round(((prevW + Number(row.bb_percent) * pa) / totalPA) * 10) / 10;
            (existing as any)._bbW = prevW + Number(row.bb_percent) * pa;
            (existing as any)._bbPA = totalPA;
          }
        }
      }
    }

    // Batter hand splits — selected season only
    const batterHandSplitsCurrent = (allResults[16].data ?? []) as any[];
    const batterHandSplitsRaw = batterHandSplitsCurrent;


    // Build batter hand splits lookup: playerId -> { L: aggregate, R: aggregate }
    interface BatterHandSplitAgg {
      pa: number; ab: number; hits: number; hr: number;
      avg: number | null; obp: number | null; slg: number | null;
      iso: number | null; woba: number | null;
      k_pct: number | null; bb_pct: number | null;
      ev: number | null; brl: number | null;
    }
    const batterHandSplitMap = new Map<string, BatterHandSplitAgg>(); // key: "playerId:hand"
    {
      // Group by player + hand
      const grouped = new Map<string, any[]>();
      for (const row of batterHandSplitsRaw) {
        const key = `${row.player_id}:${row.opponent_hand}`;
        const arr = grouped.get(key) || [];
        arr.push(row);
        grouped.set(key, arr);
      }
      for (const [key, rows] of grouped) {
        let totalPA = 0, totalAB = 0, totalH = 0, totalHR = 0, totalK = 0;
        let weightedBA = 0, weightedSLG = 0, weightedISO = 0, weightedWOBA = 0;
        let weightedEV = 0, evW = 0, weightedBrl = 0, brlW = 0;
        let weightedK = 0, kW = 0, weightedBB = 0, bbW = 0;

        for (const r of rows) {
          const pa = Number(r.pa ?? 0), ab = Number(r.ab ?? 0);
          totalPA += pa; totalAB += ab;
          totalH += Number(r.hits ?? 0);
          totalHR += Number(r.home_runs ?? 0);
          totalK += Number(r.strikeouts ?? 0);
          // Use AB-weighting when AB available, fall back to PA-weighting
          const baWeight = ab > 0 ? ab : pa;
          if (r.ba != null && baWeight > 0) { weightedBA += Number(r.ba) * baWeight; }
          if (r.slg != null && baWeight > 0) { weightedSLG += Number(r.slg) * baWeight; }
          if (r.iso != null && baWeight > 0) { weightedISO += Number(r.iso) * baWeight; }
          if (r.woba != null && pa > 0) weightedWOBA += Number(r.woba) * pa;
          if (r.avg_exit_velocity != null && pa > 0) { weightedEV += Number(r.avg_exit_velocity) * pa; evW += pa; }
          if (r.barrel_percent != null && pa > 0) { weightedBrl += Number(r.barrel_percent) * pa; brlW += pa; }
          if (r.k_percent != null && pa > 0) { weightedK += Number(r.k_percent) * pa; kW += pa; }
          if (r.bb_percent != null && pa > 0) { weightedBB += Number(r.bb_percent) * pa; bbW += pa; }
        }

        // Total weight for BA/SLG/ISO: prefer AB, fall back to PA
        const baWeightTotal = totalAB > 0 ? totalAB : totalPA;

        // Also aggregate OBP across all pitch type rows (PA-weighted)
        let weightedOBP = 0, obpW = 0;
        for (const r of rows) {
          const pa = Number(r.pa ?? 0);
          if (r.obp != null && pa > 0) { weightedOBP += Number(r.obp) * pa; obpW += pa; }
        }

        batterHandSplitMap.set(key, {
          pa: totalPA, ab: totalAB, hits: totalH, hr: totalHR,
          avg: baWeightTotal > 0 && weightedBA > 0 ? Math.round((weightedBA / baWeightTotal) * 1000) / 1000 : null,
          obp: obpW > 0 ? Math.round((weightedOBP / obpW) * 1000) / 1000 : null,
          slg: baWeightTotal > 0 && weightedSLG > 0 ? Math.round((weightedSLG / baWeightTotal) * 1000) / 1000 : null,
          iso: baWeightTotal > 0 && weightedISO > 0 ? Math.round((weightedISO / baWeightTotal) * 1000) / 1000 : null,
          woba: totalPA > 0 ? Math.round((weightedWOBA / totalPA) * 1000) / 1000 : null,
          k_pct: kW > 0 ? Math.round((weightedK / kW) * 10) / 10 : null,
          bb_pct: bbW > 0 ? Math.round((weightedBB / bbW) * 10) / 10 : null,
          ev: evW > 0 ? Math.round((weightedEV / evW) * 10) / 10 : null,
          brl: brlW > 0 ? Math.round((weightedBrl / brlW) * 10) / 10 : null,
        });
      }
    }

    // Batter pitch type summary — selected season only
    const batterPitchSumCurrent = (allResults[18].data ?? []) as any[];
    const batterPitchSumRaw = batterPitchSumCurrent;

    // Build lookup: "playerId:pitchType" -> real stats
    const batterPitchSumMap = new Map<string, {
      ba: number | null; slg: number | null; iso: number | null; woba: number | null;
      obp: number | null; k_pct: number | null; whiff_pct: number | null;
      hard_hit_pct: number | null; barrel_pct: number | null; avg_ev: number | null;
      hrs: number; pa: number;
    }>();
    for (const row of batterPitchSumRaw) {
      const key = `${row.player_id}:${row.pitch_type}`;
      batterPitchSumMap.set(key, {
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
        hrs: 0, // not available in pitchtype_summary; HR count from batted balls added below
        pa: Number(row.pa ?? 0),
      });
    }

    // Also build hand-split pitch lookup: "playerId:pitchType:hand" -> real stats
    const batterPitchHandMap = new Map<string, {
      ba: number | null; slg: number | null; iso: number | null; woba: number | null;
      whiff_pct: number | null; hard_hit_pct: number | null; avg_ev: number | null;
      barrel_pct: number | null; hrs: number; pa: number;
    }>();
    for (const row of batterHandSplitsRaw) {
      const key = `${row.player_id}:${row.pitch_type}:${row.opponent_hand}`;
      batterPitchHandMap.set(key, {
        ba: row.ba != null ? Number(row.ba) : null,
        slg: row.slg != null ? Number(row.slg) : null,
        iso: row.iso != null ? Number(row.iso) : null,
        woba: row.woba != null ? Number(row.woba) : null,
        whiff_pct: row.whiff_percent != null ? Number(row.whiff_percent) : null,
        hard_hit_pct: row.hard_hit_percent != null ? Number(row.hard_hit_percent) : null,
        avg_ev: row.avg_exit_velocity != null ? Number(row.avg_exit_velocity) : null,
        barrel_pct: row.barrel_percent != null ? Number(row.barrel_percent) : null,
        hrs: Number(row.home_runs ?? 0),
        pa: Number(row.pa ?? 0),
      });
    }

    const BATTER_LOG_START_IDX = 20;
    for (let i = 0; i < batterIds.length; i++) {
      const resultIdx = BATTER_LOG_START_IDX + i;
      const gameLogs = Array.isArray(allResults[resultIdx]?.data) ? allResults[resultIdx].data as any[] : [];
      if (gameLogs.length === 0) continue;

      if (i === 0) {
        console.log(`[game-matchup] batter ${batterIds[i]} game logs: ${gameLogs.length} total, sample=${sample}, season=${season}, first date=${gameLogs[0]?.game_date}, last date=${gameLogs[gameLogs.length - 1]?.game_date}, game_types=${[...new Set(gameLogs.map((g: any) => g.game_type ?? g.season_type ?? "null"))].join(",")}`);
      }

      // Filter batter logs — only for current/future seasons to exclude spring training
      // Past seasons (2025 and earlier) are complete — RPC handles season scoping
      let filtered = gameLogs;
      const needsBatterFilter = statSeason && statSeason >= new Date().getFullYear();
      if (needsBatterFilter) {
        const seasonStart = `${statSeason}-01-01`;
        const seasonEnd = `${statSeason + 1}-01-01`;
        const beforeCount = filtered.length;
        filtered = filtered.filter((g: any) => {
          const gameType = (g.game_type ?? g.season_type ?? "").toUpperCase();
          // Always exclude spring training and exhibition
          if (gameType === "S" || gameType === "ST" || gameType === "E") return false;
          // If date is missing but game_type is regular season, keep it
          const d = g.game_date ?? g.date ?? "";
          if (!d) return gameType === "R";
          if (d < seasonStart || d >= seasonEnd) return false;
          return true;
        });
        if (i === 0 && filtered.length !== beforeCount) {
          console.log(`[game-matchup] batter ${batterIds[i]} filtered ${beforeCount - filtered.length} out-of-season/spring games, ${filtered.length} remain for ${statSeason}`);
        }
      }

      // Apply sample filter (game logs come sorted by date desc)
      if (sample !== "season") {
        const limit = Number(sample);
        filtered = filtered.slice(0, limit);
      }

      let totalPA = 0, totalAB = 0, totalH = 0, totalHR = 0, total2B = 0, total3B = 0;
      let totalRBI = 0, totalBB = 0, totalK = 0, totalHBP = 0, totalSB = 0, totalTB = 0;
      for (const g of filtered) {
        totalPA += Number(g.plate_appearances ?? 0);
        totalAB += Number(g.at_bats ?? 0);
        totalH += Number(g.hits ?? 0);
        totalHR += Number(g.home_runs ?? 0);
        total2B += Number(g.doubles ?? 0);
        total3B += Number(g.triples ?? 0);
        totalRBI += Number(g.rbi ?? 0);
        totalBB += Number(g.base_on_balls ?? 0);
        totalK += Number(g.strike_outs ?? 0);
        totalHBP += Number(g.hit_by_pitch ?? 0);
        totalSB += Number(g.stolen_bases ?? 0);
        totalTB += Number(g.total_bases ?? 0);
      }

      const avg = totalAB > 0 ? totalH / totalAB : null;
      const obp = totalPA > 0 ? (totalH + totalBB + totalHBP) / totalPA : null;
      const slg = totalAB > 0 ? totalTB / totalAB : null;

      batterTraditionalMap.set(batterIds[i], {
        pa: totalPA, ab: totalAB, hits: totalH, hr: totalHR,
        doubles: total2B, triples: total3B, rbi: totalRBI,
        bb: totalBB, k: totalK, hbp: totalHBP, sb: totalSB,
        total_bases: totalTB, games: filtered.length,
        avg: avg != null ? Math.round(avg * 1000) / 1000 : null,
        obp: obp != null ? Math.round(obp * 1000) / 1000 : null,
        slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
        ops: obp != null && slg != null ? Math.round((obp + slg) * 1000) / 1000 : null,
        iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
        k_pct: totalPA >= 10 ? Math.round((totalK / totalPA) * 1000) / 10 : null,
        bb_pct: totalPA >= 10 ? Math.round((totalBB / totalPA) * 1000) / 10 : null,
      });
    }

    // Fallback: for batters without game logs, try mlb_batting_season_stats (camelCase, person_id)
    const missingBatterIds = batterIds.filter((id) => !batterTraditionalMap.has(id));
    if (missingBatterIds.length > 0) {
      const { data: bssRows } = await supabase
        .from("mlb_batting_season_stats")
        .select("person_id, gamesPlayed, atBats, hits, homeRuns, doubles, triples, rbi, baseOnBalls, strikeOuts, hitByPitch, stolenBases, plateAppearances, totalBases, avg, obp, slg, ops, sacFlies, sacBunts")
        .in("person_id", missingBatterIds)
        .eq("season", season);
      if (bssRows && bssRows.length > 0) {
        for (const row of bssRows) {
          const pa = Number(row.plateAppearances ?? 0);
          const ab = Number(row.atBats ?? 0);
          const h = Number(row.hits ?? 0);
          const hr = Number(row.homeRuns ?? 0);
          const bb = Number(row.baseOnBalls ?? 0);
          const k = Number(row.strikeOuts ?? 0);
          const avgVal = row.avg != null ? Number(row.avg) : (ab > 0 ? h / ab : null);
          const obpVal = row.obp != null ? Number(row.obp) : null;
          const slgVal = row.slg != null ? Number(row.slg) : null;
          batterTraditionalMap.set(row.person_id, {
            pa, ab, hits: h, hr,
            doubles: Number(row.doubles ?? 0), triples: Number(row.triples ?? 0),
            rbi: Number(row.rbi ?? 0), bb, k,
            hbp: Number(row.hitByPitch ?? 0), sb: Number(row.stolenBases ?? 0),
            total_bases: Number(row.totalBases ?? 0), games: Number(row.gamesPlayed ?? 0),
            avg: avgVal != null ? Math.round(avgVal * 1000) / 1000 : null,
            obp: obpVal != null ? Math.round(obpVal * 1000) / 1000 : null,
            slg: slgVal != null ? Math.round(slgVal * 1000) / 1000 : null,
            ops: row.ops != null ? Math.round(Number(row.ops) * 1000) / 1000 : null,
            iso: avgVal != null && slgVal != null ? Math.round((slgVal - avgVal) * 1000) / 1000 : null,
            k_pct: pa >= 10 ? Math.round((k / pa) * 1000) / 10 : null,
            bb_pct: pa >= 10 ? Math.round((bb / pa) * 1000) / 10 : null,
          });
        }
        console.log(`[game-matchup] batter season stats fallback: ${bssRows.length} batters filled from mlb_batting_season_stats`);
      }
    }

    // ── Process Pitcher ─────────────────────────────────────────────────────

    const pitcherHand = pitcherBBs.length > 0 ? pitcherBBs[0].pitcher_hand : null;

    // Pitcher arsenal: group by pitch_type
    const pitchGroups = new Map<string, any[]>();
    for (const bb of pitcherBBs) {
      if (!bb.pitch_type) continue;
      const arr = pitchGroups.get(bb.pitch_type) || [];
      arr.push(bb);
      pitchGroups.set(bb.pitch_type, arr);
    }

    const totalPitcherBBs = pitcherBBs.length;

    // L30 pitcher arsenal groups
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

      // L30 data for this pitch type
      const l30Bbs = l30PitchGroups.get(pt) || [];
      const l30Usage = totalL30BBs > 0 ? Math.round((l30Bbs.length / totalL30BBs) * 100) : null;
      const l30Speeds = l30Bbs.map((b: any) => b.pitch_speed).filter((s: any) => s != null && s > 0);

      // Determine trend: >3% diff = up/down, else flat
      let usageTrend: "up" | "down" | "flat" | null = null;
      if (l30Usage != null && totalL30BBs >= 10) {
        const diff = l30Usage - seasonUsage;
        if (diff >= 4) usageTrend = "up";
        else if (diff <= -4) usageTrend = "down";
        else usageTrend = "flat";
      }

      // Trajectory breakdown for this pitch type
      const gbCount = bbs.filter((b: any) => b.trajectory === "ground_ball").length;
      const fbCount = bbs.filter((b: any) => b.trajectory === "fly_ball").length;
      const hardCount = bbs.filter((b: any) => b.hardness === "hard").length;
      const evs = bbs.map((b: any) => b.exit_velocity).filter((v: any) => v != null && v > 0);

      // Use overall pitch type summary data (includes all batters, no switch-hitter gaps)
      const summary = pitchSummaryMap.get(pt);

      // Usage: prefer summary table pitch_usage (from Savant), fallback to batted ball ratio
      const summaryUsage = summary?.pitch_usage != null
        ? Math.round(summary.pitch_usage)
        : seasonUsage;

      arsenal.push({
        pitch_type: pt,
        pitch_name: PITCH_TYPE_NAMES[pt] || pt,
        usage_pct: summaryUsage,
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
        avg_ev: evs.length > 0 ? Math.round(evs.reduce((a: number, b: number) => a + b, 0) / evs.length * 10) / 10 : null,
        woba: summary?.woba != null ? Math.round(summary.woba * 1000) / 1000 : computeWOBA(bbs),
        l30_usage_pct: l30Usage,
        l30_baa: l30Bbs.length > 0 ? computeAVGFromBBs(l30Bbs) : null,
        l30_slg: l30Bbs.length > 0 ? computeSLGFromEvents(l30Bbs) : null,
        l30_avg_speed: l30Speeds.length > 0 ? Math.round(l30Speeds.reduce((a: number, b: number) => a + b, 0) / l30Speeds.length * 10) / 10 : null,
        usage_trend: usageTrend,
      });
    }
    arsenal.sort((a, b) => b.usage_pct - a.usage_pct);

    // Pitcher season stats from game logs (already resolved above)
    // RPC columns: strike_outs, base_on_balls, innings_numeric, hits_allowed, earned_runs, game_result
    let pitcherSeasonStats: any = {};
    if (logs.length > 0) {
      // Filter pitcher logs — only for current/future seasons to exclude spring training
      // Past seasons (2025 and earlier) are complete — no filtering needed
      const currentYear = new Date().getFullYear();
      const needsSeasonFilter = statSeason && statSeason >= currentYear;
      const statsLogs = needsSeasonFilter
        ? (() => {
            const seasonStart = `${statSeason}-01-01`;
            const seasonEnd = `${statSeason + 1}-01-01`;
            return logs.filter((log: any) => {
              const gameType = (log.game_type ?? log.season_type ?? "").toUpperCase();
              if (gameType === "S" || gameType === "ST" || gameType === "E") return false;
              const d = log.game_date ?? log.date ?? "";
              if (!d) return gameType === "R";
              if (d < seasonStart || d >= seasonEnd) return false;
              return true;
            });
          })()
        : logs;

      console.log(`[game-matchup] pitcher logs: ${logs.length} total, ${statsLogs.length} after spring filter, season=${season}, game_types=${[...new Set(logs.map((l: any) => l.game_type ?? l.season_type ?? "null"))].join(",")}`);

      let totalIP = 0, totalER = 0, totalH = 0, totalBB = 0, totalK = 0, totalGS = 0;
      let wins = 0, losses = 0;
      for (const log of statsLogs) {
        const ip = Number(log.innings_numeric ?? 0);
        totalIP += ip;
        totalER += Number(log.earned_runs ?? 0);
        totalH += Number(log.hits_allowed ?? 0);
        totalBB += Number(log.base_on_balls ?? 0);
        totalK += Number(log.strike_outs ?? 0);
        totalGS += 1; // each log row is a game start
        const result = String(log.game_result ?? "").toUpperCase();
        if (result === "W") wins++;
        if (result === "L") losses++;
      }

      // HR allowed from batted balls (not in game logs)
      const hrFromBBs = pitcherBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;

      const era = totalIP > 0 ? (totalER / totalIP) * 9 : null;
      const whip = totalIP > 0 ? (totalH + totalBB) / totalIP : null;
      const kPer9 = totalIP > 0 ? (totalK / totalIP) * 9 : null;
      const bbPer9 = totalIP > 0 ? (totalBB / totalIP) * 9 : null;
      const hrPer9 = totalIP > 0 ? (hrFromBBs / totalIP) * 9 : null;
      // FIP: ((13*HR + 3*BB - 2*K) / IP) + 3.10 (constant)
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
        wins,
        losses,
        hr_fb_pct: hrFbPct != null ? Math.round(hrFbPct * 10) / 10 : null,
      };
    }

    // Fallback: if game logs didn't produce season stats, try mlb_pitching_season_stats table
    // This table uses camelCase columns and person_id (from MLB boxscore pipeline)
    if (pitcherSeasonStats.era == null && pitcherId) {
      const { data: pss } = await supabase
        .from("mlb_pitching_season_stats")
        .select("*")
        .eq("person_id", pitcherId)
        .eq("season", season)
        .limit(1)
        .maybeSingle();
      if (pss) {
        // Parse innings pitched: "6.2" means 6⅔ innings (partial = thirds, not tenths)
        const ipStr = String(pss.inningsPitched ?? "0");
        const ipParts = ipStr.split(".");
        const fullInnings = parseInt(ipParts[0], 10) || 0;
        const partialInnings = ipParts[1] ? (parseInt(ipParts[1], 10) || 0) / 3 : 0;
        const ip = fullInnings + partialInnings;

        const er = Number(pss.earnedRuns ?? 0);
        const h = Number(pss.hits ?? 0);
        const bb = Number(pss.baseOnBalls ?? 0);
        const k = Number(pss.strikeOuts ?? 0);
        const hr = Number(pss.homeRuns ?? 0);
        const gs = Number(pss.gamesStarted ?? pss.gamesPlayed ?? 0);
        const w = Number(pss.wins ?? 0);
        const l = Number(pss.losses ?? 0);

        const era = ip > 0 ? (er / ip) * 9 : null;
        const whip = ip > 0 ? (h + bb) / ip : null;
        const kPer9 = ip > 0 ? (k / ip) * 9 : null;
        const bbPer9 = ip > 0 ? (bb / ip) * 9 : null;
        const hrPer9 = ip > 0 ? (hr / ip) * 9 : null;
        const fip = ip > 0 ? ((13 * hr + 3 * bb - 2 * k) / ip) + 3.10 : null;

        pitcherSeasonStats = {
          era: era != null ? Math.round(era * 100) / 100 : null,
          whip: whip != null ? Math.round(whip * 100) / 100 : null,
          k_per_9: kPer9 != null ? Math.round(kPer9 * 10) / 10 : null,
          bb_per_9: bbPer9 != null ? Math.round(bbPer9 * 10) / 10 : null,
          hr_per_9: hrPer9 != null ? Math.round(hrPer9 * 100) / 100 : null,
          fip: fip != null ? Math.round(fip * 100) / 100 : null,
          innings_pitched: Math.round(ip * 10) / 10,
          games_started: gs,
          opp_avg: ip > 0 ? Math.round((h / (ip * 3 + h)) * 1000) / 1000 : null,
          wins: w,
          losses: l,
          hr_fb_pct: null, // not available from season stats table
        };
        console.log(`[game-matchup] pitcher season stats fallback: pitcher=${pitcherId} season=${season} ERA=${pitcherSeasonStats.era} IP=${ip} GS=${gs}`);
      }
    }

    // Compute HR/FB from batted balls if not from logs
    const flyBallCount = pitcherBBs.filter((b: any) => b.trajectory === "fly_ball").length;
    const hrBBCount = pitcherBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;

    // Recent HRs allowed (last 5, most recent first)
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

    // Zone data: batted ball trajectory distribution
    const gbCount = pitcherBBs.filter((b: any) => b.trajectory === "ground_ball").length;
    const ldCount = pitcherBBs.filter((b: any) => b.trajectory === "line_drive").length;
    const puCount = pitcherBBs.filter((b: any) => b.trajectory === "popup").length;
    const pitcherHardHit = computeHardHitPct(pitcherBBs);
    const pitcherAvgEV = computeAvgEV(pitcherBBs);

    const zoneData = {
      total_fb: flyBallCount,
      total_gb: gbCount,
      total_ld: ldCount,
      total_pu: puCount,
      hr_pct_fb: flyBallCount > 0 ? Math.round((hrBBCount / flyBallCount) * 1000) / 10 : null,
      hard_hit_pct: pitcherHardHit != null ? Math.round(pitcherHardHit * 10) / 10 : null,
      avg_ev_against: pitcherAvgEV != null ? Math.round(pitcherAvgEV * 10) / 10 : null,
    };

    // ── Pitcher hand splits (vs LHB / vs RHB) — from real pitch-type-hand-splits table ──
    function computePitcherHandSplit(hand: string): PitcherHandSplit | null {
      // Aggregate across all pitch types for this hand from the hand splits table
      const handRows = pitcherHandSplitsRaw.filter((r: any) => r.opponent_hand === hand);
      const handTotalPA = handRows.reduce((s: number, r: any) => s + Number(r.pa ?? 0), 0);
      const minPA = (statSeason && statSeason >= new Date().getFullYear()) ? 10 : 3;
      if (handRows.length > 0 && handTotalPA >= minPA) {
        // Weighted averages by PA across pitch types (require 10+ PA for meaningful splits)
        let totalPA = 0, totalAB = 0, totalH = 0, totalHR = 0, totalK = 0;
        let weightedBA = 0, weightedSLG = 0, weightedISO = 0, weightedWOBA = 0;
        let weightedEV = 0, evWeight = 0;
        let weightedHH = 0, hhWeight = 0;
        let weightedBrl = 0, brlWeight = 0;

        for (const row of handRows) {
          const pa = Number(row.pa ?? 0);
          const ab = Number(row.ab ?? 0);
          totalPA += pa;
          totalAB += ab;
          totalH += Number(row.hits ?? 0);
          totalHR += Number(row.home_runs ?? 0);
          totalK += Number(row.strikeouts ?? 0);
          if (row.ba != null && ab > 0) weightedBA += Number(row.ba) * ab;
          if (row.slg != null && ab > 0) weightedSLG += Number(row.slg) * ab;
          if (row.iso != null && ab > 0) weightedISO += Number(row.iso) * ab;
          if (row.woba != null && pa > 0) weightedWOBA += Number(row.woba) * pa;
          if (row.avg_exit_velocity != null) { const bbes = Number(row.pa ?? 0); weightedEV += Number(row.avg_exit_velocity) * bbes; evWeight += bbes; }
          if (row.hard_hit_percent != null) { const bbes = Number(row.pa ?? 0); weightedHH += Number(row.hard_hit_percent) * bbes; hhWeight += bbes; }
          if (row.barrel_percent != null) { const bbes = Number(row.pa ?? 0); weightedBrl += Number(row.barrel_percent) * bbes; brlWeight += bbes; }
        }

        const avg = totalAB > 0 ? Math.round((weightedBA / totalAB) * 1000) / 1000 : null;
        const slg = totalAB > 0 ? Math.round((weightedSLG / totalAB) * 1000) / 1000 : null;
        const iso = totalAB > 0 ? Math.round((weightedISO / totalAB) * 1000) / 1000 : null;
        const woba = totalPA > 0 ? Math.round((weightedWOBA / totalPA) * 1000) / 1000 : null;
        const avgEv = evWeight > 0 ? Math.round((weightedEV / evWeight) * 10) / 10 : null;
        const hardHit = hhWeight > 0 ? Math.round((weightedHH / hhWeight) * 10) / 10 : null;
        const barrelPct = brlWeight > 0 ? Math.round((weightedBrl / brlWeight) * 10) / 10 : null;

        return {
          bbs: totalPA,
          avg, slg, iso, woba,
          hr: totalHR,
          avg_ev: avgEv,
          hard_hit_pct: hardHit,
          barrel_pct: barrelPct,
          gb_pct: null, // not in hand splits table
          k_pct: (() => {
            let wK = 0, wPA = 0;
            for (const r of handRows) { if (r.k_percent != null && Number(r.pa ?? 0) > 0) { wK += Number(r.k_percent) * Number(r.pa); wPA += Number(r.pa); } }
            return wPA > 0 ? Math.round((wK / wPA) * 10) / 10 : null;
          })(),
          bb_pct: (() => {
            let wBB = 0, wPA = 0;
            for (const r of handRows) { if (r.bb_percent != null && Number(r.pa ?? 0) > 0) { wBB += Number(r.bb_percent) * Number(r.pa); wPA += Number(r.pa); } }
            return wPA > 0 ? Math.round((wBB / wPA) * 10) / 10 : null;
          })(),
          obp: (() => {
            let wOBP = 0, wPA = 0;
            for (const r of handRows) { if (r.obp != null && Number(r.pa ?? 0) > 0) { wOBP += Number(r.obp) * Number(r.pa); wPA += Number(r.pa); } }
            return wPA > 0 ? Math.round((wOBP / wPA) * 1000) / 1000 : null;
          })(),
        };
      }

      // Fallback: compute from batted balls if hand splits table empty
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

    // Arsenal splits by batter handedness
    function computeArsenalHandSplits(hand: string): ArsenalHandSplit[] {
      // Use real Savant data from pitcherHandSplitsRaw first, batted ball fallback
      const handRows = pitcherHandSplitsRaw.filter((r: any) => r.opponent_hand === hand);
      const handRowMap = new Map<string, any>();
      for (const r of handRows) {
        if (r.pitch_type) handRowMap.set(r.pitch_type, r);
      }

      const hBBs = pitcherBBs.filter((b: any) => b.batter_hand === hand);
      if (hBBs.length < 5 && handRows.length === 0) return [];

      // Get pitch types from arsenal order
      const pitchTypes = arsenal.map((a) => a.pitch_type);
      const results: ArsenalHandSplit[] = [];

      for (const pt of pitchTypes) {
        const real = handRowMap.get(pt);
        const ptBBs = hBBs.filter((b: any) => b.pitch_type === pt);
        const speeds = ptBBs.map((b: any) => b.pitch_speed).filter((s: any) => s != null && s > 0);

        if (real && (real.pa ?? 0) >= 3) {
          // Use real Savant stats
          results.push({
            pitch_type: pt,
            pitch_name: PITCH_TYPE_NAMES[pt] || pt,
            usage_pct: real.pitches != null && handRows.reduce((s: number, r: any) => s + (r.pitches ?? 0), 0) > 0
              ? Math.round((real.pitches / handRows.reduce((s: number, r: any) => s + (r.pitches ?? 0), 0)) * 100)
              : (hBBs.length > 0 ? Math.round((ptBBs.length / hBBs.length) * 100) : 0),
            avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
            baa: real.ba != null ? Math.round(Number(real.ba) * 1000) / 1000 : null,
            slg: real.slg != null ? Math.round(Number(real.slg) * 1000) / 1000 : null,
            iso: real.iso != null ? Math.round(Number(real.iso) * 1000) / 1000 : null,
            woba: real.woba != null ? Math.round(Number(real.woba) * 1000) / 1000 : null,
            bbs: real.pa ?? ptBBs.length,
            whiff_pct: real.whiff_percent != null ? Number(real.whiff_percent) : (pitcherHandWhiffMap.get(`${pt}:${hand}`) ?? null),
            k_pct: real.k_percent != null ? Math.round(Number(real.k_percent) * 10) / 10 : null,
            bb_pct: real.bb_percent != null ? Math.round(Number(real.bb_percent) * 10) / 10 : null,
          });
        } else if (ptBBs.length > 0) {
          // Fallback to batted balls
          const avg = computeAVGFromBBs(ptBBs);
          const slg = computeSLGFromEvents(ptBBs);
          const woba = computeWOBA(ptBBs);
          results.push({
            pitch_type: pt,
            pitch_name: PITCH_TYPE_NAMES[pt] || pt,
            usage_pct: hBBs.length > 0 ? Math.round((ptBBs.length / hBBs.length) * 100) : 0,
            avg_speed: speeds.length > 0 ? Math.round(speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length * 10) / 10 : null,
            baa: avg != null ? Math.round(avg * 1000) / 1000 : null,
            slg: slg != null ? Math.round(slg * 1000) / 1000 : null,
            iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
            woba: woba != null ? Math.round(woba * 1000) / 1000 : null,
            bbs: ptBBs.length,
            whiff_pct: pitcherHandWhiffMap.get(`${pt}:${hand}`) ?? null,
            k_pct: null,
            bb_pct: null,
          });
        }
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
      name: pitcherName || "TBD",
      hand: pitcherHand,
      team_id: pitcherTeamId,
      team_name: pitcherTeamName,
      team_abbr: pitcherTeamAbbr,
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
      scouting_summary: null, // will be set after profile is built
      recent_hrs_allowed: hrBBsAllowed,
      pitch_zone_grid: pitchZoneGrid,
      pitcher_splits: pitcherSplits,
      arsenal_splits: arsenalSplits,
      zone_data: zoneData,
    };

    // Generate scouting summary now that profile is assembled
    pitcherProfile.scouting_summary = generateScoutingSummary(pitcherProfile, pitcherBBs, season);

    // ── Process Batters ─────────────────────────────────────────────────────

    const batterBBs = batterBBsRaw;
    const h2hBBs = (h2hResult.data ?? []) as any[];
    const recentBBs = recentBBsRaw;

    // Group by batter
    const batterBBMap = new Map<number, any[]>();
    for (const bb of batterBBs) {
      const arr = batterBBMap.get(bb.batter_id) || [];
      arr.push(bb);
      batterBBMap.set(bb.batter_id, arr);
    }

    const h2hMap = new Map<number, any[]>();
    for (const bb of h2hBBs) {
      const arr = h2hMap.get(bb.batter_id) || [];
      arr.push(bb);
      h2hMap.set(bb.batter_id, arr);
    }

    const recentMap = new Map<number, any[]>();
    for (const bb of recentBBs) {
      const arr = recentMap.get(bb.batter_id) || [];
      arr.push(bb);
      recentMap.set(bb.batter_id, arr);
    }

    // Resolve batting hand from batted ball data
    for (const p of lineup) {
      const bbs = batterBBMap.get(p.player_id);
      if (bbs && bbs.length > 0) {
        const hand = bbs[0].batter_hand;
        if (hand) p.batting_hand = hand;
      }
    }

    const primaryPitchType = arsenal.length > 0 ? arsenal[0].pitch_type : null;
    const pitcherPitchTypes = arsenal.map((a) => a.pitch_type);

    // Dynamic PA minimums: lower thresholds early in season when samples are tiny
    // By late April most starters have 50+ PA; by June 200+
    const isEarlySeason = (pitcherSeasonStats.games_started ?? 0) <= 5;
    const MIN_PA_PITCH_TYPE = isEarlySeason ? 1 : 3;   // pitch type summary
    const MIN_PA_HAND_SPLIT = isEarlySeason ? 2 : 5;   // batter hand splits

    const batters: BatterMatchup[] = lineup.map((p: any) => {
      const bbs = batterBBMap.get(p.player_id) || [];
      const avg = computeAVGFromBBs(bbs);
      const slg = computeSLGFromEvents(bbs);
      const iso = avg != null && slg != null ? slg - avg : null;
      const hrs = bbs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;
      const barrelPct = computeBarrelPct(bbs);
      const hardHitPct = computeHardHitPct(bbs);
      const avgEV = computeAvgEV(bbs);
      const woba = computeWOBA(bbs);

      // Pitch type splits for this batter (only pitcher's pitch types)
      // Use real Savant data from mlb_batter_pitchtype_summary, with batted ball fallback
      const pitchSplits: BatterPitchSplit[] = pitcherPitchTypes.map((pt) => {
        const realData = batterPitchSumMap.get(`${p.player_id}:${pt}`);
        if (realData && realData.pa >= MIN_PA_PITCH_TYPE) {
          // Get HR count from batted balls since pitchtype_summary doesn't have it
          const ptHRs = bbs.filter((b: any) => b.pitch_type === pt && (b.event_type || "").toLowerCase() === "home_run").length;
          return {
            pitch_type: pt,
            pitch_name: PITCH_TYPE_NAMES[pt] || pt,
            avg: realData.ba != null ? Math.round(realData.ba * 1000) / 1000 : null,
            slg: realData.slg != null ? Math.round(realData.slg * 1000) / 1000 : null,
            iso: realData.iso != null ? Math.round(realData.iso * 1000) / 1000 : null,
            batted_balls: realData.pa,
            hrs: ptHRs,
            barrel_pct: realData.barrel_pct != null ? Math.round(realData.barrel_pct * 10) / 10 : null,
            woba: realData.woba != null ? Math.round(realData.woba * 1000) / 1000 : null,
            avg_ev: realData.avg_ev != null ? Math.round(realData.avg_ev * 10) / 10 : null,
            hard_hit_pct: realData.hard_hit_pct != null ? Math.round(realData.hard_hit_pct * 10) / 10 : null,
          };
        }
        // Fallback: compute from batted balls
        const ptBBs = bbs.filter((b: any) => b.pitch_type === pt);
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

      // Pitch splits crossed with pitcher handedness — use real Savant hand splits data
      function computePitchSplitsForHand(hand: string): BatterPitchSplit[] {
        return pitcherPitchTypes.map((pt) => {
          // Use real data from mlb_batter_pitchtype_hand_splits
          const realData = batterPitchHandMap.get(`${p.player_id}:${pt}:${hand}`);
          if (realData && realData.pa >= MIN_PA_PITCH_TYPE) {
            return {
              pitch_type: pt,
              pitch_name: PITCH_TYPE_NAMES[pt] || pt,
              avg: realData.ba != null ? Math.round(realData.ba * 1000) / 1000 : null,
              slg: realData.slg != null ? Math.round(realData.slg * 1000) / 1000 : null,
              iso: realData.iso != null ? Math.round(realData.iso * 1000) / 1000 : null,
              batted_balls: realData.pa,
              hrs: realData.hrs,
              barrel_pct: realData.barrel_pct != null ? Math.round(realData.barrel_pct * 10) / 10 : null,
              woba: realData.woba != null ? Math.round(realData.woba * 1000) / 1000 : null,
              avg_ev: realData.avg_ev != null ? Math.round(realData.avg_ev * 10) / 10 : null,
              hard_hit_pct: realData.hard_hit_pct != null ? Math.round(realData.hard_hit_pct * 10) / 10 : null,
            };
          }
          // Fallback: compute from batted balls
          const ptBBs = bbs.filter((b: any) => b.pitch_type === pt && b.pitcher_hand === hand);
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
      }
      const pitchHandSplits = {
        vs_rhp: computePitchSplitsForHand("R"),
        vs_lhp: computePitchSplitsForHand("L"),
      };

      // H2H
      const h2hPlayerBBs = h2hMap.get(p.player_id) || [];
      let h2h: BatterMatchup["h2h"] = null;
      if (h2hPlayerBBs.length > 0) {
        // Group H2H by game_date for last 3 meetings
        const h2hByDate = new Map<string, any[]>();
        for (const bb of h2hPlayerBBs) {
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

        const h2hAvg = computeAVGFromBBs(h2hPlayerBBs);
        const h2hSlg = computeSLGFromEvents(h2hPlayerBBs);
        h2h = {
          pa: h2hPlayerBBs.length,
          hits: h2hPlayerBBs.filter((b: any) => b.is_hit || (b.event_type || "").toLowerCase() === "home_run").length,
          hrs: h2hPlayerBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length,
          avg: h2hAvg != null ? Math.round(h2hAvg * 1000) / 1000 : null,
          slg: h2hSlg != null ? Math.round(h2hSlg * 1000) / 1000 : null,
          last_meetings: lastMeetings,
        };
      }

      // Recent form
      const recentPlayerBBs = recentMap.get(p.player_id) || [];
      const recentBarrel = computeBarrelPct(recentPlayerBBs);
      const recentEV = computeAvgEV(recentPlayerBBs);
      const recentHRs = recentPlayerBBs.filter((b: any) => (b.event_type || "").toLowerCase() === "home_run").length;

      // Recent EV sparkline: group recent BBs by game_date, avg EV per date, last 8
      const recentByDate = new Map<string, any[]>();
      for (const bb of recentPlayerBBs) {
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
        { slg, iso, batting_hand: p.batting_hand || "R", barrel_pct: barrelPct },
        { hand: pitcherHand, primary_pitch_type: primaryPitchType ? (PITCH_TYPE_NAMES[primaryPitchType] || primaryPitchType) : null },
        primarySplit?.slg ?? null
      );

      // HR probability factors
      const hrFactors: { label: string; positive: boolean }[] = [];
      const hasPlatoonAdv =
        (p.batting_hand === "L" && pitcherHand === "R") ||
        (p.batting_hand === "R" && pitcherHand === "L");
      if (hasPlatoonAdv) hrFactors.push({ label: "Platoon advantage", positive: true });
      if (iso != null && iso >= 0.200) hrFactors.push({ label: `.${Math.round(iso * 1000)} ISO (elite power)`, positive: true });
      else if (iso != null && iso < 0.120) hrFactors.push({ label: `.${Math.round(iso * 1000)} ISO (low power)`, positive: false });
      if (barrelPct != null && barrelPct >= 10) hrFactors.push({ label: `${barrelPct.toFixed(1)}% barrel rate`, positive: true });
      if (primarySplit?.slg != null && primarySplit.slg >= 0.500) hrFactors.push({ label: `Crushes ${PITCH_TYPE_NAMES[primaryPitchType!] || primaryPitchType}s (.${Math.round(primarySplit.slg * 1000)} SLG)`, positive: true });
      else if (primarySplit?.slg != null && primarySplit.slg < 0.300 && primarySplit.slg > 0) hrFactors.push({ label: `Struggles vs ${PITCH_TYPE_NAMES[primaryPitchType!] || primaryPitchType}s (.${Math.round(primarySplit.slg * 1000)} SLG)`, positive: false });
      if (h2h && h2h.hrs >= 2) hrFactors.push({ label: `${h2h.hrs} career HR vs pitcher`, positive: true });
      if (pitcherProfile.hr_per_9 != null && pitcherProfile.hr_per_9 >= 1.4) hrFactors.push({ label: "Pitcher allows high HR/9", positive: true });
      if (recentHRs >= 3) hrFactors.push({ label: `${recentHRs} HR in last 60 days`, positive: true });

      // HR probability score (0-100)
      let hrScore = 30; // baseline
      if (hasPlatoonAdv) hrScore += 8;
      if (iso != null) hrScore += Math.min(Math.max((iso - 0.120) * 200, -15), 20);
      if (barrelPct != null) hrScore += Math.min(Math.max((barrelPct - 5) * 2, -10), 15);
      if (primarySplit?.slg != null) hrScore += Math.min(Math.max((primarySplit.slg - 0.400) * 60, -10), 15);
      if (h2h && h2h.hrs > 0) hrScore += Math.min(h2h.hrs * 3, 10);
      if (pitcherProfile.hr_per_9 != null && pitcherProfile.hr_per_9 >= 1.2) hrScore += 5;
      hrScore = Math.max(5, Math.min(95, Math.round(hrScore)));

      // Overlap score: what % of pitcher's top 3 pitches does the batter slug >= .400 vs
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

      // Hand splits: vs RHP and vs LHP — from real Savant data (with batted ball fallback)
      function computeHandSplit(hand: string) {
        const key = `${p.player_id}:${hand}`;

        // Savant hand splits for the selected season
        const realSplit = batterHandSplitMap.get(key);
        if (realSplit && realSplit.pa >= MIN_PA_HAND_SPLIT) {
          return {
            avg: realSplit.avg, slg: realSplit.slg, iso: realSplit.iso,
            woba: realSplit.woba, hr: realSplit.hr, ev: realSplit.ev,
            brl: realSplit.brl, bbs: realSplit.pa, obp: realSplit.obp,
            k_pct: realSplit.k_pct, bb_pct: realSplit.bb_pct,
          };
        }

        // Batted balls filtered by pitcher hand (no K%/BB% available)
        const hBBs = bbs.filter((b: any) => b.pitcher_hand === hand);
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
          k_pct: null, bb_pct: null,
        };
      }

      // Use game-log traditional stats for BA/SLG/HR/etc (real plate appearances)
      // Batted balls only for contact quality: EV, barrel%, hard hit%
      // Never fall back to BB-computed BA/SLG — they inflate numbers by excluding K/BB
      const trad = batterTraditionalMap.get(p.player_id);

      return {
        player_id: p.player_id,
        player_name: p.player_name,
        team_abbr: p.team_abbr || "",
        batting_hand: p.batting_hand || "R",
        lineup_position: p.lineup_position,
        pa: trad?.pa ?? 0,
        avg: trad?.avg ?? null,
        obp: trad?.obp ?? null,
        slg: trad?.slg ?? null,
        ops: trad?.ops ?? null,
        iso: trad?.iso ?? null,
        hr_count: trad?.hr ?? 0,
        barrel_pct: barrelPct != null ? Math.round(barrelPct * 10) / 10 : null,
        hard_hit_pct: hardHitPct != null ? Math.round(hardHitPct * 10) / 10 : null,
        avg_exit_velo: avgEV != null ? Math.round(avgEV * 10) / 10 : null,
        woba: trad && trad.pa >= 5 ? (() => {
          // wOBA = (0.69*BB + 0.72*HBP + 0.88*1B + 1.24*2B + 1.56*3B + 2.00*HR) / (AB + BB + HBP + SF)
          // We don't have SF, so approximate denominator as PA
          const singles = trad.hits - trad.hr - trad.doubles - trad.triples;
          const num = 0.69 * trad.bb + 0.72 * trad.hbp + 0.88 * Math.max(singles, 0) + 1.24 * trad.doubles + 1.56 * trad.triples + 2.00 * trad.hr;
          return Math.round((num / trad.pa) * 1000) / 1000;
        })() : null,
        total_batted_balls: bbs.length,
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
        k_pct: trad?.k_pct ?? null,
        bb_pct: trad?.bb_pct ?? null,
        hand_splits: {
          vs_rhp: computeHandSplit("R"),
          vs_lhp: computeHandSplit("L"),
        },
      };
    });

    // Sort by lineup position (nulls last)
    batters.sort((a, b) => (a.lineup_position ?? 99) - (b.lineup_position ?? 99));

    // ── Summary ─────────────────────────────────────────────────────────────

    const strong = batters.filter((b) => b.matchup_grade === "strong");
    const neutral = batters.filter((b) => b.matchup_grade === "neutral");
    const weak = batters.filter((b) => b.matchup_grade === "weak");

    // Top HR targets: sorted by ISO desc, take top 3 with strong/neutral grade
    const topHRTargets = [...batters]
      .filter((b) => b.matchup_grade !== "weak" && b.iso != null && b.iso > 0.150)
      .sort((a, b) => (b.iso ?? 0) - (a.iso ?? 0))
      .slice(0, 3)
      .map((b) => ({
        name: b.player_name,
        slg: b.slg,
        iso: b.iso,
        hr_count: b.hr_count,
      }));

    const summary = {
      strong_count: strong.length,
      neutral_count: neutral.length,
      weak_count: weak.length,
      strong_names: strong.map((b) => b.player_name),
      key_insight: generateKeyInsight(pitcherProfile, batters),
      lineup_grade: computeLineupGrade(batters),
      top_hr_targets: topHRTargets,
      pitcher_tags: computePitcherTags(pitcherProfile),
    };

    const response: GameMatchupResponse = {
      game: buildGameResponse(game, homeAbbr, awayAbbr, venueName),
      pitcher: pitcherProfile,
      batters,
      summary,
      meta: {
        batting_side: battingSide,
        sample,
        pitcher_pitch_types: pitcherPitchTypes,
        lineup_confirmed: lineupConfirmed,
      },
    };

    const usedSeason = pitcherBBs === pitcherBBsCurrent ? season : season - 1;
    console.log(`[/api/mlb/game-matchup] ${Date.now() - startTime}ms | game=${gameId} side=${battingSide} batters=${batters.length} pitcherBBs=${totalPitcherBBs} season=${usedSeason}`);

    // Shorter cache early in season when data changes rapidly (new game logs flowing in)
    const cacheMaxAge = isEarlySeason ? 60 : 300;
    const cacheStale = isEarlySeason ? 120 : 600;
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": `public, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheStale}`,
      },
    });
  } catch (error: any) {
    console.error("[/api/mlb/game-matchup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// ── Response Builders ───────────────────────────────────────────────────────

function buildGameResponse(game: any, homeAbbr: string, awayAbbr: string, venueName: string | null) {
  return {
    game_id: game.game_id,
    game_date: game.game_date,
    game_datetime: game.game_datetime,
    venue_name: venueName,
    venue_id: game.venue_id,
    home_team: { id: game.home_id, name: game.home_name, abbr: homeAbbr },
    away_team: { id: game.away_id, name: game.away_name, abbr: awayAbbr },
    home_pitcher_id: game.home_probable_pitcher_id,
    away_pitcher_id: game.away_probable_pitcher_id,
    home_pitcher_name: game.home_probable_pitcher,
    away_pitcher_name: game.away_probable_pitcher,
  };
}

function buildEmptyBatter(p: any): BatterMatchup {
  return {
    player_id: p.player_id,
    player_name: p.player_name,
    team_abbr: p.team_abbr || "",
    batting_hand: p.batting_hand || "R",
    lineup_position: p.lineup_position,
    pa: 0,
    avg: null,
    obp: null,
    slg: null,
    ops: null,
    iso: null,
    hr_count: 0,
    barrel_pct: null,
    hard_hit_pct: null,
    avg_exit_velo: null,
    woba: null,
    total_batted_balls: 0,
    pitch_splits: [],
    pitch_hand_splits: { vs_rhp: [], vs_lhp: [] },
    h2h: null,
    matchup_grade: "neutral",
    matchup_reason: "No pitcher data available",
    hr_probability_score: null,
    hr_factors: [],
    overlap_score: null,
    recent_barrel_pct: null,
    recent_avg_ev: null,
    recent_hr_count: 0,
    recent_ev_sparkline: [],
    k_pct: null,
    bb_pct: null,
    hand_splits: { vs_rhp: null, vs_lhp: null },
  };
}
