"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { SignalPreferences } from "@/lib/polymarket/types"

interface SettingsSheetProps {
  prefs: SignalPreferences
  onUpdate: (updates: Partial<SignalPreferences>) => void
}

const SPORTS = [
  { id: "nba", label: "NBA" },
  { id: "nhl", label: "NHL" },
  { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" },
  { id: "ncaab", label: "NCAAB" },
  { id: "soccer", label: "Soccer" },
  { id: "tennis", label: "Tennis" },
  { id: "ufc", label: "UFC" },
  { id: "esports", label: "Esports" },
]

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "recent", label: "Recent" },
  { value: "stake", label: "Stake" },
]

type SettingsTab = "filters" | "feed" | "alerts"

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "filters", label: "Filters" },
  { id: "feed", label: "Feed" },
  { id: "alerts", label: "Alerts" },
]

// ── Primitives ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
      {children}
    </p>
  )
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/80 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 whitespace-nowrap",
            value === opt.value
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors duration-200 shrink-0",
        enabled ? "bg-sky-500" : "bg-neutral-300 dark:bg-neutral-700"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200",
          enabled && "translate-x-4"
        )}
      />
    </button>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label?: string
  value: string | number | undefined
  onChange: (v: string) => void
  placeholder: string
  prefix?: string
}) {
  return (
    <div className="relative flex-1">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800/40 rounded-lg pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 transition-all tabular-nums",
          prefix ? "pl-8" : "pl-3"
        )}
      />
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1.5 leading-relaxed">{children}</p>
}

// ── Active filter count badge ──────────────────────────────────────────────

