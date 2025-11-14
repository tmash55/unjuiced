"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "20", 10), 1), 50);
    const offset = Math.max(parseInt(sp.get("offset") || "0", 10), 0);
    const category = sp.get("category") || undefined;
    const tag = sp.get("tag") || undefined;
    const search = sp.get("search") || undefined;
    const includeUnpublished = sp.get("includeUnpublished") === "true";

    let query = supabase
      .from("changelog")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeUnpublished) {
      query = query.eq("published", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (tag) {
      query = query.contains("tags", [tag]);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,summary.ilike.%${search}%,body.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[/api/changelog] Supabase error", error);
      return NextResponse.json(
        { error: "Failed to fetch changelog entries" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { entries: data ?? [], total: count ?? 0 },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[/api/changelog] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error fetching changelog entries" },
      { status: 500 }
    );
  }
}

