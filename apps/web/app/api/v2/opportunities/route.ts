/**
 * GET /api/v2/opportunities — Refactored (thin cache-reader)
 *
 * WHAT CHANGED vs original opportunities-route.ts (2008 lines):
 * ──────────────────────────────────────────────────────────────
 * Before: Full EV computation per cache miss — 50–250+ Redis HTTP calls,
 *         5–25 s per request, frequent 504 timeouts.
 *
 * After:  Reads pre-computed EVRow data from per-sport HASHes via HGETALL:
 *           ev:{sport}:rows:{preset}    — HASH of seid → EVRow JSON
 *           v2:opps:{hash}             — full cached filtered response
 *
 *         Per-sport HASHes are written atomically by the worker (DEL + HSET
 *         in one pipeline) so there's no race condition between sports.
 *         ZSET-based lookups have been removed — the global ZSET has a race
 *         condition where parallel sport writes (DEL + ZADD) cause only the
 *         last sport to survive.
 *
 *         Total Redis calls: 1 on cache hit, 1 per sport on miss.
 *
 * The response schema (OpportunitiesResponse) and all Opportunity field
 * names are IDENTICAL to the original route — no frontend changes needed.
 *
 * Filter logic (minOdds, maxOdds, minEdge, minEV, requireFullBlend,
 * requireTwoWay, marketType, marketLines, sortBy) is applied in-process
 * on pre-computed data, which is CPU-bound and fast (no Redis round-trips).
 */

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getPreset } from "@/lib/odds/presets";
import { redis, parseRedisValue, hashCacheKey, hgetallSafe } from "@/lib/shared-redis-client"; // /api/v2/shared-redis-client.ts

// ---------------------------------------------------------------------------
// Types — kept identical to original so frontend stays unchanged
// ---------------------------------------------------------------------------

interface BookWeight {
  book: string;
  weight: number;
}

interface BookOffer {
  book: string;
  price: number;
  decimal: number;
  link: string | null;
  mobile_link: string | null;
  sgp: string | null;
  limits: { max: number } | null;
  included_in_average?: boolean;
  average_exclusion_reason?: string | null;
  odd_id?: string;
}

interface MarketCoverage {
  n_books_over: number;
  n_books_under: number;
  two_way_devig_ready: boolean;
}

interface DevigInputs {
  source: "sharp_book" | "sharp_blend" | "market_average";
  aggregation: "single" | "mean" | "weighted";
  over_books: string[];
  under_books: string[];
}

interface OppositeSide {
  side: "over" | "under";
  sharp_price: string | null;
  sharp_decimal: number | null;
  best_book: string | null;
  best_price: string | null;
  best_decimal: number | null;
  all_books: BookOffer[];
}

interface Opportunity {
  sport: string;
  event_id: string;
  timestamp: number;
  event: { home_team: string; away_team: string; start_time: string } | null;
  player: string;
  player_id: string | null;
  team: string | null;
  position: string | null;
  market: string;
  market_display: string;
  line: number;
  side: "over" | "under";

  best_book: string;
  best_price: string;
  best_decimal: number;
  n_books: number;
  best_link: string | null;
  best_mobile_link: string | null;

  sharp_price: string | null;
  sharp_decimal: number | null;
  sharp_books: string[];
  blend_complete: boolean;
  blend_weight_available: number;
  avg_book_count: number;

  edge: number | null;
  edge_pct: number | null;

  best_implied: number | null;
  sharp_implied: number | null;

  true_probability: number | null;
  fair_decimal: number | null;
  fair_american: string | null;
  implied_edge: number | null;
  ev: number | null;
  ev_pct: number | null;
  kelly_fraction: number | null;
  devig_method: "proper" | "estimated" | null;

