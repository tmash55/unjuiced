import { CheckIcon } from "@/icons/card-icons";
import { CloseIcon } from "@/icons/general";

export enum TierName {
  SCOUT = "Scout",
  SHARP = "Sharp",
  EDGE = "Edge",
}

export const tiers = [
  {
    title: TierName.SCOUT,
    subtitle: "Hit rate research tools",
    description: "Perfect for player prop researchers. Full access to hit rate tools including Defense vs Position matchups and trend analysis.",
    monthly: 15,
    yearly: 150,
    ctaText: "Get Started",
    ctaLink: "/register",
    features: [
      "All hit rate tools",
      "Defense vs Position matchups",
      "Hit Rate Matrix cheat sheets",
      "Injury Impact analysis",
      "L5, L10, L20, Season stats",
      "Head-to-head matchup data",
      "Player correlations",
      "Game log & box scores",
    ],
    productType: "scout" as const,
  },
  {
    title: TierName.SHARP,
    subtitle: "Complete betting toolkit",
    description: "Level up from research to execution. Get hit rates plus sharp betting tools: Positive EV, Pregame Arbitrage, and Edge Finder.",
    monthly: 35,
    yearly: 350,
    ctaText: "Start Free Trial",
    ctaLink: "/register",
    features: [
      "Everything in Scout — plus:",
      "Positive EV scanner",
      "Pregame Arbitrage finder",
      "Edge Finder tool",
      "Real-time odds (2s updates)",
      "20+ sportsbooks coverage",
      "Alternate lines & player props",
      "Deep linking to sportsbooks",
      "Advanced filters & export",
    ],
    featured: true,
    badge: "Most Popular",
    productType: "sharp" as const,
    trialDays: 3,
  },
  {
    title: TierName.EDGE,
    subtitle: "Every advantage",
    description: "For serious bettors who want every edge. Everything in Sharp plus Live Arbitrage, Custom Models, and EV-enhanced hit rates.",
    monthly: 65,
    yearly: 650,
    ctaText: "Go Edge",
    ctaLink: "/register",
    features: [
      "Everything in Sharp — plus:",
      "Live Arbitrage alerts",
      "Custom Model builder",
      "EV-enhanced hit rates",
      "Custom EV thresholds",
      "Priority odds updates",
      "Priority support",
    ],
    badge: "Best Value",
    productType: "edge" as const,
    trialDays: 3,
  },
];

// Feature comparison table for pricing page
export const pricingTable = [
  // Hit Rate Features
  {
    title: "Hit Rate Tools",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Defense vs Position",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Hit Rate Matrix",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Injury Impact Analysis",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Player Correlations",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  // Sharp Features
  {
    title: "Positive EV Scanner",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Pregame Arbitrage",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Edge Finder",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Real-time Odds",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "20+ Sportsbooks",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Deep Linking",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  // Edge Features
  {
    title: "Live Arbitrage",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Custom Models",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "EV-Enhanced Hit Rates",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Priority Support",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.EDGE, value: <CheckIcon /> },
    ],
  },
];
