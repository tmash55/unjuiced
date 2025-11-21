import { createClient } from "@/libs/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch all hidden edge keys for the current user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch hidden edges, excluding expired ones
    const { data, error } = await supabase
      .from("user_hidden_edges")
      .select("edge_key, event_date, auto_unhide_at")
      .eq("user_id", user.id)
      .or(`auto_unhide_at.is.null,auto_unhide_at.gt.${new Date().toISOString()}`);

    if (error) {
      console.error("[GET /api/user/hidden-edges] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return just the edge keys for filtering
    const edgeKeys = data?.map(item => item.edge_key) || [];
    
    return NextResponse.json({ 
      hiddenEdges: edgeKeys,
      count: edgeKeys.length 
    });
  } catch (error) {
    console.error("[GET /api/user/hidden-edges] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Hide a new edge
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      edgeKey, 
      eventId, 
      eventDate, 
      sport, 
      playerName, 
      market, 
      line,
      autoUnhideHours = 24 // Default: auto-unhide after 24 hours
    } = body;

    if (!edgeKey) {
      return NextResponse.json({ error: "edgeKey is required" }, { status: 400 });
    }

    // Calculate auto-unhide timestamp
    const autoUnhideAt = autoUnhideHours 
      ? new Date(Date.now() + autoUnhideHours * 60 * 60 * 1000).toISOString()
      : null;

    // Insert or update hidden edge
    const { data, error } = await supabase
      .from("user_hidden_edges")
      .upsert({
        user_id: user.id,
        edge_key: edgeKey,
        event_id: eventId || null,
        event_date: eventDate || null,
        sport: sport || null,
        player_name: playerName || null,
        market: market || null,
        line: line || null,
        auto_unhide_at: autoUnhideAt,
        hidden_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,edge_key'
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/user/hidden-edges] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      hiddenEdge: data 
    });
  } catch (error) {
    console.error("[POST /api/user/hidden-edges] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Clear all hidden edges for the user
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("user_hidden_edges")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("[DELETE /api/user/hidden-edges] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "All hidden edges cleared" 
    });
  } catch (error) {
    console.error("[DELETE /api/user/hidden-edges] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

