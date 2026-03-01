import type { ArbRow } from "@/lib/arb-schema";

export type ArbMode = "all" | "live" | "pregame";

// Live events should not remain "live" forever after their listed start.
const LIVE_PRESTART_GRACE_MS = 20 * 60 * 1000; // 20m before scheduled start
const LIVE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h after scheduled start
const PREGAME_PAST_GRACE_MS = 10 * 60 * 1000; // allow brief lag around tip-off

export function getArbStartMs(row: ArbRow): number | null {
  const dt = row?.ev?.dt;
  if (!dt) return null;
  const ms = Date.parse(String(dt));
  return Number.isFinite(ms) ? ms : null;
}

export function isArbLiveFresh(row: ArbRow, nowMs: number = Date.now()): boolean {
  if (row?.ev?.live !== true) return false;
  const startMs = getArbStartMs(row);
  if (startMs === null) return false;
  return startMs <= nowMs + LIVE_PRESTART_GRACE_MS && nowMs - startMs <= LIVE_MAX_AGE_MS;
}

export function isArbPregameFresh(row: ArbRow, nowMs: number = Date.now()): boolean {
  if (row?.ev?.live === true) return false;
  const startMs = getArbStartMs(row);
  // If event time is missing, don't hide it purely on time.
  if (startMs === null) return true;
  return startMs > nowMs - PREGAME_PAST_GRACE_MS;
}

export function isArbFreshForMode(
  row: ArbRow,
  mode: ArbMode,
  nowMs: number = Date.now()
): boolean {
  if (mode === "live") return isArbLiveFresh(row, nowMs);
  if (mode === "pregame") return isArbPregameFresh(row, nowMs);
  return isArbLiveFresh(row, nowMs) || isArbPregameFresh(row, nowMs);
}

