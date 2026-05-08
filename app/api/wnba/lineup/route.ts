import { NextRequest } from "next/server";
import { handleLineupRequest } from "@/lib/api/lineup-handler";

export async function GET(req: NextRequest) {
  return handleLineupRequest(req, "wnba");
}
