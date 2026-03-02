export const runtime = "edge";

import { NextRequest } from "next/server";
import { GET as propsSseGet } from "../route";

/**
 * Backward-compatible alias for legacy clients that still connect to
 * /api/v2/sse/props/table.
 */
export async function GET(req: NextRequest) {
  return propsSseGet(req);
}
