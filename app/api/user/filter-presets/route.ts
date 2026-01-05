import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { FilterPreset, FilterPresetCreate } from "@/lib/types/filter-presets";

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

    // Create the preset
    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .insert({
        user_id: user.id,
        name: body.name,
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

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error) {
    console.error("[Filter Presets API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

