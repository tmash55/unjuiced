"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

// ── Steps ──────────────────────────────────────────────────────
// Taste-skill principle: respect the user's time. 4 steps max.
// Each step teaches ONE concept. No filler.

interface TourStep {
  target: string
  /** Override target selector on mobile */
  mobileTarget?: string
  title: string
  content: string | ((el: Element) => string)
  side?: "top" | "bottom" | "left" | "right"
  /** Override side on mobile */
  mobileSide?: "top" | "bottom" | "left" | "right"
  /** Run before showing this step — e.g. switch tabs */
  action?: () => void
  /** Skip this step on mobile */
  desktopOnly?: boolean
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='pick-card']",
    title: "Real-time insider picks",
    content: "Each card is one bet detected from a tracked Polymarket insider. The score (0-100) reflects their history, bet size, and timing. Higher is stronger.",
    side: "right",
    mobileSide: "bottom",
    action: () => clickTab("picks"),
  },
  {
    target: "[data-tour='selection-block']",
    mobileTarget: "[data-tour='selection-block-mobile']",
    title: "The pick",
    content: "This is what the insider bet on and at what price. The odds shown are their entry price on Polymarket.",
    side: "left",
    mobileSide: "bottom",
  },
  {
    target: "[data-tour='meta-row']",
    title: "Bet size & conviction",
    content: (el) => {
      const text = el.textContent || ""
      const mulMatch = text.match(/([\d.]+)x/)
      const mul = mulMatch ? mulMatch[1] : null
      const amtMatch = text.match(/\$[\d.]+[kM]?/)
      const amt = amtMatch ? amtMatch[0] : null
      if (mul && amt) {
        return `This insider wagered ${amt} — and the ${mul}x multiplier means this bet is ${mul} times their average stake. That level of conviction is a strong signal. The higher the multiplier, the more confident the insider is in this pick.`
      }
      return "The dollar amount is how much they wagered. The multiplier compares this bet to their average stake — higher means stronger conviction, signaling high confidence in the pick."
    },
    side: "bottom",
  },
  {
    target: "[data-tour='detail-panel']",
    title: "Full signal breakdown",
    content: "Click any pick for the full picture — entry vs current price, slippage, the insider's track record, a price chart, order fills, and live sportsbook odds matched to the best legal book price.",
    side: "left",
    desktopOnly: true,
  },
  {
    target: "[data-tour-tab='markets']",
    title: "Markets view",
    content: "All insider activity grouped by game. See both sides of every market, total flow, and consensus direction. Click any market for price charts and sportsbook odds for both sides.",
    side: "bottom",
    action: () => clickTab("markets"),
  },
  {
    target: "[data-tour-tab='leaderboard']",
    title: "Leaderboard & My Sharps",
    content: "Every tracked insider ranked by ROI, win rate, and volume. Follow your favorites to build a personalized feed — filter to 'My Sharps' to see only their picks.",
    side: "bottom",
    action: () => clickTab("leaderboard"),
  },
]

/** Click a tab by key — the tour uses this to navigate between tabs */
function clickTab(tabKey: string) {
  const btn = document.querySelector(`[data-tour-tab="${tabKey}"]`) as HTMLButtonElement | null
  if (btn) btn.click()
}

const STORAGE_KEY = "sharp-intel-tour-v2"
const TOOLTIP_PAD = 16

function getTooltipWidth() {
  if (typeof window === "undefined") return 300
  return window.innerWidth < 640 ? Math.min(280, window.innerWidth - 32) : 300
}

function isMobileViewport() {
  if (typeof window === "undefined") return false
  return window.innerWidth < 768
}

// ── Positioning ────────────────────────────────────────────────
// Clamp tooltip to viewport. Never let it go offscreen.