function countActiveFilters(prefs: SignalPreferences): number {
  let n = 0
  if ((prefs.sharp_signals_min_score ?? 0) > 0) n++
  if ((prefs.signal_min_stake ?? 0) > 0) n++
  if ((prefs.signal_max_slippage ?? 0) > 0) n++
  if (prefs.signal_date_range && prefs.signal_date_range !== "all") n++
  if (prefs.signal_min_odds != null) n++
  if (prefs.signal_max_odds != null) n++
  return n
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SettingsSheet({ prefs, onUpdate }: SettingsSheetProps) {
  const [tab, setTab] = useState<SettingsTab>("filters")
  const excludedSports = prefs.signal_excluded_sports || []
  const isSportExcluded = (sport: string) => excludedSports.includes(sport)
  const activeCount = countActiveFilters(prefs)

  const toggleSport = (sport: string) => {
    const next = isSportExcluded(sport)
      ? excludedSports.filter((s) => s !== sport)
      : [...excludedSports, sport]
    onUpdate({ signal_excluded_sports: next })
  }

  const tierValue = (() => {
    const filters = prefs.signal_tier_filters
    if (!filters || filters.length === 0) return "all"
    if (filters.length === 1 && filters[0] === "sharp") return "sharp"
    return "all"
  })()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="relative flex items-center justify-center h-7 w-7 rounded-md border border-neutral-200 dark:border-neutral-800/40 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors active:scale-95"
          title="Settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-sky-500 text-[8px] font-bold text-white flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800/40 w-[320px] sm:w-[340px] flex flex-col p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-neutral-900 dark:text-neutral-200 text-sm font-semibold">
            Signal settings
          </SheetTitle>
        </SheetHeader>

        {/* Tab bar */}
        <div className="px-4 pt-3">
          <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/80 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 relative",
                  tab === t.id
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {t.label}
                {t.id === "filters" && activeCount > 0 && tab !== "filters" && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-500" />
                )}
                {t.id === "alerts" && (
                  <span className="ml-1 text-[9px] text-neutral-400 font-normal">Soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10">

          {/* ═══ FILTERS TAB ═══ */}
          {tab === "filters" && (
            <div className="space-y-5">
              {/* Signal Score */}
              <div>
                <SectionLabel>Min signal score</SectionLabel>
                <Seg
                  options={[
                    { value: "0", label: "Any" },
                    { value: "60", label: "60+" },
                    { value: "70", label: "70+" },
                    { value: "80", label: "80+" },
                    { value: "90", label: "90+" },
                  ]}
                  value={String(prefs.sharp_signals_min_score || 0)}
                  onChange={(v) => onUpdate({ sharp_signals_min_score: Number(v) })}
                />
              </div>

              {/* Date Range */}
              <div>
                <SectionLabel>Date range</SectionLabel>
                <Seg
                  options={[
                    { value: "all", label: "All" },
                    { value: "today", label: "Today" },
                    { value: "3d", label: "3 days" },
                    { value: "7d", label: "7 days" },
                  ]}
                  value={prefs.signal_date_range || "all"}
                  onChange={(v) => onUpdate({ signal_date_range: v })}
                />
              </div>

              {/* Slippage */}
              <div>
                <SectionLabel>Max slippage vs sportsbook</SectionLabel>
                <Seg
                  options={[
                    { value: "0", label: "Any" },
                    { value: "3", label: "3%" },
                    { value: "5", label: "5%" },
                    { value: "10", label: "10%" },
                    { value: "15", label: "15%" },
                  ]}
                  value={String(prefs.signal_max_slippage || 0)}
                  onChange={(v) => onUpdate({ signal_max_slippage: Number(v) })}
                />
                <Hint>Hide picks where the gap between Polymarket entry and sportsbook price exceeds this.</Hint>
              </div>

              {/* Odds Range */}
              <div>
                <SectionLabel>Odds range</SectionLabel>
                <div className="flex items-center gap-2">
                  <InputField
                    prefix="Min"
                    value={prefs.signal_min_odds}
                    onChange={(v) => onUpdate({ signal_min_odds: v ? Number(v) : undefined })}
                    placeholder="-500"
                  />
                  <span className="text-neutral-400 text-[10px] shrink-0">to</span>
                  <InputField
                    prefix="Max"
                    value={prefs.signal_max_odds}
                    onChange={(v) => onUpdate({ signal_max_odds: v ? Number(v) : undefined })}
                    placeholder="+500"
                  />
                </div>
                <Hint>American odds. Negative = favorites, positive = underdogs.</Hint>
              </div>

              {/* Min Stake */}
              <div>
                <SectionLabel>Min stake</SectionLabel>
                <InputField
                  prefix="$"
                  value={prefs.signal_min_stake || ""}
                  onChange={(v) => onUpdate({ signal_min_stake: Number(v) || 0 })}
                  placeholder="0"
                />
              </div>

              {/* Reset */}
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdate({
                    sharp_signals_min_score: 0,
                    signal_min_stake: 0,
                    signal_max_slippage: 0,
                    signal_date_range: "all",
                    signal_min_odds: undefined,
                    signal_max_odds: undefined,
                  })}
                  className="w-full py-2 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border border-neutral-200 dark:border-neutral-800/40 rounded-lg transition-colors active:scale-[0.98]"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}

          {/* ═══ FEED TAB ═══ */}
          {tab === "feed" && (
            <div className="space-y-5">
              {/* Default Feed */}
              <div>
                <SectionLabel>Default feed</SectionLabel>
                <div className="space-y-1">
                  {[
                    { value: "sharp", label: "Sharps only", desc: "Highest conviction signals" },
                    { value: "all", label: "All tiers", desc: "Sharps, Insiders, and New Accounts" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          signal_tier_filters: opt.value === "sharp" ? ["sharp"] : null,
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 w-full text-left transition-all duration-150 active:scale-[0.98]",
                        tierValue === opt.value
                          ? "bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/40"
                          : "border border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                          tierValue === opt.value ? "border-sky-500" : "border-neutral-400 dark:border-neutral-600"
                        )}
                      >
                        {tierValue === opt.value && (
                          <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-neutral-900 dark:text-neutral-200">{opt.label}</p>
                        <p className="text-[10px] text-neutral-500 leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <SectionLabel>Sort by</SectionLabel>
                <Seg
                  options={SORT_OPTIONS}
                  value={prefs.signal_sort_by || "score"}
                  onChange={(v) => onUpdate({ signal_sort_by: v })}
                />
              </div>

              {/* Stats Timeframe */}
              <div>
                <SectionLabel>Stats timeframe</SectionLabel>
                <Seg
                  options={[
                    { value: "7d", label: "7d" },
                    { value: "30d", label: "30d" },
                    { value: "all", label: "All" },
                  ]}
                  value={prefs.signal_timeframe || "30d"}
                  onChange={(v) => onUpdate({ signal_timeframe: v })}
                />
              </div>

              <div className="h-px bg-neutral-200 dark:bg-neutral-800/40" />

              {/* Sports */}
              <div>
                <SectionLabel>Sports</SectionLabel>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {SPORTS.map((sport) => {
                    const excluded = isSportExcluded(sport.id)
                    return (
                      <button
                        key={sport.id}
                        type="button"
                        onClick={() => toggleSport(sport.id)}
                        className="flex items-center justify-between py-2 group"
                      >
                        <span
                          className={cn(
                            "text-sm transition-colors",
                            excluded ? "text-neutral-400 dark:text-neutral-600" : "text-neutral-900 dark:text-neutral-200"
                          )}
                        >
                          {sport.label}
                        </span>
                        <div className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                          excluded
                            ? "border-neutral-300 dark:border-neutral-700"
                            : "border-sky-500 bg-sky-500"
                        )}>
                          {!excluded && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resolved toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-neutral-900 dark:text-neutral-200">Show resolved picks</p>
                  <p className="text-[10px] text-neutral-500">Include settled bets in the feed</p>
                </div>
                <Toggle
                  enabled={!!prefs.signal_show_resolved}
                  onToggle={() => onUpdate({ signal_show_resolved: !prefs.signal_show_resolved })}
                />
              </div>
            </div>
          )}

          {/* ═══ ALERTS TAB ═══ */}
          {tab === "alerts" && (
            <div className="space-y-5 opacity-40">
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800/60 mb-3">
                  <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Alerts coming soon</p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Get notified when sharps make high-conviction bets or strong consensus forms.
                </p>
              </div>
              <div className="space-y-3 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Sharp bets 5x+ avg</span>
                  <Toggle enabled={false} onToggle={() => {}} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Strong consensus (75%+)</span>
                  <Toggle enabled={false} onToggle={() => {}} />
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
