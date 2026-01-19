import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const CreatePresetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  quickFilters: z.array(z.string()),
  chartFilters: z.record(z.any()),
});

const UpdatePresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  quickFilters: z.array(z.string()).optional(),
  chartFilters: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});

function transformPreset(p: any) {
  return {
    id: p.id,
    userId: p.user_id,
    name: p.name,
    description: p.description,
    quickFilters: p.quick_filters || [],
    chartFilters: p.chart_filters || {},
    isDefault: p.is_default || false,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: presets, error } = await supabase
      .from("user_filter_presets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
    return NextResponse.json({ presets: (presets || []).map(transformPreset) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreatePresetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { name, description, quickFilters, chartFilters } = parsed.data;
    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .insert({ user_id: user.id, name, description, quick_filters: quickFilters, chart_filters: chartFilters, is_default: false })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
    return NextResponse.json({ preset: transformPreset(preset) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdatePresetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { id, name, description, quickFilters, chartFilters, isDefault } = parsed.data;
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (quickFilters !== undefined) updateData.quick_filters = quickFilters;
    if (chartFilters !== undefined) updateData.chart_filters = chartFilters;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    const { data: preset, error } = await supabase
      .from("user_filter_presets")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !preset) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ preset: transformPreset(preset) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Preset ID required" }, { status: 400 });

    const { error } = await supabase
      .from("user_filter_presets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
