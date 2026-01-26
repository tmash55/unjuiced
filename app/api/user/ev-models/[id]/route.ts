import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import type { EvModelUpdate } from "@/lib/types/ev-models";
import { EV_MODEL_NOTES_MAX_LENGTH } from "@/lib/types/ev-models";

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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.notes !== undefined) updateData.notes = body.notes;
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
