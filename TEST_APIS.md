# API Testing Guide

## Issue: No data showing on odds page

### Current Situation
- Page is using: `/api/odds-screen` (old route)
- New route available: `/api/props/table`
- Different response formats

### Old API (`/api/odds-screen`)
**Request:**
```
GET /api/odds-screen?sport=nfl&type=player&market=passing_yards&scope=pregame
```

**Response Format:**
```json
{
  "success": true,
  "metadata": {
    "sport": "nfl",
    "type": "player",
    "market": "passing_yards",
    "scope": "pregame",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "totalCount": 50
  },
  "data": [
    {
      "id": "event123-player456",
      "entity": {
        "type": "player",
        "name": "Patrick Mahomes",
        "details": "QB",
        "id": "player456"
      },
      "event": {
        "id": "event123",
        "startTime": "2025-01-15T18:00:00Z",
        "homeTeam": "Chiefs",
        "awayTeam": "Bills"
      },
      "odds": {
        "best": {
          "over": { "price": 105, "line": 275.5, "book": "draftkings" },
          "under": { "price": -125, "line": 275.5, "book": "fanduel" }
        },
        "average": { ... },
        "opening": { ... },
        "books": {
          "draftkings": { "over": {...}, "under": {...} },
          "fanduel": { "over": {...}, "under": {...} }
        }
      }
    }
  ]
}
```

**Redis Keys Used:**
```
odds:nfl:props:passing_yards:primary:pregame
```

---

### New API (`/api/props/table`)
**Request:**
```
GET /api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=100
```

**Response Format:**
```json
{
  "sids": ["sid1", "sid2", "sid3"],
  "rows": [
    {
      "ent": "pid:player456",
      "ev": {
        "id": "event123",
        "start": "2025-01-15T18:00:00Z",
        "home": "KC",
        "away": "BUF"
      },
      "best": {
        "over": { "price": 105, "line": 275.5, "book": "draftkings" },
        "under": { "price": -125, "line": 275.5, "book": "fanduel" }
      },
      "books": { ... }
    }
  ],
  "nextCursor": "100"
}
```

**Redis Keys Used:**
```
props:nfl:sort:roi:pregame:passing_yards  (ZSET for sorting)
props:nfl:rows:prim                        (HASH for row data)
```

---

## Testing Steps

### 1. Test Old API
```bash
curl "http://localhost:3000/api/odds-screen?sport=nfl&type=player&market=passing_yards&scope=pregame"
```

**Expected:** Returns data if `odds:nfl:props:passing_yards:primary:pregame` exists in Redis

**If empty:** Old keys not populated, need to use new API

---

### 2. Test New API
```bash
curl "http://localhost:3000/api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=10"
```

**Expected:** Returns `{ sids, rows, nextCursor }`

**If empty:** New keys not populated yet

---

### 3. Check Redis Keys Directly

**Old keys:**
```bash
redis-cli GET "odds:nfl:props:passing_yards:primary:pregame"
```

**New keys:**
```bash
redis-cli ZRANGE "props:nfl:sort:roi:pregame:passing_yards" 0 10 REV
redis-cli HGET "props:nfl:rows:prim" "sid_from_above"
```

---

## Solution Options

### Option 1: Continue Using Old API (Recommended if populated)
✅ **Pros:**
- Already working transformation logic
- Table expects this format
- No code changes needed

❌ **Cons:**
- Old architecture
- Not using new pub/sub keys

**Action:** Verify `/api/odds-screen` returns data

---

### Option 2: Migrate to New API
✅ **Pros:**
- Modern architecture
- Uses new Redis keys
- Better for SSE integration

❌ **Cons:**
- Need to transform response format
- More code changes
- Need adapter layer

**Action:** Create transformer to convert new API format to table format

---

### Option 3: Hybrid Approach
- Keep old API for initial load
- Use SSE for live updates (pro users)
- Gradually migrate as new keys populate

---

## Recommended Next Steps

1. **Test both APIs** to see which has data
2. **If old API has data:** Keep using it
3. **If new API has data:** Create adapter
4. **If neither has data:** Check backend is populating Redis

---

## Creating an Adapter (if needed)

```typescript
// lib/api-adapters/props-to-odds.ts

interface PropsRow {
  ent: string
  ev: { id: string; start: string; home: string; away: string; team?: string }
  best: { over?: any; under?: any }
  books: Record<string, any>
  // ... other fields
}

interface OddsTableItem {
  id: string
  entity: { type: 'player' | 'game'; name: string; details?: string; id?: string }
  event: { id: string; startTime: string; homeTeam: string; awayTeam: string }
  odds: { best: any; average: any; opening: any; books: any }
}

export function transformPropsRowToOddsItem(row: PropsRow): OddsTableItem {
  // Extract player ID from ent (e.g., "pid:player456")
  const playerId = row.ent.startsWith('pid:') ? row.ent.slice(4) : row.ent
  
  return {
    id: `${row.ev.id}-${playerId}`,
    entity: {
      type: 'player',
      name: row.name || 'Unknown', // Need to map player ID to name
      details: row.position || row.team,
      id: playerId
    },
    event: {
      id: row.ev.id,
      startTime: row.ev.start,
      homeTeam: row.ev.home,
      awayTeam: row.ev.away
    },
    odds: {
      best: row.best || {},
      average: row.metrics || {},
      opening: {},
      books: row.books || {}
    }
  }
}
```

---

## Quick Fix for Now

Test the old API and verify it has data:

```bash
curl "http://localhost:3000/api/odds-screen?sport=nfl&type=player&market=passing_yards&scope=pregame" | jq '.data | length'
```

If it returns `0`, your backend hasn't populated the old keys yet.
If it returns `> 0`, the keys exist and should work.

Then test the new API:

```bash
curl "http://localhost:3000/api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=10" | jq '.rows | length'
```

Compare results to determine which system to use.



