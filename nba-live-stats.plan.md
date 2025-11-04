NBA Live Stats Frontend - Implementation Plan
Overview
Build a Next.js App Router feature that combines:

Game Schedule/Odds: From existing props:nba:events:* Redis keys via SSE
Live PRA Stats: From Supabase nba_live_stats_with_odds table
Pregame Rosters: Player lists for upcoming games
Historical Data: Browse past games (Nov 3rd onwards)
Architecture
Data Sources
Redis (via /api/sse/props?sport=nba):

Game schedule, scores, live status
Spreads and totals (O/U)
Real-time updates via SSE
Supabase (new API routes):

Live PRA leaderboard
Player stats (points/rebounds/assists)
Historical game data
Advanced stats (PRA per minute, efficiency)
Page Structure
Route: /nba-stats (or /stats/nba)

Tabs:

Live (default if games in progress)
Pregame (default if no live games)
Historical
API Routes to Create
1. GET /api/nba/live-stats
Purpose: Fetch live PRA leaderboard

Query Parameters:

view: "leaderboard" | "live-only" | "oncourt"
limit: number (default: 50)
minPRA: number (default: 0)
SQL Query:

SELECT 
  ROW_NUMBER() OVER (ORDER BY ps.pra DESC) as rank,
  ps.player_name,
  ps.team_tricode,
  ps.points,
  ps.rebounds,
  ps.assists,
  ps.pra,
  ps.minutes,
  ps.oncourt,
  ps.starter,
  g.game_id,
  g.away_team_tricode || ' @ ' || g.home_team_tricode as matchup,
  g.game_status,
  CASE 
    WHEN g.game_status = 3 THEN 'Final'
    WHEN g.game_status = 2 THEN 'Q' || g.period || ' ' || TRIM(g.game_clock)
    ELSE 'Scheduled'
  END as game_time,
  ps.field_goals_made,
  ps.field_goals_attempted,
  CASE 
    WHEN ps.field_goals_attempted > 0 
    THEN ROUND((ps.field_goals_made::numeric / ps.field_goals_attempted) * 100, 1)
    ELSE 0 
  END as fg_pct,
  ps.three_pointers_made,
  ps.steals,
  ps.blocks,
  ps.plus_minus
FROM nba_player_game_stats ps
JOIN nba_games g ON ps.game_id = g.game_id
WHERE ps.game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND ps.minutes != ''
  AND ps.pra >= $minPRA
ORDER BY ps.pra DESC
LIMIT $limit;
Response:

{
  leaderboard: PlayerStat[];
  lastUpdated: string;
  metadata: {
    total: number;
    view: string;
    gamesLive: number;
    gamesFinal: number;
  }
}
2. GET /api/nba/pregame-rosters
Purpose: Get player rosters for upcoming games

Query Parameters:

date: ISO date string (default: today)
Logic:

Fetch event IDs from Redis: props:nba:events:* where live: false and start is today
For each event, get players from Redis: props:nba:players:mkt:* or entity lists
Build roster with: player name, team, opponent, game time
SQL Query (if players exist in DB from previous games):

SELECT DISTINCT
  p.player_name,
  p.team_tricode,
  p.position,
  p.jersey,
  -- Get their last game PRA (optional)
  (
    SELECT pra 
    FROM nba_player_game_stats 
    WHERE person_id = p.person_id 
    ORDER BY game_date DESC 
    LIMIT 1
  ) as last_pra
FROM nba_players p
WHERE p.team_tricode IN ($team_codes)
ORDER BY p.player_name;
Response:

{
  games: [{
    eid: string;
    matchup: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    homePlayers: Player[];
    awayPlayers: Player[];
  }]
}
3. GET /api/nba/historical
Purpose: Browse past games and performances

Query Parameters:

date: ISO date string (required)
gameId: Optional filter for single game
SQL Query (for date):

SELECT 
  ROW_NUMBER() OVER (ORDER BY ps.pra DESC) as rank,
  ps.player_name,
  ps.team_tricode,
  ps.points,
  ps.rebounds,
  ps.assists,
  ps.pra,
  ps.minutes,
  g.away_team_tricode || ' @ ' || g.home_team_tricode as matchup,
  g.away_team_score || '-' || g.home_team_score as final_score
FROM nba_player_game_stats ps
JOIN nba_games g ON ps.game_id = g.game_id
WHERE ps.game_date = $date
  AND ps.minutes != ''
ORDER BY ps.pra DESC
LIMIT 100;
SQL Query (for game summary):

SELECT 
  g.game_id,
  g.away_team_tricode || ' @ ' || g.home_team_tricode as matchup,
  g.away_team_score || '-' || g.home_team_score as final_score,
  g.game_status_text,
  COUNT(ps.person_id) as players_tracked,
  (
    SELECT player_name || ' (' || pra || ' PRA)'
    FROM nba_player_game_stats
    WHERE game_id = g.game_id
    ORDER BY pra DESC
    LIMIT 1
  ) as top_performer
