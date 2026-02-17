import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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

// Simple in-memory cache (60s TTL)
type CacheEntry = { sids: string[]; ts: number };
const MEMO = new Map<string, CacheEntry>();
const TTL_MS = 60_000; // 60s

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const ent = (sp.get("player") || sp.get("ent") || "").trim();
    const mkt = (sp.get("mkt") || "").trim();

    if (!sport || !SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ error: "invalid_sport" }, { status: 400 });
    }
    if (!mkt) {
      return NextResponse.json({ error: "missing_mkt" }, { status: 400 });
    }
    if (!ent) {
      return NextResponse.json({ error: "missing_ent", message: "Provide player or ent" }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `${sport}:${ent}:${mkt}`;
    const now = Date.now();
    const cached = MEMO.get(cacheKey);
    if (cached && now - cached.ts < TTL_MS) {
      return NextResponse.json({ 
        sids: cached.sids, 
        resolved: { sport, ent, mkt },
        cached: true
      });
    }

    // New SOP: direct set for SIDs by ent+mkt
    const sidsKey = `props:${sport}:sids:ent:${ent}:mkt:${mkt}`;
    const candidateSids = (await redis.smembers<string[]>(sidsKey)) || [];
    
    if (candidateSids.length === 0) {
      // No SIDs found, return early
      return NextResponse.json({ 
        sids: [], 
        resolved: { sport, ent, mkt }
      });
    }
    
    // API Guard: Validate SIDs in batch (much faster than looping)
    // Step 1: Check all alternate keys at once
    const altKeys = candidateSids.map((sid) => `props:${sport}:rows:alt:${sid}`);
    const existsResults = await Promise.all(altKeys.map((k) => redis.exists(k)));
    
    // Step 2: Separate valid SIDs from those needing resolution
    const validSids: string[] = [];
    const sidsNeedingResolution: string[] = [];
    
    candidateSids.forEach((sid, idx) => {
      if (existsResults[idx] === 1) {
        validSids.push(sid);
      } else {
        sidsNeedingResolution.push(sid);
      }
    });
    
    // Step 3: Resolve stale SIDs in batch via sid2primary
    if (sidsNeedingResolution.length > 0) {
      const sid2primaryKey = `props:${sport}:sid2primary`;
      
      // Batch lookup primary SIDs
      const primarySids = sidsNeedingResolution.length === 1
        ? [await redis.hget<string>(sid2primaryKey, sidsNeedingResolution[0])]
        : await Promise.all(sidsNeedingResolution.map(sid => redis.hget<string>(sid2primaryKey, sid)));
      
      // Filter out nulls and check which primary SIDs have alternates
      const primarySidsToCheck = primarySids.filter(Boolean) as string[];
      if (primarySidsToCheck.length > 0) {
        const primaryAltKeys = primarySidsToCheck.map((sid) => `props:${sport}:rows:alt:${sid}`);
        const primaryExists = await Promise.all(primaryAltKeys.map((k) => redis.exists(k)));
        
        primarySidsToCheck.forEach((sid, idx) => {
          if (primaryExists[idx] === 1 && !validSids.includes(sid)) {
            validSids.push(sid);
          }
        });
      }
    }
    
    // Cache the result
    MEMO.set(cacheKey, { sids: validSids, ts: now });
    
    return NextResponse.json({ 
      sids: validSids, 
      resolved: { sport, ent, mkt },
      // Include debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          candidates: candidateSids.length,
          validated: validSids.length,
          dropped: candidateSids.length - validSids.length,
          resolved: sidsNeedingResolution.length
        }
      })
    }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" }
    });
  } catch (err) {
    console.error("[/api/props/find] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

