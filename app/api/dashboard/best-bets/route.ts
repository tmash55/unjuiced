/**
 * Dashboard Best Bets API - Optimized for Speed
 * 
 * Returns top 10 +EV bets across NBA, NFL, NHL using Pinnacle devigging.
 * 
 * Architecture:
 * - L1: In-memory cache (30s TTL) for instant response
 * - L2: Redis pre-computed cache (60s TTL) from cron job
 * - L3: Direct computation fallback with parallel sport fetching
 * 
 * Target: < 200ms warm, < 500ms cold
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  devigMultiple,
  calculateMultiEV,
  createSharpReference,
  blendSharpOdds,
  impliedProbToAmerican,
  type DevigMethod,
  type SharpPreset,
  type BookOffer,
} from "@/lib/ev";
import {
  normalizePlayerName,
  getMarketDisplay,
  normalizeRawMarket,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import { SHARP_PRESETS } from "@/lib/ev/constants";
import { zrevrangeCompat } from "@/lib/redis-zset";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  responseEncoding: false,
});

// =============================================================================
// Configuration
// =============================================================================

const DASHBOARD_SPORTS = ["nba", "nfl", "nhl", "ncaab", "ncaaf"];
const MIN_EV_THRESHOLD = 0.5;
const MAX_EV_THRESHOLD = 20;
const DEVIG_METHODS: DevigMethod[] = ["power", "multiplicative"];
const SHARP_PRESET: SharpPreset = "pinnacle";
const MIN_BOOKS_PER_SIDE = 2;
const DEFAULT_LIMIT = 10;
const MGET_CHUNK_SIZE = 500;
const SCAN_COUNT = 2000;

// L1 Cache: In-memory (fast path)
const RESPONSE_CACHE = new Map<string, { data: BestBetsResponse; ts: number }>();
const L1_CACHE_TTL = 30_000; // 30 seconds

// Redis cache keys
const REDIS_BEST_BETS_ZSET = "dashboard:best-bets:ev";
const REDIS_BEST_BETS_HASH = "dashboard:best-bets:data";
const REDIS_BEST_BETS_TIMESTAMP = "dashboard:best-bets:timestamp";

// Books to exclude
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
]);

// =============================================================================
// Types
// =============================================================================

/** Slim payload for dashboard - minimal fields for fast transfer */
export interface SlimBestBet {
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
  u: string | null; // Desktop link
  m: string | null; // Mobile link
  deepLink: string | null;
  sport: string;
  startTime: string | null;
  bookCount: number;
}

interface BestBetsResponse {
  bets: SlimBestBet[];
  timestamp: number;
  source: "l1_cache" | "redis_cache" | "computed";
}

interface SelectionPair {
  sport: string;
  eventId: string;
  event: { home_team: string; away_team: string; start_time: string } | null;
  player: string;
  playerDisplay: string;
  playerId: string | null;
  team: string | null;
  position: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  over: { books: BookOffer[]; best: BookOffer | null };
  under: { books: BookOffer[]; best: BookOffer | null };
}

// =============================================================================
// Utility Functions
// =============================================================================

function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock": return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana": return "hard-rock-indiana";
    case "ballybet": return "bally-bet";
    case "sportsinteraction": return "sports-interaction";
    case "fanduel-yourway":
    case "fanduel_yourway": return "fanduelyourway";
    case "betmgm-michigan":
    case "betmgm_michigan": return "betmgm";
    default: return lower;
  }
}

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function formatPosition(position: string | null): string | null {
  if (!position) return null;
  const multiPosPatterns = ["GF", "FG", "FC", "CF", "SF", "FS", "PG", "SG", "PF"];
  const upper = position.toUpperCase();
  if (position.length === 2 && multiPosPatterns.includes(upper)) {
    return `${position[0]}/${position[1]}`;
  }
  return position;
}

function formatDisplayName(
  playerName: string | null,
  homeTeam: string | null,
  awayTeam: string | null,
  marketDisplay: string | null,
  market: string | null
): string {
  if (playerName === "game_total" || playerName === "game_spread" || !playerName) {
    if (homeTeam && awayTeam) {
      return `${awayTeam} @ ${homeTeam}`;
    }
    return marketDisplay || market || "Game";
  }
  return playerName;
}

