# Odds Screen - Redis Keys Reference

## Overview

The odds screen uses a **different set of keys** than the ladders component. Both work independently with their own Redis key patterns.

---

## Critical Keys for Odds Screen

### 1. ROI-Sorted SIDs (ZSET) ⭐ **CRITICAL**
**Key Pattern:** `props:{sport}:sort:roi:{scope}:{market}`

**Type:** ZSET (Sorted Set)

**Purpose:** Stores SIDs sorted by ROI score (highest first)

**Examples:**
```
props:nba:sort:roi:pregame:player_points
props:nba:sort:roi:live:player_points
props:nfl:sort:roi:pregame:passing_yards
```

**Structure:**
```redis
ZADD props:nba:sort:roi:pregame:player_points 95.2 sid_abc123
ZADD props:nba:sort:roi:pregame:player_points 94.8 sid_def456
ZADD props:nba:sort:roi:pregame:player_points 93.1 sid_ghi789
```

**How it's used:**
- API route queries this ZSET in descending order (highest ROI first)
- Returns top N SIDs based on `limit` parameter
- Supports pagination with `cursor` (offset-based)

---

### 2. Primary Row Data (HASH) ⭐ **CRITICAL**
**Key Pattern:** `props:{sport}:rows:prim`

**Type:** HASH (single hash per sport)

**Purpose:** Stores the actual row data for each SID

**Examples:**
```
props:nba:rows:prim
props:nfl:rows:prim
props:nhl:rows:prim
```

**Structure:**
```redis
HSET props:nba:rows:prim sid_abc123 '{"ent":"pid:00-0036355","name":"LeBron James","position":"F","team":"LAL","ev":{"id":"evt123","start":"2025-01-15T20:00:00Z","home":"LAL","away":"GSW"},"ln":25.5,"best":{"over":{"price":105,"book":"draftkings"},"under":{"price":-125,"book":"fanduel"}},"books":{...}}'
```

**Row Data Format:**
```json
{
  "sid": "sid_abc123",
  "ent": "pid:00-0036355",
  "name": "LeBron James",
  "position": "F",
  "team": "LAL",
  "mkt": "player_points",
  "ln": 25.5,
  "ev": {
    "id": "evt123",
    "start": "2025-01-15T20:00:00Z",
    "home": "LAL",
    "away": "GSW"
  },
  "best": {
    "over": {
      "price": 105,
      "book": "draftkings",
      "line": 25.5
    },
    "under": {
      "price": -125,
      "book": "fanduel",
      "line": 25.5
    }
  },
  "books": {
    "draftkings": {
      "over": { "price": 105 },
      "under": { "price": -120 }
    },
    "fanduel": {
      "over": { "price": 100 },
      "under": { "price": -125 }
    },
    // ... all sportsbooks
  }
}
```

---

## Data Flow

### How Odds Screen Loads Data

```
1. User navigates to /odds/nba
   ↓
2. Frontend requests: /api/props/table?sport=nba&market=player_points&scope=pregame&limit=100
   ↓
3. API queries: ZRANGE props:nba:sort:roi:pregame:player_points 0 99 REV
   Returns: [sid1, sid2, sid3, ..., sid100]
   ↓
4. API queries: HMGET props:nba:rows:prim sid1 sid2 sid3 ... sid100
   Returns: [row1, row2, row3, ..., row100]
   ↓
5. API returns: { sids: [...], rows: [...], nextCursor: "100" }
   ↓
6. Adapter transforms to OddsTableItem format
   ↓
7. Table displays rows
```

---

## What Your Ingestor Must Do

For **each sport** (`nba`, `nfl`, `nhl`, `ncaaf`, `mlb`, etc.):

### Step 1: Create Sorted Sets (per market, per scope)

For each market (e.g., `player_points`, `player_assists`, `passing_yards`):

```python
# For each player prop with odds
sid = generate_unique_sid(player, market, event, line)
roi_score = calculate_roi(odds)

# Add to pregame ZSET
redis.zadd(f"props:{sport}:sort:roi:pregame:{market}", {sid: roi_score})

# If live, also add to live ZSET
if is_live:
    redis.zadd(f"props:{sport}:sort:roi:live:{market}", {sid: roi_score})
```

### Step 2: Create Row Data Hash

Store the complete row data in the sport-wide hash:

```python
row_data = {
    "sid": sid,
    "ent": player_entity_id,  # e.g., "pid:00-0036355"
    "name": player_name,
    "position": player_position,
    "team": player_team,
    "mkt": market,
    "ln": primary_line,
    "ev": {
        "id": event_id,
        "start": event_start_time,
        "home": home_team,
        "away": away_team
    },
    "best": {
        "over": {"price": best_over_price, "book": best_over_book},
        "under": {"price": best_under_price, "book": best_under_book}
    },
    "books": {
        "draftkings": {"over": {...}, "under": {...}},
        "fanduel": {"over": {...}, "under": {...}},
        # ... all books
    }
}

redis.hset(f"props:{sport}:rows:prim", sid, json.dumps(row_data))
```

---

