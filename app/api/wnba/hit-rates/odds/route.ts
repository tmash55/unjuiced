import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

interface OddsRequest {
  stableKey: string;
  line?: number;
}

interface SideOdds {
  price: string | number;
  u?: string;
  m?: string;
  sgp?: string;
}

interface RedisLine {
  ln: number;
  books?: Record<
    string,
    {
      over?: SideOdds | string | number;
      under?: SideOdds | string | number;
    }
  >;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
}

interface RedisOddsData {
  eid?: string;
  mkt?: string;
  primary_ln?: number;
  live?: boolean;
  best?: {
    o?: { bk: string; price: number };
    u?: { bk: string; price: number };
  };
  lines?: RedisLine[];
  ts?: number;
}

interface BookOddsData {
  price: number;
  url: string | null;
  mobileUrl: string | null;
  sgp: string | null;
}

interface LineOddsResponse {
  stableKey: string;
  eventId: string | null;
  market: string | null;
  primaryLine: number | null;
  currentLine: number | null;
  bestOver: {
    book: string;
    price: number;
    url: string | null;
    mobileUrl: string | null;
    sgp: string | null;
  } | null;
  bestUnder: {
    book: string;
    price: number;
    url: string | null;
    mobileUrl: string | null;
    sgp: string | null;
  } | null;
  allLines: Array<{
    line: number;
    bestOver: LineOddsResponse["bestOver"];
    bestUnder: LineOddsResponse["bestUnder"];
    books: Record<string, { over?: BookOddsData; under?: BookOddsData }>;
  }>;
  live: boolean;
  timestamp: number | null;
}

const MAX_KEYS = 500;
const REDIS_V2_KEY = "hitrate:wnba:v2";

function parsePrice(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractSidePrice(side: SideOdds | string | number | undefined): number | null {
  if (side === undefined || side === null) return null;
  if (typeof side === "object" && "price" in side) return parsePrice(side.price);
  return parsePrice(side);
}

function extractSideLinks(side: SideOdds | string | number | undefined) {
  if (side === undefined || side === null || typeof side !== "object") {
    return { url: null, mobileUrl: null, sgp: null };
  }
  return {
    url: side.u ?? null,
    mobileUrl: side.m ?? null,
    sgp: side.sgp ?? null,
  };
}

function emptyOdds(stableKey: string): LineOddsResponse {
  return {
    stableKey,
    eventId: null,
    market: null,
    primaryLine: null,
    currentLine: null,
    bestOver: null,
    bestUnder: null,
    allLines: [],
    live: false,
    timestamp: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requests: OddsRequest[] = Array.isArray(body?.selections)
      ? body.selections.slice(0, MAX_KEYS)
      : [];
    const validRequests = requests.filter((request) =>
      request.stableKey?.trim(),
    );

    if (validRequests.length === 0) {
      return NextResponse.json(
        { odds: {} },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const uniqueKeys = [
      ...new Set(validRequests.map((request) => request.stableKey.trim())),
    ];
    const rawResultsRaw = await redis.hmget(REDIS_V2_KEY, ...uniqueKeys);
    const rawResults: (string | null)[] = Array.isArray(rawResultsRaw)
      ? (rawResultsRaw as (string | null)[])
      : uniqueKeys.map(
          (key) =>
            ((rawResultsRaw as Record<string, unknown>)?.[key] as
              | string
              | null
              | undefined) ?? null,
        );

    const odds: Record<string, LineOddsResponse> = {};

    for (let index = 0; index < uniqueKeys.length; index++) {
      const stableKey = uniqueKeys[index];
      const raw = rawResults[index];

      if (!raw) {
        odds[stableKey] = emptyOdds(stableKey);
        continue;
      }

      let data: RedisOddsData;
      try {
        data = typeof raw === "string" ? JSON.parse(raw) : (raw as RedisOddsData);
      } catch {
        odds[stableKey] = emptyOdds(stableKey);
        continue;
      }

      const request = validRequests.find(
        (item) => item.stableKey.trim() === stableKey,
      );
      const requestedLine = request?.line ?? data.primary_ln ?? null;
      let bestOver: LineOddsResponse["bestOver"] =
        data.best?.o != null
          ? {
              book: data.best.o.bk,
              price: data.best.o.price,
              url: null,
              mobileUrl: null,
              sgp: null,
            }
          : null;
      let bestUnder: LineOddsResponse["bestUnder"] =
        data.best?.u != null
          ? {
              book: data.best.u.bk,
              price: data.best.u.price,
              url: null,
              mobileUrl: null,
              sgp: null,
            }
          : null;

      if (requestedLine !== null && data.lines?.length) {
        const matchingLine = data.lines.find((line) => line.ln === requestedLine);
        if (matchingLine?.best?.over) {
          const bookData = matchingLine.books?.[matchingLine.best.over.bk];
          bestOver = {
            book: matchingLine.best.over.bk,
            price: matchingLine.best.over.price,
            ...extractSideLinks(bookData?.over),
          };
        }
        if (matchingLine?.best?.under) {
          const bookData = matchingLine.books?.[matchingLine.best.under.bk];
          bestUnder = {
            book: matchingLine.best.under.bk,
            price: matchingLine.best.under.price,
            ...extractSideLinks(bookData?.under),
          };
        }
      }

      const allLines = (data.lines ?? []).map((line) => {
        const books: Record<string, { over?: BookOddsData; under?: BookOddsData }> = {};

        for (const [bookId, bookOdds] of Object.entries(line.books ?? {})) {
          const overPrice = extractSidePrice(bookOdds.over);
          const underPrice = extractSidePrice(bookOdds.under);
          if (overPrice === null && underPrice === null) continue;

          books[bookId] = {};
          if (overPrice !== null) {
            books[bookId].over = {
              price: overPrice,
              ...extractSideLinks(bookOdds.over),
            };
          }
          if (underPrice !== null) {
            books[bookId].under = {
              price: underPrice,
              ...extractSideLinks(bookOdds.under),
            };
          }
        }

        const lineBestOver = line.best?.over
          ? {
              book: line.best.over.bk,
              price: line.best.over.price,
              ...extractSideLinks(line.books?.[line.best.over.bk]?.over),
            }
          : null;
        const lineBestUnder = line.best?.under
          ? {
              book: line.best.under.bk,
              price: line.best.under.price,
              ...extractSideLinks(line.books?.[line.best.under.bk]?.under),
            }
          : null;

        return {
          line: line.ln,
          bestOver: lineBestOver,
          bestUnder: lineBestUnder,
          books,
        };
      });

      odds[stableKey] = {
        stableKey,
        eventId: data.eid ?? null,
        market: data.mkt ?? null,
        primaryLine: data.primary_ln ?? null,
        currentLine: requestedLine,
        bestOver,
        bestUnder,
        allLines,
        live: data.live ?? false,
        timestamp: data.ts ?? null,
      };
    }

    return NextResponse.json(
      { odds },
      {
        headers: {
          "Cache-Control":
            "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("[/api/wnba/hit-rates/odds] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error instanceof Error ? error.message : "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
