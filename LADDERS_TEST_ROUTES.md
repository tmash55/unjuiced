# Ladders API Test Routes

## Test SID
```
71688971e063d0033f8a17a726663b30c723fad
```

## API Routes to Test

### 1. Get Ladder Family Data
```
GET /api/props/alt?sport=nfl&sid=71688971e063d0033f8a17a726663b30c723fad
```

**Expected Response:**
```json
{
  "eid": "event_id_here",
  "ent": "player_entity_id",
  "mkt": "receiving_yards",
  "player": "Player Name",
  "team": "PHI",
  "position": "WR",
  "primary_ln": 67.5,
  "ev": {
    "eid": "event_id_here",
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
      "ln": 67.5,
      "books": { ... },
      "best": { ... },
      "avg": { ... }
    }
  ]
}
```

### 2. Get Markets
```
GET /api/props/mkts?sport=nfl
```

### 3. Get Players
```
GET /api/props/players?sport=nfl&mkt=receiving_yards&scope=pregame
```

### 4. Find SID
```
GET /api/props/find?sport=nfl&ent=player_entity_id&mkt=receiving_yards
```

## Testing in Browser Console

Open the ladders page and run:

```javascript
// Test the API directly
fetch('/api/props/alt?sport=nfl&sid=71688971e063d0033f8a17a726663b30c723fad')
  .then(r => r.json())
  .then(data => {
    console.log('Full response:', data);
    console.log('Event data:', data.ev);
    console.log('Event details:', data.ev?.event);
  });
```

## Check Redis Data

If the API returns data but `ev` is missing, check Redis:

```bash
# Get the raw data from Redis
redis-cli GET "props:nfl:rows:alt:71688971e063d0033f8a17a726663b30c723fad"
```

## Expected Data Structure

The `family` object should have:
- `eid` - Event ID
- `ev` - Event metadata object
  - `dt` - ISO timestamp (UTC)
  - `live` - Boolean
  - `home` - Home team object (or string abbreviation)
    - `id` - Team ID
    - `name` - Full team name (e.g., "Kansas City Chiefs")
    - `abbr` - Team abbreviation (e.g., "KC")
  - `away` - Away team object (or string abbreviation)
    - `id` - Team ID
    - `name` - Full team name (e.g., "Washington Commanders")
    - `abbr` - Team abbreviation (e.g., "WSH")

## Debugging Steps

1. **Check console logs** - Look for the debug logs we just added
2. **Test API route** - Use the fetch command above
3. **Check network tab** - See what the actual API response is
4. **Verify Redis** - Make sure the ingestor is populating `ev` field

## ✅ Issue Resolved: Event Data Structure

**Previous Issue:** Frontend was looking for `family.ev.event.away` but the actual structure is `family.ev.away`.

**Actual Data Structure from Redis:**
```json
{
  "ev": {
    "dt": "2025-10-28T00:15:00.000Z",
    "live": false,
    "home": {
      "id": "8154910f-5350-51eb-8057-8ff763174ea8",
      "name": "Kansas City Chiefs",
      "abbr": "KC"
    },
    "away": {
      "id": "657995cc-1a57-5119-8d94-fafb109f5620",
      "name": "Washington Commanders",
      "abbr": "WSH"
    }
  }
}
```

**Fix Applied:**
- Updated frontend to read from `family.ev.away` and `family.ev.home` (not `family.ev.event.away`)
- Added support for both object format (`{id, name, abbr}`) and string format
- Displays team abbreviation by default, falls back to full name if abbr is missing
- Event info section now displays correctly with matchup, game time, and live status

