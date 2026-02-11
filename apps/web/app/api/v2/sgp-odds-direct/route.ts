import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

interface SgpDirectRequest {
  book_id: string;
  sgp_tokens: string[];
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

// Map our book IDs to OddsBlaze's expected subdomain IDs
// OddsBlaze uses specific subdomain formats that may differ from our IDs
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
  'hard-rock': 'hard-rock',      // OddsBlaze uses 'hard-rock' with hyphen
  'bally-bet': 'bally-bet',
  'thescore': 'thescore',
  'prophetx': 'prophetx',
  'pinnacle': 'pinnacle',
  'wynnbet': 'wynnbet',
};

// Convert our book ID to OddsBlaze's expected format
function getOddsBlazeBookId(bookId: string): string {
  // Use mapped ID if available, otherwise use as-is
  return ODDSBLAZE_BOOK_ID_MAP[bookId] || bookId;
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

    if (!ODDSBLAZE_API_KEY) {
      console.error("[SGP Direct API] ODDSBLAZE_API_KEY is not set");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // Call OddsBlaze API
    // URL format: https://{sportsbook_id}.sgp.oddsblaze.com/?key=YOUR_KEY
    const oddsBlazeBookId = getOddsBlazeBookId(book_id);
    const url = `https://${oddsBlazeBookId}.sgp.oddsblaze.com/?key=${ODDSBLAZE_API_KEY}`;
    
    console.log(`[SGP Direct API] Calling OddsBlaze for ${book_id} -> ${oddsBlazeBookId}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sgp_tokens),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SGP Direct API] OddsBlaze error for ${book_id}:`, response.status, errorText);
      
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: OddsBlazeResponse = await response.json();

    if (data.error || data.message) {
      return NextResponse.json({
        error: data.error || data.message,
      });
    }

    return NextResponse.json({
      price: data.price,
      links: data.links,
      limits: data.limits,
    });
  } catch (error) {
    console.error("[SGP Direct API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
