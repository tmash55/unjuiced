import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { EvModelUpdate, EvModel } from "@/lib/types/ev-models";
import { DEFAULT_MODEL_COLOR, EV_MODEL_NOTES_MAX_LENGTH } from "@/lib/types/ev-models";

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
 * Pre-warm the positive-ev cache for a model
 * Fire-and-forget: doesn't block the response
 */
function preWarmModelCache(model: EvModel, baseUrl: string): void {
  // Only pre-warm active models
  if (!model.is_active) return;
  
  // Build query params
  const params = new URLSearchParams();
  
  // Sports: use model's sport or default to common sports
  const sports = model.sport || "nba,nfl,nhl,ncaab,ncaaf";
  params.set("sports", sports);
  
  // Custom sharp books
  if (model.sharp_books && model.sharp_books.length > 0) {
    params.set("customSharpBooks", model.sharp_books.join(","));
    
    // Custom book weights
    if (model.book_weights) {
      params.set("customBookWeights", JSON.stringify(model.book_weights));
    }
  }
  
  // Other params with defaults
  params.set("minEV", "0");
  params.set("limit", "200");
  params.set("minBooksPerSide", String(model.min_books_reference || 2));
  
  const url = `${baseUrl}/api/v2/positive-ev?${params.toString()}`;
  
  console.log(`[EV Models] Pre-warming cache for model "${model.name}" (${model.id})`);
  
  // Fire and forget - don't await
  fetch(url, { 
    method: "GET",
    headers: { "X-Cache-Prewarm": "true" },
  }).then(res => {
    if (res.ok) {
      console.log(`[EV Models] Cache pre-warmed for model "${model.name}"`);
    } else {
      console.warn(`[EV Models] Pre-warm failed for model "${model.name}": ${res.status}`);
    }
  }).catch(err => {
    console.warn(`[EV Models] Pre-warm error for model "${model.name}":`, err.message);
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
 * GET /api/user/ev-models/[id]
 * Fetch a single EV model
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

    const { data: model, error } = await supabase
      .from("user_ev_models")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ model });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/ev-models/[id]
 * Update an EV model
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

    const body: EvModelUpdate = await request.json();

    // Validate notes length if provided
    if (body.notes !== undefined && body.notes !== null && body.notes.length > EV_MODEL_NOTES_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Notes cannot exceed ${EV_MODEL_NOTES_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate market_type if provided
    if (body.market_type && !["all", "player", "game"].includes(body.market_type)) {
      return NextResponse.json(
        { error: "market_type must be 'all', 'player', or 'game'" },
        { status: 400 }
      );
    }

    // Validate fallback_mode if provided
    if (body.fallback_mode && !["hide", "use_fallback"].includes(body.fallback_mode)) {
      return NextResponse.json(
        { error: "fallback_mode must be 'hide' or 'use_fallback'" },
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
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.color !== undefined) updateData.color = normalizedColor ?? DEFAULT_MODEL_COLOR;
    if (body.sport !== undefined) updateData.sport = body.sport;
    if (body.markets !== undefined) updateData.markets = body.markets;
    if (body.market_type !== undefined) updateData.market_type = body.market_type;
    if (body.sharp_books !== undefined) updateData.sharp_books = body.sharp_books;
    if (body.book_weights !== undefined) updateData.book_weights = body.book_weights;
    if (body.fallback_mode !== undefined) updateData.fallback_mode = body.fallback_mode;
    if (body.fallback_weights !== undefined) updateData.fallback_weights = body.fallback_weights;
    if (body.min_books_reference !== undefined) updateData.min_books_reference = body.min_books_reference;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_favorite !== undefined) updateData.is_favorite = body.is_favorite;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data: model, error } = await supabase
      .from("user_ev_models")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[EV Models API] Error updating model:", error);
      return NextResponse.json(
        { error: "Failed to update model" },
        { status: 500 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Pre-warm cache when model is updated (especially when activated or config changed)
    // Only pre-warm if the model is active
    if (model.is_active) {
      const baseUrl = getBaseUrl(request);
      preWarmModelCache(model as EvModel, baseUrl);
    }

    return NextResponse.json({ model });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/ev-models/[id]
 * Delete an EV model
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
      .from("user_ev_models")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[EV Models API] Error deleting model:", error);
      return NextResponse.json(
        { error: "Failed to delete model" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
