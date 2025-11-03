# Best Odds Backend Issue - RESOLVED ✅

## Problem (RESOLVED)

The frontend API was looking for `best_odds:all:rows` but backend uses per-sport HASHes.

**Status:**
- ✅ ZSET exists: `best_odds:all:sort:improvement` (has 10+ entries)
- ✅ HASH exists: `props:nfl:best_odds:rows`, `props:nba:best_odds:rows`, etc. (per sport)
- ✅ Frontend API updated to use per-sport structure

## What We Found

### ZSET Structure (Working)
```
Key: best_odds:all:sort:improvement
Type: ZSET
Members: 
  - nfl:f2617c37-9050-5fc6-982e-6476a4ec5da0:pid:00-0038809:player_touchdowns:0.5:o
  - nfl:8926e950-8ad1-51ca-b34e-6f0ee149a949:pid:00-0036590:player_touchdowns:0.5:o
  - ...
Scores: 208.97, 189.45, ... (improvement percentages)
```

### HASH Structure (Missing!)
```
Key: best_odds:all:rows
Type: HASH
Status: DOES NOT EXIST ❌
```

**Expected:** This HASH should contain the full deal data for each ZSET member.

## What the Backend Needs to Do

The ingestor needs to populate BOTH keys:

### 1. ZSET for Sorting (Already Working)
```python
# Current code (working):
redis.zadd('best_odds:all:sort:improvement', {
    'nfl:f2617c37-...:pid:00-0038809:player_touchdowns:0.5:o': 208.97
})
```

### 2. HASH for Data (MISSING - Need to Add)
```python
# Missing code - needs to be added:
deal_data = {
    "sport": "nfl",
    "eid": "f2617c37-9050-5fc6-982e-6476a4ec5da0",
    "ent": "pid:00-0038809",
    "mkt": "player_touchdowns",
    "ln": 0.5,
    "side": "o",
    "best_book": "draftkings",
    "best_price": -110,
    "best_link": "https://...",
    "num_books": 8,
    "avg_price": -120,
    "price_improvement": 208.97,
    "all_books": [...],
    "scope": "pregame",
    "last_updated": 1234567890
}

# Store in HASH (the field should match the ZSET member, possibly without "nfl:" prefix)
redis.hset(
    'best_odds:all:rows',
    'f2617c37-9050-5fc6-982e-6476a4ec5da0:pid:00-0038809:player_touchdowns:0.5:o',
    json.dumps(deal_data)
)
```

## Questions for Backend Team

1. **Is there a different HASH key being used?**
   - Instead of `best_odds:all:rows`, is it `props:nfl:best_odds:rows`?
   - Or some other pattern?

2. **Are you storing the data in a different format?**
   - STRING keys per deal instead of HASH?
   - Different Redis structure entirely?

3. **Is this feature fully implemented on the backend?**
   - Maybe only the ZSET part is done?
   - Maybe the HASH population is in a different branch?

## How to Debug on VPS

SSH into your VPS and check Redis:

```bash
# Connect to Redis
redis-cli

# Check if ZSET exists (should say 1)
EXISTS best_odds:all:sort:improvement

# Check how many items in ZSET (should be > 0)
ZCARD best_odds:all:sort:improvement

# Get sample ZSET members
ZRANGE best_odds:all:sort:improvement 0 5 WITHSCORES REV

# Check if HASH exists (currently returns 0 = NO)
EXISTS best_odds:all:rows

# Check HASH length (currently returns 0)
HLEN best_odds:all:rows

# Try alternative HASH keys
EXISTS props:nfl:best_odds:rows
EXISTS best_odds:nfl:rows
EXISTS props:best_odds:all:rows

# Check all keys matching pattern
KEYS *best_odds*rows*
```

## Temporary Workaround

If the backend uses a different structure, we can adapt the frontend API. Just tell us:

1. **What Redis key(s) store the actual deal data?**
2. **What format is the data in?** (HASH fields? STRING keys? JSON?)
3. **What's the key/field pattern?**

## Example: If Using Per-Sport HASHes

If your backend uses `props:nfl:best_odds:rows` instead of `best_odds:all:rows`:

```python
# Backend might be doing this:
redis.hset(
    'props:nfl:best_odds:rows',
    'f2617c37-...:pid:00-0038809:player_touchdowns:0.5:o',
    json.dumps(deal_data)
)
```

Then we need to update the frontend API to extract the sport from the ZSET member and query the appropriate HASH.

## Next Steps

1. **Check your backend ingestor code** - Is it writing to `best_odds:all:rows`?
2. **Check Redis directly** - Use the commands above to find where the data actually is
3. **Share the findings** - Tell us what keys exist and we'll adapt the API

The ZSET is working perfectly, we just need to find where the actual deal data is stored! 🔍

