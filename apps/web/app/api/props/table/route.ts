import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const H_PRIM_PREFIX = "props:"; // props:{sport}:rows:prim
const Z_ROI_LIVE_PREFIX = "props:"; // props:{sport}:sort:roi:live:{mkt}
const Z_ROI_PREGAME_PREFIX = "props:"; // props:{sport}:sort:roi:pregame:{mkt}

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const market = (sp.get("market") || "").trim();
    const scope = (sp.get("scope") || "pregame").toLowerCase() as "pregame" | "live";
    const limit = Math.max(1, Math.min(300, parseIntSafe(sp.get("limit"), 100)));
    const cursor = Math.max(0, parseIntSafe(sp.get("cursor"), 0));
    const playerId = sp.get("playerId") || undefined;
    const team = sp.get("team") || undefined;

    const allowed = new Set(["nfl", "ncaaf", "mlb", "wnba", "nba", "ncaab", "nhl"]);
    if (!sport || !allowed.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!market) {
      return NextResponse.json({ error: "market_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const zkey = scope === "live"
      ? `${Z_ROI_LIVE_PREFIX}${sport}:sort:roi:live:${market}`
      : `${Z_ROI_PREGAME_PREFIX}${sport}:sort:roi:pregame:${market}`;

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[/api/props/table] 🔍 Fetching odds for: ${sport} ${market} (${scope})`);
      console.log(`[/api/props/table] ZSET key: ${zkey}`);
      
      // Check if ZSET exists and count members
      const exists = await redis.exists(zkey);
      if (exists) {
        const count = await redis.zcard(zkey);
        console.log(`[/api/props/table] ✅ ZSET exists with ${count} members`);
      } else {
        console.log(`[/api/props/table] ❌ ZSET does NOT exist`);
        console.log(`[/api/props/table] 💡 Your ingestor needs to create: ${zkey}`);
      }
    }

    // Page SIDs from ZSET (simple offset cursor)
    const zrUnknown = (await (redis as any).zrange(zkey, cursor, cursor + limit - 1, { rev: true })) as unknown;
    const zrArr = Array.isArray(zrUnknown) ? (zrUnknown as any[]) : [];
    let sids = zrArr.map((x) => String(x));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[/api/props/table] Retrieved ${sids.length} SIDs from ZSET (cursor: ${cursor}, limit: ${limit})`);
      if (sids.length > 0) {
        console.log(`[/api/props/table] First 5 SIDs: ${sids.slice(0, 5).join(', ')}`);
      }
    }

    // Fetch rows
    const H_PRIM = `${H_PRIM_PREFIX}${sport}:rows:prim`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[/api/props/table] HASH key: ${H_PRIM}`);
      
      // Check if hash exists
      const hashExists = await redis.exists(H_PRIM);
      if (hashExists) {
        const hashLen = await redis.hlen(H_PRIM);
        console.log(`[/api/props/table] ✅ HASH exists with ${hashLen} total entries (all markets)`);
      } else {
        console.log(`[/api/props/table] ❌ HASH does NOT exist`);
        console.log(`[/api/props/table] 💡 Your ingestor needs to create: ${H_PRIM}`);
      }
    }
    
    const rawUnknown = sids.length ? ((await (redis as any).hmget(H_PRIM, ...sids)) as unknown) : [];
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    if (sids.length && rawArr.length === 0) {
      rawArr = await Promise.all(sids.map((id) => (redis as any).hget(H_PRIM, id)));
    }

    // Parse and build rows mapping
    type Row = any;
    const rowsParsed = rawArr.map((val) => {
      if (!val) return null;
      if (typeof val === "string") { try { return JSON.parse(val) as Row; } catch { return null; } }
      if (typeof val === "object") return val as Row;
      return null;
    });
    let rows: Row[] = rowsParsed.filter(Boolean) as Row[];
    
    // Enrich rows with player position from player metadata hash
    // This is useful for DvP (Defense vs Position) analysis
    const playerEnts = [...new Set(rows.map((r: any) => r?.ent).filter(Boolean))];
    const playerMetaMap = new Map<string, { position?: string }>();
    
    if (playerEnts.length > 0) {
      const playerMetaPromises = playerEnts.map(async (ent) => {
        const playerKey = `props:${sport}:player:${ent}`;
        const card = (await (redis as any).hgetall(playerKey)) as Record<string, string> | null;
        return { ent, position: card?.position || null };
      });
      
      const playerMetaResults = await Promise.all(playerMetaPromises);
      playerMetaResults.forEach(({ ent, position }) => {
        if (position) {
          playerMetaMap.set(ent, { position });
        }
      });
      
      // Add position to each row
      rows = rows.map((row: any) => {
        const meta = playerMetaMap.get(row?.ent);
        return {
          ...row,
          position: meta?.position || row.position || null,
        };
      });
    }
    
    if (process.env.NODE_ENV === 'development') {
      const nullCount = rowsParsed.filter(r => r === null).length;
      console.log(`[/api/props/table] Parsed ${rows.length} valid rows, ${nullCount} nulls`);
      
      if (nullCount > 0 && sids.length > 0) {
        // Show which SIDs have missing data
        const missingSids = sids.filter((sid, idx) => rowsParsed[idx] === null);
        console.log(`[/api/props/table] ⚠️  ${nullCount} SIDs have no row data in hash:`);
        console.log(`[/api/props/table]    Missing: ${missingSids.slice(0, 3).join(', ')}${missingSids.length > 3 ? ` (+${missingSids.length - 3} more)` : ''}`);
        console.log(`[/api/props/table]    💡 These SIDs are in the ZSET but not in the HASH`);
      }
    }

    // Optional filters
    if (playerId) rows = rows.filter((r: any) => String(r?.ent || "").startsWith(`pid:${playerId}`));
    if (team) rows = rows.filter((r: any) => (r?.team || r?.ev?.team || "") === team);

    // Keep sids aligned to rows (remove any nulls)
    sids = sids.filter((_, i) => Boolean(rowsParsed[i]));

    const nextCursor = zrArr.length === limit ? String(cursor + limit) : null;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[/api/props/table] 📊 Returning ${rows.length} rows, nextCursor: ${nextCursor || 'null'}`);
      if (rows.length === 0 && zrArr.length > 0) {
        console.log(`[/api/props/table] ⚠️  WARNING: ZSET has ${zrArr.length} SIDs but all returned null data`);
        console.log(`[/api/props/table] 💡 This means ${H_PRIM} is missing entries for these SIDs`);
      }
      console.log(`[/api/props/table] ✅ Done\n`);
    }

    return NextResponse.json(
      { sids, rows, nextCursor },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}