#!/usr/bin/env node
/**
 * MLB Live Game Poller — runs on VPS at /opt/oddsmash/ingestors/
 *
 * Polls statsapi.mlb.com every 30 seconds for in-progress games and writes
 * live state (pitcher, batter, inning, count, baserunners, etc.) to mlb_games
 * in Supabase.
 *
 * pm2 start mlb-live-poller.js --name mlb-live-poller
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = 30_000;
const MLB_LIVE_FEED = "https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live";

// Skip polling during these hours (ET) — saves API calls overnight
const QUIET_START_ET = 2;  // 2am ET
const QUIET_END_ET = 10;   // 10am ET

// ── Supabase ────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("[mlb-live-poller] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function nowHourET() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
}

function todayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function isQuietHours() {
  const hour = parseInt(nowHourET(), 10);
  return hour >= QUIET_START_ET && hour < QUIET_END_ET;
}

function log(msg, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [mlb-live-poller] ${msg}`, ...args);
}

function warn(msg, ...args) {
  const ts = new Date().toISOString();
  console.warn(`[${ts}] [mlb-live-poller] WARN ${msg}`, ...args);
}

// ── Fetch in-progress game IDs from Supabase ────────────────────────────────

async function getActiveGameIds() {
  const today = todayET();

  const { data, error } = await supabase
    .from("mlb_games")
    .select("game_id, status_detailed_state")
    .or(`status_detailed_state.ilike.%in progress%,and(game_date.eq.${today},status_detailed_state.not.ilike.%final%)`)
    .neq("status_detailed_state", "Final")
    .neq("status_detailed_state", "Game Over")
    .not("status_detailed_state", "ilike", "%postponed%")
    .not("status_detailed_state", "ilike", "%cancelled%")
    .not("status_detailed_state", "ilike", "%suspended%");

  if (error) {
    warn("Failed to fetch active games:", error.message);
    return [];
  }

  // Only return games that are actually in progress (scheduled games haven't started)
  return (data || [])
    .filter((g) => {
      const s = (g.status_detailed_state || "").toLowerCase();
      return s.includes("in progress") || s.includes("manager challenge") || s.includes("delay");
    })
    .map((g) => Number(g.game_id));
}

// ── Fetch live feed from MLB Stats API ──────────────────────────────────────

async function fetchLiveFeed(gamePk) {
  const url = MLB_LIVE_FEED.replace("{gamePk}", gamePk);
  const resp = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for game ${gamePk}`);
  return resp.json();
}

// ── Extract live state from MLB API response ─────────────────────────────────

function extractLiveState(feed) {
  const ls = feed?.liveData?.linescore;
  const gd = feed?.gameData;
  const pd = feed?.liveData?.plays?.currentPlay;

  if (!ls || !gd) return null;

  // Scores
  const homeScore = ls.teams?.home?.runs ?? null;
  const awayScore = ls.teams?.away?.runs ?? null;

  // Game status
  const statusState = gd?.status?.detailedState ?? null;
  const statusAbstract = gd?.status?.abstractGameState ?? null;

  // Inning
  const currentInning = ls.currentInning ?? null;
  const currentInningHalf = ls.isTopInning ? "top" : "bottom";

  // Count
  const outs = ls.outs ?? null;
  const balls = ls.balls ?? null;
  const strikes = ls.strikes ?? null;

  // Baserunners
  const runners = ls.offense ?? {};
  const runnersOnBase = {
    first: !!runners.first,
    second: !!runners.second,
    third: !!runners.third,
  };

  // Current pitcher — from linescore defense
  const pitcherData = ls.defense?.pitcher;
  const currentPitcherId = pitcherData?.id ?? null;
  const currentPitcherName = pitcherData?.fullName ?? null;

  // Current batter — from linescore offense
  const batterData = ls.offense?.batter;
  const currentBatterId = batterData?.id ?? null;
  const currentBatterName = batterData?.fullName ?? null;

  // Last play description
  const lastPlayDescription = pd?.result?.description ?? null;

  return {
    home_score: homeScore,
    away_score: awayScore,
    status_detailed_state: statusState,
    current_pitcher_id: currentPitcherId,
    current_pitcher_name: currentPitcherName,
    current_batter_id: currentBatterId,
    current_batter_name: currentBatterName,
    current_inning: currentInning,
    current_inning_half: currentInningHalf,
    current_outs: outs,
    current_balls: balls,
    current_strikes: strikes,
    runners_on_base: runnersOnBase,
    last_play_description: lastPlayDescription,
    live_feed_updated_at: new Date().toISOString(),
  };
}

// ── Write live state to Supabase ─────────────────────────────────────────────

async function updateGameState(gameId, state) {
  const { error } = await supabase
    .from("mlb_games")
    .update(state)
    .eq("game_id", gameId);

  if (error) {
    warn(`Failed to update game ${gameId}:`, error.message);
    return false;
  }
  return true;
}

// ── Poll one game ─────────────────────────────────────────────────────────────

async function pollGame(gamePk) {
  try {
    const feed = await fetchLiveFeed(gamePk);
    const state = extractLiveState(feed);
    if (!state) {
      warn(`No live state extracted for game ${gamePk}`);
      return;
    }
    const ok = await updateGameState(gamePk, state);
    if (ok) {
      const inning = state.current_inning;
      const half = state.current_inning_half;
      const pitcher = state.current_pitcher_name || "?";
      const batter = state.current_batter_name || "?";
      const score = `${state.away_score}-${state.home_score}`;
      log(
        `[${gamePk}] ${score} | ${half === "top" ? "▲" : "▼"}${inning} | ` +
        `${state.current_outs} out | P: ${pitcher} | AB: ${batter}`
      );
    }
  } catch (err) {
    warn(`Error polling game ${gamePk}:`, err.message);
  }
}

// ── Main poll loop ────────────────────────────────────────────────────────────

async function pollCycle() {
  if (isQuietHours()) {
    const hour = parseInt(nowHourET(), 10);
    log(`Quiet hours (${hour}am ET) — skipping poll`);
    return;
  }

  const gameIds = await getActiveGameIds();
  if (gameIds.length === 0) {
    log("No in-progress games found");
    return;
  }

  log(`Polling ${gameIds.length} in-progress game(s): ${gameIds.join(", ")}`);
  await Promise.allSettled(gameIds.map(pollGame));
}

// ── Entry point ───────────────────────────────────────────────────────────────

log("Starting MLB live game poller (30s interval)");
log(`Quiet hours: ${QUIET_START_ET}am–${QUIET_END_ET}am ET`);

// Run immediately on startup, then on interval
pollCycle();
setInterval(pollCycle, POLL_INTERVAL_MS);

// Graceful shutdown
process.on("SIGTERM", () => { log("Received SIGTERM, shutting down"); process.exit(0); });
process.on("SIGINT",  () => { log("Received SIGINT, shutting down");  process.exit(0); });
