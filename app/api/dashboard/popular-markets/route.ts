/**
 * GET /api/dashboard/popular-markets — Exotic market outliers from EV worker
 *
 * WHAT CHANGED:
 * ─────────────────────────────────────────────────────────────────
 * Before: Route read from `dashboard:popular-markets:data` HASH,
 *         which was supposed to be populated by a cron job that
 *         never existed / was broken. Result: always empty.
 *
 * After:  Reads directly from the EV worker's pre-computed hashes:
 *           ev:{sport}:rows:next_best — HASH of seid → EVRow JSON
 *         Uses the "next_best" preset because Pinnacle does NOT
 *         carry exotic/prop markets (double doubles, first basket,
 *         anytime TD, etc.). The next_best preset uses the
 *         second-best book as the sharp reference and devig via
 *         simple implied probability — it covers every market that
 *         has ≥2 books, which includes all the popular props.
 *
 *         Filters for "exotic" / popular market types and surfaces
 *         the top positive-EV plays per market category.
 *
 * Frontend: Response shape (`PopularMarketsResponse`) is IDENTICAL
 *           to the old route so the frontend requires no changes.
 *
 * Deploy:  Drop-in replacement at app/api/dashboard/popular-markets/route.ts
 */

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { redis, parseRedisValue, hgetallSafe } from "@/lib/shared-redis-client";
import { getMarketDisplay, normalizeRawMarket } from "@/lib/odds/types";
import { impliedProbToAmerican } from "@/lib/ev/devig";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Sports to scan for exotic markets */
const POPULAR_SPORTS = [
  "nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf",
  "wnba", "soccer_epl", "soccer_mls", "soccer_ucl",
];

/**
 * Use the "next_best" preset — this covers exotic markets that Pinnacle
 * doesn't offer. The next_best preset uses the second-best book as the
 * sharp reference with simple implied probability devig.
 *
 * For next_best rows:
 *  - EV lives in  rollup.worst_case  (== ev.mult, single method)
 *  - Fair prob is  devig.p_fair.multiplicative
 *  - best_method is always "multiplicative"
 */
const EDGE_PRESET = "next_best";

/** Short-lived response cache */
const RESPONSE_CACHE_KEY = "dashboard:popular-markets:v2:cache";
const RESPONSE_CACHE_TTL = 30; // seconds

// ---------------------------------------------------------------------------
// Market category definitions
// ---------------------------------------------------------------------------

/**
 * Map of raw market keys (from the worker) → display config.
 * Each raw market key in Redis can match one of these categories.
 * We use startsWith/includes matching so we catch variants like
 * "player_double_double" and "double_double".
 */
interface MarketCategory {
  display: string;
  /** Primary sport(s) this market is relevant to */
  sports: string[];
  /** Max plays to show per category */
  maxPlays: number;
  /** Edge finder URL for "View All" link */
  edgeFinderPath: string;
}