// =============================================================================
// L1 Cache (In-Memory)
// =============================================================================

function getL1Cache(): BestBetsResponse | null {
  const cached = RESPONSE_CACHE.get("best-bets");
  if (cached && Date.now() - cached.ts < L1_CACHE_TTL) {
    return cached.data;
  }
  RESPONSE_CACHE.delete("best-bets");
  return null;
}

function setL1Cache(data: BestBetsResponse): void {
  RESPONSE_CACHE.set("best-bets", { data, ts: Date.now() });
}

// =============================================================================
// L2 Cache (Redis Pre-computed)
// =============================================================================

async function getRedisCache(): Promise<SlimBestBet[] | null> {
  try {
    // Check timestamp first - if too old, skip Redis cache
    const rawTimestamp = await redis.get(REDIS_BEST_BETS_TIMESTAMP);
    // Handle various timestamp formats (string, number, seconds, milliseconds)
    let timestamp: number | null = null;
    if (rawTimestamp !== null && rawTimestamp !== undefined) {
      const parsed = typeof rawTimestamp === 'string' ? parseInt(rawTimestamp, 10) : Number(rawTimestamp);
      if (!isNaN(parsed)) {
        // If timestamp looks like seconds (10 digits, < 10 billion), convert to ms
        // Milliseconds are 13 digits (> 1 trillion)
        timestamp = parsed < 10000000000 ? parsed * 1000 : parsed;
      }
    }
    
    const age = timestamp ? Date.now() - timestamp : null;

    if (!timestamp || age === null || age > 300_000) {
      return null;
    }

    // Get top 10 IDs from ZSET
    const ids = await zrevrangeCompat(redis as any, REDIS_BEST_BETS_ZSET, 0, DEFAULT_LIMIT - 1);

    if (!ids || ids.length === 0) {
      return null;
    }

    // Get full data from HASH
    const rawData = await redis.hmget(REDIS_BEST_BETS_HASH, ...ids);
    
    // Upstash/Redis can return object or array depending on client
    let dataArray: (string | null)[] = [];
    if (Array.isArray(rawData)) {
      dataArray = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // If it's an object (Record<string, string>), map IDs to values
      dataArray = ids.map(id => (rawData as Record<string, string | null>)[id] || null);
    }

    const bets: SlimBestBet[] = [];
    
    for (const item of dataArray) {
      if (item) {
        try {
          const parsed = typeof item === "string" ? JSON.parse(item) : item;
          bets.push(parsed as SlimBestBet);
        } catch {}
      }
    }

    return bets.length > 0 ? bets : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Direct Computation (L3 Fallback)
// =============================================================================

async function getActiveEventIds(sport: string): Promise<string[]> {
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    return activeSet.map(String);
  }

  // Fallback to scanning
  const eventKeys = await scanKeys(`events:${sport}:*`);
  return eventKeys.map((k) => k.split(":")[2]).filter(Boolean);
}

async function getOddsKeysForEvents(sport: string, eventIds: string[]): Promise<string[]> {
  const allKeys: string[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((eventId) => scanKeys(`odds:${sport}:${eventId}:*`))
    );
    allKeys.push(...batchResults.flat());
  }

  return allKeys;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let iterations = 0;
  const MAX_ITERATIONS = 50;

  do {
    iterations++;
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = result[0];
    keys.push(...result[1]);

    if (iterations >= MAX_ITERATIONS) {
      break;
    }
  } while (cursor !== "0");

  return keys;
}

