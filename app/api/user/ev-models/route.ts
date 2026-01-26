import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { EvModelCreate } from "@/lib/types/ev-models";
import { EV_MODEL_NOTES_MAX_LENGTH } from "@/lib/types/ev-models";

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

    return NextResponse.json({ model }, { status: 201 });
  } catch (error) {
    console.error("[EV Models API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
