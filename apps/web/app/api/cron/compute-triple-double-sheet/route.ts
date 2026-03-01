import { NextRequest, NextResponse } from "next/server";
import {
  computeTripleDoubleSheet,
  storeTripleDoubleSheet,
} from "@/lib/sgp/triple-double-sheet";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const start = Date.now();

  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const data = await computeTripleDoubleSheet();
    await storeTripleDoubleSheet(data);

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - start,
      generatedAt: data.generatedAtIso,
      rows: data.rows.length,
      meta: data.meta,
    });
  } catch (error) {
    console.error("[cron/compute-triple-double-sheet] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to compute triple-double sheet",
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
