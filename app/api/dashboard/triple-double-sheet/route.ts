import { NextRequest, NextResponse } from "next/server";
import {
  computeTripleDoubleSheet,
  getTripleDoubleSheetCache,
  storeTripleDoubleSheet,
  type TripleDoubleSheetData,
} from "@/lib/sgp/triple-double-sheet";

type CacheSource = "l1_cache" | "redis_cache" | "computed" | "empty";

interface TripleDoubleSheetResponse {
  data: TripleDoubleSheetData | null;
  source: CacheSource;
  timestamp: number;
  message?: string;
}

const L1_CACHE = new Map<string, { data: TripleDoubleSheetData; ts: number }>();
const L1_CACHE_TTL_MS = 30_000;
const DEFAULT_CACHE_KEY = "default";

function getL1Cache(key: string): TripleDoubleSheetData | null {
  const cached = L1_CACHE.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > L1_CACHE_TTL_MS) {
    L1_CACHE.delete(key);
    return null;
  }
  return cached.data;
}

function setL1Cache(key: string, data: TripleDoubleSheetData): void {
  L1_CACHE.set(key, { data, ts: Date.now() });
}

function parseBooksParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const books = value
    .split(",")
    .map((book) => book.trim())
    .filter(Boolean);
  return books.length ? books : undefined;
}

function hasCustomConfig(req: NextRequest): boolean {
  const params = req.nextUrl.searchParams;
  return Boolean(
    params.get("sport") ||
    params.get("target_line") ||
    params.get("max_candidates") ||
    params.get("max_rows") ||
    params.get("books")
  );
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const params = req.nextUrl.searchParams;
    const fresh = params.get("fresh") === "true";
    const compute = params.get("compute") === "true";

    const options = {
      sport: params.get("sport") || undefined,
      targetLine: params.get("target_line") ? parseFloat(params.get("target_line") as string) : undefined,
      maxCandidates: params.get("max_candidates") ? parseInt(params.get("max_candidates") as string, 10) : undefined,
      maxRows: params.get("max_rows") ? parseInt(params.get("max_rows") as string, 10) : undefined,
      books: parseBooksParam(params.get("books")),
    };

    const customConfig = hasCustomConfig(req);

    if (!fresh && !customConfig) {
      const l1 = getL1Cache(DEFAULT_CACHE_KEY);
      if (l1) {
        const response: TripleDoubleSheetResponse = {
          data: l1,
          source: "l1_cache",
          timestamp: Date.now(),
        };
        return NextResponse.json(response, {
          headers: {
            "Cache-Control": "private, max-age=30",
            "X-Cache": "L1-HIT",
            "X-Response-Time": `${Date.now() - start}ms`,
          },
        });
      }

      const redisCached = await getTripleDoubleSheetCache();
      if (redisCached) {
        setL1Cache(DEFAULT_CACHE_KEY, redisCached);
        const response: TripleDoubleSheetResponse = {
          data: redisCached,
          source: "redis_cache",
          timestamp: Date.now(),
        };
        return NextResponse.json(response, {
          headers: {
            "Cache-Control": "private, max-age=30",
            "X-Cache": "L2-HIT",
            "X-Response-Time": `${Date.now() - start}ms`,
          },
        });
      }
    }

    if (!compute && !customConfig) {
      const response: TripleDoubleSheetResponse = {
        data: null,
        source: "empty",
        timestamp: Date.now(),
        message: "Triple-double sheet is warming. Retry shortly or use ?compute=true.",
      };
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, max-age=5",
          "X-Cache": "MISS",
          "X-Response-Time": `${Date.now() - start}ms`,
        },
      });
    }

    const computed = await computeTripleDoubleSheet(options);
    if (!customConfig) {
      await storeTripleDoubleSheet(computed);
      setL1Cache(DEFAULT_CACHE_KEY, computed);
    }

    const response: TripleDoubleSheetResponse = {
      data: computed,
      source: "computed",
      timestamp: Date.now(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-Cache": "COMPUTED",
        "X-Response-Time": `${Date.now() - start}ms`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isSubscriberMode = message.toLowerCase().includes("subscriber mode");
    if (isSubscriberMode) {
      return NextResponse.json(
        {
          error: "redis_command_endpoint_in_subscriber_mode",
          message:
            "Redis command endpoint is in subscriber mode. Configure dedicated command and pub/sub endpoints.",
          required_env: [
            "UPSTASH_REDIS_COMMAND_URL",
            "UPSTASH_REDIS_COMMAND_TOKEN",
            "UPSTASH_REDIS_PUBSUB_URL",
            "UPSTASH_REDIS_PUBSUB_TOKEN",
          ],
          data: null,
          source: "empty",
          timestamp: Date.now(),
        },
        { status: 503 }
      );
    }
    console.error("[dashboard/triple-double-sheet] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch triple-double sheet",
        details:
          process.env.NODE_ENV !== "production"
            ? (error instanceof Error ? error.message : String(error))
            : undefined,
        data: null,
        source: "empty",
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
