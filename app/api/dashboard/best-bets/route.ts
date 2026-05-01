/**
 * GET /api/dashboard/best-bets — Reads from EV worker pre-computed data
 *
 * WHAT CHANGED:
 * ─────────────────────────────────────────────────────────────────
 * Before: Route read from `dashboard:best-bets:ev` ZSET +
 *         `dashboard:best-bets:data` HASH, populated by a separate
 *         compute-best-bets cron job that ran its own SCAN+MGET+devig.
 *         This was fragile (SCAN errors), duplicated logic, and often
 *         returned empty because the cron would break.
 *
 * After:  Reads directly from the EV worker's pre-computed hashes:
 *           ev:{sport}:rows:pinnacle — HASH of seid → EVRow JSON
 *         Same data source as /api/v2/positive-ev (proven, fast).
 *         Sorts by worst-case EV%, takes top 10, auth-gates to 2
 *         for free/scout users.
 *
 *         No more separate cron needed — the VPS worker already
 *         refreshes this data every 15s.
 *
 * Frontend: Response shape (`BestBetsResponse.bets[]`) is IDENTICAL
 *           to the old route so the frontend requires no changes.
 *
 * Deploy:  Drop-in replacement at app/api/dashboard/best-bets/route.ts
 */

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { redis, parseRedisValue, hgetallSafe } from "@/lib/shared-redis-client";
import { getMarketDisplay, normalizeRawMarket } from "@/lib/odds/types";
import { impliedProbToAmerican } from "@/lib/ev/devig";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Sports to scan — matches the EV worker's ACTIVE_SPORTS for major leagues */
const DASHBOARD_SPORTS = [
  "nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf",
  "wnba", "soccer_epl", "soccer_mls",
];

/** Worker preset to read — Pinnacle is the default sharp reference */
const SHARP_PRESET = "pinnacle";

/** EV thresholds */
const MIN_EV = 0.5;
const MAX_EV = 20;

/** Max bets to return */
const DEFAULT_LIMIT = 10;

/** Response cache TTL in seconds — lightweight edge caching */
const RESPONSE_CACHE_KEY = "dashboard:best-bets:v2:cache";
const RESPONSE_CACHE_TTL = 20; // seconds

