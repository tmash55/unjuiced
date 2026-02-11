export interface Sport {
  id: string;
  name: string;
  leagues: League[];
}

export interface League {
  id: string;
  name: string;
  sportId: string;
}

export const SPORTS: Sport[] = [
  {
    id: 'Football',
    name: 'Football',
    leagues: [
      { id: 'nfl', name: 'NFL', sportId: 'Football' },
      { id: 'ncaaf', name: 'NCAAF', sportId: 'Football' },
    ],
  },
  {
    id: 'Soccer',
    name: 'Soccer',
    leagues: [
      { id: 'soccer_epl', name: 'EPL', sportId: 'Soccer' },
    ],
  },
  {
    id: 'Basketball',
    name: 'Basketball',
    leagues: [
      { id: 'nba', name: 'NBA', sportId: 'Basketball' },
      { id: 'ncaab', name: 'NCAAB', sportId: 'Basketball' },
      { id: 'wnba', name: 'WNBA', sportId: 'Basketball' },
    ],
  },
  {
    id: 'Baseball',
    name: 'Baseball',
    leagues: [
      { id: 'mlb', name: 'MLB', sportId: 'Baseball' },
    ],
  },
  {
    id: 'Hockey',
    name: 'Hockey',
    leagues: [
      { id: 'nhl', name: 'NHL', sportId: 'Hockey' },
    ],
  },
];

export function getAllSports(): Sport[] {
  return SPORTS;
}

export function getAllLeagues(): League[] {
  return SPORTS.flatMap(sport => sport.leagues);
}

export function getLeaguesBySport(sportId: string): League[] {
  const sport = SPORTS.find(s => s.id === sportId);
  return sport?.leagues || [];
}

export function getSportName(sportId: string): string {
  const sport = SPORTS.find(s => s.id === sportId);
  return sport?.name || sportId;
}

export function getLeagueName(leagueId: string): string {
  const league = getAllLeagues().find(l => l.id === leagueId);
  return league?.name || leagueId;
}









