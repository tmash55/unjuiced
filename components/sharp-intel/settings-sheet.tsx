"use client"

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
  { id: "tennis", label: "Tennis" },
  { id: "soccer", label: "Soccer" },
  { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" },
  { id: "march-madness", label: "March Madness" },
  { id: "ufc", label: "UFC" },
  { id: "esports", label: "Esports" },
]

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "recent", label: "Recent" },
  { value: "stake", label: "Stake" },
]

const TIMEFRAMES = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-neutral-500 tracking-wide mb-2.5">
      {children}
    </p>
  )
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/80 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800/40">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
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

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors duration-200 shrink-0",
        enabled ? "bg-sky-500" : "bg-neutral-700"
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

export function SettingsSheet({ prefs, onUpdate }: SettingsSheetProps) {
  const excludedSports = prefs.signal_excluded_sports || []
  const isSportExcluded = (sport: string) => excludedSports.includes(sport)

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
          className="flex items-center justify-center h-7 w-7 rounded-md border border-neutral-800/40 text-neutral-500 hover:text-neutral-300 transition-colors active:scale-95"
          title="Settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800/40 w-[320px] flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-neutral-900 dark:text-neutral-200 text-sm font-semibold">
            Signal settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-10 space-y-7">
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
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      tierValue === opt.value ? "border-sky-500" : "border-neutral-600"
                    )}
                  >
                    {tierValue === opt.value && (
                      <div className="h-2 w-2 rounded-full bg-sky-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-neutral-900 dark:text-neutral-200">{opt.label}</p>
                    <p className="text-[11px] text-neutral-500 leading-snug">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 dark:bg-neutral-800/40" />

          {/* Sports */}
          <div>
            <SectionLabel>Sports</SectionLabel>
            <div className="space-y-1">
              {SPORTS.map((sport) => {
                const excluded = isSportExcluded(sport.id)
                return (
                  <div
                    key={sport.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span
                      className={cn(
                        "text-sm transition-colors",
                        excluded ? "text-neutral-400 dark:text-neutral-600" : "text-neutral-900 dark:text-neutral-200"
                      )}
                    >
                      {sport.label}
                    </span>
                    <Toggle
                      enabled={!excluded}
                      onToggle={() => toggleSport(sport.id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 dark:bg-neutral-800/40" />

          {/* Min Stake */}
          <div>
            <SectionLabel>Minimum stake</SectionLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">$</span>
              <input
                type="number"
                value={prefs.signal_min_stake || ""}
                onChange={(e) => onUpdate({ signal_min_stake: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-full bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800/40 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-700 transition-colors"
              />
            </div>
          </div>

          {/* Min Score */}
          <div>
            <SectionLabel>Minimum signal score</SectionLabel>
            <SegmentedControl
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

          {/* Max Slippage */}
          <div>
            <SectionLabel>Max slippage vs sportsbook</SectionLabel>
            <SegmentedControl
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
            <p className="text-[10px] text-neutral-500 mt-1.5 leading-snug">
              Filters picks where the edge between Polymarket entry and sportsbook price exceeds this threshold.
            </p>
          </div>

          {/* Date Range */}
          <div>
            <SectionLabel>Date range</SectionLabel>
            <SegmentedControl
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

          {/* Odds Range */}
          <div>
            <SectionLabel>Odds range</SectionLabel>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-medium">Min</span>
                <input
                  type="number"
                  value={prefs.signal_min_odds ?? ""}
                  onChange={(e) => onUpdate({ signal_min_odds: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="-500"
                  className="w-full bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800/40 rounded-lg pl-9 pr-2 py-2 text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-700 transition-colors tabular-nums"
                />
              </div>
              <span className="text-neutral-500 text-xs">to</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-medium">Max</span>
                <input
                  type="number"
                  value={prefs.signal_max_odds ?? ""}
                  onChange={(e) => onUpdate({ signal_max_odds: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="+500"
                  className="w-full bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800/40 rounded-lg pl-9 pr-2 py-2 text-sm text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-700 transition-colors tabular-nums"
                />
              </div>
            </div>
            <p className="text-[10px] text-neutral-500 mt-1.5 leading-snug">
              American odds. Negative = favorites, positive = underdogs.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 dark:bg-neutral-800/40" />

          {/* Sort By */}
          <div>
            <SectionLabel>Sort by</SectionLabel>
            <SegmentedControl
              options={SORT_OPTIONS}
              value={prefs.signal_sort_by || "score"}
              onChange={(v) => onUpdate({ signal_sort_by: v })}
            />
          </div>

          {/* Stats Timeframe */}
          <div>
            <SectionLabel>Stats timeframe</SectionLabel>
            <SegmentedControl
              options={TIMEFRAMES}
              value={prefs.signal_timeframe || "30d"}
              onChange={(v) => onUpdate({ signal_timeframe: v })}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 dark:bg-neutral-800/40" />

          {/* Alerts — coming soon */}
          <div className="opacity-40">
            <SectionLabel>
              Alerts
              <span className="ml-2 text-[10px] text-neutral-600 tracking-normal font-normal">
                Coming soon
              </span>
            </SectionLabel>
            <div className="space-y-3">
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
