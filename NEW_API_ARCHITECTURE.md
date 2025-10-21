# New API Architecture - VC-Grade Pub/Sub System 🚀

## ✅ Migration Complete

Your odds system now uses the **modern pub/sub architecture** with `props:{sport}:*` Redis keys, enabling real-time SSE updates and scalable performance.

---

## 🏗️ Architecture Overview

### Old System (Deprecated)
```
Frontend → /api/odds-screen → odds:{sport}:props:{market}:* keys
❌ No pub/sub support
❌ Manual refresh only
❌ Monolithic data structure
❌ Doesn't scale well
```

### New System (Current)
```
Frontend → /api/props/table → props:{sport}:* keys ← Backend Pub/Sub
✅ Real-time SSE support
✅ Sorted by ROI (ZSET)
✅ Efficient pagination
✅ Scales horizontally
✅ Adapter layer for compatibility
```

---

## 📊 Data Flow

### 1. Backend → Redis
```
Backend processes odds
  ↓
Publishes to pub:props:{sport}
  ↓
Updates sorted sets: props:{sport}:sort:roi:{scope}:{market}
  ↓
Updates row hashes: props:{sport}:rows:prim
```

### 2. Redis → Frontend (Initial Load)
```
Frontend requests /api/props/table
  ↓
API queries ZSET for sorted SIDs
  ↓
API fetches rows from HASH
  ↓
Adapter transforms to OddsTableItem format
  ↓
Table displays data
```

### 3. Redis → Frontend (Live Updates - Pro Users)
```
Backend publishes update to pub:props:{sport}
  ↓
SSE route (/api/sse/props) streams to connected clients
  ↓
Frontend useSSE hook receives message
  ↓
Adapter transforms to OddsTableItem format
  ↓
Table updates with color flash animations
```

---

## 🔧 Key Components

### 1. API Route: `/api/props/table`
**Path:** `app/api/props/table/route.ts`

**Query Parameters:**
- `sport` - Sport key (nfl, nba, mlb, wnba)
- `market` - Market name (passing_yards, points, etc.)
- `scope` - Scope (pregame, live)
- `limit` - Results per page (1-300, default: 100)
- `cursor` - Pagination cursor (optional)
- `playerId` - Filter by player ID (optional)
- `team` - Filter by team (optional)

**Response Format:**
```typescript
{
  sids: string[]          // Stable IDs for rows
  rows: PropsRow[]        // Raw row data
  nextCursor: string | null  // Pagination cursor
}
```

**Redis Keys Used:**
```
props:{sport}:sort:roi:{scope}:{market}  // ZSET for sorting
props:{sport}:rows:prim                   // HASH for row data
```

---

### 2. Adapter: `props-to-odds.ts`
**Path:** `lib/api-adapters/props-to-odds.ts`

**Purpose:** Transforms new API format to OddsTableItem format

**Key Functions:**

#### `transformPropsRowToOddsItem(row, type)`
Transforms a single row:
```typescript
// Input: PropsRow
{
  sid: "abc123",
  ent: "pid:player456",
  name: "Patrick Mahomes",
  position: "QB",
  team: "KC",
  ev: { id: "evt789", start: "2025-01-15T18:00:00Z", home: "KC", away: "BUF" },
  best: { over: {...}, under: {...} },
  books: { draftkings: {...}, fanduel: {...} }
}

// Output: OddsScreenItem
{
  id: "evt789-player456",
  entity: { type: "player", name: "Patrick Mahomes", details: "QB", id: "player456" },
  event: { id: "evt789", startTime: "2025-01-15T18:00:00Z", homeTeam: "KC", awayTeam: "BUF" },
  odds: { best: {...}, average: {...}, opening: {}, books: {...} }
}
```

#### `transformPropsResponseToOddsScreen(response, type)`
Transforms entire response:
```typescript
// Input: PropsTableResponse
{ sids: [...], rows: [...], nextCursor: "100" }

// Output: OddsScreenItem[]
[{ id, entity, event, odds }, ...]
```

#### `fetchOddsWithNewAPI(params)`
Convenience function for direct fetching:
```typescript
const { data, nextCursor } = await fetchOddsWithNewAPI({
  sport: 'nfl',
  market: 'passing_yards',
  scope: 'pregame',
  type: 'player',
  limit: 300
})
```

