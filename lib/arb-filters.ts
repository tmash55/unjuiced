
import type { ArbRow } from "@/lib/arb-schema";

export type ArbPrefs = {
  selectedBooks: string[];
  selectedSports: string[];
  selectedLeagues: string[];
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

  // Filter by sports
  if (prefs.selectedSports.length > 0 && row.lg?.sport) {
    const sport = normalize(row.lg.sport);
    const selectedSportsNormalized = prefs.selectedSports.map((s) => normalize(s));
    if (!selectedSportsNormalized.includes(sport)) return false;
  }

  // Filter by leagues
  if (prefs.selectedLeagues.length > 0 && row.lg?.id) {
    const league = normalize(row.lg.id);
    const selectedLeaguesNormalized = prefs.selectedLeagues.map((l) => normalize(l));
    if (!selectedLeaguesNormalized.includes(league)) return false;
  }

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
    row.lg?.name,
    row.lg?.sport,
    row.lg?.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}
