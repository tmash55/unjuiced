/**
 * Events API v2 - SSE-Powered
 * 
 * Returns all active events for a sport from Redis.
 * 
 * GET /api/v2/events/nba?date=today
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  SSEEvent,
  getActiveEventsKey,
  getEventKey,
} from "@/lib/odds/types";

// Supported sports
const SUPPORTED_SPORTS = new Set([
  "nba",
  "nfl",
  "mlb",
  "ncaabaseball",
  "nhl",
  "ncaab",
  "ncaaf",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sport: string }> }
) {
  try {
    const { sport } = await params;
    
    // Validate sport
    if (!SUPPORTED_SPORTS.has(sport.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported sport", supported: Array.from(SUPPORTED_SPORTS) },
        { status: 400 }
      );
    }

    const sportKey = sport.toLowerCase();
    const url = new URL(request.url);

    // Parse query params
    const dateFilter = url.searchParams.get("date"); // "today", "tomorrow", or ISO date
    const includeStarted = url.searchParams.get("include_started") === "true";

    // 1. Get all active event IDs
    const eventIds = await getActiveEventIds(sportKey);

    if (eventIds.length === 0) {
      return NextResponse.json({
        events: [],
        count: 0,
        sport: sportKey,
      });
    }

    // 2. Fetch event metadata (parallel)
    const eventKeys = eventIds.map((id) => getEventKey(sportKey, id));
    const eventDataRaw = await redis.mget<(string | SSEEvent | null)[]>(...eventKeys);

    // 3. Parse and filter events
    let events: SSEEvent[] = [];

    eventIds.forEach((id, i) => {
      const data = eventDataRaw[i];
      if (data) {
        const event: SSEEvent = typeof data === "string" ? JSON.parse(data) : data;
        events.push(event);
      }
    });

    // Apply date filter
    if (dateFilter) {
      const targetDate = getTargetDate(dateFilter);
      if (targetDate) {
        events = events.filter((event) => {
          const eventDate = new Date(event.commence_time).toDateString();
          return eventDate === targetDate.toDateString();
        });
      }
    }

    // Filter out started games unless requested
    if (!includeStarted) {
      const now = new Date();
      events = events.filter((event) => {
        // Keep if not live OR if explicitly including started
        if (event.is_live) return false;
        const commenceTime = new Date(event.commence_time);
        return commenceTime > now;
      });
    }

    // Sort by commence time
    events.sort((a, b) => 
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );

    return NextResponse.json({
      events,
      count: events.length,
      sport: sportKey,
    }, {
      headers: {
        // Cache for 30 seconds
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[/api/v2/events] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get active event IDs with fallback
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  // Try the fast SET first
  let eventIds = await redis.smembers(getActiveEventsKey(sport));

  // Fallback: scan event keys if SET is empty
  if (!eventIds || eventIds.length === 0) {
    const eventKeys = await scanKeys(`events:${sport}:*`);
    eventIds = eventKeys.map((key) => key.split(":")[2]);
  }

  return eventIds;
}

/**
 * Scan Redis keys with pattern (safer than KEYS for large datasets)
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0");

  return keys;
}

/**
 * Parse date filter to target date
 */
function getTargetDate(dateFilter: string): Date | null {
  const now = new Date();
  
  // Use ET timezone for NBA games
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (dateFilter === "today") {
    const etParts = etFormatter.formatToParts(now);
    const year = etParts.find((p) => p.type === "year")?.value;
    const month = etParts.find((p) => p.type === "month")?.value;
    const day = etParts.find((p) => p.type === "day")?.value;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  if (dateFilter === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const etParts = etFormatter.formatToParts(tomorrow);
    const year = etParts.find((p) => p.type === "year")?.value;
    const month = etParts.find((p) => p.type === "month")?.value;
    const day = etParts.find((p) => p.type === "day")?.value;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  // Try parsing as ISO date
  try {
    return new Date(dateFilter);
  } catch {
    return null;
  }
}
