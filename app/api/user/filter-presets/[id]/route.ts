import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { FilterPresetUpdate } from "@/lib/types/filter-presets";

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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
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

