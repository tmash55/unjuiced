import { CheckIcon } from "@/icons/card-icons";
import { CloseIcon } from "@/icons/general";

export enum TierName {
  HIT_RATES = "NBA Hit Rates",
  PRO = "Pro",
}

export const tiers = [
  {
    title: TierName.HIT_RATES,
    subtitle: "NBA player prop analytics",
    monthly: 15,
    yearly: 150,
    ctaText: "Get Started",
    ctaLink: "/register",
    features: [
      "NBA only",
      "Player prop hit rates",
      "Hit Rate Cheat Sheet",
      "Injury Impact Cheat Sheet",
      "L5, L10, L20, Season stats",
      "Head-to-head matchup data",
      "Defensive matchup analysis",
      "Play type breakdowns",
      "Shooting zone analysis",
      "Player correlations",
      "Game log & box scores",
    ],
    productType: "nba_hit_rates" as const,
  },
  {
    title: TierName.PRO,
    subtitle: "Complete betting toolkit",
    monthly: 30,
    yearly: 300,
    ctaText: "Start Free Trial",
    ctaLink: "/register",
    features: [
      "Everything in Hit Rates — plus:",
      "Unlimited arbitrage detection",
      "Edge Finder — find +EV bets",
      "Real-time odds (sub-2s updates)",
      "20+ sportsbooks coverage",
      "Alternate lines & player props",
      "Deep linking to sportsbooks",
      "EV calculations & consensus",
      "Advanced filters & sorting",
      "Priority support",
    ],
    featured: true,
    badge: "Most Popular",
    productType: "pro" as const,
    trialDays: 3,
  },
];

// Feature comparison table for pricing page
export const pricingTable = [
  {
    title: "NBA Hit Rates",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Hit Rate Cheat Sheet",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Injury Impact Cheat Sheet",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "L5, L10, L20, Season Stats",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Head-to-Head Matchup Data",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Defensive Matchup Analysis",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Play Type Breakdowns",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Shooting Zone Analysis",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Player Correlations",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Game Log & Box Scores",
    tiers: [
      { title: TierName.HIT_RATES, value: <CheckIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Arbitrage Detection",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Edge Finder (+EV Bets)",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Real-time Odds",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "20+ Sportsbooks",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Alternate Lines",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Deep Linking to Sportsbooks",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
  {
    title: "Priority Support",
    tiers: [
      { title: TierName.HIT_RATES, value: <CloseIcon /> },
      { title: TierName.PRO, value: <CheckIcon /> },
    ],
  },
];
