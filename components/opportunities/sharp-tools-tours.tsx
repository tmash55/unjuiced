"use client"

import { MlbToolTour, MlbTourTrigger, type TourStep, type TourFeature } from "@/components/cheat-sheet/mlb-tour-shared"

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

// ═══════════════════════════════════════════════════════════════
// EDGE FINDER
// ═══════════════════════════════════════════════════════════════

const EDGE_EVENT = "edge-finder:restart-tour"
const EDGE_STORAGE = "edge-finder-tour-v1"

function clickFirstEdgeRow() {
  const row = document.querySelector("[data-tour='edge-table'] tbody tr") as HTMLElement | null;
  if (row) row.click();
}

const EDGE_STEPS: TourStep[] = [
  {
    target: "[data-tour='edge-filter-bar']",
    title: "Filter your edge",
    content: "Select sports, markets, sportsbooks, min edge %, and odds range. Use the comparing dropdown to switch between Pinnacle, market average, or a custom blend of sharp books.",
    side: "bottom",
  },
  {
    target: "[data-tour='edge-table'] thead",
    title: "Edge opportunities",
    content: "Every row is a one-sided edge — where the best available price on a single outcome differs from the fair value. Higher edge % = bigger market disagreement. Sort by any column.",
    side: "bottom",
  },
  {
    target: "[data-tour='edge-table'] tbody tr:first-child",
    title: "Expand a bet",
    content: "Click any row to expand it and see more details.",
    side: "bottom",
    action: clickFirstEdgeRow,
  },
  {
    target: "[data-tour='edge-table'] tbody tr:nth-child(2)",
    title: "Full breakdown",
    content: "The expanded view shows all sportsbook prices side by side, the reference fair value, and direct deep-links to place the bet. This is where you confirm the edge is still live before betting.",
    side: "top",
  },
  {
    target: "[data-tour='custom-models-btn']",
    title: "Custom models (Elite)",
    content: "Elite plan users can build personalized devig models — choose your own blend of reference books, pick devig methods, and run multiple models simultaneously. Save presets for one-click switching between strategies.",
    side: "bottom",
    desktopOnly: true,
  },
]

const EDGE_FEATURES: TourFeature[] = [
  {
    icon: <Icon d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
    title: "One-sided edge detection",
    desc: "Unlike +EV which uses both sides of a line (over AND under), Edge Finder looks at one side only — finding longer shots and props where a single sportsbook has a significantly better price than the market consensus.",
  },
  {
    icon: <Icon d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />,
    title: "Every sport, every market",
    desc: "NBA, NFL, NHL, MLB, NCAAB, soccer, tennis, UFC — player props, game lines, alternates, and futures. 20+ sportsbooks scanned every 2 seconds.",
  },
  {
    icon: <Icon d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
    title: "Custom devig models",
    desc: "Power, multiplicative, additive, and probit methods. Build your own blend of reference books or use presets like Pinnacle, market average, or next-best.",
  },
]

export function EdgeFinderTour() {
  return <MlbToolTour storageKey={EDGE_STORAGE} eventName={EDGE_EVENT} steps={EDGE_STEPS} accent="brand"
    welcomeTitle="Welcome to Edge Finder" welcomeSubtitle="Find one-sided market edges across every sportsbook" features={EDGE_FEATURES} />
}
export function EdgeFinderTourTrigger() { return <MlbTourTrigger eventName={EDGE_EVENT} /> }

// ═══════════════════════════════════════════════════════════════
// POSITIVE EV
// ═══════════════════════════════════════════════════════════════

const EV_EVENT = "positive-ev:restart-tour"
const EV_STORAGE = "positive-ev-tour-v1"

function clickFirstEvRow() {
  const row = document.querySelector("[data-tour='ev-table'] tbody tr") as HTMLElement | null;
  if (row) row.click();
}

const EV_STEPS: TourStep[] = [
  {
    target: "[data-tour='ev-filter-bar']",
    title: "Set your criteria",
    content: "Filter by sport, market, sportsbook, and min EV %. The scanner uses BOTH sides of a line (over + under) to calculate fair value and find bets where you have a mathematical edge.",
    side: "bottom",
  },
  {
    target: "[data-tour='ev-table'] thead",
    title: "+EV opportunities",
    content: "Each row is a bet with positive expected value. EV% is your theoretical return per dollar wagered. Kelly % suggests optimal bankroll sizing. Sort by any column.",
    side: "bottom",
  },
  {
    target: "[data-tour='ev-table'] tbody tr:first-child",
    title: "Expand a bet",
    content: "Click any row to see the full detail.",
    side: "bottom",
    action: clickFirstEvRow,
  },
  {
    target: "[data-tour='ev-table'] tbody tr:nth-child(2)",
    title: "Full breakdown",
    content: "The expanded view shows over/under prices across all sportsbooks, the devigged fair value, and direct bet links. The wider the gap between best price and fair, the stronger the +EV.",
    side: "top",
  },
  {
    target: "[data-tour='custom-models-btn']",
    title: "Custom models (Elite)",
    content: "Elite plan users can create personalized EV models — select your own reference books, choose devig methods (power, multiplicative, probit), and run multiple models at once. Each model generates its own +EV feed.",
    side: "bottom",
    desktopOnly: true,
  },
]

const EV_FEATURES: TourFeature[] = [
  {
    icon: <Icon d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    title: "Two-sided fair value",
    desc: "Unlike Edge Finder which looks at one side, +EV uses BOTH sides of a line (over AND under) to calculate the true fair value. This removes the vig and reveals which bets have positive expected return.",
  },
  {
    icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
    title: "Kelly criterion sizing",
    desc: "Optimal bet size calculated using the Kelly criterion. Tells you exactly how much of your bankroll to risk based on your edge — no guesswork.",
  },
  {
    icon: <Icon d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
    title: "Sharp book reference",
    desc: "Fair values derived from sharp books (Pinnacle, etc.) who set the sharpest lines. When a consumer book offers better odds than fair, that's your +EV bet.",
  },
]

export function PositiveEVTour() {
  return <MlbToolTour storageKey={EV_STORAGE} eventName={EV_EVENT} steps={EV_STEPS} accent="brand"
    welcomeTitle="Welcome to Positive EV" welcomeSubtitle="Find bets where the math is in your favor" features={EV_FEATURES} />
}
export function PositiveEVTourTrigger() { return <MlbTourTrigger eventName={EV_EVENT} /> }
