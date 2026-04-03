"use server";

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/mlb/batter-odds
 *
 * Fetches best available odds for batters in a specific game + market.
 *
 * Query params:
 *   gameId    - MLB game_id
 *   market    - e.g., player_home_runs, player_hits, player_total_bases
 *   line      - optional line filter (e.g., 0.5, 1.5, 2.5)
 *   side      - over (default) or under
 */

const BOOKS = [
  "draftkings", "fanduel", "betmgm", "caesars", "bet365",
  "betrivers", "fanatics", "espn", "fliff", "hard-rock",
  "thescore", "betparx", "wynnbet",
];
const SHARP_BOOKS = ["pinnacle", "circa", "novig", "prophetx"];

function normalizePlayer(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const gameId = sp.get("gameId");
    const market = sp.get("market") || "player_home_runs";
    const lineFilter = sp.get("line") ? parseFloat(sp.get("line")!) : null;
    const sideFilter = sp.get("side") || "over";

    if (!gameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Get odds_game_id from mlb_games
    const { data: gameRow } = await supabase
      .from("mlb_games")
      .select("odds_game_id")
      .eq("game_id", gameId)
      .single();

    if (!gameRow?.odds_game_id) {
      return NextResponse.json({ odds: {} });
    }

    const eventId = gameRow.odds_game_id;
    const allBooks = [...BOOKS, ...SHARP_BOOKS];

    // Batch fetch from Redis
    const redisKeys = allBooks.map((book) => `odds:mlb:${eventId}:${market}:${book}`);

    type OddsValue = Record<string, any> | string | null;
    let redisValues: OddsValue[] = [];

    const CHUNK = 50;
    for (let i = 0; i < redisKeys.length; i += CHUNK) {
      const chunk = redisKeys.slice(i, i + CHUNK);
      try {
        const vals = await redis.mget<OddsValue[]>(...chunk);
        redisValues.push(...vals);
      } catch (err) {
        console.warn(`[batter-odds] Redis mget failed for chunk ${i}:`, err);
        redisValues.push(...chunk.map(() => null));
      }
    }

    // Parse: book → { selectionKey: oddsObj }
    const bookData = new Map<string, Record<string, any>>();
    for (let i = 0; i < redisValues.length; i++) {
      const raw = redisValues[i];
      if (!raw) continue;
      try {
        const parsed: Record<string, any> = typeof raw === "string" ? JSON.parse(raw) : raw;
        bookData.set(allBooks[i], parsed);
      } catch { /* skip */ }
    }

    // Build player → best odds map + collect sharp book odds for EV calc
    const oppositeSide = sideFilter === "over" ? "under" : "over";

    // First pass: collect all odds per player per side
    const playerOverOdds: Record<string, { book: string; price: number; link: string | null; mobile_link: string | null }[]> = {};
    const playerUnderOdds: Record<string, { book: string; price: number }[]> = {};

    for (const [book, selections] of bookData) {
      for (const [, sel] of Object.entries(selections)) {
        if (!sel || typeof sel !== "object") continue;

        const selLine = sel.line;
        if (lineFilter !== null && selLine !== lineFilter) continue;

        const playerName = sel.player || "";
        if (!playerName) continue;

        const normalizedName = normalizePlayer(playerName);
        const price = typeof sel.price === "string" ? parseInt(sel.price.replace("+", ""), 10) : sel.price;
        if (price == null || isNaN(price)) continue;

        const selSide = sel.side || "";
        if (selSide === sideFilter) {
          if (!playerOverOdds[normalizedName]) playerOverOdds[normalizedName] = [];
          playerOverOdds[normalizedName].push({ book, price, link: sel.link || null, mobile_link: sel.mobile_link || null });
        } else if (selSide === oppositeSide) {
          if (!playerUnderOdds[normalizedName]) playerUnderOdds[normalizedName] = [];
          playerUnderOdds[normalizedName].push({ book, price });
        }
      }
    }

    // Second pass: build response with EV calculation
    const SHARP_REF = ["pinnacle", "circa"]; // priority order

    function americanToDecimal(am: number): number {
      return am >= 0 ? (am / 100) + 1 : (100 / Math.abs(am)) + 1;
    }
    function americanToImplied(am: number): number {
      return am >= 0 ? 100 / (am + 100) : Math.abs(am) / (Math.abs(am) + 100);
    }

    const playerOdds: Record<string, {
      best_price: number;
      best_book: string;
      best_link: string | null;
      best_mobile_link: string | null;
      line: number;
      side: string;
      ev_pct: number | null;
      fair_american: string | null;
      sharp_book: string | null;
      all_books: { book: string; price: number; link: string | null; mobile_link: string | null }[];
    }> = {};

    for (const [player, books] of Object.entries(playerOverOdds)) {
      const sorted = [...books].sort((a, b) => b.price - a.price);
      const best = sorted[0];
      if (!best) continue;

      // Find sharp book over/under for devig
      let evPct: number | null = null;
      let fairAmerican: string | null = null;
      let sharpBook: string | null = null;

      const underBooks = playerUnderOdds[player] || [];
      for (const sharpId of SHARP_REF) {
        const sharpOver = books.find((b) => b.book === sharpId);
        const sharpUnder = underBooks.find((b) => b.book === sharpId);
        if (sharpOver && sharpUnder) {
          // Power devig: remove vig from both sides
          const overImpl = americanToImplied(sharpOver.price);
          const underImpl = americanToImplied(sharpUnder.price);
          const totalImpl = overImpl + underImpl;
          if (totalImpl > 0) {
            const fairProb = overImpl / totalImpl;
            const fairDec = 1 / fairProb;
            const fairAm = fairDec >= 2 ? Math.round((fairDec - 1) * 100) : Math.round(-100 / (fairDec - 1));
            fairAmerican = fairAm >= 0 ? `+${fairAm}` : `${fairAm}`;

            const bestDec = americanToDecimal(best.price);
            evPct = Math.round(((bestDec * fairProb - 1) * 100) * 10) / 10;
            sharpBook = sharpId;
          }
          break;
        }
      }

      playerOdds[player] = {
        best_price: best.price,
        best_book: best.book,
        best_link: best.link,
        best_mobile_link: best.mobile_link,
        line: lineFilter ?? 0.5,
        side: sideFilter,
        ev_pct: evPct,
        fair_american: fairAmerican,
        sharp_book: sharpBook,
        all_books: sorted,
      };
    }

    return NextResponse.json(
      { odds: playerOdds, market, line: lineFilter, side: sideFilter },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("[batter-odds] Error:", err);
    return NextResponse.json({ error: "Failed to fetch odds" }, { status: 500 });
  }
}
