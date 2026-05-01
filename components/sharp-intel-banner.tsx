"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"

const STORAGE_KEY = "sharp-intel-banner-dismissed"

export function SharpIntelBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  return (
    <div className="relative z-50 bg-gradient-to-r from-sky-600 to-sky-500 text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 px-3 py-2 relative">
        <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded shrink-0">
          NEW
        </span>
        <p className="text-xs sm:text-sm font-medium truncate">
          <span className="hidden sm:inline">Sharp Intel — Real-time insider tracking from prediction markets. </span>
          <span className="sm:hidden">Sharp Intel is live. </span>
        </p>
        <Link
          href="/sharp-intel"
          className="text-xs sm:text-sm font-semibold underline underline-offset-2 hover:text-white/90 transition-colors shrink-0"
        >
          Try it now
        </Link>
        <button
          onClick={dismiss}
          className="absolute right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
