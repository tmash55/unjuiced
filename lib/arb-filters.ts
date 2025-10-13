
import type { ArbRow } from "@/lib/arb-schema";

export type ArbPrefs = {
  selectedBooks: string[];
  minArb: number;
  maxArb: number;
  searchQuery: string;
};

export function matchesArbRow(row: ArbRow, prefs: ArbPrefs): boolean {
  const pct = (row.roi_bps ?? 0) / 100;
  if (pct < prefs.minArb || pct > prefs.maxArb) return false;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const books = new Set(prefs.selectedBooks.map((b) => normalize(b)));
  const overOk = books.has(normalize(String(row.o?.bk || "")));
  const underOk = books.has(normalize(String(row.u?.bk || "")));
  if (!(overOk && underOk)) return false;

  const q = prefs.searchQuery?.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    row.o?.name,
    row.u?.name,
    row.mkt,
    row.ev?.home?.name,
    row.ev?.home?.abbr,
    row.ev?.away?.name,
    row.ev?.away?.abbr,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}
