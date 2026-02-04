import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { EvModelCreate, EvModel } from "@/lib/types/ev-models";
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

/**
 * GET /api/user/ev-models
 * Fetch all EV models for the authenticated user
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

    const { data: models, error } = await supabase
      .from("user_ev_models")
      .select("*")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false }) // Favorites first
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[EV Models API] Error fetching models:", error);
      return NextResponse.json(
        { error: "Failed to fetch models" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      models: models || [],
      count: models?.length || 0,
    });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/ev-models
 * Create a new EV model
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

    const body: EvModelCreate = await request.json();

    // Validate required fields
    // Note: sport can be empty string (means "all sports")
    if (!body.name || !body.sharp_books || body.sharp_books.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: name, sharp_books" },
        { status: 400 }
      );
    }

    // Validate notes length if provided
    if (body.notes && body.notes.length > EV_MODEL_NOTES_MAX_LENGTH) {
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

    // Get the max sort_order for this user
    const { data: existingModels } = await supabase
      .from("user_ev_models")
      .select("sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = existingModels?.[0]?.sort_order 
      ? existingModels[0].sort_order + 1 
      : 0;

    // Create the model
    const { data: model, error } = await supabase
      .from("user_ev_models")
      .insert({
        user_id: user.id,
        name: body.name,
        notes: body.notes || null,
        color: normalizedColor ?? DEFAULT_MODEL_COLOR,
        sport: body.sport || "", // Empty string means "all sports"
        markets: body.markets || null,
        market_type: body.market_type || "all",
        sharp_books: body.sharp_books,
        book_weights: body.book_weights || null,
        fallback_mode: body.fallback_mode || "hide",
        fallback_weights: body.fallback_weights || null,
        min_books_reference: body.min_books_reference ?? 2,
        is_active: true, // New models are active by default
        is_favorite: body.is_favorite ?? false,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("[EV Models API] Error creating model:", error);
      return NextResponse.json(
        { error: "Failed to create model" },
        { status: 500 }
      );
    }

    // Pre-warm cache for the new model (fire and forget)
    if (model) {
      const baseUrl = getBaseUrl(request);
      preWarmModelCache(model as EvModel, baseUrl);
    }

    return NextResponse.json({ model }, { status: 201 });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
