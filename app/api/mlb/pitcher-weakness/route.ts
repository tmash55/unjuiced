"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import type {
  PitcherWeaknessResponse,
  PitcherData,
  BattingOrderSplit,
  InningSplit,
  PitcherHandSplit,
  LineupBatter,
  BatterOdds,
  GameInfo,
} from "./types";

// ── Constants ────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  b1: "1st", b2: "2nd", b3: "3rd", b4: "4th", b5: "5th",
  b6: "6th", b7: "7th", b8: "8th", b9: "9th",
};

const INNING_LABELS: Record<string, string> = {
  i01: "1st", i02: "2nd", i03: "3rd", i04: "4th", i05: "5th",
  i06: "6th", i07: "7th", i08: "8th", i09: "9th", ix: "Extra",
};

const LEAGUE_AVG_OPS = 0.720;

const BOOKS = [
  "draftkings", "fanduel", "betmgm", "caesars", "bet365",
  "betrivers", "fanatics", "espn", "fliff", "hard-rock",
  "thescore", "betparx",
];

const ODDS_MARKETS = ["player_home_runs", "player_hits", "player_strikeouts"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePlayer(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeThrowHand(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hand = value.trim().toUpperCase().slice(0, 1);
  return hand === "L" || hand === "R" ? hand : null;
}

function parseBaseballInnings(value: unknown): number {
  const ip = String(value ?? "0");
  const [full, partial] = ip.split(".");
  const fullInnings = parseInt(full, 10) || 0;
  const partialInnings = partial ? (parseInt(partial, 10) || 0) / 3 : 0;
  return fullInnings + partialInnings;
}

function buildBattingOrderSplits(rows: any[]): BattingOrderSplit[] {
  const splits: BattingOrderSplit[] = [];
  for (let i = 1; i <= 9; i++) {
    const code = `b${i}`;
    const row = rows.find((r: any) => r.split_code === code);
    const pa = Number(row?.plate_appearances ?? 0);
    const avg = row?.avg != null ? Number(row.avg) : null;
    const slg = row?.slg != null ? Number(row.slg) : null;
    splits.push({
      slot: code,
      slot_label: SLOT_LABELS[code] || code,
      ip: row?.innings_pitched != null ? Number(row.innings_pitched) : null,
      avg,
      obp: row?.obp != null ? Number(row.obp) : null,
      slg,
      ops: row?.ops != null ? Number(row.ops) : null,
      iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
      whip: row?.whip != null ? Number(row.whip) : null,
      k_pct: pa >= 5 ? Math.round((Number(row?.strike_outs ?? 0) / pa) * 1000) / 10 : null,
      bb_pct: pa >= 5 ? Math.round((Number(row?.base_on_balls ?? 0) / pa) * 1000) / 10 : null,
      hr: Number(row?.home_runs ?? 0),
      doubles: Number(row?.doubles ?? 0),
      triples: Number(row?.triples ?? 0),
      rbi: Number(row?.rbi ?? 0),
      pa,
    });
  }
  return splits;
}

function buildInningSplits(rows: any[]): InningSplit[] {
  const codes = ["i01", "i02", "i03", "i04", "i05", "i06", "i07", "i08", "i09"];
  const splits: InningSplit[] = [];
  for (const code of codes) {
    const row = rows.find((r: any) => r.split_code === code);
    const pa = Number(row?.plate_appearances ?? 0);
    const ip = row?.innings_pitched != null ? Number(row.innings_pitched) : null;
    const er = Number(row?.earned_runs ?? row?.home_runs ?? 0); // approximate ER if not available
    const avg = row?.avg != null ? Number(row.avg) : null;
    const slg = row?.slg != null ? Number(row.slg) : null;
    splits.push({
      inning: code,
      inning_label: INNING_LABELS[code] || code,
      ip,
      avg,
      slg,
      ops: row?.ops != null ? Number(row.ops) : null,
      iso: avg != null && slg != null ? Math.round((slg - avg) * 1000) / 1000 : null,
      whip: row?.whip != null ? Number(row.whip) : null,
      k_pct: pa >= 5 ? Math.round((Number(row?.strike_outs ?? 0) / pa) * 1000) / 10 : null,
      bb_pct: pa >= 5 ? Math.round((Number(row?.base_on_balls ?? 0) / pa) * 1000) / 10 : null,
      era: ip != null && ip > 0 ? Math.round((er / ip) * 9 * 100) / 100 : null,
      hr: Number(row?.home_runs ?? 0),
      pa,
    });
  }
  return splits;
}

function computeEdgeScore(pitcherOps: number | null, batterOps: number | null, pitcherPA: number, batterPA: number): number {
  // Pitcher Vulnerability Score: higher OPS-against = more vulnerable
  const pvs = pitcherOps != null
    ? Math.min(100, Math.max(0, ((pitcherOps - LEAGUE_AVG_OPS) / LEAGUE_AVG_OPS) * 100 + 50))
    : 50;
  // Batter Strength Score: higher OPS = stronger hitter
  const bss = batterOps != null
    ? Math.min(100, Math.max(0, ((batterOps - LEAGUE_AVG_OPS) / LEAGUE_AVG_OPS) * 100 + 50))
    : 50;
  const rawEdge = (pvs * 0.5) + (bss * 0.5);
  // Sample size dampening
  const sampleAdj = Math.min(pitcherPA, batterPA, 20) / 20;
  return Math.min(100, Math.max(0, Math.round(rawEdge * sampleAdj)));
}

function edgeTier(score: number): LineupBatter["edge_tier"] {
  if (score >= 71) return "strong_edge";
  if (score >= 51) return "edge";
  if (score >= 31) return "mild";
  if (score >= 15) return "neutral";
  return "no_edge";
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const gameId = sp.get("gameId");
    const season = parseInt(sp.get("season") || String(new Date().getFullYear()), 10);

    if (!gameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // ── 1. Game info ─────────────────────────────────────────────────────
    const { data: game, error: gameError } = await supabase
      .from("mlb_games")
      .select(`
        game_id, game_date, game_datetime, venue_name, odds_game_id,
        home_name, away_name, home_id, away_id,
        home_probable_pitcher, away_probable_pitcher,
        home_probable_pitcher_id, away_probable_pitcher_id,
        home_team:mlb_teams!mlb_games_home_id_fkey (abbreviation),
        away_team:mlb_teams!mlb_games_away_id_fkey (abbreviation)
      `)
      .eq("game_id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const homeAbbr = (game.home_team as any)?.abbreviation || "";
    const awayAbbr = (game.away_team as any)?.abbreviation || "";

    // Allow pitcher overrides (e.g. reliever selection)
    const overrideHomePitcherId = sp.get("homePitcherId") ? parseInt(sp.get("homePitcherId")!, 10) : null;
    const overrideAwayPitcherId = sp.get("awayPitcherId") ? parseInt(sp.get("awayPitcherId")!, 10) : null;
    const homePitcherId = overrideHomePitcherId || game.home_probable_pitcher_id;
    const awayPitcherId = overrideAwayPitcherId || game.away_probable_pitcher_id;

    const pitcherIds = [homePitcherId, awayPitcherId].filter(Boolean) as number[];
    const [
      pitcherHandsResult,
      playerHandsResult,
      playerHrHandsResult,
      pitcherSeasonStatsResult,
      splitsResult,
      lineupResult,
      batterSplitsResult,
    ] = await Promise.all([
      pitcherIds.length > 0
        ? supabase
            .from("mlb_batted_balls")
            .select("pitcher_id, pitcher_hand")
            .in("pitcher_id", pitcherIds)
            .not("pitcher_hand", "is", null)
        : Promise.resolve({ data: [], error: null }),

      pitcherIds.length > 0
        ? supabase
            .from("mlb_players")
            .select("mlb_player_id, throw_hand")
            .in("mlb_player_id", pitcherIds)
        : Promise.resolve({ data: [], error: null }),

      pitcherIds.length > 0
        ? supabase
            .from("mlb_players_hr")
            .select("mlb_player_id, throws")
            .in("mlb_player_id", pitcherIds)
        : Promise.resolve({ data: [], error: null }),

      pitcherIds.length > 0
        ? supabase
            .from("mlb_pitching_season_stats")
            .select("person_id, inningsPitched, earnedRuns, hits, baseOnBalls, strikeOuts, homeRuns, gamesStarted, gamesPlayed, wins, losses")
            .in("person_id", pitcherIds)
            .eq("season", season)
        : Promise.resolve({ data: [], error: null }),

      // Pitcher splits (batting_order + inning) for both pitchers
      pitcherIds.length > 0
        ? supabase
            .from("mlb_pitcher_splits")
            .select("*")
            .in("player_id", pitcherIds)
            .eq("split_group", "pitching")
            .in("split_type", ["batting_order", "inning"])
            .eq("season", season)
        : Promise.resolve({ data: [], error: null }),

      // Daily lineups for both sides
      supabase
        .from("mlb_daily_lineups")
        .select("player_id, player_name, batting_order, bats, side, is_confirmed, team_id")
        .eq("game_id", gameId)
        .gte("batting_order", 1)
        .lte("batting_order", 9)
        .order("batting_order", { ascending: true }),

      // Batter splits at their batting order spot
      supabase
        .from("mlb_pitcher_splits")
        .select("player_id, split_code, avg, obp, slg, ops, home_runs, doubles, triples, rbi, strike_outs, base_on_balls, plate_appearances")
            .eq("split_group", "hitting")
            .eq("split_type", "batting_order")
            .eq("season", season),
    ]);

    const pitcherHandMap = new Map<number, string>();
    const handCounts = new Map<number, Record<string, number>>();
    for (const row of (pitcherHandsResult.data ?? []) as Array<{ pitcher_id: number; pitcher_hand: string | null }>) {
      const hand = normalizeThrowHand(row.pitcher_hand);
      if (!row.pitcher_id || !hand) continue;
      const counts = handCounts.get(row.pitcher_id) ?? {};
      counts[hand] = (counts[hand] || 0) + 1;
      handCounts.set(row.pitcher_id, counts);
    }
    for (const [pitcherId, counts] of handCounts.entries()) {
      const topHand = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topHand) pitcherHandMap.set(pitcherId, topHand);
    }
    for (const row of (playerHandsResult.data ?? []) as Array<{ mlb_player_id: number; throw_hand: string | null }>) {
      const hand = normalizeThrowHand(row.throw_hand);
      if (row.mlb_player_id && hand && !pitcherHandMap.has(row.mlb_player_id)) {
        pitcherHandMap.set(row.mlb_player_id, hand);
      }
    }
    for (const row of (playerHrHandsResult.data ?? []) as Array<{ mlb_player_id: number; throws: string | null }>) {
      const hand = normalizeThrowHand(row.throws);
      if (row.mlb_player_id && hand && !pitcherHandMap.has(row.mlb_player_id)) {
        pitcherHandMap.set(row.mlb_player_id, hand);
      }
    }

    const pitcherHeadlineMap = new Map<number, PitcherData["headline"]>();
    for (const row of (pitcherSeasonStatsResult.data ?? []) as Array<Record<string, unknown>>) {
      const pitcherId = Number(row.person_id ?? 0);
      if (!pitcherId) continue;

      const ip = parseBaseballInnings(row.inningsPitched);
      const er = Number(row.earnedRuns ?? 0);
      const hits = Number(row.hits ?? 0);
      const walks = Number(row.baseOnBalls ?? 0);
      const strikeouts = Number(row.strikeOuts ?? 0);
      const homeRuns = Number(row.homeRuns ?? 0);
      const gamesStarted = Number(row.gamesStarted ?? row.gamesPlayed ?? 0);
      const wins = row.wins != null ? Number(row.wins) : null;
      const losses = row.losses != null ? Number(row.losses) : null;

      pitcherHeadlineMap.set(pitcherId, {
        era: ip > 0 ? Math.round(((er / ip) * 9) * 100) / 100 : null,
        whip: ip > 0 ? Math.round(((hits + walks) / ip) * 100) / 100 : null,
        k_per_9: ip > 0 ? Math.round(((strikeouts / ip) * 9) * 10) / 10 : null,
        bb_per_9: ip > 0 ? Math.round(((walks / ip) * 9) * 10) / 10 : null,
        hr_per_9: ip > 0 ? Math.round(((homeRuns / ip) * 9) * 100) / 100 : null,
        ip: Math.round(ip * 10) / 10,
        wins,
        losses,
        games_started: gamesStarted || null,
      });
    }

    const allPitcherSplits = (splitsResult.data ?? []) as any[];
    const allLineups = (lineupResult.data ?? []) as any[];
    const allBatterSplits = (batterSplitsResult.data ?? []) as any[];

    console.log(`[pitcher-weakness] gameId=${gameId} season=${season} pitcherIds=${pitcherIds.join(",")} lineups=${allLineups.length} pitcherSplits=${allPitcherSplits.length} batterSplits=${allBatterSplits.length}`);
    if (allLineups.length > 0) {
      console.log(`[pitcher-weakness] lineup sides: ${[...new Set(allLineups.map((l: any) => l.side))].join(",")}, sample: ${JSON.stringify(allLineups[0])}`);
    }
    if (lineupResult.error) console.error(`[pitcher-weakness] lineup error:`, lineupResult.error);
    if (batterSplitsResult.error) console.error(`[pitcher-weakness] batterSplits error:`, batterSplitsResult.error);

    // ── 3. Build pitcher data ────────────────────────────────────────────
    function buildPitcherData(pitcherId: number | null, name: string | null, teamAbbr: string): PitcherData | null {
      if (!pitcherId) return null;

      const pitcherRows = allPitcherSplits.filter((r: any) => r.player_id === pitcherId);
      const boRows = pitcherRows.filter((r: any) => r.split_type === "batting_order");
      const inningRows = pitcherRows.filter((r: any) => r.split_type === "inning");

      // Aggregate headline stats from batting order splits
      let totalIP = 0, totalH = 0, totalBB = 0, totalK = 0, totalHR = 0, totalGS = 0;
      for (const r of boRows) {
        totalIP += Number(r.innings_pitched ?? 0);
        totalH += Number(r.hits ?? 0);
        totalBB += Number(r.base_on_balls ?? 0);
        totalK += Number(r.strike_outs ?? 0);
        totalHR += Number(r.home_runs ?? 0);
      }
      // Estimate GS from inning splits (count of innings with data)
      totalGS = inningRows.filter((r: any) => r.split_code === "i01" && Number(r.plate_appearances ?? 0) > 0).length || 0;

      const hand = pitcherHandMap.get(pitcherId) ?? null;
      const headline = pitcherHeadlineMap.get(pitcherId) ?? {
        era: totalIP > 0 ? Math.round(((totalHR * 2.5) / totalIP) * 9 * 100) / 100 : null,
        whip: totalIP > 0 ? Math.round(((totalH + totalBB) / totalIP) * 100) / 100 : null,
        k_per_9: totalIP > 0 ? Math.round((totalK / totalIP) * 9 * 10) / 10 : null,
        bb_per_9: totalIP > 0 ? Math.round((totalBB / totalIP) * 9 * 10) / 10 : null,
        hr_per_9: totalIP > 0 ? Math.round((totalHR / totalIP) * 9 * 100) / 100 : null,
        ip: Math.round(totalIP * 10) / 10,
        wins: null,
        losses: null,
        games_started: totalGS || null,
      };

      return {
        player_id: pitcherId,
        name: name || "TBD",
        hand,
        team_abbr: teamAbbr,
        headline,
        batting_order_splits: buildBattingOrderSplits(boRows),
        inning_splits: buildInningSplits(inningRows),
        hand_splits: {
          vs_lhb: null, // Could enrich from mlb_pitcher_pitchtype_hand_splits
          vs_rhb: null,
        },
      };
    }

    // Resolve pitcher names — use override names if pitcher was swapped
    let awayPitcherName = game.away_probable_pitcher;
    let homePitcherName = game.home_probable_pitcher;
    if (overrideAwayPitcherId || overrideHomePitcherId) {
      const overrideIds = [overrideAwayPitcherId, overrideHomePitcherId].filter(Boolean) as number[];
      if (overrideIds.length > 0) {
        const { data: overrideNames } = await supabase
          .from("mlb_players_hr")
          .select("mlb_player_id, name")
          .in("mlb_player_id", overrideIds);
        if (overrideNames) {
          for (const p of overrideNames) {
            if (p.mlb_player_id === overrideAwayPitcherId) awayPitcherName = p.name;
            if (p.mlb_player_id === overrideHomePitcherId) homePitcherName = p.name;
          }
        }
      }
    }

    const awayPitcher = buildPitcherData(awayPitcherId, awayPitcherName, awayAbbr);
    const homePitcher = buildPitcherData(homePitcherId, homePitcherName, homeAbbr);

    // ── 4. Build lineups with edge scores ────────────────────────────────
    const batterSplitMap = new Map<string, any>();
    for (const r of allBatterSplits) {
      batterSplitMap.set(`${r.player_id}:${r.split_code}`, r);
    }

    function buildSpotStats(row: any): import("./types").BatterSpotStats | null {
      if (!row) return null;
      const pa = Number(row.plate_appearances ?? 0);
      return {
        avg: row.avg != null ? Number(row.avg) : null,
        obp: row.obp != null ? Number(row.obp) : null,
        slg: row.slg != null ? Number(row.slg) : null,
        ops: row.ops != null ? Number(row.ops) : null,
        iso: row.avg != null && row.slg != null ? Math.round((Number(row.slg) - Number(row.avg)) * 1000) / 1000 : null,
        hr: Number(row.home_runs ?? 0),
        doubles: Number(row.doubles ?? 0),
        triples: Number(row.triples ?? 0),
        rbi: Number(row.rbi ?? 0),
        k_pct: pa >= 5 ? Math.round((Number(row.strike_outs ?? 0) / pa) * 1000) / 10 : null,
        bb_pct: pa >= 5 ? Math.round((Number(row.base_on_balls ?? 0) / pa) * 1000) / 10 : null,
        pa,
      };
    }

    function buildLineup(side: string, opposingPitcher: PitcherData | null): LineupBatter[] {
      const sideLineup = allLineups.filter((l: any) => l.side === side);
      return sideLineup.map((l: any) => {
        const spotCode = `b${l.batting_order}`;
        const batterSpot = batterSplitMap.get(`${l.player_id}:${spotCode}`);
        const pitcherSpot = opposingPitcher?.batting_order_splits.find((s) => s.slot === spotCode);

        const batterOps = batterSpot?.ops != null ? Number(batterSpot.ops) : null;
        const pitcherOps = pitcherSpot?.ops ?? null;
        const batterPA = Number(batterSpot?.plate_appearances ?? 0);
        const pitcherPA = pitcherSpot?.pa ?? 0;

        const score = computeEdgeScore(pitcherOps, batterOps, pitcherPA, batterPA);

        return {
          player_id: l.player_id,
          player_name: l.player_name || `Player ${l.player_id}`,
          batting_order: l.batting_order,
          bats: l.bats || "R",
          edge_score: score,
          edge_tier: edgeTier(score),
          season_ops: batterOps,
          season_avg: batterSpot?.avg != null ? Number(batterSpot.avg) : null,
          season_slg: batterSpot?.slg != null ? Number(batterSpot.slg) : null,
          season_hr: Number(batterSpot?.home_runs ?? 0),
          l7_trend: null, // Would need recent game logs to compute
          bvp: null, // Would need career BvP data
          odds: { hr: null, hits: null, strikeouts: null },
          spot_stats: buildSpotStats(batterSpot),
          all_spot_stats: (() => {
            const all: Record<string, import("./types").BatterSpotStats> = {};
            for (let s = 1; s <= 9; s++) {
              const code = `b${s}`;
              const row = batterSplitMap.get(`${l.player_id}:${code}`);
              const stats = buildSpotStats(row);
              if (stats && stats.pa > 0) all[code] = stats;
            }
            return all;
          })(),
        };
      });
    }

    const awayLineup = buildLineup("away", homePitcher);
    const homeLineup = buildLineup("home", awayPitcher);

    // ── 5. Enrich with Redis odds (best-effort) ──────────────────────────
    const oddsGameId = game.odds_game_id;
    if (oddsGameId) {
      const allBatters = [...awayLineup, ...homeLineup];
      for (const batter of allBatters) {
        try {
          for (const market of ODDS_MARKETS) {
            const keys = BOOKS.map((b) => `odds:mlb:${oddsGameId}:${market}:${b}`);
            const values = await redis.mget<(string | Record<string, any> | null)[]>(...keys);
            const playerNorm = normalizePlayer(batter.player_name);

            let bestPrice: number | null = null;
            let bestBook = "";
            let bestLink: string | null = null;
            let bestMobileLink: string | null = null;

            for (let i = 0; i < values.length; i++) {
              const raw = values[i];
              if (!raw) continue;
              try {
                const parsed: Record<string, any> = typeof raw === "string" ? JSON.parse(raw) : raw;
                for (const [, sel] of Object.entries(parsed)) {
                  if (!sel || typeof sel !== "object") continue;
                  const selName = normalizePlayer(sel.player || sel.name || "");
                  if (selName !== playerNorm) continue;
                  if ((sel.side || "").toLowerCase() !== "over") continue;
                  const price = typeof sel.price === "string" ? parseInt(sel.price.replace("+", ""), 10) : sel.price;
                  if (price != null && !isNaN(price) && (bestPrice == null || price > bestPrice)) {
                    bestPrice = price;
                    bestBook = BOOKS[i];
                    bestLink = sel.link || null;
                    bestMobileLink = sel.mobile_link || null;
                  }
                }
              } catch { /* skip parse errors */ }
            }

            if (bestPrice != null) {
              const oddsEntry = { best_price: bestPrice, best_book: bestBook, link: bestLink, mobile_link: bestMobileLink };
              if (market === "player_home_runs") batter.odds.hr = oddsEntry;
              else if (market === "player_hits") batter.odds.hits = oddsEntry;
              else if (market === "player_strikeouts") batter.odds.strikeouts = oddsEntry;
            }
          }
        } catch { /* skip individual batter odds failures */ }
      }
    }

    // ── 6. Build response ────────────────────────────────────────────────
    const lineupConfirmedAway = allLineups.some((l: any) => l.side === "away" && l.is_confirmed);
    const lineupConfirmedHome = allLineups.some((l: any) => l.side === "home" && l.is_confirmed);

    const gameInfo: GameInfo = {
      game_id: Number(gameId),
      game_date: game.game_date,
      game_datetime: game.game_datetime,
      venue_name: game.venue_name || null,
      home_team_id: game.home_id,
      away_team_id: game.away_id,
      home_team_abbr: homeAbbr,
      away_team_abbr: awayAbbr,
      home_team_name: game.home_name || "",
      away_team_name: game.away_name || "",
      weather: null, // Could enrich from mlb_game_weather
      odds: null, // Could enrich from Redis game odds
    };

    const response: PitcherWeaknessResponse = {
      game: gameInfo,
      away_pitcher: awayPitcher,
      home_pitcher: homePitcher,
      away_lineup: awayLineup,
      home_lineup: homeLineup,
      meta: {
        season,
        lineup_confirmed_away: lineupConfirmedAway,
        lineup_confirmed_home: lineupConfirmedHome,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[pitcher-weakness] Error:", err);
    return NextResponse.json({ error: "Failed to fetch pitcher weakness data" }, { status: 500 });
  }
}
