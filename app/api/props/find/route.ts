import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SUPPORTED_SPORTS = new Set(["nfl", "nba", "nhl", "ncaaf"]);

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

    // New SOP: direct set for SIDs by ent+mkt
    const sidsKey = `props:${sport}:sids:ent:${ent}:mkt:${mkt}`;
    const candidateSids = (await redis.smembers<string>(sidsKey)) || [];
    
    // API Guard: Validate SIDs before returning to prevent 404s
    // For each candidate SID, check if it exists or can be resolved to a valid family SID
    const validatedSids: string[] = [];
    
    for (const sid of candidateSids) {
      // Check if the alternate lines exist for this SID
      const altKey = `props:${sport}:rows:alt:${sid}`;
      const exists = await redis.exists(altKey);
      
      if (exists === 1) {
        // SID is valid, keep it
        validatedSids.push(sid);
      } else {
        // Try to resolve to primary SID using sid2primary mapping
        const sid2primaryKey = `props:${sport}:sid2primary`;
        const primarySid = await redis.hget<string>(sid2primaryKey, sid);
        
        if (primarySid) {
          // Check if the primary SID exists
          const primaryAltKey = `props:${sport}:rows:alt:${primarySid}`;
          const primaryExists = await redis.exists(primaryAltKey);
          
          if (primaryExists === 1) {
            // Use the primary SID instead
            validatedSids.push(primarySid);
          }
          // Otherwise drop this SID (neither original nor primary exist)
        }
        // Otherwise drop this SID (no mapping and doesn't exist)
      }
    }
    
    return NextResponse.json({ 
      sids: validatedSids, 
      resolved: { sport, ent, mkt },
      // Include debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          candidates: candidateSids.length,
          validated: validatedSids.length,
          dropped: candidateSids.length - validatedSids.length
        }
      })
    });
  } catch (err) {
    console.error("[/api/props/find] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}