const MARKET_CATEGORIES: Record<string, MarketCategory> = {
  // NBA
  double_double: {
    display: "Double Double",
    sports: ["nba", "wnba", "ncaab"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_double_double,double_double&sports=nba",
  },
  triple_double: {
    display: "Triple Double",
    sports: ["nba"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_triple_double,triple_double&sports=nba",
  },
  first_basket: {
    display: "First Basket",
    sports: ["nba", "ncaab"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_first_basket,first_basket&sports=nba",
  },
  first_team_basket: {
    display: "First Team Basket",
    sports: ["nba"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=first_team_basket&sports=nba",
  },
  // NFL
  anytime_td: {
    display: "Anytime TD",
    sports: ["nfl", "ncaaf"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_anytime_td,anytime_td&sports=nfl",
  },
  first_td: {
    display: "First TD",
    sports: ["nfl", "ncaaf"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_first_td,first_td&sports=nfl",
  },
  // NHL
  anytime_goal: {
    display: "Anytime Goal",
    sports: ["nhl"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_anytime_goal,anytime_goal&sports=nhl",
  },
  first_goal: {
    display: "First Goal Scorer",
    sports: ["nhl"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_first_goal,first_goal&sports=nhl",
  },
  // MLB
  home_run: {
    display: "Home Run",
    sports: ["mlb"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_home_run,home_run,player_home_runs&sports=mlb",
  },
  // Soccer
  goal_scorer: {
    display: "Goal Scorer",
    sports: ["soccer_epl", "soccer_mls", "soccer_ucl", "soccer_laliga", "soccer_uel"],
    maxPlays: 2,
    edgeFinderPath: "/edge-finder?markets=player_anytime_goal,first_goal&sports=soccer_epl",
  },
};

/**
 * Given a raw market key from Redis (e.g. "player_double_double", "anytime_td"),
 * return the category key it belongs to, or null.
 */
function classifyMarket(rawMarket: string): string | null {
  const m = rawMarket.toLowerCase();

  if (m.includes("double_double")) return "double_double";
  if (m.includes("triple_double")) return "triple_double";
  if (m.includes("first_basket") && !m.includes("first_team")) return "first_basket";
  if (m.includes("first_team_basket")) return "first_team_basket";
  if (m.includes("anytime_td") || m.includes("anytime_touchdown")) return "anytime_td";
  if (m.includes("first_td") || m.includes("first_touchdown")) return "first_td";
  if (m.includes("anytime_goal") && !m.includes("first")) return "anytime_goal";
  if (m.includes("first_goal")) return "first_goal";
  if (m.includes("home_run")) return "home_run";
  // Soccer goal scorer (but not first_goal which is NHL)
  if (m.includes("goal_scorer")) return "goal_scorer";

  return null;
}

// ---------------------------------------------------------------------------
// Types (matching existing frontend interface)
// ---------------------------------------------------------------------------

interface MarketPlay {
  player: string;
  team: string | null;
  line: number;
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  marketAvg: number | null;
  marketAvgFormatted: string | null;
  vsMarketAvg: number | null;
}

interface PopularMarket {
  marketKey: string;
  displayName: string;
  sport: string;
  icon: string;
  plays: MarketPlay[];
  edgeFinderUrl: string;
}

interface PopularMarketsResponse {
  markets: PopularMarket[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<string, string> = {
  nba: "🏀",
  nfl: "🏈",
  nhl: "🏒",
  mlb: "⚾",
  ncaab: "🏀",
  ncaaf: "🏈",
  wnba: "🏀",
  soccer_epl: "⚽",
  soccer_mls: "⚽",
  soccer_ucl: "⚽",
  soccer_laliga: "⚽",
  soccer_uel: "⚽",
};

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function normalizeBookIdForFrontend(id: string): string {
  const lower = id.toLowerCase();
  const mappings: Record<string, string> = {
    hardrock: "hard-rock",
    hardrockbet: "hard-rock",
    ballybet: "bally-bet",
    espnbet: "espn",
    "bet-rivers": "betrivers",
    "betmgm-michigan": "betmgm",
    "fanduel-yourway": "fanduelyourway",
  };
  return mappings[lower] ?? lower;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // ── Step 1: Check short-lived cache ───────────────────────────────────
    try {
      const cached = await redis.get<string>(RESPONSE_CACHE_KEY);
      if (cached) {
        const response: PopularMarketsResponse =
          typeof cached === "string" ? JSON.parse(cached) : cached;
        return NextResponse.json(response, {
          headers: {
            "X-Cache": "HIT",
            "X-Timing-Ms": String(Date.now() - startTime),
            "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
          },
        });
      }
    } catch {
      // Cache miss, continue
    }

    // ── Step 2: Read worker data and classify into categories ─────────────
    /**
     * We read from BOTH:
     *   ev:{sport}:rows:next_best   — positive-EV rows (best quality, fewer entries)
     *   edge:{sport}:rows:next_best — positive-edge rows (bigger pool, includes some negative-EV)
     *
     * Priority: positive-EV rows first (they're the real +EV plays).
     * Fall back to edge rows for categories that don't have enough EV rows,
     * but only take edge rows where the "over" side has reasonable longshot odds.
     */
    const categoryPlays = new Map<
      string,
      Array<{ row: any; sport: string; evWorst: number; source: "ev" | "edge" }>
    >();

    const seenSeids = new Set<string>();

    // Helper to process rows from a hash
    function processRows(
      allFields: Record<string, string> | null,
      sport: string,
      source: "ev" | "edge",
    ) {
      if (!allFields || Object.keys(allFields).length === 0) return;

      for (const [, rawValue] of Object.entries(allFields)) {
        const row = parseRedisValue<any>(rawValue, `${source}:${sport}:rows:${EDGE_PRESET}`);
        if (!row) continue;

        // Skip live events
        if (row.meta?.scope === "live") continue;

        // Dedupe across ev and edge sources
        const seid = row.seid ?? "";
        if (seenSeids.has(seid)) continue;
        seenSeids.add(seid);

        const market = row.mkt ?? "";
        const category = classifyMarket(market);
        if (!category) continue;

        // Check that this category is relevant to the sport
        const catConfig = MARKET_CATEGORIES[category];
        if (!catConfig) continue;
        if (!catConfig.sports.includes(sport)) continue;

        const evWorst: number = row.rollup?.worst_case ?? 0;

        // For "ev" source: rows are already positive-EV, just sanity-check
        // For "edge" source: only take rows with EV > -2% (slightly negative is ok)
        //   and with longshot-style odds (American > +100)
        if (source === "ev") {
          if (evWorst > 25 || evWorst < -5) continue;
        } else {
          // Edge rows: prefer the "over" side of exotic props (the longshot side)
          // Filter out heavy favorites and broken data
          const bookAm = row.book?.odds?.am ?? 0;
          if (bookAm < 100) continue; // Only show longshots (+100 and up)
          if (evWorst > 25 || evWorst < -2) continue;
        }

        if (!categoryPlays.has(category)) {
          categoryPlays.set(category, []);
        }
        categoryPlays.get(category)!.push({ row, sport, evWorst, source });
      }
    }

    // First pass: read EV keys (positive-EV rows — highest quality)
    await Promise.all(
      POPULAR_SPORTS.map(async (sport) => {
        const evKey = `ev:${sport}:rows:${EDGE_PRESET}`;
        try {
          const allFields = await hgetallSafe(evKey);
          processRows(allFields, sport, "ev");
        } catch (err) {
          console.warn(`[dashboard/popular-markets] Failed ev for ${sport}:`, err);
        }
      })
    );

    // Check which categories need more data
    const categoriesNeedingMore = new Set<string>();
    for (const [category, config] of Object.entries(MARKET_CATEGORIES)) {
      const existing = categoryPlays.get(category);
      if (!existing || existing.length < config.maxPlays) {
        categoriesNeedingMore.add(category);
      }
    }

    // Second pass: read edge keys only if some categories are thin
    if (categoriesNeedingMore.size > 0) {
      await Promise.all(
        POPULAR_SPORTS.map(async (sport) => {
          // Only bother if any thin category matches this sport
          const sportRelevant = [...categoriesNeedingMore].some(
            (cat) => MARKET_CATEGORIES[cat]?.sports.includes(sport)
          );
          if (!sportRelevant) return;

          const edgeKey = `edge:${sport}:rows:${EDGE_PRESET}`;
          try {
            const allFields = await hgetallSafe(edgeKey);
            processRows(allFields, sport, "edge");
          } catch (err) {
            console.warn(`[dashboard/popular-markets] Failed edge for ${sport}:`, err);
          }
        })
      );
    }

    // ── Step 3: Build market cards ────────────────────────────────────────
    const markets: PopularMarket[] = [];

    for (const [category, plays] of categoryPlays.entries()) {
      const config = MARKET_CATEGORIES[category];
      if (!config) continue;

      // Sort: prefer EV source over edge, then by EV descending
      plays.sort((a, b) => {
        // EV source rows first
        if (a.source !== b.source) return a.source === "ev" ? -1 : 1;
        return b.evWorst - a.evWorst;
      });
      const topPlays = plays.slice(0, config.maxPlays);

      if (topPlays.length === 0) continue;

      // Determine the primary sport from the top plays
      const primarySport = topPlays[0].sport;

      const formattedPlays: MarketPlay[] = topPlays.map(({ row, evWorst }) => {
        const bookId = normalizeBookIdForFrontend(row.book?.id ?? "");
        const bookAm = row.book?.odds?.am ?? 0;
        const playerDisplay = row.ev_data?.player ?? row.ent ?? "Unknown";

        // For next_best, compute a "market average" display from the sharp ref odds
        // The sharp ref (next-best book) odds are in devig.inputs
        const sharpSideAm = row.side === "over"
          ? row.devig?.inputs?.over_am
          : row.devig?.inputs?.under_am;
        const marketAvgFormatted = sharpSideAm != null ? formatOdds(sharpSideAm) : null;

        return {
          player: playerDisplay,
          team: row.ev_data?.team ?? null,
          line: row.line ?? 0.5,
          bestOdds: bookAm,
          bestOddsFormatted: formatOdds(bookAm),
          book: bookId,
          evPercent: evWorst > 0 ? Math.round(evWorst * 10) / 10 : null,
          marketAvg: sharpSideAm ?? null,
          marketAvgFormatted,
          vsMarketAvg: evWorst > 0 ? Math.round(evWorst * 10) / 10 : null,
        };
      });

      markets.push({
        marketKey: category,
        displayName: config.display,
        sport: primarySport,
        icon: SPORT_ICONS[primarySport] || "🎯",
        plays: formattedPlays,
        edgeFinderUrl: config.edgeFinderPath,
      });
    }

    // Sort markets by best edge in any play
    markets.sort((a, b) => {
      const aMax = Math.max(...a.plays.map((p) => p.vsMarketAvg || 0), 0);
      const bMax = Math.max(...b.plays.map((p) => p.vsMarketAvg || 0), 0);
      return bMax - aMax;
    });

    // ── Step 4: Build response & cache ────────────────────────────────────
    const result: PopularMarketsResponse = {
      markets: markets.slice(0, 6), // Max 6 market categories
      timestamp: Date.now(),
    };

    // Cache for next 30s (fire-and-forget)
    redis
      .set(RESPONSE_CACHE_KEY, JSON.stringify(result), { ex: RESPONSE_CACHE_TTL })
      .catch(() => {});

    return NextResponse.json(result, {
      headers: {
        "X-Cache": "MISS",
        "X-Timing-Ms": String(Date.now() - startTime),
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[dashboard/popular-markets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular markets", markets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}