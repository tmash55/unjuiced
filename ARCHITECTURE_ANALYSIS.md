# Backend Architecture Analysis: Old vs New System

## 📊 Overview

You're transitioning from **legacy Redis keys** (`odds:{sport}`) to a **modern pub/sub architecture** with new keys (`props:{sport}:*`). This enables real-time UI updates like a VC-grade product.

---

## 🔴 **LEGACY SYSTEM** (Old - To Be Deprecated)

### Routes Using Old Keys

#### 1. `/api/odds-screen/route.ts`
**Redis Keys:**
```typescript
// Player props
`odds:${sport}:props:${market}:primary:${scope}`

// Game props
`odds:${sport}:props:${market}:game:primary:${scope}`
```

**What it does:**
- Fetches static snapshots of odds data from Redis
- No real-time updates
- ETag caching for conditional GET requests
- Transforms data into `OddsScreenItem[]` format
- Supports search and game filtering

**Issues:**
- ❌ No real-time updates
- ❌ Uses old key structure
- ❌ Data can be stale
- ❌ No pub/sub integration

---

#### 2. `/api/odds-screen/alternates/route.ts`
**Redis Keys:**
```typescript
// Player alternates
`odds:${sport}:props:${market}:alts:event:${eventId}:${scope}`

// Game alternates
`odds:${sport}:props:${market}:game:alts:event:${eventId}:${scope}`
```

**What it does:**
- Fetches alternate lines for a specific event
- Returns raw JSON data from Redis
- Used for expanding rows in the odds table

**Issues:**
- ❌ No real-time updates
- ❌ Uses old key structure
- ❌ Not connected to pub/sub

---

## 🟢 **NEW SYSTEM** (Modern - Active Development)

### Routes Using New Keys

#### 1. `/api/sse/props/route.ts` ✅
**Redis Channel:**
```typescript
`pub:props:${sport}`
```

**What it does:**
- **Server-Sent Events (SSE)** for real-time odds updates
- Subscribes to Redis pub/sub channel
- Streams updates to frontend as they happen
- Pro-only feature (auth required)
- Includes ping mechanism to keep connection alive

**Advantages:**
- ✅ Real-time updates
- ✅ Pub/sub architecture
- ✅ VC-grade UX with live data
- ✅ Efficient streaming

---

#### 2. `/api/props/table/route.ts` ✅
**Redis Keys:**
```typescript
// Sorted set for ROI ranking
`props:${sport}:sort:roi:${scope}:${market}`

// Hash for row data
`props:${sport}:rows:prim`
```

**What it does:**
- Fetches paginated rows from new key structure
- Uses ZSET for efficient ranking/sorting by ROI
- Supports cursor-based pagination
- Optional filters: `playerId`, `team`
- Returns `{ sids, rows, nextCursor }`

**Advantages:**
- ✅ Modern key structure
- ✅ Efficient pagination
- ✅ Real-time compatible
- ✅ Cursor-based (infinite scroll ready)

---

#### 3. `/api/props/rows/route.ts` ✅
**Redis Keys:**
```typescript
`props:${sport}:rows:prim`
```

**What it does:**
- Fetches specific rows by SID (stable ID)
- Batch fetch via POST with `sids` array
- Uses HMGET for efficient bulk retrieval
- Returns `{ rows: [{ sid, row }] }`

**Advantages:**
- ✅ Batch-friendly
- ✅ Efficient bulk fetches
- ✅ Works with SSE updates

---

#### 4. `/api/props/alternates/[sid]/route.ts` ✅
**Redis Keys:**
```typescript
`props:${sport}:rows:alt`
```

**What it does:**
- Fetches alternate lines for a specific SID
- Returns `{ family }` with all alternate lines
- Used for expanding rows to show more options

**Advantages:**
- ✅ Modern key structure
- ✅ SID-based (stable across updates)
- ✅ Ready for SSE integration

---

#### 5. `/api/props/markets/route.ts` ✅
**Redis Keys:**
```typescript
`idx:${sport}:props:markets`
```

**What it does:**
- Fetches available markets for a sport
- Fallback to static list if Redis key doesn't exist
- Cached with 5-minute TTL

**Advantages:**
- ✅ Dynamic market discovery
- ✅ Cached for performance
- ✅ Fallback for reliability

---

#### 6. `/api/sse/arbs/route.ts` ✅
**Redis Channel:**
```typescript
`pub:arbs`
```

**What it does:**
- SSE feed for arbitrage opportunities
- Real-time arb updates
- Pro-only feature

**Advantages:**
- ✅ Real-time arbs
- ✅ Pub/sub architecture
- ✅ Production-ready

---

## 🔑 **Key Structure Comparison**

### Old System (Legacy)
```
odds:{sport}:props:{market}:primary:{scope}
odds:{sport}:props:{market}:game:primary:{scope}
odds:{sport}:props:{market}:alts:event:{eventId}:{scope}
```

