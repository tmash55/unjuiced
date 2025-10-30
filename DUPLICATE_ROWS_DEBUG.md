# Duplicate Rows Debugging Guide

## Issue
Multiple identical rows appearing for the same game/player in the odds screen (e.g., WSH @ KC appearing 3 times).

## ⚠️ ROOT CAUSE IDENTIFIED

**The ingestor is creating multiple SIDs for the same logical row** (same event + market + line).

Instead of:
- 1 SID per unique row → `props:nfl:rows:prim` has 1 entry → sorted set has 1 entry → UI shows 1 row ✅

We have:
- 3 SIDs for the same row → `props:nfl:rows:prim` has 3 entries → sorted set has 3 entries → UI shows 3 rows ❌

**The fix must be in the ingestor to ensure only 1 SID is created per unique row.**

## Root Cause Analysis

### 1. How IDs Are Generated

**Frontend ID Generation** (`lib/api-adapters/props-to-odds.ts:219`):
```typescript
const uniqueId = row.sid || `${row.eid}-${entityId}-${row.mkt}-${row.ln}`
```

**What This Means:**
- If `sid` exists, it's used as the unique ID
- Otherwise, ID is constructed from: `eventId-entityId-market-line`
- **If multiple rows have the same SID, they'll appear as duplicates**

### 2. Data Flow

```
Redis ZSET                     Redis HASH                    Frontend
┌─────────────────┐           ┌──────────────────┐          ┌──────────────┐
│ props:nfl:sort: │           │ props:nfl:rows:  │          │ OddsTable    │
│ roi:pregame:    │  ──SIDs──>│ prim             │  ──rows──>│ Component    │
│ spread          │           │                  │          │              │
│                 │           │ sid1 -> {row}    │          │ Renders rows │
│ sid1: 95.2      │           │ sid2 -> {row}    │          │ with item.id │
│ sid2: 94.8      │           │ sid3 -> {row}    │          │              │
│ sid1: 93.1 ❌   │           │                  │          │              │
└─────────────────┘           └──────────────────┘          └──────────────┘
     ^                                                              ^
     |                                                              |
  DUPLICATE SID                                            DUPLICATE ROW
  IN SORTED SET                                            ON SCREEN
```

### 3. Where Duplicates Can Occur

#### A. In Redis Sorted Set (Most Likely)
**Key Pattern:** `props:{sport}:sort:roi:{scope}:{market}`

**Symptoms:**
- Same SID appears multiple times with different scores
- Example: `sid1` appears at positions 0, 5, and 12

**Check:**
```bash
# Count total entries
redis-cli ZCARD "props:nfl:sort:roi:pregame:spread"

# Get top 20 entries with scores
redis-cli ZRANGE "props:nfl:sort:roi:pregame:spread" 0 19 WITHSCORES

# Check for duplicate SIDs
redis-cli ZRANGE "props:nfl:sort:roi:pregame:spread" 0 -1 | sort | uniq -d
```

#### B. In Redis Hash (Less Likely)
**Key Pattern:** `props:{sport}:rows:prim`

**Symptoms:**
- Multiple SIDs pointing to the same event/player/market combination

**Check:**
```bash
# Get specific row data
redis-cli HGET "props:nfl:rows:prim" "YOUR_SID_HERE"

# Check if multiple SIDs have same event+entity+market
# (This requires manual inspection of the data)
```

#### C. In Ingestor Logic (Root Cause)
**Symptoms:**
- Ingestor is adding the same SID multiple times to sorted sets
- Ingestor is creating multiple SIDs for the same logical row

**Check Ingestor Logs:**
Look for patterns like:
- "Adding SID abc123 to props:nfl:sort:roi:pregame:spread"
- Multiple additions of the same SID
- SID generation logic creating non-unique SIDs

## Diagnostic Commands

### 0. **RECOMMENDED: Find Duplicate Rows** ⭐
```bash
# This will show you exactly which rows have multiple SIDs
tsx scripts/find-duplicate-rows.ts nfl

# Check specific market
tsx scripts/find-duplicate-rows.ts nfl spread
```

**This script will:**
- Show all logical rows that have multiple SIDs
- Display the duplicate SIDs for each row
- Show event, market, and line information
- Calculate efficiency stats
- Check if duplicates are in sorted sets

### 1. Check for Duplicate SIDs in Sorted Set
```bash
# For NFL spread market (pregame)
redis-cli ZRANGE "props:nfl:sort:roi:pregame:spread" 0 -1 > /tmp/sids.txt
sort /tmp/sids.txt | uniq -d

# If you see output, those are duplicate SIDs
```

### 2. Count Occurrences of a Specific SID
```bash
# Replace YOUR_SID with actual SID from screenshot
redis-cli ZCOUNT "props:nfl:sort:roi:pregame:spread" -inf +inf
redis-cli ZSCORE "props:nfl:sort:roi:pregame:spread" "YOUR_SID"

# Check how many times it appears
redis-cli ZRANGE "props:nfl:sort:roi:pregame:spread" 0 -1 | grep -c "YOUR_SID"
```

### 3. Inspect Row Data
```bash
# Get the actual row data for a SID
redis-cli HGET "props:nfl:rows:prim" "YOUR_SID" | jq '.'

# Look for:
# - eid (event ID)
# - ent (entity ID)
# - mkt (market)
# - ln (line)
```

