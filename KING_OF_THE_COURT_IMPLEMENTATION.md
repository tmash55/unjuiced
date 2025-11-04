# King of the Court - NBA PRA Leaderboard Implementation Summary

## 🏀 Overview
A comprehensive NBA stats feature that tracks the "King of the Court" with live PRA (Points + Rebounds + Assists) leaderboards, historical data, and advanced statistics.

## 📍 Route
**Primary URL:** `/stats/nba`

**SEO Keywords:** NBA PRA, King of the Court, KOTC, NBA leaderboard, live NBA stats, Points Rebounds Assists

## ✅ Features Implemented

### Backend API Routes

#### 1. `/api/nba/live-stats`
- **Purpose:** Fetch live PRA leaderboard
- **Query Parameters:**
  - `view`: "leaderboard" | "live-only" | "oncourt"
  - `limit`: number (default: 50)
  - `minPRA`: number (default: 0)
- **Updates:** Auto-refreshes every 20 seconds (matches ingestor cycle)
- **Data:** Player stats from `nba_player_game_stats` + `nba_games` tables

#### 2. `/api/nba/historical`
- **Purpose:** Browse past games and performances
- **Query Parameters:**
  - `date`: ISO date string (required)
  - `gameId`: Optional single game filter
- **Features:** 
  - Daily leaderboards
  - Game summaries with top performers
  - Historical data from Nov 3, 2025 onwards

#### 3. `/api/nba/advanced-stats`
- **Purpose:** Fun stats and elite performances
- **Query Parameters:**
  - `stat`: "pra_per_min" | "efficiency" | "elite_club"
  - `date`: ISO date or "latest"
  - `minMinutes`: number (default: 20)
- **Features:**
  - PRA per minute leaders
  - Elite club (40+ PRA performances)
  - High-efficiency scorers (50%+ FG, 15+ PRA)

### Frontend Components

#### Core Components
1. **NBAStatsHeader** - Shows game count, live status, last updated
2. **GameScheduleBar** - Horizontal scrollable game cards with SSE updates
3. **LiveLeaderboard** - Sortable table with expandable rows for advanced stats
4. **HistoricalBrowser** - Date picker and past game browsing
5. **AdvancedStatsPanel** - Elite performances, efficiency, PRA/min stats

#### Custom Hooks
1. **useLiveLeaderboard** - Auto-refreshing live stats (20s interval)
2. **useHistoricalStats** - Historical data fetching with caching
3. **useAdvancedStats** - Advanced stat types with smart caching
4. **useNBASchedule** - SSE connection to `/api/sse/props?sport=nba`

### Type Definitions
Located in `/types/nba.ts`:
- `PlayerStat` - Player performance data
- `LiveStatsResponse` - API response structure
- `GameEvent` - Game schedule/scores
- `HistoricalResponse` - Past games data
- `AdvancedStatsResponse` - Advanced stats data

## 🎨 UI Features

### Live Tab
- Real-time leaderboard with 20-second auto-refresh
- Filter by specific game
- Expandable rows showing:
  - Field goal percentage
  - 3-pointers made
  - Steals, blocks, +/-
  - Turnovers
- Visual indicators:
  - 🟢 Green dot for players currently on court
  - 🥇🥈🥉 Medals for top 3 players
  - ⭐ Elite badge for 50+ PRA
  - 👑 Legendary badge for 60+ PRA

### Historical Tab
- Date selector (Nov 3, 2025 onwards)
- Game summaries with final scores
- Top performer per game
- Click game to filter stats
- Full leaderboard for selected date

### Advanced Tab
Three sub-sections:
1. **Elite Club** - 40+ PRA performances since Nov 3
2. **PRA/Min** - Most efficient producers (min 20 minutes)
3. **Efficiency** - High FG% scorers with 15+ PRA

### Game Schedule Bar
- Horizontal scroll with all games
- Live indicator (red pulsing dot)
- Real-time scores and game clock
- Spread and O/U odds display
- Click to filter leaderboard

## 🔧 Technical Details

