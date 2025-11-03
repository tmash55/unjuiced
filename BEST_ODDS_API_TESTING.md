# Best Odds API - Testing Guide

## Prerequisites

1. Start the Next.js dev server:
```bash
npm run dev
```

2. Ensure your VPS ingestor is running and populating the following Redis keys:
   - `best_odds:all:sort:improvement` (ZSET)
   - `best_odds:all:sort:pregame` (ZSET)
   - `best_odds:all:sort:live` (ZSET)
   - `props:{sport}:best_odds:sort:improvement` (ZSET per sport)
   - `props:{sport}:best_odds:sort:pregame` (ZSET per sport)
   - `props:{sport}:best_odds:sort:live` (ZSET per sport)
   - `props:{sport}:best_odds:rows` (HASH with deal data)
   - `best_odds:all:v` (version counter)
   - `props:{sport}:best_odds:v` (version counter per sport)

## Testing the GET Endpoint

### Test 1: Basic Request (All Sports, Free User)
```bash
curl "http://localhost:3000/api/best-odds?sport=all&limit=10" | jq
```

**Expected Result:**
- Returns JSON with `version`, `total`, `deals` array
- Free users should only see deals with `priceImprovement < 10`
- Check server console for logs: `[/api/best-odds] Query:`, `[/api/best-odds] ZSET key:`, etc.

### Test 2: NFL Only
```bash
curl "http://localhost:3000/api/best-odds?sport=nfl&limit=20" | jq
```

**Expected Result:**
- Only NFL deals returned
- Each deal should have `sport: "nfl"`

### Test 3: Pregame Scope Only
```bash
curl "http://localhost:3000/api/best-odds?sport=all&scope=pregame&limit=15" | jq
```

**Expected Result:**
- Only pregame deals (not live)
- Queries `best_odds:all:sort:pregame` ZSET

### Test 4: Live Scope Only
```bash
curl "http://localhost:3000/api/best-odds?sport=all&scope=live&limit=15" | jq
```

**Expected Result:**
- Only live deals
- Queries `best_odds:all:sort:live` ZSET

### Test 5: Minimum Improvement Filter
```bash
curl "http://localhost:3000/api/best-odds?sport=all&minImprovement=5&limit=20" | jq
```

**Expected Result:**
- All deals have `priceImprovement >= 5`
- Free users still capped at < 10% improvement

### Test 6: Odds Range Filter
```bash
curl "http://localhost:3000/api/best-odds?sport=nfl&minOdds=-200&maxOdds=200&limit=20" | jq
```

**Expected Result:**
- All deals have `bestPrice` between -200 and 200

### Test 7: Pagination
```bash
# First page
curl "http://localhost:3000/api/best-odds?sport=all&limit=10&offset=0" | jq '.deals | length'

# Second page
curl "http://localhost:3000/api/best-odds?sport=all&limit=10&offset=10" | jq '.deals | length'
```

**Expected Result:**
- Both return up to 10 deals
- Different deals on each page

### Test 8: NBA and NHL
```bash
# NBA
curl "http://localhost:3000/api/best-odds?sport=nba&limit=10" | jq

# NHL
curl "http://localhost:3000/api/best-odds?sport=nhl&limit=10" | jq
```

**Expected Result:**
- Returns deals for the respective sport
- Each deal has correct `sport` field

## Testing the SSE Endpoint

### Test 1: Basic Connection (All Sports)
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=all"
```

**Expected Result:**
- Connection opens immediately
- Receives `hello` event within 1 second:
  ```
  event: hello
  data: {"sport":"all","isPro":false}
  ```
- Receives `: ping` heartbeat every 15 seconds
- Connection stays open indefinitely

### Test 2: NFL Only Stream
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=nfl"
```

**Expected Result:**
- Subscribes to `pub:props:nfl:best_odds` channel
- Hello event shows `"sport":"nfl"`

### Test 3: NBA Stream
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=nba"
```

### Test 4: NHL Stream
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=nhl"
```

### Test 5: Verify Free User Filtering (Requires Backend Publishing)

To test this, your VPS ingestor needs to publish a test message with high improvement:

**On your VPS ingestor:**
```python
import redis
import json

r = redis.Redis(host='...', port=6379, decode_responses=True)

# Publish a deal with 15% improvement (should be filtered for free users)
test_deal = {
    "deals": [{
        "ent": "pid:test",
        "mkt": "passing_yards",
        "ln": 250.5,
        "side": "o",
        "best_book": "draftkings",
        "best_price": -105,
        "price_improvement": 15.5,  # High improvement
        "scope": "pregame"
    }]
}

r.publish('pub:best_odds:all', json.dumps(test_deal))
```

