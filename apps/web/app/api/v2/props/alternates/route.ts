export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { SSESelection, SSEBookSelections } from "@/lib/odds/types";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";

const commandEndpoint = getRedisCommandEndpoint();
const redis = new Redis({
  url: commandEndpoint.url || process.env.UPSTASH_REDIS_REST_URL!,
  token: commandEndpoint.token || process.env.UPSTASH_REDIS_REST_TOKEN!,
});
let invalidOddsPayloadWarnCount = 0;
const MAX_INVALID_ODDS_PAYLOAD_WARNINGS = 8;

function parseBookSelectionsValue(
  value: SSEBookSelections | string | null,
  key: string
): SSEBookSelections | null {
  if (!value) return null;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || trimmed.startsWith("<")) {
    if (invalidOddsPayloadWarnCount < MAX_INVALID_ODDS_PAYLOAD_WARNINGS) {
      invalidOddsPayloadWarnCount += 1;
      console.warn(`[v2/props/alternates] Skipping non-JSON odds payload for key: ${key}`);
    }
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as SSEBookSelections;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    if (invalidOddsPayloadWarnCount < MAX_INVALID_ODDS_PAYLOAD_WARNINGS) {
      invalidOddsPayloadWarnCount += 1;
      console.warn(`[v2/props/alternates] Skipping invalid JSON odds payload for key: ${key}`);
    }
    return null;
  }
}

const VALID_SPORTS = new Set([
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaabaseball",
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

const SCAN_COUNT = 500;
const MAX_SCAN_ITERATIONS = 200;
const ENABLE_ODDS_SCAN_FALLBACK = process.env.ENABLE_ODDS_SCAN_FALLBACK === "true";

// Known sportsbook key variants for direct lookup (scan-free path)
const KNOWN_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm-michigan", "caesars", "pointsbet", "bet365",
  "pinnacle", "circa", "hard-rock", "bally-bet", "betrivers", "unibet",
  "wynnbet", "espnbet", "fanatics", "betparx", "thescore", "prophetx",
  "superbook", "si-sportsbook", "betfred", "tipico", "fliff",
  "betmgm", "hardrock", "ballybet", "bally_bet", "bet-rivers", "bet_rivers"
];

/**
 * Normalize book IDs to match our canonical sportsbook IDs (from sportsbooks.ts)
 */
function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
    case "bally_bet":
      return "bally-bet";
    case "bet-rivers":
    case "bet_rivers":
      return "betrivers";
    case "sportsinteraction":
      return "sports-interaction";
    // FanDuel YourWay - matches sportsbooks.ts ID
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    // BetMGM Michigan is our preferred BetMGM source (US odds)
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

function getBookKeyCandidates(rawBook: string): string[] {
  const lower = rawBook.toLowerCase();
  const candidates = new Set<string>([lower]);
  const normalized = normalizeBookId(lower);
  candidates.add(normalized);
  candidates.add(lower.replace(/-/g, "_"));
  candidates.add(lower.replace(/_/g, "-"));
  candidates.add(normalized.replace(/-/g, "_"));
  candidates.add(normalized.replace(/_/g, "-"));

  if (normalized === "bally-bet") {
    candidates.add("ballybet");
    candidates.add("bally_bet");
  }
  if (normalized === "betrivers") {
    candidates.add("bet-rivers");
    candidates.add("bet_rivers");
  }
  if (normalized === "hard-rock") {
    candidates.add("hardrock");
  }

  return [...candidates].filter(Boolean);
}

// Books to exclude (regional variants)
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
]);

/**
 * Normalize market names to match Redis key format
 * Maps frontend-friendly names to actual Redis key market names
 */
