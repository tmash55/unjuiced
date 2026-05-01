"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

// ── Steps ──────────────────────────────────────────────────────

interface TourStep {
  target: string
  mobileTarget?: string
  title: string
  content: string
  side?: "top" | "bottom" | "left" | "right"
  mobileSide?: "top" | "bottom" | "left" | "right"
  action?: () => void
  desktopOnly?: boolean
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='game-bar']",
    title: "Pick a game",
    content: "Select any game from today's slate. Games auto-advance to tomorrow when today's are done. The date syncs across all MLB tools.",
    side: "bottom",
  },
  {
    target: "[data-tour='pitcher-card']",
    title: "Pitcher breakdown",
    content: "Full pitcher profile with ERA, WHIP, K/9, arsenal with real advanced BAA/SLG, hand splits vs LHB/RHB, and pitch zone heat map. Adjust the season/sample filter above.",
    side: "right",
    mobileSide: "bottom",
  },
  {
    target: "[data-tour='batter-controls']",
    title: "Filter the matchup",
    content: "Select pitch types to see how batters perform against specific pitches. Pick multiple for weighted averages. Toggle vs RHP/LHP for handedness splits. All stats update instantly.",
    side: "bottom",
  },
  {
    target: "[data-tour='batter-table']",
    title: "Batting lineup",
    content: "Every starter ranked by batting order with real advanced BA, SLG, ISO, EV, barrel rate, wOBA, K%, and BB%. Expand any batter for pitch splits, HR score, H2H history, and strike zone analysis.",
    side: "top",
    mobileSide: "top",
  },
  {
    target: "[data-tour='view-toggle']",
    title: "Standard vs Matchup view",
    content: "Standard shows the full stat table. Matchup view shows card-based matchup quality with HR score, pitch overlap, grade, and key factors at a glance.",
    side: "bottom",
    desktopOnly: true,
  },
]

const STORAGE_KEY = "slate-insights-tour-v1"
const TOOLTIP_PAD = 16
const TOUR_EVENT = "slate-insights:restart-tour"

function getTooltipWidth() {
  if (typeof window === "undefined") return 300
  return window.innerWidth < 640 ? Math.min(280, window.innerWidth - 32) : 320
}

function isMobileViewport() {
  if (typeof window === "undefined") return false
  return window.innerWidth < 768
}

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

  left = Math.max(TOOLTIP_PAD, Math.min(left, window.innerWidth - w - TOOLTIP_PAD))
  top = Math.max(TOOLTIP_PAD, Math.min(top, window.innerHeight - 200))

  if (side === "top") {
    top = Math.max(TOOLTIP_PAD, rect.top - gap - 160)
  }
  if (side === "left" || side === "right") {
    top = Math.max(TOOLTIP_PAD, Math.min(rect.top + rect.height / 2 - 80, window.innerHeight - 200))
  }

  return { position: "fixed" as const, top, left, width: w }
}

// ── Welcome Modal ──────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    title: "Pitch-level matchup data",
    desc: "See how every batter performs against each pitch in the starter's arsenal. Filter by sinker, slider, changeup — or combine multiple.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Real advanced stats",
    desc: "BA, SLG, ISO, wOBA, K%, BB% from real plate appearances. Hand splits from advanced data — not inflated batted-ball-only numbers.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
    title: "HR scoring & zone maps",
    desc: "Every batter gets an HR probability score. Expand for pitch vulnerability, H2H history, and 9-zone strike zone heat maps.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
    title: "Multi-pitch filtering",
    desc: "Select one or multiple pitches to see weighted stats. Find who crushes the starter's primary offerings — or struggles against his best stuff.",
  },
]