### New System (Modern)
```
props:{sport}:rows:prim          (HASH - primary rows)
props:{sport}:rows:alt           (HASH - alternate lines)
props:{sport}:sort:roi:{scope}:{market}  (ZSET - sorted by ROI)
idx:{sport}:props:markets        (INDEX - available markets)
pub:props:{sport}                (PUB/SUB - real-time updates)
pub:arbs                         (PUB/SUB - arbitrage feed)
```

---

## 🎯 **Migration Path**

### Phase 1: Verify New System Works ✅
1. **Test SSE Feed:**
   ```bash
   # Open in browser/Postman
   GET http://localhost:3000/api/sse/props?sport=nfl
   
   # Should see:
   event: hello
   data: {}
   
   : ping
   
   event: update
   data: {...}
   ```

2. **Test Table API:**
   ```bash
   GET http://localhost:3000/api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=10
   
   # Should return:
   {
     "sids": ["sid1", "sid2", ...],
     "rows": [...],
     "nextCursor": "10"
   }
   ```

3. **Test Rows API:**
   ```bash
   POST http://localhost:3000/api/props/rows
   Content-Type: application/json
   
   {
     "sport": "nfl",
     "sids": ["sid1", "sid2"]
   }
   
   # Should return:
   {
     "rows": [
       { "sid": "sid1", "row": {...} },
       { "sid": "sid2", "row": {...} }
     ]
   }
   ```

4. **Test Alternates API:**
   ```bash
   GET http://localhost:3000/api/props/alternates/sid1?sport=nfl
   
   # Should return:
   {
     "family": {
       "lines": {...}
     }
   }
   ```

---

### Phase 2: Update Frontend to Use New APIs
1. Replace `/api/odds-screen` calls with `/api/props/table`
2. Integrate SSE feed for real-time updates
3. Update alternates fetching to use new endpoint
4. Add live color changes when odds update

---

### Phase 3: Deprecate Old Routes
1. Add deprecation warnings to `/api/odds-screen/*`
2. Monitor usage of old routes
3. Remove old routes after full migration

---

## 🧪 **Testing Checklist**

### SSE Feed (`/api/sse/props`)
- [ ] Connect to SSE endpoint with `sport=nfl`
- [ ] Verify "hello" event received
- [ ] Verify ping events every 15s
- [ ] Verify data events when odds update
- [ ] Test reconnection on disconnect
- [ ] Test with multiple sports

### Table API (`/api/props/table`)
- [ ] Fetch first page (cursor=0, limit=10)
- [ ] Fetch second page (cursor=10, limit=10)
- [ ] Test with different markets
- [ ] Test with playerId filter
- [ ] Test with team filter
- [ ] Verify nextCursor is null on last page

### Rows API (`/api/props/rows`)
- [ ] Fetch single SID
- [ ] Fetch batch of SIDs (10+)
- [ ] Test with invalid SIDs
- [ ] Verify fallback HGET if HMGET fails

### Alternates API (`/api/props/alternates/[sid]`)
- [ ] Fetch alternates for valid SID
- [ ] Test with invalid SID
- [ ] Verify family structure matches old format

---

## 💡 **Recommended Testing Order**

1. **Start with Markets API** - Simple, no auth required
   ```bash
   curl http://localhost:3000/api/props/markets?sport=nfl
   ```

2. **Test Table API** - Core functionality
   ```bash
   curl "http://localhost:3000/api/props/table?sport=nfl&market=passing_yards&scope=pregame&limit=5"
   ```

3. **Test Rows API** - Use SIDs from table response
   ```bash
   curl -X POST http://localhost:3000/api/props/rows \
     -H "Content-Type: application/json" \
     -d '{"sport":"nfl","sids":["sid_from_step2"]}'
   ```

4. **Test Alternates API** - Use SID from table response
   ```bash
   curl "http://localhost:3000/api/props/alternates/sid_from_step2?sport=nfl"
   ```

5. **Test SSE Feed** (requires Pro account)
   - Open in browser: `http://localhost:3000/api/sse/props?sport=nfl`
   - Or use EventSource in frontend:
     ```typescript
     const eventSource = new EventSource('/api/sse/props?sport=nfl');
     eventSource.onmessage = (event) => {
       console.log('Update:', JSON.parse(event.data));
     };
     ```

---

## 🚨 **Key Differences**

| Feature | Old System | New System |
|---------|-----------|-----------|
| **Real-time** | ❌ No | ✅ Yes (SSE) |
| **Key Structure** | `odds:{sport}` | `props:{sport}:*` |
| **Pagination** | ❌ Load all | ✅ Cursor-based |
| **Sorting** | Client-side | Server-side (ZSET) |
| **IDs** | Event-based | SID (stable) |
| **Batch Fetching** | ❌ No | ✅ Yes (HMGET) |
| **UI Updates** | Manual refresh | Live streaming |

---

## 📝 **Next Steps**

1. **Run the tests above** to verify new APIs work
2. **Share results** with me
3. **I'll help migrate** the frontend to use new APIs
4. **We'll add** live color changes for odds updates
5. **Deploy** the new architecture

Let me know what you find! 🚀


