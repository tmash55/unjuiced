"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconHelp } from "@tabler/icons-react"
import { Sidebar } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/nav/side-nav/app-sidebar"
import { useAuth } from "@/components/auth/auth-provider"
import { LoadingSpinner } from "@/components/icons/loading-spinner"
import { FavoritesModal } from "@/components/nav/favorites-modal"
import { ModeToggle } from "@/components/mode-toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <LoadingSpinner className="size-8" />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push('/login')
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <LoadingSpinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen max-w-full overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <AppSidebar />
      </Sidebar>
      
      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 w-full shrink-0 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <TooltipProvider delayDuration={0}>
            {/* Left side - toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              </TooltipContent>
            </Tooltip>
            
            {/* Right side - My Plays, Theme Toggle, Help */}
            <div className="flex items-center gap-1">
              {/* My Plays Modal */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <FavoritesModal />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  My Plays
                </TooltipContent>
              </Tooltip>
              
              {/* Theme Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "rounded-lg transition-all duration-200",
                    "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                    "[&_button]:hover:text-[#0EA5E9] dark:[&_button]:hover:text-[#7DD3FC]"
                  )}>
                    <ModeToggle />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Toggle theme
                </TooltipContent>
              </Tooltip>
              
              {/* Help Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-lg transition-all duration-200",
                      "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
                      "text-neutral-500 dark:text-neutral-400",
                      "hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]"
                    )}
                    aria-label="Help"
                  >
                    <IconHelp className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Help & Support
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </header>
        
        {/* Page content */}
        <main className="flex-1 overflow-auto w-full scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