---

### 3. Updated Odds Page
**Path:** `app/(protected)/odds/[sport]/page.tsx`

**Changes:**
```typescript
// OLD (deprecated)
const url = `/api/odds-screen?sport=${sport}&type=${type}&market=${market}&scope=${scope}`

// NEW (current)
const url = `/api/props/table?sport=${sport}&market=${market}&scope=${scope}&limit=300`
// + Adapter transformation in queryFn
```

**React Query Integration:**
```typescript
const { data, refetch } = useQuery({
  queryKey: ['odds-props', sport, type, market, scope],
  queryFn: async () => {
    // 1. Fetch from new API
    const res = await fetch(url)
    const propsResponse = await res.json()
    
    // 2. Transform with adapter
    const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds')
    const transformedData = transformPropsResponseToOddsScreen(propsResponse, type)
    
    // 3. Return with metadata
    return {
      data: transformedData,
      nextCursor: propsResponse.nextCursor,
      fetchTime: duration
    }
  },
  // ... other options
})
```

---

## 🎯 SSE Integration (Pro Users)

### Connection Flow
```typescript
// In odds page component
const { user } = useAuth()
const isPro = profile?.plan === 'pro'
const isLiveScope = scope === 'live'

// Connect SSE for pro users in live scope
const { isConnected, lastMessage } = useSSE(
  `/api/sse/props?sport=${sport}`,
  {
    enabled: isPro && isLiveScope,
    onMessage: async (message) => {
      // Transform SSE message to OddsTableItem format
      const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds')
      const updatedData = transformPropsResponseToOddsScreen(
        { sids: [], rows: message.rows || [], nextCursor: null },
        type
      )
      
      // Merge with existing data
      setData(prev => mergeOddsUpdates(prev, updatedData))
    }
  }
)
```

### SSE Message Format
```typescript
event: update
data: {
  rows: [
    { sid: "abc123", ent: "pid:123", name: "Patrick Mahomes", ... }
  ]
}
```

---

## 🔄 Data Transformation Examples

### Example 1: Player Props

**Input (PropsRow):**
```json
{
  "sid": "nfl_evt123_p456_py",
  "ent": "pid:p456",
  "name": "Patrick Mahomes",
  "position": "QB",
  "team": "KC",
  "line": 275.5,
  "ev": {
    "id": "evt123",
    "start": "2025-01-15T18:00:00Z",
    "home": "KC",
    "away": "BUF"
  },
  "best": {
    "over": {
      "price": 105,
      "line": 275.5,
      "book": "draftkings",
      "links": { "desktop": "https://..." }
    },
    "under": {
      "price": -125,
      "line": 275.5,
      "book": "fanduel"
    }
  },
  "metrics": {
    "over": { "avg_price": 102, "count": 8 },
    "under": { "avg_price": -120, "count": 8 }
  },
  "books": {
    "draftkings": {
      "over": { "price": 105, "line": 275.5 },
      "under": { "price": -115, "line": 275.5 }
    },
    "fanduel": {
      "over": { "price": 100, "line": 275.5 },
      "under": { "price": -125, "line": 275.5 }
    }
  }
}
```

**Output (OddsScreenItem):**
```json
{
  "id": "evt123-p456",
  "entity": {
    "type": "player",
    "name": "Patrick Mahomes",
    "details": "QB",
    "id": "p456"
  },
  "event": {
    "id": "evt123",
    "startTime": "2025-01-15T18:00:00Z",
    "homeTeam": "KC",
    "awayTeam": "BUF"
  },
  "odds": {
    "best": {
      "over": { "price": 105, "line": 275.5, "book": "draftkings", "link": "https://..." },
      "under": { "price": -125, "line": 275.5, "book": "fanduel", "link": null }
    },
    "average": {
      "over": { "price": 102, "line": 275.5 },
      "under": { "price": -120, "line": 275.5 }
    },
    "opening": {},
    "books": {
      "draftkings": {
        "over": { "price": 105, "line": 275.5, "link": null },
        "under": { "price": -115, "line": 275.5, "link": null }
      },
      "fanduel": {
        "over": { "price": 100, "line": 275.5, "link": null },
        "under": { "price": -125, "line": 275.5, "link": null }
      }
    }
  }
}
```

