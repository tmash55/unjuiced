import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

interface SelectionRequest {
  sid: string;        // Original SID from hit rate profile (may be stale)
  playerId: number;   // NBA player ID for SID lookup
  market: string;     // Market type (e.g., "player_points")
  line: number;       // Line value to match
}

interface BookOdds {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
}

interface LineOdds {
  sid: string;
  resolvedSid: string | null;
  line: number;
  bestBook: string | null;
  bestPrice: number | null;
  bestUrl: string | null;
  books: BookOdds[];
}

const MAX_SELECTIONS = 500;
const SPORT = "nba";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const selections: SelectionRequest[] = Array.isArray(body?.selections) 
      ? body.selections.slice(0, MAX_SELECTIONS) 
      : [];

    if (!selections.length) {
      return NextResponse.json(
        { odds: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate selections
    const validSelections = selections.filter(
      (s) => 
        typeof s.sid === "string" && 
        s.sid.trim() && 
        typeof s.line === "number" &&
        typeof s.playerId === "number" &&
        typeof s.market === "string" &&
        s.market.trim()
    );

    if (!validSelections.length) {
      return NextResponse.json(
        { odds: {} },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // =========================================================================
    // STEP 1: Deduplicate by player+market (most efficient - fewer lookups)
    // =========================================================================
    const playerMarketMap = new Map<string, { playerId: number; market: string; originalSids: string[] }>();
    const allOriginalSids = new Set<string>();
    
    for (const s of validSelections) {
      const key = `${s.playerId}:${s.market}`;
      allOriginalSids.add(s.sid.trim());
      
      if (!playerMarketMap.has(key)) {
        playerMarketMap.set(key, { 
          playerId: s.playerId, 
          market: s.market, 
          originalSids: [s.sid.trim()] 
        });
      } else {
        playerMarketMap.get(key)!.originalSids.push(s.sid.trim());
      }
    }

    // =========================================================================
    // STEP 2: Batch fetch all SID sets in ONE pipeline call
    // =========================================================================
    const playerMarketEntries = Array.from(playerMarketMap.entries());
    const sidsSetKeys = playerMarketEntries.map(
      ([, { playerId, market }]) => `props:${SPORT}:sids:ent:pid:${playerId}:mkt:${market}`
    );
    
    // Single MGET-style batch for all SMEMBERS (using pipeline)
    const pipeline = redis.pipeline();
    for (const key of sidsSetKeys) {
      pipeline.smembers(key);
    }
    const sidsResults = await pipeline.exec<string[][]>();

    // =========================================================================
    // STEP 3: Collect ALL candidate SIDs + original SIDs for batch EXISTS check
    // =========================================================================
    const allCandidateSids = new Set<string>();
    const playerMarketToCandidates = new Map<string, string[]>();
    
    for (let i = 0; i < playerMarketEntries.length; i++) {
      const [key] = playerMarketEntries[i];
      const candidates = sidsResults[i] || [];
      playerMarketToCandidates.set(key, candidates);
      candidates.forEach((sid) => allCandidateSids.add(sid));
    }
    
    // Also include original SIDs as fallback candidates
    allOriginalSids.forEach((sid) => allCandidateSids.add(sid));
    
    const candidateSidsArray = Array.from(allCandidateSids);
    
    // =========================================================================
    // STEP 4: Batch EXISTS check for ALL candidate SIDs (single pipeline)
    // =========================================================================
    const existsPipeline = redis.pipeline();
    for (const sid of candidateSidsArray) {
      existsPipeline.exists(`props:${SPORT}:rows:alt:${sid}`);
    }
    const existsResults = await existsPipeline.exec<number[]>();
    
    // Build a set of valid SIDs
    const validSidsSet = new Set<string>();
    for (let i = 0; i < candidateSidsArray.length; i++) {
      if (existsResults[i] === 1) {
        validSidsSet.add(candidateSidsArray[i]);
      }
    }

    // =========================================================================
    // STEP 5: For invalid SIDs, batch resolve via sid2primary
    // =========================================================================
    const invalidSids = candidateSidsArray.filter((sid) => !validSidsSet.has(sid));
    
    if (invalidSids.length > 0) {
      // Batch HMGET for all invalid SIDs
      const sid2primaryKey = `props:${SPORT}:sid2primary`;
      const primarySidsRaw = await redis.hmget(sid2primaryKey, ...invalidSids);
      
      // Collect unique primary SIDs that need EXISTS check
      const primarySidsToCheck = new Set<string>();
      const invalidToPrimary = new Map<string, string>();
      
      // Convert to array if it's an object (Redis can return Record<string, unknown>)
      const primarySidsArray: (string | null)[] = Array.isArray(primarySidsRaw) 
        ? (primarySidsRaw as (string | null)[])
        : (Object.values(primarySidsRaw || {}) as (string | null)[]);
        
      for (let i = 0; i < invalidSids.length; i++) {
        const primary = primarySidsArray[i];
        if (primary && typeof primary === "string" && !validSidsSet.has(primary)) {
          primarySidsToCheck.add(primary);
          invalidToPrimary.set(invalidSids[i], primary);
        }
      }
      
      // Batch EXISTS for primary SIDs
      if (primarySidsToCheck.size > 0) {
        const primaryArray = Array.from(primarySidsToCheck);
        const primaryExistsPipeline = redis.pipeline();
        for (const sid of primaryArray) {
          primaryExistsPipeline.exists(`props:${SPORT}:rows:alt:${sid}`);
        }
        const primaryExistsResults = await primaryExistsPipeline.exec<number[]>();
        
        for (let i = 0; i < primaryArray.length; i++) {
          if (primaryExistsResults[i] === 1) {
            validSidsSet.add(primaryArray[i]);
          }
        }
      }
      
      // Update invalid -> primary mapping for those that resolved
      for (const [invalid, primary] of invalidToPrimary) {
        if (validSidsSet.has(primary)) {
          // Mark the invalid SID as resolving to this primary
          validSidsSet.add(invalid); // We'll handle the mapping below
        }
      }
    }

    // =========================================================================
    // STEP 6: Resolve each player+market to its best valid SID
    // =========================================================================
    const playerMarketToValidSid = new Map<string, string | null>();
    
    for (const [key, { originalSids }] of playerMarketMap) {
      const candidates = playerMarketToCandidates.get(key) || [];
      
      // First, check candidates from the set
      let foundSid: string | null = null;
      for (const sid of candidates) {
        if (validSidsSet.has(sid)) {
          foundSid = sid;
          break;
        }
      }
      
      // Fallback to original SIDs
      if (!foundSid) {
        for (const sid of originalSids) {
          if (validSidsSet.has(sid)) {
            foundSid = sid;
            break;
          }
        }
      }
      
      // Last resort: check sid2primary for candidates
      if (!foundSid && invalidSids.length > 0) {
        const sid2primaryKey = `props:${SPORT}:sid2primary`;
        for (const sid of [...candidates, ...originalSids]) {
          if (!validSidsSet.has(sid)) {
            const primary = await redis.hget<string>(sid2primaryKey, sid);
            if (primary && validSidsSet.has(primary)) {
              foundSid = primary;
              break;
            }
          }
        }
      }
      
      playerMarketToValidSid.set(key, foundSid);
    }

    // =========================================================================
    // STEP 7: Batch fetch ALL valid alternate data (single MGET)
    // =========================================================================
    const uniqueValidSids = [...new Set(
      Array.from(playerMarketToValidSid.values()).filter(Boolean) as string[]
    )];
    
    let altDataMap: Record<string, any> = {};
    if (uniqueValidSids.length > 0) {
      const altKeys = uniqueValidSids.map((sid) => `props:${SPORT}:rows:alt:${sid}`);
      const rawResults = await redis.mget(...altKeys);
      
      for (let i = 0; i < uniqueValidSids.length; i++) {
        const raw = rawResults[i];
        if (raw) {
          try {
            altDataMap[uniqueValidSids[i]] = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // =========================================================================
    // STEP 8: Build final response (pure computation, no I/O)
    // =========================================================================
    const odds: Record<string, LineOdds> = {};

    for (const selection of validSelections) {
      const originalSid = selection.sid.trim();
      const pmKey = `${selection.playerId}:${selection.market}`;
      const resolvedSid = playerMarketToValidSid.get(pmKey);

      if (!resolvedSid || !altDataMap[resolvedSid]) {
        odds[originalSid] = {
          sid: originalSid,
          resolvedSid: null,
          line: selection.line,
          bestBook: null,
          bestPrice: null,
          bestUrl: null,
          books: [],
        };
        continue;
      }

      const parsed = altDataMap[resolvedSid];
      const lines = parsed?.lines || [];
      const matchingLine = lines.find((l: any) => l.ln === selection.line);

      if (!matchingLine || !matchingLine.books) {
        odds[originalSid] = {
          sid: originalSid,
          resolvedSid,
          line: selection.line,
          bestBook: null,
          bestPrice: null,
          bestUrl: null,
          books: [],
        };
        continue;
      }

      // Extract all book odds for "over"
      const books: BookOdds[] = [];
      for (const [bookKey, bookData] of Object.entries(matchingLine.books)) {
        const data = bookData as any;
        if (data?.over?.price !== undefined) {
          books.push({
            book: bookKey,
            price: data.over.price,
            url: data.over.u || null,
            mobileUrl: data.over.m || null,
          });
        }
      }

      books.sort((a, b) => b.price - a.price);
      const bestBook = books[0] || null;

      odds[originalSid] = {
        sid: originalSid,
        resolvedSid,
        line: selection.line,
        bestBook: bestBook?.book || null,
        bestPrice: bestBook?.price || null,
        bestUrl: bestBook?.url || null,
        books,
      };
    }

    return NextResponse.json(
      { odds },
      { 
        headers: { 
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" 
        } 
      }
    );
  } catch (error: any) {
    console.error("[/api/nba/hit-rates/odds] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
