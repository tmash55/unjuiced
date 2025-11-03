# Ladders Redis Keys - Quick Reference

Quick reference for Redis keys required by the Ladders feature. For detailed documentation, see `LADDERS_REDIS_KEYS.md`.

---

## Critical Keys (Required for Basic Functionality)

| Key Pattern | Type | Purpose | Example |
|-------------|------|---------|---------|
| `props:{sport}:rows:alt:{sid}` | String (JSON) | **PRIMARY DATA** - All ladder lines for a player+market+event | `props:nfl:rows:alt:71688971e063d0033f8a17a726663b30c723fad` |
| `props:{sport}:mkts` | Set | Available markets for sport | `props:nfl:mkts` |
| `props:{sport}:players:mkt:{market}` | Set | Player entities for a market | `props:nfl:players:mkt:receiving_yards` |
| `props:{sport}:player:{ent}` | Hash | Player metadata (name, team, position) | `props:nfl:player:player_123` |
| `props:{sport}:sids:ent:{ent}:mkt:{market}` | Set | SIDs for player+market | `props:nfl:sids:ent:player_123:mkt:receiving_yards` |

---

## Optional Keys (Enhanced Features)

| Key Pattern | Type | Purpose | Example |
|-------------|------|---------|---------|
| `props:{sport}:is_live` | Hash | Live/pregame status per SID | `props:nfl:is_live` |
| `props:{sport}:alt:x` | Stream | Real-time update events | `props:nfl:alt:x` |
| `props:{sport}:sid2primary` | Hash | Map alternate SID to primary SID | `props:nfl:sid2primary` |
| `idx:{sport}:props:markets` | String (JSON) | Alternative markets storage | `idx:nfl:props:markets` |

---

## Data Structure Examples

### `props:{sport}:rows:alt:{sid}` (Most Important)
```json
{
  "eid": "event_123",
  "ent": "player_456",
  "mkt": "receiving_yards",
  "player": "DeVonta Smith",
  "team": "PHI",
  "position": "WR",
  "primary_ln": 67.5,
  "ev": {
    "eid": "event_123",
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
        },
        "fanduel": {
          "over": { "price": 140, "link": "https://..." },
          "under": { "price": -170, "link": "https://..." }
        }
      },
      "best": {
        "over": { "book": "draftkings", "price": 150 },
        "under": { "book": "fanduel", "price": -170 }
      },
      "avg": {
        "over": 145,
        "under": -175
      }
    }
  ]
}
```

### `props:{sport}:player:{ent}` (Player Metadata)
```bash
HSET props:nfl:player:player_456 name "DeVonta Smith"
HSET props:nfl:player:player_456 team "PHI"
HSET props:nfl:player:player_456 position "WR"
```

### `props:{sport}:is_live` (Live Status)
```bash
HSET props:nfl:is_live "sid_123" "0"  # 0 = pregame
HSET props:nfl:is_live "sid_456" "1"  # 1 = live
```

---

## Minimal Setup for One Player

```bash
# 1. Add market
SADD props:nfl:mkts "receiving_yards"

# 2. Add player to market
SADD props:nfl:players:mkt:receiving_yards "player_456"

# 3. Set player metadata
HMSET props:nfl:player:player_456 name "DeVonta Smith" team "PHI" position "WR"

# 4. Link player+market to SID
SADD props:nfl:sids:ent:player_456:mkt:receiving_yards "sid_abc123"

# 5. Store ladder data (CRITICAL)
SET props:nfl:rows:alt:sid_abc123 '{"eid":"event_123","ent":"player_456",...}'

# 6. Set live status (optional)
HSET props:nfl:is_live "sid_abc123" "0"
```

---

## Verification Commands

```bash
# Check markets
redis-cli SMEMBERS props:nfl:mkts

# Check players for a market
redis-cli SMEMBERS props:nfl:players:mkt:receiving_yards

# Check player metadata
redis-cli HGETALL props:nfl:player:player_456

# Check SIDs for player+market
redis-cli SMEMBERS props:nfl:sids:ent:player_456:mkt:receiving_yards

# Check ladder data exists
redis-cli EXISTS props:nfl:rows:alt:sid_abc123

# Get ladder data
redis-cli GET props:nfl:rows:alt:sid_abc123

# Check live status
redis-cli HGET props:nfl:is_live "sid_abc123"
```

---

## API Endpoints → Redis Keys Mapping

| Endpoint | Redis Keys Used |
|----------|----------------|
| `GET /api/props/mkts` | `props:{sport}:mkts` |
| `GET /api/props/players` | `props:{sport}:players:mkt:{market}`<br>`props:{sport}:sids:ent:{ent}:mkt:{market}`<br>`props:{sport}:rows:alt:{sid}`<br>`props:{sport}:player:{ent}`<br>`props:{sport}:is_live` |
| `GET /api/props/find` | `props:{sport}:sids:ent:{ent}:mkt:{market}`<br>`props:{sport}:rows:alt:{sid}`<br>`props:{sport}:sid2primary` |
| `GET /api/props/alt` | `props:{sport}:rows:alt:{sid}` |
| `GET /api/sse/alt` | `props:{sport}:alt:x`<br>`props:{sport}:rows:alt:{sid}` |

---

## Common Issues & Solutions

### Issue: "No players found"
**Check:**
1. `props:{sport}:players:mkt:{market}` has entries
2. `props:{sport}:sids:ent:{ent}:mkt:{market}` exists for each player
3. `props:{sport}:rows:alt:{sid}` exists for at least one SID

### Issue: "No alternates available"
**Check:**
1. `props:{sport}:rows:alt:{sid}` exists and has valid JSON
2. JSON includes `lines` array with multiple line objects
3. Each line has `ln`, `books`, `best`, and `avg` fields

### Issue: "Player shows but ladder doesn't load"
**Check:**
1. SID from `/api/props/find` is valid
2. `props:{sport}:rows:alt:{sid}` contains complete data
3. `ev` object is present with event details

### Issue: "Live/pregame filter not working"
**Check:**
1. `props:{sport}:is_live` hash exists
2. Each SID has an entry: "0" for pregame, "1" for live

---

## Sports Currently Supported

- `nfl` - NFL
- `nba` - NBA
- `nhl` - NHL
- `ncaaf` - NCAA Football

To add a new sport, create all the critical keys listed above for that sport.

---

## Key Naming Convention

**Format:** `props:{sport}:{type}:{subtype}:{identifier}`

**Examples:**
- `props:nfl:rows:alt:sid_123` - Alternate lines data
- `props:nfl:players:mkt:receiving_yards` - Players for market
- `props:nfl:sids:ent:player_456:mkt:receiving_yards` - SIDs for player+market

**Consistency is critical** - Use lowercase sport codes and consistent separators.

---

## Performance Tips

1. **Batch operations** - Use MGET/HMGET when fetching multiple keys
2. **Set expiration** - Use EXPIRE on stale data to prevent memory bloat
3. **Index frequently** - Keep `props:{sport}:mkts` and player sets up to date
4. **Stream cleanup** - Trim `props:{sport}:alt:x` streams regularly (XTRIM)
5. **Validate before storing** - Ensure JSON is valid before SET

---

## Related Files

- **Full Documentation:** `LADDERS_REDIS_KEYS.md`
- **Architecture:** `LADDERS_ARCHITECTURE.md`
- **Testing:** `LADDERS_TEST_ROUTES.md`
- **API Routes:**
  - `app/api/props/alt/route.ts`
  - `app/api/props/players/route.ts`
  - `app/api/props/find/route.ts`
  - `app/api/props/mkts/route.ts`
  - `app/api/sse/alt/route.ts`