FROM nba_games g
LEFT JOIN nba_player_game_stats ps ON g.game_id = ps.game_id
WHERE g.game_date = $date
GROUP BY g.game_id
ORDER BY g.start_time_utc;
Response:

{
  date: string;
  games: GameSummary[];
  leaderboard: PlayerStat[];
}
4. GET /api/nba/advanced-stats
Purpose: Fun stats (PRA per minute, efficiency leaders, etc.)

Query Parameters:

stat: "pra_per_min" | "efficiency" | "elite_club"
date: ISO date or "latest"
minMinutes: number (default: 20)
SQL Queries:

PRA Per Minute:

SELECT 
  player_name,
  team_tricode,
  pra,
  minutes,
  ROUND(pra / NULLIF(CAST(minutes AS NUMERIC), 0), 2) as pra_per_minute,
  points || '/' || rebounds || '/' || assists as stat_line,
  g.away_team_tricode || ' @ ' || g.home_team_tricode as matchup
FROM nba_player_game_stats ps
JOIN nba_games g ON ps.game_id = g.game_id
WHERE ps.game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND minutes != ''
  AND CAST(minutes AS NUMERIC) >= $minMinutes
ORDER BY pra_per_minute DESC
LIMIT 20;
Elite Club (50+ PRA):

SELECT 
  player_name,
  team_tricode,
  pra,
  points || 'p / ' || rebounds || 'r / ' || assists || 'a' as stat_line,
  minutes,
  game_date,
  CASE 
    WHEN pra >= 60 THEN 'Legendary'
    WHEN pra >= 50 THEN 'Elite'
    ELSE 'Great'
  END as tier
FROM nba_player_game_stats
WHERE game_date >= '2025-11-03'
  AND pra >= 40
ORDER BY pra DESC
LIMIT 50;
High Efficiency (50%+ FG, 15+ PRA):

SELECT 
  player_name,
  team_tricode,
  pra,
  field_goals_made || '-' || field_goals_attempted as fg,
  ROUND((field_goals_made::numeric / NULLIF(field_goals_attempted, 0)) * 100, 1) as fg_pct,
  three_pointers_made as threes,
  plus_minus
FROM nba_player_game_stats
WHERE game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND pra >= 15
  AND field_goals_attempted >= 10
  AND (field_goals_made::numeric / NULLIF(field_goals_attempted, 0)) >= 0.50
ORDER BY pra DESC
LIMIT 20;
Response:

{
  stat: string;
  description: string;
  players: AdvancedPlayerStat[];
}
Component Structure
Page: app/nba-stats/page.tsx
Main container with tab navigation

Components to Create:
<NBAStatsHeader>

Shows game count (X live, Y scheduled, Z final)
Last updated timestamp
Auto-refresh indicator
<GameScheduleBar>

Horizontal scrollable game cards
Uses SSE from /api/sse/props?sport=nba
Shows: Matchup, score/time, spread, O/U
Click to filter leaderboard by game
<LiveLeaderboard>

Table with: Rank, Player, Team, P/R/A, PRA, Mins, Status
Expandable rows for advanced stats
On-court indicator (green dot)
Polling every 20 seconds
Sort by: PRA, Points, Rebounds, Assists, +/-
<PregameRosterView>

Game-by-game accordion
Lists all players per team
Shows: Name, Position, Last PRA (if available)
Start time countdown
<HistoricalBrowser>

Date picker (Nov 3rd onwards)
Game summaries for selected date
Click game → See full stats
Top performers highlight
<AdvancedStatsPanel> (optional toggle)

PRA per Minute leaders
Elite performances (50+ PRA)
Efficiency leaders
Fun facts
<PlayerStatCard> (expandable detail)

Full stat line: FG%, 3PM, STL, BLK, TO, +/-
Shot chart placeholder (future)
Link to prop markets (future integration)
Data Flow
Live Tab
1. SSE: /api/sse/props?sport=nba
   → Game schedule, scores, live status
   → Update <GameScheduleBar>

2. Poll: /api/nba/live-stats?view=leaderboard
   → Every 20 seconds
   → Update <LiveLeaderboard>

3. User clicks game in schedule bar
   → Filter leaderboard to show only that game's players
Pregame Tab
1. SSE: /api/sse/props?sport=nba
   → Filter events where live: false

2. Fetch: /api/nba/pregame-rosters
   → Get player lists for each game
   → Display in <PregameRosterView>
Historical Tab
1. User selects date from picker

2. Fetch: /api/nba/historical?date=YYYY-MM-DD
   → Get games and stats for that date
   → Display in <HistoricalBrowser>

3. Optional: /api/nba/advanced-stats?date=YYYY-MM-DD
   → Show fun stats for that day
TypeScript Interfaces
interface PlayerStat {
  rank: number;
  player_name: string;
  team_tricode: string;
  points: number;
  rebounds: number;
  assists: number;
  pra: number;
  minutes: string;
  oncourt: boolean;
  starter: boolean;
  game_id: string;
  matchup: string;
  game_status: number;
  game_time: string;
  // Advanced stats (optional)
  field_goals_made?: number;
  field_goals_attempted?: number;
  fg_pct?: number;
  three_pointers_made?: number;
  steals?: number;
  blocks?: number;
  plus_minus?: number;
}

