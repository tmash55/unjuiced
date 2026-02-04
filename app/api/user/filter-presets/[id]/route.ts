import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { FilterPreset, FilterPresetUpdate } from "@/lib/types/filter-presets";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/user/filter-presets/[id]
 * Fetch a single filter preset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !preset) {
      return NextResponse.json(
        { error: "Preset not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ preset });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/filter-presets/[id]
 * Update a filter preset
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: FilterPresetUpdate = await request.json();

    // Validate notes length if provided
    if (body.notes !== undefined && body.notes !== null && body.notes.length > 500) {
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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = normalizedColor ?? DEFAULT_FILTER_COLOR;
    if (body.sport !== undefined) updateData.sport = body.sport;
    if (body.markets !== undefined) updateData.markets = body.markets;
    if (body.market_type !== undefined) updateData.market_type = body.market_type;
    if (body.sharp_books !== undefined) updateData.sharp_books = body.sharp_books;
    if (body.book_weights !== undefined) updateData.book_weights = body.book_weights;
    if (body.fallback_mode !== undefined) updateData.fallback_mode = body.fallback_mode;
    if (body.fallback_weights !== undefined) updateData.fallback_weights = body.fallback_weights;
    if (body.min_books_reference !== undefined) updateData.min_books_reference = body.min_books_reference;
    if (body.min_odds !== undefined) updateData.min_odds = body.min_odds;
    if (body.max_odds !== undefined) updateData.max_odds = body.max_odds;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_favorite !== undefined) updateData.is_favorite = body.is_favorite;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[Filter Presets API] Error updating preset:", error);
      return NextResponse.json(
        { error: "Failed to update preset" },
        { status: 500 }
      );
    }

    if (!preset) {
      return NextResponse.json(
        { error: "Preset not found" },
        { status: 404 }
      );
    }

    // Pre-warm cache when preset is updated (especially when activated or config changed)
    // Only pre-warm if the preset is active
    if (preset.is_active) {
      const baseUrl = getBaseUrl(request);
      preWarmPresetCache(preset as FilterPreset, baseUrl);
    }

    return NextResponse.json({ preset });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/filter-presets/[id]
 * Delete a filter preset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("user_filter_presets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Filter Presets API] Error deleting preset:", error);
      return NextResponse.json(
        { error: "Failed to delete preset" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
