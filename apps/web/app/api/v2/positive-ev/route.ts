/**
 * GET /api/v2/positive-ev — Refactored (thin cache-reader)
 *
 * WHAT CHANGED vs original positive-ev-route.ts (1630 lines):
 * ─────────────────────────────────────────────────────────────
 * Before: On every cache miss the route fetched raw odds from Redis
 *         (50–250+ HTTPS round-trips), ran devig + EV calculations
 *         in-process, and wrote the result back — easily 5–25 s,
 *         frequently causing 504s.
 *
 * After:  A background worker (ev-worker.ts on the VPS) pre-computes
 *         all EV rows and writes them to:
 *           ev:{sport}:rows:{preset}   — HASH of seid → EVRow JSON
 *           ev:response:{hash}         — full cached API responses
 *
 *         This route reads per-sport HASHes via HGETALL (1 call per sport).
 *         ZSET-based lookups removed due to race condition with parallel writes.
 *         On a cache hit it's still just 1 Redis call.
 *
 * Custom sharp presets (preset=custom + customSharpBooks param) still
 * require Elite plan gating; for those, the worker cannot pre-compute
 * so we return a 503 with a retry hint instead of attempting on-demand
 * computation (which would time out).
 *
 * Response schema (PositiveEVResponse) is IDENTICAL to the original so
 * the frontend requires no changes.
 */

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getUserPlan } from "@/lib/plans-server";
import { hasEliteAccess } from "@/lib/plans";
import type {
  SharpPreset,
  DevigMethod,
  PositiveEVOpportunity,
  PositiveEVResponse,
  EVMode,
  CustomSharpConfig,
  EVCalculation,
} from "@/lib/ev";
import {
  SHARP_BOOKS,
  DEFAULT_DEVIG_METHODS,
  EV_THRESHOLDS,
} from "@/lib/ev/constants";
import {
  americanToDecimal,
  americanToImpliedProb,
  impliedProbToAmerican,
  devigMultiple,
  calculateEV,
} from "@/lib/ev/devig";
import { redis, parseRedisValue, hashCacheKey, hgetallSafe } from "@/lib/shared-redis-client";

// Worker EVRow shape — differs from @/lib/ev-schema EVRow.
// We use `any` for the raw Redis data and map it in evRowToOpportunity.
type WorkerEVRow = any;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESPONSE_CACHE_PREFIX = "ev:response:";
const RESPONSE_CACHE_TTL = 45; // seconds — increased from 15 to reduce miss storms

const VALID_SPORTS = new Set([
  "nba", "nfl", "nhl", "ncaab", "ncaaf", "mlb", "ncaabaseball",
  "wnba", "soccer_epl", "soccer_laliga", "soccer_mls", "soccer_ucl",
  "soccer_uel", "tennis_atp", "tennis_challenger", "tennis_itf_men",
  "tennis_itf_women", "tennis_utr_men", "tennis_utr_women", "tennis_wta", "ufc",
]);

// ---------------------------------------------------------------------------
// Cache key builder — must be stable across requests with same params
// ---------------------------------------------------------------------------

