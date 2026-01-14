export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  normalizePlayerName,
  getMarketDisplay,
  normalizeRawMarket,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import {
  devigMultiple,
  calculateMultiEV,
  americanToDecimal,
  americanToImpliedProb,
  createSharpReference,
  blendSharpOdds,
  formatEV,
  formatKelly,
  type DevigMethod,
  type SharpPreset,
  type PositiveEVOpportunity,
  type PositiveEVResponse,
  type BookOffer,
  type MultiDevigResult,
} from "@/lib/ev";
import {
  SHARP_PRESETS,
  DEFAULT_DEVIG_METHODS,
  POSITIVE_EV_DEFAULTS,
  EV_THRESHOLDS,
} from "@/lib/ev/constants";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Configuration
const SCAN_COUNT = 1000;
const MGET_CHUNK_SIZE = 500;

// Supported sports
const VALID_SPORTS = new Set(["nba", "nfl", "nhl", "ncaab", "ncaaf", "soccer_epl"]);

// Books to exclude
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
  "betmgm", // Use betmgm-michigan instead
]);

// Sharp books for reference
const SHARP_BOOK_IDS = new Set([
  "pinnacle",
  "circa",
  "hardrock",
  "hard-rock",
  "thescore",
  "bookmaker",
]);

/**
 * Normalize book IDs to match canonical sportsbook IDs
 */
function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
      return "bally-bet";
    case "sportsinteraction":
      return "sports-interaction";
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

/**
 * Format position strings
 */
function formatPosition(position: string | null): string | null {
  if (!position) return null;
  const multiPosPatterns = ["GF", "FG", "FC", "CF", "SF", "FS", "PG", "SG", "PF"];
  const upper = position.toUpperCase();
  if (position.length === 2 && multiPosPatterns.includes(upper)) {
    return `${position[0]}/${position[1]}`;
  }
  return position;
}

/**
 * Format American odds as string
 */
function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

// Types for pairing
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
  over: {
    books: BookOffer[];
    best: BookOffer | null;
  };
  under: {
    books: BookOffer[];
    best: BookOffer | null;
  };
}

/**
 * GET /api/v2/positive-ev
 * 
 * True +EV tool using proper de-vigging methods
 * 
 * Query params:
 *   sports      - Comma-separated sports (default: "nba")
 *   markets     - Comma-separated markets (optional)
 *   sharpPreset - Sharp reference preset (default: "pinnacle")
 *   devigMethods - Comma-separated methods (default: "power,multiplicative")
 *   minEV       - Minimum EV% threshold (default: 0)
 *   maxEV       - Maximum EV% to show (default: 20)
 *   books       - Filter to specific sportsbooks (optional)
 *   limit       - Max results (default: 100)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const params = new URL(req.url).searchParams;

    // Parse parameters
    const sportsParam = params.get("sports")?.toLowerCase().split(",").filter(Boolean) || ["nba"];
    const sports = sportsParam.filter((s) => VALID_SPORTS.has(s));

    if (sports.length === 0) {
      return NextResponse.json({ error: "No valid sports provided" }, { status: 400 });
    }

    const markets = params.get("markets")?.toLowerCase().split(",").filter(Boolean) || null;
    const sharpPreset = (params.get("sharpPreset") || "pinnacle") as SharpPreset;
    const devigMethodsParam = params.get("devigMethods")?.toLowerCase().split(",").filter(Boolean) || null;
    const devigMethods: DevigMethod[] = devigMethodsParam 
      ? (devigMethodsParam.filter(m => ["power", "multiplicative", "additive", "probit"].includes(m)) as DevigMethod[])
      : DEFAULT_DEVIG_METHODS;
    const minEV = parseFloat(params.get("minEV") || "0");
    const maxEV = parseFloat(params.get("maxEV") || String(EV_THRESHOLDS.maximum));
    const booksFilter = params.get("books")?.toLowerCase().split(",").filter(Boolean) || null;
    const limit = Math.min(parseInt(params.get("limit") || "100"), 500);

    // Validate sharp preset
    if (!SHARP_PRESETS[sharpPreset]) {
      return NextResponse.json({ error: `Invalid sharpPreset: ${sharpPreset}` }, { status: 400 });
    }

    // Fetch opportunities for all sports
    const allOpportunities: PositiveEVOpportunity[] = [];
    
    for (const sport of sports) {
      const sportOpps = await fetchPositiveEVOpportunities(
        sport,
        markets,
        sharpPreset,
        devigMethods,
        minEV,
        maxEV,
        booksFilter
      );
      allOpportunities.push(...sportOpps);
    }

    // Sort by worst-case EV (conservative) descending
    allOpportunities.sort((a, b) => b.evCalculations.evWorst - a.evCalculations.evWorst);

    // Apply limit
    const opportunities = allOpportunities.slice(0, limit);

    const response: PositiveEVResponse = {
      opportunities,
      meta: {
        totalFound: allOpportunities.length,
        returned: opportunities.length,
        sharpPreset,
        devigMethods,
        minEV,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    console.error("[/api/v2/positive-ev] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", timing_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

/**
 * Fetch +EV opportunities for a single sport
 */
