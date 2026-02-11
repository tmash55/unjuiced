import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redis } from "@/lib/redis";
import { ROWS_FORMAT, type ArbRow } from "@/lib/arb-schema";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, normalizePlanName, type UserPlan } from "@/lib/plans";

const H_ROWS = "arbs:rows";
const Z_ROI = "arbs:sort:roi";
const Z_ROI_LIVE = "arbs:sort:roi:live";
const Z_ROI_PREGAME = "arbs:sort:roi:pregame";
const V_VER = "arbs:v";

type EntitlementRow = {
  current_plan: string | null;
  entitlement_source: string | null;
};

type AuthenticatedContext = {
  userId: string;
  supabase: any;
};

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  if (isLocalhost) return origin;
  if (origin === "https://app.unjuiced.bet") return origin;
  if (origin === "https://www.unjuiced.bet") return origin;
  if (origin === "https://unjuiced.bet") return origin;

  return null;
}

function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = resolveAllowedOrigin(origin);

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Cache-Control, Pragma",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function jsonWithHeaders(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Cache-Control": "no-store",
      ...(extraHeaders ?? {})
    }
  });
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  return token || null;
}

async function getAuthenticatedContext(authorizationHeader: string | null): Promise<AuthenticatedContext | null> {
  const cookieClient = await createServerClient();
  const bearerToken = extractBearerToken(authorizationHeader);

  if (bearerToken) {
    const bearerClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    const {
      data: { user: bearerUser },
      error: bearerError
    } = await bearerClient.auth.getUser(bearerToken);

    if (!bearerError && bearerUser) {
      return {
        userId: bearerUser.id,
        supabase: bearerClient as any
      };
    }
  }

  const {
    data: { user: cookieUser },
    error: cookieError
  } = await cookieClient.auth.getUser();

  if (!cookieError && cookieUser) {
    return {
      userId: cookieUser.id,
      supabase: cookieClient as any
    };
  }

  return null;
}

async function getUserPlanFromContext(context: AuthenticatedContext | null): Promise<UserPlan> {
  if (!context) return "anonymous";

  const { data: entitlement, error } = (await context.supabase
    .from("current_entitlements")
    .select("current_plan, entitlement_source")
    .eq("user_id", context.userId)
    .single()) as { data: EntitlementRow | null; error: unknown };

  if (error || !entitlement) return "free";

  const normalized = normalizePlanName(String(entitlement.current_plan || "free"));
  let plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";

  if (entitlement.entitlement_source === "grant") {
    plan = "elite";
  }

  return plan;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin"))
  });
}

