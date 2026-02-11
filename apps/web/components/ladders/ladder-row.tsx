"use client"

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, BarChart3, Zap, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSportsbookById } from '@/lib/data/sportsbooks'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowTrendUp, ArrowTrendDown } from '@/components/icons'
import { Tooltip } from '@/components/tooltip'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface LadderRowProps {
  line: number
  bestOver?: {
    book: string
    price: number
    link?: string | null
  }
  bestUnder?: {
    book: string
    price: number
    link?: string | null
  }
  avgOver?: number // Average odds for over
  avgUnder?: number // Average odds for under
  allBooks: {
    book: string
    over?: { price: number; link?: string | null }
    under?: { price: number; link?: string | null }
  }[]
  isEven: boolean
  onAddToBuilder: (line: number, side: 'over' | 'under', book: string, price: number, link?: string | null) => void
  sideFilter: 'over' | 'under'
  nextLineOdds?: number // Odds for the next line (for % difference calculation)
  isBestValue?: boolean // Whether this line has the best avg-to-best boost
  isPrimaryLine?: boolean // Whether this is the primary/main line
  marketName?: string // Display name for the market (e.g., "Rushing Yards")
}

export function LadderRow({ line, bestOver, bestUnder, avgOver, avgUnder, allBooks, isEven, onAddToBuilder, sideFilter, nextLineOdds, isBestValue, isPrimaryLine, marketName }: LadderRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [showBookPicker, setShowBookPicker] = useState(false)
  const [booksWithBestOdds, setBooksWithBestOdds] = useState<Array<{ book: string; price: number; link?: string | null }>>([])
  
  const formatPrice = (n?: number) => (n == null ? "" : n > 0 ? `+${n}` : `${n}`)
  
  // Format line number: for "over", round up and add "+" (e.g., 1.5 → 2+, 2.5 → 3+)
  const formatLine = (lineNum: number, side: 'over' | 'under'): string => {
    if (side === 'over') {
      return `${Math.ceil(lineNum)}+`;
    }
    return lineNum.toString();
  }
  
  // Calculate implied probability from American odds
  const getImpliedProbability = (odds: number): number => {
    if (odds > 0) {
      // Underdog: 100 / (odds + 100)
      return 100 / (odds + 100)
    } else {
      // Favorite: -odds / (-odds + 100)
      return -odds / (-odds + 100)
    }
  }
  
  // Convert decimal to percentage string
  const formatProbability = (prob: number): string => {
    return `${(prob * 100).toFixed(0)}%`
  }
  
  // Get probability color based on hit percentage (using global --accent for green)
  const getProbabilityColor = (prob: number): string => {
    const percentage = prob * 100
    
    if (percentage >= 65) {
      // Use global accent color (emerald)
      return 'text-[var(--accent-strong)] dark:text-[var(--accent)]'
    } else if (percentage >= 50) {
      return 'text-amber-600 dark:text-amber-400'
    } else if (percentage >= 30) {
      return 'text-orange-600 dark:text-orange-400'
    } else {
      return 'text-red-600 dark:text-red-400'
    }
  }
  
  // Get left border color for trend line (using global --accent for green)
  const getTrendLineColor = (prob: number): string => {
    const percentage = prob * 100
    
    if (percentage >= 65) {
      // Use global accent color (emerald) via inline style
      return 'border-l-[var(--accent-strong)]'
    } else if (percentage >= 50) {
      return 'border-l-amber-500'
    } else if (percentage >= 30) {
      return 'border-l-orange-500'
    } else {
      return 'border-l-red-500'
    }
  }
  
  // Calculate payout jump with ROI multiplier
  const getPayoutJump = (currentOdds: number, nextOdds: number): {
    percentage: string
    multiplier: number
    isExceptional: boolean
    tier: 'low' | 'medium' | 'high' | 'exceptional'
  } | null => {
    if (!nextOdds) return null
    
    // Calculate potential profit for $100 bet
    const currentProfit = currentOdds > 0 ? currentOdds : (100 / -currentOdds) * 100
    const nextProfit = nextOdds > 0 ? nextOdds : (100 / -nextOdds) * 100
    
    const percentChange = ((nextProfit - currentProfit) / currentProfit) * 100
    const multiplier = nextProfit / currentProfit
    
    // Tier system for color-coding
    let tier: 'low' | 'medium' | 'high' | 'exceptional';
    if (multiplier >= 2.0) {
      tier = 'exceptional'; // 2x+ (bold green/orange)
    } else if (multiplier >= 1.6) {
      tier = 'high'; // 1.6x-2x (green)
    } else if (multiplier >= 1.3) {
      tier = 'medium'; // 1.3x-1.6x (light green)
    } else {
      tier = 'low'; // <1.3x (neutral)
    }
    
    // Exceptional jump: >100% increase (2x or more)
    const isExceptional = multiplier >= 2.0
    
    const percentage = percentChange > 0 ? `+${percentChange.toFixed(0)}%` : `${percentChange.toFixed(0)}%`
    
    return {
      percentage,
      multiplier,
      isExceptional,
      tier
    }
  }
  
  // Convert American odds to decimal odds
  const americanToDecimal = (american: number): number => {
    if (american > 0) {
      return (american / 100) + 1;
    } else {
      return (100 / Math.abs(american)) + 1;
    }
  }
  
  // Calculate value using profit uplift (more intuitive for bettors)
  const getValue = (bestOdds: number, avgOdds: number): {
    valuePercentage: string
    isSignificant: boolean
  } | null => {
    if (!avgOdds) return null
    
    // Convert American odds to decimal odds
    const decBest = americanToDecimal(bestOdds);
    const decAvg = americanToDecimal(avgOdds);
    
    // Calculate profit per $1 staked (decimal odds - 1)
    const profitBest = decBest - 1;
    const profitAvg = decAvg - 1;
    
    // Value = profit uplift percentage
    // e.g., +108 vs -106:
    //   decBest = 2.08, profitBest = 1.08
    //   decAvg = 1.943, profitAvg = 0.943
    //   value = (1.08 / 0.943 - 1) * 100 = 14.5%
    const value = ((profitBest / profitAvg) - 1) * 100;
    
    // Significant value: >5% improvement
    const isSignificant = value >= 5;
    
    const valuePercentage = `${value.toFixed(1)}%`;
    
    return {
      valuePercentage,
      isSignificant
    }
  }
  
  // Determine which side to show based on filter
  const bestOdds = sideFilter === 'over' ? bestOver : bestUnder
  const avgOdds = sideFilter === 'over' ? avgOver : avgUnder
  const side = sideFilter
  
  // Find all books that have the same best odds
  const allBooksWithBestOdds = React.useMemo(() => {
    if (!bestOdds) return []
    
    const books: Array<{ book: string; price: number; link?: string | null }> = []
    
    allBooks.forEach(bookEntry => {
      const odds = side === 'over' ? bookEntry.over : bookEntry.under
      if (odds && odds.price === bestOdds.price) {
        books.push({
          book: bookEntry.book,
          price: odds.price,
          link: odds.link
        })
      }
    })
    
    return books
  }, [bestOdds, allBooks, side])
  
  // Calculate metrics for current line
  const impliedProb = bestOdds?.price ? getImpliedProbability(bestOdds.price) : null
  const payoutJump = bestOdds?.price && nextLineOdds ? getPayoutJump(bestOdds.price, nextLineOdds) : null
  const value = bestOdds?.price && avgOdds ? getValue(bestOdds.price, avgOdds) : null
  const probabilityColor = impliedProb ? getProbabilityColor(impliedProb) : 'text-neutral-500'
  const trendLineColor = impliedProb ? getTrendLineColor(impliedProb) : 'border-l-neutral-300'
  
  // Count additional books beyond the best one for the selected side
  const additionalBooks = allBooks.filter(b => {
    const hasOdds = side === 'over' ? b.over : b.under
    return hasOdds && b.book !== bestOdds?.book
  }).length

  const getSportsbookName = (bookId: string) => {
    const book = getSportsbookById(bookId)
    return book?.name || bookId
  }

  const getSportsbookLogo = (bookId: string) => {
    const book = getSportsbookById(bookId)
    return book?.image?.square || book?.image?.light
  }

  return (
    <div className={cn(
      "relative",
      isEven && "bg-neutral-50/30 dark:bg-neutral-900/30"
    )}>
      {/* Ladder Rung Container (no side borders - handled by parent) */}
      <div className="relative">
        {/* Main Rung - Horizontal Line with Overlapping Content */}
        <div className="relative">
          {/* Horizontal Rung Line - extends fully across */}
          <div 
            className={cn(
              "absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2",
              isPrimaryLine 
                ? "border-brand/40" 
                : isBestValue 
                ? "border-[var(--tertiary)]/40" 
                : "border-neutral-300 dark:border-neutral-700"
            )}
          />
          
          {/* Content Grid - Overlapping the Rung */}
          <div className="relative z-10 grid grid-cols-3 items-center gap-1 py-6 px-4 sm:px-6">
            {/* Left Side - Best & Avg Odds (very close to center) */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 px-2 py-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Best:
                </span>
                {/* Show all sportsbook logos that have the best odds */}
                {allBooksWithBestOdds.length > 0 && (
                  <div className="flex items-center -space-x-1">
                    {allBooksWithBestOdds.slice(0, 3).map((bookOdds, idx) => {
                      const logo = getSportsbookLogo(bookOdds.book)
                      if (!logo) return null
                      return (
                        <img 
                          key={bookOdds.book}
                          src={logo} 
                          alt={getSportsbookName(bookOdds.book)} 
                          className="h-5 w-5 object-contain ring-1 ring-white dark:ring-neutral-900 rounded-sm"
                          style={{ zIndex: 3 - idx }}
                        />
                      )
                    })}
                    {allBooksWithBestOdds.length > 3 && (
                      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 ml-1">
                        +{allBooksWithBestOdds.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (bestOdds?.link) window.open(bestOdds.link, '_blank')
                  }}
                  className={cn(
                    "text-sm font-bold transition-all",
                    bestOdds?.link && "cursor-pointer hover:opacity-80"
                  )}
                  style={
                    side === 'over'
                      ? { color: 'var(--accent-strong)' }
                      : { color: 'var(--color-loss-dark)' }
                  }
                >
                  {bestOdds ? formatPrice(bestOdds.price) : '—'}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 px-2 py-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Avg:
                </span>
                <span className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
                  {avgOdds ? formatPrice(avgOdds) : '—'}
                </span>
              </div>
            </div>

            {/* Center - Line Number inline on the horizontal line, with content below */}
            <div className="relative flex flex-col items-center gap-2">
              {/* Inline pill centered on the rung line */}
              <div
                className={cn(
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10",
                  "px-3 py-0.5 rounded-full border font-bold text-sm", 
                  isPrimaryLine
                    ? "bg-brand text-white border-brand shadow-brand/20"
                    : isBestValue
                    ? "text-white border-[var(--tertiary)]"
                    : "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border-neutral-300 dark:border-neutral-700"
                )}
                style={isBestValue && !isPrimaryLine ? { background: 'var(--tertiary)' } : undefined}
              >
                {formatLine(line, side)}
              </div>

              {/* spacer so content below clears the inline pill */}
              <div className="h-16" />

              {bestOdds && (
                <button
                  onClick={() => {
                    // If multiple books have the same best odds, show picker
                    if (allBooksWithBestOdds.length > 1) {
                      setBooksWithBestOdds(allBooksWithBestOdds)
                      setShowBookPicker(true)
                    } else {
                      onAddToBuilder(line, side, bestOdds.book, bestOdds.price, bestOdds.link)
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand/90 transition-all shadow-sm"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Add to Builder</span>
                </button>
              )}
            </div>

            {/* Right Side - Value & Step Gain (very close to center) */}
            <div className="flex flex-col items-start gap-1">
              {value && (
                <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 px-2 py-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Value:
                  </span>
                  <span 
                    className={cn(
                      "text-sm font-bold",
                      value.isSignificant
                        ? "text-[var(--accent-strong)] dark:text-[var(--accent)]"
                        : "text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    +{value.valuePercentage}
                  </span>
                </div>
              )}
              {payoutJump && (
                <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 px-2 py-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Step:
                  </span>
                  <span 
                    className={cn(
                      "inline-flex items-center gap-0.5 text-sm font-bold",
                      payoutJump.tier === 'exceptional' && "text-orange-700 dark:text-orange-300",
                      payoutJump.tier === 'high' && "text-[var(--accent-strong)] dark:text-[var(--accent)]",
                      payoutJump.tier === 'medium' && "text-emerald-700 dark:text-emerald-400",
                      payoutJump.tier === 'low' && "text-neutral-600 dark:text-neutral-400"
                    )}
                  >
                    {payoutJump.percentage.startsWith('+') ? (
                      <ArrowTrendUp className="h-3 w-3" />
                    ) : (
                      <ArrowTrendDown className="h-3 w-3" />
                    )}
                    <span>{payoutJump.multiplier.toFixed(1)}x</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* View All Books Toggle */}
        {bestOdds && additionalBooks > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-brand hover:text-brand/80 transition-colors py-2"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Hide all lines</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>View all lines ({allBooks.length})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Expanded View - All Books Dropdown */}
        <AnimatePresence>
          {expanded && additionalBooks > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-neutral-200 dark:border-neutral-700 px-4 pt-3 pb-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
                All Sportsbooks (Best → Worst)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allBooks
                  .filter(b => side === 'over' ? b.over : b.under)
                  .sort((a, b) => {
                    // Sort by odds - higher is better for both over and under
                    const aOdds = side === 'over' ? a.over?.price : a.under?.price;
                    const bOdds = side === 'over' ? b.over?.price : b.under?.price;
                    if (aOdds == null) return 1;
                    if (bOdds == null) return -1;
                    return bOdds - aOdds; // Descending order (best first)
                  })
                  .map((bookData) => {
                    const odds = side === 'over' ? bookData.over : bookData.under
                    if (!odds) return null
                    
                    return (
                      <div 
                        key={bookData.book} 
                        className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-2.5 hover:border-brand/30 transition-colors"
                      >
                        {/* Book Logo & Name */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getSportsbookLogo(bookData.book) && (
                            <img 
                              src={getSportsbookLogo(bookData.book)} 
                              alt={getSportsbookName(bookData.book)} 
                              className="h-5 w-5 shrink-0 object-contain"
                            />
                          )}
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                            {getSportsbookName(bookData.book)}
                          </span>
                        </div>

                        {/* Odds & Add */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              if (odds.link) window.open(odds.link, '_blank')
                            }}
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-1 text-xs font-bold transition-all text-white",
                              odds.link && "cursor-pointer hover:shadow-sm"
                            )}
                            style={
                              side === 'over'
                                ? { backgroundColor: 'var(--accent-strong)' }
                                : { backgroundColor: 'var(--color-loss-dark)' }
                            }
                            onMouseEnter={(e) => {
                              if (side === 'over') {
                                e.currentTarget.style.backgroundColor = 'var(--accent)'
                              } else {
                                e.currentTarget.style.backgroundColor = 'var(--color-loss)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (side === 'over') {
                                e.currentTarget.style.backgroundColor = 'var(--accent-strong)'
                              } else {
                                e.currentTarget.style.backgroundColor = 'var(--color-loss-dark)'
                              }
                            }}
                          >
                            {formatPrice(odds.price)}
                          </button>
                          <button
                            onClick={() => {
                              onAddToBuilder(line, side, bookData.book, odds.price, odds.link)
                            }}
                            className="flex items-center justify-center rounded-md bg-brand/10 p-1.5 text-brand hover:bg-brand/20 transition-colors"
                            title="Add to ladder"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Book Picker Dialog */}
      <Dialog open={showBookPicker} onOpenChange={setShowBookPicker}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md border-[var(--tertiary)]/20 bg-white p-0 shadow-xl dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
          <DialogTitle className="sr-only">Choose Your Sportsbook</DialogTitle>
          <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white">Choose Your Sportsbook</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                Multiple books offer the same best odds ({formatPrice(bestOdds?.price)}). Select your preferred sportsbook:
              </p>
            </div>

            {/* Sportsbook Options */}
            <div className="space-y-2 sm:space-y-2.5 max-h-[60vh] overflow-y-auto">
              {booksWithBestOdds.map((bookOdds) => {
                const logo = getSportsbookLogo(bookOdds.book)
                const name = getSportsbookName(bookOdds.book)
                return (
                  <button
                    key={bookOdds.book}
                    onClick={() => {
                      onAddToBuilder(line, side, bookOdds.book, bookOdds.price, bookOdds.link)
                      setShowBookPicker(false)
                    }}
                    className="group flex w-full items-center gap-3 sm:gap-4 rounded-lg border border-neutral-200 bg-white p-3 sm:p-4 transition-all hover:border-brand hover:bg-brand/5 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-brand dark:hover:bg-brand/10"
                  >
                    {logo && (
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white p-1.5 sm:p-2 dark:border-neutral-700 dark:bg-neutral-800">
                        <img 
                          src={logo} 
                          alt={name} 
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-white truncate">{name}</div>
                      <div className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        {formatPrice(bookOdds.price)}
                      </div>
                    </div>
                    <div className="shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setShowBookPicker(false)}
              className="mt-3 sm:mt-4 w-full rounded-lg px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

