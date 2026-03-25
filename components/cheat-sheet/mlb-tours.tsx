"use client"

import { MlbToolTour, MlbTourTrigger, type TourStep, type TourFeature } from "./mlb-tour-shared"

// ── SVG icon helper ────────────────────────────────────────────
const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

// ═══════════════════════════════════════════════════════════════
// HR COMMAND CENTER
// ═══════════════════════════════════════════════════════════════

const HR_EVENT = "hr-command-center:restart-tour"
const HR_STORAGE = "hr-command-center-tour-v1"

const HR_STEPS: TourStep[] = [
  { target: "[data-tour='hr-filter-bar']", title: "Filter & search", content: "Set a minimum HR score, filter by game/venue, or search for a specific player. The date picker syncs across all MLB tools.", side: "bottom" },
  { target: "[data-tour='hr-table'] thead", title: "HR leaderboard", content: "Every batter ranked by HR score (0-100). Elite (90+) are the best opportunities. Sort by any column — rankings stay stable by score. Hover column headers for tooltips.", side: "bottom" },
  { target: "[data-tour='hr-table'] tbody tr:first-child", title: "Player detail & odds", content: "Each row shows the composite score, sub-scores (Power, P.Vuln), barrel rate, max EV, live HR odds with sportsbook logos, and model edge. Click any row to expand for the full breakdown.", side: "bottom" },
]

