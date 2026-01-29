export const runtime = "edge";

import { NextRequest } from "next/server";
import {
  computeLegsHash,
  getCachedQuotes,
  setCachedQuotes,
  isCacheStale,
  type SgpLeg,
  type SgpBookOdds,
} from "@/lib/sgp/cache";

// =============================================================================
// TYPES
// =============================================================================

interface SgpQuoteRequest {
  legs: SgpLeg[];
  sportsbooks?: string[]; // Optional: limit to specific books
  prefetch?: boolean; // If true, just warm cache, don't care about response
}

interface OddsBlazeResponse {
  price?: string;
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
  message?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ODDSBLAZE_API_KEY = process.env.ODDSBLAZE_API_KEY;
const TIME_BUDGET_MS = 2500; // Max wait time before returning partial results
const PING_INTERVAL_MS = 15000;

// Map our book IDs to OddsBlaze's expected subdomain IDs
const ODDSBLAZE_BOOK_ID_MAP: Record<string, string> = {
  'draftkings': 'draftkings',
  'fanduel': 'fanduel',
  'betmgm': 'betmgm',
  'caesars': 'caesars',
  'bet365': 'bet365',
  'betrivers': 'betrivers',
  'betparx': 'betparx',
  'pointsbet': 'pointsbet',
  'espn': 'espnbet',
  'fanatics': 'fanatics',
  'fliff': 'fliff',
  'hard-rock': 'hard-rock',
  'bally-bet': 'bally-bet',
  'thescore': 'thescore',
  'prophetx': 'prophetx',
  'pinnacle': 'pinnacle',
  'wynnbet': 'wynnbet',
};

// Priority order for books (most popular first)
const BOOK_PRIORITY: string[] = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'fanatics',
  'betrivers',
  'hard-rock',
  'betparx',
  'bally-bet',
  'espn',
  'thescore',
  'prophetx',
  'pinnacle',
];

// Default SGP-supporting books
const DEFAULT_SGP_BOOKS = [
  'draftkings',
  'fanduel',
  'betmgm',
  'betrivers',
  'caesars',
  'fanatics',
  'hard-rock',
  'betparx',
  'bally-bet',
  'thescore',
  'prophetx',
];

function getOddsBlazeBookId(bookId: string): string {
  return ODDSBLAZE_BOOK_ID_MAP[bookId] || bookId;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract SGP tokens for a specific book from legs
 */
function extractTokensForBook(legs: SgpLeg[], bookId: string): string[] {
  return legs
    .map(leg => leg.sgp_tokens[bookId])
    .filter((token): token is string => !!token);
}

/**
 * Get books that have tokens for all legs
 */
function getBooksWithFullSupport(legs: SgpLeg[], allowedBooks: string[]): string[] {
  return allowedBooks.filter(bookId => {
    const tokens = extractTokensForBook(legs, bookId);
    return tokens.length === legs.length;
  });
}

/**
 * Fetch SGP odds from OddsBlaze for a single book
 */
async function fetchBookOdds(
  bookId: string,
  sgpTokens: string[]
): Promise<SgpBookOdds> {
  if (!ODDSBLAZE_API_KEY) {
    return { error: "API key not configured" };
  }

  if (sgpTokens.length < 2) {
    return { error: "Not enough legs" };
  }

  try {
    const oddsBlazeBookId = getOddsBlazeBookId(bookId);
    const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sgpTokens),
    });

    if (!response.ok) {
      return { error: `API error: ${response.status}` };
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return { error: data.error || data.message };
    }

    if (!data.price) {
      return { error: "No price available" };
    }

    return {
      price: data.price,
      links: data.links,
      limits: data.limits,
    };
  } catch (error) {
    console.error(`[SGP SSE] Fetch error for ${bookId}:`, error);
    return { error: "Failed to fetch" };
  }
}

/**
 * Sort books by priority
 */
function sortByPriority(books: string[]): string[] {
  return [...books].sort((a, b) => {
    const aIdx = BOOK_PRIORITY.indexOf(a);
    const bIdx = BOOK_PRIORITY.indexOf(b);
    // If not in priority list, put at end
    const aScore = aIdx === -1 ? 999 : aIdx;
    const bScore = bIdx === -1 ? 999 : bIdx;
    return aScore - bScore;
  });
}

// =============================================================================
// SSE HANDLER
// =============================================================================