function buildResponseCacheKey(params: URLSearchParams): string {
  const sports = (params.get("sports") || "nba")
    .toLowerCase()
    .split(",")
    .filter(Boolean)
    .sort()
    .join(",");
  const preset = params.get("sharpPreset") || "pinnacle";
  const mode = params.get("mode") || "pregame";
  const minEV = params.get("minEV") || "0";
  const maxEV = params.get("maxEV") || String(EV_THRESHOLDS.maximum);
  const markets = (params.get("markets") || "").toLowerCase().split(",").filter(Boolean).sort().join(",");
  const books = (params.get("books") || "").toLowerCase().split(",").filter(Boolean).sort().join(",");
  const limit = params.get("limit") || "100";
  const minBooksPerSide = params.get("minBooksPerSide") || "2";

  const raw = `${sports}|${preset}|${mode}|${minEV}|${maxEV}|${markets}|${books}|${limit}|${minBooksPerSide}`;
  return hashCacheKey(raw);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const params = new URL(req.url).searchParams;

  try {
    // ── Parse parameters ────────────────────────────────────────────────────
    const modeParam = params.get("mode")?.toLowerCase();
    const mode: EVMode =
      modeParam === "live" ? "live" : modeParam === "all" ? "all" : "pregame";
    // "all" maps to "pregame" scope in the ZSET (worker writes pregame+live together
    // in the default pregame key; live is a separate key if the worker supports it)
    const scope = mode === "live" ? "live" : "pregame";

    const bypassCache = params.get("fresh") === "true";

    const sportsParam = (params.get("sports") || "nba")
      .toLowerCase()
      .split(",")
      .filter(Boolean);
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));
    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    const sharpPreset = (params.get("sharpPreset") || "pinnacle") as SharpPreset;
    const devigMethodsRaw = params.get("devigMethods")?.toLowerCase().split(",").filter(Boolean);
    const devigMethods: DevigMethod[] = devigMethodsRaw
      ? (devigMethodsRaw.filter((m) =>
          ["power", "multiplicative", "additive", "probit"].includes(m)
        ) as DevigMethod[])
      : DEFAULT_DEVIG_METHODS;

    const minEV = parseFloat(params.get("minEV") || "0");
    const maxEV = parseFloat(params.get("maxEV") || String(EV_THRESHOLDS.maximum));
    const booksFilter = params.get("books")?.toLowerCase().split(",").filter(Boolean) || null;
    const marketsFilter = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);
    const minBooksPerSide = parseInt(params.get("minBooksPerSide") || "2");

    // ── Custom sharp config — Elite plan gating ──────────────────────────────
    const customSharpBooksParam =
      params.get("customSharpBooks")?.toLowerCase().split(",").filter(Boolean) || null;
    let customSharpConfig: CustomSharpConfig | null = null;

    if (customSharpBooksParam && customSharpBooksParam.length > 0) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userPlan = await getUserPlan(user);
      if (!hasEliteAccess(userPlan)) {
        return NextResponse.json(
          { error: "Custom models require Elite plan", code: "elite_required" },
          { status: 403 }
        );
      }
      let weights: Record<string, number> | null = null;
      const customBookWeightsParam = params.get("customBookWeights");
      if (customBookWeightsParam) {
        try {
          weights = JSON.parse(customBookWeightsParam);
        } catch {
          console.warn("[positive-ev] Failed to parse customBookWeights");
        }
      }
      customSharpConfig = { books: customSharpBooksParam, weights };

      // Custom presets: on-demand re-devig using pre-computed row data.
      // We read the pinnacle preset (most complete) and re-calculate EV
      // using the custom sharp books from the all_books/opp_books arrays
      // already stored in each row. No raw odds fetching needed.
    }

    // Validate preset — worker pre-computes these standard presets
    const VALID_PRESETS = new Set([
      "pinnacle", "circa", "prophetx", "betonline",
      "pinnacle_circa", "hardrock_thescore", "market_average",
      "draftkings", "fanduel", "betmgm", "caesars",
      "hardrock", "bet365", "thescore", "ballybet",
      "betrivers", "fanatics", "kalshi", "polymarket",
      "novig", "next_best",
    ]);
    if (!VALID_PRESETS.has(sharpPreset)) {
      return NextResponse.json(
        { error: `Invalid sharpPreset: ${sharpPreset}` },
        { status: 400 }
      );
    }

    // ── Step 1: Check full response cache (1 Redis call, fastest path) ───────
    const cacheKeyHash = buildResponseCacheKey(params);
    const responseCacheKey = `${RESPONSE_CACHE_PREFIX}${cacheKeyHash}`;

    if (!bypassCache) {
      try {
        const cached = await redis.get<PositiveEVResponse>(responseCacheKey);
        if (cached) {
          const response = typeof cached === "string" ? JSON.parse(cached) : cached;
          return NextResponse.json(response, {
            headers: {
              "X-Cache": "HIT",
              "X-Timing-Ms": String(Date.now() - startTime),
              "Cache-Control": "private, max-age=15",
            },
          });
        }
      } catch (err) {
        console.warn("[positive-ev] Response cache read failed:", err);
        // Continue to MISS path — don't fail the request over a cache error
      }
    }

    // ── Step 2: Read from pre-computed per-sport hashes (HGETALL) ──────────
    // Worker writes:
    //   ev:{sport}:rows:{preset}       — HASH  (per-sport, per-preset)
    //
    // For standard presets: read directly from the preset's hash.
    // For custom presets: read from pinnacle hash and re-devig on the fly
    // using the custom sharp books from the all_books/opp_books arrays.

    const allRows: WorkerEVRow[] = [];
    let workerDataFound = false;

    // For custom presets, read pinnacle data as the base
    const readPreset = customSharpConfig ? "pinnacle" : sharpPreset;

    await Promise.all(
      sports.map(async (sport) => {
        const rowsKey = `ev:${sport}:rows:${readPreset}`;

        let allFields: Record<string, string> | null = null;
        try {
          allFields = await hgetallSafe(rowsKey);
        } catch (err) {
          console.warn(`[positive-ev] HGETALL failed for ${sport}:`, err);
          return;
        }

        if (!allFields || Object.keys(allFields).length === 0) return;
        workerDataFound = true;

        for (const [seid, rawValue] of Object.entries(allFields)) {
          const row = parseRedisValue<WorkerEVRow>(rawValue, `${rowsKey}:${seid}`);
          if (!row) continue;

          // For custom presets, re-devig using the custom sharp books
          let processedRow = row;
          if (customSharpConfig) {
            const redevigged = redevigWithCustomSharp(row, customSharpConfig, devigMethods);
            if (!redevigged) continue; // Skip if custom sharp books not found in this row
            processedRow = redevigged;
          }

          // Apply client-side filters on (possibly re-computed) data
          if (processedRow.rollup.worst_case < minEV) continue;
          if (processedRow.rollup.best_case > maxEV) continue;
          if (marketsFilter && !marketsFilter.includes(processedRow.mkt)) continue;
          if (booksFilter && processedRow.book?.id && !booksFilter.includes(normalizeBookIdForFrontend(processedRow.book.id))) continue;
          if (processedRow.ev_data?.all_books && minBooksPerSide > 1 && processedRow.ev_data.all_books.length < minBooksPerSide) continue;

          // Mode filter
          if (mode === "pregame" && processedRow.meta?.scope === "live") continue;
          if (mode === "live" && processedRow.meta?.scope !== "live") continue;

          allRows.push(processedRow);
        }
      })
    );

    // ── Step 3: Worker not populated yet → return 503 with retry hint ────────
    if (!workerDataFound && allRows.length === 0) {
      return NextResponse.json(
        {
          error: "data_not_ready",
          message:
            "The background worker has not yet populated EV data. " +
            "This typically resolves within 15 seconds of worker startup.",
          retry_ms: 5000,
        },
        {
          status: 503,
          headers: {
            "Retry-After": "5",
            "X-Timing-Ms": String(Date.now() - startTime),
          },
        }
      );
    }

    // ── Step 4: Sort and limit ─────────────────────────────────────────────
    allRows.sort((a, b) => (b.rollup?.worst_case ?? 0) - (a.rollup?.worst_case ?? 0));
    const limitedRows = allRows.slice(0, limit);

    // ── Step 5: Map EVRow → PositiveEVOpportunity (frontend schema) ─────────
    // The worker stores EVRow objects. We map them to PositiveEVOpportunity here
    // so the frontend schema stays identical to the old route.
    const opportunities: PositiveEVOpportunity[] = limitedRows.map((row) =>
      evRowToOpportunity(row, sharpPreset, devigMethods)
    );

    const response: PositiveEVResponse = {
      opportunities,
      meta: {
        totalFound: allRows.length,
        returned: opportunities.length,
        sharpPreset: customSharpConfig ? "custom" : sharpPreset,
        customSharpConfig: customSharpConfig ?? undefined,
        devigMethods,
        minEV,
        minBooksPerSide,
        mode,
        timestamp: new Date().toISOString(),
      },
    };

    // ── Step 6: Cache the assembled response for future requests ─────────────
    // Fire-and-forget to keep p99 latency low
    redis
      .set(responseCacheKey, JSON.stringify(response), { ex: RESPONSE_CACHE_TTL })
      .catch((err) => console.warn("[positive-ev] Cache write failed:", err));

    return NextResponse.json(response, {
      headers: {
        "X-Cache": "MISS",
        "X-Timing-Ms": String(Date.now() - startTime),
        "Cache-Control": "private, max-age=15",
      },
    });
  } catch (error) {
    console.error("[positive-ev] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// EVRow → PositiveEVOpportunity adapter
//
// The background worker stores a compact EVRow in Redis. This function
// expands it into the full PositiveEVOpportunity shape that the frontend
// expects — keeping all field names identical to the original route.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Normalize book ID to match SPORTSBOOKS_META keys in the frontend.
// Must mirror normalizeSportsbookId() from lib/data/sportsbooks.ts.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Build a full EVCalculation object from a fair probability + book odds.
// The frontend reads .fairProb, .evPercent, .edge, .bookProb, .bookDecimal
// from each method entry — returning just a number would break the UI.
// ---------------------------------------------------------------------------
function buildEVCalculation(
  method: DevigMethod,
  fairProb: number | null | undefined,
  evPercent: number | null | undefined,
  bookAmerican: number,
  bookDecimal: number
): EVCalculation | undefined {
  if (fairProb == null || evPercent == null) return undefined;

  const bookProb = americanToImpliedProb(bookAmerican);
  const edge = fairProb - bookProb;
  // EV as decimal (evPercent is already %, convert to fraction)
  const ev = evPercent / 100;
  // Kelly fraction: edge / (decimal - 1), clamped >= 0
  const kellyFraction = bookDecimal > 1 ? Math.max(0, edge / (bookDecimal - 1)) : 0;

  return {
    method,
    fairProb,
    bookProb,
    bookDecimal,
    ev,
    evPercent,
    edge,
    kellyFraction,
  };
}

function evRowToOpportunity(
  row: WorkerEVRow,
  sharpPreset: SharpPreset,
  devigMethods: DevigMethod[]
): PositiveEVOpportunity {
  const evBest = row.rollup.best_case;
  const evWorst = row.rollup.worst_case;

  // Normalize the best-book ID so frontend can look up the logo
  const bestBookId = normalizeBookIdForFrontend(row.book?.id ?? "");
  const bookAm = row.book?.odds?.am ?? 0;
  const bookDec = row.book?.odds?.dec ?? 1;

  // Fair probabilities stored by the worker (already for THIS side)
  const fairProbPow = row.devig?.p_fair?.power ?? null;
  const fairProbMult = row.devig?.p_fair?.multiplicative ?? null;
  const fairProbAdd = row.devig?.p_fair?.additive ?? null;

  // Build full EVCalculation objects (what the frontend expects)
  const evCalcPower = buildEVCalculation("power", fairProbPow, row.ev?.pow, bookAm, bookDec);
  const evCalcMult = buildEVCalculation("multiplicative", fairProbMult, row.ev?.mult, bookAm, bookDec);
  const evCalcAdd = buildEVCalculation("additive", fairProbAdd, row.ev?.add, bookAm, bookDec);

  // Kelly worst = smallest kelly across methods
  const kellyValues = [evCalcPower?.kellyFraction, evCalcMult?.kellyFraction, evCalcAdd?.kellyFraction]
    .filter((k): k is number => k != null);
  const kellyWorst = kellyValues.length > 0 ? Math.min(...kellyValues) : undefined;

  return {
    id: row.seid,
    sport: row.sport,
    eventId: row.eid,
    market: row.mkt,
    marketDisplay: row.ev_data?.market_display ?? row.mkt,

    homeTeam: row.ev_data?.home_team,
    awayTeam: row.ev_data?.away_team,
    startTime: row.ev_data?.start_time,
    gameDate: row.ev_data?.start_time,

    playerId: row.ev_data?.player_id ?? undefined,
    playerName: row.ev_data?.player ?? row.ent,
    playerTeam: row.ev_data?.team ?? undefined,
    playerPosition: row.ev_data?.position ?? undefined,

    line: row.line,
    side: row.side as "over" | "under" | "yes" | "no",

    sharpPreset,
    sharpReference: {
      preset: row.devig?.inputs?.preset ?? sharpPreset,
      overOdds: row.devig?.inputs?.over_am ?? 0,
      underOdds: row.devig?.inputs?.under_am ?? 0,
      overDecimal: row.devig?.inputs?.over_dec ?? 1,
      underDecimal: row.devig?.inputs?.under_dec ?? 1,
      source: row.devig?.inputs?.blended_from?.join(",") ?? String(row.devig?.inputs?.preset ?? sharpPreset),
    },

    devigResults: {
      power: fairProbPow != null ? {
        method: "power" as DevigMethod,
        fairProbOver: row.side === "over" || row.side === "yes" ? fairProbPow : (1 - fairProbPow),
        fairProbUnder: row.side === "over" || row.side === "yes" ? (1 - fairProbPow) : fairProbPow,
        margin: 0,
        success: true,
      } : undefined,
      multiplicative: fairProbMult != null ? {
        method: "multiplicative" as DevigMethod,
        fairProbOver: row.side === "over" || row.side === "yes" ? fairProbMult : (1 - fairProbMult),
        fairProbUnder: row.side === "over" || row.side === "yes" ? (1 - fairProbMult) : fairProbMult,
        margin: 0,
        success: true,
      } : undefined,
    },

    book: {
      bookId: bestBookId,
      bookName: bestBookId,
      price: bookAm,
      priceDecimal: bookDec,
      link: row.book?.link ?? null,
      mobileLink: row.book?.mobile_link ?? null,
      sgp: row.book?.sgp ?? null,
      limits: row.book?.limits ?? null,
      evPercent: evWorst,
      isSharpRef: false,
    },

    evCalculations: {
      power: evCalcPower,
      multiplicative: evCalcMult,
      additive: evCalcAdd,
      probit: undefined,
      evWorst,
      evBest,
      evDisplay: evWorst,
      kellyWorst,
    },

    allBooks: (row.ev_data?.all_books ?? []).map((b: any) => ({
      bookId: normalizeBookIdForFrontend(b.id ?? ""),
      bookName: normalizeBookIdForFrontend(b.id ?? ""),
      price: b.am,
      priceDecimal: b.dec,
      link: b.link ?? null,
      mobileLink: null,
      sgp: null,
      limits: b.limits ?? null,
      evPercent: b.ev_pct ?? undefined,
      isSharpRef: b.is_sharp_ref ?? false,
    })),

    oppositeBooks: (row.ev_data?.opp_books ?? []).map((b: any) => ({
      bookId: normalizeBookIdForFrontend(b.id ?? ""),
      bookName: normalizeBookIdForFrontend(b.id ?? ""),
      price: b.am,
      priceDecimal: b.dec,
      link: null,
      mobileLink: null,
      sgp: null,
      limits: b.limits ?? null,
    })),

    createdAt: row.meta?.last_computed
      ? new Date(row.meta.last_computed).toISOString()
      : new Date().toISOString(),
    updatedAt: row.meta?.last_computed
      ? new Date(row.meta.last_computed).toISOString()
      : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// On-demand re-devig for custom sharp presets
//
// Uses the all_books + opp_books arrays already stored in each pre-computed
// EVRow to find the custom sharp book's odds, then re-runs devig + EV math.
// This avoids fetching raw odds from Redis (the old 5–25s path) and instead
// does pure CPU math (~0.1ms per row).
// ---------------------------------------------------------------------------

function redevigWithCustomSharp(
  row: WorkerEVRow,
  config: CustomSharpConfig,
  devigMethods: DevigMethod[]
): WorkerEVRow | null {
  const side = row.side as "over" | "under";
  const oppSide = side === "over" ? "under" : "over";

  // Find the custom sharp book's odds on both sides
  // all_books has this side's books, opp_books has the opposite side
  const allBooks: Array<{ id: string; am: number; dec: number; ev_pct?: number; is_sharp_ref?: boolean; link?: string | null; limits?: { max: number } | null }> = row.ev_data?.all_books ?? [];
  const oppBooks: Array<{ id: string; am: number; dec: number }> = row.ev_data?.opp_books ?? [];

  // Build sharp odds from custom books (weighted blend if multiple)
  const customBooksSet = new Set(config.books.map((b: string) => b.toLowerCase()));

  // Find over/under odds from the custom sharp book(s)
  // "this side" books are in allBooks, "opposite side" books are in oppBooks
  const thisSideSharpEntries = allBooks.filter(b => customBooksSet.has((b.id || "").toLowerCase()));
  const oppSideSharpEntries = oppBooks.filter(b => customBooksSet.has((b.id || "").toLowerCase()));

  // Need at least one sharp book on each side to devig
  if (thisSideSharpEntries.length === 0 || oppSideSharpEntries.length === 0) return null;

  // Build blended sharp odds
  let sharpOverAm: number;
  let sharpUnderAm: number;

  if (thisSideSharpEntries.length === 1 && oppSideSharpEntries.length === 1) {
    // Single book — use directly
    if (side === "over") {
      sharpOverAm = thisSideSharpEntries[0].am;
      sharpUnderAm = oppSideSharpEntries[0].am;
    } else {
      sharpOverAm = oppSideSharpEntries[0].am;
      sharpUnderAm = thisSideSharpEntries[0].am;
    }
  } else {
    // Multiple books — weighted average via implied probability
    const blendSide = (entries: typeof thisSideSharpEntries) => {
      let totalWeight = 0;
      let blendedProb = 0;
      for (const entry of entries) {
        const w = config.weights?.[entry.id.toLowerCase()] ?? (1 / entries.length);
        const prob = americanToImpliedProb(entry.am);
        blendedProb += prob * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? impliedProbToAmerican(blendedProb / totalWeight) : 0;
    };

    if (side === "over") {
      sharpOverAm = blendSide(thisSideSharpEntries);
      sharpUnderAm = blendSide(oppSideSharpEntries);
    } else {
      sharpOverAm = blendSide(oppSideSharpEntries);
      sharpUnderAm = blendSide(thisSideSharpEntries);
    }
  }

  if (sharpOverAm === 0 || sharpUnderAm === 0) return null;

  // Run devig with custom sharp odds
  const devigResults = devigMultiple(sharpOverAm, sharpUnderAm, devigMethods);

  // Get fair probability for this side
  const fairProbPower = side === "over"
    ? devigResults.power?.fairProbOver
    : devigResults.power?.fairProbUnder;
  const fairProbMult = side === "over"
    ? devigResults.multiplicative?.fairProbOver
    : devigResults.multiplicative?.fairProbUnder;

  // Find best non-sharp book on this side
  const bettableBooks = allBooks
    .filter(b => !customBooksSet.has((b.id || "").toLowerCase()))
    .filter(b => b.am && b.dec);

  if (bettableBooks.length === 0) return null;

  // Calculate EV for each bettable book, pick the best
  let bestBook = bettableBooks[0];
  let bestEvWorst = -Infinity;
  let bestEvBest = -Infinity;
  let bestEvPow: number | undefined;
  let bestEvMult: number | undefined;

  for (const book of bettableBooks) {
    const evPow = fairProbPower != null ? calculateEV(fairProbPower, book.am) * 100 : undefined;
    const evMult = fairProbMult != null ? calculateEV(fairProbMult, book.am) * 100 : undefined;

    const evVals = [evPow, evMult].filter((v): v is number => v != null);
    if (evVals.length === 0) continue;

    const worst = Math.min(...evVals);
    if (worst > bestEvWorst) {
      bestEvWorst = worst;
      bestEvBest = Math.max(...evVals);
      bestEvPow = evPow;
      bestEvMult = evMult;
      bestBook = book;
    }
  }

  if (bestEvWorst <= 0) return null; // No +EV with custom sharp
  if (bestEvWorst > 25) return null; // Data error filter

  // Build a modified row with re-computed EV values
  return {
    ...row,
    seid: `${row.seid.replace(/:pinnacle$/, `:custom`)}`,
    book: {
      id: bestBook.id,
      odds: { am: bestBook.am, dec: bestBook.dec, ts: row.book?.odds?.ts },
      link: bestBook.link ?? null,
      mobile_link: null,
      sgp: null,
      limits: bestBook.limits ?? null,
    },
    devig: {
      inputs: {
        preset: "custom",
        over_am: sharpOverAm,
        over_dec: americanToDecimal(sharpOverAm),
        under_am: sharpUnderAm,
        under_dec: americanToDecimal(sharpUnderAm),
        blended_from: config.books,
      },
      params: { methods: devigMethods },
      p_fair: {
        power: fairProbPower ?? null,
        multiplicative: fairProbMult ?? null,
        additive: null,
        probit: null,
      },
    },
    ev: {
      pow: bestEvPow ?? null,
      mult: bestEvMult ?? null,
      add: null,
    },
    rollup: {
      best_case: bestEvBest,
      worst_case: bestEvWorst,
      best_method: bestEvPow != null && bestEvPow >= (bestEvMult ?? -Infinity) ? "power" : "multiplicative",
    },
  };
}