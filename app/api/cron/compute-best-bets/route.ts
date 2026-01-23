/**
 * Cron Job: Pre-compute Best Bets
 * 
 * Runs every 60 seconds via Vercel Cron to pre-compute top +EV bets.
 * Stores results in Redis for fast dashboard retrieval.
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/compute-best-bets",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  devigMultiple,
  calculateMultiEV,
  blendSharpOdds,
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
import { trackEdges, trackActiveSportsbooks } from "@/lib/metrics/dashboard-metrics";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// =============================================================================
// Configuration
// =============================================================================

const DASHBOARD_SPORTS = ["nba", "nfl", "nhl", "ncaab", "ncaaf"];
const MIN_EV_THRESHOLD = 0.5;
const MAX_EV_THRESHOLD = 20;
const DEVIG_METHODS: DevigMethod[] = ["power", "multiplicative"];
const SHARP_PRESET: SharpPreset = "pinnacle";
const MIN_BOOKS_PER_SIDE = 2;
const TOTAL_BETS_LIMIT = 10;
const MGET_CHUNK_SIZE = 500;
const SCAN_COUNT = 2000;

// Redis cache keys
const REDIS_BEST_BETS_ZSET = "dashboard:best-bets:ev";
const REDIS_BEST_BETS_HASH = "dashboard:best-bets:data";
const REDIS_BEST_BETS_TIMESTAMP = "dashboard:best-bets:timestamp";
const REDIS_CACHE_TTL = 120; // 2 minutes TTL

// Books to exclude
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
]);

// =============================================================================
// Types
// =============================================================================

interface SlimBestBet {
  id: string;
  player: string;
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
  deepLink: string | null;
  sport: string;
  startTime: string | null;
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
// Redis Helpers
// =============================================================================

async function getActiveEventIds(sport: string): Promise<string[]> {
  const activeSet = await redis.smembers(`active_events:${sport}`);
  if (activeSet && activeSet.length > 0) {
    return activeSet.map(String);
  }

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

// =============================================================================
// Core EV Computation
// =============================================================================

async function fetchTopEVForSport(sport: string, limit: number = 5): Promise<SlimBestBet[]> {
  const opportunities: SlimBestBet[] = [];
  const pairMap = new Map<string, SelectionPair>();

  try {
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];

    const allOddsKeys = await getOddsKeysForEvents(sport, eventIds);
    if (allOddsKeys.length === 0) return [];

    const eventIdSet = new Set(eventIds);
    const filteredKeys = allOddsKeys.filter((key) => {
      const parts = key.split(":");
      const eventId = parts[2];
      return eventId && eventIdSet.has(eventId);
    });

    if (filteredKeys.length === 0) return [];

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

    // Calculate +EV for each pair
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

            opportunities.push({
              id: `${sport}:${pair.eventId}:${pair.market}:${pair.line}:${side}:${bookOffer.bookId}`,
              player: displayName,
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
              deepLink: bookOffer.mobileLink || bookOffer.link || null,
              sport,
              startTime: pair.event?.start_time || null,
            });
          }
        }
      }
    }

    return opportunities
      .sort((a, b) => b.evPercent - a.evPercent)
      .slice(0, limit);
  } catch (error) {
    console.error(`[cron/best-bets] Error fetching ${sport}:`, error);
    return [];
  }
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (if configured)
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    console.log(`[cron/best-bets] Starting computation for ${DASHBOARD_SPORTS.length} sports...`);

    // Fetch all sports in parallel
    const sportPromises = DASHBOARD_SPORTS.map(async (sport) => {
      try {
        const opps = await fetchTopEVForSport(sport, 5);
        console.log(`[cron/best-bets] ${sport}: ${opps.length} opportunities`);
        return opps;
      } catch (error) {
        console.error(`[cron/best-bets] ${sport} failed:`, error);
        return [];
      }
    });

    const results = await Promise.all(sportPromises);
    const allBets = results.flat();

    // Sort by EV and take top N
    const topBets = allBets
      .sort((a, b) => b.evPercent - a.evPercent)
      .slice(0, TOTAL_BETS_LIMIT);

    console.log(`[cron/best-bets] Computed ${topBets.length} top bets`);

    // Track metrics for the dashboard Market Pulse
    if (allBets.length > 0) {
      const edgeMetrics = allBets.map(bet => ({
        id: bet.id,
        evPercent: bet.evPercent,
        bookId: bet.book,
      }));
      
      // Track all edges found (not just top 10) for accurate daily count
      await trackEdges(edgeMetrics);
      
      // Track all unique sportsbooks
      const uniqueBooks = [...new Set(allBets.map(b => b.book))];
      await trackActiveSportsbooks(uniqueBooks);
    }

    // Store in Redis
    if (topBets.length > 0) {
      // Clear old data first
      await redis.del(REDIS_BEST_BETS_ZSET);
      await redis.del(REDIS_BEST_BETS_HASH);

      // Add to ZSET (sorted by EV) - use pipeline for efficiency
      const pipeline = redis.pipeline();
      for (const bet of topBets) {
        pipeline.zadd(REDIS_BEST_BETS_ZSET, { score: bet.evPercent, member: bet.id });
      }
      await pipeline.exec();

      // Store full data in HASH
      const hashData: Record<string, string> = {};
      for (const bet of topBets) {
        hashData[bet.id] = JSON.stringify(bet);
      }
      await redis.hset(REDIS_BEST_BETS_HASH, hashData);

      // Set TTL
      await redis.expire(REDIS_BEST_BETS_ZSET, REDIS_CACHE_TTL);
      await redis.expire(REDIS_BEST_BETS_HASH, REDIS_CACHE_TTL);

      // Update timestamp
      await redis.set(REDIS_BEST_BETS_TIMESTAMP, Date.now(), { ex: REDIS_CACHE_TTL });
    }

    const duration = Date.now() - startTime;
    console.log(`[cron/best-bets] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      count: topBets.length,
      sports: DASHBOARD_SPORTS,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/best-bets] Error:", error);
    return NextResponse.json(
      { error: "Failed to compute best bets", duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
