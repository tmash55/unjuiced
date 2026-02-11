import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { 
  EnrichmentRequest, 
  EnrichmentResponse, 
  EnrichedPlayerData, 
  EnrichedEventData 
} from "@/lib/best-odds-schema";

/**
 * POST /api/best-odds/enrich
 * 
 * Batch fetch player and event enrichment data for best odds deals.
 * 
 * Request body:
 * {
 *   players: [{ sport: 'nfl', ent: 'pid:00-0038809' }, ...],
 *   events: [{ sport: 'nfl', eid: 'f2617c37-9050-...' }, ...]
 * }
 * 
 * Response:
 * {
 *   players: {
 *     "nfl:pid:00-0038809": { name: "Rashod Bateman", team: "BAL", position: "WR" }
 *   },
 *   events: {
 *     "nfl:f2617c37-9050-...": { home: "BAL", away: "CLE", start: "2025-01-31...", live: false }
 *   }
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as EnrichmentRequest;
    
    console.log('[/api/best-odds/enrich] Request:', {
      playerCount: body.players?.length || 0,
      eventCount: body.events?.length || 0
    });
    
    // Validate request
    if (!body.players && !body.events) {
      return NextResponse.json(
        { error: 'Must provide players or events to enrich' },
        { status: 400 }
      );
    }
    
    const response: EnrichmentResponse = {
      players: {},
      events: {}
    };
    
    // 1. Batch fetch player data
    if (body.players && body.players.length > 0) {
      console.log('[/api/best-odds/enrich] Fetching player data for', body.players.length, 'players');
      
      // Group by sport for efficient batching
      const playersBySport = body.players.reduce((acc, p) => {
        if (!acc[p.sport]) acc[p.sport] = [];
        acc[p.sport].push(p.ent);
        return acc;
      }, {} as Record<string, string[]>);
      
      // Fetch all players in parallel
      const playerPromises = Object.entries(playersBySport).flatMap(([sport, ents]) => {
        return ents.map(async (ent) => {
          const key = `props:${sport}:player:${ent}`;
          const data = await redis.hgetall(key);
          
          if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            const playerData: EnrichedPlayerData = {
              name: (data.name || data.player || '') as string,
              team: (data.team || '') as string,
              position: (data.position || '') as string
            };
            
            return { key: `${sport}:${ent}`, data: playerData };
          }
          
          console.log('[/api/best-odds/enrich] No data found for player:', key);
          return null;
        });
      });
      
      const playerResults = await Promise.all(playerPromises);
      
      // Add to response
      playerResults.forEach(result => {
        if (result) {
          response.players[result.key] = result.data;
        }
      });
      
      console.log('[/api/best-odds/enrich] Enriched', Object.keys(response.players).length, 'players');
    }
    
    // 2. Batch fetch event data
    if (body.events && body.events.length > 0) {
      console.log('[/api/best-odds/enrich] Fetching event data for', body.events.length, 'events');
      
      // Group by sport for efficient batching
      const eventsBySport = body.events.reduce((acc, e) => {
        if (!acc[e.sport]) acc[e.sport] = [];
        acc[e.sport].push(e.eid);
        return acc;
      }, {} as Record<string, string[]>);
      
      // Fetch all events in parallel
      const eventPromises = Object.entries(eventsBySport).flatMap(([sport, eids]) => {
        return eids.map(async (eid) => {
          const key = `props:${sport}:events:${eid}`;
          const rawData = await redis.get(key);
          
          if (rawData) {
            const data = typeof rawData === 'string' 
              ? JSON.parse(rawData) 
              : rawData;
            
            // Extract relevant fields
            const eventData: EnrichedEventData = {
              home: data.home?.abbr || data.home?.name || '',
              away: data.away?.abbr || data.away?.name || '',
              start: data.start || data.dt || '',
              live: data.live || false
            };
            
            return { key: `${sport}:${eid}`, data: eventData };
          }
          
          console.log('[/api/best-odds/enrich] No data found for event:', key);
          return null;
        });
      });
      
      const eventResults = await Promise.all(eventPromises);
      
      // Add to response
      eventResults.forEach(result => {
        if (result) {
          response.events[result.key] = result.data;
        }
      });
      
      console.log('[/api/best-odds/enrich] Enriched', Object.keys(response.events).length, 'events');
    }
    
    return NextResponse.json(response, {
      headers: {
        // Cache enrichment data for 5 minutes (player/event data doesn't change often)
        'Cache-Control': 'public, max-age=300, s-maxage=600'
      }
    });
    
  } catch (error) {
    console.error('[/api/best-odds/enrich] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