### Data Sources
1. **Redis** - Game schedule, scores, live status via SSE
2. **Supabase** - Player stats, historical data

### Tables Used
- `nba_games` - Game schedule, scores, live status
- `nba_players` - Player master data
- `nba_player_game_stats` - Live PRA stats
- `nba_live_stats_with_odds` - View joining stats + games

### Authentication
- **FREE** - No authentication required
- Public access to drive maximum traffic

### Performance Optimizations
- Response caching (15s for live, 1h for historical)
- React Query with smart refetch intervals
- React.memo on leaderboard rows
- Virtual scrolling ready (if needed)
- Stale-while-revalidate pattern

### SEO Optimizations
- **Title:** "King of the Court - NBA PRA Leaderboard | Live Stats & Rankings"
- **Description:** Rich, keyword-optimized meta description
- **Keywords:** NBA PRA, King of the Court, KOTC, live NBA stats
- **Canonical URL:** Set to `/stats/nba`
- **Open Graph tags** for social sharing
- **Twitter Card** metadata

## 📊 Expected Traffic Impact

### SEO Benefits
- **Primary Keywords:**
  - "NBA PRA leaderboard" (low competition)
  - "King of the Court NBA" (branded, unique)
  - "live NBA stats" (high volume)
  - "NBA points rebounds assists leaders"

### User Retention
- Auto-refresh keeps users engaged during live games
- Historical data for retrospective analysis
- Elite performances create shareable moments
- 20-second update cycle matches official NBA data

### Growth Potential
- Social sharing of elite performances
- Daily top performer highlights
- Season-long leaderboards (future)
- Integration with betting lines (future)

## 🚀 Future Enhancements (Not Yet Implemented)

1. **Player Profiles** - Click player for season stats and trends
2. **Prop Line Integration** - Link PRA stats to betting lines
3. **Social Sharing** - "Share this stat line" buttons
4. **Notifications** - Alert for milestone performances
5. **Season Leaderboards** - Track leaders over time
6. **Fantasy Scoring** - Overlay fantasy points
7. **Shot Charts** - Visual play-by-play data
8. **Export Feature** - Download leaderboard as image

## 📝 Testing Checklist

### Functional Testing
- [ ] Live leaderboard loads and updates every 20s
- [ ] Game schedule bar connects via SSE
- [ ] Game filter works correctly
- [ ] Historical date picker shows correct data
- [ ] Advanced stats tabs load properly
- [ ] Expandable rows show detailed stats
- [ ] Sorting by different columns works
- [ ] Mobile responsive layout

### Edge Cases
- [ ] No live games (empty state)
- [ ] SSE connection failure (reconnects)
- [ ] API errors (graceful degradation)
- [ ] No historical data for date
- [ ] Multiple games filter correctly

### Performance
- [ ] Initial page load < 2s
- [ ] Auto-refresh doesn't cause jank
- [ ] 50+ player table scrolls smoothly
- [ ] SSE doesn't leak memory
- [ ] API responses cached properly

## 🔗 Related Files

### Backend
- `/app/api/nba/live-stats/route.ts`
- `/app/api/nba/historical/route.ts`
- `/app/api/nba/advanced-stats/route.ts`
- `/lib/supabase-server.ts`

### Frontend
- `/app/(marketing)/stats/nba/page.tsx`
- `/app/(marketing)/stats/nba/layout.tsx`
- `/components/nba/*.tsx` (all NBA components)
- `/hooks/use-nba-stats.ts`
- `/hooks/use-nba-schedule.ts`
- `/types/nba.ts`

## 📈 Success Metrics

### Week 1
- 1,000+ unique visitors
- 5+ minutes average session time
- 30%+ return visitor rate

### Month 1
- 5,000+ unique visitors
- Featured in NBA stats discussions
- Social media shares of elite performances

### Long Term
- Top 10 Google result for "NBA PRA leaderboard"
- 10,000+ weekly active users
- Integration requests from fantasy platforms

---

**Implementation Date:** November 4, 2025
**Status:** ✅ Complete and Ready for Testing
**Route:** https://unjuiced.io/stats/nba

