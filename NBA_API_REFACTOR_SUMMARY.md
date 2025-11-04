# NBA Stats API Refactor - 3 Clean Routes

## ✅ API Routes

### 1. `/api/nba/games` - Today's Schedule
**Purpose:** Fetch today's game schedule with live scores and status  
**Polling:** Every 20 seconds  
**Cache:** 20 second cache  

**Response:**
```typescript
{
  date: string;
  games: NBAGame[];
  summary: {
    total: number;
    live: number;
    scheduled: number;
    final: number;
  };
  grouped: {
    live: NBAGame[];
    scheduled: NBAGame[];
    final: NBAGame[];
  };
  lastUpdated: string;
}
```

### 2. `/api/nba/live-stats` - PRA Leaderboard
**Purpose:** Fetch live PRA (Points + Rebounds + Assists) leaderboard  
**Polling:** Every 20 seconds  
**Cache:** 15 second cache  

**Query Params:**
- `view`: "leaderboard" | "live-only" | "oncourt"
- `limit`: number (default: 50)
- `minPRA`: number (default: 0)
- `date`: YYYY-MM-DD (optional, defaults to latest)

**Response:**
```typescript
{
  leaderboard: PlayerStat[];
  lastUpdated: string;
  metadata: {
    total: number;
    view: string;
    date: string;
    gamesLive: number;
    gamesFinal: number;
    gamesScheduled: number;
  };
}
```

### 3. `/api/nba/props` - PRA Odds
**Purpose:** Fetch PRA prop betting odds from Redis  
**Polling:** Every 10 seconds (fast for live odds)  
**Cache:** 10 second cache  

**Query Params:**
- `market`: string (default: "player_points_rebounds_assists")
- `scope`: "all" | "live" | "pregame" (default: "pregame")
- `limit`: number (default: 50)

**Response:**
```typescript
{
  props: NBAProp[];
  metadata: {
    market: string;
    scope: string;
    total: number;
  };
  lastUpdated: string;
}
```

## 🎨 Frontend Components

### New Components Created:
1. **`TodaysGames`** (`/components/nba/todays-games.tsx`)
   - Displays game schedule grouped by status (Live, Upcoming, Final)
   - Shows live scores, team records, and game status
   - Visual indicators for live games

2. **`PRAProps`** (`/components/nba/pra-props.tsx`)
   - Displays PRA betting props in a table
   - Shows best over/under odds from different books
   - Live indicator for in-game props

### Updated Components:
- **Main Page** (`/app/(marketing)/stats/nba/page.tsx`)
  - 5 clean tabs: Games, Leaderboard, Odds, Historical, Advanced
  - **Defaults to "Today's Games" tab** ✅
  - Each tab only fetches data when active
  - Automatic polling with correct intervals

## 🔧 Custom Hooks

### Updated `/hooks/use-nba-stats.ts`:
- `useTodaysGames()` - Polls `/api/nba/games` every 20s
- `useLiveLeaderboard()` - Polls `/api/nba/live-stats` every 20s
- `useNBAProps()` - Polls `/api/nba/props` every 10s
- `useHistoricalStats()` - For historical data
- `useAdvancedStats()` - For advanced stats

## 📊 TypeScript Types

### Updated `/types/nba.ts`:
All types are properly defined for:
- `GamesResponse` - Today's games
- `LiveStatsResponse` - PRA leaderboard
- `PropsResponse` - PRA odds
- `NBAGame`, `PlayerStat`, `NBAProp` - Individual item types

## 🎯 Page Structure

```
/stats/nba
├── Tab 1: Today's Games (DEFAULT) ✅
│   └── Shows live/upcoming/final games
├── Tab 2: PRA Leaderboard
│   └── Live PRA rankings (polls every 20s)
├── Tab 3: PRA Odds
│   └── Betting props (polls every 10s)
├── Tab 4: Historical
│   └── Past games and performances
└── Tab 5: Advanced
    └── Advanced stats and analytics
```

## ⚡ Performance

- **Smart polling:** Only active tab fetches data
- **Automatic refresh:** No manual refresh needed
- **Fast odds updates:** Props update every 10s
- **Efficient caching:** Server-side caching reduces load
- **Responsive UI:** Loading states for all data fetches

## 🎉 Key Features

✅ Default tab is "Today's Games" (as requested)  
✅ Live indicator shows when games are active  
✅ Separate, clean routes for each data type  
✅ Proper polling intervals (10s for odds, 20s for games/stats)  
✅ TypeScript types for all APIs  
✅ Clean, modern UI with status indicators  
✅ Mobile responsive design  

## 📝 Usage Example

```typescript
// Fetch today's games (polls every 20s)
const { data: games } = useTodaysGames();

// Fetch live leaderboard (polls every 20s)
const { data: leaderboard } = useLiveLeaderboard('leaderboard', 50, 0);

// Fetch PRA props (polls every 10s)
const { data: props } = useNBAProps('player_points_rebounds_assists', 'pregame', 50);
```

## 🚀 Next Steps

The frontend is now fully connected to all 3 API routes with:
- ✅ Correct polling intervals
- ✅ Default to "Today's Games" tab
- ✅ Clean separation of concerns
- ✅ Proper TypeScript typing
- ✅ Responsive, modern UI

All ready for production! 🎊

