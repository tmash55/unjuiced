import { NextRequest, NextResponse } from "next/server";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";

/**
 * POST /api/polymarket/odds
 *
 * Batch-fetch sportsbook odds from Redis for Sharp Signals.
 * Accepts an array of odds keys, returns matched odds per key.
 *
 * Body: { keys: [{ sport, event_id, market, outcome?, line? }] }
 * Response: { results: { [comboKey]: { book, price, decimal, line?, link?, mobile_link? }[] } }
 */

const BETTABLE_BOOKS = [
  "draftkings", "fanduel", "betmgm", "caesars", "bet365",
  "fanatics", "hard-rock", "espnbet", "betrivers",
];

interface OddsKey {
  sport: string;
  event_id: string;
  market: string;
  outcome?: string | null;
  line?: string | null;
}

interface OddsEntry {
  book: string;
  price: string;
  decimal: number;
  line?: string;
  link?: string;
  mobile_link?: string;
}

function parseAmerican(raw: string | number | null): { american: number | null; decimal: number | null } {
  let american: number | null = null;
  if (typeof raw === "string") {
    american = parseInt(raw.replace("+", ""), 10);
  } else if (typeof raw === "number") {
    american = raw;
  }
  if (american == null || isNaN(american)) return { american: null, decimal: null };
  const decimal = american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
  return { american, decimal };
}

function formatAmerican(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keys: OddsKey[] = body?.keys;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: "keys array required" }, { status: 400 });
    }

    // Cap at 20 keys per request
    const limited = keys.slice(0, 20);

    const redis = getRedisCommandEndpoint();
    if (!redis.url || !redis.token) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
    }

    // Build all fetch promises: key × book
    type FetchResult = { comboKey: string; book: string; data: any } | null;
    const fetches: Promise<FetchResult>[] = [];

    for (const key of limited) {
      const comboKey = `${key.sport}:${key.event_id}:${key.market}`;
      for (const book of BETTABLE_BOOKS) {
        const redisKey = `odds:${key.sport}:${key.event_id}:${key.market}:${book}`;
        fetches.push(
          Promise.race([
            fetch(`${redis.url}/GET/${encodeURIComponent(redisKey)}`, {
              headers: { Authorization: `Bearer ${redis.token}` },
            })
              .then((r) => r.json())
              .then((json: any) => {
                if (!json.result) return null;
                return { comboKey, book, data: JSON.parse(json.result) } as FetchResult;
              })
              .catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ])
        );
      }
    }

    const settled = await Promise.allSettled(fetches);

    // Group raw data by comboKey → book
    const rawByKey = new Map<string, Map<string, any>>();
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        const { comboKey, book, data } = r.value;
        if (!rawByKey.has(comboKey)) rawByKey.set(comboKey, new Map());
        rawByKey.get(comboKey)!.set(book, data);
      }
    }

    // Match and filter for each key
    const results: Record<string, OddsEntry[]> = {};

    for (const key of limited) {
      const comboKey = `${key.sport}:${key.event_id}:${key.market}`;
      const bookOdds = rawByKey.get(comboKey);
      if (!bookOdds || bookOdds.size === 0) {
        results[comboKey] = [];
        continue;
      }

      const outcome = (key.outcome || "").toLowerCase();
      const isTotal = outcome === "over" || outcome === "under";
      const entries: OddsEntry[] = [];

      for (const [book, data] of bookOdds) {
        const selections: any[] = data && typeof data === "object" && !Array.isArray(data)
          ? Object.values(data)
          : Array.isArray(data) ? data : [];

        for (const sel of selections) {
          if (!sel || typeof sel !== "object") continue;

          // Match outcome
          const selName = (sel.player || sel.name || "").toLowerCase();
          const selSide = (sel.side || "").toLowerCase();

          if (isTotal) {
            if (outcome !== selSide) continue;
          } else {
            if (!selName || !(selName.includes(outcome) || outcome.includes(selName))) continue;
          }

          // Spread: only main line
          if (selSide === "spread" || selSide === "puck_line" || selSide === "run_line") {
            const isMain = sel.main === true || sel.main === "true" || sel.main === 1;
            if (!isMain) continue;
          }

          // Totals: match exact line if provided
          if (isTotal && key.line && sel.line != null) {
            const sigLine = parseFloat(key.line);
            const selLine = parseFloat(sel.line);
            if (!isNaN(sigLine) && !isNaN(selLine) && sigLine !== selLine) continue;
          }

          const { american, decimal } = parseAmerican(sel.price ?? sel.american);
          if (!decimal || decimal <= 1) continue;

          entries.push({
            book,
            price: american != null ? formatAmerican(american) : (sel.price?.toString() ?? ""),
            decimal: Math.round(decimal * 1000) / 1000,
            line: sel.line?.toString(),
            link: sel.link ?? undefined,
            mobile_link: sel.mobile_link ?? sel.deep_link ?? undefined,
          });
        }
      }

      // Sort by best odds (highest decimal)
      entries.sort((a, b) => b.decimal - a.decimal);
      results[comboKey] = entries;
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
        },
      }
    );
  } catch (err) {
    console.error("[/api/polymarket/odds] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
