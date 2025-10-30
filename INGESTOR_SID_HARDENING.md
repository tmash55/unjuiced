# Ingestor SID Hardening Guide

## Overview
This document outlines the changes needed in the ingestor to keep SID mappings consistent and prevent 404s in the Ladders feature.

## Problem
- Stale SIDs in `props:{sport}:sids:ent:{ent}:mkt:{mkt}` SET
- No mapping from alternate line SIDs to primary family SID
- No cleanup when SIDs change or are deleted

## Solution: Three-Part Hardening

---

## 1. Keep `sids` SET Synced When Primary Changes

### Purpose
Track the current primary SID for each unique (event, entity, market) combination and update the mapping SET when it changes.

### Implementation

**Add new Redis key:**
```
props:{sport}:primary_current:{eid}|{ent}|{mkt} = {primary_sid}
```

**In the "family changed" block of your ingestor:**

```typescript
// When processing a family/bucket and determining the primary SID
const primarySid = /* your logic to get primary SID */
const eid = event.id
const ent = entity.id // e.g., "pid:00-0036389" or "game"
const mkt = market // e.g., "passing_yards"

// 1. Check if there was a previous primary SID
const currentKey = `props:${sport}:primary_current:${eid}|${ent}|${mkt}`
const oldPrimarySid = await redis.get(currentKey)

// 2. If primary SID changed, update the sids SET
if (oldPrimarySid && oldPrimarySid !== primarySid) {
  // Remove old SID from mapping
  await redis.srem(`props:${sport}:sids:ent:${ent}:mkt:${mkt}`, oldPrimarySid)
  
  // Add new SID to mapping
  await redis.sadd(`props:${sport}:sids:ent:${ent}:mkt:${mkt}`, primarySid)
  
  console.log(`[SID_SYNC] Updated primary for ${eid}|${ent}|${mkt}: ${oldPrimarySid} → ${primarySid}`)
}

// 3. Always ensure current primary is in the mapping
await redis.sadd(`props:${sport}:sids:ent:${ent}:mkt:${mkt}`, primarySid)

// 4. Store the current primary SID
await redis.set(currentKey, primarySid)
```

**Example:**
```typescript
// Mariota passing yards family changed
// Old primary: 6092e215a2376bc522868b328ee036ab78890a93
// New primary: 72ec7cd248b5995c10331e6d7629214cf33f53c7

// Remove old from SET
SREM "props:nfl:sids:ent:pid:00-0036389:mkt:passing_yards" "6092e215..."

// Add new to SET
SADD "props:nfl:sids:ent:pid:00-0036389:mkt:passing_yards" "72ec7cd2..."

// Update current tracker
SET "props:nfl:primary_current:evt123|pid:00-0036389|passing_yards" "72ec7cd2..."
```

---

## 2. Map Any SID to the Family SID

### Purpose
Allow the API to rescue stale SIDs by redirecting them to the current primary/family SID.

### Implementation

**Add new Redis HASH:**
```
props:{sport}:sid2primary
```

**In the "family changed" block (after step 1):**

```typescript
// For each line in the family/bucket
for (const line of bucket.lines) {
  // Build SID for this specific line
  const lineSid = buildSid(eid, ent, mkt, line.ln)
  
  // Map this line's SID to the primary family SID
  await redis.hset(`props:${sport}:sid2primary`, lineSid, primarySid)
}

// Also map the primary SID to itself (for consistency)
await redis.hset(`props:${sport}:sid2primary`, primarySid, primarySid)
```

**Example:**
```typescript
// Mariota passing yards family
// Primary SID: 72ec7cd248b5995c10331e6d7629214cf33f53c7
// Lines: 199.5, 224.5, 249.5, 274.5, 299.5

// Map each line SID to primary
HSET "props:nfl:sid2primary" "evt123-pid:00-0036389-passing_yards-199.5" "72ec7cd2..."
HSET "props:nfl:sid2primary" "evt123-pid:00-0036389-passing_yards-224.5" "72ec7cd2..."
HSET "props:nfl:sid2primary" "evt123-pid:00-0036389-passing_yards-249.5" "72ec7cd2..."
HSET "props:nfl:sid2primary" "evt123-pid:00-0036389-passing_yards-274.5" "72ec7cd2..."
HSET "props:nfl:sid2primary" "evt123-pid:00-0036389-passing_yards-299.5" "72ec7cd2..."

// Map primary to itself
HSET "props:nfl:sid2primary" "72ec7cd2..." "72ec7cd2..."
```

**How the API uses this:**
```typescript
// User selects Mariota, API gets stale SID: 6092e215...
// API checks: EXISTS props:nfl:rows:alt:6092e215... → 0 (doesn't exist)
// API looks up: HGET props:nfl:sid2primary 6092e215... → 72ec7cd2... (redirects)
// API checks: EXISTS props:nfl:rows:alt:72ec7cd2... → 1 (exists!)
// API returns: 72ec7cd2... (user gets correct data)
```

---

## 3. Clean on Deletions

### Purpose
Remove stale mappings when SIDs are deleted.

### Implementation

**In your existing deletion path (where you remove from indexes):**

