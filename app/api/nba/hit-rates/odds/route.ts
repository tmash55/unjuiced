import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * Hit Rate Odds API - Hybrid Approach
 * 
 * Primary: hitrate:nba:v2 (3.4MB, fast, has prices but no links/SGP)
 * Secondary: odds:nba:{eventId}:{market} (full data with links/SGP, fetched on demand)
 * 
 * Strategy:
 * 1. Fetch basic odds from v2 hash (fast, single call)
 * 2. Return immediately for table display
 * 3. Links/SGP can be fetched on-demand when user clicks
 */

interface OddsRequest {
  stableKey: string;  // The stable key from odds_selection_id
  line?: number;      // Optional: specific line to highlight
  eventId?: string;   // Optional: for fetching full link data
  market?: string;    // Optional: for fetching full link data
}

// Side odds structure (over or under)
interface SideOdds {
  price: string | number;
  u?: string;              // Desktop URL for this side
  m?: string;              // Mobile URL for this side
  sgp?: string;            // SGP token for this side
}

// V2 Redis structure (with links inside over/under objects)
interface RedisV2Data {
  eid?: string;           // Event ID
  ent?: string;           // Entity (player name or pid)
  mkt?: string;           // Market type
  primary_ln?: number;    // Current primary line
  player?: string;        // Player name
  player_id?: string;     // Player UUID
  team?: string;          // Team abbreviation
  position?: string;      // Player position
  live?: boolean;         // Is game live
  best?: {                // Best prices for PRIMARY line
    o?: { bk: string; price: number };
    u?: { bk: string; price: number };
  };
  lines?: Array<{
    ln: number;
    books?: Record<string, {
      over?: SideOdds;        // Over object with price, u, m, sgp
      under?: SideOdds;       // Under object with price, u, m, sgp
      main?: boolean;
    }>;
    best?: {
      over?: { bk: string; price: number };
      under?: { bk: string; price: number };
    };
    avg?: { over?: number; under?: number };
  }>;
  ts?: number;
}

// Full Redis structure (with links, from odds:nba:* keys)
interface RedisFullData {
  lines?: Array<{
    ln: number;
    books?: Record<string, {
      over?: { 
        price: number | string; 
        u?: string; 
        m?: string; 
        sgp?: string;
        limit_max?: number | null;
      };
      under?: { 
        price: number | string; 
        u?: string; 
        m?: string; 
        sgp?: string;
        limit_max?: number | null;
      };
    }>;
  }>;
}

// Book odds with deep links
interface BookOddsData {
  price: number;
  url: string | null;
  mobileUrl: string | null;
  sgp: string | null;
}

// Response for frontend
interface LineOddsResponse {
  stableKey: string;
  eventId: string | null;
  market: string | null;
  primaryLine: number | null;
  currentLine: number | null;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
  allLines: Array<{
    line: number;
    bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
    bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
    books: Record<string, { 
      over?: BookOddsData; 
      under?: BookOddsData;
    }>;
  }>;
  live: boolean;
  timestamp: number | null;
}

const MAX_KEYS = 500;
const REDIS_V2_KEY = "hitrate:nba:v2";

