import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HRScorePlayer {
  player_id: number | null;
  player_name: string;
  team_abbr: string;
  hr_score: number;
  score_tier: string;
  // Sub-scores (0-100)
  batter_power_score: number;
  pitcher_vuln_score: number;
  park_factor_score: number;
  environment_score: number;
  matchup_context_score: number;
  // Matchup
  opp_pitcher_name: string | null;
  opp_pitcher_hand: string | null;
  bat_hand: string | null;
  venue_name: string | null;
  // Statcast
  barrel_pct: number | null;
  max_exit_velo: number | null;
  hard_hit_pct: number | null;
  iso: number | null;
  // Park & weather
  park_hr_factor: number | null;
  temperature_f: number | null;
  wind_label: string | null;
  env_boost: string | null;
  // Matchup context
  platoon_advantage: boolean | null;
  bvp_pa: number | null;
  bvp_hr: number | null;
  // Surge
  surge_direction: string | null;
  surge_barrel_pct_7d: number | null;
  surge_hr_7d: number | null;
  // Odds
  best_odds_american: string | null;
  best_odds_decimal: number | null;
  best_odds_book: string | null;
  best_odds_link: string | null;
  best_odds_mobile_link: string | null;
  // Model
  model_implied_prob: number | null;
  odds_implied_prob: number | null;
  edge_pct: number | null;
  // Extra
  all_book_odds: Record<string, any> | null;
  hr_streak: number | null;
  hr_last_3_games: number | null;
  game_date: string;
  game_id: number;
}

export interface HRScoreResponse {
  players: HRScorePlayer[];
  meta: {
    date: string;
    totalPlayers: number;
    availableDates: string[];
    oddsMatched: number;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

// Books to scan for HR odds (consumer/bettable books)
const BOOKS = [
  "draftkings", "fanduel", "betmgm", "caesars", "bet365",
  "fanatics", "hard-rock", "fliff", "betrivers", "espnbet",
  "betparx", "bally-bet", "thescore", "superbook",
] as const;

// Sharp books (for devig reference, not for "best odds" display)
const SHARP_BOOKS = ["pinnacle", "novig", "prophetx"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Normalize player name to Redis selection key format: "Aaron Judge" → "aaron_judge" */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s]/g, "")    // strip special chars
    .replace(/\s+/g, "_");           // spaces → underscores
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam || getETDate();

    const sb = createServerSupabaseClient();

    // ── 1. Fetch HR scores from Supabase ──────────────────────────────
    const { data, error } = await sb
      .from("mlb_hr_scores")
      .select("*")
      .eq("game_date", targetDate)
      .order("hr_score", { ascending: false });

