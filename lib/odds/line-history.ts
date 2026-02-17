export type LineHistorySource = "edge" | "positive_ev";

export interface LineHistoryContext {
  source: LineHistorySource;
  sport: string;
  eventId: string;
  market: string;
  marketDisplay?: string | null;
  side?: "over" | "under" | "yes" | "no" | "ml" | "spread";
  line?: number | null;
  selectionName?: string | null;
  playerName?: string | null;
  team?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  bestBookId?: string | null;
  compareBookIds?: string[];
  allBookIds?: string[];
  currentPricesByBook?: Record<string, number>;
  oddIdsByBook?: Record<string, string>;
}

export interface LineHistoryPoint {
  price: number;
  timestamp: number;
}

export interface LineHistorySnapshot {
  price: number | null;
  timestamp: number | null;
}

export interface LineHistoryBookData {
  bookId: string;
  bookName: string;
  status: "ok" | "not_found" | "error";
  message?: string;
  oddsId?: string;
  market?: string | null;
  selection?: string | null;
  updated?: string | null;
  olv: LineHistorySnapshot;
  clv: LineHistorySnapshot;
  currentPrice: number | null;
  entries: LineHistoryPoint[];
  source: "cache" | "vendor";
}

export interface LineHistoryApiRequest {
  context: LineHistoryContext;
  books: string[];
}

export interface LineHistoryApiResponse {
  books: LineHistoryBookData[];
}