---

## 📈 Performance Metrics

### VC-Grade Standards
- **API Response Time:** <500ms (warns if >1000ms)
- **Transformation Time:** <50ms (negligible overhead)
- **SSE Latency:** <100ms from publish to UI update
- **Color Animation:** 60fps, 5s smooth fade
- **Memory Efficiency:** Adapter creates minimal overhead

### Monitoring
```typescript
// Automatic performance logging
console.log(`[FETCH] Loaded 150 rows in 423ms`)
console.warn(`[FETCH] Slow API response: 1247ms`)
```

---

## 🚀 Scaling Considerations

### Horizontal Scaling
```
Backend Workers (N instances)
  ↓
All publish to Redis pub:props:{sport}
  ↓
All SSE servers subscribe to same channel
  ↓
Each SSE server handles subset of clients
  ↓
Load balanced across servers
```

### Data Sharding (Future)
```
props:nfl:*     → Redis Instance 1
props:nba:*     → Redis Instance 2
props:mlb:*     → Redis Instance 3
```

### Caching Strategy
```
Browser → React Query (75s) → /api/props/table (no-store) → Redis
```

---

## 🔒 Security & Access Control

### Free Users
- ✅ Access to `/api/props/table` (manual refresh)
- ❌ No access to `/api/sse/props` (403 Forbidden)
- ⏱️ 60s cooldown on refresh button

### Pro Users
- ✅ Full access to `/api/props/table`
- ✅ Access to `/api/sse/props` (real-time)
- ⏱️ No cooldown limits

### Middleware
```typescript
// app/api/sse/props/route.ts
async function assertPro(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  
  if (profile?.plan !== 'pro' && profile?.plan !== 'admin') {
    return new Response('pro required', { status: 403 })
  }
  
  return null
}
```

---

## ✅ Migration Checklist

- [x] Create adapter (`props-to-odds.ts`)
- [x] Update odds page to use new API
- [x] Add performance monitoring
- [x] Test transformation logic
- [x] Update query keys (`odds-props`)
- [x] Add error handling
- [x] Document architecture

---

## 🎓 Best Practices

### 1. Always Use Adapter
```typescript
// ✅ Good
const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds')
const data = transformPropsResponseToOddsScreen(response, type)

// ❌ Bad
const data = response.rows // Wrong format!
```

### 2. Handle Errors Gracefully
```typescript
try {
  return transformPropsRowToOddsItem(row, type)
} catch (error) {
  console.error('[ADAPTER] Error transforming row:', error, row)
  return null // Filter out invalid rows
}
```

### 3. Monitor Performance
```typescript
const duration = performance.now() - startTime
if (duration > 1000) {
  console.warn(`[FETCH] Slow response: ${duration}ms`)
}
```

### 4. Cache Efficiently
```typescript
// React Query handles caching
staleTime: 75_000,  // 75s before refetch
gcTime: 900_000,     // 15min cache retention
```

---

## 🐛 Troubleshooting

### "No data showing"
1. Check if backend is populating `props:{sport}:*` keys
2. Test API directly: `curl "http://localhost:3000/api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=10"`
3. Check Redis: `redis-cli ZRANGE "props:nfl:sort:roi:pregame:passing_yards" 0 10 REV`

### "SSE not connecting"
1. Verify user has pro plan
2. Check `/api/sse/props?sport=nfl` returns 200 (not 403)
3. Check browser DevTools → Network → EventSource

### "Transformation errors"
1. Check console for `[ADAPTER] Error transforming row`
2. Verify row has required fields (`ent`, `ev`, etc.)
3. Check if `type` parameter is correct ('player' or 'game')

---

## 🎉 Summary

Your odds system now:

1. ✅ Uses modern `props:{sport}:*` architecture
2. ✅ Supports real-time SSE pub/sub
3. ✅ Has efficient adapter layer
4. ✅ Scales horizontally
5. ✅ Has performance monitoring
6. ✅ Works for both free and pro users
7. ✅ Ready for VC-level growth

**The system is production-ready and built to scale!** 🚀



