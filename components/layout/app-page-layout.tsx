"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { SportIcon } from "@/components/icons/sport-icons"
import { WnbaExpansionWelcome } from "@/components/wnba/wnba-expansion-welcome"

/**
 * AppPageLayout - Consistent layout for all authenticated app pages
 * 
 * Structure:
 * ┌────────────────────────────────────────────┐
 * │ Page Header                                │
 * │ Title                                      │
 * │ Subtitle / context (optional)              │
 * │ Right-side actions (refresh, glossary, etc)│
 * └────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────┐
 * │ Context Bar (filters / tabs / games)       │
 * │ (always same height & position)            │
 * └────────────────────────────────────────────┘
 * 
 * ┌────────────────────────────────────────────┐
 * │ Primary Content Area                       │
 * │ (tables, cards, charts)                    │
 * └────────────────────────────────────────────┘
 * 
 * Usage:
 * ```tsx
 * <AppPageLayout
 *   title="Arbitrage Opportunities"
 *   subtitle="Discover risk-free profit opportunities across sportsbooks"
 *   headerActions={<AutoToggle />}
 *   contextBar={
 *     <div className="flex items-center justify-between">
 *       <ModeToggle mode={mode} onModeChange={setMode} />
 *       <div className="flex items-center gap-3">
 *         <SearchInput />
 *         <FiltersButton />
 *       </div>
 *     </div>
 *   }
 * >
 *   <DataTable />
 * </AppPageLayout>
 * ```
 */

// Sport theme colors for header gradients
// Uses desaturated, warm tones per taste-skill: no neon, no oversaturation
const SPORT_THEMES: Record<string, { from: string; via: string; badge: string; label: string }> = {
  nba: {
    from: "rgb(234 88 12 / 0.12)",   // orange-600
    via: "rgb(251 191 36 / 0.04)",    // amber-400
    badge: "text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/20 dark:border-orange-400/20",
    label: "NBA",
  },
  mlb: {
    from: "rgb(220 38 38 / 0.12)",    // red-600
    via: "rgb(244 63 94 / 0.04)",     // rose-500
    badge: "text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/15 border-red-500/20 dark:border-red-400/20",
    label: "MLB",
  },
  nhl: {
    from: "rgb(37 99 235 / 0.12)",    // blue-600
    via: "rgb(56 189 248 / 0.04)",    // sky-400
    badge: "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20 dark:border-blue-400/20",
    label: "NHL",
  },
  nfl: {
    from: "rgb(5 150 105 / 0.12)",    // emerald-600
    via: "rgb(52 211 153 / 0.04)",    // emerald-400
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 dark:border-emerald-400/20",
    label: "NFL",
  },
}

interface AppPageLayoutProps {
  /** Page title - required */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Optional sport context — adds gradient accent and sport badge to header */
  sport?: string
  /** Optional stats/metrics row between header and context bar */
  statsBar?: React.ReactNode
  /** Optional right-side actions in the header (buttons, toggles, etc.) */
  headerActions?: React.ReactNode
  /** Optional context bar content (filters, tabs, search, etc.) */
  contextBar?: React.ReactNode
  /** Whether the context bar should be sticky (default: true) */
  stickyContextBar?: boolean
  /** Main page content */
  children: React.ReactNode
  /** Optional class name for the outer container */
  className?: string
  /** Optional class name for the content area */
  contentClassName?: string
  /** Max width constraint (default: "2xl") */
  maxWidth?: "xl" | "2xl" | "full" | "none"
}

const maxWidthClasses = {
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
  none: "",
}

export function AppPageLayout({
  title,
  subtitle,
  sport,
  statsBar,
  headerActions,
  contextBar,
  stickyContextBar = true,
  children,
  className,
  contentClassName,
  maxWidth = "full",
}: AppPageLayoutProps) {
  const sportTheme = sport ? SPORT_THEMES[sport.toLowerCase()] : null
  const showWnbaWelcome = sport?.toLowerCase() === "wnba"

  return (
    <div className={cn("mx-auto px-3 sm:px-4 lg:px-6 py-5", maxWidthClasses[maxWidth], className)}>
      {showWnbaWelcome && <WnbaExpansionWelcome />}

      {/* Page Header + Context Bar — wrapped in sport gradient */}
      <div
        className="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 -mt-5 pt-5 relative"
        style={sportTheme ? {
          background: `radial-gradient(ellipse 80% 70% at 0% 0%, ${sportTheme.from}, ${sportTheme.via}, transparent)`,
        } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-5">
          <div className="min-w-0 flex-1">
            {/* Sport badge */}
            {sportTheme && (
              <div className={cn(
                "inline-flex items-center gap-1.5 mb-1.5 sm:mb-2.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider",
                sportTheme.badge
              )}>
                <SportIcon sport={sport!} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {sportTheme.label}
              </div>
            )}
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden sm:block mt-1 text-sm text-neutral-600 dark:text-neutral-400 sm:text-base max-w-3xl">
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-3 shrink-0">
              {headerActions}
            </div>
          )}
        </div>

        {/* Optional Stats Bar */}
        {statsBar && (
          <div className="mb-4">
            {statsBar}
          </div>
        )}

        {/* Context Bar (filters, tabs, etc.) */}
        {contextBar && (
          <div className={cn("mb-4", stickyContextBar && "sticky top-0 z-30 pb-2")}>
            {contextBar}
          </div>
        )}
      </div>

      {/* Primary Content Area */}
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  )
}

/**
 * PageStatsBar - Stats/metrics row component
 * Displays key metrics with optional animations
 */
interface StatItemProps {
  label: string
  value: string | number
  suffix?: string
  highlight?: boolean
  color?: "default" | "success" | "warning" | "error"
  hasFilter?: boolean
}

interface PageStatsBarProps {
  stats: StatItemProps[]
  className?: string
}

const statColors = {
  default: "text-neutral-900 dark:text-white",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
}

export function PageStatsBar({ stats, className }: PageStatsBarProps) {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      {stats.map((stat, idx) => (
        <React.Fragment key={stat.label}>
          {idx > 0 && (
            <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800" />
          )}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {stat.label}
              {stat.hasFilter && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#0EA5E9]" title="Filters active" />
              )}
            </div>
            <div className={cn(
              "mt-1 text-2xl font-bold transition-all duration-300",
              statColors[stat.color || "default"],
              stat.highlight && "scale-110"
            )}>
              {stat.value}{stat.suffix}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

/**
 * ModeToggle - Pre-match / Live toggle component
 */
interface ModeToggleProps {
  mode: "prematch" | "live"
  onModeChange: (mode: "prematch" | "live") => void
  counts?: { pregame: number; live: number }
  liveDisabled?: boolean
  liveDisabledReason?: string
  className?: string
}

export function ModeToggle({
  mode,
  onModeChange,
  counts,
  liveDisabled = false,
  liveDisabledReason = "Sharp",
  className,
}: ModeToggleProps) {
  return (
    <div className={cn("mode-toggle", className)}>
      <button
        type="button"
        onClick={() => onModeChange("prematch")}
        className={cn(mode === "prematch" && "active")}
      >
        Pre-Match{counts ? ` (${counts.pregame})` : ""}
      </button>
      <button
        type="button"
        disabled={liveDisabled}
        onClick={() => !liveDisabled && onModeChange("live")}
        className={cn(mode === "live" && !liveDisabled && "active")}
      >
        Live{counts ? ` (${counts.live})` : ""}
        {liveDisabled && (
          <span className="ml-1 text-xs opacity-60">{liveDisabledReason}</span>
        )}
      </button>
    </div>
  )
}
