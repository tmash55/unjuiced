"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const includeUnpublished = req.nextUrl.searchParams.get("includeUnpublished") === "true";
    const { slug } = await params;

    let query = supabase
      .from("changelog")
      .select("*")
      .eq("slug", slug)
      .limit(1);

    if (!includeUnpublished) {
      query = query.eq("published", true);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      console.error("[/api/changelog/[slug]] Supabase error", error);
      return NextResponse.json(
        { error: "Failed to fetch changelog entry" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[/api/changelog/[slug]] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error fetching changelog entry" },
      { status: 500 }
    );
  }
}

