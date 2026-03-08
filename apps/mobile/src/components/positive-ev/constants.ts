import type { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

/* ─── Sport config ─── */

export const SPORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "ncaab", label: "NCAAB" },
  { id: "ncaaf", label: "NCAAF" },
  { id: "nhl", label: "NHL" },
  { id: "mlb", label: "MLB" },
  { id: "wnba", label: "WNBA" },
];

export const SPORT_COLORS: Record<string, string> = {
  nba: "#2563EB",
  nfl: "#16A34A",
  ncaab: "#7C3AED",
  ncaaf: "#CA8A04",
  nhl: "#0891B2",
  mlb: "#DC2626",
  wnba: "#DB2777",
  ufc: "#D4163C",
};

export const SPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  nba: "basketball-outline",
  nfl: "american-football-outline",
  ncaab: "basketball-outline",
  ncaaf: "american-football-outline",
  nhl: "disc-outline",
  mlb: "baseball-outline",
  wnba: "basketball-outline",
  ufc: "body-outline",
};

/* ─── EV Tier system ─── */

export type EvTier = "elite" | "great" | "good" | "standard";

export const EV_TIER_COLORS: Record<EvTier, string> = {
  elite: "#10B981",
  great: "#22C55E",
  good: "#38BDF8",
  standard: brandColors.border,
};

export const EV_TIER_THRESHOLDS: Array<{ tier: EvTier; min: number }> = [
  { tier: "elite", min: 5 },
  { tier: "great", min: 3 },
  { tier: "good", min: 1 },
  { tier: "standard", min: -Infinity },
];

/* ─── Filter options ─── */

export const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5];

export const MAX_EV_OPTIONS: Array<{ value: number | undefined; label: string }> = [
  { value: undefined, label: "None" },
  { value: 10, label: "10%" },
  { value: 15, label: "15%" },
  { value: 20, label: "20%" },
  { value: 30, label: "30%" },
];

/* ─── Sort options ─── */

export type SortField = "ev" | "kelly" | "time";

export const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: "ev", label: "EV%" },
  { field: "kelly", label: "Kelly%" },
  { field: "time", label: "Time" },
];

/* ─── Mode options ─── */

export type EVModeOption = "pregame" | "live" | "all";

export const MODE_OPTIONS: Array<{ value: EVModeOption; label: string }> = [
  { value: "pregame", label: "Pregame" },
  { value: "live", label: "Live" },
  { value: "all", label: "All" },
];

/* ─── De-vig method options ─── */

export type DevigMethodOption = "power" | "multiplicative" | "additive" | "probit";

export const DEVIG_METHOD_OPTIONS: Array<{ value: DevigMethodOption; label: string; description: string }> = [
  { value: "power", label: "Power", description: "Handles favorite/longshot bias" },
  { value: "multiplicative", label: "Multiplicative", description: "Simple proportional rescaling" },
  { value: "additive", label: "Additive", description: "Equal margin from each side" },
  { value: "probit", label: "Probit", description: "Normal quantile transformation" },
];

export const DEFAULT_DEVIG_METHODS: DevigMethodOption[] = ["power", "multiplicative"];
