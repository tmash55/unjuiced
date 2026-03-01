import { NextRequest, NextResponse } from "next/server";
import { fetchSgpQuote } from "@/lib/sgp/quote-service";

// =============================================================================
// TYPES
// =============================================================================

interface SgpDirectRequest {
  book_id: string;
  sgp_tokens: string[];
}

// =============================================================================
// API HANDLER
// =============================================================================

/**
 * POST /api/v2/sgp-odds-direct
 * 
 * Fetch SGP odds directly from OddsBlaze without requiring a betslip.
 * Used by ParlayBuilder for real-time SGP odds display.
 * 
 * Request body:
 * {
 *   book_id: string,      // e.g., "draftkings"
 *   sgp_tokens: string[]  // Array of SGP tokens from books_snapshot
 * }
 * 
 * Response:
 * {
 *   price?: string,       // American odds e.g., "+2755"
 *   links?: { desktop, mobile },
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SgpDirectRequest = await request.json();
    const { book_id, sgp_tokens } = body;

    if (!book_id) {
      return NextResponse.json(
        { error: "book_id is required" },
        { status: 400 }
      );
    }

    if (!sgp_tokens || sgp_tokens.length < 2) {
      return NextResponse.json(
        { error: "At least 2 sgp_tokens are required" },
        { status: 400 }
      );
    }

    const quote = await fetchSgpQuote(book_id, sgp_tokens, {
      allowStaleOnRateLimit: true,
      allowStaleOnLockTimeout: true,
    });

    if (quote.odds.error) {
      const status = quote.rateLimited ? 429 : 200;
      return NextResponse.json({
        error: quote.odds.error,
        from_cache: quote.fromCache,
        stale: quote.stale,
        source: quote.source,
      }, { status });
    }

    return NextResponse.json({
      price: quote.odds.price,
      links: quote.odds.links,
      limits: quote.odds.limits,
      from_cache: quote.fromCache,
      stale: quote.stale,
      source: quote.source,
    });
  } catch (error) {
    console.error("[SGP Direct API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