```typescript
// When deleting a SID (e.g., event ended, data expired, etc.)
const sidToDelete = /* the SID being deleted */

// You already have these from your deletion logic:
const eid = /* event ID */
const ent = /* entity ID */
const mkt = /* market */

// 1. Remove from sids SET
await redis.srem(`props:${sport}:sids:ent:${ent}:mkt:${mkt}`, sidToDelete)

// 2. Remove from sid2primary mapping
await redis.hdel(`props:${sport}:sid2primary`, sidToDelete)

// 3. If this was the primary SID, clean up the current tracker
const currentKey = `props:${sport}:primary_current:${eid}|${ent}|${mkt}`
const currentPrimary = await redis.get(currentKey)
if (currentPrimary === sidToDelete) {
  await redis.del(currentKey)
}

console.log(`[SID_CLEANUP] Removed ${sidToDelete} from all mappings`)
```

---

## 4. One-Time Repair (Optional)

### Purpose
Clean up existing stale SIDs in the mapping SETs.

### When to Run
- After implementing the above changes
- Before going to production
- Can be run safely multiple times

### Implementation

```typescript
// Script to repair all sids SETs
async function repairSidsSets(sport: string) {
  // Get all sids SET keys
  const pattern = `props:${sport}:sids:ent:*:mkt:*`
  const keys = await redis.keys(pattern)
  
  console.log(`[REPAIR] Found ${keys.length} sids SETs to check`)
  
  let totalChecked = 0
  let totalRemoved = 0
  
  for (const key of keys) {
    // Get all SIDs in this SET
    const sids = await redis.smembers(key)
    
    for (const sid of sids) {
      totalChecked++
      
      // Check if alternate lines exist
      const altExists = await redis.exists(`props:${sport}:rows:alt:${sid}`)
      
      if (altExists === 0) {
        // Check if there's a sid2primary mapping
        const primarySid = await redis.hget(`props:${sport}:sid2primary`, sid)
        
        if (!primarySid) {
          // No alternate lines and no mapping → stale SID, remove it
          await redis.srem(key, sid)
          totalRemoved++
          console.log(`[REPAIR] Removed stale SID from ${key}: ${sid}`)
        }
      }
    }
  }
  
  console.log(`[REPAIR] Complete: Checked ${totalChecked} SIDs, removed ${totalRemoved} stale entries`)
}

// Run for each sport
await repairSidsSets('nfl')
await repairSidsSets('nba')
await repairSidsSets('nhl')
await repairSidsSets('ncaaf')
```

**Or as a one-liner per sport:**
```bash
# NFL
redis-cli --eval repair-sids.lua nfl

# Where repair-sids.lua contains the logic above
```

---

## Testing

### 1. Test Primary SID Changes
```typescript
// Simulate a family update where primary changes
const oldSid = "old-sid-123"
const newSid = "new-sid-456"

// Before: sids SET contains old-sid-123
// After: sids SET contains new-sid-456 (old removed, new added)
```

### 2. Test sid2primary Mapping
```typescript
// Create a family with multiple lines
// Verify each line SID maps to primary
const lineSid = "evt-ent-mkt-199.5"
const primarySid = await redis.hget(`props:nfl:sid2primary`, lineSid)
// Should return the primary family SID
```

### 3. Test Deletion Cleanup
```typescript
// Delete a SID
// Verify it's removed from:
// - props:nfl:sids:ent:{ent}:mkt:{mkt}
// - props:nfl:sid2primary
// - props:nfl:primary_current:{eid}|{ent}|{mkt} (if it was primary)
```

### 4. Test API Guard
```bash
# Try to find a player that had stale SIDs
curl "http://localhost:3000/api/props/find?sport=nfl&ent=pid:00-0036389&mkt=passing_yards"

# Should return:
# - Only valid SIDs (that exist in rows:alt)
# - Or resolved SIDs (via sid2primary mapping)
# - No stale SIDs that would cause 404s
```

---

## Monitoring

### Key Metrics to Track

1. **Stale SID Rate:**
   ```typescript
   // In /api/props/find
   const droppedRate = (candidateSids.length - validatedSids.length) / candidateSids.length
   // Should decrease to ~0% after hardening
   ```

2. **sid2primary Hit Rate:**
   ```typescript
   // Track how often we use sid2primary to rescue a stale SID
   // High rate = good (we're rescuing SIDs)
   // Decreasing rate = even better (fewer stale SIDs being created)
   ```

3. **Primary SID Changes:**
   ```typescript
   // Log when primary SIDs change
   console.log(`[SID_SYNC] Primary changed for ${eid}|${ent}|${mkt}`)
   // Should be rare in production
   ```

---

## Summary

### Immediate Fix (Already Implemented)
✅ **API Guard in `/api/props/find`** - Validates SIDs before returning, uses sid2primary to rescue stale SIDs

### Ingestor Changes Needed
1. ⏳ **Track current primary SID** - Update sids SET when primary changes
2. ⏳ **Map all SIDs to primary** - Allow API to resolve any SID to family SID
3. ⏳ **Clean on deletion** - Remove from all mappings when deleting SIDs
4. ⏳ **One-time repair** - Clean up existing stale SIDs (optional but recommended)

### Expected Results
- ✅ No more 404s in Ladders feature
- ✅ Stale SIDs automatically resolved to current SIDs
- ✅ Mappings stay consistent as data changes
- ✅ Clean deletion without orphaned references

---

## Questions?

If you need help implementing any of these changes in your ingestor, let me know and I can provide more specific code examples based on your ingestor's structure!