/**
 * POST /api/sse/sgp-quote
 * 
 * Stream SGP odds quotes as they arrive from OddsBlaze.
 * 
 * Request body:
 * {
 *   legs: SgpLeg[],
 *   sportsbooks?: string[],
 *   prefetch?: boolean
 * }
 * 
 * SSE Events:
 * - hello: { legs_hash, books_pending, from_cache? }
 * - quote: { book_id, price?, links?, limits?, error? }
 * - done: { completed, failed, from_cache }
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request
    const body: SgpQuoteRequest = await req.json();
    const { legs, sportsbooks, prefetch = false } = body;

    // Validate
    if (!legs || legs.length < 2) {
      return new Response(
        JSON.stringify({ error: "At least 2 legs required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Compute legs hash
    const legsHash = computeLegsHash(legs);

    // Determine which books to fetch
    const allowedBooks = sportsbooks?.length ? sportsbooks : DEFAULT_SGP_BOOKS;
    const booksWithSupport = getBooksWithFullSupport(legs, allowedBooks);
    
    if (booksWithSupport.length === 0) {
      return new Response(
        JSON.stringify({ error: "No books support all legs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sort by priority
    const booksPending = sortByPriority(booksWithSupport);

    // Check cache first
    const cached = await getCachedQuotes(legsHash);
    
    // If cache hit and not stale, return immediately (non-streaming)
    if (cached && !isCacheStale(cached)) {
      return new Response(
        JSON.stringify({
          legs_hash: legsHash,
          quotes: cached.quotes,
          from_cache: true,
          cache_age_ms: Date.now() - cached.cached_at,
        }),
        { 
          status: 200, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // For prefetch requests, we can return early and fetch in background
    // But for now, let's still stream so the cache gets populated

    // Setup SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Safe write helper
    const safeWrite = async (data: string) => {
      try {
        await writer.write(encoder.encode(data));
      } catch {
        throw new Error("closed");
      }
    };

    // Send SSE event
    const sendEvent = async (event: string, data: object) => {
      await safeWrite(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Start streaming
    const stream = async () => {
      let pingInterval: NodeJS.Timeout | null = null;
      
      try {
        // Send hello event with cached data if available (stale)
        const helloData: {
          legs_hash: string;
          books_pending: string[];
          stale_cache?: Record<string, SgpBookOdds>;
        } = {
          legs_hash: legsHash,
          books_pending: booksPending,
        };
        
        if (cached) {
          helloData.stale_cache = cached.quotes;
        }
        
        await sendEvent("hello", helloData);

        // Setup ping to keep connection alive
        pingInterval = setInterval(async () => {
          try {
            await safeWrite(`: ping\n\n`);
          } catch {
            if (pingInterval) clearInterval(pingInterval);
          }
        }, PING_INTERVAL_MS);

        // Track results
        const results: Record<string, SgpBookOdds> = {};
        const completed: string[] = [];
        const failed: string[] = [];
        let timedOut = false;

        // Create abort controller for time budget
        const budgetController = new AbortController();
        const budgetTimeout = setTimeout(() => {
          timedOut = true;
          budgetController.abort();
        }, TIME_BUDGET_MS);

        // Fetch all books in parallel, streaming results as they arrive
        const fetchPromises = booksPending.map(async (bookId) => {
          const tokens = extractTokensForBook(legs, bookId);
          
          try {
            const result = await fetchBookOdds(bookId, tokens);
            
            if (budgetController.signal.aborted) {
              // Time budget exceeded, but we got a result - still record it
            }
            
            results[bookId] = result;
            
            if (result.error) {
              failed.push(bookId);
            } else {
              completed.push(bookId);
            }
            
            // Stream this result immediately
            if (!timedOut) {
              await sendEvent("quote", { book_id: bookId, ...result });
            }
          } catch (error) {
            results[bookId] = { error: "Request failed" };
            failed.push(bookId);
            
            if (!timedOut) {
              await sendEvent("quote", { book_id: bookId, error: "Request failed" });
            }
          }
        });

        // Wait for all fetches or time budget, whichever comes first
        await Promise.race([
          Promise.allSettled(fetchPromises),
          new Promise(resolve => setTimeout(resolve, TIME_BUDGET_MS + 100)),
        ]);

        clearTimeout(budgetTimeout);

        // Determine pending books (didn't complete in time)
        const pending = booksPending.filter(
          bookId => !completed.includes(bookId) && !failed.includes(bookId)
        );

        // Send done event
        await sendEvent("done", {
          completed,
          failed,
          pending,
          from_cache: false,
          timed_out: timedOut,
        });

        // Cache the results (include partial results)
        if (Object.keys(results).length > 0) {
          // Merge with stale cache if we have one
          const mergedResults = cached ? { ...cached.quotes, ...results } : results;
          await setCachedQuotes(legsHash, mergedResults);
        }

      } catch (error) {
        console.error("[SGP SSE] Stream error:", error);
      } finally {
        if (pingInterval) clearInterval(pingInterval);
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    };

    // Handle abort
    const onAbort = () => {
      try {
        writer.close();
      } catch {
        // Already closed
      }
    };

    if (req.signal.aborted) {
      onAbort();
    } else {
      req.signal.addEventListener("abort", onAbort, { once: true });
    }

    // Start streaming in background
    stream();

    // Return SSE response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[SGP SSE] Request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
