"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  IconHome,
  IconScale,
  IconPlus,
  IconRocket,
  IconTable,
  IconFileText,
  IconStar,
  IconSettings,
  IconLogout,
  IconSparkles,
  IconSearch,
  IconBulb,
  IconCreditCard,
  IconBell,
  IconUser,
  IconSelector,
  IconChevronDown,
  IconZzz,
  IconHammer,
  IconHistory,
  IconBuildingBank,
  IconTags,
} from "@tabler/icons-react"
import Chart from "@/icons/chart"

import {
  SidebarBody,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useAuth } from "@/components/auth/auth-provider"
import { useEntitlements } from "@/hooks/use-entitlements"
import { cn } from "@/lib/utils"

// Types for navigation
interface NavChildItem {
  label: string
  href: string
  disabled?: boolean
  comingSoon?: boolean  // 🔨 Under construction - being built
  offSeason?: boolean   // 💤 Sport is in off-season
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  children?: NavChildItem[]
}

// Sport sub-items for Odds Screen (active first, then disabled/off-season)
const oddsScreenSports: NavChildItem[] = [
  // Active
  { label: "NBA", href: "/odds/nba" },
  { label: "NFL", href: "/odds/nfl" },
  { label: "NHL", href: "/odds/nhl" },
  { label: "NCAAB", href: "/odds/ncaab" },
  // Off season
  { label: "MLB", href: "/odds/mlb", disabled: true, offSeason: true },
  { label: "WNBA", href: "/odds/wnba", disabled: true, offSeason: true },
  { label: "NCAAF", href: "/odds/ncaaf", disabled: true, offSeason: true },
]

// Sport sub-items for Hit Rates (active first, then disabled)
const hitRatesSports: NavChildItem[] = [
  // Active
  { label: "NBA", href: "/hit-rates/nba" },
  // Disabled (coming next season)
  { label: "NFL", href: "/hit-rates/nfl", disabled: true },
  { label: "NHL", href: "/hit-rates/nhl", disabled: true },
  { label: "NCAAB", href: "/hit-rates/ncaab", disabled: true },
  // Under construction
  { label: "MLB", href: "/hit-rates/mlb", disabled: true, comingSoon: true },
  { label: "WNBA", href: "/hit-rates/wnba", disabled: true, comingSoon: true },
  // Off season
  { label: "NCAAF", href: "/hit-rates/ncaaf", disabled: true, offSeason: true },
]

// Navigation links - icons will inherit colors from parent

// Edge Tools - Money-making tools (Arbitrage, EV, Edge Finder)
const edgeToolsLinks: NavItem[] = [
  { label: "Arbitrage", href: "/arbitrage", icon: IconScale },
  { label: "Positive EV", href: "/positive-ev", icon: IconPlus },
  { label: "Edge Finder", href: "/edge-finder", icon: IconRocket },
]

// Research - Analysis and research tools
const researchLinks: NavItem[] = [
  { 
    label: "Odds Screen", 
    href: "/odds", 
    icon: IconTable,
    children: oddsScreenSports
  },
  { 
    label: "Hit Rates", 
    href: "/hit-rates", 
    icon: Chart,
    children: hitRatesSports
  },
  { 
    label: "Cheat Sheets", 
    href: "/cheatsheets", 
    icon: IconFileText,
    children: [
      { label: "Hit Rates", href: "/cheatsheets/nba/hit-rates" },
      { label: "Injury Impact", href: "/cheatsheets/nba/injury-impact" },
      { label: "Defense vs Position", href: "/stats/nba/defense-vs-position" },
    ]
  },
]

// Resources - Informational content
const resourcesLinks: NavItem[] = [
  { label: "Sportsbooks", href: "/sportsbooks", icon: IconBuildingBank },
  { label: "Markets", href: "/markets", icon: IconTags },
  { label: "Changelog", href: "/changelog", icon: IconHistory },
  { label: "Saved Plays", href: "/saved-plays", icon: IconStar },
]

