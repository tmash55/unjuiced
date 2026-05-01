import { CheckIcon } from "@/icons/card-icons";
import { CloseIcon } from "@/icons/general";

export enum TierName {
  SCOUT = "Scout",
  SHARP = "Sharp",
  ELITE = "Elite",
}

export const tiers = [
  {
    title: TierName.SCOUT,
    subtitle: "Research tools for NBA & MLB",
    description: "Full access to NBA hit rates, cheat sheets, and all MLB research tools — Slate Insights, HR Command Center, NRFI, Exit Velocity, and more.",
    monthly: 15,
    yearly: 150,
    ctaText: "Get Started",
    ctaLink: "/register",
    features: [
      "NBA hit rate tools & cheat sheets",
      "MLB Slate Insights (BvP matchups)",
      "MLB HR Command Center",
      "NRFI analysis with live odds",
      "Exit Velocity leaders",
      "Weather Report (free for all)",
      "Defense vs Position matchups",
      "Head-to-head matchup data",
    ],
    productType: "scout" as const,
    trialDays: 7,
  },
  {
    title: TierName.SHARP,
    subtitle: "Complete betting toolkit",
    description: "Level up from research to execution. Get all research tools plus sharp betting tools: Positive EV, Pregame Arbitrage, and Edge Finder.",
    monthly: 40,
    yearly: 400,
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
    trialDays: 7,
  },
  {
    title: TierName.ELITE,
    subtitle: "Every advantage",
    description: "For serious bettors who want every edge. Everything in Sharp plus Sharp Intel, Live Arbitrage, Custom Models, and EV-enhanced hit rates.",
    monthly: 70,
    yearly: 700,
    ctaText: "Go Elite",
    ctaLink: "/register",
    features: [
      "Everything in Sharp — plus:",
      "Sharp Intel — real-time insider tracking",
      "Live Arbitrage alerts",
      "Custom Model builder",
      "EV-enhanced hit rates",
      "Custom EV thresholds",
      "Priority odds updates",
      "Priority support",
    ],
    badge: "Best Value",
    productType: "edge" as const,
    trialDays: 7,
  },
];

// Feature comparison table for pricing page
export const pricingTable = [
  // ── NBA Research Tools ──
  {
    title: "NBA Hit Rate Tools",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Defense vs Position",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Hit Rate Matrix & Cheat Sheets",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Injury Impact Analysis",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Player Correlations",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  // ── MLB Research Tools ──
  {
    title: "MLB Slate Insights (BvP)",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "HR Command Center",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "NRFI Analysis",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Exit Velocity Leaders",
    tiers: [
      { title: TierName.SCOUT, value: <CheckIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Weather Report",
    tiers: [
      { title: TierName.SCOUT, value: "Free" },
      { title: TierName.SHARP, value: "Free" },
      { title: TierName.ELITE, value: "Free" },
    ],
  },
  // ── Sharp Betting Tools ──
  {
    title: "Positive EV Scanner",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Pregame Arbitrage",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Edge Finder",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Real-time Odds",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "20+ Sportsbooks",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Deep Linking",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CheckIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  // ── Elite Features ──
  {
    title: "Sharp Intel",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Live Arbitrage",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Custom Models",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "EV-Enhanced Hit Rates",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
  {
    title: "Priority Support",
    tiers: [
      { title: TierName.SCOUT, value: <CloseIcon /> },
      { title: TierName.SHARP, value: <CloseIcon /> },
      { title: TierName.ELITE, value: <CheckIcon /> },
    ],
  },
];