function getSharpOddsForPreset(
  books: BookOffer[],
  preset: SharpPreset
): { price: number; source: string; blendedFrom?: string[] } | null {
  const presetConfig = SHARP_PRESETS[preset];
  if (!presetConfig) return null;

  if (preset === "market_average") {
    if (books.length === 0) return null;
    const blendInputs = books.map((b) => ({ bookId: b.bookId, odds: b.price, weight: 1.0 }));
    const blendedOdds = blendSharpOdds(blendInputs);
    if (blendedOdds === 0) return null;
    return { price: blendedOdds, source: `Market Avg (${books.length} books)`, blendedFrom: books.map((b) => b.bookId) };
  }

  const presetBooks = presetConfig.books;
  if (presetBooks.length === 1) {
    const targetBook = presetBooks[0].bookId;
    const match = books.find((b) => b.bookId === targetBook || b.bookId === normalizeBookId(targetBook));
    if (match) {
      return { price: match.price, source: targetBook };
    }
    return null;
  }

  // Blended preset
  const blendInputs: { bookId: string; odds: number; weight: number }[] = [];
  const blendedFrom: string[] = [];

  for (const { bookId, weight } of presetBooks) {
    const match = books.find((b) => b.bookId === bookId || b.bookId === normalizeBookId(bookId));
    if (match) {
      blendInputs.push({ bookId, odds: match.price, weight });
      blendedFrom.push(bookId);
    }
  }

  if (blendInputs.length !== presetBooks.length) {
    return null;
  }

  const blendedOdds = blendSharpOdds(blendInputs);
  if (blendedOdds === 0) return null;

  return { price: blendedOdds, source: `${preset} (${blendedFrom.join(", ")})`, blendedFrom };
}

function getExcludedBooksForPreset(preset: SharpPreset): Set<string> {
  const excluded = new Set<string>();
  switch (preset) {
    case "pinnacle":
      excluded.add("pinnacle");
      break;
    case "pinnacle_circa":
      excluded.add("pinnacle");
      excluded.add("circa");
      break;
    case "hardrock_thescore":
      excluded.add("hardrock");
      excluded.add("hard-rock");
      excluded.add("thescore");
      break;
  }
  return excluded;
}

