import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { FilterPreset, FilterPresetCreate } from "@/lib/types/filter-presets";
import { DEFAULT_FILTER_COLOR } from "@/lib/types/filter-presets";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeColor(color?: string | null): string | null | undefined {
  if (color === undefined) return undefined;
  if (color === null || color === "") return null;
  if (!HEX_COLOR_REGEX.test(color)) return undefined;
  return color.toUpperCase();
}

// =============================================================================
// Pre-warming Helper
// =============================================================================

/**
 * Pre-warm the opportunities cache for a filter preset
 * Fire-and-forget: doesn't block the response
 */
function preWarmPresetCache(preset: FilterPreset, baseUrl: string): void {
  // Only pre-warm active presets
  if (!preset.is_active) return;
  
  // Build query params for the opportunities endpoint
  const params = new URLSearchParams();
  
  // Sports: use preset's sport or default to common sports
  const sports = preset.sport || "nba,nfl,nhl,ncaab,ncaaf";
  params.set("sports", sports);
  
  // Build blend from sharp_books and book_weights
  if (preset.sharp_books && preset.sharp_books.length > 0) {
    const blend = preset.sharp_books.map(book => {
      const weight = preset.book_weights?.[book] ?? (100 / preset.sharp_books.length);
      return `${book}:${weight / 100}`;
    }).join(",");
    params.set("blend", blend);
  }
  
  // Other params
  params.set("minBooksPerSide", String(preset.min_books_reference || 2));
  if (preset.market_type && preset.market_type !== "all") {
    params.set("marketType", preset.market_type);
  }
  
  const url = `${baseUrl}/api/v2/opportunities?${params.toString()}`;
  
  console.log(`[Filter Presets] Pre-warming cache for preset "${preset.name}" (${preset.id})`);
  
  // Fire and forget - don't await
  fetch(url, { 
    method: "GET",
    headers: { "X-Cache-Prewarm": "true" },
  }).then(res => {
    if (res.ok) {
      console.log(`[Filter Presets] Cache pre-warmed for preset "${preset.name}"`);
    } else {
      console.warn(`[Filter Presets] Pre-warm failed for preset "${preset.name}": ${res.status}`);
    }
  }).catch(err => {
    console.warn(`[Filter Presets] Pre-warm error for preset "${preset.name}":`, err.message);
  });
}

/**
 * Get base URL from request headers
 */
function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
  
  if (host) {
    return `${proto}://${host}`;
  }
  
  // Fallback for Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return "http://localhost:3000";
}

/**
 * GET /api/user/filter-presets
 * Fetch all filter presets for the authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: presets, error } = await supabase
      .from("user_filter_presets")
      .select("*")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false }) // Favorites first
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Filter Presets API] Error fetching presets:", error);
      return NextResponse.json(
        { error: "Failed to fetch presets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      presets: presets || [],
      count: presets?.length || 0,
    });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/filter-presets
 * Create a new filter preset
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: FilterPresetCreate = await request.json();

    // Validate required fields
    if (!body.name || !body.sport || !body.sharp_books?.length) {
      return NextResponse.json(
        { error: "Missing required fields: name, sport, sharp_books" },
        { status: 400 }
      );
    }

    // Get the max sort_order for this user
    const { data: existingPresets } = await supabase
      .from("user_filter_presets")
      .select("sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = existingPresets?.[0]?.sort_order 
      ? existingPresets[0].sort_order + 1 
      : 0;

    // Validate notes length if provided
    if (body.notes && body.notes.length > 500) {
      return NextResponse.json(
        { error: "Notes cannot exceed 500 characters" },
        { status: 400 }
      );
    }

    const normalizedColor = normalizeColor(body.color);
    if (body.color !== undefined && normalizedColor === undefined) {
      return NextResponse.json(
        { error: "color must be a valid hex value like #0EA5E9" },
        { status: 400 }
      );
    }

    // Create the preset
    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .insert({
        user_id: user.id,
        name: body.name,
        color: normalizedColor ?? DEFAULT_FILTER_COLOR,
        sport: body.sport,
        markets: body.markets || null,
        market_type: body.market_type || "all",
        sharp_books: body.sharp_books,
        book_weights: body.book_weights || null,
        fallback_mode: body.fallback_mode || "hide",
        fallback_weights: body.fallback_weights || null,
        min_books_reference: body.min_books_reference || 2,
        min_odds: body.min_odds ?? -500,
        max_odds: body.max_odds ?? 300,
        is_active: true, // New presets are active by default
        is_favorite: body.is_favorite ?? false,
        notes: body.notes || null,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("[Filter Presets API] Error creating preset:", error);
      return NextResponse.json(
        { error: "Failed to create preset" },
        { status: 500 }
      );
    }

    // Pre-warm cache for the new preset (fire and forget)
    if (preset) {
      const baseUrl = getBaseUrl(request);
      preWarmPresetCache(preset as FilterPreset, baseUrl);
    }

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