const accountLinks: NavItem[] = [
  { label: "Settings", href: "/account/settings", icon: IconSettings },
]

// Shared transition config for smooth animations
const smoothTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
}

// Section header component
function SectionLabel({ children }: { children: React.ReactNode }) {
  const { open, animate } = useSidebar()
  
  return (
    <motion.div
      animate={{
        opacity: animate ? (open ? 1 : 0) : 1,
        height: animate ? (open ? "auto" : 0) : "auto",
        marginBottom: animate ? (open ? 4 : 0) : 4,
      }}
      transition={smoothTransition}
      className="overflow-hidden"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-3 block">
        {children}
      </span>
    </motion.div>
  )
}

// Custom nav link with active state using brand colors
interface NavLinkProps {
  link: NavItem
  expandedHref: string | null
  onToggleExpand: (href: string) => void
}

function NavLink({ link, expandedHref, onToggleExpand }: NavLinkProps) {
  const pathname = usePathname()
  const { open, setOpen } = useSidebar()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  // Close mobile sidebar when navigating
  const closeMobileSidebar = () => {
    // Only close on mobile (under md breakpoint = 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }
  
  const hasChildren = link.children && link.children.length > 0
  const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`)
  const isChildActive = hasChildren && link.children?.some(child => pathname === child.href)
  const Icon = link.icon
  
  // Check if this item is expanded (controlled by parent)
  const isExpanded = expandedHref === link.href
  
  // For items with children - expandable menu
  if (hasChildren) {
    // Collapsed state button (for dropdown trigger)
    const collapsedButton = (
      <button
        className={cn(
          "flex items-center justify-center w-11 h-11 rounded-lg transition-all duration-200",
          isDropdownOpen 
            ? "border border-[#0EA5E9]/40 dark:border-[#7DD3FC]/40 bg-white dark:bg-neutral-800 shadow-sm" 
            : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
          isActive || isChildActive
            ? "bg-[#0EA5E9]/5 dark:bg-[#7DD3FC]/5" 
            : ""
        )}
      >
        <span className={cn(
          "shrink-0 flex items-center justify-center transition-colors duration-200",
          isActive || isChildActive || isDropdownOpen
            ? "text-[#0EA5E9] dark:text-[#7DD3FC]" 
            : "text-neutral-500 dark:text-neutral-400"
        )}>
          <Icon className="w-5 h-5" />
        </span>
      </button>
    )
    
    // Expanded state button (inline expand/collapse)
    const expandedButton = (
      <button
        onClick={() => onToggleExpand(link.href)}
        className={cn(
          "flex items-center w-full group/sidebar rounded-lg transition-all duration-200",
          "gap-2 py-2 px-2",
          isExpanded 
            ? "border border-[#0EA5E9]/30 dark:border-[#7DD3FC]/30 bg-neutral-50/50 dark:bg-neutral-800/30" 
            : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
          isActive || isChildActive
            ? "bg-[#0EA5E9]/5 dark:bg-[#7DD3FC]/5" 
            : ""
        )}
      >
        <span className={cn(
          "shrink-0 flex items-center justify-center transition-colors duration-200",
          isActive || isChildActive
            ? "text-[#0EA5E9] dark:text-[#7DD3FC]" 
            : "text-neutral-500 dark:text-neutral-400 group-hover/sidebar:text-neutral-700 dark:group-hover/sidebar:text-neutral-200"
        )}>
          <Icon className="w-5 h-5" />
        </span>
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={smoothTransition}
          className={cn(
            "flex-1 text-sm whitespace-pre overflow-hidden text-left",
            isActive || isChildActive
              ? "text-[#0EA5E9] dark:text-[#7DD3FC] font-medium" 
              : "text-neutral-600 dark:text-neutral-300"
          )}
        >
          {link.label}
        </motion.span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <IconChevronDown className={cn(
            "w-4 h-4 transition-colors",
            isExpanded 
              ? "text-[#0EA5E9] dark:text-[#7DD3FC]" 
              : "text-neutral-400"
          )} />
        </motion.span>
      </button>
    )
    
    return (
      <div>
        {!open ? (
          // Collapsed: Use dropdown menu like BeeHiiv with tooltip on hover
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <Tooltip delayDuration={0} open={isDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  {collapsedButton}
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {link.label}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={12}
              className="min-w-[160px] p-1.5 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700"
            >
              {link.children?.map((child, idx) => {
                const isChildItemActive = pathname === child.href
                const isDisabled = child.disabled
                
                if (isDisabled) {
                  const tooltipText = child.offSeason 
                    ? "Off season" 
                    : child.comingSoon 
                      ? "Under construction" 
                      : ""
                  
                  return (
                    <Tooltip key={idx} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                        >
                          <span>{child.label}</span>
                          {child.comingSoon && (
                            <span className="flex items-center text-amber-500/70 dark:text-amber-400/70 ml-2">
                              <IconHammer className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {child.offSeason && (
                            <span className="flex items-center text-neutral-400 dark:text-neutral-500 ml-2">
                              <IconZzz className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      {tooltipText && (
                        <TooltipContent side="right" className="text-xs">
                          {tooltipText}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                }
                
                return (
                  <DropdownMenuItem key={idx} asChild className="p-0">
                    <Link
                      href={child.href}
                      onClick={closeMobileSidebar}
                      className={cn(
                        "flex items-center w-full px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                        isChildItemActive
                          ? "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10 text-[#0EA5E9] dark:text-[#7DD3FC] font-medium"
                          : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      )}
                    >
                      {child.label}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Expanded: Show inline expandable menu
          expandedButton
        )}
        
        {/* Child items - only show when sidebar is open */}
        {open && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="ml-4 pl-3 border-l border-neutral-200 dark:border-neutral-700 mt-1 space-y-0.5">
                  {link.children?.map((child, idx) => {
                    const isChildItemActive = pathname === child.href
                    const isDisabled = child.disabled
                    
                    if (isDisabled) {
                      const tooltipText = child.offSeason 
                        ? "Off season" 
                        : child.comingSoon 
                          ? "Under construction" 
                          : ""
                      
                      return (
                        <Tooltip key={idx} delayDuration={0}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex items-center justify-between py-1.5 px-2 rounded-md text-sm text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                            >
                              <span>{child.label}</span>
                              {child.comingSoon && (
                                <span className="flex items-center text-amber-500/70 dark:text-amber-400/70">
                                  <IconHammer className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {child.offSeason && (
                                <span className="flex items-center text-neutral-400 dark:text-neutral-500">
                                  <IconZzz className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          {tooltipText && (
                            <TooltipContent side="right" className="text-xs">
                              {tooltipText}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      )
                    }
                    
                    return (
                      <Link
                        key={idx}
                        href={child.href}
                        onClick={closeMobileSidebar}
                        className={cn(
                          "block py-1.5 px-2 rounded-md text-sm transition-all duration-150",
                          isChildItemActive
                            ? "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10 text-[#0EA5E9] dark:text-[#7DD3FC] font-medium"
                            : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-700 dark:hover:text-neutral-200"
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    )
  }
  
  // Simple link without children
  const linkContent = (
    <Link
      href={link.href}
      onClick={closeMobileSidebar}
      className={cn(
        "flex items-center group/sidebar rounded-lg transition-all duration-200",
        open 
          ? "gap-2 py-2 px-2" 
          : "w-11 h-11 justify-center self-center",
        isActive 
          ? "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10" 
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      )}
    >
      <span className={cn(
        "shrink-0 flex items-center justify-center transition-colors duration-200",
        isActive 
          ? "text-[#0EA5E9] dark:text-[#7DD3FC]" 
          : "text-neutral-500 dark:text-neutral-400 group-hover/sidebar:text-neutral-700 dark:group-hover/sidebar:text-neutral-200"
      )}>
        <Icon className="w-5 h-5" />
      </span>
      {open && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={smoothTransition}
          className={cn(
            "text-sm whitespace-pre overflow-hidden",
            isActive 
              ? "text-[#0EA5E9] dark:text-[#7DD3FC] font-medium" 
              : "text-neutral-600 dark:text-neutral-300"
          )}
        >
          {link.label}
        </motion.span>
      )}
    </Link>
  )
  
  // Show tooltip only when collapsed
  if (!open) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {link.label}
        </TooltipContent>
      </Tooltip>
    )
  }
  
  return linkContent
}

// Logo component - full version when open
function Logo() {
  const { setOpen } = useSidebar()
  
  const closeMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }
  
  return (
    <Link
      href="/today"
      onClick={closeMobileSidebar}
      className="relative z-20 flex items-end gap-2.5 px-1 py-1 text-sm font-normal rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      {/* Logo image */}
      <Image 
        src="/logo.png" 
        alt="Unjuiced logo" 
        width={32} 
        height={32}
        className="h-8 w-8 shrink-0"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span className="font-semibold whitespace-pre text-neutral-900 dark:text-white text-lg tracking-tight leading-none">
          Unjuiced
        </span>
      </motion.div>
    </Link>
  )
}

// Prominent CTA Button - "Find a Play"
function FindPlayButton() {
  const { open, setOpen } = useSidebar()
  const pathname = usePathname()
  const isActive = pathname === "/today"
  
  const closeMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }
  
  const buttonContent = (
    <Link
      href="/today"
      onClick={closeMobileSidebar}
      className={cn(
        "flex items-center rounded-lg transition-all duration-200",
        isActive
          ? "bg-brand hover:bg-brand/90 text-white"
          : "bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900",
        "shadow-sm hover:shadow-md",
        open 
          ? "gap-2 py-2 px-3 w-full justify-center" 
          : "w-10 h-10 justify-center",
        isActive && "shadow-md"
      )}
    >
      <IconSearch className="w-4 h-4 shrink-0" />
      {open && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={smoothTransition}
          className="text-xs font-semibold whitespace-pre overflow-hidden"
        >
          Find a Play
        </motion.span>
      )}
    </Link>
  )
  
  if (!open) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          Find a Play
        </TooltipContent>
      </Tooltip>
    )
  }
  
  return buttonContent
}

// Logo icon only - collapsed version
function LogoIcon() {
  const { setOpen } = useSidebar()
  
  const closeMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }
  
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          href="/today"
          onClick={closeMobileSidebar}
          className="relative z-20 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors p-1"
        >
          <Image 
            src="/logo.png" 
            alt="Unjuiced logo" 
            width={32} 
            height={32}
            className="h-8 w-8 shrink-0"
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        Unjuiced
      </TooltipContent>
    </Tooltip>
  )
}

// Tips for Pro users
const PRO_TIPS = [
  "Use keyboard shortcuts: Press 'F' to favorite a play",
  "Set up custom filters to find your edge faster",
  "Check hit rates before placing player props",
  "Compare odds across all books for best value",
  "Use Kelly criterion for optimal bet sizing",
]

// Status card - shows trial info or pro tips
function StatusCard() {
  const { open } = useSidebar()
  const { data: entitlements } = useEntitlements()
  const [currentTip, setCurrentTip] = React.useState(0)
  
  const isTrial = entitlements?.entitlement_source === 'trial'
  const isPro = entitlements?.entitlement_source === 'subscription' || 
                entitlements?.entitlement_source === 'grant'
  
  // Calculate trial days
  const trialDaysRemaining = React.useMemo(() => {
    if (!isTrial || !entitlements?.trial?.trial_ends_at) return 0
    const endDate = new Date(entitlements.trial.trial_ends_at)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }, [isTrial, entitlements?.trial?.trial_ends_at])
  
  const trialTotalDays = 14 // Assuming 14 day trial
  const trialProgress = isTrial ? ((trialTotalDays - trialDaysRemaining) / trialTotalDays) * 100 : 0
  
  // Rotate tips for pro users
  React.useEffect(() => {
    if (!isPro) return
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % PRO_TIPS.length)
    }, 10000) // Change tip every 10 seconds
    return () => clearInterval(interval)
  }, [isPro])
  
  // Don't show when collapsed - must be after all hooks
  if (!open) return null
  
  // Show trial card
  if (isTrial) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-[#0EA5E9]/5 to-[#7DD3FC]/10 dark:from-[#0EA5E9]/10 dark:to-[#7DD3FC]/5 border border-[#0EA5E9]/20 dark:border-[#7DD3FC]/20"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-900 dark:text-white">
            Pro Trial
          </span>
          <Link 
            href="/pricing" 
            className="text-[10px] font-medium text-[#0EA5E9] dark:text-[#7DD3FC] hover:underline"
          >
            Upgrade
          </Link>
        </div>
        
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${trialProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#7DD3FC] rounded-full"
          />
        </div>
        
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
        </span>
      </motion.div>
    )
  }
  
  // Show tips for Pro users
  if (isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-3 mb-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
      >
        <div className="flex items-start gap-2">
          <IconBulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1">
              Pro Tip
            </span>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTip}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed"
              >
                {PRO_TIPS[currentTip]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    )
  }
  
  // Free users - show upgrade prompt
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
    >
      <div className="flex items-center gap-2 mb-2">
        <IconSparkles className="w-4 h-4 text-[#0EA5E9] dark:text-[#7DD3FC]" />
        <span className="text-xs font-semibold text-neutral-900 dark:text-white">
          Unlock Pro Features
        </span>
      </div>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2">
        Get unlimited access to all edge tools and features.
      </p>
      <Link 
        href="/pricing" 
        className="inline-flex items-center justify-center w-full py-1.5 px-3 rounded-lg bg-[#0EA5E9] dark:bg-[#7DD3FC] text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        Upgrade to Pro
      </Link>
    </motion.div>
  )
}

// User section at bottom with dropdown
function UserSection() {
  const { user, signOut } = useAuth()
  const { open, animate, setOpen } = useSidebar()
  const { data: entitlements } = useEntitlements()
  
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const initials = displayName.charAt(0).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url || ''
  const isPro = entitlements?.entitlement_source === 'subscription' || 
                entitlements?.entitlement_source === 'grant'
  const isTrial = entitlements?.entitlement_source === 'trial'
  
  const closeMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center rounded-lg transition-all duration-200 cursor-pointer text-left",
            "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
            "data-[state=open]:bg-neutral-100 dark:data-[state=open]:bg-neutral-800/50",
            open 
              ? "gap-2 py-2 px-2 w-full" 
              : "w-11 h-11 justify-center self-center"
          )}
        >
          <Avatar className="h-7 w-7 shrink-0 rounded-full">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {open && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={smoothTransition}
              className="flex flex-1 items-center gap-2 min-w-0 overflow-hidden"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-neutral-900 dark:text-white truncate whitespace-pre">
                  {displayName}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate whitespace-pre">
                  {email}
                </span>
              </div>
              <IconSelector className="h-4 w-4 shrink-0 text-neutral-400" />
            </motion.div>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side="right"
        align="end"
        sideOffset={8}
      >
        {/* User info header */}
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-2 py-2 text-left text-sm">
            <Avatar className="h-9 w-9 rounded-lg">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-neutral-900 dark:text-white">{displayName}</span>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                  isPro 
                    ? "text-[#0EA5E9] dark:text-[#7DD3FC] bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10" 
                    : isTrial
                      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"
                )}>
                  {isPro ? 'Pro' : isTrial ? 'Trial' : 'Free'}
                </span>
              </div>
              <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">{email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Upgrade to Pro - only show if not pro */}
        {!isPro && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/pricing" onClick={closeMobileSidebar} className="cursor-pointer">
                  <IconSparkles className="h-4 w-4 text-[#0EA5E9] dark:text-[#7DD3FC]" />
                  <span>Upgrade to Pro</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Account actions */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account/settings" onClick={closeMobileSidebar} className="cursor-pointer">
              <IconUser className="h-4 w-4" />
              <span>Account</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/billing" onClick={closeMobileSidebar} className="cursor-pointer">
              <IconCreditCard className="h-4 w-4" />
              <span>Billing</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/notifications" onClick={closeMobileSidebar} className="cursor-pointer">
              <IconBell className="h-4 w-4" />
              <span>Notifications</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        {/* Logout */}
        <DropdownMenuItem 
          onClick={() => { closeMobileSidebar(); signOut() }}
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <IconLogout className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar() {
  const { open } = useSidebar()
  const pathname = usePathname()
  
  // Track which nav item is expanded (only one at a time)
  const [expandedHref, setExpandedHref] = useState<string | null>(null)
  
  // Toggle expand - if clicking the same item, collapse it; otherwise expand the new one
  const handleToggleExpand = (href: string) => {
    setExpandedHref(prev => prev === href ? null : href)
  }
  
  // Auto-expand the parent of the active child on initial load only
  React.useEffect(() => {
    const allLinks = [...researchLinks, ...resourcesLinks]
    for (const link of allLinks) {
      if (link.children?.some(child => pathname === child.href)) {
        setExpandedHref(link.href)
        break
      }
    }
    // Only run on mount (pathname is intentionally not in deps to avoid re-expanding on navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  return (
    <TooltipProvider>
      <SidebarBody className="justify-between gap-0">
        {/* Header row - matches main header h-12 with bottom border */}
        <div className={cn(
          "h-12 shrink-0 flex items-center border-b border-neutral-200 dark:border-neutral-800",
          open ? "px-3" : "px-2 justify-center"
        )}>
          {open ? <Logo /> : <LogoIcon />}
        </div>
      
        {/* Navigation content */}
        <div className={cn(
          "flex flex-1 flex-col overflow-x-hidden overflow-y-auto py-4 scrollbar-hide",
          open ? "px-3" : "px-2"
        )}>
          {/* Prominent CTA Button */}
          <div className="mb-6">
            <FindPlayButton />
          </div>
          
          {/* Navigation sections */}
          <div className="flex flex-col gap-6">
            {/* Edge Tools */}
            <div className="flex flex-col gap-0.5">
              <SectionLabel>Edge Tools</SectionLabel>
              {edgeToolsLinks.map((link, idx) => (
                <NavLink key={idx} link={link} expandedHref={expandedHref} onToggleExpand={handleToggleExpand} />
              ))}
            </div>
            
            {/* Research */}
            <div className="flex flex-col gap-0.5">
              <SectionLabel>Research</SectionLabel>
              {researchLinks.map((link, idx) => (
                <NavLink key={idx} link={link} expandedHref={expandedHref} onToggleExpand={handleToggleExpand} />
              ))}
            </div>
            
            {/* Resources */}
            <div className="flex flex-col gap-0.5">
              <SectionLabel>Resources</SectionLabel>
              {resourcesLinks.map((link, idx) => (
                <NavLink key={idx} link={link} expandedHref={expandedHref} onToggleExpand={handleToggleExpand} />
              ))}
            </div>
            
            {/* Account */}
            <div className="flex flex-col gap-0.5">
              <SectionLabel>Account</SectionLabel>
              {accountLinks.map((link, idx) => (
                <NavLink key={idx} link={link} expandedHref={expandedHref} onToggleExpand={handleToggleExpand} />
              ))}
            </div>
          </div>
        </div>
      
        {/* Status card + User section at bottom */}
        <div className="pt-3">
          <StatusCard />
          <div className={cn(
            "border-t border-neutral-200 dark:border-neutral-800 pb-3 pt-3",
            open ? "px-3" : "px-2"
          )}>
            <UserSection />
          </div>
        </div>
      </SidebarBody>
    </TooltipProvider>
  )
}
