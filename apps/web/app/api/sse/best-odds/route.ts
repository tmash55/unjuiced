export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, hasSharpAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import { getRedisPubSubEndpoint } from "@/lib/redis-endpoints";
import { pumpPubSub } from "@/lib/sse-pubsub";

/**
 * GET /api/sse/best-odds
 * 
 * Real-time SSE stream for best odds updates via Redis pub/sub.
 * 
 * Query params:
 * - sport: "all" | "nfl" | "nba" | "nhl" (default: "all")
 * 
 * Access control:
 * - Free users: Deals with improvement >= 10% are filtered out
 * - Sharp users: Full access to all updates
 * 
 * Events:
 * - hello: Initial connection event with auth status
 * - data: Deal updates (filtered based on user tier)
 * - ping: Heartbeat every 15s
 */

const FREE_USER_IMPROVEMENT_LIMIT = 10;

async function checkAuth(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let isPro = false;
  if (user) {
    const { data: ent } = await supabase
      .from('current_entitlements')
      .select('current_plan')
      .eq('user_id', user.id)
      .single();
    const normalized = normalizePlanName(String(ent?.current_plan || "free"));
    const plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";
    isPro = hasSharpAccess(plan);
  }
  
  return { user, isPro };
}

export async function GET(req: NextRequest) {
  try {
    // Check auth
    const { user, isPro } = await checkAuth(req);
    
    console.log('[/api/sse/best-odds] Connection request:', { 
      userId: user?.id, 
      isPro 
    });
    
    // Disable SSE for free/anon users (auto-refresh is a Sharp feature)
    if (!isPro) {
      console.log('[/api/sse/best-odds] Rejecting connection: Sharp only');
      return new Response(
        JSON.stringify({ error: 'Sharp subscription required for real-time updates' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Parse params (currently only 'all' is supported)
    const url = new URL(req.url);
    const sport = url.searchParams.get('sport') || 'all';
    
    // Use the all-sports channel
    const channel = 'pub:best_odds:all';
    
    console.log('[/api/sse/best-odds] Subscribing to channel:', channel);
    
    // Subscribe to Redis pub/sub via Upstash REST API
    const pubsub = getRedisPubSubEndpoint();
    const upstreamUrl = pubsub.url;
    const token = pubsub.token;
    if (!upstreamUrl || !token) {
      return new Response(
        JSON.stringify({ error: "Missing Redis pub/sub endpoint configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const upstream = await fetch(`${upstreamUrl}/subscribe/${encodeURIComponent(channel)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      cache: "no-store",
    });
    
    if (!upstream.ok || !upstream.body) {
      console.error('[/api/sse/best-odds] Failed to subscribe to Redis channel');
      return new Response("Failed to subscribe", { status: 502 });
    }
    
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Build a filter for free users to cap deal improvements
    const filter = isPro ? undefined : (payload: string): string | null => {
      try {
        const data = JSON.parse(payload);

        // Filter deals array if present
        if (data.deals && Array.isArray(data.deals)) {
          data.deals = data.deals.filter((d: any) => {
            const improvement = d.priceImprovement || d.price_improvement || 0;
            return improvement < FREE_USER_IMPROVEMENT_LIMIT;
          });
          return data.deals.length > 0 ? JSON.stringify(data) : null;
        }

        // Filter single deal
        if (data.ent && data.mkt) {
          const improvement = data.priceImprovement || data.price_improvement || 0;
          if (improvement >= FREE_USER_IMPROVEMENT_LIMIT) return null;
        }
      } catch {
        // Parse error — pass through
      }
      return payload;
    };

    pumpPubSub({
      upstream: upstream.body!,
      writer,
      signal: req.signal,
      helloEvent: `event: hello\ndata: ${JSON.stringify({ sport, isPro })}\n\n`,
      filter,
    });
    
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
    
  } catch (error) {
    console.error('[/api/sse/best-odds] Error:', error);
    return new Response("Internal error", { status: 500 });
  }
}
