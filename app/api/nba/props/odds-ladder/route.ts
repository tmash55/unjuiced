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
}

interface LineData {
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
  top_books: BookOdds[];
  book_count: number;
}

interface OddsLadderResponse {
  event_id: string;
  market: string;
  player_id: string;
  primary_line: number | null;
  lines: LineData[];
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
  limit_books_per_line: z.coerce.number().min(1).max(20).optional().default(3),
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
      limit_books_per_line: searchParams.get("limit_books_per_line"),
    });
    
    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query params", details: query.error.flatten() },
        { status: 400 }
      );
    }
    
    const { event_id, market, player_id: rawPlayerId, limit_books_per_line } = query.data;
    
    // Extract player UUID from sel_key if it includes side/line (e.g., "uuid:over:20.5" -> "uuid")
    const player_id = rawPlayerId.includes(':') ? rawPlayerId.split(':')[0] : rawPlayerId;
    
    // Step 1: Get all available lines from linesidx ZSET
    const linesKey = `linesidx:nba:${event_id}:${market}:${player_id}`;
    console.log(`[odds-ladder] Looking for key: ${linesKey} (raw: ${rawPlayerId})`);
    
    const linesRaw = await redis.zrange(linesKey, 0, -1);
    
    if (!linesRaw || linesRaw.length === 0) {
      console.log(`[odds-ladder] No lines found for key: ${linesKey}`);
      return NextResponse.json({
        event_id,
        market,
        player_id,
        primary_line: null,
        lines: [],
        updated_at: Date.now(),
      } as OddsLadderResponse);
    }
    
    // Parse lines to numbers and sort
    const lineNumbers = linesRaw
      .map(l => parseFloat(String(l)))
      .filter(l => !isNaN(l))
      .sort((a, b) => a - b);
    
    // Step 2: For each line, get books and their odds
    const linesData: LineData[] = [];
    let latestTimestamp = 0;
    
    // Get all books for all lines in parallel
    const booksPromises = lineNumbers.map(async (line) => {
      const booksKey = `booksidx:nba:${event_id}:${market}:${player_id}:${line}`;
      const books = await redis.smembers(booksKey);
      console.log(`[odds-ladder] booksidx key: ${booksKey} -> ${books?.length || 0} books`);
      return { line, books: books || [] };
    });
    
    const linesBooksResults = await Promise.all(booksPromises);
    
    // Collect all unique books across all lines
    const allBooks = new Set<string>();
    for (const { books } of linesBooksResults) {
      for (const book of books) {
        allBooks.add(book);
      }
    }
    
    console.log(`[odds-ladder] Total unique books across all lines: ${allBooks.size}`);
    
    // Fetch odds blobs for all books in parallel
    const oddsPromises = Array.from(allBooks).map(async (book) => {
      const oddsKey = `odds:nba:${event_id}:${market}:${book}`;
      const oddsBlob = await redis.get<RedisOddsBlob>(oddsKey);
      return { book, oddsBlob };
    });
    
    const oddsResults = await Promise.all(oddsPromises);
    
    // Build a map of book -> odds blob for quick lookup
    const oddsMap = new Map<string, RedisOddsBlob>();
    for (const { book, oddsBlob } of oddsResults) {
      if (oddsBlob && typeof oddsBlob === 'object') {
        oddsMap.set(book, oddsBlob);
      }
    }
    
    console.log(`[odds-ladder] Fetched ${oddsMap.size} odds blobs out of ${allBooks.size} books`);
    
    // Build line data
    for (const { line, books } of linesBooksResults) {
      const bookOddsList: BookOdds[] = [];
      
      for (const book of books) {
        const oddsBlob = oddsMap.get(book);
        if (!oddsBlob) continue;
        
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
          const parsePrice = (p: string | number | undefined): number | null => {
            if (p === undefined || p === null) return null;
            const num = typeof p === 'string' ? parseInt(p, 10) : p;
            return isNaN(num) ? null : num;
          };
          
          bookOddsList.push({
            book,
            over: parsePrice(overOdd?.price),
            under: parsePrice(underOdd?.price),
            link_over: overOdd?.link ?? overOdd?.mobile_link ?? null,
            link_under: underOdd?.link ?? underOdd?.mobile_link ?? null,
          });
          
          // Update timestamp from entry
          const entryTime = overOdd?.updated || underOdd?.updated;
          if (entryTime) {
            const ts = new Date(entryTime as string).getTime();
            if (ts > latestTimestamp) latestTimestamp = ts;
          }
        }
      }
      
      // Sort by best over odds
      bookOddsList.sort((a, b) => {
        const aPrice = a.over ?? a.under ?? -Infinity;
        const bPrice = b.over ?? b.under ?? -Infinity;
        return bPrice - aPrice;
      });
      
      const best = findBestOdds(bookOddsList);
      
      linesData.push({
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
        top_books: bookOddsList.slice(0, limit_books_per_line),
        book_count: bookOddsList.length,
      });
    }
    
    // Determine primary line (most common or middle line)
    const primaryLine = lineNumbers.length > 0 
      ? lineNumbers[Math.floor(lineNumbers.length / 2)] 
      : null;
    
    const responseTime = Date.now() - startTime;
    console.log(`[odds-ladder] ${event_id}/${market}/${player_id}: ${lineNumbers.length} lines, ${allBooks.size} books in ${responseTime}ms`);
    
    return NextResponse.json({
      event_id,
      market,
      player_id,
      primary_line: primaryLine,
      lines: linesData,
      updated_at: latestTimestamp || Date.now(),
    } as OddsLadderResponse, {
      headers: {
        "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=30",
      },
    });
    
  } catch (error) {
    console.error("[odds-ladder] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
