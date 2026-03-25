"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

// ── Shared tour infrastructure for all MLB tools ──────────────────────────
// Reuses the same spotlight/keyboard/tooltip pattern from Sharp Intel tour.
// Each tool just provides its own steps, features, and storage key.

export interface TourStep {
  target: string
  mobileTarget?: string
  title: string
  content: string
  side?: "top" | "bottom" | "left" | "right"
  mobileSide?: "top" | "bottom" | "left" | "right"
  action?: () => void
  desktopOnly?: boolean
}

export interface TourFeature {
  icon: React.ReactNode
  title: string
  desc: string
}

const TOOLTIP_PAD = 16

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
    case "top": top = rect.top - gap; left = rect.left + rect.width / 2 - w / 2; break
    case "bottom": top = rect.bottom + gap; left = rect.left + rect.width / 2 - w / 2; break
    case "left": top = rect.top + rect.height / 2; left = rect.left - gap - w; break
    case "right": top = rect.top + rect.height / 2; left = rect.right + gap; break
  }

  left = Math.max(TOOLTIP_PAD, Math.min(left, window.innerWidth - w - TOOLTIP_PAD))
  top = Math.max(TOOLTIP_PAD, Math.min(top, window.innerHeight - 200))
  if (side === "top") top = Math.max(TOOLTIP_PAD, rect.top - gap - 160)
  if (side === "left" || side === "right") top = Math.max(TOOLTIP_PAD, Math.min(rect.top + rect.height / 2 - 80, window.innerHeight - 200))

  return { position: "fixed" as const, top, left, width: w }
}

// ── Welcome Modal ──────────────────────────────────────────────

function WelcomeModal({
  title, subtitle, features, onStartTour, onSkip, accent = "red",
}: {
  title: string; subtitle: string; features: TourFeature[];
  onStartTour: () => void; onSkip: () => void; accent?: "red" | "brand";
}) {
  const isBrand = accent === "brand";
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={onSkip} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", isBrand ? "bg-brand/10 border border-brand/20" : "bg-red-500/10 border border-red-500/20")}>
              <svg className={cn("h-5 w-5", isBrand ? "text-brand" : "text-red-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-2 space-y-4">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className={cn("shrink-0 mt-0.5", isBrand ? "text-brand" : "text-red-400")}>{f.icon}</div>
              <div>
                <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">{f.title}</p>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 pt-4 flex items-center justify-between gap-3">
          <button onClick={onSkip} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Skip for now</button>
          <button onClick={onStartTour} className={cn("px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-colors active:scale-95", isBrand ? "bg-brand hover:bg-brand/90" : "bg-red-500 hover:bg-red-600")}>Take the tour</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Generic Tour Component ─────────────────────────────────────

export function MlbToolTour({
  storageKey, eventName, steps: allSteps, welcomeTitle, welcomeSubtitle, features, accent = "red",
}: {
  storageKey: string; eventName: string;
  steps: TourStep[]; welcomeTitle: string; welcomeSubtitle: string; features: TourFeature[]; accent?: "red" | "brand";
}) {
  const [showWelcome, setShowWelcome] = useState(false)
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  const mobile = isMobileViewport()
  const steps = mobile ? allSteps.filter(s => !s.desktopOnly) : allSteps

  useEffect(() => {
    try { if (!localStorage.getItem(storageKey)) { const t = setTimeout(() => setShowWelcome(true), 1500); return () => clearTimeout(t) } } catch {}
  }, [storageKey])

  useEffect(() => {
    const handler = () => { setStep(0); setHighlightRect(null); setShowWelcome(true) }
    window.addEventListener(eventName, handler)
    return () => window.removeEventListener(eventName, handler)
  }, [eventName])

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

  useEffect(() => {
    if (!active) return
    const current = steps[step]
    if (!current) return
    if (current.action) current.action()
    const timer = setTimeout(() => {
      const selector = (mobile && current.mobileTarget) ? current.mobileTarget : current.target
      const el = document.querySelector(selector)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => {
        updatePosition()
        const tick = () => { updatePosition(); rafRef.current = requestAnimationFrame(tick) }
        rafRef.current = requestAnimationFrame(tick)
      }, 300)
    }, current.action ? 600 : 100)
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, step, updatePosition])

  const finish = useCallback(() => { setActive(false); try { localStorage.setItem(storageKey, "true") } catch {} }, [storageKey])
  const goTo = useCallback((n: number) => { if (transitioning) return; setTransitioning(true); setTimeout(() => { setStep(n); setTimeout(() => setTransitioning(false), 50) }, 150) }, [transitioning])
  const next = useCallback(() => { if (step < steps.length - 1) goTo(step + 1); else finish() }, [step, finish, goTo, steps.length])
  const back = useCallback(() => { if (step > 0) goTo(step - 1) }, [step, goTo])

  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); if (e.key === "Enter" || e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") back() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [active, next, back, finish])

  if (showWelcome) {
    return <WelcomeModal title={welcomeTitle} subtitle={welcomeSubtitle} features={features} accent={accent}
      onStartTour={() => { setShowWelcome(false); setActive(true) }}
      onSkip={() => { setShowWelcome(false); try { localStorage.setItem(storageKey, "true") } catch {} }}
    />
  }

  if (!active || !highlightRect) return null
  const current = steps[step]

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={finish}>
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id={`${storageKey}-mask`}>
              <rect width="100%" height="100%" fill="white" />
              <rect x={highlightRect.left - 6} y={highlightRect.top - 6} width={highlightRect.width + 12} height={highlightRect.height + 12} rx={10} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${storageKey}-mask)`} />
        </svg>
        <div className={cn("absolute rounded-[10px] ring-2 pointer-events-none transition-all duration-300 ease-out", accent === "brand" ? "ring-brand/50" : "ring-red-500/50", transitioning && "opacity-0")}
          style={{ top: highlightRect.top - 6, left: highlightRect.left - 6, width: highlightRect.width + 12, height: highlightRect.height + 12 }} />
        <div className="absolute" style={{ top: highlightRect.top - 6, left: highlightRect.left - 6, width: highlightRect.width + 12, height: highlightRect.height + 12, pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()} />
      </div>
      <div className={cn("fixed z-[9999] rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 p-4 transition-opacity duration-150", transitioning && "opacity-0")} style={tooltipStyle}>
        <p className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100 mb-1">{current.title}</p>
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3">{current.content}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 tabular-nums">{step + 1} / {steps.length}</span>
            <span className="text-[10px] text-neutral-300 dark:text-neutral-600">Arrow keys</span>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && <button onClick={back} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Back</button>}
            <button onClick={finish} className="text-[12px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Skip</button>
            <button onClick={next} className={cn("px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold transition-colors active:scale-95", accent === "brand" ? "bg-brand hover:bg-brand/90" : "bg-red-500 hover:bg-red-600")}>
              {step < steps.length - 1 ? "Next" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

/** Generic tour trigger button */
export function MlbTourTrigger({ eventName }: { eventName: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event(eventName))}
      className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      Tour
    </button>
  )
}