function WelcomeModal({ onStartTour, onSkip }: { onStartTour: () => void; onSkip: () => void }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onSkip} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Welcome to Slate Insights</h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">Every MLB matchup broken down pitch by pitch</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-2 space-y-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className="shrink-0 mt-0.5 text-red-400">{f.icon}</div>
              <div>
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">{f.title}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-6 mt-4 mb-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center leading-relaxed">
            Powered by <span className="font-semibold text-neutral-700 dark:text-neutral-300">MLB advanced metrics</span> — real plate appearances, not batted-ball-only stats
          </p>
        </div>
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button onClick={onSkip} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
            Skip for now
          </button>
          <button onClick={onStartTour} className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors active:scale-95">
            Take the tour
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tour Trigger ───────────────────────────────────────────────

export function TourTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
      className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      Tour
    </button>
  )
}

// ── Tour Component ─────────────────────────────────────────────

export function SlateInsightsTour() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  const mobile = isMobileViewport()
  const steps = mobile ? TOUR_STEPS.filter(s => !s.desktopOnly) : TOUR_STEPS

  // Auto-show welcome on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => setShowWelcome(true), 1500)
        return () => clearTimeout(timer)
      }
    } catch {}
  }, [])

  // Listen for restart
  useEffect(() => {
    const handler = () => { setStep(0); setHighlightRect(null); setShowWelcome(true) }
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

  // Position tooltip + scroll into view
  useEffect(() => {
    if (!active) return
    const current = steps[step]
    if (!current) return

    if (current.action) current.action()

    const timer = setTimeout(() => {
      const selector = (mobile && current.mobileTarget) ? current.mobileTarget : current.target
      const el = document.querySelector(selector)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      setTimeout(() => {
        updatePosition()
        const tick = () => { updatePosition(); rafRef.current = requestAnimationFrame(tick) }
        rafRef.current = requestAnimationFrame(tick)
      }, 300)
    }, current.action ? 600 : 100)

    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, step, updatePosition])

  const finish = useCallback(() => {
    setActive(false)
    try { localStorage.setItem(STORAGE_KEY, "true") } catch {}
  }, [])

  const goTo = useCallback((nextStep: number) => {
    if (transitioning) return
    setTransitioning(true)
    setTimeout(() => {
      setStep(nextStep)
      setTimeout(() => setTransitioning(false), 50)
    }, 150)
  }, [transitioning])

  const next = useCallback(() => {
    if (step < steps.length - 1) goTo(step + 1)
    else finish()
  }, [step, finish, goTo, steps.length])

  const back = useCallback(() => {
    if (step > 0) goTo(step - 1)
  }, [step, goTo])

  // Keyboard: Escape, Enter/ArrowRight, ArrowLeft
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

  if (showWelcome) {
    return (
      <WelcomeModal
        onStartTour={() => { setShowWelcome(false); setActive(true) }}
        onSkip={() => { setShowWelcome(false); try { localStorage.setItem(STORAGE_KEY, "true") } catch {} }}
      />
    )
  }

  if (!active || !highlightRect) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return createPortal(
    <>
      {/* Overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[9998]" onClick={finish}>
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="slate-tour-mask">
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
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#slate-tour-mask)" />
        </svg>

        {/* Highlight ring */}
        <div
          className={cn(
            "absolute rounded-[10px] ring-2 ring-red-500/50 pointer-events-none transition-all duration-300 ease-out",
            transitioning && "opacity-0"
          )}
          style={{
            top: highlightRect.top - 6,
            left: highlightRect.left - 6,
            width: highlightRect.width + 12,
            height: highlightRect.height + 12,
          }}
        />

        {/* Allow interaction inside highlighted area */}
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
          "fixed z-[9999] rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 p-4 transition-opacity duration-150",
          transitioning && "opacity-0"
        )}
        style={tooltipStyle}
      >
        <p className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100 mb-1">{current.title}</p>
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3">{current.content}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 tabular-nums">{step + 1} / {steps.length}</span>
            <span className="text-[10px] text-neutral-300 dark:text-neutral-600">Use arrow keys</span>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={back} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                Back
              </button>
            )}
            <button onClick={finish} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
              Skip
            </button>
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 transition-colors active:scale-95"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
