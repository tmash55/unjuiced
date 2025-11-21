import { createClient } from "@/libs/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// DELETE - Unhide a specific edge
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ edgeKey: string }> }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { edgeKey } = await params;
    
    if (!edgeKey) {
      return NextResponse.json({ error: "edgeKey is required" }, { status: 400 });
    }

    // Decode the edgeKey (it will be URL encoded)
    const decodedEdgeKey = decodeURIComponent(edgeKey);

    const { error } = await supabase
      .from("user_hidden_edges")
      .delete()
      .eq("user_id", user.id)
      .eq("edge_key", decodedEdgeKey);

    if (error) {
      console.error("[DELETE /api/user/hidden-edges/:edgeKey] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Edge unhidden successfully" 
    });
  } catch (error) {
    console.error("[DELETE /api/user/hidden-edges/:edgeKey] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