async function fetchPositiveEVOpportunities(
  sport: string,
  markets: string[] | null,
  sharpPreset: SharpPreset,
  devigMethods: DevigMethod[],
  minEV: number,
  maxEV: number,
  booksFilter: string[] | null
): Promise<PositiveEVOpportunity[]> {
  const opportunities: PositiveEVOpportunity[] = [];
  const pairMap = new Map<string, SelectionPair>();

  try {
    // Step 1: Get active events
    const eventIds = await getActiveEventIds(sport);
    if (eventIds.length === 0) return [];

    // Step 2: Get odds keys
    const allOddsKeys = await getOddsKeysForEvents(sport, eventIds);
    if (allOddsKeys.length === 0) return [];

    // Filter keys by event and market
    const eventIdSet = new Set(eventIds);
    const filteredKeys: string[] = [];

    for (const key of allOddsKeys) {
      const parts = key.split(":");
      const eventId = parts[2];
      const market = parts[3];
      const book = parts[4];

      if (!eventId || !market || !book) continue;
      if (!eventIdSet.has(eventId)) continue;
      if (markets && !markets.includes(market)) continue;

      filteredKeys.push(key);
    }

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

    // Build key -> data map
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

    // Build event map
    const now = new Date();
    const eventMap = new Map<string, { home_team: string; away_team: string; start_time: string }>();
    const liveEventIds = new Set<string>();

    eventIds.forEach((id, i) => {
      const event = eventsRaw[i];
      if (!event) return;

      const startTime = (event.commence_time as string) || (event.start_time as string) || "";
      if (startTime) {
        const gameStart = new Date(startTime);
        if (!isNaN(gameStart.getTime()) && gameStart <= now) {
          liveEventIds.add(id);
          return;
        }
      }

      const homeTeam = (event.home_team as string) || "";
      const awayTeam = (event.away_team as string) || "";
      if (!homeTeam || !awayTeam) return;

      eventMap.set(id, { home_team: homeTeam, away_team: awayTeam, start_time: startTime });
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
      if (liveEventIds.has(eventId)) continue;

      const event = eventMap.get(eventId) || null;

      // Build book selections
      const bookSelections: Record<string, SSEBookSelections> = {};
      for (const key of marketKeys) {
        const rawBook = key.split(":").pop()!;
        const book = normalizeBookId(rawBook);
        const data = oddsDataMap.get(key);
        if (data) {
          bookSelections[book] = data;
        }
      }

      // Get unique base selection keys
      const baseSelectionKeys = new Set<string>();
      for (const selections of Object.values(bookSelections)) {
        for (const key of Object.keys(selections)) {
          const [playerRaw, , lineStr] = key.split("|");
          if (playerRaw && lineStr) {
            baseSelectionKeys.add(`${playerRaw}|${lineStr}`);
          }
        }
      }

      // Process each player/line pair
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

        // Gather prices from all books
        for (const [book, selections] of Object.entries(bookSelections)) {
          if (EXCLUDED_BOOKS.has(book.toLowerCase())) continue;

          // Check over/yes/ml
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
              updated: overSel.updated || undefined,
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

          // Check under/no
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
              updated: underSel.updated || undefined,
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
    for (const pair of pairMap.values()) {
      // Need both sides for proper de-vigging
      if (pair.over.books.length < 1 || pair.under.books.length < 1) continue;

      // Get sharp reference odds
      const sharpOver = getSharpOddsForPreset(pair.over.books, sharpPreset);
      const sharpUnder = getSharpOddsForPreset(pair.under.books, sharpPreset);

      if (!sharpOver || !sharpUnder) continue;

      // De-vig using the sharp reference
      const devigResults = devigMultiple(sharpOver.price, sharpUnder.price, devigMethods);

      // Create sharp reference object
      const sharpReference = createSharpReference(
        sharpOver.price,
        sharpUnder.price,
        sharpPreset,
        sharpOver.source,
        sharpOver.blendedFrom
      );

      // Check each book for +EV opportunities on both sides
      const sides: ("over" | "under")[] = ["over", "under"];

      for (const side of sides) {
        const sideData = pair[side];

        // Filter by user's books if specified
        let booksToCheck = sideData.books;
        if (booksFilter) {
          booksToCheck = booksToCheck.filter((b) => booksFilter.includes(b.bookId));
        }

        // Exclude sharp books from +EV opportunities (can't beat yourself)
        booksToCheck = booksToCheck.filter((b) => !SHARP_BOOK_IDS.has(b.bookId));

        for (const bookOffer of booksToCheck) {
          // Calculate EV for this book's offer
          const evCalculations = calculateMultiEV(devigResults, bookOffer, side);

          // Check if it meets threshold
          if (evCalculations.evWorst < minEV) continue;
          if (evCalculations.evWorst > maxEV) continue; // Filter outliers

          // Create opportunity
          const opp: PositiveEVOpportunity = {
            id: `${pair.eventId}:${pair.market}:${pair.player}:${pair.line}:${side}:${bookOffer.bookId}`,
            sport: pair.sport,
            eventId: pair.eventId,
            market: pair.market,
            marketDisplay: pair.marketDisplay || getMarketDisplay(pair.market),
            homeTeam: pair.event?.home_team,
            awayTeam: pair.event?.away_team,
            startTime: pair.event?.start_time,
            playerId: pair.playerId || undefined,
            playerName: pair.playerDisplay || pair.player,
            playerTeam: pair.team || undefined,
            playerPosition: pair.position || undefined,
            line: pair.line,
            side,
            sharpPreset,
            sharpReference,
            devigResults,
            book: bookOffer,
            evCalculations,
            allBooks: sideData.books,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          opportunities.push(opp);
        }
      }
    }

    return opportunities;
  } catch (error) {
    console.error(`[positive-ev] Error fetching ${sport}:`, error);
    return [];
  }
}

/**
 * Get sharp odds for a preset from available books
 */
function getSharpOddsForPreset(
  books: BookOffer[],
  preset: SharpPreset
): { price: number; source: string; blendedFrom?: string[] } | null {
  const presetConfig = SHARP_PRESETS[preset];
  if (!presetConfig) return null;

  if (preset === "custom") {
    // Custom preset - would need user-defined weights
    return null;
  }

  const presetBooks = presetConfig.books;

  if (presetBooks.length === 1) {
    // Single book preset
    const targetBook = presetBooks[0].bookId;
    const match = books.find((b) => b.bookId === targetBook || b.bookId === normalizeBookIdForSharp(targetBook));
    if (match) {
      return { price: match.price, source: targetBook };
    }
    return null;
  }

  // Blended preset
  const blendInputs: { bookId: string; odds: number; weight: number }[] = [];
  const blendedFrom: string[] = [];

  for (const { bookId, weight } of presetBooks) {
    const match = books.find((b) => b.bookId === bookId || b.bookId === normalizeBookIdForSharp(bookId));
    if (match) {
      blendInputs.push({ bookId, odds: match.price, weight });
      blendedFrom.push(bookId);
    }
  }

  if (blendInputs.length === 0) return null;

  // Renormalize weights for available books
  const totalWeight = blendInputs.reduce((sum, b) => sum + b.weight, 0);
  const normalizedInputs = blendInputs.map((b) => ({
    ...b,
    weight: b.weight / totalWeight,
  }));

  const blendedOdds = blendSharpOdds(normalizedInputs);
  if (blendedOdds === 0) return null;

  return {
    price: blendedOdds,
    source: `${preset} (${blendedFrom.join(", ")})`,
    blendedFrom,
  };
}

/**
 * Normalize book ID for sharp book matching
 */
function normalizeBookIdForSharp(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hard-rock":
      return "hardrock";
    default:
      return lower;
  }
}

// =============================================================================
// Redis Helpers (reused from opportunities API)
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
      console.warn(`[scanKeys] Hit iteration limit for pattern: ${pattern}`);
      break;
    }
  } while (cursor !== "0");

  return keys;
}
