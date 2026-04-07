"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconHelp, IconMenu2 } from "@tabler/icons-react"
import { MapPin } from "lucide-react"
import { useUserState } from "@/context/preferences-context"
import { Sidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/nav/side-nav/app-sidebar"
import { useAuth } from "@/components/auth/auth-provider"
import { useActivityTracker } from "@/hooks/use-activity-tracker"
import { LoadingSpinner } from "@/components/icons/loading-spinner"
import { BetslipFab } from "@/components/betslip/betslip-fab"
import { FeatureAnnouncementModal } from "@/components/feature-announcements/feature-announcement-modal"
import { ModeToggle } from "@/components/mode-toggle"
import { Tooltip, TooltipProvider } from "@/components/tooltip"
import { cn } from "@/lib/utils"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Track user activity (once per session, debounced 30min server-side)
  useActivityTracker(user?.id)

  useEffect(() => {
    if (!loading && !user) {
      setRedirecting(true)
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading || redirecting || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <LoadingSpinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen max-w-full overflow-hidden bg-neutral-50 dark:bg-neutral-950 flex flex-col md:flex-row">
      {/* Mobile Header - Only visible on mobile */}
      <header className="h-12 w-full shrink-0 flex md:hidden items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <TooltipProvider delayDuration={0}>
          {/* Left side - hamburger menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "p-2 rounded-lg transition-all duration-200",
              "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
              "text-neutral-500 dark:text-neutral-400",
              "hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]"
            )}
            aria-label="Open menu"
          >
            <IconMenu2 className="h-5 w-5" />
          </button>
          
          {/* Right side - State, My Plays, Theme Toggle, Help */}
          <div className="flex items-center gap-1">
            <NavStateSelector compact />
            {/* Betslip FAB renders as a floating button, not inline */}
            <ModeToggle />
            <Link
              href="/support"
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                "text-neutral-500 dark:text-neutral-400",
                "hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]"
              )}
              aria-label="Help & Support"
            >
              <IconHelp className="h-5 w-5" />
            </Link>
          </div>
        </TooltipProvider>
      </header>

      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <AppSidebar />
      </Sidebar>
      
      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop Top bar - Hidden on mobile */}
        <header className="h-12 w-full shrink-0 hidden md:flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <TooltipProvider>
            {/* Left side - toggle button */}
            <Tooltip content={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} side="bottom">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 group",
                  "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                  "text-neutral-500 dark:text-neutral-400",
                  "hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]"
                )}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                <svg
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    sidebarOpen ? "rotate-180" : "rotate-0"
                  )}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                  />
                </svg>
              </button>
            </Tooltip>
            
            {/* Right side - State, My Plays, Theme Toggle, Help */}
            <div className="flex items-center gap-1.5">
              <NavStateSelector />
              {/* Betslip FAB renders as a floating button, not inline */}
              
              {/* Theme Toggle */}
              <Tooltip content="Toggle theme" side="bottom">
                <div className={cn(
                  "rounded-lg transition-all duration-200",
                  "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                  "[&_button]:hover:text-[#0EA5E9] dark:[&_button]:hover:text-[#7DD3FC]"
                )}>
                  <ModeToggle />
                </div>
              </Tooltip>
              
              {/* Help Button */}
              <Tooltip content="Help & Support" side="bottom">
                <Link
                  href="/support"
                  className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                    "text-neutral-500 dark:text-neutral-400",
                    "hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]"
                  )}
                  aria-label="Help & Support"
                >
                  <IconHelp className="h-5 w-5" />
                </Link>
              </Tooltip>
            </div>
          </TooltipProvider>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-auto w-full scrollbar-thin">
          {children}
        </main>
      </div>

      <FeatureAnnouncementModal />
      <BetslipFab />
    </div>
  )
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM",
  "NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA",
  "WV","WI","WY"
]

function NavStateSelector({ compact }: { compact?: boolean }) {
  const { stateCode, setStateCode } = useUserState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Tooltip content={stateCode ? `Betting state: ${stateCode.toUpperCase()}` : "Set your betting state"} side="bottom">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1 rounded-full transition-all duration-200 border",
            compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
            "font-semibold",
            stateCode
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
              : "bg-neutral-100/80 dark:bg-neutral-800/50 text-neutral-400 dark:text-neutral-500 border-neutral-200/60 dark:border-neutral-700/30 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600"
          )}
        >
          <MapPin className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
          <span>{stateCode ? stateCode.toUpperCase() : "State"}</span>
        </button>
      </Tooltip>

      {open && (
        <div className={cn(
          "absolute top-full mt-2 z-50 rounded-xl border border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden",
          compact ? "right-0 w-52" : "right-0 w-56"
        )}>
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Betting State</p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Routes sportsbook links to your state</p>
          </div>
          <div className="max-h-52 overflow-y-auto px-2 pb-2">
            <div className="grid grid-cols-4 gap-0.5">
              {US_STATES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStateCode(s); setOpen(false) }}
                  className={cn(
                    "px-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center",
                    stateCode?.toUpperCase() === s
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