interface GameEvent {
  eid: string;
  home: { id: string; name: string; abbr: string };
  away: { id: string; name: string; abbr: string };
  start: string;
  live: boolean;
  sport: string;
  // From odds (if available)
  spread?: string;
  total?: string;
  homeScore?: number;
  awayScore?: number;
  period?: number;
  clock?: string;
}

interface PregamePlayer {
  player_name: string;
  team_tricode: string;
  position?: string;
  jersey?: string;
  last_pra?: number;
}

interface GameSummary {
  game_id: string;
  matchup: string;
  final_score: string;
  game_status_text: string;
  players_tracked: number;
  top_performer: string;
}

interface AdvancedPlayerStat extends PlayerStat {
  pra_per_minute?: number;
  stat_line?: string;
  tier?: string;
}
Styling & UX
Design System
Live indicator: Red pulsing dot
On-court: Green dot next to player
Final game: Gray/muted
Scheduled: Blue/accent color
Elite performance (50+ PRA): Gold badge/highlight
Responsive Design
Desktop: Side-by-side (schedule + leaderboard)
Mobile: Stacked, collapsible sections
Auto-refresh
Live tab: Poll every 20 seconds (same as ingestor cycle)
Show "Updating..." indicator during fetch
Display "Last updated: X seconds ago"
Empty States
No live games: Show "No games in progress. Check back at tip-off!"
No data for historical date: "No data available for this date."
Pregame with no rosters: Show basic game info, note "Rosters available soon"
Example Layout (Live Tab)
┌─────────────────────────────────────────────────┐
│ 🏀 NBA Live Stats                               │
│ 3 games live • 2 scheduled • Last updated 5s ago│
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ GAMES (horizontal scroll)                       │
│ [🔴 LAL@GSW Q3 5:23 | 105-98 | -3.5 | O/U 225] │
│ [🔴 BOS@MIA Q4 2:15 | 112-108]                  │
│ [⏰ NYK@BRK 7:00 PM ET]                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ LIVE PRA LEADERBOARD                            │
│ [Sort: PRA ▼] [Filter: All Games ▼]            │
├──────────────────────────────────────────────────┤
│ # | Player         | Team | P  R  A | PRA | Mins│
├──────────────────────────────────────────────────┤
│ 1 | LeBron 🟢      | LAL  | 28 9  5 | 42  | 32  │
│ 2 | Tatum 🟢       | BOS  | 26 7  6 | 39  | 35  │
│ 3 | Curry          | GSW  | 25 4  8 | 37  | 28  │
│   [Expand for FG%, 3PM, STL, BLK, +/-]          │
└─────────────────────────────────────────────────┘
Implementation Checklist
Backend (API Routes)
[ ] Create /api/nba/live-stats with Supabase query
[ ] Create /api/nba/pregame-rosters (Redis + optional Supabase)
[ ] Create /api/nba/historical with date filtering
[ ] Create /api/nba/advanced-stats with multiple stat views
[ ] Add CORS and rate limiting
Frontend Components
[ ] NBAStatsHeader with game summary
[ ] GameScheduleBar with SSE integration
[ ] LiveLeaderboard table with polling
[ ] PregameRosterView accordion
[ ] HistoricalBrowser with date picker
[ ] AdvancedStatsPanel (optional)
[ ] PlayerStatCard expandable row
Hooks/Utils
[ ] useNBASchedule() - SSE hook for game events
[ ] useLiveLeaderboard() - Polling hook for stats
[ ] useHistoricalData() - Fetch hook for past games
[ ] Format helpers (time display, stat formatting)
Styling
[ ] Tab navigation component
[ ] Game card styles (live/scheduled/final states)
[ ] Leaderboard table (sortable columns)
[ ] Responsive layout (mobile/desktop)
[ ] Loading states and skeletons
Testing
[ ] Test with no live games (pregame state)
[ ] Test with multiple live games
[ ] Test historical date navigation
[ ] Test SSE connection recovery
[ ] Test mobile responsive layout
Future Enhancements (Phase 2)
Player profile pages with season stats
Integration with odds_entity_id for prop line comparison
Real-time notifications for milestone performances (50 PRA, triple-doubles)
Season leaderboards and trends
Fantasy point scoring overlays
Shot charts and play-by-play
Export leaderboard as image for social sharing
Notes for Frontend Agent
Supabase Client: Use existing lazy-loaded client pattern (see VPS scripts)
SSE: Leverage existing /api/sse/props infrastructure
Polling Interval: 20 seconds (matches ingestor cycle)
Date Format: ISO 8601 for queries, display in user's timezone
Error Handling: Graceful degradation if Supabase or Redis unavailable
Performance: Consider React.memo for leaderboard rows (50+ items)
Accessibility: Sortable table headers, keyboard navigation, ARIA labels