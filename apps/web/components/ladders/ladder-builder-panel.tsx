"use client"

import React from 'react'
import { X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSportsbookById } from '@/lib/data/sportsbooks'

export interface LadderSelection {
  line: number
  side: 'over' | 'under'
  book: string
  price: number
  id: string
  link?: string | null
}

interface LadderBuilderPanelProps {
  selections: LadderSelection[]
  onRemove: (id: string) => void
  onClear: () => void
  playerName?: string
  market?: string
}

export function LadderBuilderPanel({ selections, onRemove, onClear, playerName, market }: LadderBuilderPanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [totalBankroll, setTotalBankroll] = React.useState<string>('100')
  const [betSizingStrategy, setBetSizingStrategy] = React.useState<'equal' | 'value'>('equal')
  
  const formatPrice = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  
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
      return 100 / (odds + 100)
    } else {
      return -odds / (-odds + 100)
    }
  }
  
  // Calculate potential profit from a bet
  const calculateProfit = (stake: number, odds: number): number => {
    if (odds > 0) {
      return stake * (odds / 100)
    } else {
      return stake * (100 / -odds)
    }
  }
  
  // Calculate bet sizes based on selected strategy
  const calculateBetSizes = (): { [key: string]: number } => {
    const bankroll = parseFloat(totalBankroll) || 0
    if (bankroll <= 0 || selections.length === 0) return {}
    
    const betSizes: { [key: string]: number } = {}
    
    if (betSizingStrategy === 'equal') {
      // Equal distribution
      const equalAmount = bankroll / selections.length
      selections.forEach(sel => {
        betSizes[sel.id] = equalAmount
      })
    } else if (betSizingStrategy === 'value') {
      // Equal payout: Calculate bet sizes so each leg returns the same amount
      // For each selection, calculate the payout multiplier (total return / stake)
      const payoutMultipliers = selections.map(sel => {
        const profit = calculateProfit(1, sel.price)
        return 1 + profit // Total return per $1 bet
      })
      
      // To get equal payout, we need: stake * multiplier = constant
      // So stake should be inversely proportional to multiplier
      const inverseMultipliers = payoutMultipliers.map(m => 1 / m)
      const totalInverse = inverseMultipliers.reduce((sum, inv) => sum + inv, 0)
      
      // Distribute bankroll proportionally to inverse multipliers
      selections.forEach((sel, idx) => {
        betSizes[sel.id] = (inverseMultipliers[idx] / totalInverse) * bankroll
      })
    }
    
    return betSizes
  }
  
  const betSizes = calculateBetSizes()
  const totalAllocated = Object.values(betSizes).reduce((sum, amount) => sum + amount, 0)
  
  const getSportsbookName = (bookId: string) => {
    const book = getSportsbookById(bookId)
    return book?.name || bookId
  }

  const getSportsbookLogo = (bookId: string) => {
    const book = getSportsbookById(bookId)
    return book?.image?.square || book?.image?.light
  }

  const handlePlaceBets = () => {
    console.log('[LadderBuilder] Place Bets clicked')
    console.log('[LadderBuilder] Total selections:', selections.length)
    
    selections.forEach((selection, idx) => {
      console.log(`[LadderBuilder] Selection ${idx + 1}:`, {
        line: selection.line,
        side: selection.side,
        book: selection.book,
        price: selection.price,
        hasLink: !!selection.link,
        link: selection.link
      })
      
      if (selection.link) {
        console.log(`[LadderBuilder] Opening link for ${selection.book}:`, selection.link)
        window.open(selection.link, '_blank')
      } else {
        console.warn(`[LadderBuilder] No link available for selection ${idx + 1}`)
      }
    })
    
    console.log('[LadderBuilder] All tabs opened')
  }

  if (selections.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col overflow-hidden border-t border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900 md:left-auto md:right-4 md:bottom-4 md:w-96 md:rounded-xl md:border md:max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              Ladder Builder ({selections.length})
            </h3>
            {!isCollapsed && playerName && market && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {playerName} • {market}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Clear All
        </button>
      </div>

      {/* Bet Sizing Controls */}
      {!isCollapsed && (
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 space-y-3 shrink-0">
          {/* Bankroll Input */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Total Bankroll ($)
            </label>
            <input
              type="number"
              value={totalBankroll}
              onChange={(e) => setTotalBankroll(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="100"
              min="0"
              step="10"
            />
          </div>

          {/* Bet Sizing Strategy */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Bet Sizing Strategy
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBetSizingStrategy('equal')}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                  betSizingStrategy === 'equal'
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                Equal
              </button>
              <button
                onClick={() => setBetSizingStrategy('value')}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                  betSizingStrategy === 'value'
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                Equal Win
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
              {betSizingStrategy === 'equal' && 'Split bankroll equally across all legs'}
              {betSizingStrategy === 'value' && 'Each leg returns the same payout'}
            </p>
          </div>
        </div>
      )}

      {/* Selections List */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div className="space-y-2">
            {selections.map((selection, idx) => {
              const betAmount = betSizes[selection.id] || 0
              const potentialProfit = calculateProfit(betAmount, selection.price)
              const potentialReturn = betAmount + potentialProfit
              
              return (
                <div
                  key={selection.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
                >
                  {/* Step Number */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {idx + 1}
                  </div>

                  {/* Line & Side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {formatLine(selection.line, selection.side)}
                      </span>
                      <span className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                        selection.side === 'over' 
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {selection.side === 'over' ? 'O' : 'U'} {formatPrice(selection.price)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {getSportsbookLogo(selection.book) && (
                        <img 
                          src={getSportsbookLogo(selection.book)} 
                          alt={getSportsbookName(selection.book)} 
                          className="h-3 w-3 object-contain"
                        />
                      )}
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {getSportsbookName(selection.book)}
                      </span>
                    </div>
                    {/* Bet Amount & Potential Return */}
                    {betAmount > 0 && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                        <span className="font-semibold text-brand">
                          Bet: ${betAmount.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">→</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Win: ${potentialReturn.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemove(selection.id)}
                    className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800 space-y-3 shrink-0">
          {/* Summary Stats */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Total Legs</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{selections.length}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Total Wagered</span>
              <span className="font-semibold text-neutral-900 dark:text-white">${totalAllocated.toFixed(2)}</span>
            </div>
            {selections.length > 0 && totalAllocated > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Potential Returns</span>
                <div className="text-right">
                  {selections.map((sel, idx) => {
                    const betAmount = betSizes[sel.id] || 0
                    const potentialReturn = betAmount + calculateProfit(betAmount, sel.price)
                    return (
                      <div key={sel.id} className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Leg {idx + 1}: ${potentialReturn.toFixed(2)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handlePlaceBets}
            disabled={selections.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="h-4 w-4" />
            Place Bets ({selections.length})
          </button>
          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
            Opens each bet in a new tab
          </p>
        </div>
      )}
    </div>
  )
}