**On your frontend:**
```bash
curl -N "http://localhost:3000/api/sse/best-odds?sport=all"
```

**Expected Result:**
- Free users: Deal is NOT sent (filtered out due to 15% > 10% threshold)
- Pro users: Deal IS sent
- Check server console for: `[/api/sse/best-odds] Filtered deals for free user:`

## Verification Checklist

- [x] GET endpoint returns valid JSON with correct schema
- [ ] Free users see only improvements < 10% *(Requires backend data)*
- [ ] Pro users see all improvements *(Requires Pro account login)*
- [ ] sport=all returns deals from multiple sports *(Requires multi-sport data)*
- [ ] sport=nfl returns only NFL deals
- [ ] scope=pregame filters correctly *(Requires pregame data)*
- [ ] scope=live filters correctly *(Requires live data)*
- [ ] minImprovement filter works *(Requires data with various improvements)*
- [ ] maxOdds/minOdds filters work *(Requires data with various odds)*
- [ ] limit and offset pagination work *(Requires sufficient data)*
- [ ] SSE connects and sends hello event
- [ ] SSE sends data events *(Requires backend publishing)*
- [ ] SSE heartbeat pings work (wait 15+ seconds)
- [ ] Version number is returned correctly
- [ ] Error handling works (invalid params, Redis failures)

## Debugging

### Check Redis Keys Exist

```bash
# Connect to your Redis instance
redis-cli

# Check if keys exist
EXISTS best_odds:all:sort:improvement
ZCARD best_odds:all:sort:improvement

EXISTS props:nfl:best_odds:sort:improvement
ZCARD props:nfl:best_odds:sort:improvement

EXISTS props:nfl:best_odds:rows
HLEN props:nfl:best_odds:rows

# Sample a few entries
ZRANGE best_odds:all:sort:improvement 0 5 WITHSCORES REV
HGET props:nfl:best_odds:rows "evt_some_eid:pid:some_player:passing_yards:250.5:o"
```

### Check Server Console Logs

When testing, watch the Next.js dev server console for:

```
[/api/best-odds] Query: { sport: 'nfl', scope: 'all', limit: 10, ... }
[/api/best-odds] ZSET key: props:nfl:best_odds:sort:improvement
[/api/best-odds] Raw ZSET results: 20 items
[/api/best-odds] Found entries after filtering: 10
[/api/best-odds] Deals after filtering: 10
[/api/best-odds] Version: 42
```

For SSE:
```
[/api/sse/best-odds] Connection request: { userId: undefined, isPro: false }
[/api/sse/best-odds] Subscribing to channel: pub:best_odds:all
[/api/sse/best-odds] Filtered deals for free user: { original: 5, filtered: 2 }
```

## Next Steps

Once testing is complete and all endpoints are working:

1. ✅ Create client library (`lib/best-odds-client.ts`)
2. ✅ Create React hooks (`hooks/use-best-odds.ts`)
3. ✅ Build frontend page at `/app/(protected)/best-odds/page.tsx`
4. ✅ Create table component similar to arbitrage table
5. ✅ Add filters UI (sport, scope, improvement threshold)
6. ✅ Connect SSE for real-time updates
7. ✅ Add loading states and error handling
8. ✅ Style similar to arbitrage table

## Common Issues

### Issue: "No data found for key"
- **Cause:** The ZSET has keys but the HASH doesn't have the data
- **Fix:** Check that your ingestor is populating both the ZSET and HASH

### Issue: "Raw ZSET results: 0 items"
- **Cause:** The ZSET is empty or doesn't exist
- **Fix:** Verify your ingestor is running and populating the correct Redis keys

### Issue: SSE connects but never sends data events
- **Cause:** No messages are being published to the Redis channel
- **Fix:** Check that your ingestor is publishing to `pub:best_odds:all` or sport-specific channels

### Issue: All deals filtered out for free users
- **Cause:** All deals have improvement >= 10%
- **Fix:** This is expected behavior! Free users only see deals with < 10% improvement

### Issue: TypeScript errors
- **Cause:** Schema mismatch between backend and frontend
- **Fix:** Update `lib/best-odds-schema.ts` to match backend data structure