### 4. Check API Response
```bash
# Test the API endpoint directly
curl "http://localhost:3000/api/props/table?sport=nfl&market=spread&scope=pregame&limit=50" | jq '.sids | group_by(.) | map({sid: .[0], count: length}) | map(select(.count > 1))'

# This will show any SIDs that appear more than once in the API response
```

### 5. Check Frontend Duplicate Detection
Open browser console on `/odds/nfl?type=game&market=spread` and look for:
```
[ADAPTER] Duplicate IDs detected: ['evt123-game-spread-3.5 (3x)', ...]
```

## Quick Fix (Temporary)

### Frontend Deduplication
Add this to `lib/api-adapters/props-to-odds.ts` after line 284:

```typescript
export function transformPropsResponseToOddsScreen(
  response: PropsTableResponse,
  type: 'player' | 'game'
): OddsScreenItem[] {
  // ... existing code ...
  
  // TEMPORARY FIX: Deduplicate by ID
  const seen = new Map<string, OddsScreenItem>()
  items.forEach(item => {
    if (!seen.has(item.id)) {
      seen.set(item.id, item)
    } else {
      console.warn('[ADAPTER] Skipping duplicate ID:', item.id)
    }
  })
  
  return Array.from(seen.values())
}
```

**⚠️ This is a band-aid fix. The real issue is in the ingestor creating duplicate SIDs.**

## Permanent Fix (Backend)

### **PRIMARY FIX: Ensure Unique SID Generation** ⭐

The ingestor must generate a **deterministic, unique SID** for each logical row.

**SID should be based on:**
```typescript
// For game markets
const sid = `${eventId}-game-${market}-${line}`

// For player markets  
const sid = `${eventId}-${playerId}-${market}-${line}`
```

**Example:**
```typescript
// Good: Deterministic SID
const sid = `evt_123-game-spread-3.5`
// Every time we process this event+market+line, we get the same SID

// Bad: Random/timestamp-based SID
const sid = `${eventId}-${Date.now()}-${Math.random()}`
// Creates new SID every time = duplicates!
```

**Implementation:**
```typescript
function generateSID(event: Event, market: string, line: number, player?: Player): string {
  if (player) {
    // Player prop
    return `${event.id}-${player.id}-${market}-${line}`
  } else {
    // Game market
    return `${event.id}-game-${market}-${line}`
  }
}

// When processing odds:
const sid = generateSID(event, market, line, player)

// This SID will be the same every time we process this combination
// So we'll update the existing row instead of creating a new one
await redis.hset(`props:${sport}:rows:prim`, sid, JSON.stringify(rowData))
await redis.zadd(`props:${sport}:sort:roi:${scope}:${market}`, score, sid)
```

### Option 2: Check and Reuse Existing SIDs
**If you need to keep existing SID format:**
```typescript
// Before creating a new SID, check if one exists for this logical row
const existingSid = await findExistingSID(eventId, entityId, market, line)

if (existingSid) {
  // Update existing row
  await redis.hset(`props:${sport}:rows:prim`, existingSid, JSON.stringify(rowData))
  await redis.zadd(`props:${sport}:sort:roi:${scope}:${market}`, score, existingSid)
} else {
  // Create new SID
  const newSid = generateUniqueSID()
  await redis.hset(`props:${sport}:rows:prim`, newSid, JSON.stringify(rowData))
  await redis.zadd(`props:${sport}:sort:roi:${scope}:${market}`, score, newSid)
}
```

### Option 3: Periodic Cleanup Job (Band-aid)
```typescript
// Remove duplicate SIDs, keeping highest score
const allEntries = await redis.zrange(key, 0, -1, { WITHSCORES: true })
const sidScores = new Map()

for (let i = 0; i < allEntries.length; i += 2) {
  const sid = allEntries[i]
  const score = parseFloat(allEntries[i + 1])
  
  if (!sidScores.has(sid) || sidScores.get(sid) < score) {
    sidScores.set(sid, score)
  }
}

// Rebuild sorted set
await redis.del(key)
for (const [sid, score] of sidScores) {
  await redis.zadd(key, score, sid)
}
```

## Testing After Fix

1. **Clear Redis data:**
   ```bash
   redis-cli DEL "props:nfl:sort:roi:pregame:spread"
   redis-cli DEL "props:nfl:rows:prim"
   ```

2. **Restart ingestor** to repopulate data

3. **Check for duplicates:**
   ```bash
   redis-cli ZRANGE "props:nfl:sort:roi:pregame:spread" 0 -1 | sort | uniq -d
   ```
   Should return empty (no duplicates)

4. **Reload odds screen** and verify no duplicate rows

## Next Steps

1. ✅ Run diagnostic commands above to confirm root cause
2. ✅ Check ingestor logs for duplicate SID additions
3. ✅ Implement frontend deduplication (temporary)
4. ✅ Fix ingestor to prevent duplicate SIDs (permanent)
5. ✅ Add monitoring/alerts for duplicate SIDs in production

## Questions to Answer

- [ ] Are duplicate SIDs in the sorted set?
- [ ] Is the ingestor adding the same SID multiple times?
- [ ] Are SIDs being generated correctly (unique per event+entity+market+line)?
- [ ] Is there a race condition in the ingestor?
- [ ] Are old SIDs being cleaned up properly?

