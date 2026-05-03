import { NextRequest } from "next/server";

import { handleRecentTrends } from "@/lib/hit-rates/recent-trends-api";

export async function GET(req: NextRequest) {
  return handleRecentTrends(req, "nba");
}