export async function GET(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const authorizationHeader = req.headers.get("authorization");
    const context = await getAuthenticatedContext(authorizationHeader);
    const userPlan = await getUserPlanFromContext(context);

    const sp = new URL(req.url).searchParams;
    const clientV = parseIntSafe(sp.get("v"), 0);

    const requestedLimit = parseIntSafe(sp.get("limit"), 100);
    const planLimits = PLAN_LIMITS[userPlan].arbitrage;
    const maxAllowed = planLimits.maxResults === -1 ? 1000 : planLimits.maxResults;

    const isFreeUser = userPlan === "free" || userPlan === "anonymous";
    const fetchLimit = isFreeUser ? Math.min(500, maxAllowed * 5) : Math.max(1, Math.min(maxAllowed, requestedLimit));
    const limit = Math.max(1, Math.min(maxAllowed, requestedLimit));

    const cursor = Math.max(0, parseIntSafe(sp.get("cursor"), 0));
    const eventId = sp.get("event_id");
    const mode = (sp.get("mode") ?? "all").toLowerCase() as "all" | "live" | "pregame";
    const debug = sp.get("debug") === "1";

    const serverV = (await redis.get<number>(V_VER)) ?? 0;
    if (clientV && clientV === serverV) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ...getCorsHeaders(origin),
          "Cache-Control": "no-store"
        }
      });
    }

    let ids: string[] = [];
    const sortKey = mode === "live" ? Z_ROI_LIVE : mode === "pregame" ? Z_ROI_PREGAME : Z_ROI;

    if (eventId) {
      const allResp = (await (redis as any).smembers(`arbs:by_event:${eventId}`)) as unknown;
      const allIds: string[] = Array.isArray(allResp) ? (allResp as any[]).map((x) => String(x)) : [];

      if (allIds.length > 0) {
        const scores = (await (redis as any).zmscore(sortKey, ...allIds)) as Array<number | null> | null;
        const pairs = allIds.map((id, i) => [id, Number(scores?.[i] ?? 0)] as const).sort((a, b) => b[1] - a[1]);
        ids = pairs.slice(cursor, cursor + fetchLimit).map((p) => p[0]);
      }
    } else {
      const zrUnknown = (await (redis as any).zrange(sortKey, cursor, cursor + fetchLimit - 1, { rev: true })) as unknown;
      const zrArr = Array.isArray(zrUnknown) ? (zrUnknown as any[]) : [];
      ids = zrArr.map((x) => String(x));
    }

    const rawUnknown = ids.length ? ((await (redis as any).hmget(H_ROWS, ...ids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    let usedFallback = false;

    if (ids.length && (!Array.isArray(rawUnknown) || (rawArr.length === 0 && ids.length > 0))) {
      usedFallback = true;
      rawArr = await Promise.all(ids.map((id) => (redis as any).hget(H_ROWS, id)));
    }

    const parseRow = (val: any): ArbRow | null => {
      if (!val) return null;
      if (typeof val === "string") {
        try {
          return JSON.parse(val) as ArbRow;
        } catch {
          return null;
        }
      }
      if (typeof val === "object") return val as ArbRow;
      return null;
    };

    const rowsParsed = rawArr.map(parseRow);
    let rows: ArbRow[] = rowsParsed.filter(Boolean) as ArbRow[];
    const missingIds = rowsParsed.reduce<string[]>((acc, row, i) => {
      if (!row) acc.push(ids[i]);
      return acc;
    }, []);

    let filteredCount = 0;
    if (userPlan === "free" || userPlan === "anonymous") {
      const originalCount = rows.length;
      rows = rows.filter((row) => {
        const roiPercent = (row.roi_bps ?? 0) / 100;
        const isLive = row.ev?.live === true;
        return roiPercent <= 1.0 && !isLive;
      });
      filteredCount = originalCount - rows.length;
      if (rows.length > limit) rows = rows.slice(0, limit);
    } else if (userPlan === "sharp" && !planLimits.hasLiveArb) {
      const originalCount = rows.length;
      rows = rows.filter((row) => row.ev?.live !== true);
      filteredCount = originalCount - rows.length;
      if (rows.length > limit) rows = rows.slice(0, limit);
    }

    const body: Record<string, any> = {
      format: ROWS_FORMAT,
      v: serverV,
      mode,
      ids,
      rows,
      plan: userPlan,
      limits: {
        maxResults: planLimits.maxResults,
        applied: limit,
        canFilter: planLimits.canFilter,
        canExport: planLimits.canExport
      }
    };

    if (debug) body.missing = missingIds;

    if (filteredCount > 0) {
      body.filteredCount = filteredCount;
      body.filteredReason =
        userPlan === "sharp"
          ? "Sharp plan: pregame arbs only (upgrade to Elite for live)"
          : "Free users limited to pregame arbs with ROI <= 1%";
    }

    const responseHeaders: Record<string, string> = {
      "X-User-Plan": userPlan,
      "X-Plan-Limit": String(maxAllowed)
    };
    if (missingIds.length) responseHeaders["X-Arbs-Missing"] = String(missingIds.length);
    if (usedFallback) responseHeaders["X-Arbs-HMGET-Fallback"] = "1";

    return jsonWithHeaders(body, 200, origin, responseHeaders);
  } catch (error: any) {
    return jsonWithHeaders(
      { error: "internal_error", message: error?.message || "" },
      500,
      req.headers.get("origin")
    );
  }
}
