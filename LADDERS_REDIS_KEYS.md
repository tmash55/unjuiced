# Ladders Component - Redis Keys Reference

This document outlines all the Redis keys used by the NFL ladders feature (and other sports) to ensure your VPS ingestor scripts create the necessary keys for all supported sports.

## Supported Sports
- `nfl`
- `nba`
- `nhl`
- `ncaaf`

## Core Redis Keys Required

### 1. Finding SIDs (Player → SID mapping)
**API Route:** `/api/props/find`

**Keys Used:**
- `props:{sport}:sids:ent:{ent}:mkt:{mkt}` 
  - **Type:** Set
  - **Contains:** Array of SIDs for a specific player entity (`ent`) and market (`mkt`)
  - **Example:** `props:nfl:sids:ent:12345:mkt:rushing_yards`
  - **Used in:** `app/api/props/find/route.ts:29`

- `props:{sport}:rows:alt:{sid}`
  - **Type:** String (JSON)
  - **Contains:** Ladder family data with alternate lines
  - **Used for:** Validation that SID exists before returning
  - **Used in:** `app/api/props/find/route.ts:38`

- `props:{sport}:sid2primary`
  - **Type:** Hash
  - **Contains:** Mapping of SIDs to their primary SID
  - **Used for:** Resolving secondary SIDs to primary SIDs when original doesn't exist
  - **Used in:** `app/api/props/find/route.ts:46`

### 2. Getting Ladder Family Data (Alternate Lines)
**API Route:** `/api/props/alt`

**Keys Used:**
- `props:{sport}:rows:alt:{sid}`
  - **Type:** String (JSON)
  - **Contains:** Complete ladder family data with all alternate lines
  - **This is the main data source for displaying ladders**
  - **Used in:** `app/api/props/alt/route.ts:29`

### 3. Listing Players for a Market
**API Route:** `/api/props/players`

**Keys Used:**
- `props:{sport}:players:mkt:{mkt}` ⭐ **CRITICAL**
  - **Type:** Set
  - **Contains:** Array of player entity IDs (`ent`) available for a market
  - **Example:** `props:nfl:players:mkt:passing_yards` → `["pid:00-0036355", "pid:00-0039732", ...]`
  - **Used in:** `app/api/props/players/route.ts:43`
  - **⚠️ MUST BE POPULATED:** This is the source of truth for which players appear in the dropdown

- `props:{sport}:player:{ent}` ⭐ **CRITICAL**
  - **Type:** Hash
  - **Contains:** Player metadata for display
    - `name` - Player name (e.g., "Justin Herbert")
    - `team` - Team abbreviation (e.g., "LAC")
    - `position` - Player position (e.g., "QB")
  - **Example:** `props:nfl:player:pid:00-0036355` → `{name: "Justin Herbert", team: "LAC", position: "QB"}`
  - **Used in:** `app/api/props/players/route.ts:87`
  - **⚠️ MUST BE POPULATED:** Required for each player entity to show their name

**Note:** This route does NOT check for SIDs or alternates. It simply returns all players in the market set with their metadata. SID validation happens later in `/api/props/find` when the user selects a player.

### 4. Listing Available Markets
**API Route:** `/api/props/mkts`

**Keys Used:**
- `props:{sport}:mkts`
  - **Type:** Set
  - **Contains:** Array of available market identifiers
  - **Example:** `props:nfl:mkts` → ["rushing_yards", "passing_yards", ...]
  - **Used in:** `app/api/props/mkts/route.ts:15`

### 5. Server-Sent Events (Live Updates)
**API Route:** `/api/sse/alt`

**Keys Used:**
- `props:{sport}:alt:x`
  - **Type:** Redis Stream
  - **Contains:** Stream entries with SID updates
  - **Stream Fields:**
    - `sid` - The SID that was updated
  - **Used in:** `app/api/sse/alt/route.ts:26`

