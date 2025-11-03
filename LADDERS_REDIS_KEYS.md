# Ladders Redis Keys Documentation

This document outlines all the Redis keys used by the Ladders feature to ensure your VPS ingestor scripts create the necessary keys for all sports.

## Overview

The Ladders feature relies on several Redis key patterns to function. These keys are created by your VPS ingestor scripts running outside this project. For the NFL ladder to work (and any other sport), you need to ensure all these keys are populated.

---

## Required Redis Keys by Sport

Replace `{sport}` with the sport code: `nfl`, `nba`, `nhl`, `ncaaf`, etc.

### 1. **Alternate Lines Data** (CRITICAL)
**Pattern:** `props:{sport}:rows:alt:{sid}`  
**Type:** String (JSON)  
**Used by:** `/api/props/alt/route.ts`

This is the **primary data source** for ladder lines. Each SID (unique identifier for a player+market+event combination) must have this key.

**Expected Structure:**
```json
{
  "eid": "event_id_here",
  "ent": "player_entity_id",
  "mkt": "receiving_yards",
  "player": "Player Name",
  "team": "PHI",
  "position": "WR",
  "primary_ln": 67.5,
  "ev": {
    "eid": "event_id_here",
    "event": {
      "dt": "2024-12-29T20:00:00Z",
      "live": false,
      "home": "DAL",
      "away": "PHI"
    },
    "live": false
  },
  "lines": [
    {
      "ln": 67.5,
      "books": {
        "draftkings": {
          "over": { "price": -110, "link": "https://..." },
          "under": { "price": -110, "link": "https://..." }
        },
        "fanduel": { ... }
      },
      "best": {
        "over": { "book": "draftkings", "price": -110 },
        "under": { "book": "fanduel", "price": -105 }
      },
      "avg": {
        "over": -112,
        "under": -108
      }
    }
  ]
}
```

---

### 2. **Available Markets**
**Pattern:** `props:{sport}:mkts`  
**Type:** Set  
**Used by:** `/api/props/mkts/route.ts`

Contains all available markets for the sport (e.g., `passing_yards`, `rushing_yards`, `receiving_yards`).

**Example:**
```bash
SADD props:nfl:mkts "passing_yards"
SADD props:nfl:mkts "rushing_yards"
SADD props:nfl:mkts "receiving_yards"
SADD props:nfl:mkts "passing_tds"
SADD props:nfl:mkts "receptions"
```

---

### 3. **Players by Market**
**Pattern:** `props:{sport}:players:mkt:{market}`  
**Type:** Set  
**Used by:** `/api/props/players/route.ts`

Contains all player entity IDs that have props for a specific market.

**Example:**
```bash
SADD props:nfl:players:mkt:receiving_yards "player_entity_id_1"
SADD props:nfl:players:mkt:receiving_yards "player_entity_id_2"
```

---

### 4. **Player Metadata**
**Pattern:** `props:{sport}:player:{ent}`  
**Type:** Hash  
**Used by:** `/api/props/players/route.ts`

Contains player information (name, team, position).

**Example:**
```bash
HSET props:nfl:player:player_entity_id_1 name "Patrick Mahomes"
HSET props:nfl:player:player_entity_id_1 team "KC"
HSET props:nfl:player:player_entity_id_1 position "QB"
```

---

### 5. **SIDs by Entity and Market**
**Pattern:** `props:{sport}:sids:ent:{ent}:mkt:{market}`  
**Type:** Set  
**Used by:** `/api/props/find/route.ts`

Maps a player entity ID + market to all their SIDs (different events/games).

**Example:**
```bash
SADD props:nfl:sids:ent:player_entity_id_1:mkt:passing_yards "sid_game1"
SADD props:nfl:sids:ent:player_entity_id_1:mkt:passing_yards "sid_game2"
```

---

### 6. **Live Status Tracking** (Optional but Recommended)
**Pattern:** `props:{sport}:is_live`  
**Type:** Hash  
**Used by:** `/api/props/players/route.ts` (for scope filtering)

Tracks which SIDs are currently live vs pregame.

**Example:**
```bash
HSET props:nfl:is_live "sid_1" "0"  # 0 = pregame
HSET props:nfl:is_live "sid_2" "1"  # 1 = live
```

---

### 7. **SID to Primary SID Mapping** (Optional)
**Pattern:** `props:{sport}:sid2primary`  
**Type:** Hash  
**Used by:** `/api/props/find/route.ts` (for SID resolution)

Maps alternate SIDs to their primary SID if needed.

**Example:**
```bash
HSET props:nfl:sid2primary "old_sid" "new_primary_sid"
```

---

### 8. **Real-time Updates Stream** (Optional)
**Pattern:** `props:{sport}:alt:x`  
**Type:** Stream (Redis Stream)  
**Used by:** `/api/sse/alt/route.ts` (for live updates)

Stream of updates when alternate lines change. Used for real-time SSE updates.

**Example:**
```bash
XADD props:nfl:alt:x * sid "sid_123" ts "1234567890"
```

---

### 9. **Markets Index** (Optional Fallback)
**Pattern:** `idx:{sport}:props:markets`  
**Type:** String (JSON array)  
**Used by:** `/api/props/markets/route.ts`

Alternative way to store markets list (as JSON string instead of Set).

**Example:**
```bash
SET idx:nfl:props:markets '["passing_yards","rushing_yards","receiving_yards"]'
```