    if (error) {
      console.error("[HR Scores API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch HR scores", details: error.message },
        { status: 500 }
      );
    }

    const rawPlayers = (data ?? []) as any[];
    if (rawPlayers.length === 0) {
      return NextResponse.json({
        players: [],
        meta: { date: targetDate, totalPlayers: 0, availableDates: [], oddsMatched: 0 },
      });
    }

    // ── 2. Get OddsBlaze event IDs from mlb_games ─────────────────────
    const gameIds = [...new Set(rawPlayers.map((p: any) => p.game_id).filter(Boolean))];
    const { data: gameRows } = await sb
      .from("mlb_games")
      .select("game_id, odds_game_id")
      .in("game_id", gameIds);

    // Map: MLB game_id → OddsBlaze UUID
    const gameToEvent = new Map<number, string>();
    for (const g of gameRows ?? []) {
      if (g.odds_game_id) gameToEvent.set(g.game_id, g.odds_game_id);
    }

    // ── 3. Fetch HR odds from Redis ───────────────────────────────────
    // Redis key format: odds:mlb:{oddsblaze_event_id}:player_home_runs:{book}
    // Value: flat object { "player_name|over|0.5": { price, price_decimal, link, ... }, ... }

    const uniqueEventIds = [...new Set(gameToEvent.values())];
    const allBooks = [...BOOKS, ...SHARP_BOOKS];

    // Build all Redis keys to fetch
    const redisKeys: string[] = [];
    const keyMeta: { eventId: string; book: string }[] = [];
    for (const eid of uniqueEventIds) {
      for (const book of allBooks) {
        const key = `odds:mlb:${eid}:player_home_runs:${book}`;
        redisKeys.push(key);
        keyMeta.push({ eventId: eid, book });
      }
    }

    // Batch fetch all odds data from Redis via mget
    // Each value is a large JSON object with all players for that event+book
    type OddsValue = Record<string, any> | string | null;
    let redisValues: OddsValue[] = [];
    if (redisKeys.length > 0) {
      try {
        // Chunk mget to avoid oversized requests (each value can be 100KB+)
        const CHUNK = 50;
        for (let i = 0; i < redisKeys.length; i += CHUNK) {
          const chunk = redisKeys.slice(i, i + CHUNK);
          const vals = await redis.mget<OddsValue[]>(...chunk);
          redisValues.push(...vals);
        }
      } catch (e) {
        console.error("[HR Scores] Redis mget error:", e);
      }
    }

    // Parse into: eventId → book → { playerSelKey: oddsObj }
    const oddsIndex = new Map<string, Map<string, Record<string, any>>>();
    for (let i = 0; i < redisValues.length; i++) {
      const raw = redisValues[i];
      if (!raw) continue;
      const { eventId, book } = keyMeta[i];
      try {
        const parsed: Record<string, any> = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!oddsIndex.has(eventId)) oddsIndex.set(eventId, new Map());
        oddsIndex.get(eventId)!.set(book, parsed);
      } catch {
        // skip unparseable
      }
    }

    console.log(
      `[HR Scores] Redis: ${uniqueEventIds.length} events, ${redisValues.filter(Boolean).length}/${redisKeys.length} keys with data`
    );

    // ── 4. Match players to odds ──────────────────────────────────────
    let oddsMatched = 0;

    const players: HRScorePlayer[] = rawPlayers.map((p: any) => {
      const eventId = gameToEvent.get(p.game_id);
      const playerNorm = normalizePlayerName(p.player_name || "");
      const selKey = `${playerNorm}|over|0.5`;

      let bestOdds: any = null;
      let bestBook = "";
      const allBookOdds: Record<string, any> = {};

      if (eventId && oddsIndex.has(eventId)) {
        const eventBooks = oddsIndex.get(eventId)!;

        for (const [book, bookData] of eventBooks) {
          const sel = bookData[selKey];
          if (!sel) continue;

          // Store for all_book_odds
          allBookOdds[book] = {
            price: sel.price,
            price_decimal: sel.price_decimal,
            link: sel.link,
            mobile_link: sel.mobile_link,
          };

          // Track best consumer odds (exclude sharp books)
          const isSharp = (SHARP_BOOKS as readonly string[]).includes(book);
          if (!isSharp && sel.price_decimal) {
            if (!bestOdds || sel.price_decimal > bestOdds.price_decimal) {
              bestOdds = sel;
              bestBook = book;
            }
          }
        }
      }

      const hasOdds = bestOdds != null;
      if (hasOdds) oddsMatched++;

      const oddsImpliedProb = bestOdds?.price_decimal
        ? (1 / bestOdds.price_decimal) * 100
        : null;

      // Model implied probability: hr_score maps to HR likelihood
      const modelImpliedProb = p.hr_score != null
        ? (p.hr_score / 100) * 3.5 // ~3.5% league avg HR rate
        : null;

      const edgePct =
        modelImpliedProb != null && oddsImpliedProb != null && oddsImpliedProb > 0
          ? ((modelImpliedProb - oddsImpliedProb) / oddsImpliedProb) * 100
          : null;

      return {
        ...p,
        best_odds_american: hasOdds ? bestOdds.price : p.best_odds_american ?? null,
        best_odds_decimal: hasOdds ? bestOdds.price_decimal : null,
        best_odds_book: hasOdds ? bestBook : p.best_odds_book ?? null,
        best_odds_link: hasOdds ? bestOdds.link : p.best_odds_link ?? null,
        best_odds_mobile_link: hasOdds ? bestOdds.mobile_link : p.best_odds_mobile_link ?? null,
        odds_implied_prob: oddsImpliedProb ?? p.odds_implied_prob ?? null,
        model_implied_prob: modelImpliedProb ?? p.model_implied_prob ?? null,
        edge_pct: edgePct ?? p.edge_pct ?? null,
        all_book_odds: Object.keys(allBookOdds).length > 0 ? allBookOdds : p.all_book_odds ?? null,
      } as HRScorePlayer;
    });

    // ── 5. Available dates ────────────────────────────────────────────
    const today = getETDate();
    const { data: dateRows } = await sb
      .from("mlb_hr_scores")
      .select("game_date")
      .gte("game_date", today)
      .order("game_date", { ascending: true });

    const availableDates = [
      ...new Set((dateRows ?? []).map((r: { game_date: string }) => r.game_date)),
    ] as string[];

    const response: HRScoreResponse = {
      players,
      meta: {
        date: targetDate,
        totalPlayers: players.length,
        availableDates,
        oddsMatched,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err: any) {
    console.error("[HR Scores API]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
