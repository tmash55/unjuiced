# Fix: Populating Player List Keys from Existing Alternates

## The Problem

You have alternates keys like:
```
props:nfl:rows:alt:49b97d735d11b252b72e357fe60e851e08bd90c8
```

Which contain player data:
```json
{
  "eid": "232d2dbe-f155-5d45-a6b2-bc091c5701ba",
  "ent": "pid:00-0036355",
  "mkt": "passing_yards",
  "player": {
    "name": "Justin Herbert",
    "team": "LAC",
    "position": "QB"
  },
  ...
}
```

But the player doesn't show up in the ladders dropdown because these keys are missing:
1. `props:nfl:players:mkt:passing_yards` doesn't contain `pid:00-0036355`
2. `props:nfl:player:pid:00-0036355` doesn't exist or has no `name` field

## The Solution

Your ingestor needs to create **two additional keys** for each player in each market:

### 1. Player List Set (per market)
**Key:** `props:{sport}:players:mkt:{mkt}`  
**Type:** Set  
**Purpose:** Lists all player entities available for a market

Example:
```redis
SADD props:nfl:players:mkt:passing_yards pid:00-0036355
SADD props:nfl:players:mkt:passing_yards pid:00-0039732
SADD props:nfl:players:mkt:passing_yards pid:00-0040743
# ... for all players with passing_yards alternates
```

### 2. Player Metadata Hash (per player)
**Key:** `props:{sport}:player:{ent}`  
**Type:** Hash  
**Purpose:** Stores player metadata for display in dropdowns

Example:
```redis
HSET props:nfl:player:pid:00-0036355 name "Justin Herbert"
HSET props:nfl:player:pid:00-0036355 team "LAC"
HSET props:nfl:player:pid:00-0036355 position "QB"
```

## How to Populate These Keys from Existing Alternates

Since you already have the `props:{sport}:rows:alt:{sid}` keys with all the player data, you can scan them and extract the information:

### Pseudocode for your ingestor:

```python
# For each sport
for sport in ["nfl", "nba", "nhl", "ncaaf"]:
    
    # Scan all alternate keys
    for alt_key in redis.scan_iter(f"props:{sport}:rows:alt:*"):
        
        # Get the family data
        family = redis.get(alt_key)
        
        # Extract player info
        ent = family["ent"]           # e.g., "pid:00-0036355"
        mkt = family["mkt"]            # e.g., "passing_yards"
        player_name = family["player"]["name"]   # e.g., "Justin Herbert"
        player_team = family.get("team", family["player"].get("team"))
        player_position = family.get("position", family["player"].get("position"))
        
        # 1. Add to player list for this market
        redis.sadd(f"props:{sport}:players:mkt:{mkt}", ent)
        
        # 2. Create/update player metadata hash
        redis.hset(f"props:{sport}:player:{ent}", "name", player_name)
        redis.hset(f"props:{sport}:player:{ent}", "team", player_team)
        redis.hset(f"props:{sport}:player:{ent}", "position", player_position)
```

### Example with your specific case:

For the alternate key `props:nfl:rows:alt:49b97d735d11b252b72e357fe60e851e08bd90c8`:

```bash
# Extract from the family data:
# - ent: "pid:00-0036355"
# - mkt: "passing_yards"
# - player.name: "Justin Herbert"
# - player.team: "LAC" (or team.abbr)
# - player.position: "QB"

# Then create:
SADD props:nfl:players:mkt:passing_yards pid:00-0036355

HMSET props:nfl:player:pid:00-0036355 \
  name "Justin Herbert" \
  team "LAC" \
  position "QB"
```

## Verification

After running your ingestor fix, verify:

```bash
# 1. Check if player is in the market set
SISMEMBER props:nfl:players:mkt:passing_yards pid:00-0036355
# Should return 1 (true)

# 2. Check player metadata exists
HGETALL props:nfl:player:pid:00-0036355
# Should return:
# 1) "name"
# 2) "Justin Herbert"
# 3) "team"
# 4) "LAC"
# 5) "position"
# 6) "QB"

# 3. Check how many players in the market
SCARD props:nfl:players:mkt:passing_yards
# Should return 20-30+ (number of QBs with passing yards props)
```

## Debug Logging

After restarting your Next.js dev server, you'll see logs like:

### If the set is empty:
```
[/api/props/players] ⚠️  EMPTY SET: props:nfl:players:mkt:passing_yards contains no players!
[/api/props/players] 💡 Your ingestor needs to populate this set with player entities
```

### If a specific player is missing:
```
[/api/props/players] ❌ pid:00-0036355 (Justin Herbert) NOT found in props:nfl:players:mkt:passing_yards
[/api/props/players] 💡 Your ingestor needs to add this entity to the set
```

### If the player metadata hash is missing:
```
[/api/props/players] ❌ pid:00-0036355: No 'name' field in props:nfl:player:pid:00-0036355
[/api/props/players]    Hash contents: {}
[/api/props/players]    💡 Your ingestor needs to create this hash with {name, team, position}
```

### When everything is working:
```
[/api/props/players] 🔍 Fetching players for market: passing_yards
[/api/props/players] Found 25 entities in props:nfl:players:mkt:passing_yards
[/api/props/players] ✅ pid:00-0036355 (Justin Herbert) found in player set
[/api/props/players] Summary for passing_yards:
  - Total entities processed: 25
  - Filtered (no metadata): 0
  - Final players returned: 25
```

## Summary

**Root Cause:** The `props:nfl:rows:alt:{sid}` keys exist, but the player list keys (`props:nfl:players:mkt:{mkt}`) are empty or incomplete.

**Fix:** Scan your existing alternate keys and populate:
1. `props:{sport}:players:mkt:{mkt}` - Sets with player entities per market
2. `props:{sport}:player:{ent}` - Hashes with player metadata

**Why this happened:** Your ingestor likely creates the alternate family data but doesn't create the separate player list and metadata keys needed by the `/api/props/players` endpoint.

**One-time fix:** You can run a script once to backfill from existing alternates, then update your ingestor to create both keys going forward.

