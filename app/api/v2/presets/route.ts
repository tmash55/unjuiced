import { NextRequest, NextResponse } from "next/server";
import { SHARP_PRESETS, getRecommendedPresets } from "@/lib/odds/presets";

/**
 * GET /api/v2/presets
 * 
 * List available sharp line presets
 * 
 * Query params:
 *   sport - Filter by sport (e.g., "nba", "nfl")
 *   type  - Filter by market type ("props", "game_lines", "futures")
 *   tier  - Filter by tier ("free", "pro")
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  
  const sport = params.get("sport")?.toLowerCase();
  const marketType = params.get("type") as "props" | "game_lines" | "futures" | null;
  const tier = params.get("tier") as "free" | "pro" | null;

  let presets = sport || marketType 
    ? getRecommendedPresets(sport || undefined, marketType || undefined)
    : SHARP_PRESETS;

  // Filter by tier if specified
  if (tier) {
    presets = presets.filter((p) => p.tier === tier);
  }

  return NextResponse.json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      books: p.books,
      recommended: p.recommended,
      tier: p.tier,
    })),
    count: presets.length,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

