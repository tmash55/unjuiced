import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createServerClient } from "@/libs/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS, normalizePlanName, type UserPlan } from "@/lib/plans";

type EntitlementRow = {
  current_plan: string | null;
  entitlement_source: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_used: boolean | null;
};

type AuthenticatedContext = {
  userId: string;
  supabase: any;
};

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const isLocalhost =
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

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

function jsonWithHeaders(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Cache-Control": "no-store, no-cache, must-revalidate"
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

/**
 * GET /api/me/plan
 * Returns the user's effective plan using the v_user_entitlements view
 * This accounts for both active subscriptions AND active trials
 * Returns "free" if not authenticated or if no entitlements found
 */
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin"))
  });
}

export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const authorizationHeader = request.headers.get("authorization") || (await headers()).get("authorization");
    const context = await getAuthenticatedContext(authorizationHeader);
    if (!context) {
      return jsonWithHeaders({ plan: "free", authenticated: false }, 200, origin);
    }

    // Get user's effective plan from current_entitlements view
    // This view calculates the plan based on active subscriptions OR trial status
    const { data: entitlement, error: entitlementError } = (await context.supabase
      .from("current_entitlements")
      .select("current_plan, entitlement_source, trial_started_at, trial_ends_at, trial_used")
      .eq("user_id", context.userId)
      .single()) as { data: EntitlementRow | null; error: unknown };

    if (entitlementError || !entitlement) {
      console.error("Error fetching entitlement:", entitlementError);
      return jsonWithHeaders({ plan: "free", authenticated: true, error: "Entitlement not found" }, 200, origin);
    }

    const normalized = normalizePlanName(String(entitlement.current_plan || "free"));
    let plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";

    // Grants are treated as full-access in the existing web app.
    if (entitlement.entitlement_source === "grant") {
      plan = "elite";
    }

    return jsonWithHeaders(
      {
        plan, 
        authenticated: true,
        userId: context.userId,
        entitlement_source: entitlement.entitlement_source,
        trial: {
          trial_used: entitlement.trial_used,
          trial_started_at: entitlement.trial_started_at,
          trial_ends_at: entitlement.trial_ends_at,
          is_trial_active: entitlement.entitlement_source === 'trial',
      }
      },
      200,
      origin
    );
  } catch (error) {
    console.error("Error in /api/me/plan:", error);
    return jsonWithHeaders(
      { plan: "free", authenticated: false, error: "Server error" },
      200,
      request.headers.get("origin")
    );
  }
}