function getTooltipStyle(rect: DOMRect, side: string): React.CSSProperties {
  const gap = 14
  const w = getTooltipWidth()
  let top = 0
  let left = 0

  switch (side) {
    case "top":
      top = rect.top - gap
      left = rect.left + rect.width / 2 - w / 2
      break
    case "bottom":
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - w / 2
      break
    case "left":
      top = rect.top + rect.height / 2
      left = rect.left - gap - w
      break
    case "right":
      top = rect.top + rect.height / 2
      left = rect.right + gap
      break
  }

  // Clamp horizontal
  left = Math.max(TOOLTIP_PAD, Math.min(left, window.innerWidth - w - TOOLTIP_PAD))
  // Clamp vertical
  top = Math.max(TOOLTIP_PAD, Math.min(top, window.innerHeight - 200))

  if (side === "top") {
    top = Math.max(TOOLTIP_PAD, rect.top - gap - 160)
  }
  if (side === "left" || side === "right") {
    top = Math.max(TOOLTIP_PAD, Math.min(rect.top + rect.height / 2 - 80, window.innerHeight - 200))
  }

  return { position: "fixed" as const, top, left, width: w }
}

// ── Sports with odds ───────────────────────────────────────────
// Used by page to auto-select first pick from a sport we have odds for
const SPORTS_WITH_ODDS = new Set(["nba", "nhl", "ncaab", "ncaaf", "nfl", "mlb", "wnba"])

export function hasOddsForSport(sport: string | null | undefined): boolean {
  if (!sport) return false
  return SPORTS_WITH_ODDS.has(sport.toLowerCase())
}

// ── Tour Component ─────────────────────────────────────────────

const TOUR_EVENT = "sharp-intel:restart-tour"

// ── Welcome Modal ──────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Real-time detection",
    desc: "We track 80+ wallets on Polymarket — the sharpest, most profitable sports bettors in the world. When they bet, you know within seconds.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Every signal scored",
    desc: "Each bet gets a 0-100 signal score based on the trader's track record, bet size relative to their average, and market timing.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Best legal odds",
    desc: "Every signal is cross-referenced with live odds from 15+ legal US sportsbooks. We show you where to get the best price — and link you straight to the book.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Follow & personalize",
    desc: "Build your own watchlist of sharps. Track their performance over time and filter your feed to only show picks from insiders you trust.",
  },
]

function WelcomeModal({ onStartTour, onSkip }: { onStartTour: () => void; onSkip: () => void }) {
  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onSkip}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                Welcome to Sharp Intel
              </h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                Real-time insider tracking from prediction markets
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 pb-2 space-y-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className="shrink-0 mt-0.5 text-sky-400">
                {f.icon}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">
                  {f.title}
                </p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Track record callout */}
        <div className="mx-6 mt-4 mb-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <div className="flex items-center justify-center gap-6 text-center">
            <div>
              <p className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">65%</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Win Rate</p>
            </div>
            <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/30" />
            <div>
              <p className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+14%</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">ROI</p>
            </div>
            <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/30" />
            <div>
              <p className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">80+</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Insiders</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={onSkip}
            className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            Skip, I'll explore
          </button>
          <button
            onClick={onStartTour}
            className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[13px] font-semibold transition-colors active:scale-95"
          >
            Take the tour
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tour Component ─────────────────────────────────────────────

