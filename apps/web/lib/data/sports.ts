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
      { id: 'soccer_laliga', name: 'LaLiga', sportId: 'Soccer' },
      { id: 'soccer_mls', name: 'MLS', sportId: 'Soccer' },
      { id: 'soccer_ucl', name: 'UCL', sportId: 'Soccer' },
      { id: 'soccer_uel', name: 'UEL', sportId: 'Soccer' },
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
      { id: 'ncaabaseball', name: 'NCAA Baseball', sportId: 'Baseball' },
    ],
  },
  {
    id: 'Hockey',
    name: 'Hockey',
    leagues: [
      { id: 'nhl', name: 'NHL', sportId: 'Hockey' },
    ],
  },
  {
    id: 'Tennis',
    name: 'Tennis',
    leagues: [
      { id: 'tennis_atp', name: 'ATP', sportId: 'Tennis' },
      { id: 'tennis_challenger', name: 'Challenger', sportId: 'Tennis' },
      { id: 'tennis_itf_men', name: 'ITF Men', sportId: 'Tennis' },
      { id: 'tennis_itf_women', name: 'ITF Women', sportId: 'Tennis' },
      { id: 'tennis_utr_men', name: 'UTR Men', sportId: 'Tennis' },
      { id: 'tennis_utr_women', name: 'UTR Women', sportId: 'Tennis' },
      { id: 'tennis_wta', name: 'WTA', sportId: 'Tennis' },
    ],
  },
  {
    id: 'MMA',
    name: 'MMA',
    leagues: [
      { id: 'ufc', name: 'UFC', sportId: 'MMA' },
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