- `props:{sport}:rows:alt:{sid}`
  - **Type:** String (JSON)
  - **Contains:** Fetched when embedding full family data in SSE response
  - **Used in:** `app/api/sse/alt/route.ts:77`

## Data Flow Summary

1. **User selects sport and market** → Fetches `props:{sport}:mkts`
2. **User searches for player** → Fetches `props:{sport}:players:mkt:{mkt}` → Gets player info from `props:{sport}:player:{ent}`
3. **User selects player** → Finds/validates SIDs via `/api/props/find` using `props:{sport}:sids:ent:{ent}:mkt:{mkt}` + `props:{sport}:sid2primary` + `props:{sport}:rows:alt:{sid}`
4. **Display ladder** → Fetches `props:{sport}:rows:alt:{sid}` for ladder data
5. **Live updates** → Subscribes to `props:{sport}:alt:x` stream → Receives SID updates → Fetches updated `props:{sport}:rows:alt:{sid}`

## Key Requirements for VPS Ingestor Scripts

For each sport (`nfl`, `nba`, `nhl`, `ncaaf`), your ingestor scripts must create:

### ⭐ Critical Keys (Required for player dropdown)
1. `props:{sport}:players:mkt:{mkt}` - **Players per market** (Set)
   - Populate with all player entities that have alternates for this market
   - Example: `SADD props:nfl:players:mkt:passing_yards pid:00-0036355`
   
2. `props:{sport}:player:{ent}` - **Player metadata** (Hash)
   - Must have `name`, `team`, `position` fields
   - Example: `HMSET props:nfl:player:pid:00-0036355 name "Justin Herbert" team "LAC" position "QB"`

### Required for Ladder Display
3. `props:{sport}:rows:alt:{sid}` - **Ladder family data** (String/JSON)
   - Contains all alternate lines and odds
   
4. `props:{sport}:sids:ent:{ent}:mkt:{mkt}` - **SID lookup** (Set)
   - Maps player+market to SIDs
   
5. `props:{sport}:sid2primary` - **Primary SID mapping** (Hash)
   - Maps any SID to its current primary SID

### Optional but Recommended
6. `props:{sport}:mkts` - Available markets (Set)
7. `props:{sport}:is_live` - Live flag per SID (Hash)
8. `props:{sport}:alt:x` - Real-time update stream (Stream)

## File References

- **Client:** `libs/ladders/client.ts`
- **Hooks:** `hooks/use-ladders.ts`
- **Components:** `app/(protected)/ladders/page.tsx`
- **API Routes:**
  - `app/api/props/find/route.ts`
  - `app/api/props/alt/route.ts`
  - `app/api/props/players/route.ts`
  - `app/api/props/mkts/route.ts`
  - `app/api/sse/alt/route.ts`

## Common Issues

### Players Not Showing in Dropdown
**Symptom:** Alternates exist (`props:nfl:rows:alt:{sid}`), but player doesn't appear in dropdown

**Cause:** Missing or incomplete player list keys:
- `props:nfl:players:mkt:{mkt}` doesn't contain the player entity
- OR `props:nfl:player:{ent}` is missing or has no `name` field

**Fix:** See `INGESTOR_FIX_PLAYERS.md` for how to populate these keys from existing alternates

### 404 Errors When Selecting Player  
**Symptom:** Player appears in dropdown, but clicking shows "not_found"

**Cause:** 
- `props:{sport}:sids:ent:{ent}:mkt:{mkt}` is missing or empty
- OR SIDs are stale and `props:{sport}:sid2primary` mapping is missing

**Fix:** Ensure `/api/props/find` can resolve the player to valid SIDs with alternates

## Notes

- The `sid2primary` hash is recommended for handling SID updates/changes
- The `is_live` hash is optional but used for filtering pregame vs live players
- All keys follow the pattern `props:{sport}:...` where `{sport}` is one of: `nfl`, `nba`, `nhl`, `ncaaf`
- **Most common issue:** Having alternates but not populating the player list sets