export function OnboardingTour() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  // Filter steps for mobile — skip desktop-only steps
  const mobile = isMobileViewport()
  const steps = mobile ? TOUR_STEPS.filter(s => !s.desktopOnly) : TOUR_STEPS

  // Auto-show welcome on first visit
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      const timer = setTimeout(() => setShowWelcome(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  // Listen for restart event from TourTrigger
  useEffect(() => {
    const handler = () => {
      setStep(0)
      setHighlightRect(null)
      setShowWelcome(true)
    }
    window.addEventListener(TOUR_EVENT, handler)
    return () => window.removeEventListener(TOUR_EVENT, handler)
  }, [])

  const updatePosition = useCallback(() => {
    if (!active) return
    const current = steps[step]
    if (!current) return
    const selector = (mobile && current.mobileTarget) ? current.mobileTarget : current.target
    const el = document.querySelector(selector)
    if (!el) return

    const side = (mobile && current.mobileSide) ? current.mobileSide : (current.side || "bottom")
    const rect = el.getBoundingClientRect()
    setHighlightRect(rect)
    setTooltipStyle(getTooltipStyle(rect, side))
  }, [active, step, steps, mobile])

  // Run action (e.g. switch tab) then position tooltip
  useEffect(() => {
    if (!active) return

    const current = steps[step]
    if (!current) return

    // Run action first (e.g. click tab), then wait for content to render
    if (current.action) current.action()

    const tick = () => {
      updatePosition()
      rafRef.current = requestAnimationFrame(tick)
    }

    // Delay to let tab content mount + scroll into view
    const timer = setTimeout(() => {
      const elSelector = (mobile && current.mobileTarget) ? current.mobileTarget : current.target
      const el = document.querySelector(elSelector)
      if (el) {
        // Scroll the element's scrollable parent to show it near the top
        const scrollParent = el.closest("[class*='overflow-y-auto']") || el.closest("[class*='overflow-auto']")
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          const scrollTop = scrollParent.scrollTop + (elRect.top - parentRect.top) - 20
          scrollParent.scrollTo({ top: Math.max(0, scrollTop), behavior: "smooth" })
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }
      setTimeout(() => {
        updatePosition()
        rafRef.current = requestAnimationFrame(tick)
      }, 300)
    }, current.action ? 600 : 100) // longer delay when switching tabs

    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, step, updatePosition])

  const finish = useCallback(() => {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, "true")
    // Navigate back to picks tab so user lands on the main view
    clickTab("picks")
  }, [])

  const goTo = useCallback((nextStep: number) => {
    if (transitioning) return
    setTransitioning(true)
    // Fade out, switch step, fade in
    setTimeout(() => {
      setStep(nextStep)
      setTimeout(() => setTransitioning(false), 50)
    }, 150)
  }, [transitioning])

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      goTo(step + 1)
    } else {
      finish()
    }
  }, [step, finish, goTo])

  const back = useCallback(() => {
    if (step > 0) goTo(step - 1)
  }, [step, goTo])

  // Keyboard: Escape to skip, Enter/ArrowRight for next, ArrowLeft for back
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish()
      if (e.key === "Enter" || e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") back()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [active, next, back, finish])

  // Show welcome modal first, then tour steps
  if (showWelcome) {
    return (
      <WelcomeModal
        onStartTour={() => {
          setShowWelcome(false)
          setActive(true)
        }}
        onSkip={() => {
          setShowWelcome(false)
          localStorage.setItem(STORAGE_KEY, "true")
        }}
      />
    )
  }

  if (!active || !highlightRect) return null

  const current = steps[step]
  const isLast = step === steps.length - 1
  const resolvedSelector = (mobile && current.mobileTarget) ? current.mobileTarget : current.target
  const targetEl = document.querySelector(resolvedSelector)
  const resolvedContent = typeof current.content === "function" && targetEl
    ? current.content(targetEl)
    : typeof current.content === "string" ? current.content : ""

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998]" onClick={finish}>
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={highlightRect.left - 6}
                y={highlightRect.top - 6}
                width={highlightRect.width + 12}
                height={highlightRect.height + 12}
                rx={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#tour-mask)" />
        </svg>
        {/* Highlight ring */}
        <div
          className={cn(
            "absolute rounded-[10px] ring-2 ring-sky-500/50 pointer-events-none transition-all duration-300 ease-out",
            transitioning && "opacity-0"
          )}
          style={{
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
          }}
        />
        {/* Allow scrolling inside the highlighted area */}
        <div
          className="absolute"
          style={{
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
            pointerEvents: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Tooltip */}
      <div
        className={cn(
          "z-[9999] rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/40 shadow-2xl p-4 transition-opacity duration-150",
          transitioning ? "opacity-0" : "opacity-100"
        )}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step counter */}
        <p className="text-[10px] text-neutral-400 dark:text-neutral-600 uppercase tracking-wider mb-1.5">
          {step + 1} of {steps.length}
        </p>
        <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
          {current.title}
        </p>
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
          {resolvedContent}
        </p>
        <div className="flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step ? "w-5 bg-sky-500" : i < step ? "w-1.5 bg-sky-500/40" : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={finish}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              Skip
            </button>
            {step > 0 && (
              <button
                onClick={back}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/40 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-[11px] font-medium transition-colors active:scale-95"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition-colors active:scale-95"
            >
              {isLast ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Tour Trigger ───────────────────────────────────────────────

export function TourTrigger() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(STORAGE_KEY)
        window.dispatchEvent(new CustomEvent(TOUR_EVENT))
      }}
      className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors flex items-center gap-1 shrink-0"
      title="Take the tour"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
      <span className="hidden sm:inline">Tour</span>
    </button>
  )
}
