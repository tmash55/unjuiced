// NBA Stats Type Definitions for King of the Court PRA Leaderboard

// ============ /api/nba/games ============
export interface NBAGame {
  game_id: string;
  matchup: string;
  full_matchup: string;
  away_team: {
    tricode: string;
    name: string;
    score: number;
    record: string;
  };
  home_team: {
    tricode: string;
    name: string;
    score: number;
    record: string;
  };
  status: number; // 1=Scheduled, 2=Live, 3=Final
  status_text: string;
  display_time: string;
  period: number;
  game_clock: string;
  start_time: string;
  is_live: boolean;
  is_final: boolean;
}

export interface GamesResponse {
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

// ============ /api/nba/live-stats ============
export interface PlayerStat {
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
  game_date?: string;
  matchup: string;
  away_team_score?: number;
  home_team_score?: number;
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
  turnovers?: number;
}

export interface LiveStatsResponse {
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

// ============ /api/nba/props ============
export interface NBAProp {
  sid: string;
  player: string;
  team: string;
  position: string | null; // Player position (PG, SG, SF, PF, C) for DvP analysis
  market: string;
  line: number;
  event: string;
  books: any[];
  best_over: { odds: number; book: string } | null;
  best_under: { odds: number; book: string } | null;
  avg_over: number | null;
  avg_under: number | null;
  is_live: boolean;
  updated_at: string;
  ev?: {
    dt: string; // ISO datetime string
    live: boolean;
    home: {
      id: string;
      name: string;
      abbr: string;
    };
    away: {
      id: string;
      name: string;
      abbr: string;
    };
  };
}

export interface PropsResponse {
  props: NBAProp[];
  metadata: {
    market: string;
    scope: string;
    total: number;
  };
  lastUpdated: string;
}

export interface GameEvent {
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

export interface PregamePlayer {
  player_name: string;
  team_tricode: string;
  position?: string;
  jersey?: string;
  last_pra?: number;
}

export interface PregameRosterResponse {
  games: {
    eid: string;
    matchup: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    homePlayers: PregamePlayer[];
    awayPlayers: PregamePlayer[];
  }[];
}

export interface GameSummary {
  game_id: string;
  matchup: string;
  final_score: string;
  game_status_text: string;
  players_tracked: number;
  top_performer: string;
}

export interface HistoricalResponse {
  date: string;
  games: GameSummary[];
  leaderboard: PlayerStat[];
}

export interface AdvancedPlayerStat extends PlayerStat {
  pra_per_minute?: number;
  stat_line?: string;
  tier?: 'Legendary' | 'Elite' | 'Great';
  game_date?: string;
}

export interface AdvancedStatsResponse {
  stat: string;
  description: string;
  players: AdvancedPlayerStat[];
}

export type LeaderboardView = 'leaderboard' | 'live-only' | 'oncourt';
export type AdvancedStatType = 'pra_per_min' | 'efficiency' | 'elite_club';

