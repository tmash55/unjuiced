export const ROWS_FORMAT = 1 as const;

export type ArbRow = {
  eid: string;
  mkt: string;
  ln: number;
  roi_bps: number;
  ts: number;
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
  o: {
    bk: string;
    name?: string;
    od: number;
    id?: string;
    u?: string;
    m?: string | null;
  };
  u: {
    bk: string;
    name?: string;
    od: number;
    id?: string;
    u?: string;
    m?: string | null;
  };
};

export type ArbId = string;