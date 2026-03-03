// ─────────────────────────────────────────────────────────────────────────────
// Promos Schema — Unjuiced.bet v2
// Mirrors the `sportsbook_promos` Supabase table.
// ─────────────────────────────────────────────────────────────────────────────

export type PromoType =
  | "boost"
  | "insurance"
  | "free_bet"
  | "odds_boost"
  | "sgp_boost"
  | "parlay_boost"
  | "deposit_match"
  | "contest"
  | "free_play"
  | "referral"
  | "other";

export interface SportsbookPromo {
  id: number;
  sportsbook: string;
  title: string;
  sport: string;
  promo_type: PromoType;
  description: string | null;
  boost_or_bonus: string | null;
  requirements: string | null;
  expiration: string | null;
  is_new_user_only: boolean;
  is_daily: boolean;
  source_url: string | null;
  collected_date: string; // ISO date string "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SPORTSBOOK_LIST = [
  "DraftKings",
  "FanDuel",
  "Caesars",
  "BetMGM",
  "Fanatics",
  "Hard Rock Bet",
  "theScore Bet",
  "Bally Bet",
  "BetRivers",
  "bet365",
  "Borgata",
] as const;

export type Sportsbook = (typeof SPORTSBOOK_LIST)[number];

export const PROMO_TYPE_LIST: { value: PromoType; label: string }[] = [
  { value: "boost", label: "Boost" },
  { value: "odds_boost", label: "Odds Boost" },
  { value: "sgp_boost", label: "SGP Boost" },
  { value: "parlay_boost", label: "Parlay Boost" },
  { value: "free_bet", label: "Free Bet" },
  { value: "free_play", label: "Free Play" },
  { value: "insurance", label: "Insurance" },
  { value: "deposit_match", label: "Deposit Match" },
  { value: "contest", label: "Contest" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export const SPORT_LIST = [
  "All",
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "NCAAB",
  "Soccer",
  "Golf",
  "Tennis",
  "UFC",
] as const;

export type Sport = (typeof SPORT_LIST)[number];

// ─── Promo type config (color-coded) ─────────────────────────────────────────

export const PROMO_TYPE_CONFIG: Record<
  PromoType,
  { label: string; color: string; dotColor: string }
> = {
  boost: {
    label: "Boost",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  odds_boost: {
    label: "Odds Boost",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  sgp_boost: {
    label: "SGP Boost",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  parlay_boost: {
    label: "Parlay Boost",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  free_bet: {
    label: "Free Bet",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    dotColor: "bg-purple-400",
  },
  free_play: {
    label: "Free Play",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    dotColor: "bg-purple-400",
  },
  insurance: {
    label: "Insurance",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    dotColor: "bg-blue-400",
  },
  deposit_match: {
    label: "Deposit Match",
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    dotColor: "bg-cyan-400",
  },
  contest: {
    label: "Contest",
    color: "text-pink-400 bg-pink-500/10 border-pink-500/30",
    dotColor: "bg-pink-400",
  },
  referral: {
    label: "Referral",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    dotColor: "bg-orange-400",
  },
  other: {
    label: "Other",
    color: "text-zinc-400 bg-zinc-700/50 border-zinc-600/30",
    dotColor: "bg-zinc-400",
  },
};

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface PromoFilters {
  sportsbooks: string[];
  sports: string[];
  promoTypes: PromoType[];
  newUserOnly: boolean;
  dailyOnly: boolean;
  search?: string;
  date?: string; // ISO date "YYYY-MM-DD"; defaults to today
}

export const DEFAULT_PROMO_FILTERS: PromoFilters = {
  sportsbooks: [],
  sports: [],
  promoTypes: [],
  newUserOnly: false,
  dailyOnly: false,
  search: "",
};

// ─── Sportsbook Logo Map ─────────────────────────────────────────────────────

export const SPORTSBOOK_LOGO_MAP: Record<string, string> = {
  DraftKings: "draftkings.png",
  FanDuel: "fanduel.png",
  Caesars: "caesars.png",
  BetMGM: "betmgm.png",
  Fanatics: "fanatics.png",
  "Hard Rock Bet": "hardrockbet.png",
  "theScore Bet": "thescore.png",
  "Bally Bet": "ballybet.png",
  BetRivers: "betrivers.png",
  bet365: "bet365.png",
  Borgata: "generic-sportsbook.svg",
};

// ─── Sportsbook Brand Colors ─────────────────────────────────────────────────

export const SPORTSBOOK_BRAND_COLORS: Record<string, string> = {
  DraftKings: "#61B512",
  FanDuel: "#0171EB",
  Caesars: "#183533",
  BetMGM: "#C0A970",
  Fanatics: "#08203F",
  "Hard Rock Bet": "#6A46F2",
  "theScore Bet": "#003778",
  "Bally Bet": "#ED0100",
  BetRivers: "#00285A",
  bet365: "#126F51",
  Borgata: "#C0A970",
};

// ─── Sport Icon Map (league logo paths) ──────────────────────────────────────

export const SPORT_ICON_MAP: Record<string, string> = {
  NBA: "/sports-leagues/nba-logo.png",
  NFL: "/sports-leagues/nfl-logo.svg",
  MLB: "/sports-leagues/mlb-logo.svg",
  NHL: "/sports-leagues/nhl-logo.png",
};

// ─── API Response ─────────────────────────────────────────────────────────────

export interface PromosApiResponse {
  promos: SportsbookPromo[];
  total: number;
  counts_by_sportsbook: Record<string, number>;
  collected_date: string;
}