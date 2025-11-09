# Props & Props SSE Routes Audit

**Date:** November 8, 2025  
**Purpose:** Document how player props are populated and from what Redis keys

---

## 🎯 Overview

The application has two main systems for fetching player props:
1. **Odds Screen** (`/api/props/*`) - Traditional paginated table view
2. **Edge Finder** (`/api/best-odds`) - Best odds across all sportsbooks

Both systems use Redis for data storage but with **different key structures**.

---

## 📊 Odds Screen System

### Main API Route: `/api/props/table/route.ts`

**Purpose:** Fetch paginated player props for a specific sport and market

#### Redis Key Structure:

**1. ZSET (Sorted Set) - For Sorting/Pagination:**
```
props:{sport}:sort:roi:{scope}:{market}
```
- **Examples:**
  - `props:nfl:sort:roi:pregame:passing_yards`
  - `props:nba:sort:roi:live:player_points`
  - `props:nhl:sort:roi:pregame:player_goals`

- **Contains:** SIDs (String IDs) sorted by ROI
- **Used for:** Pagination and ordering
- **Fetched via:** `ZRANGE` with cursor/limit

**2. HASH - For Full Row Data:**
```
props:{sport}:rows:prim
```
- **Examples:**
  - `props:nfl:rows:prim`
  - `props:nba:rows:prim`
  - `props:nhl:rows:prim`

- **Contains:** Full JSON objects for each player prop
- **Keys within hash:** SIDs from the ZSET
- **Fetched via:** `HMGET` with list of SIDs

#### Data Flow:
```
1. Query ZSET → Get sorted SIDs for specific market
   └─ props:nfl:sort:roi:pregame:passing_yards
   
2. Fetch rows from HASH using those SIDs
   └─ props:nfl:rows:prim
   
3. Parse JSON and return to client
```

#### Supported Sports:
- `nfl`, `ncaaf`, `mlb`, `wnba`, `nba`, `ncaab`, `nhl`

#### Query Parameters:
- `sport` - Required (e.g., "nfl", "nba")
- `market` - Required (e.g., "passing_yards", "player_points")
- `scope` - "pregame" | "live" (default: "pregame")
- `limit` - Max 300 (default: 100)
- `cursor` - For pagination (default: 0)
- `playerId` - Optional filter
- `team` - Optional filter

---

### Supporting Routes:

#### `/api/props/rows/route.ts`
**Purpose:** Batch fetch specific SIDs (used for refreshing visible rows)

**Redis Keys:**
```
props:{sport}:rows:prim
```

**Method:** POST with body `{ sport, sids: [...] }`

---

#### `/api/props/markets/route.ts`
**Purpose:** Get available markets for a sport

**Redis Keys:**
```
idx:{sport}:props:markets
```
- **Example:** `idx:nfl:props:markets`
- **Fallback:** Static list if key doesn't exist

---

### SSE Route: `/api/sse/props/route.ts`

**Purpose:** Real-time updates for odds screen (Pro users only)

**Redis Pub/Sub Channel:**
```
pub:props:{sport}
```
- **Examples:**
  - `pub:props:nfl`
  - `pub:props:nba`
  - `pub:props:nhl`

**Access:** Pro users only (checked via `current_entitlements` table)

**Flow:**
1. Client subscribes to SSE endpoint with `?sport=nfl`
2. Server subscribes to Redis pub/sub channel `pub:props:nfl`
3. Backend ingestor publishes updates to channel
4. Server forwards updates to client via SSE

---

## 🎯 Edge Finder System

### Main API Route: `/api/best-odds/route.ts`

**Purpose:** Find best odds across all sportsbooks for all sports/markets

#### Redis Key Structure:

**1. ZSET (Sorted Set) - For Sorting:**
```
best_odds:all:sort:{sortType}:{scope}
```

**Sort Types:**
- **By Improvement %:**
  - `best_odds:all:sort:improvement` (all)
  - `best_odds:all:sort:pregame` (pregame only)
  - `best_odds:all:sort:live` (live only)

- **By Odds Value:**
  - `best_odds:all:sort:odds` (all)
  - `best_odds:all:sort:odds:pregame`
  - `best_odds:all:sort:odds:live`

**ZSET Members:** Composite keys like `{sport}:{eid}:{ent}:{mkt}:{ln}:{side}`
- Example: `nfl:evt_123:pid_456:passing_yards:250.5:o`

**ZSET Scores:** Improvement percentage (e.g., 15.5 = 15.5% better than average)

**2. HASH - For Full Deal Data:**
```
props:{sport}:best_odds:rows
```
- **Examples:**
  - `props:nfl:best_odds:rows`
  - `props:nba:best_odds:rows`
  - `props:nhl:best_odds:rows`

**HASH Field Keys:** Everything after `{sport}:` in the ZSET member
- Example: `evt_123:pid_456:passing_yards:250.5:o`

**HASH Values:** Full JSON with:
- Basic deal info (eid, ent, mkt, ln, side)
- Best book/price/link
- All books with prices
- **Enriched data** (player name, team, game info, start time)

#### Data Flow:
```
1. Query ZSET → Get top deals sorted by improvement
   └─ best_odds:all:sort:pregame
   
2. Group deals by sport
   
3. Batch fetch from per-sport HASHes
   └─ props:nfl:best_odds:rows
   └─ props:nba:best_odds:rows
   └─ props:nhl:best_odds:rows
   
4. Apply filters (leagues, markets, books, odds range)
   
5. Return normalized deals
```

