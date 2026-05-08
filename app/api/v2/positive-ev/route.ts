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

export const runtime = "nodejs";
export const preferredRegion = "iad1";
export const maxDuration = 60;

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
import { redis, parseRedisValue, hashCacheKey, hgetallSafe, setSafe } from "@/lib/shared-redis-client";

// Worker EVRow shape — differs from @/lib/ev-schema EVRow.
// We use `any` for the raw Redis data and map it in evRowToOpportunity.
type WorkerEVRow = any;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESPONSE_CACHE_PREFIX = "ev:response:";
const RESPONSE_CACHE_VERSION = "v2";
const RESPONSE_CACHE_TTL = 45; // seconds — increased from 15 to reduce miss storms
const SPORT_FETCH_CONCURRENCY = 4;
const MAX_RESPONSE_LIMIT = 2000;
const EV_MAX_CACHE_BYTES = 750_000;
const REFERENCE_PRESET_SUGGESTIONS: SharpPreset[] = ["draftkings", "market_average"];

// Books that may be absent from the worker's pre-computed all_books snapshots for standard
// presets (e.g. prediction markets, offshore books). Probed via live Redis for custom models.
const LIVE_ODDS_SUPPLEMENTAL_BOOKS = [
  "kalshi", "polymarket", "novig",
  "prophetx", "betonline", "superbook",
  "pointsbet", "espnbet", "wynnbet", "unibet",
  "betparx", "betfred", "tipico", "fliff",
] as const;

type LiveOddsCache = Map<string, Record<string, any>>;

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
  const marketType = params.get("marketType") || "all";
  const minEV = params.get("minEV") || "0";
  const maxEV = params.get("maxEV") || String(EV_THRESHOLDS.maximum);
  const minOdds = params.get("minOdds") || "";
  const maxOdds = params.get("maxOdds") || "";
  const devigMethods = (params.get("devigMethods") || "")
    .toLowerCase()
    .split(",")
    .filter(Boolean)
    .sort()
    .join(",");
  const markets = (params.get("markets") || "").toLowerCase().split(",").filter(Boolean).sort().join(",");
  const books = (params.get("books") || "").toLowerCase().split(",").filter(Boolean).sort().join(",");
  const customSharpBooks = (params.get("customSharpBooks") || "")
    .toLowerCase()
    .split(",")
    .filter(Boolean)
    .map((book) => canonicalizeCustomBookId(book))
    .sort()
    .join(",");
  const limit = params.get("limit") || "100";
  const minBooksPerSide = params.get("minBooksPerSide") || "2";
  let customBookWeights = "";
  const customBookWeightsRaw = params.get("customBookWeights");
  if (customBookWeightsRaw) {
    try {
      const parsed = JSON.parse(customBookWeightsRaw) as Record<string, number>;
      customBookWeights = Object.entries(parsed)
        .map(([book, weight]) => [canonicalizeCustomBookId(String(book)), Number(weight)] as const)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([book, weight]) => `${book}:${weight}`)
        .join(",");
    } catch {
      customBookWeights = customBookWeightsRaw;
    }
  }

  const raw = `${RESPONSE_CACHE_VERSION}|${sports}|${preset}|${mode}|${marketType}|${minEV}|${maxEV}|${minOdds}|${maxOdds}|${devigMethods}|${markets}|${books}|${customSharpBooks}|${customBookWeights}|${limit}|${minBooksPerSide}`;
  return hashCacheKey(raw);
}

function inferRowMarketType(row: WorkerEVRow): "player" | "game" {
  const market = String(row?.mkt || "").toLowerCase();
  const playerId = row?.ev_data?.player_id;
  const playerPosition = row?.ev_data?.position;
  const playerName = String(row?.ev_data?.player || "").trim().toLowerCase();

  if (playerId || playerPosition) return "player";
  if (
    market.startsWith("player_") ||
    market.startsWith("pitcher_") ||
    market.startsWith("batter_") ||
    market.startsWith("goalie_") ||
    market.startsWith("skater_")
  ) {
    return "player";
  }
  if (
    playerName &&
    ![
      "game",
      "game_total",
      "match_total",
      "fight_total",
      "team_total",
      "home_team_total",
      "away_team_total",
    ].includes(playerName)
  ) {
    return "player";
  }
  return "game";
}

function getRowEvForMethod(row: WorkerEVRow, method: DevigMethod): number | null {
  switch (method) {
    case "power":
      return typeof row?.ev?.pow === "number" ? row.ev.pow : null;
    case "multiplicative":
      return typeof row?.ev?.mult === "number" ? row.ev.mult : null;
    case "additive":
      return typeof row?.ev?.add === "number" ? row.ev.add : null;
    case "probit":
      return typeof row?.ev?.probit === "number" ? row.ev.probit : null;
    default:
      return null;
  }
}

function getSelectedRowEvRange(
  row: WorkerEVRow,
  devigMethods: DevigMethod[]
): { evWorst: number; evBest: number } | null {
  const values = devigMethods
    .map((method) => getRowEvForMethod(row, method))
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (values.length === 0) return null;

  return {
    evWorst: Math.min(...values),
    evBest: Math.max(...values),
  };
}

