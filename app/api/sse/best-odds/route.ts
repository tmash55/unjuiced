export const runtime = "edge";

import { NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";

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
 * - Pro users: Full access to all updates
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
    isPro = ent?.current_plan === 'pro' || ent?.current_plan === 'admin';
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
    
    // Disable SSE for free/anon users (auto-refresh is a Pro feature)
    if (!isPro) {
      console.log('[/api/sse/best-odds] Rejecting connection: Pro only');
      return new Response(
        JSON.stringify({ error: 'Pro subscription required for real-time updates' }),
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
    const upstreamUrl = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    
    const upstream = await fetch(`${upstreamUrl}/subscribe/${encodeURIComponent(channel)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
    });
    
    if (!upstream.ok || !upstream.body) {
      console.error('[/api/sse/best-odds] Failed to subscribe to Redis channel');
      return new Response("Failed to subscribe", { status: 502 });
    }
    
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    
    const write = async (str: string) => {
      try { 
        await writer.write(enc.encode(str)); 
      } catch (e) { 
        // Connection closed
        console.log('[/api/sse/best-odds] Write failed, connection closed');
      }
    };
    
    // Pump upstream to downstream with filtering
    const pump = async () => {
      const reader = upstream.body!.getReader();
      
      // Send hello event
      try {
        await write(`event: hello\ndata: ${JSON.stringify({ sport, isPro })}\n\n`);
        console.log('[/api/sse/best-odds] Sent hello event:', { sport, isPro });
      } catch (e) {
        console.log('[/api/sse/best-odds] Failed to send hello event:', e);
        return;
      }
      
      // Heartbeat every 15 seconds
      const PING_MS = 15_000;
      const ping = setInterval(() => {
        write(`: ping\n\n`).catch(() => {
          clearInterval(ping);
          console.log('[/api/sse/best-odds] Ping failed, stopping heartbeat');
        });
      }, PING_MS);
      
      // Handle client disconnect
      const onAbort = () => {
        console.log('[/api/sse/best-odds] Client disconnected');
        clearInterval(ping);
        try { writer.close(); } catch {}
      };
      
      if (req.signal.aborted) {
        onAbort();
        return;
      }
      
      req.signal.addEventListener('abort', onAbort, { once: true });
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            console.log('[/api/sse/best-odds] Upstream closed');
            break;
          }
          
          // Decode the message
          const text = new TextDecoder().decode(value);
          
          // If free user, filter out high-improvement deals
          if (!isPro && text.includes('data:')) {
            try {
              // Extract JSON data from SSE format
              const dataMatch = text.match(/data:\s*({.*})/);
              if (dataMatch) {
                const data = JSON.parse(dataMatch[1]);
                
                // Filter deals array if present
                if (data.deals && Array.isArray(data.deals)) {
                  const originalCount = data.deals.length;
                  
                  // Filter based on improvement threshold
                  data.deals = data.deals.filter((d: any) => {
                    const improvement = d.priceImprovement || d.price_improvement || 0;
                    return improvement < FREE_USER_IMPROVEMENT_LIMIT;
                  });
                  
                  console.log('[/api/sse/best-odds] Filtered deals for free user:', {
                    original: originalCount,
                    filtered: data.deals.length
                  });
                  
                  // Only send if deals remain after filtering
                  if (data.deals.length > 0) {
                    await write(`data: ${JSON.stringify(data)}\n\n`);
                  }
                  continue;
                }
                
                // Filter single deal if present
                if (data.ent && data.mkt) {
                  const improvement = data.priceImprovement || data.price_improvement || 0;
                  if (improvement >= FREE_USER_IMPROVEMENT_LIMIT) {
                    console.log('[/api/sse/best-odds] Filtered single deal for free user:', {
                      improvement,
                      limit: FREE_USER_IMPROVEMENT_LIMIT
                    });
                    continue; // Skip this update
                  }
                }
              }
            } catch (e) {
              // If parsing fails, pass through (might be a different event type)
              console.log('[/api/sse/best-odds] Failed to parse message, passing through:', e);
            }
          }
          
          // Pass through for Pro users or non-data events
          await write(text);
        }
      } catch (error) {
        console.error('[/api/sse/best-odds] Stream error:', error);
      } finally {
        clearInterval(ping);
        try { writer.close(); } catch {}
      }
    };
    
    // Start pumping in the background
    pump();
    
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

