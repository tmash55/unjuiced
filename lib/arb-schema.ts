export const ROWS_FORMAT = 1 as const;

export type ArbLeg = {
  bk: string;
  name?: string;
  od: number;
  id?: string;
  u?: string;
  m?: string | null;
  max?: number | null; // Max bet amount for this leg
};

export type ArbRow = {
  eid: string;
  mkt: string;
  ln: number;
  roi_bps: number;
  ts: number;
  max_bet?: number | null; // Effective max for the arb (min of both legs)
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
  o: ArbLeg;
  u: ArbLeg;
};

export type ArbId = string;