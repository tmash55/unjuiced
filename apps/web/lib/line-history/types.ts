import type { LineHistoryPoint, LineHistoryBookData } from "@/lib/odds/line-history";

/* ── Time range ─────────────────────────────────────────────────────── */

export type TimeRangeKey = "1h" | "6h" | "24h" | "all";

export const TIME_RANGES: { key: TimeRangeKey; label: string; ms: number }[] = [
  { key: "1h", label: "1H", ms: 3600_000 },
  { key: "6h", label: "6H", ms: 6 * 3600_000 },
  { key: "24h", label: "24H", ms: 24 * 3600_000 },
  { key: "all", label: "ALL", ms: 0 },
];

/* ── Chart types ────────────────────────────────────────────────────── */

export interface ChartDataset {
  bookId: string;
  entries: LineHistoryPoint[];
  color: string;
  tooltipColor: string;
  name: string;
  logo: string | null;
}

export interface HoverData {
  svgX: number;
  timestamp: number;
  prices: {
    bookId: string;
    price: number;
    color: string;
    tooltipColor: string;
    logo: string | null;
    name: string;
  }[];
}

/* ── Steam moves ────────────────────────────────────────────────────── */

export interface SteamMove {
  timestamp: number;
  price: number;
  prevPrice: number;
  normalizedDelta: number;
  direction: "up" | "down";
  bookId: string;
}

/* ── EV timeline ────────────────────────────────────────────────────── */

export interface EVTimelinePoint {
  timestamp: number;
  fairProb: number;
  targetBookPrice: number;
  ev: number;
}

/* ── Summary stats ──────────────────────────────────────────────────── */

export interface SummaryStatsData {
  openPrice: number;
  highPrice: number;
  highTimestamp: number;
  lowPrice: number;
  lowTimestamp: number;
  currentPrice: number;
  impliedProbChange: number;
  lineMovesCount: number;
}

/* ── CLV tracker ────────────────────────────────────────────────────── */

export interface CLVResult {
  olvPrice: number;
  clvPrice: number;
  delta: number;
  beatCLV: boolean;
}