function normalizeMarketName(market: string): string {
  const lower = market.toLowerCase();
  
  const marketMap: Record<string, string> = {
    // Basketball player props
    "points": "player_points",
    "player_points": "player_points",
    "assists": "player_assists",
    "player_assists": "player_assists",
    "rebounds": "player_rebounds",
    "player_rebounds": "player_rebounds",
    "threes": "player_threes_made",
    "player_threes_made": "player_threes_made",
    "steals": "player_steals",
    "player_steals": "player_steals",
    "blocks": "player_blocks",
    "player_blocks": "player_blocks",
    "turnovers": "player_turnovers",
    "player_turnovers": "player_turnovers",
    
    // Combo stats
    "pra": "player_pra",
    "player_pra": "player_pra",
    "player_points_rebounds_assists": "player_pra",
    "pr": "player_pr",
    "player_pr": "player_pr",
    "player_points_rebounds": "player_pr",
    "pa": "player_pa",
    "player_pa": "player_pa",
    "player_points_assists": "player_pa",
    "ra": "player_ra",
    "player_ra": "player_ra",
    "player_rebounds_assists": "player_ra",
    
    // Football passing
    "passing_yards": "player_passing_yards",
    "player_passing_yards": "player_passing_yards",
    "passing_tds": "player_passing_tds",
    "player_passing_tds": "player_passing_tds",
    "pass_attempts": "player_passing_attempts",
    "player_passing_attempts": "player_passing_attempts",
    "pass_completions": "player_passing_completions",
    "player_passing_completions": "player_passing_completions",
    "pass_interceptions": "player_interceptions_thrown",
    "player_interceptions_thrown": "player_interceptions_thrown",
    
    // Football rushing
    "rushing_yards": "player_rushing_yards",
    "player_rushing_yards": "player_rushing_yards",
    "rush_attempts": "player_rushing_attempts",
    "player_rushing_attempts": "player_rushing_attempts",
    "rushing_tds": "player_rushing_touchdowns",
    "player_rushing_touchdowns": "player_rushing_touchdowns",
    
    // Football receiving
    "receiving_yards": "player_receiving_yards",
    "player_receiving_yards": "player_receiving_yards",
    "receptions": "player_receptions",
    "player_receptions": "player_receptions",
    "receiving_tds": "player_receiving_touchdowns",
    "player_receiving_touchdowns": "player_receiving_touchdowns",
    
    // Touchdowns
    "anytime_td": "player_anytime_td",
    "player_anytime_td": "player_anytime_td",
    "first_td": "player_first_td_scorer",
    "player_first_td_scorer": "player_first_td_scorer",
    
    // Hockey
    "goals": "player_goals",
    "player_goals": "player_goals",
    "shots": "player_shots_on_goal",
    "player_shots_on_goal": "player_shots_on_goal",
    "saves": "player_saves",
    "player_saves": "player_saves",
  };
  
  return marketMap[lower] || lower;
}

/**
 * Scan all keys matching a pattern using SCAN
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = 0;
  let iterations = 0;
  const seenCursors = new Set<number>();

  do {
    iterations++;
    if (seenCursors.has(cursor)) {
      console.warn(`[v2/props/alternates] Cursor cycle detected for ${pattern}, stopping at ${results.length} keys`);
      break;
    }
    seenCursors.add(cursor);

    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = Number(nextCursor);
    results.push(...keys);

    if (iterations >= MAX_SCAN_ITERATIONS) {
      console.warn(`[v2/props/alternates] Hit scan limit for ${pattern}, got ${results.length} keys`);
      break;
    }
  } while (cursor !== 0);

  return results;
}

function parseOddsIndexMember(member: string): { market: string; book: string } | null {
  const sep = member.lastIndexOf(":");
  if (sep <= 0 || sep >= member.length - 1) return null;
  return { market: member.slice(0, sep), book: member.slice(sep + 1) };
}

async function getOddsKeysForAlternates(
  sport: string,
  eventId: string,
  market: string
): Promise<string[]> {
  const keys: string[] = [];

  // 1) Preferred path: consumer-maintained event index
  const indexMembers = (await redis.smembers(`odds_idx:${sport}:${eventId}`)).map(String);
  for (const member of indexMembers) {
    const parsed = parseOddsIndexMember(member);
    if (!parsed) continue;
    if (parsed.market !== market) continue;
    for (const candidate of getBookKeyCandidates(parsed.book)) {
      keys.push(`odds:${sport}:${eventId}:${market}:${candidate}`);
    }
  }

  // 2) Deterministic fallback: direct known-book probes
  for (const book of KNOWN_BOOKS) {
    keys.push(`odds:${sport}:${eventId}:${market}:${book}`);
  }

  const unique = [...new Set(keys)];
  if (unique.length > 0) return unique;

  // 3) Last resort scan (opt-in only)
  if (ENABLE_ODDS_SCAN_FALLBACK) {
    const pattern = `odds:${sport}:${eventId}:${market}:*`;
    return scanKeys(pattern);
  }

  return [];
}

interface AlternateLine {
  ln: number;
  books: Record<string, {
    over?: {
      price: number;
      decimal: number;
      u: string | null;    // Desktop link
      m: string | null;    // Mobile link
      sgp: string | null;  // SGP token
      limit_max?: number | null;
    };
    under?: {
      price: number;
      decimal: number;
      u: string | null;    // Desktop link
      m: string | null;    // Mobile link
      sgp: string | null;  // SGP token
      limit_max?: number | null;
    };
  }>;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
}

/**
 * Build alternates from new key structure
 * 
 * @param sport - Sport key (nba, nfl, etc.)
 * @param eventId - Event ID
 * @param market - Market key (player_points, etc.)
 * @param playerKey - Normalized player key (lebron_james)
 * @param primaryLine - The primary line to filter around (optional)
 */
