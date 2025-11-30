import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * New Stable Key System for Hit Rate Odds
 * 
 * The odds_selection_id now contains a stable hash key that never changes,
 * even when betting lines move. This replaces the old SID-based system.
 * 
 * Redis Key: props:nba:hitrate (hash map)
 * Lookup: stable_key → JSON with all odds data
 */

interface OddsRequest {
  stableKey: string;  // The stable key from odds_selection_id
  line?: number;      // Optional: specific line to highlight (for table view)
}

// Response structure from Redis
interface RedisOddsData {
  sid?: string;           // Current SID (for deep links if needed)
  eid?: string;           // Event ID
  ent?: string;           // Entity (e.g., "pid:player-uuid")
  mkt?: string;           // Market type
  primary_ln?: number;    // Current primary line
  player?: string;        // Player name
  team?: string;          // Team abbreviation
  position?: string;      // Player position
  live?: boolean;         // Is game live
  best?: {                // Best prices for PRIMARY line
    o?: { bk: string; price: number };  // Over
    u?: { bk: string; price: number };  // Under
  };
  lines?: Array<{         // ALL alternate lines
    ln: number;
    books?: Record<string, {
      over?: { price: number; u?: string; m?: string };
      under?: { price: number; u?: string; m?: string };
    }>;
    best?: {
      over?: { bk: string; price: number };
      under?: { bk: string; price: number };
    };
    avg?: { over?: number; under?: number };
  }>;
  ts?: number;            // Last update timestamp
}

// Book odds with deep links
interface BookOddsData {
  price: number;
  url: string | null;      // Desktop deep link
  mobileUrl: string | null; // Mobile deep link
}

// Simplified response for frontend
interface LineOddsResponse {
  stableKey: string;
  primaryLine: number | null;
  currentLine: number | null;      // The line we're showing odds for
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
  allLines: Array<{
  line: number;
    bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
    bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null;
    books: Record<string, { 
      over?: BookOddsData; 
      under?: BookOddsData;
    }>;
  }>;
  live: boolean;
  timestamp: number | null;
}

const MAX_KEYS = 500;
const REDIS_KEY = "props:nba:hitrate";

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
    
    // Single batch fetch from Redis hash
    const rawResultsRaw = await redis.hmget(REDIS_KEY, ...uniqueKeys);
      
    // Normalize results to array (Redis can return Record<string, unknown> or array)
    const rawResults: (string | null)[] = Array.isArray(rawResultsRaw) 
      ? (rawResultsRaw as (string | null)[])
      : uniqueKeys.map((key) => (rawResultsRaw as Record<string, unknown>)?.[key] as string | null ?? null);

    // Build response map
    const odds: Record<string, LineOddsResponse> = {};

    for (let i = 0; i < uniqueKeys.length; i++) {
      const stableKey = uniqueKeys[i];
        const raw = rawResults[i];

      if (!raw) {
        // No data found for this key
        odds[stableKey] = {
          stableKey,
          primaryLine: null,
          currentLine: null,
          bestOver: null,
          bestUnder: null,
          allLines: [],
          live: false,
          timestamp: null,
        };
        continue;
      }

      // Parse Redis data
      let data: RedisOddsData;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : (raw as RedisOddsData);
      } catch {
        odds[stableKey] = {
          stableKey,
          primaryLine: null,
          currentLine: null,
          bestOver: null,
          bestUnder: null,
          allLines: [],
          live: false,
          timestamp: null,
        };
        continue;
      }

      // Find the request to get the specific line they want
      const request = validRequests.find((r) => r.stableKey.trim() === stableKey);
      const requestedLine = request?.line ?? data.primary_ln ?? null;

      // Helper to get URLs for a book from line data
      const getBookUrls = (lineData: any, bookId: string, side: 'over' | 'under') => {
        if (!lineData?.books?.[bookId]?.[side]) return { url: null, mobileUrl: null };
        const bookOdds = lineData.books[bookId][side];
        return {
          url: bookOdds?.u || null,
          mobileUrl: bookOdds?.m || null,
        };
      };

      // Find best odds for the requested line (or primary line)
      let bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null } | null = null;
      let bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null } | null = null;

      if (requestedLine !== null && data.lines) {
        const matchingLine = data.lines.find((l) => l.ln === requestedLine);
        if (matchingLine?.best) {
          if (matchingLine.best.over) {
            const urls = getBookUrls(matchingLine, matchingLine.best.over.bk, 'over');
            bestOver = { 
              book: matchingLine.best.over.bk, 
              price: matchingLine.best.over.price,
              ...urls,
            };
          }
          if (matchingLine.best.under) {
            const urls = getBookUrls(matchingLine, matchingLine.best.under.bk, 'under');
            bestUnder = { 
              book: matchingLine.best.under.bk, 
              price: matchingLine.best.under.price,
              ...urls,
            };
        }
      }
      } else if (data.best) {
        // Fall back to primary line best (no URLs available at top level)
        if (data.best.o) {
          bestOver = { book: data.best.o.bk, price: data.best.o.price, url: null, mobileUrl: null };
        }
        if (data.best.u) {
          bestUnder = { book: data.best.u.bk, price: data.best.u.price, url: null, mobileUrl: null };
        }
      }

      // Build all lines array for matrix view (with deep links)
      const allLines = (data.lines || []).map((line) => ({
        line: line.ln,
        bestOver: line.best?.over 
          ? { 
              book: line.best.over.bk, 
              price: line.best.over.price,
              ...getBookUrls(line, line.best.over.bk, 'over'),
            } 
          : null,
        bestUnder: line.best?.under 
          ? { 
              book: line.best.under.bk, 
              price: line.best.under.price,
              ...getBookUrls(line, line.best.under.bk, 'under'),
            } 
          : null,
        books: Object.fromEntries(
          Object.entries(line.books || {}).map(([book, bookOdds]) => [
            book,
            { 
              over: bookOdds.over ? {
                price: bookOdds.over.price,
                url: bookOdds.over.u || null,
                mobileUrl: bookOdds.over.m || null,
              } : undefined,
              under: bookOdds.under ? {
                price: bookOdds.under.price,
                url: bookOdds.under.u || null,
                mobileUrl: bookOdds.under.m || null,
              } : undefined,
            },
          ])
        ),
      }));

      odds[stableKey] = {
        stableKey,
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
  } catch (error: any) {
    console.error("[/api/nba/hit-rates/odds] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