// Parse price from string or number
function parsePrice(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

// Extract price from side odds (handles both old string format and new object format)
function extractSidePrice(side: SideOdds | string | number | undefined): number | null {
  if (side === undefined || side === null) return null;
  // New format: object with price property
  if (typeof side === "object" && "price" in side) {
    return parsePrice(side.price);
  }
  // Old format: just the price value
  return parsePrice(side as string | number);
}

// Extract links from side odds object
function extractSideLinks(side: SideOdds | string | number | undefined): { url: string | null; mobileUrl: string | null; sgp: string | null } {
  if (side === undefined || side === null || typeof side !== "object") {
    return { url: null, mobileUrl: null, sgp: null };
  }
  return {
    url: side.u || null,
    mobileUrl: side.m || null,
    sgp: side.sgp || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requests: OddsRequest[] = Array.isArray(body?.selections) 
      ? body.selections.slice(0, MAX_KEYS) 
      : [];

    if (!requests.length) {
      return NextResponse.json(
        { odds: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Filter valid requests
    const validRequests = requests.filter(
      (r) => typeof r.stableKey === "string" && r.stableKey.trim()
    );

    if (!validRequests.length) {
      return NextResponse.json(
        { odds: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Deduplicate keys
    const uniqueKeys = [...new Set(validRequests.map((r) => r.stableKey.trim()))];
    
    // Single batch fetch from Redis v2 hash
    const rawResultsRaw = await redis.hmget(REDIS_V2_KEY, ...uniqueKeys);
      
    // Normalize results
    const rawResults: (string | null)[] = Array.isArray(rawResultsRaw) 
      ? (rawResultsRaw as (string | null)[])
      : uniqueKeys.map((key) => (rawResultsRaw as Record<string, unknown>)?.[key] as string | null ?? null);

    // Build response map
    const odds: Record<string, LineOddsResponse> = {};

    for (let i = 0; i < uniqueKeys.length; i++) {
      const stableKey = uniqueKeys[i];
      const raw = rawResults[i];

      if (!raw) {
        odds[stableKey] = createEmptyResponse(stableKey);
        continue;
      }

      // Parse Redis data
      let data: RedisV2Data;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : (raw as RedisV2Data);
      } catch {
        odds[stableKey] = createEmptyResponse(stableKey);
        continue;
      }

      // Find requested line
      const request = validRequests.find((r) => r.stableKey.trim() === stableKey);
      const requestedLine = request?.line ?? data.primary_ln ?? null;

      // Build best odds from top-level best (these have correct price format)
      let bestOver: LineOddsResponse["bestOver"] = null;
      let bestUnder: LineOddsResponse["bestUnder"] = null;

      if (data.best?.o) {
        bestOver = { 
          book: data.best.o.bk, 
          price: data.best.o.price, 
          url: null, 
          mobileUrl: null, 
          sgp: null 
        };
      }
      if (data.best?.u) {
        bestUnder = { 
          book: data.best.u.bk, 
          price: data.best.u.price, 
          url: null, 
          mobileUrl: null, 
          sgp: null 
        };
      }

      // If we have a requested line, try to get better odds from that specific line
      if (requestedLine !== null && data.lines) {
        const matchingLine = data.lines.find((l) => l.ln === requestedLine);
        if (matchingLine?.best) {
          // Get links from the best book's OVER/UNDER object (not book level)
          const bestOverBook = matchingLine.best.over?.bk;
          const bestUnderBook = matchingLine.best.under?.bk;
          const overBookData = bestOverBook ? matchingLine.books?.[bestOverBook] : null;
          const underBookData = bestUnderBook ? matchingLine.books?.[bestUnderBook] : null;
          
          if (matchingLine.best.over) {
            // Links are INSIDE the over object
            const overLinks = extractSideLinks(overBookData?.over);
            bestOver = { 
              book: matchingLine.best.over.bk, 
              price: matchingLine.best.over.price,
              ...overLinks,
            };
          }
          if (matchingLine.best.under) {
            // Links are INSIDE the under object
            const underLinks = extractSideLinks(underBookData?.under);
            bestUnder = { 
              book: matchingLine.best.under.bk, 
              price: matchingLine.best.under.price,
              ...underLinks,
            };
          }
        }
      }

      // Build all lines array (links are INSIDE over/under objects)
      const allLines = (data.lines || []).map((line) => {
        // Find best over/under for this line with links from INSIDE over/under
        let lineBestOver: LineOddsResponse["bestOver"] = null;
        let lineBestUnder: LineOddsResponse["bestUnder"] = null;

        if (line.best?.over) {
          const bestOverBookData = line.books?.[line.best.over.bk];
          const overLinks = extractSideLinks(bestOverBookData?.over);
          lineBestOver = {
            book: line.best.over.bk,
            price: line.best.over.price,
            ...overLinks,
          };
        }
        if (line.best?.under) {
          const bestUnderBookData = line.books?.[line.best.under.bk];
          const underLinks = extractSideLinks(bestUnderBookData?.under);
          lineBestUnder = {
            book: line.best.under.bk,
            price: line.best.under.price,
            ...underLinks,
          };
        }

        // Build books object with parsed prices and links (links are INSIDE over/under)
        const books: Record<string, { over?: BookOddsData; under?: BookOddsData }> = {};
        
        if (line.books) {
          for (const [bookId, bookOdds] of Object.entries(line.books)) {
            // Extract price and links from INSIDE the over/under objects
            const overPrice = extractSidePrice(bookOdds.over);
            const underPrice = extractSidePrice(bookOdds.under);
            const overLinks = extractSideLinks(bookOdds.over);
            const underLinks = extractSideLinks(bookOdds.under);
            
            if (overPrice !== null || underPrice !== null) {
              books[bookId] = {};
              if (overPrice !== null) {
                books[bookId].over = {
                  price: overPrice,
                  ...overLinks,  // Links from INSIDE over object
                };
              }
              if (underPrice !== null) {
                books[bookId].under = {
                  price: underPrice,
                  ...underLinks,  // Links from INSIDE under object
                };
              }
            }
          }
        }

        return {
          line: line.ln,
          bestOver: lineBestOver,
          bestUnder: lineBestUnder,
          books,
        };
      });

      odds[stableKey] = {
        stableKey,
        eventId: data.eid ?? null,
        market: data.mkt ?? null,
        primaryLine: data.primary_ln ?? null,
        currentLine: requestedLine,
        bestOver,
        bestUnder,
        allLines,
        live: data.live ?? false,
        timestamp: data.ts ?? null,
      };
    }

    return NextResponse.json(
      { odds },
      { 
        headers: { 
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" 
        } 
      }
    );
  } catch (error: unknown) {
    console.error("[/api/nba/hit-rates/odds] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error instanceof Error ? error.message : "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function createEmptyResponse(stableKey: string): LineOddsResponse {
  return {
    stableKey,
    eventId: null,
    market: null,
    primaryLine: null,
    currentLine: null,
    bestOver: null,
    bestUnder: null,
    allLines: [],
    live: false,
    timestamp: null,
  };
}

/**
 * GET endpoint for fetching full link data on demand
 * Use when user needs deep links or SGP tokens (e.g., clicking odds, adding to favorites)
 * 
 * Query params:
 * - eventId: Event UUID
 * - market: Market type (e.g., player_points)
 * - line: Specific line to get links for
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const market = searchParams.get("market");
    const lineStr = searchParams.get("line");

    if (!eventId || !market) {
      return NextResponse.json(
        { error: "Missing eventId or market" },
        { status: 400 }
      );
    }

    // Fetch from detailed odds key
    const oddsKey = `odds:nba:${eventId}:${market}`;
    const rawData = await redis.get<string>(oddsKey);

    if (!rawData) {
      return NextResponse.json(
        { links: null, message: "No detailed odds data found" },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    }

    let data: RedisFullData;
    try {
      data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    } catch {
      return NextResponse.json(
        { links: null, message: "Failed to parse odds data" },
        { status: 500 }
      );
    }

    const requestedLine = lineStr ? parseFloat(lineStr) : null;

    // Find the matching line
    const lineData = requestedLine !== null 
      ? data.lines?.find((l) => l.ln === requestedLine)
      : data.lines?.[0];

    if (!lineData?.books) {
      return NextResponse.json(
        { links: null, message: "No line data found" },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    }

    // Build links response
    const links: Record<string, { 
      over?: { url: string | null; mobileUrl: string | null; sgp: string | null; price: number };
      under?: { url: string | null; mobileUrl: string | null; sgp: string | null; price: number };
    }> = {};

    for (const [bookId, bookOdds] of Object.entries(lineData.books)) {
      links[bookId] = {};
      
      if (bookOdds.over) {
        const price = parsePrice(bookOdds.over.price);
        if (price !== null) {
          links[bookId].over = {
            url: bookOdds.over.u || null,
            mobileUrl: bookOdds.over.m || null,
            sgp: bookOdds.over.sgp || null,
            price,
          };
        }
      }
      
      if (bookOdds.under) {
        const price = parsePrice(bookOdds.under.price);
        if (price !== null) {
          links[bookId].under = {
            url: bookOdds.under.u || null,
            mobileUrl: bookOdds.under.m || null,
            sgp: bookOdds.under.sgp || null,
            price,
          };
        }
      }
    }

    return NextResponse.json(
      { 
        links,
        line: lineData.ln,
        eventId,
        market,
      },
      { 
        headers: { 
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120" 
        } 
      }
    );
  } catch (error: unknown) {
    console.error("[/api/nba/hit-rates/odds GET] Error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