async function buildAlternates(
  sport: string,
  eventId: string,
  market: string,
  playerKey: string,
  primaryLine?: number
): Promise<{
  lines: AlternateLine[];
  player: string | null;
  team: string | null;
  position: string | null;
  primary_ln: number | null;
}> {
  // Get book keys for this event/market (index-first, no scan by default)
  const oddsKeys = await getOddsKeysForAlternates(sport, eventId, market);

  if (oddsKeys.length === 0) {
    return { lines: [], player: null, team: null, position: null, primary_ln: null };
  }

  // Fetch all books data
  const oddsDataRaw = await redis.mget<(SSEBookSelections | string | null)[]>(...oddsKeys);

  // Build line -> book -> odds map
  const lineMap = new Map<number, Map<string, {
    over?: SSESelection;
    under?: SSESelection;
  }>>();

  let playerName: string | null = null;
  let playerTeam: string | null = null;
  let playerPosition: string | null = null;
  let foundPrimaryLine: number | null = null;

  oddsKeys.forEach((key, i) => {
    const data = oddsDataRaw[i];
    if (!data) return;

    const selections = parseBookSelectionsValue(data, key);
    if (!selections) return;
    const rawBook = key.split(":").pop()!;
    
    // Skip excluded books (Canada, regional variants)
    if (EXCLUDED_BOOKS.has(rawBook.toLowerCase())) return;
    
    const book = normalizeBookId(rawBook);

    // Process each selection
    for (const [selKey, sel] of Object.entries(selections)) {
      // Parse selection key: player|side|line
      const parts = selKey.split("|");
      if (parts.length !== 3) continue;

      const [rawPlayer, side, lineStr] = parts;
      
      // Only process selections for our target player
      // Match by player_id (UUID) OR normalized player name
      const matchesById = sel.player_id && sel.player_id.toLowerCase() === playerKey.toLowerCase();
      const normalizedPlayer = rawPlayer.toLowerCase().replace(/ /g, "_");
      const matchesByName = normalizedPlayer === playerKey.toLowerCase() || 
                            normalizedPlayer.replace(/_/g, "") === playerKey.toLowerCase().replace(/[_-]/g, "");
      
      if (!matchesById && !matchesByName) continue;

      const line = parseFloat(lineStr);
      if (isNaN(line)) continue;

      // Capture player info from first match
      if (!playerName && sel.player) {
        playerName = sel.player;
        playerTeam = sel.team || null;
        playerPosition = sel.position || null;
      }

      // Track primary line (main === true)
      if (sel.main && !foundPrimaryLine) {
        foundPrimaryLine = line;
      }

      // Add to line map
      if (!lineMap.has(line)) {
        lineMap.set(line, new Map());
      }

      const bookMap = lineMap.get(line)!;
      if (!bookMap.has(book)) {
        bookMap.set(book, {});
      }

      const bookData = bookMap.get(book)!;
      if (side === "over") {
        bookData.over = sel;
      } else if (side === "under") {
        bookData.under = sel;
      }
    }
  });

  // If primaryLine provided, use that; otherwise use detected
  const effectivePrimaryLine = primaryLine ?? foundPrimaryLine;

  // Build lines array
  const lines: AlternateLine[] = [];

  for (const [lineValue, bookMap] of lineMap) {
    const books: AlternateLine["books"] = {};
    let bestOver: { bk: string; price: number } | undefined;
    let bestUnder: { bk: string; price: number } | undefined;

    for (const [bookId, data] of bookMap) {
      const bookEntry: NonNullable<AlternateLine["books"]>[string] = {};

      if (data.over) {
        const price = parseInt(data.over.price.replace("+", ""), 10);
        bookEntry.over = {
          price,
          decimal: data.over.price_decimal,
          u: data.over.link || null,  // Desktop link
          m: data.over.mobile_link || null,  // Mobile link
          sgp: data.over.sgp || null,  // SGP token
          limit_max: data.over.limits?.max || null,
        };

        if (!bestOver || price > bestOver.price) {
          bestOver = { bk: bookId, price };
        }
      }

      if (data.under) {
        const price = parseInt(data.under.price.replace("+", ""), 10);
        bookEntry.under = {
          price,
          decimal: data.under.price_decimal,
          u: data.under.link || null,  // Desktop link
          m: data.under.mobile_link || null,  // Mobile link
          sgp: data.under.sgp || null,  // SGP token
          limit_max: data.under.limits?.max || null,
        };

        if (!bestUnder || price > bestUnder.price) {
          bestUnder = { bk: bookId, price };
        }
      }

      if (bookEntry.over || bookEntry.under) {
        books[bookId] = bookEntry;
      }
    }

    if (Object.keys(books).length > 0) {
      lines.push({
        ln: lineValue,
        books,
        best: {
          over: bestOver,
          under: bestUnder,
        },
      });
    }
  }

  // Sort lines by value
  lines.sort((a, b) => a.ln - b.ln);

  return {
    lines,
    player: playerName,
    team: playerTeam,
    position: playerPosition,
    primary_ln: effectivePrimaryLine,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport")?.trim().toLowerCase() || "";
    const eventId = searchParams.get("eventId")?.trim() || "";
    const market = searchParams.get("market")?.trim() || "";
    const playerKey = searchParams.get("player")?.trim() || "";
    const primaryLineStr = searchParams.get("primaryLine");

    // Validate required params
    if (!sport || !VALID_SPORTS.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { error: "missing_eventId" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!market) {
      return NextResponse.json(
        { error: "missing_market" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!playerKey) {
      return NextResponse.json(
        { error: "missing_player" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const primaryLine = primaryLineStr ? parseFloat(primaryLineStr) : undefined;
    
    // Normalize market name to match Redis key format
    const normalizedMarket = normalizeMarketName(market);

    const startTime = performance.now();

    // Build alternates from new key structure
    const { lines, player, team, position, primary_ln } = await buildAlternates(
      sport,
      eventId,
      normalizedMarket,
      playerKey,
      primaryLine
    );

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      console.log(`[v2/props/alternates] ${sport} ${eventId} ${market}→${normalizedMarket} ${playerKey}: ${lines.length} lines in ${duration.toFixed(0)}ms`);
    }

    // Filter out primary line from alternates
    const alternates = lines.filter((l) => l.ln !== primary_ln);

    return NextResponse.json(
      {
        eventId,
        sport,
        market,
        player,
        team,
        position,
        primary_ln,
        alternates,
        all_lines: lines,
        timestamp: Date.now(),
        meta: {
          duration_ms: Math.round(duration),
          line_count: lines.length,
          alternate_count: alternates.length,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=30",
          "X-Alternates-Count": String(alternates.length),
          "X-Primary-Line": String(primary_ln || "unknown"),
        },
      }
    );
  } catch (error: any) {
    console.error("[v2/props/alternates] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