#### Supported Sports:
- `nfl`, `nba`, `nhl`, `ncaaf`, `ncaab`, `mlb`, `wnba`

#### Query Parameters:
- `sport` - Currently only "all" supported
- `leagues` - Comma-separated (e.g., "nba,nfl")
- `markets` - Comma-separated (e.g., "player_points,passing_yards")
- `books` - Comma-separated (e.g., "draftkings,fanduel")
- `scope` - "all" | "pregame" | "live" (default: "all")
- `sortBy` - "improvement" | "odds" (default: "improvement")
- `limit` - Max 2000 (default: 500)
- `offset` - For pagination (default: 0)
- `minImprovement` - Minimum edge % (default: 0)
- `maxOdds` - Maximum odds value (optional)
- `minOdds` - Minimum odds value (optional)

#### Access Control:
- **Free users:** Only see deals with improvement < 10%
- **Pro users:** See all deals

---

### Teaser Route: `/api/best-odds/teaser/route.ts`

**Purpose:** Preview endpoint for non-Pro users (limited data)

**Uses same Redis keys as main route:**
- ZSET: `best_odds:all:sort:pregame`
- HASH: `props:{sport}:best_odds:rows`

**Limits:** Returns max 10 deals for preview

---

### SSE Route: `/api/sse/best-odds/route.ts`

**Purpose:** Real-time updates for Edge Finder (Pro users only)

**Redis Pub/Sub Channel:**
```
pub:best_odds:all
```

**Access:** Pro users only

---

## 🔑 Key Differences

| Aspect | Odds Screen | Edge Finder |
|--------|-------------|-------------|
| **ZSET Pattern** | `props:{sport}:sort:roi:{scope}:{market}` | `best_odds:all:sort:{sortType}:{scope}` |
| **HASH Pattern** | `props:{sport}:rows:prim` | `props:{sport}:best_odds:rows` |
| **Scope** | Single sport + market | All sports + markets |
| **ZSET Members** | Simple SIDs | Composite keys with sport prefix |
| **Sorting** | By ROI for specific market | By improvement % or odds value |
| **Enrichment** | Fetched separately | Embedded in HASH values |
| **Pub/Sub** | `pub:props:{sport}` | `pub:best_odds:all` |

---

## 📝 Important Notes

### Date Filtering

**Edge Finder:** ✅ **NOW FILTERS OUT OLD GAMES**
- Filters games that started more than 30 minutes ago
- 30-minute buffer allows for live betting on recently started games
- Applied in both `/api/best-odds` and `/api/best-odds/teaser`
- Uses `game_start`, `start_time`, or `startTime` field

**Odds Screen:** ⚠️ Still relies on backend ingestor to remove old games from ZSETs

**Recommendation for Odds Screen:** 
1. Backend should remove expired games from Redis keys
2. OR add similar date filtering to `/api/props/table` route

### Data Freshness
- **Version Keys:**
  - Odds Screen: No version tracking
  - Edge Finder: `best_odds:all:v` (timestamp)

- **Cache Headers:**
  - Odds Screen: `no-store` (always fresh)
  - Edge Finder: `public, max-age=30, s-maxage=60` (cached for 30s)

### Performance
- **Odds Screen:** 
  - Queries single ZSET per request
  - Fetches from single HASH
  - Optimized for specific market view

- **Edge Finder:**
  - Queries single ZSET (all sports/markets)
  - Fetches from multiple HASHes (one per sport)
  - Batch operations for efficiency
  - Client-side filtering for leagues/markets/books

---

## 🚀 Backend Ingestor Requirements

For these APIs to work, the backend ingestor must:

### For Odds Screen:
1. Create ZSETs: `props:{sport}:sort:roi:{scope}:{market}`
2. Populate HASH: `props:{sport}:rows:prim`
3. Keep SIDs in sync between ZSET and HASH
4. Publish updates to: `pub:props:{sport}`
5. **Remove old games** from ZSETs and HASH

### For Edge Finder:
1. Create ZSETs: `best_odds:all:sort:{sortType}:{scope}`
2. Populate HASHes: `props:{sport}:best_odds:rows`
3. Use composite keys: `{sport}:{eid}:{ent}:{mkt}:{ln}:{side}`
4. Embed enrichment data in HASH values
5. Update version: `best_odds:all:v`
6. Publish updates to: `pub:best_odds:all`
7. **Remove old games** from ZSETs and HASHes

---

## 🐛 Known Issues

1. **Odds Screen date filtering** - Still relies entirely on backend cleanup (Edge Finder now has filtering)
2. **ZSET/HASH sync** - If SIDs exist in ZSET but not HASH, returns null data
3. **Free user limit** - Edge Finder hardcoded to 10% improvement limit

---

## ✅ Recommendations

1. ✅ **DONE: Date filtering added to Edge Finder** - Filters games that started 30+ minutes ago

2. **Add date filtering to Odds Screen** (`/api/props/table`) as a safety net:
   ```typescript
   // Filter out games that have already started (with buffer)
   const now = Date.now();
   const BUFFER_MS = 30 * 60 * 1000; // 30 minutes
   rows = rows.filter(row => {
     const gameTime = new Date(row.game_start || row.startTime).getTime();
     return gameTime > (now - BUFFER_MS);
   });
   ```

3. **Add TTL** to Redis keys so old data auto-expires

4. **Add monitoring** to detect ZSET/HASH sync issues

5. **Consider pagination** improvements for Edge Finder (currently loads up to 2000 deals)

