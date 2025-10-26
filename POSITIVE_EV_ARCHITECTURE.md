# Positive EV Feature - Architecture Guide

## 🎯 Overview

Build a worker that subscribes to `pub:props:{sport}` channels, calculates positive expected value (EV), and publishes EV opportunities to a new Redis channel.

---

## 📊 Current Props Architecture

### **Redis Pub/Sub Structure**

```
pub:props:nfl      → Real-time props updates for NFL
pub:props:nba      → Real-time props updates for NBA
pub:props:nhl      → Real-time props updates for NHL
pub:props:mlb      → Real-time props updates for MLB
pub:props:ncaaf    → Real-time props updates for NCAAF
```

### **Message Format**

```typescript
{
  add: ["sid1", "sid2"],  // New rows added
  upd: ["sid3", "sid4"],  // Existing rows updated
  del: ["sid5"]           // Rows deleted
}
```

### **Row Data Structure** (from `props:{sport}:rows:prim`)

```typescript
{
  sid: "nfl_evt123_p456_py",           // Unique row ID
  eid: "evt123",                        // Event ID
  ent: "pid:p456",                      // Entity (player/game)
  player: "Patrick Mahomes",            // Player name (or null)
  team: "KC",                           // Team abbreviation
  position: "QB",                       // Position
  mkt: "player_pass_yds",               // Market type
  ln: 275.5,                            // Primary line
  ev: {
    dt: "2025-10-26T17:00:00.000Z",    // Game datetime
    live: false,
    home: { id: "KC", name: "Kansas City Chiefs", abbr: "KC" },
    away: { id: "LV", name: "Las Vegas Raiders", abbr: "LV" }
  },
  best: {
    over: { bk: "draftkings", price: -110 },
    under: { bk: "fanduel", price: -110 }
  },
  avg: {
    over: -108,
    under: -112
  },
  books: {
    "draftkings": {
      over: { price: -110, line: 275.5, u: "https://..." },
      under: { price: -110, line: 275.5, u: "https://..." }
    },
    "fanduel": {
      over: { price: -105, line: 275.5, u: "https://..." },
      under: { price: -115, line: 275.5, u: "https://..." }
    }
    // ... more sportsbooks
  },
  ts: 1729958400000                     // Timestamp
}
```

---

## 🧮 Positive EV Calculation

### **Formula**

```typescript
EV% = (Implied Probability × Payout) - (1 - Implied Probability) × Stake

Where:
- Implied Probability = Fair odds (from consensus/model)
- Payout = Amount won if bet wins
- Stake = Amount wagered
```

### **Example Calculation**

```typescript
// Best odds: DraftKings +110 (over)
// Average odds: -108 (over) ← Use as "fair" odds

const bestOdds = 110;                    // DraftKings
const avgOdds = -108;                    // Market consensus

// Convert to implied probability
const bestImplied = oddsToImplied(110);  // 47.62%
const fairImplied = oddsToImplied(-108); // 51.92%

// Calculate EV
const edgePercent = fairImplied - bestImplied;  // 4.3%
const ev = edgePercent * 100;                   // +4.3% EV

// If EV > 0, it's a positive EV bet!
```

### **Helper Functions**

```typescript
function oddsToImplied(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

function calculateEV(bestOdds: number, fairOdds: number): number {
  const bestImplied = oddsToImplied(bestOdds);
  const fairImplied = oddsToImplied(fairOdds);
  return (fairImplied - bestImplied) * 100;
}
```

---

## 🏗️ Proposed Architecture

### **1. EV Worker (New)**

