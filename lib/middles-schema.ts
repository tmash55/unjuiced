export const MIDDLES_ROWS_FORMAT = 1 as const;

export type MiddleMode = "all" | "live" | "pregame";

export type MiddleLeg = {
  bk: string;
  bt?: "sportsbook" | "prediction" | "exchange" | string;
  name?: string;
  od: number;
  id?: string;
  u?: string;
  m?: string | null;
  max?: number | null;
  upd?: string | null;
  rg?: boolean;
};

export type MiddleRow = {
  eid: string;
  sp?: string;
  mkt: string;
  lo: number;
  hi: number;
  gap: number;
  ent?: string;
  ent_id?: string | null;
  pair?: string;
  score_bps: number;
  middle_bps: number;
  worst_case_bps: number;
  low_side_bps?: number;
  high_side_bps?: number;
  stake?: {
    o_bps?: number;
    u_bps?: number;
  };
  ts: number;
  fs?: number;
  ls?: number;
  lu?: number;
  max_bet?: number | null;
  book_types?: string[];
  has_regional?: boolean;
  lg?: {
    id: string;
    name: string;
    sport: string;
  };
  ev: {
    dt: string;
    live: boolean;
    home: { abbr?: string; name?: string };
    away: { abbr?: string; name?: string };
  };
  o: MiddleLeg;
  u: MiddleLeg;
  inj?: {
    st: string;
    notes?: string;
    src?: string;
    upd?: string;
    name?: string;
    pid?: string;
    odds_id?: string;
    team?: string;
    pos?: string;
    nba_id?: number;
    wnba_id?: number;
  };
  risk_flags?: string[];
};