## NBA Example: Player Points

### Scenario
6 NBA games tonight, ~10 players per game with point props = ~60 rows

### Required Keys

#### 1. Sorted Set
```bash
# Should have ~60 members (one per player prop)
ZCARD props:nba:sort:roi:pregame:player_points
# Expected: 60

# View top 10
ZRANGE props:nba:sort:roi:pregame:player_points 0 9 REV WITHSCORES
```

#### 2. Row Data Hash
```bash
# Should have hundreds/thousands of SIDs across all markets
HLEN props:nba:rows:prim
# Expected: 500-1000+ (all markets combined)

# Check specific SID
HGET props:nba:rows:prim sid_from_above
# Expected: JSON row data
```

---

## Debugging Missing Rows

### Symptom
"Only seeing a few player props even though there are 6 games"

### Diagnosis Steps

#### Step 1: Check if sorted set exists and has entries
```bash
# Check key exists
EXISTS props:nba:sort:roi:pregame:player_points

# Count entries
ZCARD props:nba:sort:roi:pregame:player_points

# View all SIDs (if reasonable size)
ZRANGE props:nba:sort:roi:pregame:player_points 0 -1 REV
```

**Expected:** Should see ~60-100 SIDs for 6 games

**If empty:** Your ingestor isn't creating the sorted set

#### Step 2: Check if row data hash exists
```bash
# Check key exists
EXISTS props:nba:rows:prim

# Count entries (across all markets)
HLEN props:nba:rows:prim

# Check specific SID from sorted set
HGET props:nba:rows:prim <sid_from_step1>
```

**Expected:** Should return JSON row data

**If null:** Your ingestor isn't creating row data for that SID

#### Step 3: Check API response
```bash
curl "http://localhost:3000/api/props/table?sport=nba&market=player_points&scope=pregame&limit=100"
```

**Expected:**
```json
{
  "sids": ["sid1", "sid2", ...],
  "rows": [{...}, {...}, ...],
  "nextCursor": null
}
```

---

## Common Issues

### Issue 1: Deleted `props:nba:rows:prim`
**Symptom:** Sorted sets have SIDs, but no rows returned

**Cause:** The hash was deleted, so row data lookups fail

**Fix:** Re-run your ingestor to populate the hash. The hash accumulates ALL markets' data, so deleting it removes everything.

**Important:** `props:{sport}:rows:prim` is a **single hash per sport** containing rows for ALL markets. Don't delete it unless you're repopulating everything.

---

### Issue 2: Sorted sets not populated
**Symptom:** API returns empty `sids` array

**Cause:** Your ingestor isn't creating the ZSETs

**Fix:** Ensure your ingestor runs `ZADD props:{sport}:sort:roi:{scope}:{market} {score} {sid}` for each prop

---

### Issue 3: Duplicate SIDs
**Symptom:** Same player/game appearing multiple times

**Cause:** Multiple SIDs created for the same logical row (same event + player + line)

**Fix:** Ensure your SID generation is deterministic:
```python
# Good: Same inputs = same SID
sid = hashlib.sha1(f"{event_id}:{entity_id}:{market}:{line}".encode()).hexdigest()

# Bad: Random component or timestamp
sid = f"{event_id}_{random.uuid4()}"  # ❌ Creates duplicates
```

See `DUPLICATE_ROWS_DEBUG.md` for more details.

---

## Summary

### For Odds Screen to Work:
1. ✅ `props:{sport}:sort:roi:{scope}:{market}` - ZSET with SIDs sorted by ROI
2. ✅ `props:{sport}:rows:prim` - HASH mapping SIDs to row data

### For Ladders to Work:
1. ✅ `props:{sport}:players:mkt:{mkt}` - Set of player entities per market
2. ✅ `props:{sport}:player:{ent}` - Hash with player metadata
3. ✅ `props:{sport}:rows:alt:{sid}` - Alternate lines family data

### These Are Independent Systems:
- **Odds Screen:** Uses `prim` (primary) rows for display
- **Ladders:** Uses `alt` (alternate) rows for line families
- **Both need player metadata**, but access it differently

---

## Verification Script

Check all required keys for NBA:

```bash
# Check sorted sets (one per market)
redis-cli KEYS "props:nba:sort:roi:*"

# Count SIDs in player_points market
redis-cli ZCARD props:nba:sort:roi:pregame:player_points

# Check primary rows hash exists
redis-cli EXISTS props:nba:rows:prim

# Count total rows across all markets
redis-cli HLEN props:nba:rows:prim

# Sample: Get top 5 SIDs and their data
redis-cli --eval - <<EOF
local sids = redis.call('ZRANGE', 'props:nba:sort:roi:pregame:player_points', 0, 4, 'REV')
for i, sid in ipairs(sids) do
  local row = redis.call('HGET', 'props:nba:rows:prim', sid)
  print(sid, row)
end
EOF
```

Expected output:
- Multiple ZSET keys (one per market)
- Each ZSET should have 50-100+ SIDs for active games
- Hash should exist with hundreds/thousands of entries
- Each SID should map to valid JSON row data