async function fetchTopEVForSport(sport: string, limit: number = 5): Promise<SlimBestBet[]> {
  const opportunities: SlimBestBet[] = [];
  const pairMap = new Map<string, SelectionPair>();

  try {
    // Step 1: Get active events
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];

    // Step 2: Get odds keys
    const allOddsKeys = await getOddsKeysForEvents(sport, eventIds);
    if (allOddsKeys.length === 0) return [];

    // Filter keys
    const eventIdSet = new Set(eventIds);
    const filteredKeys = allOddsKeys.filter((key) => {
      const parts = key.split(":");
      const eventId = parts[2];
      return eventId && eventIdSet.has(eventId);
    });

    if (filteredKeys.length === 0) return [];

    // Step 3: Batch fetch all odds data
    const chunks: string[][] = [];
    for (let i = 0; i < filteredKeys.length; i += MGET_CHUNK_SIZE) {
      chunks.push(filteredKeys.slice(i, i + MGET_CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) => redis.mget<(SSEBookSelections | string | null)[]>(...chunk))
    );
    const allOddsData = chunkResults.flat();

    const oddsDataMap = new Map<string, SSEBookSelections>();
    filteredKeys.forEach((key, i) => {
      const data = allOddsData[i];
      if (data) {
        oddsDataMap.set(key, typeof data === "string" ? JSON.parse(data) : data);
      }
    });

    // Step 4: Fetch event details
    const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
    const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

    const now = new Date();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const eventMap = new Map<string, { home_team: string; away_team: string; start_time: string }>();
    const pregameEventIds = new Set<string>();

    eventIds.forEach((id, i) => {
      const event = eventsRaw[i];
      if (!event) return;

      const startTime = (event.commence_time as string) || (event.start_time as string) || "";
      const isLiveFlag = event.is_live === true;
      const homeTeam = (event.home_team as string) || "";
      const awayTeam = (event.away_team as string) || "";

      if (!homeTeam || !awayTeam || !startTime) return;

      const gameStart = new Date(startTime);
      if (isNaN(gameStart.getTime())) return;

      const msSinceStart = now.getTime() - gameStart.getTime();
      if (msSinceStart > SIX_HOURS_MS) return;

      const isLive = isLiveFlag || gameStart <= now;
      if (!isLive) {
        pregameEventIds.add(id);
        eventMap.set(id, { home_team: homeTeam, away_team: awayTeam, start_time: startTime });
      }
    });

    // Step 5: Build selection pairs
    const keysByEventMarket = new Map<string, string[]>();
    for (const key of filteredKeys) {
      const parts = key.split(":");
      const eventId = parts[2];
      const market = parts[3];
      const groupKey = `${eventId}:${market}`;
      if (!keysByEventMarket.has(groupKey)) {
        keysByEventMarket.set(groupKey, []);
      }
      keysByEventMarket.get(groupKey)!.push(key);
    }

    for (const [groupKey, marketKeys] of keysByEventMarket) {
      const [eventId, market] = groupKey.split(":");

      if (!pregameEventIds.has(eventId)) continue;

      const eventData = eventMap.get(eventId);
      const event = eventData || null;

      const bookSelections: Record<string, SSEBookSelections> = {};
      for (const key of marketKeys) {
        const rawBook = key.split(":").pop()!;
        const book = normalizeBookId(rawBook);
        const data = oddsDataMap.get(key);
        if (data) {
          bookSelections[book] = data;
        }
      }

      const baseSelectionKeys = new Set<string>();
      for (const selections of Object.values(bookSelections)) {
        for (const key of Object.keys(selections)) {
          const [playerRaw, , lineStr] = key.split("|");
          if (playerRaw && lineStr) {
            baseSelectionKeys.add(`${playerRaw}|${lineStr}`);
          }
        }
      }

      for (const baseKey of baseSelectionKeys) {
        const [playerRaw, lineStr] = baseKey.split("|");
        const player = normalizePlayerName(playerRaw);
        const line = parseFloat(lineStr);
        const pairKey = `${eventId}:${market}:${player}:${line}`;

        let pair = pairMap.get(pairKey);
        if (!pair) {
          pair = {
            sport,
            eventId,
            event,
            player,
            playerDisplay: "",
            playerId: null,
            team: null,
            position: null,
            market,
            marketDisplay: "",
            line,
            over: { books: [], best: null },
            under: { books: [], best: null },
          };
          pairMap.set(pairKey, pair);
        }

        for (const [book, selections] of Object.entries(bookSelections)) {
          if (EXCLUDED_BOOKS.has(book.toLowerCase())) continue;

          const overKey = `${playerRaw}|over|${lineStr}`;
          const yesKey = `${playerRaw}|yes|${lineStr}`;
          const mlKey = `${playerRaw}|ml|${lineStr}`;
          const overSel = (selections[overKey] || selections[yesKey] || selections[mlKey]) as SSESelection | undefined;

          if (overSel && !overSel.locked) {
            const overPrice = parseInt(String(overSel.price), 10);
            const bookOffer: BookOffer = {
              bookId: book,
              bookName: book,
              price: overPrice,
              priceDecimal: overSel.price_decimal,
              link: overSel.link || null,
              mobileLink: overSel.mobile_link || null,
              sgp: overSel.sgp || null,
              limits: overSel.limits || null,
            };
            pair.over.books.push(bookOffer);
            if (!pair.over.best || overSel.price_decimal > pair.over.best.priceDecimal) {
              pair.over.best = bookOffer;
            }
            if (overSel.player && !pair.playerDisplay) pair.playerDisplay = overSel.player;
            if (overSel.player_id && !pair.playerId) pair.playerId = overSel.player_id;
            if (overSel.team && !pair.team) pair.team = overSel.team;
            if (overSel.position && !pair.position) pair.position = formatPosition(overSel.position);
            if (overSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(overSel.raw_market);
          }

          const underKey = `${playerRaw}|under|${lineStr}`;
          const noKey = `${playerRaw}|no|${lineStr}`;
          const underSel = (selections[underKey] || selections[noKey]) as SSESelection | undefined;

          if (underSel && !underSel.locked) {
            const underPrice = parseInt(String(underSel.price), 10);
            const bookOffer: BookOffer = {
              bookId: book,
              bookName: book,
              price: underPrice,
              priceDecimal: underSel.price_decimal,
              link: underSel.link || null,
              mobileLink: underSel.mobile_link || null,
              sgp: underSel.sgp || null,
              limits: underSel.limits || null,
            };
            pair.under.books.push(bookOffer);
            if (!pair.under.best || underSel.price_decimal > pair.under.best.priceDecimal) {
              pair.under.best = bookOffer;
            }
            if (underSel.player && !pair.playerDisplay) pair.playerDisplay = underSel.player;
            if (underSel.player_id && !pair.playerId) pair.playerId = underSel.player_id;
            if (underSel.team && !pair.team) pair.team = underSel.team;
            if (underSel.position && !pair.position) pair.position = formatPosition(underSel.position);
            if (underSel.raw_market && !pair.marketDisplay) pair.marketDisplay = normalizeRawMarket(underSel.raw_market);
          }
        }
      }
    }

    // Step 6: Calculate +EV for each pair
    const excludedBooks = getExcludedBooksForPreset(SHARP_PRESET);

    for (const pair of pairMap.values()) {
      if (pair.over.books.length < MIN_BOOKS_PER_SIDE || pair.under.books.length < MIN_BOOKS_PER_SIDE) continue;

      const sharpOver = getSharpOddsForPreset(pair.over.books, SHARP_PRESET);
      const sharpUnder = getSharpOddsForPreset(pair.under.books, SHARP_PRESET);

      if (!sharpOver || !sharpUnder) continue;

      const devigResults = devigMultiple(sharpOver.price, sharpUnder.price, DEVIG_METHODS);

      const sides: ("over" | "under")[] = ["over", "under"];

      for (const side of sides) {
        const sideData = pair[side];

        for (const bookOffer of sideData.books) {
          if (excludedBooks.has(bookOffer.bookId.toLowerCase())) continue;

          const evCalc = calculateMultiEV(devigResults, bookOffer, side);

          if (evCalc.evWorst >= MIN_EV_THRESHOLD && evCalc.evWorst <= MAX_EV_THRESHOLD) {
            const displayName = formatDisplayName(
              pair.playerDisplay || pair.player,
              pair.event?.home_team || null,
              pair.event?.away_team || null,
              pair.marketDisplay,
              pair.market
            );

            // Get fair probability from the worst method (conservative)
            // Try power first, then multiplicative
            let fairProb: number | null = null;
            if (devigResults.power?.success) {
              fairProb = side === "over" 
                ? devigResults.power.fairProbOver 
                : devigResults.power.fairProbUnder;
            } else if (devigResults.multiplicative?.success) {
              fairProb = side === "over"
                ? devigResults.multiplicative.fairProbOver
                : devigResults.multiplicative.fairProbUnder;
            }

            // Convert fair probability to American odds
            let fairOdds: number | null = null;
            let fairOddsFormatted: string | null = null;
            if (fairProb !== null && fairProb > 0 && fairProb < 1) {
              fairOdds = Math.round(impliedProbToAmerican(fairProb));
              fairOddsFormatted = formatOdds(fairOdds);
            }

            // Count total books with odds on this side
            const bookCount = sideData.books.length;

            opportunities.push({
              id: `${sport}:${pair.eventId}:${pair.market}:${pair.line}:${side}:${bookOffer.bookId}`,
              player: displayName,
              playerRaw: pair.player || null,
              team: pair.team,
              homeTeam: pair.event?.home_team || null,
              awayTeam: pair.event?.away_team || null,
              market: pair.market,
              marketDisplay: pair.marketDisplay || getMarketDisplay(pair.market),
              line: pair.line,
              side,
              bestOdds: bookOffer.price,
              bestOddsFormatted: formatOdds(bookOffer.price),
              book: bookOffer.bookId,
              evPercent: Math.round(evCalc.evWorst * 10) / 10,
              fairProb: fairProb !== null ? Math.round(fairProb * 1000) / 10 : null, // Convert to percentage
              fairOdds,
              fairOddsFormatted,
              u: bookOffer.link || null,
              m: bookOffer.mobileLink || null,
              deepLink: bookOffer.mobileLink || bookOffer.link || null,
              sport,
              startTime: pair.event?.start_time || null,
              bookCount,
            });
          }
        }
      }
    }

    // Sort by EV descending and return top N
    return opportunities
      .sort((a, b) => b.evPercent - a.evPercent)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function computeBestBets(limit: number = DEFAULT_LIMIT): Promise<SlimBestBet[]> {
  const startTime = Date.now();
  const sportResults = await Promise.all(
    DASHBOARD_SPORTS.map(async (sport) => {
      try {
        return await fetchTopEVForSport(sport, 5);
      } catch {
        return [];
      }
    })
  );

  const allBets: SlimBestBet[] = sportResults.flat();

  // Sort by EV and return top N
  const topBets = allBets.sort((a, b) => b.evPercent - a.evPercent).slice(0, limit);

  return topBets;
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(params.get("limit") || String(DEFAULT_LIMIT)), 20);
    const bypassCache = params.get("fresh") === "true";
    const forceCompute = params.get("compute") === "true"; // Only for manual/cron triggers

    // L1: Check in-memory cache (fastest path)
    if (!bypassCache) {
      const l1Data = getL1Cache();
      if (l1Data) {
        return NextResponse.json(l1Data, {
          headers: {
            "Cache-Control": "private, max-age=30",
            "X-Cache": "L1-HIT",
            "X-Response-Time": `${Date.now() - startTime}ms`,
          },
        });
      }
    }

    // L2: Check Redis pre-computed cache
    const redisBets = await getRedisCache();
    if (redisBets && redisBets.length > 0) {
      const response: BestBetsResponse = {
        bets: redisBets.slice(0, limit),
        timestamp: Date.now(),
        source: "redis_cache",
      };
      setL1Cache(response);
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Cache": "L2-HIT",
          "X-Response-Time": `${Date.now() - startTime}ms`,
        },
      });
    }

    // L3: Direct computation - ONLY if explicitly requested (for VPS cron or manual refresh)
    // This prevents expensive computation on every user request
    if (forceCompute) {
      const computedBets = await computeBestBets(limit);

      // Store in Redis for future requests
      if (computedBets.length > 0) {
        await storeInRedis(computedBets);
      }

      const response: BestBetsResponse = {
        bets: computedBets,
        timestamp: Date.now(),
        source: "computed",
      };

      setL1Cache(response);

      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=30",
          "X-Cache": "COMPUTED",
          "X-Response-Time": `${Date.now() - startTime}ms`,
        },
      });
    }

    // No cache and no compute flag - return empty (VPS worker needs to populate Redis)
    return NextResponse.json({
      bets: [],
      timestamp: Date.now(),
      source: "empty",
      message: "Data is being refreshed. Please try again shortly.",
    }, {
      headers: {
        "Cache-Control": "private, max-age=5",
        "X-Cache": "MISS",
        "X-Response-Time": `${Date.now() - startTime}ms`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch best bets", bets: [], timestamp: Date.now() },
      { status: 500 }
    );
  }
}

// Helper to store computed bets in Redis
async function storeInRedis(bets: SlimBestBet[]): Promise<void> {
  try {
    // Clear old data
    await redis.del(REDIS_BEST_BETS_ZSET);
    await redis.del(REDIS_BEST_BETS_HASH);

    // Add to ZSET and HASH using pipeline
    const pipeline = redis.pipeline();
    for (const bet of bets) {
      pipeline.zadd(REDIS_BEST_BETS_ZSET, { score: bet.evPercent, member: bet.id });
    }
    
    const hashData: Record<string, string> = {};
    for (const bet of bets) {
      hashData[bet.id] = JSON.stringify(bet);
    }
    pipeline.hset(REDIS_BEST_BETS_HASH, hashData);
    pipeline.set(REDIS_BEST_BETS_TIMESTAMP, Date.now());
    pipeline.expire(REDIS_BEST_BETS_ZSET, 300); // 5 min TTL
    pipeline.expire(REDIS_BEST_BETS_HASH, 300);
    pipeline.expire(REDIS_BEST_BETS_TIMESTAMP, 300);
    
    await pipeline.exec();
  } catch {}
}
