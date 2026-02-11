import { NextRequest, NextResponse } from "next/server";
import { SHARP_PRESETS } from "@/lib/ev/constants";

const FREE_PRESETS = new Set(["pinnacle", "circa", "market_average"]);

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  if (isLocalhost) return origin;
  if (origin === "https://app.unjuiced.bet") return origin;
  if (origin === "https://www.unjuiced.bet") return origin;
  if (origin === "https://unjuiced.bet") return origin;

  return null;
}

function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = resolveAllowedOrigin(origin);

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Cache-Control, Pragma",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin"))
  });
}

export async function GET(request: NextRequest) {
  const presets = Object.values(SHARP_PRESETS)
    .filter((preset) => preset.id !== "custom")
    .map((preset) => {
      const tier = FREE_PRESETS.has(preset.id) ? "free" : "pro";
      return {
        id: preset.id,
        name: preset.name,
        label: preset.label,
        description: preset.description,
        books: preset.books,
        tier
      };
    });

  return NextResponse.json(
    {
      presets,
      count: presets.length
    },
    {
      headers: {
        ...getCorsHeaders(request.headers.get("origin")),
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
