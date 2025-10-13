import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";

const H_ROWS = "arbs:rows";
const MAX_IDS = 1000;
const CHUNK = 500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = Array.isArray(body?.ids) ? body.ids : [];

    // Basic input guard: strings only, non-empty
    const normalized = (input as unknown[])
      .map((x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x) : ""))
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    if (!normalized.length) {
      return NextResponse.json(
        { format: ROWS_FORMAT, rows: [], missing: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Dedup while preserving first occurrence order
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of normalized) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }

    // Cap to MAX_IDS
    const capped = ordered.slice(0, MAX_IDS);

    // HMGET in chunks; fallback to HGET per-id if needed
    const out: Array<{ id: string; row: ArbRow | null }> = [];
    const missing: string[] = [];
    let usedFallback = false;

    // Helper to safely parse a value that can be JSON string or object
    const safeParse = (val: any): ArbRow | null => {
      if (!val) return null;
      if (typeof val === "string") {
        try { return JSON.parse(val) as ArbRow; } catch { return null; }
      }
      if (typeof val === "object") return val as ArbRow;
      return null;
    };

    for (let offset = 0; offset < capped.length; offset += CHUNK) {
      const chunk = capped.slice(offset, offset + CHUNK);
      const rawUnknown = (await (redis as any).hmget(H_ROWS, ...chunk)) as unknown;
      let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];

      if (!Array.isArray(rawUnknown) || rawArr.length === 0) {
        // Fallback: fetch each key individually to ensure compatibility
        usedFallback = true;
        rawArr = await Promise.all(chunk.map((id) => (redis as any).hget(H_ROWS, id)));
      }

      rawArr.forEach((val, i) => {
        const id = chunk[i];
        const row = safeParse(val);
        if (!row) missing.push(id);
        out.push({ id, row });
      });
    }

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (missing.length) headers["X-Arbs-Missing"] = String(missing.length);
    if (usedFallback) headers["X-Arbs-HMGET-Fallback"] = "1";

    return NextResponse.json(
      { format: ROWS_FORMAT, rows: out, missing },
      { headers }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}