```typescript
// workers/ev-calculator.ts

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SPORTS = ['nfl', 'nba', 'nhl', 'mlb', 'ncaaf'];
const MIN_EV_THRESHOLD = 2.0; // Minimum 2% EV to publish

async function processPropsUpdate(sport: string, message: any) {
  const { add = [], upd = [] } = message;
  const needIds = [...new Set([...add, ...upd])];
  
  if (needIds.length === 0) return;
  
  // Fetch full row data
  const rows = await redis.mget(...needIds.map(id => `props:${sport}:rows:prim:${id}`));
  
  const evOpportunities = [];
  
  for (const row of rows) {
    if (!row) continue;
    
    // Calculate EV for both sides
    const overEV = calculateEV(row.best?.over?.price, row.avg?.over);
    const underEV = calculateEV(row.best?.under?.price, row.avg?.under);
    
    // Check if either side has positive EV above threshold
    if (overEV >= MIN_EV_THRESHOLD) {
      evOpportunities.push({
        sid: row.sid,
        eid: row.eid,
        player: row.player,
        team: row.team,
        mkt: row.mkt,
        ln: row.ln,
        side: 'over',
        ev: overEV,
        bestBook: row.best?.over?.bk,
        bestOdds: row.best?.over?.price,
        fairOdds: row.avg?.over,
        url: row.books?.[row.best?.over?.bk]?.over?.u,
        ev: row.ev,
        ts: Date.now(),
      });
    }
    
    if (underEV >= MIN_EV_THRESHOLD) {
      evOpportunities.push({
        sid: row.sid,
        eid: row.eid,
        player: row.player,
        team: row.team,
        mkt: row.mkt,
        ln: row.ln,
        side: 'under',
        ev: underEV,
        bestBook: row.best?.under?.bk,
        bestOdds: row.best?.under?.price,
        fairOdds: row.avg?.under,
        url: row.books?.[row.best?.under?.bk]?.under?.u,
        ev: row.ev,
        ts: Date.now(),
      });
    }
  }
  
  if (evOpportunities.length > 0) {
    // Store in Redis
    const pipeline = redis.pipeline();
    
    for (const opp of evOpportunities) {
      const key = `ev:${sport}:rows:${opp.sid}:${opp.side}`;
      pipeline.set(key, JSON.stringify(opp), { ex: 3600 }); // 1 hour TTL
    }
    
    await pipeline.exec();
    
    // Publish update
    await redis.publish(`pub:ev:${sport}`, {
      add: evOpportunities.map(o => `${o.sid}:${o.side}`),
      sport,
      count: evOpportunities.length,
    });
  }
}

// Subscribe to all sports
async function startEVWorker() {
  for (const sport of SPORTS) {
    const channel = `pub:props:${sport}`;
    
    // Subscribe to Redis pub/sub
    const subscriber = redis.duplicate();
    await subscriber.subscribe(channel, (message) => {
      processPropsUpdate(sport, JSON.parse(message));
    });
    
    console.log(`✅ Subscribed to ${channel}`);
  }
}

startEVWorker();
```

---

## 📡 New Redis Structure

### **EV Rows**

```
ev:nfl:rows:{sid}:over   → EV opportunity data (over side)
ev:nfl:rows:{sid}:under  → EV opportunity data (under side)
```

### **EV Pub/Sub**

```
pub:ev:nfl    → Real-time EV updates for NFL
pub:ev:nba    → Real-time EV updates for NBA
pub:ev:nhl    → Real-time EV updates for NHL
```

### **EV Message Format**

```typescript
{
  add: ["sid1:over", "sid2:under"],  // New EV opportunities
  upd: ["sid3:over"],                // Updated EV opportunities
  del: ["sid4:under"],               // EV opportunities expired
  sport: "nfl",
  count: 3
}
```

---

## 🎨 Frontend Integration

### **1. New API Route** (`app/api/ev/table/route.ts`)

```typescript
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sport = sp.get('sport') || 'nfl';
  const limit = parseInt(sp.get('limit') || '100');
  
  // Fetch EV opportunities from Redis
  const keys = await redis.keys(`ev:${sport}:rows:*`);
  const rows = await redis.mget(...keys.slice(0, limit));
  
  return NextResponse.json({
    rows: rows.filter(Boolean),
    count: rows.length,
  });
}
```

### **2. New SSE Route** (`app/api/sse/ev/route.ts`)

```typescript
export async function GET(req: NextRequest) {
  // Same pattern as props SSE
  const sport = req.nextUrl.searchParams.get('sport') || 'nfl';
  const channel = `pub:ev:${sport}`;
  
  // Subscribe to Upstash Redis pub/sub
  const upstream = await fetch(`${url}/subscribe/${encodeURIComponent(channel)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
  });
  
  // Stream to client
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

### **3. New EV Table Component**

