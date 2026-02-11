/**
 * Refresh Odds API - Fetch live odds for saved favorites
 * 
 * POST /api/v2/favorites/refresh-odds
 * 
 * Request body:
 * {
 *   favorites: Array<{
 *     id: string;
 *     odds_key: string;
 *     player_name: string;
 *     line: number;
 *     side: string;
 *   }>
 * }
 * 
 * Returns live odds for each favorite with all book prices
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createClient } from "@/libs/supabase/server";
import { SSEBookSelections, SSESelection, normalizePlayerName } from "@/lib/odds/types";

interface FavoriteInput {
  id: string;
  odds_key: string;
  player_name: string;
  line: number | null;
  side: string;
}

interface BookOdds {
  book: string;
  price: number;
  decimal: number;
  link: string | null;
  sgp: string | null;
}

interface RefreshedOdds {
  favorite_id: string;
  odds_key: string;
  current_best_price: number | null;
  current_best_book: string | null;
  current_best_link: string | null;
  current_sgp: string | null;
  all_books: BookOdds[];
  is_available: boolean;
  line: number | null;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const favorites: FavoriteInput[] = body.favorites || [];

    if (!favorites.length) {
      return NextResponse.json({ refreshed: [] });
    }

    // Group favorites by odds_key (market) to batch Redis calls
    const byOddsKey = new Map<string, FavoriteInput[]>();
    for (const fav of favorites) {
      if (!fav.odds_key) continue;
      const existing = byOddsKey.get(fav.odds_key) || [];
      existing.push(fav);
      byOddsKey.set(fav.odds_key, existing);
    }

    const results: RefreshedOdds[] = [];

    // Process each unique odds_key
    for (const [oddsKey, favs] of byOddsKey) {
      // Get all book keys for this market
      const bookPattern = `${oddsKey}:*`;
      const bookKeys = await scanKeys(bookPattern);

      if (bookKeys.length === 0) {
        // No odds available - mark all as unavailable
        for (const fav of favs) {
          results.push({
            favorite_id: fav.id,
            odds_key: oddsKey,
            current_best_price: null,
            current_best_book: null,
            current_best_link: null,
            current_sgp: null,
            all_books: [],
            is_available: false,
            line: fav.line,
          });
        }
        continue;
      }

      // Fetch all book data
      const bookDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...bookKeys);
      
      // Build book → selections map
      const bookSelections: Record<string, SSEBookSelections> = {};
      bookKeys.forEach((key, i) => {
        const book = key.split(":").pop()!;
        const data = bookDataRaw[i];
        if (data) {
          bookSelections[book] = typeof data === "string" ? JSON.parse(data) : data;
        }
      });

      // For each favorite, find matching selections
      for (const fav of favs) {
        const normalizedPlayer = normalizePlayerName(fav.player_name || "");
        const matchingBooks: BookOdds[] = [];

        for (const [book, selections] of Object.entries(bookSelections)) {
          for (const [, sel] of Object.entries(selections) as [string, SSESelection][]) {
            // Match by player name
            const selPlayerNormalized = normalizePlayerName(sel.player);
            if (!selPlayerNormalized.includes(normalizedPlayer) && !normalizedPlayer.includes(selPlayerNormalized)) {
              continue;
            }

            // Match by line (if specified)
            if (fav.line !== null && sel.line !== fav.line) {
              continue;
            }

            // Match by side
            if (sel.side !== fav.side) {
              continue;
            }

            // Skip locked selections
            if (sel.locked) continue;

            matchingBooks.push({
              book,
              price: parseInt(sel.price.replace("+", ""), 10),
              decimal: sel.price_decimal,
              link: sel.link || null,
              sgp: sel.sgp || null,
            });
          }
        }

        // Sort by best price (highest for positive, lowest magnitude for negative)
        matchingBooks.sort((a, b) => {
          // Both positive: higher is better
          if (a.price >= 0 && b.price >= 0) return b.price - a.price;
          // Both negative: higher (closer to 0) is better
          if (a.price < 0 && b.price < 0) return b.price - a.price;
          // Mixed: positive is better than negative
          return b.price - a.price;
        });

        const best = matchingBooks[0];

        results.push({
          favorite_id: fav.id,
          odds_key: oddsKey,
          current_best_price: best?.price ?? null,
          current_best_book: best?.book ?? null,
          current_best_link: best?.link ?? null,
          current_sgp: best?.sgp ?? null,
          all_books: matchingBooks,
          is_available: matchingBooks.length > 0,
          line: fav.line,
        });
      }
    }

    return NextResponse.json({
      refreshed: results,
      count: results.length,
      available: results.filter(r => r.is_available).length,
    });
  } catch (error) {
    console.error("[/api/v2/favorites/refresh-odds] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Scan Redis keys with pattern
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
