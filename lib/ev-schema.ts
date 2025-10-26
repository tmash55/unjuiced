/**
 * EV (Expected Value) Types
 * 
 * Defines the structure for positive EV opportunities from Redis.
 * Similar to arb-schema.ts but for EV calculations.
 */

export const EV_FORMAT = 1 as const;

export type EVRow = {
  seid: string;                          // Unique identifier: {sport}:{eid}:{ent}:{mkt}:{line}:{side}:{book}
  sport: string;                         // Sport: nfl, nba, nhl, mlb, ncaaf
  eid: string;                           // Event ID
  ent: string;                           // Entity: "game" or player ID
  mkt: string;                           // Market: spread, total, moneyline, player_pass_yds, etc.
  line: number;                          // Line value (e.g., 3.5, 275.5)
  side: "over" | "under";                // Bet side
  book: string;                          // Sportsbook ID
  odds: {
    am: number;                          // American odds (e.g., -110)
    dec: number;                         // Decimal odds (e.g., 1.90909)
    ts: number;                          // Timestamp when odds were fetched
  };
  links: {
    desktop: string | null;              // Desktop deep link
    mobile: string | null;               // Mobile deep link
  };
  devig: {
    inputs: {
      over_am: number;                   // Over odds (American)
      under_am: number;                  // Under odds (American)
      q_over: number;                    // Over implied probability
      q_under: number;                   // Under implied probability
      S: number;                         // Sum of probabilities (overround)
      n: number;                         // Number of outcomes (2 for binary)
    };
    params: {
      beta: number;                      // Beta parameter for power method
    };
    p_fair: {
      add: number;                       // Fair probability (additive method)
      mult: number;                      // Fair probability (multiplicative method)
      pow: number;                       // Fair probability (power method)
    };
  };
  ev: {
    add: number;                         // EV% using additive devig
    mult: number;                        // EV% using multiplicative devig
    pow: number;                         // EV% using power devig
  };
  rollup: {
    best_case: number;                   // Best EV% across methods
    worst_case: number;                  // Worst EV% across methods
    best_method: "add" | "mult" | "pow"; // Which method gave best EV
  };
  meta: {
    scope: "pregame" | "live";           // Game scope
    last_computed: number;               // Timestamp of last EV calculation
  };
  
  // Optional fields (populated from event data)
  ev_data?: {
    dt: string;                          // Game datetime (ISO)
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
    player?: string | null;              // Player name (for player props)
    team?: string | null;                // Team abbreviation (for player props)
    position?: string | null;            // Player position (for player props)
  };
};

export type EVId = string; // SEID

/**
 * Response format for /api/ev/feed
 */
export interface EVFeedResponse {
  rows: EVRow[];
  count: number;
  scope: "pregame" | "live";
  isPro: boolean;
  filtered?: boolean; // True if free user (>3% EV filtered)
}

/**
 * SSE message format for pub:ev:all
 */
export interface EVSSEMessage {
  add?: string[];   // New SEIDs added
  upd?: string[];   // SEIDs updated
  del?: string[];   // SEIDs deleted
  scope?: "pregame" | "live";
  ts?: number;
}

/**
 * Helper to parse SEID into components
 */
export function parseSEID(seid: string) {
  const parts = seid.split(':');
  return {
    sport: parts[0],
    eid: parts[1],
    ent: parts[2],
    mkt: parts[3],
    line: parseFloat(parts[4]),
    side: parts[5] as "over" | "under",
    book: parts[6],
  };
}

/**
 * Helper to format EV% for display
 */
export function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(2)}%`;
}

/**
 * Helper to get best EV from rollup
 */
export function getBestEV(row: EVRow): number {
  return row.rollup.best_case;
}

/**
 * Helper to check if EV meets threshold
 */
export function meetsEVThreshold(row: EVRow, minEV: number): boolean {
  return getBestEV(row) >= minEV;
}