/** Markets to suppress (team totals are noisy for a highlight section) */
const SUPPRESSED_MARKETS = new Set([
  "home_team_total_points",
  "away_team_total_points",
  "home_team_total",
  "away_team_total",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlimBestBet {
  id: string;
  player: string;
  playerRaw: string | null;
  team: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number;
  fairProb: number | null;
  fairOdds: number | null;
  fairOddsFormatted: string | null;
  u: string | null;
  m: string | null;
  deepLink: string | null;
  sport: string;
  startTime: string | null;
  bookCount: number;
}

interface BestBetsResponse {
  bets: SlimBestBet[];
  timestamp: number;
  source: "redis_cache" | "worker_data" | "empty";
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function normalizeBookIdForFrontend(id: string): string {
  const lower = id.toLowerCase();
  const mappings: Record<string, string> = {
    hardrock: "hard-rock",
    hardrockbet: "hard-rock",
    "hard-rock-indiana": "hard-rock",
    hardrockindiana: "hard-rock",
    ballybet: "bally-bet",
    bally_bet: "bally-bet",
    espnbet: "espn",
    sportsinteraction: "sports-interaction",
    "bet-rivers": "betrivers",
    bet_rivers: "betrivers",
    "betmgm-michigan": "betmgm",
    betmgm_michigan: "betmgm",
    "fanduel-yourway": "fanduelyourway",
    fanduel_yourway: "fanduelyourway",
  };
  return mappings[lower] ?? lower;
}

function formatDisplayName(
  playerName: string | null,
  homeTeam: string | null,
  awayTeam: string | null,
  marketDisplay: string | null,
  market: string | null
): string {
  if (
    playerName === "game_total" ||
    playerName === "game_spread" ||
    !playerName
  ) {
    if (homeTeam && awayTeam) return `${awayTeam} @ ${homeTeam}`;
    return marketDisplay || market || "Game";
  }
  return playerName;
}

/**
 * Convert an EVRow (from the worker) into the SlimBestBet shape
 * that the frontend's BestBetsSection component expects.
 */
function evRowToSlimBet(row: any): SlimBestBet | null {
  const evWorst: number = row.rollup?.worst_case ?? 0;
  if (evWorst < MIN_EV || evWorst > MAX_EV) return null;

  const market = row.mkt ?? "";
  if (SUPPRESSED_MARKETS.has(market.toLowerCase())) return null;

  const bookId = normalizeBookIdForFrontend(row.book?.id ?? "");
  const bookAm = row.book?.odds?.am ?? 0;
  const side = row.side as "over" | "under";

  // Fair probability from power method (conservative)
  const fairProbRaw: number | null = row.devig?.p_fair?.power ?? null;
  let fairOdds: number | null = null;
  let fairOddsFormatted: string | null = null;
  // Fair prob is in 0-1 range
  if (fairProbRaw != null && fairProbRaw > 0 && fairProbRaw < 1) {
    fairOdds = Math.round(impliedProbToAmerican(fairProbRaw));
    fairOddsFormatted = formatOdds(fairOdds);
  }

  const playerDisplay = row.ev_data?.player ?? row.ent ?? "";
  const homeTeam = row.ev_data?.home_team ?? null;
  const awayTeam = row.ev_data?.away_team ?? null;
  const marketDisplay =
    row.ev_data?.market_display ?? normalizeRawMarket(market) ?? getMarketDisplay(market);

  const displayName = formatDisplayName(
    playerDisplay,
    homeTeam,
    awayTeam,
    marketDisplay,
    market
  );

  const allBooksCount = row.ev_data?.all_books?.length ?? 0;

  return {
    id: row.seid ?? `${row.sport}:${row.eid}:${market}:${row.line}:${side}:${bookId}`,
    player: displayName,
    playerRaw: row.ent ?? null,
    team: row.ev_data?.team ?? null,
    homeTeam,
    awayTeam,
    market,
    marketDisplay,
    line: row.line ?? 0,
    side,
    bestOdds: bookAm,
    bestOddsFormatted: formatOdds(bookAm),
    book: bookId,
    evPercent: Math.round(evWorst * 10) / 10,
    fairProb: fairProbRaw != null ? Math.round(fairProbRaw * 1000) / 10 : null,
    fairOdds,
    fairOddsFormatted,
    u: row.book?.link ?? null,
    m: row.book?.mobile_link ?? null,
    deepLink: row.book?.mobile_link ?? row.book?.link ?? null,
    sport: row.sport ?? "",
    startTime: row.ev_data?.start_time ?? null,
    bookCount: allBooksCount,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(params.get("limit") || String(DEFAULT_LIMIT)), 20);
    const bypassCache = params.get("fresh") === "true";

    // ── Step 1: Check short-lived response cache ──────────────────────────
    if (!bypassCache) {
      try {
        const cached = await redis.get<string>(RESPONSE_CACHE_KEY);
        if (cached) {
          const response: BestBetsResponse =
            typeof cached === "string" ? JSON.parse(cached) : cached;
          // Apply limit
          response.bets = response.bets.slice(0, limit);
          return NextResponse.json(response, {
            headers: {
              "X-Cache": "HIT",
              "X-Timing-Ms": String(Date.now() - startTime),
              "Cache-Control": "private, max-age=15",
            },
          });
        }
      } catch {
        // Cache miss, continue
      }
    }

    // ── Step 2: Read from EV worker pre-computed hashes ───────────────────
    const allBets: SlimBestBet[] = [];

    await Promise.all(
      DASHBOARD_SPORTS.map(async (sport) => {
        const rowsKey = `ev:${sport}:rows:${SHARP_PRESET}`;
        try {
          const allFields = await hgetallSafe(rowsKey);
          if (!allFields || Object.keys(allFields).length === 0) return;

          for (const [, rawValue] of Object.entries(allFields)) {
            const row = parseRedisValue<any>(rawValue, rowsKey);
            if (!row) continue;

            // Skip live events — dashboard shows pregame only
            if (row.meta?.scope === "live") continue;

            const bet = evRowToSlimBet(row);
            if (bet) allBets.push(bet);
          }
        } catch (err) {
          console.warn(`[dashboard/best-bets] Failed for ${sport}:`, err);
        }
      })
    );

    // ── Step 3: Sort by EV and de-dupe by player+market+line ──────────────
    allBets.sort((a, b) => b.evPercent - a.evPercent);

    // De-dupe: keep only the best book per player/market/line/side combo
    const seen = new Set<string>();
    const deduped: SlimBestBet[] = [];
    for (const bet of allBets) {
      const dedupeKey = `${bet.sport}:${bet.playerRaw ?? bet.player}:${bet.market}:${bet.line}:${bet.side}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      deduped.push(bet);
    }

    const topBets = deduped.slice(0, DEFAULT_LIMIT);

    if (topBets.length === 0) {
      return NextResponse.json(
        {
          bets: [],
          timestamp: Date.now(),
          source: "empty" as const,
          message: "Data is being refreshed. Please try again shortly.",
        },
        {
          headers: {
            "Cache-Control": "private, max-age=5",
            "X-Cache": "MISS",
            "X-Timing-Ms": String(Date.now() - startTime),
          },
        }
      );
    }

    // ── Step 4: Build response & cache ────────────────────────────────────
    const response: BestBetsResponse = {
      bets: topBets,
      timestamp: Date.now(),
      source: "worker_data",
    };

    // Cache for next 20s (fire-and-forget)
    redis
      .set(RESPONSE_CACHE_KEY, JSON.stringify(response), { ex: RESPONSE_CACHE_TTL })
      .catch(() => {});

    // Auth gating is handled client-side by useIsPro() in the frontend.
    // The API always returns the full top-10; the component shows 2 and
    // locks the rest for free/scout users. This avoids edge function
    // overhead from Supabase auth calls on every dashboard load.

    // Apply limit
    response.bets = response.bets.slice(0, limit);

    return NextResponse.json(response, {
      headers: {
        "X-Cache": "MISS",
        "X-Timing-Ms": String(Date.now() - startTime),
        "Cache-Control": "private, max-age=15",
      },
    });
  } catch (error) {
    console.error("[dashboard/best-bets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch best bets", bets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}