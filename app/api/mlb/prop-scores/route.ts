import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

// ── Constants ────────────────────────────────────────────────────────────────

const BETTABLE_BOOKS = [
  "draftkings", "fanduel", "betmgm", "caesars", "bet365",
  "fanatics", "hard-rock", "fliff", "betrivers", "espnbet",
  "betparx", "bally-bet", "thescore", "superbook",
] as const;

const SHARP_BOOKS = ["pinnacle", "novig", "prophetx"] as const;

const ALL_BOOKS = [...BETTABLE_BOOKS, ...SHARP_BOOKS];

// Prop scoring market → Redis odds market key
const MARKET_TO_REDIS: Record<string, string> = {
  hr: "player_home_runs",
  hits: "player_hits",
  tb: "player_total_bases",
  rbi: "player_rbis",
  sb: "player_stolen_bases",
  pitcher_k: "player_strikeouts",
  pitcher_h: "player_hits_allowed",
  pitcher_er: "player_earned_runs",
  pitcher_outs: "player_outs",
  pitcher_outs_recorded: "player_outs",
  h_r_rbi: "player_hits__runs__rbis",
  // fantasy: no odds — intentionally omitted
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function isValidDateParam(dateStr: string | null | undefined): dateStr is string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getSafeDateParam(dateStr: string | null | undefined): string {
  return isValidDateParam(dateStr) ? dateStr : getETDate();
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getAvailableGameDates(sb: ReturnType<typeof createServerSupabaseClient>, targetDate: string): Promise<string[]> {
  const from = addDays(targetDate, -14);
  const to = addDays(targetDate, 14);
  const { data, error } = await sb
    .from("mlb_games")
    .select("game_date")
    .gte("game_date", from)
    .lte("game_date", to)
    .order("game_date", { ascending: true });

  if (error) {
    console.warn("[Prop Scores API] Failed to fetch available game dates:", error.message);
    return [targetDate];
  }

  const dates = Array.from(new Set((data ?? []).map((r: any) => r.game_date as string))).sort();
  return dates.length > 0 ? dates : [targetDate];
}

/** Normalize player name to Redis selection key format */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

function americanToImplied(american: number): number {
  const dec = americanToDecimal(american);
  return dec <= 1 ? 1 : 1 / dec;
}

function getSelectionLinks(selection: {
  link?: string | null;
  mobile_link?: string | null;
  links?: {
    desktop?: string | null;
    mobile?: string | null;
  } | null;
} | null | undefined): { desktop: string | null; mobile: string | null } {
  return {
    desktop: selection?.link ?? selection?.links?.desktop ?? null,
    mobile: selection?.mobile_link ?? selection?.links?.mobile ?? null,
  };
}

function extractOddsPlayerIds(value: unknown): string[] {
  if (!value) return [];

  const normalizeIds = (ids: unknown[]): string[] =>
    Array.from(
      new Set(
        ids
          .map((id) => String(id).trim().toLowerCase())
          .filter(Boolean)
      )
    );

  if (Array.isArray(value)) {
    return normalizeIds(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeIds(parsed);
    } catch {
      // Fall through to handle plain or Postgres-array strings.
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return normalizeIds(
        trimmed
          .slice(1, -1)
          .split(",")
          .map((part) => part.replace(/^"(.*)"$/, "$1"))
      );
    }

    if (trimmed.includes(",")) {
      return normalizeIds(trimmed.split(","));
    }

    return normalizeIds([trimmed]);
  }

  return [];
}

// ── Types ────────────────────────────────────────────────────────────────────

interface OddsValue {
  [selKey: string]: {
    price: string;
    price_decimal: number;
    link?: string;
    mobile_link?: string;
    links?: {
      desktop?: string;
      mobile?: string;
    };
    sgp?: string | null;
    player?: string;
    player_id?: string;
    odd_id?: string;
  };
}

interface LiveOdds {
  line: number;
  best_odds: number;
  best_odds_decimal: number;
  best_odds_book: string;
  best_odds_mobile_link: string | null;
  best_odds_link: string | null;
  implied_prob: number; // avg implied across consensus-line books
  all_book_odds: Record<string, { line: number; over: number; under: number | null; link: string | null; mobile_link: string | null; sgp: string | null; odd_id: string | null }>;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const marketParam = url.searchParams.get("market"); // optional: filter to one market
    const targetDate = getSafeDateParam(dateParam);

    const sb = createServerSupabaseClient();
    const availableDatesPromise = getAvailableGameDates(sb, targetDate);

    // ── 1. Fetch prop scores from Supabase ─────────────────────────────
    let query = sb
      .from("mlb_prop_scores")
      .select("*")
      .eq("game_date", targetDate)
      .order("composite_score", { ascending: false });

    if (marketParam && MARKET_TO_REDIS[marketParam]) {
      query = query.eq("market", marketParam);
    }

    const { data: rawScores, error } = await query;

    if (error) {
      console.error("[Prop Scores API] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch prop scores", details: error.message }, { status: 500 });
    }

    const scores = (rawScores ?? []) as any[];
    if (scores.length === 0) {
      const availableDates = await availableDatesPromise;
      return NextResponse.json({
        scores: [],
        lineups: {},
        meta: { date: targetDate, totalScores: 0, markets: [], oddsMatched: 0, availableDates },
      });
    }

    // ── 2. Map game_id → odds_game_id for Redis lookups ────────────────
    const gameIds = Array.from(new Set(scores.map((s: any) => s.game_id)));

    const { data: gameRows } = await sb
      .from("mlb_games")
      .select("game_id, odds_game_id, home_id, away_id, venue_name, game_datetime")
      .in("game_id", gameIds);

    const gameMap = new Map<number, any>();
    const gameToEvent = new Map<number, string>();
    for (const g of gameRows ?? []) {
      gameMap.set(g.game_id, g);
      if (g.odds_game_id) gameToEvent.set(g.game_id, g.odds_game_id);
    }

    const playerIds = Array.from(new Set(scores.map((s: any) => s.player_id).filter(Boolean)));
    const { data: playerRows } = await sb
      .from("mlb_players_hr")
      .select("mlb_player_id, odds_player_id, pos_abbr, position")
      .in("mlb_player_id", playerIds);

    const playerMetaMap = new Map<number, any>();
    for (const row of playerRows ?? []) {
      playerMetaMap.set(row.mlb_player_id, row);
    }

    // ── 3. Fetch lineups for all games ─────────────────────────────────
    const { data: lineupRows } = await sb
      .from("mlb_daily_lineups")
      .select("game_id, team_id, side, batting_order, player_id, player_name, position, bats")
      .in("game_id", gameIds)
      .gt("batting_order", 0)
      .order("batting_order", { ascending: true });

    // Group lineups by game_id → side
    const lineups: Record<number, { home: any[]; away: any[] }> = {};
    for (const row of lineupRows ?? []) {
      if (!lineups[row.game_id]) lineups[row.game_id] = { home: [], away: [] };
      lineups[row.game_id][row.side as "home" | "away"].push(row);
    }

    // ── 4. Fetch live odds from Redis ──────────────────────────────────
    const uniqueEventIds = Array.from(new Set(gameToEvent.values()));
    const marketsInScores = Array.from(new Set(scores.map((s: any) => s.market as string)));

    // Build Redis keys: odds:mlb:{eventId}:{redisMarket}:{book}
    type KeyMeta = { eventId: string; book: string; redisMarket: string; market: string };
    const keyMeta: KeyMeta[] = [];
    const redisKeys: string[] = [];

    for (const eid of uniqueEventIds) {
      for (const market of marketsInScores) {
        const redisMarket = MARKET_TO_REDIS[market];
        if (!redisMarket) continue;
        for (const book of ALL_BOOKS) {
          const key = `odds:mlb:${eid}:${redisMarket}:${book}`;
          redisKeys.push(key);
          keyMeta.push({ eventId: eid, book, redisMarket, market });
        }
      }
    }

    // Batch fetch from Redis (chunk to avoid oversized mget)
    const CHUNK = 100;
    let redisValues: (OddsValue | null)[] = [];
    if (redisKeys.length > 0) {
      for (let i = 0; i < redisKeys.length; i += CHUNK) {
        const chunk = redisKeys.slice(i, i + CHUNK);
        try {
          const vals = await redis.mget<(OddsValue | null)[]>(...chunk);
          redisValues.push(...vals);
        } catch (err) {
          console.warn(`[Prop Scores] Redis mget failed for chunk ${i}:`, err);
          redisValues.push(...chunk.map(() => null));
        }
      }
    }

    // Index: eventId → market → book → parsed odds
    const oddsIndex = new Map<string, Map<string, Map<string, Record<string, any>>>>();
    for (let i = 0; i < redisValues.length; i++) {
      const raw = redisValues[i];
      if (!raw) continue;
      const { eventId, book, market } = keyMeta[i];
      try {
        const parsed: Record<string, any> = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!oddsIndex.has(eventId)) oddsIndex.set(eventId, new Map());
        const eventMap = oddsIndex.get(eventId)!;
        if (!eventMap.has(market)) eventMap.set(market, new Map());
        eventMap.get(market)!.set(book, parsed);
      } catch {
        // skip unparseable
      }
    }

    const nonNull = redisValues.filter(Boolean).length;
    console.log(
      `[Prop Scores] Redis: ${uniqueEventIds.length} events × ${marketsInScores.length} markets, ${nonNull}/${redisKeys.length} keys hit`
    );
    // Debug: log first few keys and whether they hit
    if (nonNull === 0 && redisKeys.length > 0) {
      console.log(`[Prop Scores] DEBUG: first 3 keys tried:`, redisKeys.slice(0, 3));
      console.log(`[Prop Scores] DEBUG: first 3 values:`, redisValues.slice(0, 3));
    }

    // ── 5. Match each score to live odds ───────────────────────────────
    let oddsMatched = 0;

    const enrichedScores = scores.map((score: any) => {
      const eventId = gameToEvent.get(score.game_id);
      const playerNorm = normalizePlayerName(score.player_name || "");
      const oddsPlayerIds = [
        ...extractOddsPlayerIds(score.odds_player_ids),
        ...extractOddsPlayerIds(score.odds_player_id),
      ];
      const market = score.market as string;

      // For pitchers, the Redis selection key format differs:
      // Batter props: "player_name|over|0.5"
      // Pitcher props: "player_name|over|4.5" (line varies)
      // We need to scan all selections matching the player

      const liveOdds = getLiveOdds(eventId, market, playerNorm, oddsPlayerIds, oddsIndex);
      if (liveOdds) oddsMatched++;

      const gameInfo = gameMap.get(score.game_id);
      const playerMeta = playerMetaMap.get(score.player_id);

      return {
        ...score,
        odds_player_id: playerMeta?.odds_player_id ?? null,
        player_position: playerMeta?.pos_abbr ?? playerMeta?.position ?? null,
        // Live odds override pre-computed
        line: liveOdds?.line ?? score.line,
        best_odds: liveOdds?.best_odds ?? score.best_odds,
        best_odds_book: liveOdds?.best_odds_book ?? score.best_odds_book,
        best_odds_decimal: liveOdds?.best_odds_decimal ?? score.best_odds_decimal,
        best_odds_link: liveOdds?.best_odds_link ?? score.best_odds_link ?? null,
        best_odds_mobile_link: liveOdds?.best_odds_mobile_link ?? null,
        implied_prob: liveOdds?.implied_prob ?? score.implied_prob,
        odds_snapshot: liveOdds?.all_book_odds ?? score.odds_snapshot ?? {},
        // Edge: model_prob vs live odds implied prob
        edge_pct: score.model_prob != null && liveOdds?.implied_prob != null && liveOdds.implied_prob > 0
          ? Math.round(((score.model_prob - liveOdds.implied_prob) / liveOdds.implied_prob) * 10000) / 100
          : score.edge_pct,
        // Game context
        game_time: gameInfo?.game_datetime ?? null,
        venue_name: gameInfo?.venue_name ?? null,
      };
    });

    // ── 6. Available dates (ascending — DateNav expects oldest first) ──
    const availableDates = await availableDatesPromise;

    // ── 7. Response ────────────────────────────────────────────────────
    return NextResponse.json({
      scores: enrichedScores,
      lineups,
      meta: {
        date: targetDate,
        totalScores: enrichedScores.length,
        markets: marketsInScores,
        oddsMatched,
        availableDates,
      },
    });
  } catch (err: any) {
    console.error("[Prop Scores API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Live odds matching ───────────────────────────────────────────────────────

function getLiveOdds(
  eventId: string | undefined,
  market: string,
  playerNorm: string,
  oddsPlayerIds: string[],
  oddsIndex: Map<string, Map<string, Map<string, Record<string, any>>>>
): LiveOdds | null {
  if (!eventId) return null;
  const eventMap = oddsIndex.get(eventId);
  if (!eventMap) return null;
  const marketBooks = eventMap.get(market);
  if (!marketBooks) return null;

  // Collect all odds entries for this player across books
  interface BookOdds {
    book: string;
    line: number;
    over_price: number;
    under_price: number | null;
    link: string | null;
    mobile_link: string | null;
    sgp: string | null;
    odd_id: string | null;
  }

  const entries: BookOdds[] = [];

  const marketBooksEntries = Array.from(marketBooks.entries());
  for (const [book, bookData] of marketBooksEntries) {
    // Scan all selection keys for this player
    for (const [selKey, sel] of Object.entries(bookData)) {
      // Selection key format: "player_name|over|0.5" or "game_total|over|0.5" (for pitcher props)
      const parts = selKey.split("|");
      if (parts.length < 3) continue;

      const selPlayer = parts[0];
      const direction = parts[1]; // "over" or "under"
      const line = parseFloat(parts[2]);
      const selectionPlayerId = typeof (sel as any).player_id === "string"
        ? (sel as any).player_id.trim().toLowerCase()
        : null;
      const matchesPlayerId =
        oddsPlayerIds.length > 0 &&
        selectionPlayerId != null &&
        oddsPlayerIds.includes(selectionPlayerId);
      const matchesPlayerName = selPlayer === playerNorm;

      if ((!matchesPlayerId && !matchesPlayerName) || direction !== "over") continue;

      const price = parseInt((sel as any).price, 10);
      if (isNaN(price)) continue;

      // Find matching under price
      const underKey = `${selPlayer}|under|${parts[2]}`;
      const underSel = bookData[underKey];
      const underPrice = underSel ? parseInt((underSel as any).price, 10) : null;
      const selectionLinks = getSelectionLinks(sel as any);

      entries.push({
        book,
        line,
        over_price: price,
        under_price: isNaN(underPrice as number) ? null : underPrice,
        link: selectionLinks.desktop,
        mobile_link: selectionLinks.mobile,
        sgp: typeof (sel as any).sgp === "string" ? (sel as any).sgp : null,
        odd_id: typeof (sel as any).odd_id === "string" ? (sel as any).odd_id : null,
      });
    }
  }

  if (entries.length === 0) return null;

  // Determine consensus line (most common line across books)
  const lineCounts: Record<number, number> = {};
  for (const e of entries) {
    lineCounts[e.line] = (lineCounts[e.line] || 0) + 1;
  }
  const sortedLines = Object.entries(lineCounts).sort((a, b) => b[1] - a[1]);
  const consensusLine = parseFloat(sortedLines[0][0]);

  // Filter to consensus line only for best odds
  const consensusEntries = entries.filter((e) => e.line === consensusLine);

  // Best odds at consensus line (bettable books only)
  let bestEntry: BookOdds | null = null;
  let bestDecimal = 0;
  const bettableSet = new Set<string>(BETTABLE_BOOKS as unknown as string[]);

  for (const e of consensusEntries) {
    if (!bettableSet.has(e.book)) continue;
    const dec = americanToDecimal(e.over_price);
    if (dec > bestDecimal) {
      bestDecimal = dec;
      bestEntry = e;
    }
  }

  // Fallback: if no bettable books have the consensus line, use any book
  if (!bestEntry) {
    for (const e of consensusEntries) {
      const dec = americanToDecimal(e.over_price);
      if (dec > bestDecimal) {
        bestDecimal = dec;
        bestEntry = e;
      }
    }
  }

  if (!bestEntry) return null;

  // Avg implied prob at consensus line
  const consensusOverPrices = consensusEntries.map((e) => e.over_price);
  const avgImplied =
    consensusOverPrices.reduce((s, p) => s + americanToImplied(p), 0) / consensusOverPrices.length;

  // Build all-book snapshot — store every book+line combo so frontend can filter by any line
  // Key format: "book" for consensus line, "book__2.5" for alternate lines
  const allBookOdds: Record<string, { line: number; over: number; under: number | null; link: string | null; mobile_link: string | null; sgp: string | null; odd_id: string | null }> =
    {};
  for (const e of entries) {
    if (e.line === consensusLine) {
      // Consensus line gets the clean book key (primary entry)
      allBookOdds[e.book] = {
        line: e.line,
        over: e.over_price,
        under: e.under_price,
        link: e.link,
        mobile_link: e.mobile_link,
        sgp: e.sgp,
        odd_id: e.odd_id,
      };
    }
    // Always store the line-specific key for alt-line lookups
    const lineKey = `${e.book}__${e.line}`;
    allBookOdds[lineKey] = {
      line: e.line,
      over: e.over_price,
      under: e.under_price,
      link: e.link,
      mobile_link: e.mobile_link,
      sgp: e.sgp,
      odd_id: e.odd_id,
    };
  }

  return {
    line: consensusLine,
    best_odds: bestEntry.over_price,
    best_odds_decimal: bestDecimal,
    best_odds_book: bestEntry.book,
    best_odds_link: bestEntry.link,
    best_odds_mobile_link: bestEntry.mobile_link,
    implied_prob: avgImplied,
    all_book_odds: allBookOdds,
  };
}
