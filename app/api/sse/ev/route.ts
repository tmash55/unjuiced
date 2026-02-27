export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, hasSharpAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import { getRedisPubSubEndpoint } from "@/lib/redis-endpoints";
import { pumpPubSub } from "@/lib/sse-pubsub";

/**
 * Assert user is Pro (required for SSE live updates)
 */
async function assertPro(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  
  // Use entitlements view so trials and subscriptions both unlock live updates
  const { data: ent } = await supabase
    .from('current_entitlements')
    .select('current_plan')
    .eq('user_id', user.id)
    .single();
  
  const normalized = normalizePlanName(String(ent?.current_plan || "free"));
  const plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";
  if (!hasSharpAccess(plan)) {
    return new Response(JSON.stringify({ error: 'pro required' }), { status: 403 });
  }
  
  return null;
}

/**
 * GET /api/sse/ev
 * 
 * Server-Sent Events stream for real-time EV updates.
 * Subscribes to Redis pub/sub channel: pub:ev:all
 * 
 * Query params:
 * - scope: "pregame" | "live" (default: "pregame")
 * 
 * Access: Sharp users only
 */
export async function GET(req: NextRequest) {
  const denied = await assertPro(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const scope = (sp.get("scope") || "pregame").trim().toLowerCase();
  
  if (!["pregame", "live"].includes(scope)) {
    return new Response(JSON.stringify({ error: "invalid_scope" }), { status: 400 });
  }

  const pubsub = getRedisPubSubEndpoint();
  const url = pubsub.url;
  const token = pubsub.token;
  if (!url || !token) {
    return new Response(JSON.stringify({ error: "missing_redis_pubsub_env" }), { status: 500 });
  }
  
  // Subscribe to the unified EV channel
  const channel = `pub:ev:all`;

  const upstream = await fetch(`${url}/subscribe/${encodeURIComponent(channel)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("failed to subscribe", { status: 502 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  pumpPubSub({
    upstream: upstream.body!,
    writer,
    signal: req.signal,
    helloEvent: `event: hello\ndata: {"scope":"${scope}"}\n\n`,
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
