import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const SUPPORTED_SPORTS = new Set(["nfl", "nba", "nhl", "ncaaf"]);

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
    const ents = await redis.smembers<string>(setKey);
    const players: PlayerCard[] = [];
    if (ents && ents.length) {
      const chunkSize = 40;
      for (let i = 0; i < ents.length && players.length < limit; i += chunkSize) {
        const chunk = ents.slice(i, i + chunkSize);

        const perEnt = await Promise.all(chunk.map(async (ent) => {
          // 1) Resolve sids for (ent,mkt)
          const sidsKey = `props:${sport}:sids:ent:${ent}:mkt:${mkt}`;
          const sids = await redis.smembers<string>(sidsKey);
          if (!sids || sids.length === 0) return null;

          // 2) Check which SIDs have valid families first (fast batch check)
          const famKeys = sids.map((sid) => `props:${sport}:rows:alt:${sid}`);
          const existsResults = await Promise.all(famKeys.map((k) => redis.exists(k)));
          const validSids = sids.filter((_, idx) => existsResults[idx] === 1);
          
          if (validSids.length === 0) return null;

          // 3) Scope filter via props:{sport}:is_live (if available)
          const liveKey = `props:${sport}:is_live`;
          let flags: any[] = [];
          try {
            const keyType = await redis.type(liveKey);
            if (keyType === "hash") {
              if (validSids.length === 1) {
                flags = [await redis.hget(liveKey, validSids[0])];
              } else {
                const tryArray = await (redis as any).hmget(liveKey, validSids);
                flags = Array.isArray(tryArray) ? tryArray : validSids.map((sid) => (tryArray as any)?.[sid]);
              }
            }
          } catch {
            // Swallow; flags remain empty
          }

          // 4) Find first sid that matches scope
          for (let idx = 0; idx < validSids.length; idx++) {
            // If flags available, filter by scope
            if (flags.length > 0) {
              const flag = (flags?.[idx] as string | null | undefined) || "0";
              const isMatch = scope === "live" ? flag === "1" : flag === "0";
              if (!isMatch) continue;
            }
            // This sid has a valid family and matches scope (or no scope filtering)
            const card = (await redis.hgetall<Record<string, string>>(`props:${sport}:player:${ent}`)) || {};
            return { ent, name: card.name, team: card.team, position: card.position } as PlayerCard;
          }

          return null;
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


