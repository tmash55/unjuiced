# Ladders Players Filtering Issue

## Problem
The ladders page only shows 3 players for the rushing market, but the odds screen shows 20+ players with rushing props and alternates.

## Root Cause

The `/api/props/players` route filters out players aggressively:

1. **Line 68-73**: Players are filtered if they have no SIDs in `props:{sport}:sids:ent:{ent}:mkt:{mkt}`
2. **Line 81-87**: Players are filtered if none of their SIDs have alternate lines (`props:{sport}:rows:alt:{sid}`)
3. **Line 122**: Players are filtered if they don't match the scope (pregame vs live)

**The critical filter is #2** - Players are only shown if they have `props:{sport}:rows:alt:{sid}` keys.

## Why Odds Screen Shows More Players

The odds screen uses `/api/props/table` which queries:
- `props:{sport}:sort:roi:{scope}:{market}` - ZSET for sorted SIDs
- `props:{sport}:rows:prim` - HASH for primary row data

This API **doesn't require alternates** - it shows all players that have primary rows, regardless of whether they have alternate lines.

## What Your VPS Ingestor Scripts Need to Do

To fix the ladders page, your ingestor scripts must ensure that for **every player** that has alternates:

1. ✅ Create `props:{sport}:players:mkt:{mkt}` set with all player entities
2. ✅ Create `props:{sport}:sids:ent:{ent}:mkt:{mkt}` sets mapping players to SIDs
3. ❌ **CRITICAL**: Create `props:{sport}:rows:alt:{sid}` for each SID that has alternate lines

**The issue is likely that step #3 is missing or incomplete.**

## Debugging

I've added debug logging to `/api/props/players` that will show in development mode:

```
[/api/props/players] Market: rushing_yards, Found X entities in props:nfl:players:mkt:rushing_yards
[/api/props/players] Summary for rushing_yards:
  - Total entities processed: X
  - Filtered (no SIDs): Y
  - Filtered (no alternates): Z  <-- This is likely the problem
  - Filtered (scope mismatch): W
  - Final players returned: 3
```

## Recommended Fix

### Option 1: Fix Ingestor Scripts (Recommended)
Ensure your ingestor scripts create `props:{sport}:rows:alt:{sid}` for all SIDs that have alternate lines. This is the proper solution.

### Option 2: Relax Validation (Quick Fix)
If you want to show players even without alternates (as a temporary fix), we could modify the validation logic to be less strict. However, this defeats the purpose of the ladders feature which requires alternates.

## Key Redis Keys to Verify

For NFL rushing yards market (`rushing_yards`), check:

1. `props:nfl:players:mkt:rushing_yards` - Should have all player entities
2. `props:nfl:sids:ent:{ent}:mkt:rushing_yards` - Should have SIDs for each player
3. `props:nfl:rows:alt:{sid}` - **THIS IS THE PROBLEM** - Should exist for each SID that has alternates

## Next Steps

1. Check your server logs when accessing the ladders page - the debug output will show exactly how many players are being filtered at each stage
2. Verify that your ingestor scripts are creating `props:{sport}:rows:alt:{sid}` keys
3. Check if there's a market key mismatch (e.g., `rushing_yards` vs `rush_yards`)

## Files Modified

- `app/api/props/players/route.ts` - Added debug logging to diagnose the filtering issue

