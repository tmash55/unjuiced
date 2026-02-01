import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

interface BookOdds {
  book: string;
  over: number | null;
  under: number | null;
  link_over?: string | null;
  link_under?: string | null;
  sgp_over?: string | null;
  sgp_under?: string | null;
}

interface OddsLineResponse {
  line: number;
  best: {
    book: string;
    over: number | null;
    under: number | null;
    links?: {
      mobile?: string | null;
      desktop?: string | null;
    };
  } | null;
  books: BookOdds[];
  book_count: number;
  updated_at: number;
}

// Structure of individual odd entry in Redis
interface RedisOddEntry {
  player_id: string;
  player?: string;
  side: "over" | "under";
  line: number;
  price: string | number;
  price_decimal?: number;
  link?: string;
  mobile_link?: string;
  sgp?: string;
  updated?: string;
}

// Odds blob is a hash of "player|side|line" -> odd entry
type RedisOddsBlob = Record<string, RedisOddEntry>;

// =============================================================================
// VALIDATION
// =============================================================================

const QuerySchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  market: z.string().min(1, "market is required"),
  player_id: z.string().min(1, "player_id is required"),
  line: z.coerce.number({ invalid_type_error: "line must be a number" }),
  include_sgp: z.coerce.boolean().optional().default(false),
});

// =============================================================================
// HELPERS
// =============================================================================

function findBestOdds(books: BookOdds[]): BookOdds | null {
  if (books.length === 0) return null;
  
  // Sort by over price descending (higher/better odds first)
  // If no over, sort by under price descending
  const sorted = [...books].sort((a, b) => {
    const aPrice = a.over ?? a.under ?? -Infinity;
    const bPrice = b.over ?? b.under ?? -Infinity;
    return bPrice - aPrice;
  });
  
  return sorted[0];
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query params
    const query = QuerySchema.safeParse({
      event_id: searchParams.get("event_id"),
      market: searchParams.get("market"),
      player_id: searchParams.get("player_id"),
      line: searchParams.get("line"),
      include_sgp: searchParams.get("include_sgp"),
    });
    
    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query params", details: query.error.flatten() },
        { status: 400 }
      );
    }
    
    const { event_id, market, player_id: rawPlayerId, line, include_sgp } = query.data;
    
    // Extract player UUID from sel_key if it includes side/line (e.g., "uuid:over:20.5" -> "uuid")
    const player_id = rawPlayerId.includes(':') ? rawPlayerId.split(':')[0] : rawPlayerId;
    
    // Step 1: Get all books that have this line from booksidx SET
    const booksKey = `booksidx:nba:${event_id}:${market}:${player_id}:${line}`;
    const booksRaw = await redis.smembers(booksKey);
    
    if (!booksRaw || booksRaw.length === 0) {
      console.log(`[odds-line] No booksidx found for key: ${booksKey}`);
      return NextResponse.json({
        line,
        best: null,
        books: [],
        book_count: 0,
        updated_at: Date.now(),
      } as OddsLineResponse);
    }
    
    // Step 2: Fetch odds blobs for all books in parallel
    const oddsPromises = booksRaw.map(async (book) => {
      const oddsKey = `odds:nba:${event_id}:${market}:${book}`;
      const oddsBlob = await redis.get<RedisOddsBlob>(oddsKey);
      return { book, oddsBlob };
    });
    
    const oddsResults = await Promise.all(oddsPromises);
    
    // Step 3: Build book odds list
    const bookOddsList: BookOdds[] = [];
    let latestTimestamp = 0;
    
    const parsePrice = (p: string | number | undefined): number | null => {
      if (p === undefined || p === null) return null;
      const num = typeof p === 'string' ? parseInt(p, 10) : p;
      return isNaN(num) ? null : num;
    };
    
    for (const { book, oddsBlob } of oddsResults) {
      if (!oddsBlob || typeof oddsBlob !== 'object') continue;
      
      // Find over and under odds for this player and line
      // Keys are formatted as "player_name|side|line" e.g. "dyson_daniels|over|3.5"
      let overOdd: RedisOddEntry | null = null;
      let underOdd: RedisOddEntry | null = null;
      
      for (const [key, entry] of Object.entries(oddsBlob)) {
        // Skip non-object entries (like metadata fields)
        if (!entry || typeof entry !== 'object' || !entry.player_id) continue;
        
        // Match by player_id and line
        if (entry.player_id === player_id && entry.line === line) {
          if (entry.side === 'over') {
            overOdd = entry;
          } else if (entry.side === 'under') {
            underOdd = entry;
          }
        }
      }
      
      // Only add if we found at least one side
      if (overOdd || underOdd) {
        const bookOdds: BookOdds = {
          book,
          over: parsePrice(overOdd?.price),
          under: parsePrice(underOdd?.price),
          link_over: overOdd?.link ?? overOdd?.mobile_link ?? null,
          link_under: underOdd?.link ?? underOdd?.mobile_link ?? null,
        };
        
        // Include SGP tokens if requested
        if (include_sgp) {
          bookOdds.sgp_over = overOdd?.sgp ?? null;
          bookOdds.sgp_under = underOdd?.sgp ?? null;
        }
        
        bookOddsList.push(bookOdds);
        
        // Update timestamp from entry
        const entryTime = overOdd?.updated || underOdd?.updated;
        if (entryTime) {
          const ts = new Date(entryTime).getTime();
          if (ts > latestTimestamp) latestTimestamp = ts;
        }
      }
    }
    
    // Sort by best over odds (higher is better)
    bookOddsList.sort((a, b) => {
      const aPrice = a.over ?? a.under ?? -Infinity;
      const bPrice = b.over ?? b.under ?? -Infinity;
      return bPrice - aPrice;
    });
    
    const best = findBestOdds(bookOddsList);
    
    const responseTime = Date.now() - startTime;
    console.log(`[odds-line] ${event_id}/${market}/${player_id}/${line}: ${bookOddsList.length} books in ${responseTime}ms`);
    
    return NextResponse.json({
      line,
      best: best ? {
        book: best.book,
        over: best.over,
        under: best.under,
        links: {
          desktop: best.link_over ?? best.link_under,
          mobile: best.link_over ?? best.link_under,
        },
      } : null,
      books: bookOddsList,
      book_count: bookOddsList.length,
      updated_at: latestTimestamp || Date.now(),
    } as OddsLineResponse, {
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=30",
      },
    });
    
  } catch (error) {
    console.error("[odds-line] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