const HR_FEATURES: TourFeature[] = [
  { icon: <Icon d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />, title: "5-layer HR scoring", desc: "Composite score combining batter power, pitcher vulnerability, park factors, weather/environment, and matchup context." },
  { icon: <Icon d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Live odds across 14+ books", desc: "Best available HR odds updated in real time. Click any price to see all sportsbooks and place bets." },
  { icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />, title: "Edge calculation", desc: "See where our model thinks HRs are more likely than the market. Positive edge = potential value." },
]

export function HRCommandCenterTour() {
  return <MlbToolTour storageKey={HR_STORAGE} eventName={HR_EVENT} steps={HR_STEPS} welcomeTitle="Welcome to HR Command Center" welcomeSubtitle="Find today's best home run bets" features={HR_FEATURES} />
}
export function HRCommandCenterTourTrigger() { return <MlbTourTrigger eventName={HR_EVENT} /> }

// ═══════════════════════════════════════════════════════════════
// NRFI
// ═══════════════════════════════════════════════════════════════

const NRFI_EVENT = "nrfi:restart-tour"
const NRFI_STORAGE = "nrfi-tour-v1"

function clickFirstNrfiCard() {
  // Click the first collapsed card to expand it
  const card = document.querySelector("[data-tour='nrfi-cards'] button") as HTMLElement | null;
  if (card) card.click();
}

const NRFI_STEPS: TourStep[] = [
  { target: "[data-tour='nrfi-controls']", title: "Filter & sort", content: "Sort by game time or best grade. Filter to NRFI-only, YRFI-only, or all. Toggle between 2025 season data or 3-year historical.", side: "bottom" },
  { target: "[data-tour='nrfi-cards']", title: "Game cards", content: "Each card shows the grade (A+ to D), lean (NRFI/YRFI), pitcher scoreless records, reason tags, and best available odds. Higher grades = stronger plays.", side: "top", mobileSide: "top" },
  { target: "[data-tour='nrfi-cards'] > div:first-child", title: "Expanded breakdown", content: "Full pitcher profiles, offense stats, component score meters, weather conditions, park factor, and all sportsbook NRFI/YRFI odds side by side.", side: "top", action: clickFirstNrfiCard },
]

const NRFI_FEATURES: TourFeature[] = [
  { icon: <Icon d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />, title: "NRFI/YRFI grades", desc: "Every game graded A+ through D based on pitcher scoreless rates, first-inning offense, and multi-year trends." },
  { icon: <Icon d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Live odds comparison", desc: "NRFI and YRFI odds from all major sportsbooks with logos and direct bet links." },
  { icon: <Icon d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />, title: "Weather & park data", desc: "Temperature, wind, and park factor built into every grade for accurate first-inning predictions." },
]

export function NRFITour() {
  return <MlbToolTour storageKey={NRFI_STORAGE} eventName={NRFI_EVENT} steps={NRFI_STEPS} welcomeTitle="Welcome to NRFI Analysis" welcomeSubtitle="No Run First Inning grades with live odds" features={NRFI_FEATURES} />
}
export function NRFITourTrigger() { return <MlbTourTrigger eventName={NRFI_EVENT} /> }

// ═══════════════════════════════════════════════════════════════
// EXIT VELOCITY
// ═══════════════════════════════════════════════════════════════

const EV_EVENT = "exit-velocity:restart-tour"
const EV_STORAGE = "exit-velocity-tour-v1"

function clickFirstEvLeaderRow() {
  const row = document.querySelector("[data-tour='ev-table'] tbody tr, [data-tour='ev-table'] > div > div") as HTMLElement | null;
  if (row) row.click();
}

function switchToScatterView() {
  // Find the scatter toggle button (the one with the scatter icon)
  const buttons = document.querySelectorAll("[data-tour='ev-filter-bar'] button[title*='catter'], [data-tour='ev-filter-bar'] button:has(svg)");
  // Look for the scatter button specifically
  const scatterBtn = document.querySelector("button[title='Scatter plot: EV vs Barrel Rate']") as HTMLElement | null;
  if (scatterBtn) scatterBtn.click();
}

const EV_STEPS: TourStep[] = [
  { target: "[data-tour='ev-filter-bar']", title: "Set your filters", content: "Pick a date, adjust sample size (10-50 ABs), filter by pitcher hand or pitch type. Use the view toggle icons to switch between table and scatter plot.", side: "bottom" },
  { target: "[data-tour='ev-table']", title: "Exit velocity leaders", content: "Batters ranked by advanced metrics — avg EV, max EV, barrel rate, hard-hit %, and SLG. Color-coded tiers highlight elite hitters.", side: "top", mobileSide: "top" },
  { target: "[data-tour='ev-table']", title: "Batted ball breakdown", content: "Click any player to see their last 15 batted balls — date, inning, exit velo, launch angle, distance, trajectory, result, pitch type, and velo. Barrels are highlighted.", side: "top", action: clickFirstEvLeaderRow },
  { target: "button[title='Scatter plot: EV vs Barrel Rate']", title: "Scatter plot toggle", content: "Click this icon to switch to the scatter plot — a visual way to compare exit velocity vs barrel rate across all batters.", side: "bottom", desktopOnly: true },
  { target: "[data-tour='ev-table'] > div", title: "Scatter plot view", content: "Each dot is a batter. Size = HR count, color = xSLG. The top-right quadrant (Elite Contact) shows the most dangerous hitters. Click any dot for details.", side: "top", action: switchToScatterView, desktopOnly: true },
]

const EV_FEATURES: TourFeature[] = [
  { icon: <Icon d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />, title: "Advanced exit velocity data", desc: "Real exit velocity, barrel rate, hard-hit %, and launch angle data from MLB advanced data." },
  { icon: <Icon d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />, title: "Pitcher hand & pitch filters", desc: "See how batters hit against specific pitch types and pitcher handedness." },
  { icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />, title: "Dual visualization", desc: "Table for rankings, scatter plot for patterns. Find power hitters in favorable matchups." },
]

export function ExitVelocityTour() {
  return <MlbToolTour storageKey={EV_STORAGE} eventName={EV_EVENT} steps={EV_STEPS} welcomeTitle="Welcome to Exit Velocity" welcomeSubtitle="Find the hardest-hitting batters on today's slate" features={EV_FEATURES} />
}
export function ExitVelocityTourTrigger() { return <MlbTourTrigger eventName={EV_EVENT} /> }

// ═══════════════════════════════════════════════════════════════
// WEATHER REPORT
// ═══════════════════════════════════════════════════════════════

const WEATHER_EVENT = "weather-report:restart-tour"
const WEATHER_STORAGE = "weather-report-tour-v1"

const WEATHER_STEPS: TourStep[] = [
  { target: "[data-tour='weather-filter']", title: "Sort games", content: "Sort by environment score (highest impact first), game time, park factor, or wind impact. The date syncs across all MLB tools.", side: "bottom" },
  { target: "[data-tour='weather-game-list']", title: "Game list", content: "Every game with env score, temperature, precipitation chance, and wind speed at a glance. Click any game for the full breakdown.", side: "right", mobileSide: "bottom" },
  { target: "[data-tour='weather-detail']", title: "Weather breakdown", content: "Full detail panel — factor breakdown, game weather timeline (hour by hour), wind compass, field profile with outfield distances, and 'why it leans' tags.", side: "left", mobileSide: "top", desktopOnly: true },
]

const WEATHER_FEATURES: TourFeature[] = [
  { icon: <Icon d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />, title: "Environment scoring", desc: "Composite score (0-100) combining temperature, wind speed/direction, humidity, and elevation. High-impact games highlighted." },
  { icon: <Icon d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Hour-by-hour forecast", desc: "Temperature, wind, and precipitation changes throughout the game so you can factor in late-game conditions." },
  { icon: <Icon d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />, title: "Field profile & wind overlay", desc: "Outfield dimensions with wall heights and wind direction. See where the ball carries — or doesn't." },
]

export function WeatherReportTour() {
  return <MlbToolTour storageKey={WEATHER_STORAGE} eventName={WEATHER_EVENT} steps={WEATHER_STEPS} welcomeTitle="Welcome to Weather Report" welcomeSubtitle="How weather and park conditions impact today's games" features={WEATHER_FEATURES} />
}
export function WeatherReportTourTrigger() { return <MlbTourTrigger eventName={WEATHER_EVENT} /> }
