import type { LineHistoryPoint, LineHistoryBookData } from "@/lib/odds/line-history";
import type { SteamMove, SummaryStatsData, EVTimelinePoint } from "./types";
import { americanToImpliedProb, americanToDecimal, devigPower, calculateEV } from "@/lib/ev/devig";

/* ── Odds formatting ────────────────────────────────────────────────── */

export function formatOdds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;
}

/**
 * Normalize American odds around even money so -100 and +100 both map to 0.
 * This avoids inflated "cross-zero" move values (e.g., -110 -> +100 should be +10, not +210).
 */
export function normalizeAmericanOddsForMove(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  if (rounded >= 100) return rounded - 100;
  if (rounded <= -100) return rounded + 100;
  return rounded;
}

export function computeMoveValue(openPrice: number | null | undefined, currentPrice: number | null | undefined): number | null {
  const openNormalized = normalizeAmericanOddsForMove(openPrice);
  const currentNormalized = normalizeAmericanOddsForMove(currentPrice);
  if (openNormalized == null || currentNormalized == null) return null;
  return currentNormalized - openNormalized;
}

export function movementLabel(entries: LineHistoryPoint[]): string | null {
  if (!entries || entries.length < 2) return null;
  const first = entries[0].price;
  const last = entries[entries.length - 1].price;
  const diff = computeMoveValue(first, last);
  if (diff == null) return null;
  if (diff === 0) return "Flat";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${Math.round(diff)}`;
}

export function classForMove(value: number | null): string {
  if (value == null || value === 0) return "text-neutral-400 dark:text-neutral-500";
  if (value > 0) return "text-emerald-500 dark:text-emerald-400";
  return "text-rose-500 dark:text-rose-400";
}

export function formatMove(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value === 0) return "Flat";
  if (value > 0) return `▲ +${Math.round(value)}`;
  return `▼ ${Math.round(value)}`;
}

/* ── Time formatting ────────────────────────────────────────────────── */

export function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

export function formatAbsoluteTime(epochMs: number | null): string {
  if (!epochMs) return "—";
  return new Date(epochMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── Color utilities ────────────────────────────────────────────────── */

export function parseHexColor(input: string): { r: number; g: number; b: number } | null {
  const value = input.trim();
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1);
  const normalized = hex.length === 3 ? hex.split("").map((c) => `${c}${c}`).join("") : hex;
  if (normalized.length !== 6) return null;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function toHexColor(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function mixColors(base: string, target: string, amount: number): string {
  const baseRgb = parseHexColor(base);
  const targetRgb = parseHexColor(target);
  if (!baseRgb || !targetRgb) return base;
  const t = Math.max(0, Math.min(1, amount));
  return toHexColor({
    r: baseRgb.r + (targetRgb.r - baseRgb.r) * t,
    g: baseRgb.g + (targetRgb.g - baseRgb.g) * t,
    b: baseRgb.b + (targetRgb.b - baseRgb.b) * t,
  });
}

export function luminance(color: string): number {
  const rgb = parseHexColor(color);
  if (!rgb) return 0;
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastColor(baseColor: string, background: string, minContrast: number): string {
  if (!parseHexColor(baseColor)) return "#38bdf8";
  if (contrastRatio(baseColor, background) >= minContrast) return baseColor;
  for (let i = 1; i <= 10; i++) {
    const candidate = mixColors(baseColor, "#ffffff", i * 0.1);
    if (contrastRatio(candidate, background) >= minContrast) return candidate;
  }
  return mixColors(baseColor, "#ffffff", 0.85);
}

/* ── Chart math ─────────────────────────────────────────────────────── */

export function computePriceTicks(min: number, max: number): number[] {
  const range = max - min || 10;
  const rawStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 5, 10, 25, 50, 100];
  let step = niceSteps.find((s) => s * mag >= rawStep) ?? 10;
  step *= mag;
  if (step < 1) step = 1;

  const ticks: number[] = [];
  let t = Math.floor(min / step) * step;
  while (t <= max + step * 0.01) {
    if (t >= min - step * 0.5) ticks.push(Math.round(t));
    t += step;
  }
  if (ticks.length < 2) {
    ticks.length = 0;
    ticks.push(Math.round(min), Math.round(max));
  }
  return ticks;
}

export function computeTimeTicks(minTs: number, maxTs: number): number[] {
  const range = maxTs - minTs;
  if (range <= 0) return [minTs];

  const intervals = [
    5 * 60_000, 15 * 60_000, 30 * 60_000,
    3600_000, 2 * 3600_000, 4 * 3600_000,
    6 * 3600_000, 12 * 3600_000, 86400_000,
  ];
  const targetTicks = 6;
  const rawInterval = range / targetTicks;
  const interval = intervals.find((i) => i >= rawInterval) || 86400_000;

  const ticks: number[] = [];
  let t = Math.ceil(minTs / interval) * interval;
  while (t <= maxTs) {
    ticks.push(t);
    t += interval;
  }
  if (ticks.length === 0) ticks.push(minTs + range / 2);
  return ticks;
}

export function formatChartTimestamp(epochMs: number, rangeMs: number): string {
  const d = new Date(epochMs);
  if (rangeMs > 86400_000 * 1.5) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  if (rangeMs > 86400_000) {
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** For a step-line, find the price at a given timestamp */
export function getPriceAtTime(entries: LineHistoryPoint[], ts: number): number | null {
  if (!entries || entries.length === 0) return null;
  let result: number | null = null;
  for (const pt of entries) {
    if (pt.timestamp <= ts) result = pt.price;
    else break;
  }
  return result;
}

/* ── Implied probability ────────────────────────────────────────────── */

export function formatImpliedProb(odds: number | null | undefined): string | null {
  if (odds == null || Number.isNaN(odds)) return null;
  const prob = americanToImpliedProb(odds);
  return `${(prob * 100).toFixed(1)}%`;
}

/* ── Steam move detection ───────────────────────────────────────────── */

/**
 * Detect steam/sharp moves — consecutive entries with >= threshold cents
 * of normalized movement.
 */
export function detectSteamMoves(
  entries: LineHistoryPoint[],
  bookId: string,
  threshold: number = 10
): SteamMove[] {
  if (!entries || entries.length < 2) return [];
  const moves: SteamMove[] = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const prevNorm = normalizeAmericanOddsForMove(prev.price);
    const currNorm = normalizeAmericanOddsForMove(curr.price);
    if (prevNorm == null || currNorm == null) continue;
    const delta = currNorm - prevNorm;
    if (Math.abs(delta) >= threshold) {
      moves.push({
        timestamp: curr.timestamp,
        price: curr.price,
        prevPrice: prev.price,
        normalizedDelta: delta,
        direction: delta > 0 ? "up" : "down",
        bookId,
      });
    }
  }
  return moves;
}

/* ── Summary stats computation ──────────────────────────────────────── */

export function computeSummaryStats(entries: LineHistoryPoint[]): SummaryStatsData | null {
  if (!entries || entries.length === 0) return null;

  let highPrice = -Infinity;
  let highTimestamp = 0;
  let lowPrice = Infinity;
  let lowTimestamp = 0;

  for (const pt of entries) {
    if (pt.price > highPrice) {
      highPrice = pt.price;
      highTimestamp = pt.timestamp;
    }
    if (pt.price < lowPrice) {
      lowPrice = pt.price;
      lowTimestamp = pt.timestamp;
    }
  }

  const openPrice = entries[0].price;
  const currentPrice = entries[entries.length - 1].price;

  const openProb = americanToImpliedProb(openPrice);
  const currentProb = americanToImpliedProb(currentPrice);
  const impliedProbChange = (currentProb - openProb) * 100;

  // Count distinct price changes
  let lineMovesCount = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].price !== entries[i - 1].price) lineMovesCount++;
  }

  return {
    openPrice,
    highPrice,
    highTimestamp,
    lowPrice,
    lowTimestamp,
    currentPrice,
    impliedProbChange,
    lineMovesCount,
  };
}

/* ── EV timeline computation ────────────────────────────────────────── */

/**
 * Compute EV at each sharp-book timestamp using step-interpolated opposite-side data.
 * Uses devigPower to remove vig, then calculateEV against the target book's price.
 */
export function computeEVTimeline(
  sharpEntries: LineHistoryPoint[],
  oppositeSharpEntries: LineHistoryPoint[],
  targetBookEntries: LineHistoryPoint[],
): EVTimelinePoint[] {
  if (!sharpEntries.length || !oppositeSharpEntries.length || !targetBookEntries.length) return [];

  const points: EVTimelinePoint[] = [];

  for (const pt of sharpEntries) {
    const mainSidePrice = pt.price;
    const oppPrice = getPriceAtTime(oppositeSharpEntries, pt.timestamp);
    const targetPrice = getPriceAtTime(targetBookEntries, pt.timestamp);
    if (oppPrice == null || targetPrice == null) continue;

    const result = devigPower(mainSidePrice, oppPrice);
    if (!result.success) continue;

    const fairProb = result.fairProbOver;
    const ev = calculateEV(fairProb, targetPrice);

    points.push({
      timestamp: pt.timestamp,
      fairProb,
      targetBookPrice: targetPrice,
      ev: ev * 100,
    });
  }

  return points;
}

/* ── Reverse line movement detection ────────────────────────────────── */

export function detectReverseLineMovement(
  sharpEntries: LineHistoryPoint[],
  bookEntries: LineHistoryPoint[],
): boolean {
  if (sharpEntries.length < 2 || bookEntries.length < 2) return false;

  const sharpFirst = sharpEntries[0].price;
  const sharpLast = sharpEntries[sharpEntries.length - 1].price;
  const sharpMove = normalizeAmericanOddsForMove(sharpLast)! - normalizeAmericanOddsForMove(sharpFirst)!;

  const bookFirst = bookEntries[0].price;
  const bookLast = bookEntries[bookEntries.length - 1].price;
  const bookMove = normalizeAmericanOddsForMove(bookLast)! - normalizeAmericanOddsForMove(bookFirst)!;

  // Opposite direction and both meaningful moves
  return Math.abs(sharpMove) >= 5 && Math.abs(bookMove) >= 5 && Math.sign(sharpMove) !== Math.sign(bookMove);
}

/* ── CLV computation ────────────────────────────────────────────────── */

export function computeCLV(bookData: LineHistoryBookData): { delta: number; beatCLV: boolean } | null {
  const olv = bookData.olv.price;
  const clv = bookData.clv.price;
  if (olv == null || clv == null) return null;

  const olvNorm = normalizeAmericanOddsForMove(olv);
  const clvNorm = normalizeAmericanOddsForMove(clv);
  if (olvNorm == null || clvNorm == null) return null;

  // Positive delta means you got a better price (line moved against the market after you took it)
  const delta = clvNorm - olvNorm;
  return { delta, beatCLV: delta > 0 };
}