```typescript
// app/(protected)/ev/[sport]/page.tsx

export default function EVPage({ params }: { params: { sport: string } }) {
  const [data, setData] = useState([]);
  
  // Initial fetch
  useEffect(() => {
    fetch(`/api/ev/table?sport=${params.sport}`)
      .then(r => r.json())
      .then(d => setData(d.rows));
  }, [params.sport]);
  
  // SSE for live updates
  const { lastMessage } = useSSE(`/api/sse/ev?sport=${params.sport}`, {
    enabled: true,
    onMessage: async (message) => {
      const { add = [], upd = [] } = message;
      const needIds = [...new Set([...add, ...upd])];
      
      if (needIds.length > 0) {
        // Fetch updated rows
        const response = await fetch('/api/ev/rows', {
          method: 'POST',
          body: JSON.stringify({ sport: params.sport, ids: needIds }),
        });
        const { rows } = await response.json();
        
        // Merge updates
        setData(prev => {
          const map = new Map(rows.map(r => [r.sid + ':' + r.side, r]));
          return prev.map(item => map.get(item.sid + ':' + item.side) ?? item);
        });
      }
    },
  });
  
  return (
    <div>
      <h1>Positive EV Opportunities - {params.sport.toUpperCase()}</h1>
      <EVTable data={data} />
    </div>
  );
}
```

---

## 🎯 EV Table Features

### **Columns**

1. **Player/Game** - Who/what the bet is on
2. **Market** - Type of bet (passing yards, points, etc.)
3. **Line** - The number (e.g., 275.5)
4. **Side** - Over or Under
5. **Best Odds** - Highest odds available
6. **Sportsbook** - Where to place the bet
7. **Fair Odds** - Market consensus (average)
8. **EV%** - Expected value percentage (highlight if > 5%)
9. **Action** - Deep link button to place bet

### **Filters**

- Sport (NFL, NBA, NHL, MLB, NCAAF)
- Minimum EV% (2%, 3%, 5%, 10%)
- Market type (passing yards, points, rebounds, etc.)
- Sportsbook (filter by available books)

### **Sorting**

- By EV% (highest first)
- By game time (soonest first)
- By player name (alphabetical)

---

## 🔒 Pro Feature Gate

```typescript
// Only Pro users can access EV feature
const { isPro } = useIsPro();

if (!isPro) {
  return <ProGate feature="Positive EV" />;
}
```

---

## 📊 Analytics & Tracking

### **Metrics to Track**

1. **EV Opportunities Found** - Total count per sport
2. **Average EV%** - Mean EV across all opportunities
3. **Top Sportsbooks** - Which books offer best EV most often
4. **Hit Rate** - % of EV bets that win (requires result tracking)
5. **User Engagement** - Clicks, deep links opened

### **Redis Keys for Stats**

```
ev:stats:nfl:count        → Total EV opportunities
ev:stats:nfl:avg_ev       → Average EV%
ev:stats:nfl:top_books    → Sorted set of books by EV count
```

---

## 🚀 Deployment

### **Worker Deployment Options**

1. **Cloudflare Workers** - Edge compute, low latency
2. **Vercel Cron** - Scheduled functions
3. **Railway** - Long-running Node.js process
4. **Fly.io** - Global edge deployment

### **Recommended: Cloudflare Workers**

```typescript
// wrangler.toml
name = "ev-calculator"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { UPSTASH_REDIS_REST_URL = "...", UPSTASH_REDIS_REST_TOKEN = "..." }
```

---

## 🧪 Testing

### **Test EV Calculation**

```typescript
// Test with known values
const bestOdds = 110;   // +110
const avgOdds = -108;   // -108

const ev = calculateEV(bestOdds, avgOdds);
console.log(`EV: ${ev.toFixed(2)}%`); // Should be ~4.3%
```

### **Test Redis Pub/Sub**

```bash
# Subscribe to EV channel
redis-cli SUBSCRIBE pub:ev:nfl

# Publish test message
redis-cli PUBLISH pub:ev:nfl '{"add":["test:over"],"count":1}'
```

---

## 📝 Next Steps

1. **Build EV Worker** - Subscribe to `pub:props:{sport}`, calculate EV
2. **Store EV Data** - Write to `ev:{sport}:rows:{sid}:{side}`
3. **Publish Updates** - Send to `pub:ev:{sport}`
4. **Create API Routes** - `/api/ev/table`, `/api/sse/ev`
5. **Build Frontend** - EV table component with filters
6. **Add Pro Gate** - Restrict to Pro users
7. **Test & Deploy** - Verify calculations, deploy worker

---

## 🎯 Success Metrics

- **EV Opportunities**: 50-200 per sport at any time
- **Update Latency**: < 2 seconds from props update to EV publish
- **Accuracy**: EV calculations match manual verification
- **Performance**: Worker handles 1000+ updates/minute
- **User Engagement**: 20%+ of Pro users use EV feature

---

**Ready to build?** Start with the EV worker, then add the frontend! 🚀