---

## Key Creation Checklist for New Sports

To enable ladders for a new sport (e.g., NBA, NHL), your ingestor must create:

### Critical (Required)
- [ ] `props:{sport}:rows:alt:{sid}` - For every player+market+event combination
- [ ] `props:{sport}:mkts` - Set of all available markets
- [ ] `props:{sport}:players:mkt:{market}` - For each market
- [ ] `props:{sport}:player:{ent}` - For each player
- [ ] `props:{sport}:sids:ent:{ent}:mkt:{market}` - For each player+market combo

### Recommended (Enhanced Features)
- [ ] `props:{sport}:is_live` - For live/pregame filtering
- [ ] `props:{sport}:alt:x` - For real-time updates

### Optional (Fallback/Legacy)
- [ ] `props:{sport}:sid2primary` - For SID resolution
- [ ] `idx:{sport}:props:markets` - Alternative markets storage

---

## Example: Complete NFL Setup

Here's what a minimal NFL setup looks like for one player in one game:

```bash
# 1. Add market to available markets
SADD props:nfl:mkts "receiving_yards"

# 2. Add player entity to market
SADD props:nfl:players:mkt:receiving_yards "player_123"

# 3. Store player metadata
HSET props:nfl:player:player_123 name "DeVonta Smith"
HSET props:nfl:player:player_123 team "PHI"
HSET props:nfl:player:player_123 position "WR"

# 4. Map player+market to SID
SADD props:nfl:sids:ent:player_123:mkt:receiving_yards "sid_abc123"

# 5. Store alternate lines data (CRITICAL)
SET props:nfl:rows:alt:sid_abc123 '{
  "eid": "event_456",
  "ent": "player_123",
  "mkt": "receiving_yards",
  "player": "DeVonta Smith",
  "team": "PHI",
  "position": "WR",
  "primary_ln": 67.5,
  "ev": {
    "eid": "event_456",
    "event": {
      "dt": "2024-12-29T20:00:00Z",
      "live": false,
      "home": "DAL",
      "away": "PHI"
    },
    "live": false
  },
  "lines": [
    {
      "ln": 57.5,
      "books": {
        "draftkings": {
          "over": { "price": 150, "link": "https://..." },
          "under": { "price": -180, "link": "https://..." }
        }
      },
      "best": {
        "over": { "book": "draftkings", "price": 150 },
        "under": { "book": "draftkings", "price": -180 }
      },
      "avg": { "over": 150, "under": -180 }
    },
    {
      "ln": 67.5,
      "books": { ... },
      "best": { ... },
      "avg": { ... }
    },
    {
      "ln": 77.5,
      "books": { ... },
      "best": { ... },
      "avg": { ... }
    }
  ]
}'

# 6. Mark as pregame (optional)
HSET props:nfl:is_live "sid_abc123" "0"
```

---

## Testing Your Keys

Use the test script to verify your keys are set up correctly:

```bash
# Check if keys exist for NFL
npx tsx scripts/check-nfl-keys.ts

# Or manually check in Redis CLI
redis-cli SMEMBERS props:nfl:mkts
redis-cli SMEMBERS props:nfl:players:mkt:receiving_yards
redis-cli GET props:nfl:rows:alt:YOUR_SID_HERE
```

---

## API Endpoints That Use These Keys

1. **GET /api/props/mkts** - Lists available markets
   - Uses: `props:{sport}:mkts`

2. **GET /api/props/players** - Lists players for a market
   - Uses: `props:{sport}:players:mkt:{market}`, `props:{sport}:player:{ent}`, `props:{sport}:sids:ent:{ent}:mkt:{market}`, `props:{sport}:rows:alt:{sid}`, `props:{sport}:is_live`

3. **GET /api/props/find** - Finds SIDs for a player+market
   - Uses: `props:{sport}:sids:ent:{ent}:mkt:{market}`, `props:{sport}:rows:alt:{sid}`, `props:{sport}:sid2primary`

4. **GET /api/props/alt** - Gets ladder data for a SID
   - Uses: `props:{sport}:rows:alt:{sid}`

5. **GET /api/sse/alt** - Real-time updates stream
   - Uses: `props:{sport}:alt:x`, `props:{sport}:rows:alt:{sid}`

---

## Notes for Ingestor Scripts

### Data Freshness
- Update `props:{sport}:rows:alt:{sid}` frequently (every 30-60 seconds recommended)
- The API caches this data for 5-10 seconds on the frontend

### SID Format
- SIDs should be unique per player+market+event combination
- Use a consistent hashing scheme (e.g., SHA1 of `player_id|market|event_id`)

### Line Format
- Include all available lines (not just the primary line)
- Each line should have `ln` (line value), `books` (all sportsbooks), `best` (best odds), and `avg` (average odds)
- Include deep links in the `link` field for each book when available

### Event Data
- Always include the `ev` object with event metadata
- Include `dt` (datetime), `home`, `away`, and `live` status

### Cleanup
- Remove stale SIDs after games complete
- Clean up old entries from `props:{sport}:is_live`
- Expire old stream entries in `props:{sport}:alt:x`

---

## Support

If you're setting up a new sport and need help, refer to:
- `LADDERS_TEST_ROUTES.md` - Testing endpoints
- `scripts/check-nfl-keys.ts` - Example key checking script
- `scripts/debug-live-nfl.ts` - Debug live data issues




