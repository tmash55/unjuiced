import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const SUPPORTED_SPORTS = new Set([
  "nfl",
  "nba",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaaf",
  "ncaab",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

type PlayerCard = { ent: string; name?: string; team?: string; position?: string };

// simple in-memory cache per (sport,mkt)
const MEMO = new Map<string, { ts: number; players: PlayerCard[] }>();
const TTL_MS = 60_000; // 60s

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const mkt = (sp.get("mkt") || "").trim();
    const q = (sp.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(parseInt(sp.get("limit") || "100"), 500));
    // Note: scope parameter is accepted for cache key but not used for filtering
    // Scope filtering happens in /api/props/find when resolving SIDs
    const scope = ((sp.get("scope") || "pregame").trim().toLowerCase() === "live") ? "live" : "pregame";

    if (!sport || !SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400 });
    }
    if (!mkt) {
      return NextResponse.json({ error: "missing_mkt" }, { status: 400 });
    }

    const memoKey = `${sport}|${mkt}|${scope}`;
    const now = Date.now();
    const cached = MEMO.get(memoKey);
    if (cached && now - cached.ts < TTL_MS) {
      const filtered = q
        ? cached.players.filter((p) =>
            (p.name || "").toLowerCase().includes(q) || (p.team || "").toLowerCase().includes(q)
          )
        : cached.players;
      return NextResponse.json({ players: filtered.slice(0, limit) }, {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
      });
    }

    const setKey = `props:${sport}:players:mkt:${mkt}`;
    const ents = await redis.smembers<string[]>(setKey);
    const players: PlayerCard[] = [];
    
  // Debug counters
  let totalProcessed = 0;
  let filteredNoMetadata = 0;
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[/api/props/players] 🔍 Fetching players for market: ${mkt}`);
      console.log(`[/api/props/players] Looking for Redis key: ${setKey}`);
      console.log(`[/api/props/players] Found ${ents?.length || 0} entities in ${setKey}`);
      if (ents && ents.length > 0) {
        console.log(`[/api/props/players] First 10 entities: ${ents.slice(0, 10).join(', ')}`);
        
        // Check if a specific player exists (Justin Herbert example)
        const herbertEnt = 'pid:00-0036355';
        if (ents.includes(herbertEnt)) {
          console.log(`[/api/props/players] ✅ ${herbertEnt} (Justin Herbert) found in player set`);
        } else {
          console.log(`[/api/props/players] ❌ ${herbertEnt} (Justin Herbert) NOT found in ${setKey}`);
          console.log(`[/api/props/players] 💡 Your ingestor needs to add this entity to the set`);
        }
      } else {
        console.log(`[/api/props/players] ⚠️  EMPTY SET: ${setKey} contains no players!`);
        console.log(`[/api/props/players] 💡 Your ingestor needs to populate this set with player entities`);
      }
    }
    
    if (ents && ents.length) {
      const chunkSize = 40;
      
      for (let i = 0; i < ents.length && players.length < limit; i += chunkSize) {
        const chunk = ents.slice(i, i + chunkSize);

        const perEnt = await Promise.all(chunk.map(async (ent) => {
          totalProcessed++;
          
          // Just get basic player info from the hash
          // No need to check for SIDs or alternates here - /api/props/find will handle validation
          const playerKey = `props:${sport}:player:${ent}`;
          const card = (await redis.hgetall<Record<string, string>>(playerKey)) || {};
          
          if (!card.name) {
            // Skip if no player metadata
            filteredNoMetadata++;
            if (process.env.NODE_ENV === 'development' && totalProcessed <= 3) {
              console.log(`[/api/props/players] ❌ ${ent}: No 'name' field in ${playerKey}`);
              console.log(`[/api/props/players]    Hash contents:`, JSON.stringify(card));
              console.log(`[/api/props/players]    💡 Your ingestor needs to create this hash with {name, team, position}`);
            }
            return null;
          }
          
          return { 
            ent, 
            name: card.name, 
            team: card.team, 
            position: card.position 
          } as PlayerCard;
        }));

        for (const p of perEnt) {
          if (p) players.push(p);
          if (players.length >= limit) break;
        }
      }
    }

    // Deduplicate by player name (keep first occurrence)
    // This handles cases where the same player has multiple entity IDs
    const seen = new Map<string, PlayerCard>();
    for (const player of players) {
      const key = player.name?.toLowerCase() || player.ent;
      if (!seen.has(key)) {
        seen.set(key, player);
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[/api/props/players] Skipping duplicate player: ${player.name} (${player.ent})`);
      }
    }
    const deduplicatedPlayers = Array.from(seen.values());
    
    // Debug summary
    if (process.env.NODE_ENV === 'development' && totalProcessed > 0) {
      console.log(`[/api/props/players] Summary for ${mkt}:`);
      console.log(`  - Total entities processed: ${totalProcessed}`);
      console.log(`  - Filtered (no metadata): ${filteredNoMetadata}`);
      console.log(`  - Final players returned: ${deduplicatedPlayers.length}`);
      console.log(`  ℹ️  Note: SID validation happens in /api/props/find when player is selected`);
    }
    
    MEMO.set(memoKey, { ts: now, players: deduplicatedPlayers });
    const filtered = q
      ? deduplicatedPlayers.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.team || "").toLowerCase().includes(q))
      : deduplicatedPlayers;
    return NextResponse.json({ players: filtered.slice(0, limit) }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    });
  } catch (e) {
    console.error("[/api/props/players] error", e);
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}