async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let index = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const currentIndex = index++;
        if (currentIndex >= items.length) return;
        await worker(items[currentIndex]);
      }
    })
  );
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
    const minOddsParam = params.get("minOdds");
    const maxOddsParam = params.get("maxOdds");
    const minOdds = minOddsParam != null ? parseInt(minOddsParam) : null;
    const maxOdds = maxOddsParam != null ? parseInt(maxOddsParam) : null;
    const booksFilter = params.get("books")?.toLowerCase().split(",").filter(Boolean) || null;
    const marketsFilter = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const requestedLimit = parseInt(params.get("limit") || "100");
    const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 100, MAX_RESPONSE_LIMIT));
    const minBooksPerSide = parseInt(params.get("minBooksPerSide") || "2");
    const marketTypeParam = params.get("marketType")?.toLowerCase();
    const marketType: "all" | "player" | "game" =
      marketTypeParam === "player" ? "player" : marketTypeParam === "game" ? "game" : "all";

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
          const parsed = JSON.parse(customBookWeightsParam) as Record<string, number>;
          weights = Object.fromEntries(
            Object.entries(parsed)
              .map(([book, weight]) => [canonicalizeCustomBookId(book), Number(weight)] as const)
              .filter(([, weight]) => Number.isFinite(weight) && weight > 0)
          );
        } catch {
          console.warn("[positive-ev] Failed to parse customBookWeights");
        }
      }
      customSharpConfig = {
        books: Array.from(new Set(customSharpBooksParam.map((book) => canonicalizeCustomBookId(book)))),
        weights,
      };

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
    let alternateReferenceDataFound = false;

    // For custom presets, try reading from a preset hash that matches one of the
    // custom sharp books (their hash will contain their own odds in all_books/opp_books).
    // Fall back to pinnacle if none of the custom books have a valid preset hash.
    let readPreset = sharpPreset;
    if (customSharpConfig) {
      const VALID_CUSTOM_PRESETS = new Set(VALID_PRESETS);
      const matchingPreset = customSharpConfig.books.find((b) => VALID_CUSTOM_PRESETS.has(b));
      readPreset = (matchingPreset ?? "pinnacle") as SharpPreset;
      console.log(`[positive-ev] Custom model: reading from '${readPreset}' preset (books: ${customSharpConfig.books.join(",")})`);
    }

    // For custom models: pre-fetch all HGETALL data and batch-fetch supplemental live odds
    // (Kalshi, Polymarket, etc.) that the worker's snapshot may not include.
    // Standard models skip this entirely — no extra Redis calls.
    const storedFieldsBySport = new Map<string, { key: string; fields: Record<string, string> }>();
    let liveOddsCache: LiveOddsCache | undefined;

    if (customSharpConfig) {
      const customBooksSet = new Set(customSharpConfig.books.map((b: string) => canonicalizeCustomBookId(b)));

      // Phase 1: collect HGETALL data for all sports (reused in main loop to avoid double-fetch)
      await forEachWithConcurrency(sports, SPORT_FETCH_CONCURRENCY, async (sport) => {
        const rowsKey = `ev:${sport}:rows:${readPreset}`;
        try {
          const fields = await hgetallSafe(rowsKey);
          if (fields && Object.keys(fields).length > 0) {
            storedFieldsBySport.set(sport, { key: rowsKey, fields });
          }
        } catch (err) {
          console.warn(`[positive-ev] HGETALL pre-fetch failed for ${sport}:`, err);
        }
      });

      // Phase 2: single batch mget for supplemental book odds across all event/market combos
      if (storedFieldsBySport.size > 0) {
        liveOddsCache = await fetchLiveOddsForCustomModel(storedFieldsBySport, customBooksSet).catch((err) => {
          console.warn("[positive-ev] fetchLiveOddsForCustomModel failed:", err);
          return new Map() as LiveOddsCache;
        });
      }
    }

    await forEachWithConcurrency(
      sports,
      SPORT_FETCH_CONCURRENCY,
      async (sport) => {
        const rowsKey = `ev:${sport}:rows:${readPreset}`;

        let allFields: Record<string, string> | null = null;
        if (storedFieldsBySport.has(sport)) {
          // Reuse data collected in the pre-fetch phase (custom model path — avoids double HGETALL)
          allFields = storedFieldsBySport.get(sport)!.fields;
        } else {
          try {
            allFields = await hgetallSafe(rowsKey);
          } catch (err) {
            console.warn(`[positive-ev] HGETALL failed for ${sport}:`, err);
            return;
          }
        }

        if (!allFields || Object.keys(allFields).length === 0) return;
        workerDataFound = true;

        for (const [seid, rawValue] of Object.entries(allFields)) {
          const row = parseRedisValue<WorkerEVRow>(rawValue, `${rowsKey}:${seid}`);
          if (!row) continue;

          // For custom presets, re-devig using the custom sharp books + supplemental live odds
          let processedRow = row;
          if (customSharpConfig) {
            const redevigged = redevigWithCustomSharp(row, customSharpConfig, devigMethods, liveOddsCache);
            if (!redevigged) continue; // Skip if custom sharp books not found in this row
            processedRow = redevigged;
          }
          // Debug: log first few HR rows that pass all filters
          if (processedRow.mkt === "player_home_runs" || processedRow.mkt === "batter_home_runs") {
            if (allRows.filter(r => r.mkt === "player_home_runs" || r.mkt === "batter_home_runs").length < 3) {
              console.log(`[positive-ev] HR row passed: ${processedRow.sel || processedRow.desc} ev_data_books=${processedRow.ev_data?.all_books?.length ?? 0} custom=${!!customSharpConfig}`);
            }
          }

          // Apply client-side filters using only the active devig methods.
          const selectedRange = getSelectedRowEvRange(processedRow, devigMethods);
          if (!selectedRange) continue;
          if (selectedRange.evWorst < minEV) continue;
          if (selectedRange.evBest > maxEV) continue;
          const bookAm = processedRow.book?.odds?.am;
          if (typeof bookAm !== "number" || !Number.isFinite(bookAm)) continue;
          if (minOdds != null && bookAm < minOdds) continue;
          if (maxOdds != null && bookAm > maxOdds) continue;
          if (marketsFilter && !marketsFilter.includes(processedRow.mkt)) continue;
          if (booksFilter && processedRow.book?.id && !booksFilter.includes(normalizeBookIdForFrontend(processedRow.book.id))) continue;
          if (processedRow.ev_data?.all_books && minBooksPerSide > 1) {
            const allBooks = processedRow.ev_data.all_books;
            let relevantCount: number;

            if (customSharpBooksParam && customSharpBooksParam.length > 0) {
              // Custom model: count how many of the selected sharp books have odds for this side
              const sharpSet = new Set(customSharpBooksParam.map((b: string) => canonicalizeCustomBookId(b)));
              relevantCount = allBooks.filter((b: any) => {
                const bookId = canonicalizeCustomBookId(normalizeBookIdForFrontend(b.id || b.book || ""));
                return sharpSet.has(bookId);
              }).length;
            } else if (booksFilter) {
              // Book filter active: count only selected bettable books
              relevantCount = allBooks.filter((b: any) => booksFilter.includes(normalizeBookIdForFrontend(b.id || b.book || ""))).length;
            } else {
              // No filter: count all books
              relevantCount = allBooks.length;
            }
            if (relevantCount < minBooksPerSide) continue;
          }
          if (marketType !== "all" && inferRowMarketType(processedRow) !== marketType) continue;

          // Mode filter
          if (mode === "pregame" && processedRow.meta?.scope === "live") continue;
          if (mode === "live" && processedRow.meta?.scope !== "live") continue;

          allRows.push(processedRow);
        }
      }
    );

    // Debug summary
    if (customSharpConfig) {
      const hrRows = allRows.filter(r => r.mkt === "player_home_runs" || r.mkt === "batter_home_runs");
      console.log(`[positive-ev] Custom model summary: total=${allRows.length} HR=${hrRows.length} books=${customSharpConfig.books.join(",")} sports=${sports.join(",")}`);
    }

    // ── Step 3: Worker not populated yet → return 503 with retry hint ────────
    if (!workerDataFound && allRows.length === 0) {
      // Check if the worker is alive globally — any sport/preset having data
      // means the worker is running but the requested sports simply have no EV rows.
      let workerAliveGlobally = false;
      const WORKER_PROBE_SPORTS = ["nba", "nhl", "ncaab", "nfl", "mlb"];
      for (const probeSport of WORKER_PROBE_SPORTS) {
        try {
          const count = await redis.hlen(`ev:${probeSport}:rows:pinnacle`);
          if (typeof count === "number" && count > 0) {
            workerAliveGlobally = true;
            break;
          }
        } catch (_) { /* ignore */ }
      }

      // Worker is running but requested sports have no data — return empty, not 503
      if (workerAliveGlobally) {
        return NextResponse.json({
          opportunities: [],
          meta: {
            totalFound: 0,
            returned: 0,
            sharpPreset: customSharpConfig ? "custom" : sharpPreset,
            devigMethods,
            minEV,
            minBooksPerSide,
            mode,
            timestamp: new Date().toISOString(),
            emptyReason: "no_data_for_sports",
          },
        });
      }

      if (!customSharpConfig) {
        for (const sport of sports) {
          for (const preset of REFERENCE_PRESET_SUGGESTIONS) {
            if (preset === sharpPreset) continue;
            try {
              const count = await redis.hlen(`ev:${sport}:rows:${preset}`);
              if (typeof count === "number" && count > 0) {
                alternateReferenceDataFound = true;
                break;
              }
            } catch (err) {
              console.warn(`[positive-ev] HLEN failed for ${sport}:${preset}`, err);
            }
          }
          if (alternateReferenceDataFound) break;
        }
      }

      if (alternateReferenceDataFound) {
        return NextResponse.json({
          opportunities: [],
          meta: {
            totalFound: 0,
            returned: 0,
            sharpPreset,
            devigMethods,
            minEV,
            minBooksPerSide,
            mode,
            timestamp: new Date().toISOString(),
            emptyReason: "no_reference_data",
            suggestedSharpPresets: REFERENCE_PRESET_SUGGESTIONS.filter((preset) => preset !== sharpPreset),
          },
        });
      }

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
    allRows.sort((a, b) => {
      const aRange = getSelectedRowEvRange(a, devigMethods);
      const bRange = getSelectedRowEvRange(b, devigMethods);
      return (bRange?.evWorst ?? 0) - (aRange?.evWorst ?? 0);
    });
    const limitedRows = allRows.slice(0, limit);

    // ── Step 5: Map EVRow → PositiveEVOpportunity (frontend schema) ─────────
    // The worker stores EVRow objects. We map them to PositiveEVOpportunity here
    // so the frontend schema stays identical to the old route.
    const effectiveSharpPreset = customSharpConfig ? "custom" : sharpPreset;
    const opportunities: PositiveEVOpportunity[] = limitedRows.map((row) =>
      evRowToOpportunity(row, effectiveSharpPreset, devigMethods)
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
    const responseJson = JSON.stringify(response);
    if (new TextEncoder().encode(responseJson).length <= EV_MAX_CACHE_BYTES) {
      setSafe(responseCacheKey, responseJson, { ex: RESPONSE_CACHE_TTL }).then((ok) => {
        if (!ok) console.warn("[positive-ev] Cache write failed");
      });
    }

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

function canonicalizeCustomBookId(id: string): string {
  const lower = id.toLowerCase().trim();
  const mappings: Record<string, string> = {
    hardrock: "hardrock",
    "hard-rock": "hardrock",
    hardrockbet: "hardrock",
    "hard-rock-bet": "hardrock",
    "hard-rock-indiana": "hardrockindiana",
    hardrockindiana: "hardrockindiana",
    thescore: "thescore",
    "the-score": "thescore",
    ballybet: "ballybet",
    "bally-bet": "ballybet",
    bally_bet: "ballybet",
    betrivers: "betrivers",
    "bet-rivers": "betrivers",
    bet_rivers: "betrivers",
    "betmgm-michigan": "betmgm",
    betmgm_michigan: "betmgm",
    "fanduel-yourway": "fanduelyourway",
    fanduel_yourway: "fanduelyourway",
  };
  return mappings[lower] ?? lower;
}

type CustomBookRow = {
  id: string;
  canonicalId: string;
  am: number;
  dec: number;
  odd_id?: string | null;
  ev_pct?: number;
  is_sharp_ref?: boolean;
  link?: string | null;
  mobile_link?: string | null;
  sgp?: string | null;
  limits?: { max: number } | null;
};

function normalizeCustomBookRows(rawBooks: unknown[]): CustomBookRow[] {
  const byCanonical = new Map<string, CustomBookRow>();

  for (const rawBook of rawBooks) {
    const book = rawBook as Record<string, unknown> | null;
    const rawId = typeof book?.id === "string" ? book.id : null;
    if (!rawId) continue;

    const am = typeof book?.am === "number" ? book.am : Number(book?.am);
    if (!Number.isFinite(am)) continue;

    const decRaw = typeof book?.dec === "number" ? book.dec : Number(book?.dec);
    const dec = Number.isFinite(decRaw) && decRaw > 1 ? decRaw : americanToDecimal(am);
    if (!Number.isFinite(dec) || dec <= 1) continue;

    const canonicalId = canonicalizeCustomBookId(rawId);
    const normalized: CustomBookRow = {
      id: rawId,
      canonicalId,
      am,
      dec,
      odd_id: typeof book?.odd_id === "string" ? book.odd_id : null,
      ev_pct: typeof book?.ev_pct === "number" ? book.ev_pct : undefined,
      is_sharp_ref: typeof book?.is_sharp_ref === "boolean" ? book.is_sharp_ref : undefined,
      link: typeof book?.link === "string" ? book.link : null,
      mobile_link: typeof book?.mobile_link === "string" ? book.mobile_link : null,
      sgp: typeof book?.sgp === "string" ? book.sgp : null,
      limits: (book?.limits as { max: number } | null | undefined) ?? null,
    };

    const existing = byCanonical.get(canonicalId);
    if (!existing || normalized.dec > existing.dec) {
      byCanonical.set(canonicalId, normalized);
    }
  }

  return Array.from(byCanonical.values());
}

function calculateEvPercentForBook(
  bookAmerican: number,
  fairProbabilities: Array<number | null | undefined>
): number | null {
  const evValues = fairProbabilities
    .map((fairProb) => (fairProb != null ? calculateEV(fairProb, bookAmerican) * 100 : null))
    .filter((value): value is number => value != null && Number.isFinite(value));

  return evValues.length > 0 ? Math.min(...evValues) : null;
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

function summarizeSelectedCalculations(
  calculations: Partial<Record<DevigMethod, EVCalculation | undefined>>,
  devigMethods: DevigMethod[]
): {
  evWorst: number;
  evBest: number;
  evDisplay: number;
  kellyWorst?: number;
} {
  const selected = devigMethods
    .map((method) => calculations[method])
    .filter((calculation): calculation is EVCalculation => calculation !== undefined);

  if (selected.length === 0) {
    return {
      evWorst: 0,
      evBest: 0,
      evDisplay: 0,
    };
  }

  const evValues = selected.map((calculation) => calculation.evPercent);
  const kellyValues = selected
    .map((calculation) => calculation.kellyFraction)
    .filter((kelly): kelly is number => kelly != null);

  return {
    evWorst: Math.min(...evValues),
    evBest: Math.max(...evValues),
    evDisplay: Math.min(...evValues),
    kellyWorst: kellyValues.length > 0 ? Math.min(...kellyValues) : undefined,
  };
}

function evRowToOpportunity(
  row: WorkerEVRow,
  sharpPreset: SharpPreset,
  devigMethods: DevigMethod[]
): PositiveEVOpportunity {
  // Normalize the best-book ID so frontend can look up the logo
  const bestBookId = normalizeBookIdForFrontend(row.book?.id ?? "");
  const bookAm = row.book?.odds?.am ?? 0;
  const bookDec = row.book?.odds?.dec ?? 1;

  // Fair probabilities stored by the worker (already for THIS side)
  const fairProbPow = row.devig?.p_fair?.power ?? null;
  const fairProbMult = row.devig?.p_fair?.multiplicative ?? null;
  const fairProbAdd = row.devig?.p_fair?.additive ?? null;
  const fairProbProbit = row.devig?.p_fair?.probit ?? null;

  // Build full EVCalculation objects (what the frontend expects)
  const evCalcPower = buildEVCalculation("power", fairProbPow, row.ev?.pow, bookAm, bookDec);
  const evCalcMult = buildEVCalculation("multiplicative", fairProbMult, row.ev?.mult, bookAm, bookDec);
  const evCalcAdd = buildEVCalculation("additive", fairProbAdd, row.ev?.add, bookAm, bookDec);
  const evCalcProbit = buildEVCalculation("probit", fairProbProbit, row.ev?.probit, bookAm, bookDec);
  const calculationsByMethod = {
    power: evCalcPower,
    multiplicative: evCalcMult,
    additive: evCalcAdd,
    probit: evCalcProbit,
  };
  const { evWorst, evBest, evDisplay, kellyWorst } = summarizeSelectedCalculations(
    calculationsByMethod,
    devigMethods
  );

  const buildBookEvPercent = (price: number, decimal: number): number => {
    const bookCalculations = summarizeSelectedCalculations(
      {
        power: buildEVCalculation(
          "power",
          fairProbPow,
          fairProbPow != null ? calculateEV(fairProbPow, price) * 100 : null,
          price,
          decimal
        ),
        multiplicative: buildEVCalculation(
          "multiplicative",
          fairProbMult,
          fairProbMult != null ? calculateEV(fairProbMult, price) * 100 : null,
          price,
          decimal
        ),
        additive: buildEVCalculation(
          "additive",
          fairProbAdd,
          fairProbAdd != null ? calculateEV(fairProbAdd, price) * 100 : null,
          price,
          decimal
        ),
        probit: buildEVCalculation(
          "probit",
          fairProbProbit,
          fairProbProbit != null ? calculateEV(fairProbProbit, price) * 100 : null,
          price,
          decimal
        ),
      },
      devigMethods
    );

    return bookCalculations.evWorst;
  };

  return {
    id: row.seid,
    sport: row.sport,
    eventId: row.eid,
    gameId: row.ev_data?.game_id ?? row.game_id ?? null,
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
      additive: fairProbAdd != null ? {
        method: "additive" as DevigMethod,
        fairProbOver: row.side === "over" || row.side === "yes" ? fairProbAdd : (1 - fairProbAdd),
        fairProbUnder: row.side === "over" || row.side === "yes" ? (1 - fairProbAdd) : fairProbAdd,
        margin: 0,
        success: true,
      } : undefined,
      probit: fairProbProbit != null ? {
        method: "probit" as DevigMethod,
        fairProbOver: row.side === "over" || row.side === "yes" ? fairProbProbit : (1 - fairProbProbit),
        fairProbUnder: row.side === "over" || row.side === "yes" ? (1 - fairProbProbit) : fairProbProbit,
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
      ...calculationsByMethod,
      evWorst,
      evBest,
      evDisplay,
      kellyWorst,
    },

    allBooks: (row.ev_data?.all_books ?? []).map((b: any) => ({
      bookId: normalizeBookIdForFrontend(b.id ?? ""),
      bookName: normalizeBookIdForFrontend(b.id ?? ""),
      price: b.am,
      priceDecimal: b.dec,
      link: b.link ?? null,
      mobileLink: b.mobile_link ?? null,
      sgp: b.sgp ?? null,
      limits: b.limits ?? null,
      oddId: typeof b.odd_id === "string" ? b.odd_id : undefined,
      evPercent: buildBookEvPercent(b.am, b.dec),
      isSharpRef: b.is_sharp_ref ?? false,
    })),

    oppositeBooks: (row.ev_data?.opp_books ?? []).map((b: any) => ({
      bookId: normalizeBookIdForFrontend(b.id ?? ""),
      bookName: normalizeBookIdForFrontend(b.id ?? ""),
      price: b.am,
      priceDecimal: b.dec,
      link: b.link ?? null,
      mobileLink: b.mobile_link ?? null,
      sgp: b.sgp ?? null,
      limits: b.limits ?? null,
      oddId: typeof b.odd_id === "string" ? b.odd_id : undefined,
      isSharpRef: b.is_sharp_ref ?? false,
    })),

    createdAt: row.meta?.last_computed
      ? new Date(row.meta.last_computed).toISOString()
      : new Date().toISOString(),
    updatedAt: row.meta?.last_computed
      ? new Date(row.meta.last_computed).toISOString()
      : new Date().toISOString(),
  };
}

// Match the same name normalization used when SSE odds keys are written
function normalizeEntityName(name: string): string {
  return name.toLowerCase().replace(/ /g, "_").replace(/\./g, "").replace(/'/g, "").replace(/-/g, "_");
}

// Batch-fetch live odds for LIVE_ODDS_SUPPLEMENTAL_BOOKS across all event/market combos
// found in the pre-fetched worker rows. Single mget per chunk — no per-row Redis calls.
async function fetchLiveOddsForCustomModel(
  allFieldsBySport: Map<string, { key: string; fields: Record<string, string> }>,
  customBooksSet: Set<string>
): Promise<LiveOddsCache> {
  const combos = new Set<string>();
  for (const [, { key, fields }] of allFieldsBySport) {
    for (const rawValue of Object.values(fields)) {
      const row = parseRedisValue<WorkerEVRow>(rawValue, key);
      if (row?.sport && row?.eid && row?.mkt) combos.add(`${row.sport}/${row.eid}/${row.mkt}`);
    }
  }
  if (combos.size === 0) return new Map();

  const redisKeys: string[] = [];
  const cacheKeys: string[] = [];
  for (const combo of combos) {
    const firstSlash = combo.indexOf("/");
    const secondSlash = combo.indexOf("/", firstSlash + 1);
    const sport = combo.slice(0, firstSlash);
    const eid = combo.slice(firstSlash + 1, secondSlash);
    const mkt = combo.slice(secondSlash + 1);
    for (const book of LIVE_ODDS_SUPPLEMENTAL_BOOKS) {
      if (customBooksSet.has(canonicalizeCustomBookId(book))) continue;
      redisKeys.push(`odds:${sport}:${eid}:${mkt}:${book}`);
      cacheKeys.push(`${combo}/${book}`);
    }
  }
  if (redisKeys.length === 0) return new Map();

  const CHUNK = 500;
  const cache: LiveOddsCache = new Map();
  for (let i = 0; i < redisKeys.length; i += CHUNK) {
    try {
      const chunkKeys = redisKeys.slice(i, i + CHUNK);
      const chunkCacheKeys = cacheKeys.slice(i, i + CHUNK);
      const vals = await redis.mget<(string | null)[]>(...chunkKeys);
      for (let j = 0; j < vals.length; j++) {
        const v = vals[j];
        if (!v) continue;
        const parsed = parseRedisValue<Record<string, any>>(v as string, chunkKeys[j]);
        if (parsed) cache.set(chunkCacheKeys[j], parsed);
      }
    } catch (err) {
      console.warn("[positive-ev] supplemental live odds mget failed:", err);
    }
  }
  console.log(`[positive-ev] custom model: ${combos.size} combos → ${cache.size} supplemental book entries`);
  return cache;
}

// ---------------------------------------------------------------------------
// On-demand re-devig for custom sharp presets
//
// Uses the all_books + opp_books arrays already stored in each pre-computed
// EVRow to find the custom sharp book's odds, then re-runs devig + EV math.
// Supplemented by liveOddsCache which adds books absent from the worker snapshot
// (e.g. Kalshi, Polymarket) so no +EV opportunity is silently dropped.
// ---------------------------------------------------------------------------

function redevigWithCustomSharp(
  row: WorkerEVRow,
  config: CustomSharpConfig,
  devigMethods: DevigMethod[],
  liveOddsCache?: LiveOddsCache
): WorkerEVRow | null {
  const side = row.side as "over" | "under";
  const rawAllBooks: Array<Record<string, unknown>> = row.ev_data?.all_books ?? [];
  const rawOppBooks: Array<Record<string, unknown>> = row.ev_data?.opp_books ?? [];
  const allBooks = normalizeCustomBookRows(row.ev_data?.all_books ?? []);
  const oppBooks = normalizeCustomBookRows(row.ev_data?.opp_books ?? []);

  // Build sharp odds from custom books (weighted blend if multiple)
  const customBooksSet = new Set(config.books.map((b: string) => canonicalizeCustomBookId(b)));

  // Find over/under odds from the custom sharp book(s)
  // "this side" books are in allBooks, "opposite side" books are in oppBooks
  const thisSideSharpEntries = allBooks.filter((b) => customBooksSet.has(b.canonicalId));
  const oppSideSharpEntries = oppBooks.filter((b) => customBooksSet.has(b.canonicalId));

  // Need at least one sharp book on each side to devig — UNLESS one of the
  // custom books is "novig" which is already vig-free (no devig needed).
  const hasNoVig = customBooksSet.has("novig");

  if (thisSideSharpEntries.length === 0 && oppSideSharpEntries.length === 0) {
    return null; // No custom book odds at all
  }

  if (thisSideSharpEntries.length === 0 && oppSideSharpEntries.length === 0 && !hasNoVig) {
    // No sharp odds at all — skip
    return null;
  }

  // If we only have one side from the sharp book, infer the other side
  // Since it's a two-outcome market: fair_over + fair_under = 1 (before vig)
  // We can estimate the missing side from the available side + typical vig
  if ((thisSideSharpEntries.length === 0 || oppSideSharpEntries.length === 0) && !hasNoVig) {
    const availableEntries = thisSideSharpEntries.length > 0 ? thisSideSharpEntries : oppSideSharpEntries;
    const availableSide = thisSideSharpEntries.length > 0 ? "this" : "opp";

    // Use the available odds to compute fair prob directly
    // Sharp books have low vig (~2-3%), so implied prob is close to fair
    const sharpAm = availableEntries[0].am;
    const sharpImplied = americanToImpliedProb(sharpAm);
    // Estimate fair prob by removing ~1.5% vig from each side
    const fairProb = availableSide === "this"
      ? (side === "over" ? sharpImplied * 0.97 : sharpImplied * 0.97)
      : (side === "over" ? (1 - sharpImplied * 0.97) : (1 - sharpImplied * 0.97));

    // Find best bettable book on this side
    const bettableBooks = allBooks
      .filter((b) => !customBooksSet.has(b.canonicalId))
      .sort((a, b) => americanToImpliedProb(a.am) - americanToImpliedProb(b.am));
    const bestBettable = bettableBooks[0];
    if (!bestBettable) return null;

    const bettableProb = americanToImpliedProb(bestBettable.am);
    const ev = ((fairProb / bettableProb) - 1) * 100;

    if (ev < -50 || ev > 200) return null; // Sanity check

    const fairAm = impliedProbToAmerican(fairProb);
    return {
      ...row,
      book: { id: bestBettable.canonicalId, odds: { am: bestBettable.am, dec: bestBettable.dec ?? 0 } },
      ev_data: {
        ...(row.ev_data ?? {}),
        power: { ev, fairProb, fairAm },
        multiplicative: { ev, fairProb, fairAm },
        additive: { ev, fairProb, fairAm },
        probit: { ev, fairProb, fairAm },
        sharp: { id: availableEntries[0].canonicalId, odds: { am: sharpAm, dec: availableEntries[0].dec ?? 0 } },
      },
    } as WorkerEVRow;
  }

  // If we have a NoVig entry on this side but missing the opposite side,
  // use NoVig odds directly as fair probability (it's already vig-free)
  const useNoVigDirect = hasNoVig && (thisSideSharpEntries.length === 0 || oppSideSharpEntries.length === 0);
  if (useNoVigDirect) {
    const noVigEntry = thisSideSharpEntries.find((b) => b.canonicalId === "novig")
      ?? oppSideSharpEntries.find((b) => b.canonicalId === "novig");
    if (!noVigEntry) return null;

    // NoVig odds ARE the fair odds — convert directly to probability
    const fairProb = americanToImpliedProb(noVigEntry.am);

    // Find best bettable book on this side
    const bettableBooks = allBooks
      .filter((b) => !customBooksSet.has(b.canonicalId))
      .sort((a, b) => {
        const aProb = americanToImpliedProb(a.am);
        const bProb = americanToImpliedProb(b.am);
        return aProb - bProb; // Lower implied = better odds for the bettor
      });
    const bestBettable = bettableBooks[0];
    if (!bestBettable) return null;

    const bettableProb = americanToImpliedProb(bestBettable.am);
    const ev = ((fairProb / bettableProb) - 1) * 100;

    // Build result row with NoVig direct pricing
    return {
      ...row,
      book: { id: bestBettable.canonicalId, odds: { am: bestBettable.am, dec: bestBettable.dec ?? 0 } },
      ev_data: {
        ...(row.ev_data ?? {}),
        power: { ev, fairProb, fairAm: noVigEntry.am },
        multiplicative: { ev, fairProb, fairAm: noVigEntry.am },
        additive: { ev, fairProb, fairAm: noVigEntry.am },
        probit: { ev, fairProb, fairAm: noVigEntry.am },
        sharp: { id: "novig", odds: { am: noVigEntry.am, dec: noVigEntry.dec ?? 0 } },
      },
    } as WorkerEVRow;
  }

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
        const w = config.weights?.[entry.canonicalId] ?? (1 / entries.length);
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
  const fairProbAdd = side === "over"
    ? devigResults.additive?.fairProbOver
    : devigResults.additive?.fairProbUnder;
  const fairProbProbit = side === "over"
    ? devigResults.probit?.fairProbOver
    : devigResults.probit?.fairProbUnder;

  // Find best non-sharp book on this side
  const bettableBooks = allBooks
    .filter((b) => !customBooksSet.has(b.canonicalId))
    .filter((b) => b.am && b.dec);

  // Supplement with live odds for books absent from the worker snapshot (e.g. Kalshi, Polymarket).
  // This prevents +EV opportunities from being silently dropped when the best book isn't in
  // the pre-computed all_books array.
  const supplementalLiveBooks: CustomBookRow[] = [];
  if (liveOddsCache && row.sport && row.eid && row.mkt) {
    const entityName: string = row.ev_data?.player ?? row.ent ?? "";
    const selKey = `${normalizeEntityName(entityName)}|${side}|${row.line}`;
    const comboPrefix = `${row.sport}/${row.eid}/${row.mkt}`;
    const inSnapshot = new Set(bettableBooks.map((b) => b.canonicalId));

    for (const book of LIVE_ODDS_SUPPLEMENTAL_BOOKS) {
      const canonId = canonicalizeCustomBookId(book);
      if (customBooksSet.has(canonId) || inSnapshot.has(canonId)) continue;
      const selections = liveOddsCache.get(`${comboPrefix}/${book}`);
      if (!selections) continue;
      const sel = selections[selKey];
      if (!sel || sel.locked) continue;
      const am = parseInt(String(sel.price), 10);
      const dec = typeof sel.price_decimal === "number" ? sel.price_decimal : americanToDecimal(am);
      if (!Number.isFinite(am) || !Number.isFinite(dec) || dec <= 1) continue;
      const liveBook: CustomBookRow = {
        id: book,
        canonicalId: canonId,
        am,
        dec,
        odd_id: sel.odd_id ?? null,
        link: sel.link ?? null,
        mobile_link: sel.mobile_link ?? null,
        sgp: sel.sgp ?? null,
        limits: sel.limits ?? null,
      };
      bettableBooks.push(liveBook);
      supplementalLiveBooks.push(liveBook);
      inSnapshot.add(canonId);
    }
  }

  if (bettableBooks.length === 0) return null;

  // Calculate EV for each bettable book, pick the best
  let bestBook = bettableBooks[0];
  let bestEvWorst = -Infinity;
  let bestEvBest = -Infinity;
  let bestEvPow: number | undefined;
  let bestEvMult: number | undefined;
  let bestEvAdd: number | undefined;
  let bestEvProbit: number | undefined;

  for (const book of bettableBooks) {
    const evPow = fairProbPower != null ? calculateEV(fairProbPower, book.am) * 100 : undefined;
    const evMult = fairProbMult != null ? calculateEV(fairProbMult, book.am) * 100 : undefined;
    const evAdd = fairProbAdd != null ? calculateEV(fairProbAdd, book.am) * 100 : undefined;
    const evProbit = fairProbProbit != null ? calculateEV(fairProbProbit, book.am) * 100 : undefined;

    const evVals = [evPow, evMult, evAdd, evProbit].filter((v): v is number => v != null);
    if (evVals.length === 0) continue;

    const worst = Math.min(...evVals);
    if (worst > bestEvWorst) {
      bestEvWorst = worst;
      bestEvBest = Math.max(...evVals);
      bestEvPow = evPow;
      bestEvMult = evMult;
      bestEvAdd = evAdd;
      bestEvProbit = evProbit;
      bestBook = book;
    }
  }

  // Don't gate on bestEvWorst <= 0 here — the outer minEV filter handles it.
  // Removing this gate ensures rows where a supplemental live book (e.g. Kalshi)
  // is the only +EV book are not silently dropped before that book is selected.
  if (bestEvWorst > 25) return null; // Data error filter

  let bestMethod: DevigMethod = "power";
  let bestMethodEv = bestEvPow ?? -Infinity;
  for (const [method, value] of [
    ["multiplicative", bestEvMult],
    ["additive", bestEvAdd],
    ["probit", bestEvProbit],
  ] as const) {
    if (value != null && value > bestMethodEv) {
      bestMethod = method;
      bestMethodEv = value;
    }
  }

  const updatedAllBooks = [
    ...rawAllBooks.map((rawBook) => {
      const rawId = typeof rawBook?.id === "string" ? rawBook.id : "";
      const canonicalId = canonicalizeCustomBookId(rawId);
      const am = typeof rawBook?.am === "number" ? rawBook.am : Number(rawBook?.am);

      return {
        ...rawBook,
        ev_pct: Number.isFinite(am)
          ? calculateEvPercentForBook(am, [fairProbPower, fairProbMult, fairProbAdd, fairProbProbit])
          : null,
        is_sharp_ref: customBooksSet.has(canonicalId),
      };
    }),
    // Append supplemental live books (e.g. Kalshi) so they appear in allBooks on the frontend
    ...supplementalLiveBooks.map((b) => ({
      id: b.id,
      am: b.am,
      dec: b.dec,
      link: b.link ?? null,
      mobile_link: b.mobile_link ?? null,
      sgp: b.sgp ?? null,
      limits: b.limits ?? null,
      odd_id: b.odd_id ?? null,
      ev_pct: calculateEvPercentForBook(b.am, [fairProbPower, fairProbMult, fairProbAdd, fairProbProbit]),
      is_sharp_ref: false,
    })),
  ];

  const updatedOppBooks = rawOppBooks.map((rawBook) => {
    const rawId = typeof rawBook?.id === "string" ? rawBook.id : "";
    const canonicalId = canonicalizeCustomBookId(rawId);

    return {
      ...rawBook,
      is_sharp_ref: customBooksSet.has(canonicalId),
    };
  });

  // Build a modified row with re-computed EV values
  return {
    ...row,
    seid: `${row.seid.replace(/:pinnacle$/, `:custom`)}`,
    book: {
      id: bestBook.id,
      odds: { am: bestBook.am, dec: bestBook.dec, ts: row.book?.odds?.ts },
      link: bestBook.link ?? null,
      mobile_link: bestBook.mobile_link ?? null,
      sgp: bestBook.sgp ?? null,
      limits: bestBook.limits ?? null,
      odd_id: bestBook.odd_id ?? null,
    },
    devig: {
      inputs: {
        preset: "custom",
        over_am: sharpOverAm,
        over_dec: americanToDecimal(sharpOverAm),
        under_am: sharpUnderAm,
        under_dec: americanToDecimal(sharpUnderAm),
        blended_from: Array.from(customBooksSet),
      },
      params: { methods: devigMethods },
      p_fair: {
        power: fairProbPower ?? null,
        multiplicative: fairProbMult ?? null,
        additive: fairProbAdd ?? null,
        probit: fairProbProbit ?? null,
      },
    },
    ev: {
      pow: bestEvPow ?? null,
      mult: bestEvMult ?? null,
      add: bestEvAdd ?? null,
      probit: bestEvProbit ?? null,
    },
    rollup: {
      best_case: bestEvBest,
      worst_case: bestEvWorst,
      best_method: bestMethod,
    },
    ev_data: {
      ...row.ev_data,
      all_books: updatedAllBooks,
      opp_books: updatedOppBooks,
    },
  };
}
