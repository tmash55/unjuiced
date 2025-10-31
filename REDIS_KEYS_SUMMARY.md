# Redis Keys Summary - Quick Reference

## Two Independent Systems

Your app has **two separate features** that use **different Redis key patterns**:

### 1. Odds Screen (Table View)
**Purpose:** Display primary odds in a sortable table  
**Keys:** `props:{sport}:sort:roi:*` + `props:{sport}:rows:prim`

### 2. Ladders Tool (Alternate Lines)
**Purpose:** Show all alternate lines for a specific player/market  
**Keys:** `props:{sport}:players:mkt:*` + `props:{sport}:rows:alt:*`

---

## Odds Screen Keys

### Required Keys
| Key Pattern | Type | Purpose |
|------------|------|---------|
| `props:{sport}:sort:roi:{scope}:{market}` | ZSET | SIDs sorted by ROI |
| `props:{sport}:rows:prim` | HASH | Primary row data for all markets |

### Example (NBA Player Points)
```bash
# Sorted SIDs
props:nba:sort:roi:pregame:player_points  # ZSET with ~60 members (6 games × 10 players)

# Row data
props:nba:rows:prim  # HASH with 500+ fields (all markets combined)
```

### API Route
`/api/props/table?sport=nba&market=player_points&scope=pregame`

---

## Ladders Keys

### Required Keys
| Key Pattern | Type | Purpose |
|------------|------|---------|
| `props:{sport}:players:mkt:{mkt}` | SET | Player entities for dropdown |
| `props:{sport}:player:{ent}` | HASH | Player metadata (name, team, position) |
| `props:{sport}:rows:alt:{sid}` | JSON | Alternate lines family data |
| `props:{sport}:sids:ent:{ent}:mkt:{mkt}` | SET | SIDs for player+market lookup |
| `props:{sport}:sid2primary` | HASH | SID resolution mapping |

### Example (NBA Player Points)
```bash
# Player list
props:nba:players:mkt:player_points  # SET with ~60 members

# Player metadata
props:nba:player:pid:00-0036355  # HASH {name, team, position}

# Alternate lines
props:nba:rows:alt:sid_abc123  # JSON with all lines for this prop

# SID lookup
props:nba:sids:ent:pid:00-0036355:mkt:player_points  # SET of SIDs

# SID resolution
props:nba:sid2primary  # HASH mapping old SIDs → current primary SID
```

### API Routes
1. `/api/props/players?sport=nba&mkt=player_points` - Get player list
2. `/api/props/find?sport=nba&ent=pid:00-0036355&mkt=player_points` - Get SIDs
3. `/api/props/alt?sport=nba&sid=abc123` - Get ladder family

---

## Key Differences

| Aspect | Odds Screen | Ladders |
|--------|-------------|---------|
| **Primary Purpose** | Display best odds across books | Show all alternate lines |
| **Data Source** | `props:{sport}:rows:prim` | `props:{sport}:rows:alt:{sid}` |
| **Sorting** | By ROI in ZSETs | Not sorted, user selects player |
| **Player List** | Not needed (shows all from ZSET) | Required for dropdown |
| **SID Lookup** | Direct from ZSET | Via player entity + market |
| **Can Work Without** | Ladders keys | Odds screen keys |

---

## What Happens When You Delete Keys

### If you delete `props:nba:rows:prim`:
- ❌ **Odds screen breaks** - Can't fetch row data even if ZSETs exist
- ✅ **Ladders still works** - Uses `props:nba:rows:alt:*` instead

### If you delete `props:nba:players:mkt:player_points`:
- ✅ **Odds screen still works** - Doesn't use this key
- ❌ **Ladders dropdown is empty** - No players to select

### If you delete all `props:nba:rows:alt:*`:
- ✅ **Odds screen still works** - Doesn't use alternates
- ❌ **Ladders shows 404** - Can't load alternate lines

---

## Ingestor Checklist

For each sport (NBA, NFL, NHL, etc.):

### For Odds Screen:
- [ ] Create sorted ZSET per market: `props:{sport}:sort:roi:{scope}:{market}`
- [ ] Populate with SIDs and ROI scores
- [ ] Create single hash: `props:{sport}:rows:prim`
- [ ] Add all primary row data to hash (all markets in one hash)

### For Ladders:
- [ ] Create player sets per market: `props:{sport}:players:mkt:{market}`
- [ ] Create player metadata hashes: `props:{sport}:player:{ent}`
- [ ] Create alternate family data: `props:{sport}:rows:alt:{sid}`
- [ ] Create SID lookup sets: `props:{sport}:sids:ent:{ent}:mkt:{mkt}`
- [ ] Create sid2primary mapping: `props:{sport}:sid2primary`

### Shared (Optional but Recommended):
- [ ] Create markets set: `props:{sport}:mkts`
- [ ] Create live flags: `props:{sport}:is_live`
- [ ] Create update stream: `props:{sport}:alt:x`

---

## Debugging Commands

### Check Odds Screen Keys (NBA example)
```bash
# Check if sorted set exists
redis-cli EXISTS props:nba:sort:roi:pregame:player_points

# Count SIDs in sorted set
redis-cli ZCARD props:nba:sort:roi:pregame:player_points

# Check if primary hash exists
redis-cli EXISTS props:nba:rows:prim

# Count entries in primary hash (all markets)
redis-cli HLEN props:nba:rows:prim

# Get top 5 SIDs
redis-cli ZRANGE props:nba:sort:roi:pregame:player_points 0 4 REV

# Check specific SID's row data
redis-cli HGET props:nba:rows:prim <sid_from_above>
```

### Check Ladders Keys (NBA example)
```bash
# Check player list
redis-cli SMEMBERS props:nba:players:mkt:player_points

# Count players
redis-cli SCARD props:nba:players:mkt:player_points

# Check player metadata
redis-cli HGETALL props:nba:player:pid:00-0036355

# Check alternate family
redis-cli GET props:nba:rows:alt:<sid>

# Check SID lookup
redis-cli SMEMBERS props:nba:sids:ent:pid:00-0036355:mkt:player_points
```

---

## Common Mistake

**Thinking these are the same system!**

- The odds screen and ladders are **completely independent**
- They can work without each other
- Deleting keys for one won't affect the other (unless shared keys like player metadata)
- Your ingestor needs to populate **both sets of keys** if you want both features to work

---

## Files for More Details

- `ODDS_SCREEN_REDIS_KEYS.md` - Complete odds screen documentation
- `LADDERS_REDIS_KEYS.md` - Complete ladders documentation
- `INGESTOR_FIX_PLAYERS.md` - How to fix missing player lists
- `DUPLICATE_ROWS_DEBUG.md` - Fixing duplicate SID issues

