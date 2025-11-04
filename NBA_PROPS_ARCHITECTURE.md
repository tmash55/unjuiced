# NBA PRA Props - Architecture & Integration

## ✅ Using Existing Props Infrastructure

Instead of creating a separate NBA props API, we're **reusing your existing props table API** that all sports already use. This is cleaner, more maintainable, and leverages your existing ingestor infrastructure.

---

## 🏗️ Architecture Overview

### **3 Clean API Routes for NBA Stats:**

1. **`/api/nba/games`** → Today's game schedule
2. **`/api/nba/live-stats`** → PRA leaderboard from Supabase
3. **`/api/props/table`** → PRA odds/props from Redis **(reused from existing system)**

---

## 📊 Props Data Flow

### **Redis Keys (Already Set Up by Your Ingestor):**

```
ZSET (sorted by ROI):
props:nba:sort:roi:pregame:player_points_rebounds_assists
props:nba:sort:roi:live:player_points_rebounds_assists

HASH (stores all prop data):
props:nba:rows:prim
```

### **API Request:**
```typescript
GET /api/props/table?sport=nba&market=player_points_rebounds_assists&scope=pregame&limit=50
```

### **Response Structure:**
```json
{
  "sids": ["sid1", "sid2", ...],
  "rows": [
    {
      "sid": "string",
      "player": "LeBron James",
      "ent": "pid:2544",
      "team": "LAL",
      "mkt": "player_points_rebounds_assists",
      "ln": 45.5,
      "ev": {
        "matchup": "LAL @ GSW",
        "away": "LAL",
        "home": "GSW"
      },
      "best": {
        "over": { "odds": -110, "book": "draftkings" },
        "under": { "odds": -110, "book": "fanduel" }
      },
      "avg": {
        "over": -108,
        "under": -112
      },
      "books": [...],
      "scope": "pregame",
      "ts": "2025-11-04T12:00:00Z"
    }
  ],
  "nextCursor": "50" // or null if no more
}
```

---

## 🎯 Frontend Integration

### **Custom Hook (`use-nba-stats.ts`):**

```typescript
export function useNBAProps(
  market: string = 'player_points_rebounds_assists',
  scope: 'live' | 'pregame' = 'pregame',
  limit: number = 50,
  enabled: boolean = true
) {
  return useQuery<PropsResponse>({
    queryKey: ['nba', 'props', market, scope, limit],
    queryFn: async () => {
      // Use existing props table API
      const response = await fetch(
        `/api/props/table?sport=nba&market=${market}&scope=${scope}&limit=${limit}`
      );
      
      const data = await response.json();
      
      // Transform to our PropsResponse format
      return {
        props: data.rows.map(row => ({
          sid: row.sid,
          player: row.player || row.ent,
          team: row.team,
          market: row.mkt,
          line: row.ln,
          event: row.ev?.matchup,
          best_over: row.best?.over,
          best_under: row.best?.under,
          avg_over: row.avg?.over,
          avg_under: row.avg?.under,
          is_live: row.scope === 'live',
          updated_at: row.ts,
        })),
        metadata: { market, scope, total: data.rows.length },
        lastUpdated: new Date().toISOString(),
      };
    },
    refetchInterval: 10000, // Poll every 10 seconds
    enabled,
  });
}
```

---

## 🔄 Data Sources Comparison

| Feature | Source | Update Frequency |
|---------|--------|------------------|
| **Game Schedule** | Supabase (`nba_games`) | 20 seconds |
| **Live Stats (PRA)** | Supabase (`nba_player_game_stats`) | 20 seconds |
| **Props/Odds** | Redis (via existing props ingestor) | 10 seconds |

---

## 🎨 NBA Stats Page Structure

```
/stats/nba
│
├── Tab 1: Today's Games (DEFAULT)
│   └── Uses: /api/nba/games
│
├── Tab 2: PRA Leaderboard
│   └── Uses: /api/nba/live-stats
│
├── Tab 3: PRA Odds
│   └── Uses: /api/props/table (EXISTING API)
│       - sport=nba
│       - market=player_points_rebounds_assists
│       - scope=pregame (or live)
│
├── Tab 4: Historical
│   └── Uses: /api/nba/historical
│
└── Tab 5: Advanced
    └── Uses: /api/nba/advanced-stats
```

---

## ✅ Benefits of Using Existing Props API

### **1. Consistency**
- Same API structure across all sports (NFL, NBA, NHL, etc.)
- Your ingestor already populates these Redis keys
- Same error handling and debug logging

### **2. Features Already Built**
- ROI-based ranking (best value props first)
- Pagination with cursor support
- Multiple sportsbook aggregation
- Live vs. Pregame scoping
- Player filtering support

### **3. Maintainability**
- Single props API to maintain
- Shared caching strategy
- Consistent data transformations
- Already integrated with your odds screen

### **4. Performance**
- Redis ZSET for O(log N) ranking
- Efficient HMGET for batch fetches
- Proven to handle high traffic

---

## 🔍 Debug & Monitoring

### **Check if Props Data Exists:**

```bash
# Check ZSET
redis-cli EXISTS "props:nba:sort:roi:pregame:player_points_rebounds_assists"

# Count members
redis-cli ZCARD "props:nba:sort:roi:pregame:player_points_rebounds_assists"

# Check top 5 by ROI
redis-cli ZREVRANGE "props:nba:sort:roi:pregame:player_points_rebounds_assists" 0 4 WITHSCORES

# Check hash
redis-cli HEXISTS "props:nba:rows:prim" "some-sid"
```

### **API Debug Logs (Development Mode):**

The `/api/props/table` route has extensive debug logging:
- Checks if ZSET exists and member count
- Checks if HASH exists and entry count
- Shows SIDs retrieved from ZSET
- Shows which SIDs have missing data in HASH
- Shows final row count returned

---

## 🚀 Testing Checklist

- [ ] Verify your ingestor is populating NBA props in Redis
- [ ] Check Redis keys exist: `props:nba:sort:roi:pregame:player_points_rebounds_assists`
- [ ] Test API directly: `curl http://localhost:3000/api/props/table?sport=nba&market=player_points_rebounds_assists&scope=pregame`
- [ ] Verify props appear on NBA stats page (Tab 3)
- [ ] Check polling is working (should update every 10 seconds)
- [ ] Test both pregame and live scopes

---

## 📝 Example Usage on NBA Stats Page

```typescript
// In /stats/nba page
const { data: propsData } = useNBAProps(
  'player_points_rebounds_assists',
  'pregame',
  50,
  activeTab === 'props'
);

// propsData will have:
// - props: Array of NBAProp with player, line, odds, etc.
// - metadata: { market, scope, total }
// - lastUpdated: ISO timestamp
```

---

## 🎉 Result

You now have **3 clean, focused API routes**:

1. ✅ **Games** - Supabase for schedule
2. ✅ **Stats** - Supabase for live leaderboard  
3. ✅ **Props** - Redis for odds (reuses existing infrastructure)

All integrated seamlessly into the NBA stats page with proper polling, TypeScript types, and error handling! 🚀