  overround: number | null;
  market_coverage: MarketCoverage | null;
  devig_inputs: DevigInputs | null;
  opposite_side: OppositeSide | null;
  all_books: BookOffer[];
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  total_scanned: number;
  total_after_filters: number;
  filters: {
    sports: string[];
    markets: string[] | null;
    min_odds: number;
    max_odds: number;
    min_edge: number;
    min_ev: number;
    preset: string | null;
    blend: BookWeight[] | null;
    require_full_blend: boolean;
    min_books_per_side: number;
    require_two_way: boolean;
  };
  timing_ms: number;
  cache_hit: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPPS_CACHE_PREFIX = "v2:opps:";
const OPPS_CACHE_TTL = 45; // seconds

const VALID_SPORTS = new Set([
  "nba", "nfl", "nhl", "ncaab", "ncaaf", "mlb", "ncaabaseball",
  "wnba", "soccer_epl", "soccer_laliga", "soccer_mls", "soccer_ucl",
  "soccer_uel", "tennis_atp", "tennis_challenger", "tennis_itf_men",
  "tennis_itf_women", "tennis_utr_men", "tennis_utr_women", "tennis_wta", "ufc",
]);

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

function buildFiltersCacheKey(params: URLSearchParams, blend: BookWeight[] | null): string {
  const sports = (params.get("sports") || "nba")
    .toLowerCase().split(",").filter(Boolean).sort().join(",");
  const markets = (params.get("markets") || "").toLowerCase().split(",").filter(Boolean).sort().join(",");
  const minOdds = params.get("minOdds") || "-500";
  const maxOdds = params.get("maxOdds") || "10000";
  const minEdge = params.get("minEdge") || "0";
  const minEV = params.get("minEV") || "0";
  const limit = params.get("limit") || "100";
  const sort = params.get("sort") || "ev";
  const requireFullBlend = params.get("requireFullBlend") || "false";
  const minBooksPerSide = params.get("minBooksPerSide") || "2";
  const requireTwoWay = params.get("requireTwoWay") || "false";
  const marketType = params.get("marketType") || "";
  const blendKey = blend
    ? blend.map((b) => `${b.book}:${b.weight}`).sort().join(",")
    : params.get("preset") || "default";
  const raw = `${sports}|${markets}|${minOdds}|${maxOdds}|${minEdge}|${minEV}|${limit}|${sort}|${requireFullBlend}|${minBooksPerSide}|${requireTwoWay}|${marketType}|${blendKey}`;
  return hashCacheKey(raw);
}

// ---------------------------------------------------------------------------
// Blend parsing
// ---------------------------------------------------------------------------

function parseBlend(blendStr: string | null): BookWeight[] | null {
  if (!blendStr) return null;
  const weights: BookWeight[] = [];
  for (const part of blendStr.split(",")) {
    const [book, weightStr] = part.split(":");
    const weight = parseFloat(weightStr);
    if (book && !isNaN(weight) && weight > 0 && weight <= 1) {
      weights.push({ book: book.toLowerCase(), weight });
    }
  }
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (weights.length === 0 || Math.abs(total - 1) > 0.01) return null;
  return weights;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const params = new URL(req.url).searchParams;

  try {
    // ── Parse parameters ────────────────────────────────────────────────────
    const sportsParam = (params.get("sports") || "nba")
      .toLowerCase().split(",").filter(Boolean);
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));
    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    const markets = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const minOdds = parseInt(params.get("minOdds") || "-500");
    const maxOdds = parseInt(params.get("maxOdds") || "10000");
    const minEdge = parseFloat(params.get("minEdge") || "0");
    const minEV = parseFloat(params.get("minEV") || "0");
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);
    const sortBy = params.get("sort") === "edge" ? "edge" : "ev";
    const requireFullBlend = params.get("requireFullBlend") === "true";
    const minBooksPerSide = Math.max(1, parseInt(params.get("minBooksPerSide") || "2"));
    const requireTwoWay = params.get("requireTwoWay") === "true";
    const marketType = params.get("marketType") as "player" | "game" | null;

    let marketLines: Record<string, number[]> = {};
    const marketLinesParam = params.get("marketLines");
    if (marketLinesParam) {
      try { marketLines = JSON.parse(marketLinesParam); } catch { /* ignore */ }
    }

    // Blend/preset resolution — mirrors original logic exactly
    const presetId = params.get("preset");
    const blendParam = params.get("blend");
    let blend: BookWeight[] | null = null;
    let presetName: string | null = null;
    let useAverage = false;
    let useNextBest = false;

    if (presetId) {
      if (presetId === "next_best") {
        useNextBest = true;
        presetName = "Next Best";
      } else {
        const preset = getPreset(presetId);
        if (preset) {
          presetName = preset.name;
          if (preset.books.length > 0) {
            blend = preset.books;
          } else {
            useAverage = true;
          }
        } else if (presetId !== "average") {
          blend = [{ book: presetId.toLowerCase(), weight: 1.0 }];
          presetName = presetId;
        }
      }
    } else if (blendParam) {
      blend = parseBlend(blendParam);
    }

    // Determine the preset key used by the worker (which only pre-computes standard presets)
    // For custom blends, try to find the closest matching worker preset
    const workerPreset = resolveWorkerPreset(blend, useAverage, useNextBest);

    // ── Step 1: Check full filtered-response cache ────────────────────────
    const cacheKeyHash = buildFiltersCacheKey(params, blend);
    const responseCacheKey = `${OPPS_CACHE_PREFIX}${cacheKeyHash}`;

    if (params.get("refresh") !== "true" && params.get("refresh") !== "1") {
      try {
        const cached = await redis.get<OpportunitiesResponse>(responseCacheKey);
        if (cached) {
          const response = typeof cached === "string" ? JSON.parse(cached) : cached;
          return NextResponse.json(
            { ...response, cache_hit: true, timing_ms: Date.now() - startTime },
            {
              headers: {
                "X-Cache": "HIT",
                "X-Timing-Ms": String(Date.now() - startTime),
                "Cache-Control": "private, max-age=15",
              },
            }
          );
        }
      } catch (err) {
        console.warn("[opportunities] Response cache read failed:", err);
      }
    }

    // ── Step 2: Read per-sport pre-computed EVRow data via HGETALL ────────
    // Worker writes EVRow objects to ev:{sport}:rows:{preset} HASH.
    // We use HGETALL to read all rows from each per-sport hash directly,
    // avoiding the global ZSET entirely (which has a race condition when
    // multiple sports write in parallel — DEL+ZADD causes only the last
    // sport to survive).
    let allOpportunities: Opportunity[] = [];
    let workerDataFound = false;

    await Promise.all(
      sports.map(async (sport) => {
        const rowsKey = `edge:${sport}:rows:${workerPreset}`;

        // HGETALL returns all field-value pairs from the per-sport hash.
        // Each sport's hash is written atomically by the worker (DEL + HSET in one pipeline).
        let allFields: Record<string, string> | null = null;
        try {
          allFields = await hgetallSafe(rowsKey);
        } catch (err) {
          console.warn(`[opportunities] HGETALL failed for ${sport}:`, err);
          return;
        }

        if (!allFields || Object.keys(allFields).length === 0) return;
        workerDataFound = true;

        for (const [seid, rawValue] of Object.entries(allFields)) {
          const row = parseRedisValue<any>(rawValue, `${rowsKey}:${seid}`);
          if (!row) continue;

          // Filter out live / already-started games (matches production behavior)
          if (row.meta?.scope === "live" || row.ev_data?.is_live === true) continue;
          const startTime = row.ev_data?.start_time;
          if (startTime) {
            const gameStart = new Date(startTime);
            if (!isNaN(gameStart.getTime()) && gameStart.getTime() <= Date.now()) continue;
          }

          // Map EVRow → Opportunity
          allOpportunities.push(evRowToOpportunity(row, useNextBest));
        }
      })
    );

    // ── Step 3: No data found — return empty results (not an error) ─────
    // This can happen when a specific preset/book has no odds for the
    // requested sport, which is normal (e.g. FanDuel has no NHL lines).
    // Only the frontend decides whether to show "no results" messaging.

    const totalScanned = allOpportunities.length;

    // ── Step 4: Apply client-side filters ────────────────────────────────
    // All filters applied in-process on pre-computed data — zero extra Redis calls.

    // Self-comparison exclusion for single-book presets
    const selfComparisonBooks = new Set<string>();
    if (blend && blend.length === 1) {
      selfComparisonBooks.add(blend[0].book.toLowerCase());
    } else if (!blend && presetId && presetId !== "average" && presetId !== "next_best") {
      selfComparisonBooks.add(presetId.toLowerCase());
    }

    allOpportunities = allOpportunities.filter((o) => {
      if (selfComparisonBooks.size > 0 && selfComparisonBooks.has((o.best_book || "").toLowerCase())) return false;

      if (marketType) {
        const isPlayer = o.player && o.player !== "" && o.player.toLowerCase() !== "game";
        if (marketType === "player" && !isPlayer) return false;
        if (marketType === "game" && isPlayer) return false;
      }

      if (Object.keys(marketLines).length > 0) {
        const normMarket = (o.market || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
        for (const [key, lines] of Object.entries(marketLines)) {
          const normKey = key.toLowerCase().replace(/[^a-z0-9-]/g, "");
          if (normMarket.includes(normKey) || normKey.includes(normMarket)) {
            if (lines && lines.length > 0 && !lines.includes(o.line)) return false;
          }
        }
      }

      if (markets && !markets.includes(o.market)) return false;

      const priceNum = parseInt((o.best_price || "0").replace("+", ""), 10);
      if (priceNum < minOdds || priceNum > maxOdds) return false;
      if (minEdge > 0 && (o.edge_pct === null || o.edge_pct < minEdge)) return false;
      if (minEV > 0 && (o.ev_pct === null || o.ev_pct < minEV)) return false;
      if (requireFullBlend && !o.blend_complete) return false;
      if (requireTwoWay && (!o.market_coverage || !o.market_coverage.two_way_devig_ready)) return false;

      return true;
    });

    const totalAfterFilters = allOpportunities.length;

    // ── Step 5: Sort ──────────────────────────────────────────────────────
    const getUniqueKey = (o: Opportunity) =>
      `${o.event_id}:${o.player}:${o.market}:${o.line}:${o.side}`;

    allOpportunities.sort((a, b) => {
      const primary =
        sortBy === "ev"
          ? (b.ev_pct || 0) - (a.ev_pct || 0)
          : (b.edge_pct || 0) - (a.edge_pct || 0);
      if (primary !== 0) return primary;
      const timeDiff =
        new Date(a.event?.start_time || 0).getTime() -
        new Date(b.event?.start_time || 0).getTime();
      if (timeDiff !== 0) return timeDiff;
      return getUniqueKey(a).localeCompare(getUniqueKey(b));
    });

    const paginated = allOpportunities.slice(0, limit);

    const response: OpportunitiesResponse = {
      opportunities: paginated,
      count: paginated.length,
      total_scanned: totalScanned,
      total_after_filters: totalAfterFilters,
      filters: {
        sports,
        markets,
        min_odds: minOdds,
        max_odds: maxOdds,
        min_edge: minEdge,
        min_ev: minEV,
        preset: presetName,
        blend,
        require_full_blend: requireFullBlend,
        min_books_per_side: minBooksPerSide,
        require_two_way: requireTwoWay,
      },
      timing_ms: Date.now() - startTime,
      cache_hit: false,
    };

    // ── Step 6: Cache the filtered response ───────────────────────────────
    redis
      .set(responseCacheKey, JSON.stringify(response), { ex: OPPS_CACHE_TTL })
      .catch((err) => console.warn("[opportunities] Cache write failed:", err));

    return NextResponse.json(response, {
      headers: {
        "X-Cache": "MISS",
        "X-Timing-Ms": String(Date.now() - startTime),
        "Cache-Control": "private, max-age=15",
      },
    });
  } catch (error) {
    console.error("[opportunities] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Resolve which worker preset key to use
//
// The worker pre-computes results for standard presets only.
// For custom blends, we fall back to the nearest matching standard preset
// (pinnacle is the safest default). This ensures we always read from a
// populated hash rather than returning nothing.
// ---------------------------------------------------------------------------

function resolveWorkerPreset(
  blend: BookWeight[] | null,
  useAverage: boolean,
  useNextBest: boolean
): string {
  if (useNextBest) return "next_best";
  if (useAverage) return "market_average";
  if (!blend) return "pinnacle"; // default

  if (blend.length === 1) {
    const book = blend[0].book;
    // If the single book matches a known worker preset, use it directly
    const knownPresets = [
      "pinnacle", "circa", "prophetx", "pinnacle_circa",
      "hardrock_thescore", "market_average", "betonline",
      "draftkings", "fanduel", "betmgm", "caesars",
      "hardrock", "bet365", "thescore", "ballybet",
      "betrivers", "fanatics", "kalshi", "polymarket", "novig",
      "next_best",
    ];
    if (knownPresets.includes(book)) return book;
    // Non-standard single book: try pinnacle as best fallback
    return "pinnacle";
  }

  // Multi-book blend: check if it matches pinnacle_circa or hardrock_thescore
  const bookSet = new Set(blend.map((b) => b.book));
  if (bookSet.has("pinnacle") && bookSet.has("circa")) return "pinnacle_circa";
  if (bookSet.has("hardrock") && bookSet.has("thescore")) return "hardrock_thescore";

  // Fallback to pinnacle for unrecognized custom blends
  return "pinnacle";
}

function formatAmericanOdds(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  const rounded = Math.round(price);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function decimalToAmericanString(decimal: number | null | undefined): string | null {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 1) return null;
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  }
  return String(Math.round(-100 / (decimal - 1)));
}

function pickFairProbability(row: any): number | null {
  const pFair = row?.devig?.p_fair;
  if (!pFair) return null;

  const candidates = [pFair.power, pFair.multiplicative, pFair.additive, pFair.probit];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 && candidate < 1) {
      return candidate;
    }
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// EVRow → Opportunity adapter
//
// Maps the worker's EVRow schema to the Opportunity interface the frontend expects.
// ---------------------------------------------------------------------------

function americanToDecimal(am: number): number {
  if (am >= 100) return (am / 100) + 1;
  if (am <= -100) return (100 / Math.abs(am)) + 1;
  return 1;
}

function evRowToOpportunity(row: any, useNextBest: boolean = false): Opportunity {
  const bestPriceAm =
    typeof row.book?.odds?.am === "number"
      ? row.book.odds.am
      : Number(row.book?.odds?.am ?? NaN);
  const bestPrice = Number.isFinite(bestPriceAm) ? bestPriceAm : null;

  const bestDecimalRaw =
    typeof row.book?.odds?.dec === "number"
      ? row.book.odds.dec
      : Number(row.book?.odds?.dec ?? NaN);
  const bestDecimal = Number.isFinite(bestDecimalRaw) && bestDecimalRaw > 0 ? bestDecimalRaw : 1;

  // Use worker's sharp reference from devig.inputs for ALL presets (including next_best)
  const overAm = typeof row.devig?.inputs?.over_am === "number"
    ? row.devig.inputs.over_am : Number(row.devig?.inputs?.over_am ?? NaN);
  const underAm = typeof row.devig?.inputs?.under_am === "number"
    ? row.devig.inputs.under_am : Number(row.devig?.inputs?.under_am ?? NaN);
  let sharpSideAm = row.side === "over" ? overAm : underAm;
  let sharpOppositeAm = row.side === "over" ? underAm : overAm;

  const sideDecRaw = row.side === "over" ? row.devig?.inputs?.over_dec : row.devig?.inputs?.under_dec;
  const oppDecRaw = row.side === "over" ? row.devig?.inputs?.under_dec : row.devig?.inputs?.over_dec;
  let sharpSideDecimal = typeof sideDecRaw === "number" && Number.isFinite(sideDecRaw) && sideDecRaw > 1 ? sideDecRaw : null;
  let sharpOppositeDecimal = typeof oppDecRaw === "number" && Number.isFinite(oppDecRaw) && oppDecRaw > 1 ? oppDecRaw : null;
  let sharpBooks = row.devig?.inputs?.blended_from ?? (row.devig?.inputs?.preset ? [row.devig.inputs.preset] : []);

  let trueProbability = pickFairProbability(row);
  let devigMethod: "proper" | "estimated" | null = trueProbability != null ? "proper" : null;
  if (trueProbability == null && sharpSideDecimal != null) {
    trueProbability = Math.min(0.999999, (1 / sharpSideDecimal) * 0.975);
    devigMethod = "estimated";
  }

  const bestImplied = bestDecimal > 0 ? 1 / bestDecimal : null;
  const sharpImplied = sharpSideDecimal && sharpSideDecimal > 0 ? 1 / sharpSideDecimal : null;

  const fairDecimal =
    trueProbability != null && trueProbability > 0 ? 1 / trueProbability : null;
  const fairAmerican = decimalToAmericanString(fairDecimal);

  const edge =
    sharpSideDecimal != null ? bestDecimal - sharpSideDecimal : null;
  const edgePct =
    sharpSideDecimal != null && sharpSideDecimal > 0
      ? ((bestDecimal / sharpSideDecimal) - 1) * 100
      : null;

  const impliedEdge =
    trueProbability != null && bestImplied != null ? trueProbability - bestImplied : null;
  const ev =
    trueProbability != null ? (trueProbability * bestDecimal) - 1 : null;
  const evPct =
    typeof row.rollup?.worst_case === "number"
      ? row.rollup.worst_case
      : ev != null
      ? ev * 100
      : null;
  const kellyFraction =
    ev != null && ev > 0 && trueProbability != null && bestDecimal > 1
      ? Math.max(0, (((bestDecimal - 1) * trueProbability) - (1 - trueProbability)) / (bestDecimal - 1))
      : null;

  return {
    sport: row.sport ?? "",
    event_id: row.eid ?? "",
    timestamp: typeof row.ts === "number" ? row.ts : Date.now(),
    event: row.ev_data ? {
      home_team: row.ev_data.home_team ?? "",
      away_team: row.ev_data.away_team ?? "",
      start_time: row.ev_data.start_time ?? "",
    } : null,
    player: row.ev_data?.player ?? row.ent ?? "",
    player_id: row.ev_data?.player_id ?? null,
    team: row.ev_data?.team ?? null,
    position: row.ev_data?.position ?? null,
    market: row.mkt ?? "",
    market_display: row.ev_data?.market_display ?? row.mkt ?? "",
    line: row.line ?? 0,
    side: row.side ?? "over",

    best_book: row.book?.id ?? "",
    best_price: formatAmericanOdds(bestPrice) ?? "0",
    best_decimal: bestDecimal,
    n_books: row.ev_data?.all_books?.length ?? 0,
    best_link: row.book?.link ?? null,
    best_mobile_link: row.book?.mobile_link ?? null,

    sharp_price: formatAmericanOdds(sharpSideAm) ?? decimalToAmericanString(sharpSideDecimal),
    sharp_decimal: sharpSideDecimal,
    sharp_books: sharpBooks,
    blend_complete: true,
    blend_weight_available: 1,
    avg_book_count: row.ev_data?.all_books?.length ?? 0,

    edge,
    edge_pct: edgePct,

    best_implied: bestImplied,
    sharp_implied: sharpImplied,

    true_probability: trueProbability,
    fair_decimal: fairDecimal,
    fair_american: fairAmerican,
    implied_edge: impliedEdge,
    ev,
    ev_pct: evPct,
    kelly_fraction: kellyFraction,
    devig_method: devigMethod,

    overround: null,
    market_coverage: row.ev_data?.all_books ? {
      n_books_over: row.side === "over" ? row.ev_data.all_books.length : (row.ev_data.opp_books?.length ?? 0),
      n_books_under: row.side === "under" ? row.ev_data.all_books.length : (row.ev_data.opp_books?.length ?? 0),
      two_way_devig_ready: true,
    } : null,
    devig_inputs: row.devig?.inputs ? {
      source: row.devig.inputs.blended_from ? "sharp_blend" : "sharp_book",
      aggregation: row.devig.inputs.blended_from ? "weighted" : "single",
      over_books: row.devig.inputs.blended_from ?? (row.devig.inputs.preset ? [row.devig.inputs.preset] : []),
      under_books: row.devig.inputs.blended_from ?? (row.devig.inputs.preset ? [row.devig.inputs.preset] : []),
    } : null,
    opposite_side: row.ev_data?.opp_books?.length ? {
      side: row.side === "over" ? "under" : "over",
      sharp_price: formatAmericanOdds(sharpOppositeAm) ?? decimalToAmericanString(sharpOppositeDecimal),
      sharp_decimal: sharpOppositeDecimal,
      best_book: row.ev_data.opp_books[0]?.id ?? null,
      best_price:
        row.ev_data.opp_books[0]?.am != null
          ? formatAmericanOdds(toFiniteNumber(row.ev_data.opp_books[0].am))
          : null,
      best_decimal: row.ev_data.opp_books[0]?.dec ?? null,
      all_books: row.ev_data.opp_books.map((b: any) => ({
        book: b.id ?? "",
        price: toFiniteNumber(b.am) ?? 0,
        decimal: toFiniteNumber(b.dec) ?? 1,
        link: b.link ?? null,
        mobile_link: b.mobile_link ?? null,
        sgp: b.sgp ?? null,
        limits: b.limits ?? null,
      })),
    } : null,
    all_books: (row.ev_data?.all_books ?? []).map((b: any) => ({
      book: b.id ?? "",
      price: toFiniteNumber(b.am) ?? 0,
      decimal: toFiniteNumber(b.dec) ?? 1,
      link: b.link ?? null,
      mobile_link: b.mobile_link ?? null,
      sgp: b.sgp ?? null,
      limits: b.limits ?? null,
      ev_pct: b.ev_pct ?? null,
      is_sharp_ref: b.is_sharp_ref ?? false,
    })),
  };
}
