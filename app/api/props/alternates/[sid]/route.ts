import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const H_ALT_PREFIX = "props:"; // props:{sport}:rows:alt

export async function GET(req: NextRequest, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params; // ✅ Await the params

  try {
    const trimmedSid = sid.trim();
    if (!trimmedSid) {
      return NextResponse.json({ error: "sid_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const sp = new URL(req.url).searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const allowed = new Set(["nfl", "mlb", "wnba", "nba"]);
    if (!sport || !allowed.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const H_ALT = `${H_ALT_PREFIX}${sport}:rows:alt`;
    const raw = await (redis as any).hget(H_ALT, trimmedSid);
    let family: any = null;
    if (raw) {
      if (typeof raw === "string") {
        try { family = JSON.parse(raw); } catch { family = null; }
      } else if (typeof raw === "object") {
        family = raw;
      }
    }

    return NextResponse.json({ family }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}