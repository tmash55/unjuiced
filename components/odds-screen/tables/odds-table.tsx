'use client'

import React, { useState, useMemo, useEffect, useCallback, memo, useRef,} from 'react'
import { ChevronUp, ChevronDown, GripVertical, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Import standardized types
import type { OddsScreenItem, TableInteractionHandlers, OddsPrice } from '@/components/odds-screen/types/odds-screen-types'
import { getSportsbookById, getAllActiveSportsbooks, type SportsbookMeta } from '@/lib/data/sportsbooks'
import { getStandardAbbreviation } from '@/lib/data/team-mappings'
import { useOddsPreferences } from '@/context/preferences-context'
import { Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider } from '@/components/tooltip'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { OddsTableSkeleton } from './odds-table-skeleton'
import { createColumnHelper, flexRender } from '@tanstack/react-table'
import { Table, useTable } from '@/components/table'
import { cn } from '@/lib/utils'
import { useSSE } from '@/hooks/use-sse'
import { useAuth } from '@/components/auth/auth-provider'
import { useIsPro } from '@/hooks/use-entitlements'
import { ExpandableRowWrapper, ExpandButton } from './expandable-row-wrapper'
import { ProGateModal } from '../pro-gate-modal'

interface AlternateRowData {
  key: string
  lineValue: number
  lineLabel: string
  books: Record<string, { over?: OddsPrice; under?: OddsPrice }>
  best: {
    over?: OddsPrice
    under?: OddsPrice
  }
}

// Memoized sportsbook odds cell button to minimize re-renders on live updates
const OddsCellButton = React.memo(function OddsCellButton(props: {
  itemId: string
  sportsbookId: string
  sportsbookName: string
  side: 'over' | 'under'
  odds: { line: number; price: number; link?: string | null }
  isHighlighted: boolean
  priceChanged: boolean
  lineChanged: boolean
  isPositiveChange: boolean
  isNegativeChange: boolean
  isMoneyline: boolean
  onClick: (e: React.MouseEvent) => void
  // Pass in formatters to avoid referencing outer scope (keeps memo stable)
  formatOdds: (price: number) => string
  formatLine: (line: number, side: 'over' | 'under') => string
}) {
  const { sportsbookName, side, odds, isHighlighted, priceChanged, lineChanged, isPositiveChange, isNegativeChange, isMoneyline, onClick, formatOdds, formatLine } = props
  return (
    <Tooltip content={`Place bet on ${sportsbookName}`}>
        <button
          onClick={onClick}
          className={cn(
            'sportsbook-cell sportsbook-cell--sm block w-full mx-auto cursor-pointer font-medium',
            isHighlighted && 'sportsbook-cell--highlighted',
            // Match player-props behavior: flash when either price or line changes
            (priceChanged || lineChanged) && (isPositiveChange ? 'animate-odds-flash-positive' : 'animate-odds-flash-negative')
          )}
        >
          <div className="text-center">
            {isMoneyline ? (
              // Moneylines: Show only the odds, no line/team label
                <div className="text-sm font-semibold">
                  <span
                    className={cn(
                      priceChanged && (isPositiveChange ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'),
                      'transition-colors'
                    )}
                  >
                    {formatOdds(odds.price)}
                  </span>
                </div>
            ) : (
              // Other markets: Show line and odds
              <div className="text-xs font-medium">
                <span className={`opacity-75 ${lineChanged ? 'animate-odds-flash-line px-1 rounded' : ''}`}>{formatLine(odds.line, side)}</span>
                <span
                  className={cn(
                    'ml-1 font-semibold transition-colors',
                    priceChanged && (isPositiveChange ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400')
                  )}
                >
                  {formatOdds(odds.price)}
                </span>
              </div>
            )}
          </div>
        </button>
    </Tooltip>
  )
}, (prev, next) => {
  // Compare only meaningful primitives; ignore function identity
  return (
    prev.itemId === next.itemId &&
    prev.sportsbookId === next.sportsbookId &&
    prev.side === next.side &&
    prev.odds.price === next.odds.price &&
    prev.odds.line === next.odds.line &&
    prev.isPositiveChange === next.isPositiveChange &&
    prev.isNegativeChange === next.isNegativeChange &&
    prev.isHighlighted === next.isHighlighted &&
    prev.priceChanged === next.priceChanged &&
    prev.lineChanged === next.lineChanged &&
    prev.isMoneyline === next.isMoneyline
  )
})

const mergeBookIds = (existing?: string, next?: string): string | undefined => {
  const parts = [
    ...(existing ? existing.split(',').map((id) => id.trim()).filter(Boolean) : []),
    ...(next ? [next.trim()] : []),
  ]
  if (parts.length === 0) return existing
  const unique = Array.from(new Set(parts))
  return unique.join(', ')
}

const isBetterPrice = (candidate: number, current: number) => {
  if (Number.isNaN(candidate)) return false
  if (Number.isNaN(current)) return true
  return candidate > current
}

// Helper to determine if one odds option is better than another
const isBetterOdds = (
  candidate: { price: number; line?: number },
  current: { price: number; line?: number },
  side: 'over' | 'under',
  isMoneyline: boolean
): boolean => {
  if (Number.isNaN(candidate.price)) return false
  if (Number.isNaN(current.price)) return true
  
  // For moneylines, only price matters
  if (isMoneyline) {
    return isBetterPrice(candidate.price, current.price)
  }
  
  // For over/under markets, line value is primary, price is tiebreaker
  const candidateLine = candidate.line ?? 0
  const currentLine = current.line ?? 0
  
  if (side === 'over') {
    // Lower line is better for overs
    if (candidateLine < currentLine) return true
    if (candidateLine > currentLine) return false
    // Same line, check price
    return isBetterPrice(candidate.price, current.price)
  } else {
    // Higher line is better for unders
    if (candidateLine > currentLine) return true
    if (candidateLine < currentLine) return false
    // Same line, check price
    return isBetterPrice(candidate.price, current.price)
  }
}

// Helper functions for proper odds mathematics
const americanOddsToImpliedProbability = (odds: number): number => {
  if (odds > 0) {
    return 100 / (odds + 100)
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

const impliedProbabilityToAmericanOdds = (probability: number): number => {
  if (probability >= 0.5) {
    return Math.round(-(probability / (1 - probability)) * 100)
  } else {
    return Math.round(((1 - probability) / probability) * 100)
  }
}

// Helper to calculate average odds from user's selected sportsbooks
const calculateUserAverageOdds = (
  item: OddsTableItem,
  side: 'over' | 'under', 
  visibleSportsbooks?: string[]
): { userAverage: OddsPrice | null; globalAverage: OddsPrice | null; sampleSize: number } => {
  // Defensive programming: ensure we have valid inputs
  if (!item?.odds?.books || !side) {
    return { userAverage: null, globalAverage: null, sampleSize: 0 }
  }

  const allBooks = Object.entries(item.odds.books)
  const safeSportsbooks = Array.isArray(visibleSportsbooks) ? visibleSportsbooks : []
  
  // Get user's selected sportsbooks odds
  const userBooks = allBooks
    .filter(([bookId]) => safeSportsbooks.length === 0 || safeSportsbooks.includes(bookId))
    .map(([bookId, bookData]) => ({ bookId, odds: bookData?.[side] }))
    .filter(book => book.odds?.price !== undefined && !Number.isNaN(book.odds.price))

  // Calculate user average using proper odds mathematics
  let userAverage: OddsPrice | null = null
  if (userBooks.length > 0) {
    // Convert American odds to implied probabilities, average them, then convert back
    const avgProbability = userBooks.reduce((sum, book) => {
      return sum + americanOddsToImpliedProbability(book.odds!.price)
    }, 0) / userBooks.length
    
    const avgPrice = impliedProbabilityToAmericanOdds(avgProbability)
    const avgLine = userBooks.reduce((sum, book) => sum + (book.odds!.line ?? 0), 0) / userBooks.length
    
    userAverage = {
      price: avgPrice,
      line: Math.round(avgLine * 10) / 10, // Round to 1 decimal
      book: 'Average',
      link: undefined
    }
  }

  // Calculate global average from all sportsbooks using proper odds mathematics
  const allAvailableBooks = allBooks
    .map(([bookId, bookData]) => ({ bookId, odds: bookData?.[side] }))
    .filter(book => book.odds?.price !== undefined && !Number.isNaN(book.odds.price))

  let globalAverage: OddsPrice | null = null
  if (allAvailableBooks.length > 0) {
    // Convert American odds to implied probabilities, average them, then convert back
    const avgProbability = allAvailableBooks.reduce((sum, book) => {
      return sum + americanOddsToImpliedProbability(book.odds!.price)
    }, 0) / allAvailableBooks.length
    
    const avgPrice = impliedProbabilityToAmericanOdds(avgProbability)
    const avgLine = allAvailableBooks.reduce((sum, book) => sum + (book.odds!.line ?? 0), 0) / allAvailableBooks.length
    
    globalAverage = {
      price: avgPrice,
      line: Math.round(avgLine * 10) / 10, // Round to 1 decimal
      book: 'Average',
      link: undefined
    }
  }

  return { 
    userAverage, 
    globalAverage, 
    sampleSize: userBooks.length 
  }
}

// Helper to calculate best odds from user's selected sportsbooks
const calculateUserBestOdds = (
  item: OddsTableItem, 
  side: 'over' | 'under',
  visibleSportsbooks?: string[]
): { userBest: OddsPrice | null; hasGlobalBetter: boolean; globalBest: OddsPrice | null } => {
  // Defensive programming: ensure we have valid inputs
  if (!item?.odds?.books || !side) {
    return { userBest: null, hasGlobalBetter: false, globalBest: null }
  }
  
  const isMoneyline = item.entity.type === 'game' && (
    item.entity.details === 'Moneyline' ||
    (((item.odds?.best?.over?.line ?? 0) === 0) && ((item.odds?.best?.under?.line ?? 0) === 0))
  )
  const allBooks = Object.entries(item.odds.books)
  const safeSportsbooks = Array.isArray(visibleSportsbooks) ? visibleSportsbooks : []
  
  const availableBooks = allBooks
    .filter(([bookId]) => safeSportsbooks.length === 0 || safeSportsbooks.includes(bookId))
    .map(([bookId, bookData]) => ({ bookId, odds: bookData?.[side] }))
    .filter(book => book.odds?.price !== undefined && !Number.isNaN(book.odds.price))
  
  // Calculate best from user's sportsbooks and find ALL books with same best odds
  let userBest: OddsPrice | null = null
  if (availableBooks.length > 0) {
    const bestUserBook = availableBooks.reduce((best, current) => 
      isBetterOdds(current.odds!, best.odds!, side, isMoneyline) ? current : best
    )
    
    // Find all books that have the same best odds/line
    const bestPrice = bestUserBook.odds!.price
    const bestLine = bestUserBook.odds!.line
    const allBestBooks = availableBooks.filter(book => 
      book.odds!.price === bestPrice && book.odds!.line === bestLine
    )
    
    userBest = {
      price: bestPrice,
      line: bestLine,
      book: allBestBooks.map(b => b.bookId).join(', '), // Join all book IDs
      link: bestUserBook.odds!.link ?? undefined // Use first link for clickthrough
    }
  }
  
  // Calculate global best from all sportsbooks and find ALL books with same best odds
  const allAvailableBooks = allBooks
    .map(([bookId, bookData]) => ({ bookId, odds: bookData[side] }))
    .filter(book => book.odds?.price !== undefined)
  
  let globalBest: OddsPrice | null = null
  if (allAvailableBooks.length > 0) {
    const bestGlobalBook = allAvailableBooks.reduce((best, current) => 
      isBetterOdds(current.odds!, best.odds!, side, isMoneyline) ? current : best
    )
    
    // Find all books that have the same best odds/line
    const bestPrice = bestGlobalBook.odds!.price
    const bestLine = bestGlobalBook.odds!.line
    const allBestBooks = allAvailableBooks.filter(book => 
      book.odds!.price === bestPrice && book.odds!.line === bestLine
    )
    
    globalBest = {
      price: bestPrice,
      line: bestLine,
      book: allBestBooks.map(b => b.bookId).join(', '), // Join all book IDs
      link: bestGlobalBook.odds!.link ?? undefined // Use first link for clickthrough
    }
  }
  
  // Check if there's a better global option than user's best
  const hasGlobalBetter = !!(userBest && globalBest && 
    isBetterOdds(globalBest, userBest, side, isMoneyline))
  
  return { userBest, hasGlobalBetter, globalBest }
}

// Helper to fill missing over/under sides from alternate data
const fillMissingSides = (
  item: OddsTableItem,
  alternateData: any,
  type: 'player' | 'game'
): OddsTableItem => {
  if (!alternateData || !item.odds.books) return item

  // Get the primary line value for this item
  const primaryLine = item.odds.best?.over?.line || item.odds.best?.under?.line
  if (!primaryLine) return item

  const updatedBooks = { ...item.odds.books }
  let hasUpdates = false

  // Extract alternate lines for the matching primary line value
  let alternateLines: any = null
  if (type === 'player' && item.entity.id) {
    alternateLines = alternateData.players?.[item.entity.id]?.lines?.[primaryLine.toString()]
  } else if (type === 'game') {
    alternateLines = alternateData.lines?.[primaryLine.toString()]?.books
  }

  if (!alternateLines) return item

  // For each sportsbook in primary data, check if we can fill missing sides
  Object.entries(updatedBooks).forEach(([bookId, bookData]) => {
    const bookOdds = bookData as any
    const altBookData = alternateLines[bookId]
    
    if (!altBookData) return

    // Check if we're missing over and alternates have it
    if (!bookOdds.over && (altBookData.over || altBookData.away)) {
      const overData = altBookData.over || altBookData.away
      if (overData && typeof overData.price === 'number') {
        bookOdds.over = {
          price: overData.price,
          line: overData.line ?? primaryLine,
          link: overData.links?.mobile || overData.links?.desktop || null
        }
        hasUpdates = true
      }
    }

    // Check if we're missing under and alternates have it
    if (!bookOdds.under && (altBookData.under || altBookData.home)) {
      const underData = altBookData.under || altBookData.home
      if (underData && typeof underData.price === 'number') {
        bookOdds.under = {
          price: underData.price,
          line: underData.line ?? primaryLine,
          link: underData.links?.mobile || underData.links?.desktop || null
        }
        hasUpdates = true
      }
    }
  })

  // If we made updates, return new item, otherwise return original
  return hasUpdates ? { ...item, odds: { ...item.odds, books: updatedBooks } } : item
}

// Helper to fill missing entire book entries by choosing the book's nearest line to the primary
const fillMissingBooksFromAlternates = (
  item: OddsTableItem,
  alternateRows: Record<string, AlternateRowData[]> | null | undefined
): OddsTableItem => {
  if (!alternateRows || !item?.odds) return item

  const primaryLine = item.odds.best?.over?.line ?? item.odds.best?.under?.line ?? undefined
  const currentBooks = new Set(Object.keys(item.odds.books || {}))

  // Build a map bookId -> nearest odds (by abs(line - primaryLine))
  const nearestByBook: Record<string, { over?: OddsPrice; under?: OddsPrice }> = {}

  const scanRows = (rows: AlternateRowData[]) => {
    if (!Array.isArray(rows)) return
    rows.forEach((row) => {
      const lineVal = row.lineValue
      Object.entries(row.books || {}).forEach(([bookId, odds]) => {
        // If we already have primary data for this book, skip
        if (currentBooks.has(bookId)) return
        const prev = nearestByBook[bookId]
        // Choose nearest by absolute distance to primary; if no primary, just take the first encountered
        const prevDist = prev && primaryLine != null ? Math.abs((prev.over?.line ?? prev.under?.line ?? primaryLine) - primaryLine) : Infinity
        const curDist = primaryLine != null ? Math.abs((odds.over?.line ?? odds.under?.line ?? lineVal) - primaryLine) : 0
        if (!prev || curDist < prevDist) {
          nearestByBook[bookId] = {
            over: odds.over ? { ...odds.over, line: odds.over.line ?? lineVal } : undefined,
            under: odds.under ? { ...odds.under, line: odds.under.line ?? lineVal } : undefined,
          }
        }
      })
    })
  }

  // Player alternates keyed by playerId, game alternates under 'game'
  const eventId = item.event.id
  const entityKey = item.entity.id || 'game'
  const rows = alternateRows?.[entityKey] || []
  scanRows(rows)

  if (Object.keys(nearestByBook).length === 0) return item

  const mergedBooks = { ...(item.odds.books || {}) }
  Object.entries(nearestByBook).forEach(([bookId, odds]) => {
    if (!mergedBooks[bookId]) mergedBooks[bookId] = {}
    if (!mergedBooks[bookId].over && odds.over) mergedBooks[bookId].over = odds.over
    if (!mergedBooks[bookId].under && odds.under) mergedBooks[bookId].under = odds.under
  })

  return { ...item, odds: { ...item.odds, books: mergedBooks } }
}

const formatLineLabel = (value: number) => {
  if (Number.isNaN(value)) return ''
  const isInt = Number.isInteger(value)
  return isInt ? value.toFixed(0) : value.toFixed(1)
}

const resolveBookOdds = (books: Record<string, any> | undefined, sportsbookId: string) => {
  if (!books) return undefined
  return (
    books[sportsbookId] ??
    books[sportsbookId.replace(/-/g, '_')] ??
    books[sportsbookId.replace(/_/g, '-')] ??
    books[sportsbookId.toLowerCase()] ??
    books[sportsbookId.toUpperCase()]
  )
}

const parsePlayerAlternateRows = (data: any, playerId?: string): AlternateRowData[] => {
  if (!data || !playerId) return []
  const playerData = data.players?.[playerId]
  if (!playerData?.lines) return []

  const rows: AlternateRowData[] = []

  Object.entries<any>(playerData.lines).forEach(([lineKey, books]) => {
    const numericLine = Number(lineKey)
    const resolvedLine = Number.isNaN(numericLine) ? parseFloat(String(lineKey)) : numericLine

    const rowBooks: Record<string, { over?: OddsPrice; under?: OddsPrice }> = {}
    let bestOver: OddsPrice | undefined
    let bestUnder: OddsPrice | undefined

    Object.entries<any>(books ?? {}).forEach(([bookId, bookData]) => {
      const entry: { over?: OddsPrice; under?: OddsPrice } = {}

      const overData = bookData?.over
      if (overData && typeof overData.price === 'number') {
        const odds: OddsPrice = {
          price: overData.price,
          line: overData.line ?? resolvedLine,
          book: bookId,
          link: overData.links?.mobile ?? overData.links?.desktop ?? null,
        }
        entry.over = odds

        if (!bestOver || isBetterPrice(odds.price, bestOver.price)) {
          bestOver = { ...odds }
        } else if (bestOver && odds.price === bestOver.price) {
          bestOver = { ...bestOver, book: mergeBookIds(bestOver.book, odds.book) }
        }
      }

      const underData = bookData?.under
      if (underData && typeof underData.price === 'number') {
        const odds: OddsPrice = {
          price: underData.price,
          line: underData.line ?? resolvedLine,
          book: bookId,
          link: underData.links?.mobile ?? underData.links?.desktop ?? null,
        }
        entry.under = odds

        if (!bestUnder || isBetterPrice(odds.price, bestUnder.price)) {
          bestUnder = { ...odds }
        } else if (bestUnder && odds.price === bestUnder.price) {
          bestUnder = { ...bestUnder, book: mergeBookIds(bestUnder.book, odds.book) }
        }
      }

      if (entry.over || entry.under) {
        rowBooks[bookId] = entry
      }
    })

    rows.push({
      key: `${playerId}-${lineKey}`,
      lineValue: resolvedLine,
      lineLabel: formatLineLabel(resolvedLine),
      books: rowBooks,
      best: {
        over: bestOver,
        under: bestUnder,
      },
    })
  })

  return rows.sort((a, b) => a.lineValue - b.lineValue)
}

const parseGameAlternateRows = (data: any, eventId: string): AlternateRowData[] => {
  if (!data || !data.lines) return []

  const rows: AlternateRowData[] = []

  Object.entries<any>(data.lines).forEach(([lineKey, books]) => {
    const numericLine = Number(lineKey)
    const resolvedLine = Number.isNaN(numericLine) ? parseFloat(String(lineKey)) : numericLine

    const rowBooks: Record<string, { over?: OddsPrice; under?: OddsPrice }> = {}
    let bestOver: OddsPrice | undefined
    let bestUnder: OddsPrice | undefined

    Object.entries<any>(books ?? {}).forEach(([bookId, bookData]) => {
      const entry: { over?: OddsPrice; under?: OddsPrice } = {}

      // For game alternates, check both over/under and home/away structures
      const overData = bookData?.over || bookData?.away
      if (overData && typeof overData.price === 'number') {
        const odds: OddsPrice = {
          price: overData.price,
          line: overData.line ?? resolvedLine,
          book: bookId,
          link: overData.links?.mobile ?? overData.links?.desktop ?? null,
        }
        entry.over = odds

        if (!bestOver || isBetterPrice(odds.price, bestOver.price)) {
          bestOver = { ...odds }
        } else if (bestOver && odds.price === bestOver.price) {
          bestOver = { ...bestOver, book: mergeBookIds(bestOver.book, odds.book) }
        }
      }

      const underData = bookData?.under || bookData?.home
      if (underData && typeof underData.price === 'number') {
        const odds: OddsPrice = {
          price: underData.price,
          line: underData.line ?? resolvedLine,
          book: bookId,
          link: underData.links?.mobile ?? underData.links?.desktop ?? null,
        }
        entry.under = odds

        if (!bestUnder || isBetterPrice(odds.price, bestUnder.price)) {
          bestUnder = { ...odds }
        } else if (bestUnder && odds.price === bestUnder.price) {
          bestUnder = { ...bestUnder, book: mergeBookIds(bestUnder.book, odds.book) }
        }
      }

      if (entry.over || entry.under) {
        rowBooks[bookId] = entry
      }
    })

    rows.push({
      key: `${eventId}-game-${lineKey}`,
      lineValue: resolvedLine,
      lineLabel: formatLineLabel(resolvedLine),
      books: rowBooks,
      best: {
        over: bestOver,
        under: bestUnder,
      },
    })
  })

  return rows.sort((a, b) => a.lineValue - b.lineValue)
}

// Helper function to calculate alternate line average
const calculateAlternateAverage = (books: Array<{ bookId: string; odds?: OddsPrice }>) => {
  const validBooks = books.filter(book => book.odds?.price !== undefined && !Number.isNaN(book.odds.price))
  
  if (validBooks.length === 0) return null
  
  // Calculate average using proper probability math
  const avgProbability = validBooks.reduce((sum, book) => {
    const odds = book.odds!.price
    const probability = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)
    return sum + probability
  }, 0) / validBooks.length
  
  const avgPrice = avgProbability >= 0.5 
    ? Math.round(-(avgProbability / (1 - avgProbability)) * 100)
    : Math.round(((1 - avgProbability) / avgProbability) * 100)
  
  return avgPrice
}

const renderAlternateRow = (
  columnOrder: string[],
  orderedSportsbooks: SportsbookMeta[],
  row: AlternateRowData,
  onOddsClick?: (bookId: string, side: 'over' | 'under', odds: OddsPrice) => void,
  altIndex: number = 0,
  columnHighlighting: boolean = true,
  isPro: boolean = false,
  setShowProGate?: (show: boolean) => void
) => {
  const rowBg = altIndex % 2 === 0 ? 'table-row-even' : 'table-row-odd'
  const borderColor = 'border-neutral-200 dark:border-neutral-700'
  return (
  <tr key={row.key} className={rowBg}>
    {columnOrder.map((columnId: string) => {
      switch (columnId) {
        case 'entity':
          return (
            <td
              key="entity"
              className={`px-4 py-3 text-xs text-blue-700 dark:text-blue-300 border-r ${borderColor} sticky left-0 z-10 ${rowBg} backdrop-blur supports-[backdrop-filter]:bg-neutral-50/60 dark:supports-[backdrop-filter]:bg-neutral-900/60`}
            >
              Alt Line {row.lineLabel}
            </td>
          )
        case 'event':
          return (
            <td
              key="event"
              className={`px-3 py-3 text-xs text-blue-600 dark:text-blue-300 border-r ${borderColor} ${rowBg}`}
            >
              —
            </td>
          )
        case 'best-line':
          return (
            <td
              key="best-line"
              className={`px-3 py-3 text-xs text-blue-600 dark:text-blue-300 border-r ${borderColor} ${rowBg}`}
            >
                      <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  {row.best.over ? (() => {
                    const ids = (row.best.over.book || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                    const logos = ids.map((id, i) => {
                      const sb = getSportsbookById(id)
                      return sb?.image?.light ? (
                        <img key={`${id}-${i}`} src={sb.image.light} alt={sb.name} className="w-3 h-3 object-contain" />
                      ) : null
                    }).filter(Boolean)
                    const inline = logos.length > 0 && logos.length <= 3
                    return (
                      <>
                        <span>
                          o{row.best.over.line}/{row.best.over.price > 0 ? `+${row.best.over.price}` : row.best.over.price}
                        </span>
                        {inline ? (
                          <div className="flex gap-0.5">{logos}</div>
                        ) : ids.length >= 4 ? (
                          <Tooltip
                            content={
                              <div className="flex flex-wrap gap-2 max-w-[200px] p-2">
                                  {ids.map((id, i) => {
                                    const sb = getSportsbookById(id)
                                    return sb?.image?.light ? (
                                      <div key={`${id}-${i}`} className="flex items-center gap-1">
                                        <img src={sb.image.light} alt={sb.name} className="w-4 h-4 object-contain" />
                                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{sb.name}</span>
                                      </div>
                                    ) : null
                                  })}
                                </div>
                            }
                          >
                            <div className="text-[10px] text-blue-600 dark:text-blue-300 cursor-help select-none">
                              {ids.length} books
                            </div>
                            </Tooltip>
                        ) : null}
                      </>
                    )
                  })() : (
                    <div className="text-xs text-neutral-400 dark:text-neutral-600">-</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {row.best.under ? (() => {
                    const ids = (row.best.under.book || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                    const logos = ids.map((id, i) => {
                      const sb = getSportsbookById(id)
                      return sb?.image?.light ? (
                        <img key={`${id}-${i}`} src={sb.image.light} alt={sb.name} className="w-3 h-3 object-contain" />
                      ) : null
                    }).filter(Boolean)
                    const inline = logos.length > 0 && logos.length <= 3
                    return (
                      <>
                        <span>
                          u{row.best.under.line}/{row.best.under.price > 0 ? `+${row.best.under.price}` : row.best.under.price}
                        </span>
                        {inline ? (
                          <div className="flex gap-0.5">{logos}</div>
                        ) : ids.length >= 4 ? (
                          <Tooltip
                            content={
                              <div className="flex flex-wrap gap-2 max-w-[200px] p-2">
                                  {ids.map((id, i) => {
                                    const sb = getSportsbookById(id)
                                    return sb?.image?.light ? (
                                      <div key={`${id}-${i}`} className="flex items-center gap-1">
                                        <img src={sb.image.light} alt={sb.name} className="w-4 h-4 object-contain" />
                                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{sb.name}</span>
                                      </div>
                                    ) : null
                                  })}
                                </div>
                            }
                          >
                            <div className="text-[10px] text-blue-600 dark:text-blue-300 cursor-help select-none">
                              {ids.length} books
                            </div>
                            </Tooltip>
                        ) : null}
                      </>
                    )
                  })() : (
                    <div className="text-xs text-neutral-400 dark:text-neutral-600">-</div>
                  )}
                </div>
              </div>
            </td>
          )
        case 'average-line':
          return (
            <td
              key="average-line"
              className={`px-3 py-3 text-xs border-r ${borderColor} ${rowBg} text-center`}
            >
              <div className="space-y-1">
                {/* Over Average */}
                {(() => {
                  const overBooks = Object.entries(row.books).map(([bookId, bookData]) => ({ bookId, odds: bookData?.over }))
                  const avgPrice = calculateAlternateAverage(overBooks)
                  
                  if (avgPrice === null) {
                    return <div className="text-xs text-neutral-400 dark:text-neutral-500">-</div>
                  }
                  
                  return (
                    <div className="px-1 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700 min-w-fit mx-auto">
                      <span className="opacity-75">o{row.lineValue}</span>
                      <span className="ml-1 font-semibold">{avgPrice > 0 ? `+${avgPrice}` : avgPrice}</span>
                    </div>
                  )
                })()}
                
                {/* Under Average */}
                {(() => {
                  const underBooks = Object.entries(row.books).map(([bookId, bookData]) => ({ bookId, odds: bookData?.under }))
                  const avgPrice = calculateAlternateAverage(underBooks)
                  
                  if (avgPrice === null) {
                    return <div className="text-xs text-neutral-400 dark:text-neutral-500">-</div>
                  }
                  
                  return (
                    <div className="px-1 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700 min-w-fit mx-auto">
                      <span className="opacity-75">u{row.lineValue}</span>
                      <span className="ml-1 font-semibold">{avgPrice > 0 ? `+${avgPrice}` : avgPrice}</span>
                    </div>
                  )
                })()}
              </div>
            </td>
          )
        default:
          return null
      }
    })}
    {orderedSportsbooks.map((book) => {
      const odds = row.books[book.id]

      const renderAltOdds = (
        priceOdds?: OddsPrice,
        side?: 'over' | 'under'
      ) => {
          if (!priceOdds || !side) {
            return (
              <div className="block w-full text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1.5 mx-auto text-center min-w-fit">
                -
              </div>
            )
          }

          // Check if this is the best odds for alternates
          const isBestAltOdds = columnHighlighting && row.best[side] && priceOdds.price === row.best[side]?.price

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (priceOdds.link) {
                window.open(priceOdds.link, '_blank', 'noopener,noreferrer')
              } else if (onOddsClick) {
                onOddsClick(book.id, side, priceOdds)
              }
            }}
            className={cn(
              'block w-full text-xs rounded-md px-2 py-1.5 mx-auto transition-all cursor-pointer font-medium min-w-fit',
              isBestAltOdds
                ? '[background:color-mix(in_oklab,var(--accent)_15%,var(--card))] [color:var(--accent-strong)] [border-color:color-mix(in_oklab,var(--accent)_40%,transparent)] dark:[background:color-mix(in_oklab,var(--accent)_20%,var(--card))] dark:[color:var(--accent-weak)] dark:[border-color:color-mix(in_oklab,var(--accent)_30%,transparent)] hover:[background:color-mix(in_oklab,var(--accent)_25%,var(--card))] dark:hover:[background:color-mix(in_oklab,var(--accent)_30%,var(--card))]'
                : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600',
              priceOdds.price && (priceOdds.price > 0 ? 'animate-odds-flash-positive' : '')
            )}
          >
            <div className="text-center">
              {/* Match primary row styling - horizontal layout (line + odds on same row) */}
              <div className="text-xs font-medium">
                <span className="opacity-75">{side === 'over' ? `o${row.lineValue}` : `u${row.lineValue}`}</span>
                <span className="ml-1 font-semibold">{priceOdds.price > 0 ? `+${priceOdds.price}` : priceOdds.price}</span>
              </div>
            </div>
          </button>
        )
      }

      return (
        <td key={`${row.key}-${book.id}`} className={`border-r ${borderColor} px-1 py-2 w-auto whitespace-nowrap ${rowBg}`}>
          <div className="space-y-1">
            {renderAltOdds(odds?.over, 'over')}
            {renderAltOdds(odds?.under, 'under')}
          </div>
        </td>
      )
    })}
  </tr>
)}

// Re-export for convenience
export type OddsTableItem = OddsScreenItem

// Column configuration types
export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  width?: string
}

export interface OddsTableProps extends Partial<TableInteractionHandlers> {
  data: OddsTableItem[]
  loading?: boolean
  error?: string | null
  sport: string
  type: 'game' | 'player'
  market: string
  scope: 'pregame' | 'live'
  live?: boolean // when true, enable SSE-driven animations for changes
  visibleSportsbooks?: string[] // Optional array of sportsbook IDs to show as columns
  maxSportsbookColumns?: number // Optional limit on number of sportsbook columns
  className?: string
  onColumnOrderChange?: (newOrder: string[]) => void
  columnHighlighting?: boolean // Whether to highlight best odds with green background
  searchQuery?: string // Optional search query to filter players/teams
  height?: string // Optional max height for scroll container (e.g., '82vh')
}

type SortField = 'entity' | 'event' | 'bestOver' | 'bestUnder' | 'startTime'
type SortDirection = 'asc' | 'desc'

// Sortable Header Component
function SortableHeader({ 
  id, 
  children, 
  className = '', 
  onClick 
}: { 
  id: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not dragging and click is on the content area
    if (!isDragging && onClick) {
      e.preventDefault()
      e.stopPropagation()
      onClick()
    }
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'z-50' : ''} relative group`}
      {...attributes}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1" onClick={handleClick}>
          {children}
        </div>
        <div
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-neutral-400" />
        </div>
      </div>
    </th>
  )
}

// Memoized row component to prevent unnecessary re-renders
const MemoizedTableRow = memo(({ 
  item, 
  index, 
  columnOrder, 
  orderedSportsbooks, 
  effectiveVisibleSportsbooks,
  onRowClick,
  onOddsClick,
  preferences,
  columnHighlighting,
  sport,
  type,
  market,
  expandedRows,
  setExpandedRows,
  fetchAlternates,
  alternateRows,
  alternatesLoading,
  customLineSelections,
  updatePrimaryRowWithLine,
  getAvailableLines
}: any) => {
  // Row rendering logic would go here
  // This is a placeholder for the actual row implementation
  return null
})
MemoizedTableRow.displayName = 'MemoizedTableRow'

export function OddsTable({
  data,
  loading = false,
  error = null,
  sport,
  type,
  market,
  scope,
  visibleSportsbooks,
  maxSportsbookColumns,
  onRowClick,
  onOddsClick,
  onColumnOrderChange,
  className = '',
  columnHighlighting = true,
  searchQuery = '',
  height = '90vh'
}: OddsTableProps) {
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { preferences, updatePreferences, isLoading } = useOddsPreferences()
  const allActiveSportsbooks = useMemo(() => getAllActiveSportsbooks(), [])
  const { user } = useAuth()
  // Quick client hint from metadata (may be stale); normalized check
  const [showProGate, setShowProGate] = useState(false)

  // VC-Grade: Use centralized, cached Pro status
  const { isPro, isLoading: isLoadingPro } = useIsPro()
  
  // Debug logging for Pro status (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[OddsTable] Pro status:', {
        isPro,
        isLoading: isLoadingPro,
        hasUser: !!user,
      })
    }
  }, [isPro, isLoadingPro, user])

  // Track changes for visual feedback (SSE updates)
  const [changedRows, setChangedRows] = useState<Set<string>>(new Set())
  const [newRows, setNewRows] = useState<Set<string>>(new Set())
  const [changedPriceCells, setChangedPriceCells] = useState<Set<string>>(new Set())
  const [changedLineCells, setChangedLineCells] = useState<Set<string>>(new Set())
  // Track positive/negative odds changes for color flashing
  const [positiveOddsChanges, setPositiveOddsChanges] = useState<Set<string>>(new Set())
  const [negativeOddsChanges, setNegativeOddsChanges] = useState<Set<string>>(new Set())
  const prevDataRef = useRef<Map<string, OddsTableItem>>(new Map())
  const isInitialMount = useRef(true)
  const activeSportsbookIds = useMemo(
    () => allActiveSportsbooks.map((book) => book.id),
    [allActiveSportsbooks]
  )

  // Detect changes for visual feedback (works for both live and pregame)
  useEffect(() => {
    if (!data || data.length === 0) return

    // Skip animations on initial mount
    if (isInitialMount.current) {
      const currentMap = new Map<string, OddsTableItem>()
      data.forEach((item) => currentMap.set(item.id, item))
      prevDataRef.current = currentMap
      isInitialMount.current = false
      return
    }

    const currentMap = new Map<string, OddsTableItem>()
    const changed = new Set<string>()
    const added = new Set<string>()
    const priceChanged = new Set<string>()
    const lineChanged = new Set<string>()
    const positiveOddsChanges = new Set<string>()
    const negativeOddsChanges = new Set<string>()

    data.forEach((item) => {
      const id = item.id
      currentMap.set(id, item)

      const prev = prevDataRef.current.get(id)
      if (!prev) {
        // New row
        added.add(id)
      } else {
        // Check if odds changed (best)
        const bestChanged = 
          prev.odds?.best?.over?.price !== item.odds?.best?.over?.price ||
          prev.odds?.best?.under?.price !== item.odds?.best?.under?.price ||
          prev.odds?.best?.over?.line !== item.odds?.best?.over?.line ||
          prev.odds?.best?.under?.line !== item.odds?.best?.under?.line
        
        if (bestChanged) changed.add(id)

        // Fine-grained per-book, per-side checks
        const curBooks = item.odds?.books || {}
        const prevBooks = prev.odds?.books || {}
        const bookIds = Array.from(new Set([...Object.keys(curBooks), ...Object.keys(prevBooks)]))
        for (const bk of bookIds) {
          const cur = curBooks[bk] || {}
          const prv = prevBooks[bk] || {}
          ;(['over','under'] as const).forEach((side) => {
            const curSide = cur[side]
            const prevSide = prv[side]
            const baseKey = `${id}|${bk}|${side}`
            if (curSide && prevSide) {
              if (curSide.price !== prevSide.price) {
                priceChanged.add(`${baseKey}|price`)
                // Determine if odds got better or worse
                // Higher odds = better (e.g., -110 → +105 or +150 → +200)
                const isBetter = curSide.price > prevSide.price
                if (isBetter) {
                  positiveOddsChanges.add(baseKey)
                } else {
                  negativeOddsChanges.add(baseKey)
                }
              }
              if ((curSide.line ?? 0) !== (prevSide.line ?? 0)) lineChanged.add(`${baseKey}|line`)
            } else if (curSide && !prevSide) {
              // newly added side -> treat as both price and line changed
              priceChanged.add(`${baseKey}|price`)
              lineChanged.add(`${baseKey}|line`)
              // New odds are considered positive
              positiveOddsChanges.add(baseKey)
            }
          })
        }
      }
    })

    if (changed.size > 0) {
      setChangedRows(changed)
      setTimeout(() => setChangedRows(new Set()), 2000) // Clear after 2s
    }

    if (added.size > 0) {
      setNewRows(added)
      setTimeout(() => setNewRows(new Set()), 3000) // Clear after 3s
    }

    if (priceChanged.size > 0) {
      setChangedPriceCells(priceChanged)
      setTimeout(() => setChangedPriceCells(new Set()), 1500)
    }
    if (lineChanged.size > 0) {
      setChangedLineCells(lineChanged)
      setTimeout(() => setChangedLineCells(new Set()), 1500)
    }

    // Set positive/negative changes and clear after 5 seconds
    if (positiveOddsChanges.size > 0) {
      setPositiveOddsChanges(positiveOddsChanges)
      setTimeout(() => setPositiveOddsChanges(new Set()), 5000)
    }
    if (negativeOddsChanges.size > 0) {
      setNegativeOddsChanges(negativeOddsChanges)
      setTimeout(() => setNegativeOddsChanges(new Set()), 5000)
    }

    prevDataRef.current = currentMap
  }, [data])
  
  // Use visibleSportsbooks prop or fall back to user preferences
  const effectiveVisibleSportsbooks = useMemo(() => {
    return visibleSportsbooks || preferences?.selectedBooks || activeSportsbookIds
  }, [visibleSportsbooks, preferences?.selectedBooks, activeSportsbookIds])
  
  const [columnOrder, setColumnOrder] = useState<string[]>(preferences.columnOrder)
  
  // Ensure columnOrder always has all required columns (don't remove them when hiding)
  // IMPORTANT: Visibility is controlled by showBestLine/showAverageLine separately
  React.useEffect(() => {
    const requiredColumns = ['entity', 'event', 'best-line', 'average-line']
    const missingColumns = requiredColumns.filter(col => !columnOrder.includes(col))
    
    if (missingColumns.length > 0) {
      // Add missing columns to the end, preserving existing order
      const updatedOrder = [...columnOrder, ...missingColumns]
      setColumnOrder(updatedOrder)
      updatePreferences({ columnOrder: updatedOrder })
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsTable] Added missing columns to columnOrder:', missingColumns)
      }
    }
  }, [columnOrder])
  
  // Responsive: detect small screens to shrink column sizes without changing desktop
  const [isSmallScreen, setIsSmallScreen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)') // Tailwind sm breakpoint
    const update = () => setIsSmallScreen(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Filter column order based on user preferences
  const filteredColumnOrder = useMemo(() => {
    let columns = columnOrder
    
    // Remove best-line column if user has it disabled
    if (!preferences?.showBestLine) {
      columns = columns.filter(col => col !== 'best-line')
    }
    
    // Remove average-line column if user has it disabled
    if (!preferences?.showAverageLine) {
      columns = columns.filter(col => col !== 'average-line')
    }
    
    return columns
  }, [columnOrder, preferences?.showBestLine, preferences?.showAverageLine])
  const [sportsbookOrder, setSportsbookOrder] = useState<string[]>(preferences.sportsbookOrder)

  // Sort and group data by date
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Apply search filtering if searchQuery is provided
    const filteredData = searchQuery.trim() 
      ? data.filter(item => {
          const query = searchQuery.toLowerCase().trim()
          
          // For player props, search in player name
          if (type === 'player' && item.entity?.name) {
            return item.entity.name.toLowerCase().includes(query)
          }
          
          // For game props, search in team abbreviations and full names
          if (type === 'game') {
            const homeTeam = item.event?.homeTeam?.toLowerCase() || ''
            const awayTeam = item.event?.awayTeam?.toLowerCase() || ''
            const homeName = item.event?.homeName?.toLowerCase() || ''
            const awayName = item.event?.awayName?.toLowerCase() || ''
            return (
              homeTeam.includes(query) ||
              awayTeam.includes(query) ||
              homeName.includes(query) ||
              awayName.includes(query)
            )
          }
          
          return false
        })
      : data

    const safeTime = (t?: string) => {
      const n = t ? new Date(t).getTime() : 0
      return Number.isFinite(n) ? n : 0
    }

    return [...filteredData].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case 'entity':
          aValue = a.entity?.name || ''
          bValue = b.entity?.name || ''
          break
        case 'bestOver':
          aValue = a.odds.best.over?.price || -Infinity
          bValue = b.odds.best.over?.price || -Infinity
          break
        case 'bestUnder':
          aValue = a.odds.best.under?.price || -Infinity
          bValue = b.odds.best.under?.price || -Infinity
          break
        case 'startTime':
          aValue = safeTime(a.event?.startTime)
          bValue = safeTime(b.event?.startTime)
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortField, sortDirection, type, searchQuery])

  // Performance monitoring for VC-level metrics
  const performanceRef = useRef({
    renderStart: 0,
    renderEnd: 0,
    interactionStart: 0
  })

  // Performance tracking
  useEffect(() => {
    performanceRef.current.renderStart = performance.now()
    return () => {
      performanceRef.current.renderEnd = performance.now()
      const renderTime = performanceRef.current.renderEnd - performanceRef.current.renderStart
      if (renderTime > 16) { // Flag renders > 16ms (60fps budget)
        console.warn(`[Performance] Slow render detected: ${renderTime.toFixed(2)}ms`)
      }
    }
  })

  // Error boundary for production resilience
  const [hasError, setHasError] = useState(false)
  
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('[OddsTable] Runtime error:', error)
      setHasError(true)
    }
    
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  // Virtual scrolling (mobile VC-level): only render visible rows on small screens
  const containerRef = useRef<HTMLDivElement>(null)
  const ROW_HEIGHT = 64 // approximate row height
  const OVERSCAN = 10
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  // NOTE: effect moved below groupedData initialization so dependency order is valid
  
  // Group data by date for rendering with separators
  const groupedData = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return []

    const groups: Array<{ type: 'separator'; date: string; dateLabel: string } | { type: 'item'; item: OddsTableItem; index: number }> = []
    let currentDate = ''

    sortedData.forEach((item, index) => {
      const itemDate = item.event?.startTime ? new Date(item.event.startTime).toDateString() : 'No Date'
      
      if (itemDate !== currentDate) {
        currentDate = itemDate
        const date = item.event?.startTime ? new Date(item.event.startTime) : new Date()
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(today.getDate() + 1)
        
        let dateLabel = ''
        if (date.toDateString() === today.toDateString()) {
          dateLabel = 'Today'
        } else if (date.toDateString() === tomorrow.toDateString()) {
          dateLabel = 'Tomorrow'
        } else {
          dateLabel = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })
        }
        
        groups.push({
          type: 'separator',
          date: itemDate,
          dateLabel
        })
      }
      
      groups.push({
        type: 'item',
        item,
        index
      })
    })

    return groups
  }, [sortedData])

  // Set up/update virtual window after groupedData is ready
  useEffect(() => {
    if (!isSmallScreen) return
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const scrollTop = el.scrollTop
      const viewport = el.clientHeight || 0
      const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
      const count = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2
      const end = Math.min(start + count, groupedData.length)
      setVisibleRange({ start, end })
    }
    update()
    el.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [isSmallScreen, groupedData.length])

  useEffect(() => {
    if (!isLoading) {
      setColumnOrder(preferences.columnOrder)
      setSportsbookOrder(preferences.sportsbookOrder)
    }
  }, [isLoading, preferences.columnOrder, preferences.sportsbookOrder])

  // Memoized calculation functions for better performance
  const memoizedCalculateUserBestOdds = useCallback((rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    return calculateUserBestOdds(rowItem, side, visibleSportsbooks)
  }, [])

  const memoizedCalculateUserAverageOdds = useCallback((rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    return calculateUserAverageOdds(rowItem, side, visibleSportsbooks)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Determine which sportsbooks to show as columns
  const displaySportsbooks = useMemo(() => {
    const normalizeBookId = (id: string): string => {
      const lower = (id || '').toLowerCase()
      switch (lower) {
        case 'hardrock': return 'hard-rock'
        case 'hardrock-indiana': return 'hard-rock-indiana'
        case 'ballybet': return 'bally-bet'
        case 'sportsinteraction': return 'sports-interaction'
        default: return lower
      }
    }
    // Build a union of IDs from (in priority): explicit prop, user selection, and data-present books
    const idSet = new Set<string>()
    const addIds = (ids?: string[]) => ids?.forEach((id) => idSet.add(normalizeBookId(id)))

    // Priority 1: Explicit prop (highest priority)
    if (visibleSportsbooks && visibleSportsbooks.length > 0) {
      addIds(visibleSportsbooks)
    }
    // Priority 2: User preferences (if they have selected specific books)
    else if (preferences.selectedBooks && preferences.selectedBooks.length > 0) {
      addIds(preferences.selectedBooks)
      // Development logging to verify Pinnacle is included
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsTable] Selected books from preferences:', preferences.selectedBooks)
        console.log('[OddsTable] Includes Pinnacle?', preferences.selectedBooks.includes('pinnacle'))
      }
    }
    // Priority 3: Default to all active sportsbooks if no preferences set
    else {
      addIds(allActiveSportsbooks.map((sb) => sb.id))
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsTable] Using all active sportsbooks (no preferences):', allActiveSportsbooks.map(sb => sb.id))
      }
    }

    // Only union with data-present books when there is NO explicit subset selection.
    const allActiveIds = new Set(allActiveSportsbooks.map((sb) => sb.id))
    const selected = new Set(preferences.selectedBooks || [])
    const hasExplicitSubset =
      (visibleSportsbooks && visibleSportsbooks.length > 0) ||
      (selected.size > 0 && selected.size < allActiveIds.size)
    if (!hasExplicitSubset) {
      data.forEach((item) => {
        const books = item.odds?.books || {}
        Object.keys(books).forEach((id) => idSet.add(normalizeBookId(id)))
        // Also include normalized books if available
        const nbooks = item.odds?.normalized?.books || {}
        Object.keys(nbooks).forEach((id) => idSet.add(normalizeBookId(id)))
      })
    }

    // Convert set to array and get book metadata
    const ids = Array.from(idSet)
    const books = ids
      .map((id) => getSportsbookById(id))
      .filter((book): book is SportsbookMeta => book !== undefined)

    if (process.env.NODE_ENV === 'development') {
      console.log('[OddsTable] Final displaySportsbooks:', books.map(b => b.id))
    }

    return typeof maxSportsbookColumns === 'number' ? books.slice(0, maxSportsbookColumns) : books
  }, [
    preferences.selectedBooks,
    visibleSportsbooks,
    maxSportsbookColumns,
    allActiveSportsbooks,
    data,
  ])

  // Get all sportsbooks (show all configured books, display "-" for missing data)
  const availableSportsbooks = useMemo(() => displaySportsbooks, [displaySportsbooks])

  // Initialize sportsbook order when availableSportsbooks changes
  // IMPORTANT: sportsbookOrder should ALWAYS contain ALL books, not just selected ones
  // Visibility is controlled by selectedBooks separately
  React.useEffect(() => {
    if (availableSportsbooks.length === 0) return
    
    const allBookIds = availableSportsbooks.map(book => book.id)
    
    // If sportsbookOrder is empty, initialize with all books
    if (sportsbookOrder.length === 0) {
      setSportsbookOrder(allBookIds)
      updatePreferences({ sportsbookOrder: allBookIds })
      return
    }
    
    // If there are new books not in sportsbookOrder, append them to the end
    const missingBooks = allBookIds.filter(id => !sportsbookOrder.includes(id))
    if (missingBooks.length > 0) {
      const updatedOrder = [...sportsbookOrder, ...missingBooks]
      setSportsbookOrder(updatedOrder)
      updatePreferences({ sportsbookOrder: updatedOrder })
    }
  }, [availableSportsbooks, sportsbookOrder])

  // Create ordered sportsbooks based on current order
  const orderedSportsbooks = useMemo(() => {
    if (!sportsbookOrder || sportsbookOrder.length === 0) return availableSportsbooks
    const normalizeBookId = (id: string): string => {
      const lower = (id || '').toLowerCase()
      switch (lower) {
        case 'hardrock': return 'hard-rock'
        case 'hardrock-indiana': return 'hard-rock-indiana'
        case 'ballybet': return 'bally-bet'
        case 'sportsinteraction': return 'sports-interaction'
        default: return lower
      }
    }
    const ordered = sportsbookOrder
      .map(id => availableSportsbooks.find(book => book.id === normalizeBookId(id)))
      .filter(Boolean) as SportsbookMeta[]
    const missingBooks = availableSportsbooks.filter(book => !sportsbookOrder.includes(book.id))
    return [...ordered, ...missingBooks]
  }, [availableSportsbooks, sportsbookOrder])

  // Build columns for Table component (Dub-style)
  const columnHelper = createColumnHelper<OddsTableItem>()

  const tableColumns = useMemo(() => {
    // Define all main column definitions
    const mainColumnDefs: Record<string, any> = {
      'entity': columnHelper.display({
        id: 'entity',
        header: () => {
          const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
            id: 'entity' 
          })

          const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
          }

          return (
            <div
              ref={setNodeRef}
              style={style}
              className={cn(
                "relative group/header flex items-center justify-between",
                isDragging && "z-50"
              )}
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {type === 'game' ? 'Game' : 'Player'}
              </span>
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          )
        },
        size: isSmallScreen ? 110 : 160,
        cell: (info) => {
          const item = info.row.original
          if (item.entity.type === 'game') {
            // Hide expand button for moneyline markets (no alternates)
            const isMoneyline = item.entity.details === 'Moneyline' || (typeof market === 'string' && market.toLowerCase().includes('moneyline'))
            
            return (
              <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[200px]">
                <ExpandButton hide={true} />
                <div className="flex-1 min-w-0">
                  {/* Two-line display with team logos: Away on top, Home on bottom */}
                  <div className="flex flex-col gap-0.5">
                    <div className={cn(
                      "flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100",
                      (sport === 'ncaaf' || sport === 'ncaab') ? 'text-[13px]' : 'text-[15px]'
                    )}>
                      {hasTeamLogos(sport) && (
                        <img
                          src={getTeamLogoUrl(item.event?.awayTeam || '')}
                          alt={item.event?.awayTeam || ''}
                          className={cn('object-contain', (sport === 'ncaaf' || sport === 'ncaab') ? 'h-4 w-4' : 'h-5 w-5')}
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <span>{(sport === 'ncaaf' || sport === 'ncaab') ? (item.event?.awayName || item.event?.awayTeam) : item.event?.awayTeam}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100",
                      (sport === 'ncaaf' || sport === 'ncaab') ? 'text-[13px]' : 'text-[15px]'
                    )}>
                      {hasTeamLogos(sport) && (
                        <img
                          src={getTeamLogoUrl(item.event?.homeTeam || '')}
                          alt={item.event?.homeTeam || ''}
                          className={cn('object-contain', (sport === 'ncaaf' || sport === 'ncaab') ? 'h-4 w-4' : 'h-5 w-5')}
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <span>{(sport === 'ncaaf' || sport === 'ncaab') ? (item.event?.homeName || item.event?.homeTeam) : item.event?.homeTeam}</span>
                    </div>
                  </div>
                  {/* Hide redundant market name for spreads/totals in game column */}
                  {item.entity.details && !['Point Spread', 'Total Points', 'Moneyline'].includes(item.entity.details) && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      {item.entity.details}
                    </div>
                  )}
                </div>
              </div>
            )
          }
          // Player props
          const playerTeam = item.entity?.team; // Team abbreviation (e.g., "JAX")
          const awayTeam = item.event?.awayTeam;
          const homeTeam = item.event?.homeTeam;
          const showLogos = hasTeamLogos(sport);
          
          return (
            <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[200px]">
              <ExpandButton disabled={!preferences.includeAlternates} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {item.entity?.name || 'Unknown'}
                  {item.entity?.details && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                      ({item.entity.details})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {showLogos && awayTeam && (
                    <img 
                      src={getTeamLogoUrl(awayTeam)} 
                      alt={awayTeam}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span className={playerTeam === awayTeam ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''}>
                    {awayTeam}
                  </span>
                  <span className="mx-0.5">@</span>
                  {showLogos && homeTeam && (
                    <img 
                      src={getTeamLogoUrl(homeTeam)} 
                      alt={homeTeam}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span className={playerTeam === homeTeam ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''}>
                    {homeTeam}
                  </span>
                </div>
              </div>
            </div>
          )
        }
      }),
      'event': columnHelper.display({
        id: 'event',
        header: () => {
          const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
            id: 'event' 
          })

          const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
          }

          return (
            <div
              ref={setNodeRef}
              style={style}
              className={cn(
                "relative group/header flex items-center justify-between",
                isDragging && "z-50"
              )}
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Event
              </span>
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          )
        },
        size: isSmallScreen ? 48 : 80,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              <div>{item.event?.startTime ? new Date(item.event.startTime).toLocaleDateString() : ''}</div>
              <div>{item.event?.startTime ? new Date(item.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
          )
        }
      }),
      'best-line': columnHelper.display({
        id: 'best-line',
        header: () => {
          const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
            id: 'best-line' 
          })

          const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
          }

          return (
            <div
              ref={setNodeRef}
              style={style}
              className={cn(
                "relative group/header flex items-center justify-between",
                isDragging && "z-50"
              )}
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Best Line
              </span>
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          )
        },
        size: isSmallScreen ? 96 : 140,
        cell: (info) => {
          const item = info.row.original
            const isMoneyline = item.entity.type === 'game' && (
            item.entity.details === 'Moneyline' ||
            (typeof market === 'string' && market.toLowerCase().includes('moneyline')) ||
            (((item.odds?.best?.over?.line ?? 0) === 0) && ((item.odds?.best?.under?.line ?? 0) === 0))
          )
            const isSpread = item.entity.type === 'game' && (
              item.entity.details === 'Point Spread' ||
              (typeof market === 'string' && /spread/i.test(market)) ||
              // Fallback: non-zero line with best over/under both present and not totals
              (((item.odds?.best?.over?.line ?? null) !== null || (item.odds?.best?.under?.line ?? null) !== null) &&
               !((item.odds?.best?.over?.line ?? 0) === 0 && (item.odds?.best?.under?.line ?? 0) === 0) &&
               !(typeof market === 'string' && /(total|totals)/i.test(market)))
            )
          return (
            <div className="space-y-1 text-center">
              {/* Team markets (moneyline & spread): Away (top under), Home (bottom over). Totals unchanged */}
              {isMoneyline || isSpread ? (
                <>
                  {renderBestOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                  {renderBestOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                </>
              ) : (
                <>
                  {renderBestOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                  {renderBestOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                </>
              )}
            </div>
          )
        }
      }),
      'average-line': columnHelper.display({
        id: 'average-line',
        header: () => {
          const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
            id: 'average-line' 
          })

          const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
          }

          return (
            <div
              ref={setNodeRef}
              style={style}
              className={cn(
                "relative group/header flex items-center justify-between",
                isDragging && "z-50"
              )}
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Avg Line
              </span>
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          )
        },
        size: isSmallScreen ? 96 : 140,
        cell: (info) => {
          const item = info.row.original
          const isMoneyline = item.entity.type === 'game' && (
            item.entity.details === 'Moneyline' ||
            (typeof market === 'string' && market.toLowerCase().includes('moneyline')) ||
            (((item.odds?.best?.over?.line ?? 0) === 0) && ((item.odds?.best?.under?.line ?? 0) === 0))
          )
          const isSpread = item.entity.type === 'game' && (
            item.entity.details === 'Point Spread' ||
            (typeof market === 'string' && /spread/i.test(market))
          )
          return (
            <div className="space-y-1 text-center">
              {/* Team markets (moneyline & spread): Away (top under), Home (bottom over). Totals unchanged */}
              {isMoneyline || isSpread ? (
                <>
                  {renderAverageOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                  {renderAverageOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                </>
              ) : (
                <>
                  {renderAverageOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                  {renderAverageOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                </>
              )}
            </div>
          )
        }
      })
    }

    // Order main columns based on filteredColumnOrder
    const cols: any[] = filteredColumnOrder
      .map(colId => mainColumnDefs[colId])
      .filter(Boolean)

    // Dynamic sportsbook columns (draggable)
    orderedSportsbooks.forEach((book, bookIndex) => {
      cols.push(
        columnHelper.display({
          id: book.id,
          header: () => {
            const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
              id: book.id 
            })

            const style = {
              transform: CSS.Transform.toString(transform),
              transition,
              opacity: isDragging ? 0.5 : 1,
            }

            return (
              <div
                ref={setNodeRef}
                style={style}
                className={cn(
                  "relative group/header flex items-center justify-center",
                  isDragging && "z-50"
                )}
              >
                <button
                  onClick={() => {
                    if (book.links.desktop) {
                      window.open(book.links.desktop, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  className="flex flex-col items-center space-y-1 min-w-[96px] sm:min-w-[120px] hover:opacity-80 transition-opacity"
                  title={`Visit ${book.name}`}
                >
                  <img src={book.image.light} alt={book.name} className="book-logo" />
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{book.name}</span>
                </button>
                {/* Drag Handle */}
                <div
                  {...attributes}
                  {...listeners}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="w-4 h-4 text-neutral-400" />
                </div>
              </div>
            )
          },
          size: isSmallScreen ? 100 : 140,
          cell: (info) => {
            const item = info.row.original
            const n = item.odds.normalized
            const bookData = item.odds.books?.[book.id] ||
                              item.odds.books?.[book.id.replace('-', '_')] ||
                              item.odds.books?.[book.id.replace('_', '-')] ||
                              item.odds.books?.[book.id.toLowerCase()] ||
                              item.odds.books?.[book.id.toUpperCase()]

            const renderPlaceholder = () => (
              <div className="block w-full text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1.5 mx-auto text-center min-w-fit">
                -
              </div>
            )

            if (!bookData) return (
              <div className="space-y-1">
                {renderPlaceholder()}
                {renderPlaceholder()}
              </div>
            )

            // Prefer normalized mapping when present
            const isMoneyline = n?.marketKind === 'moneyline' || (item.entity.type === 'game' && (item.entity.details === 'Moneyline' || (typeof market === 'string' && market.toLowerCase().includes('moneyline'))))
            const isSpread = n?.marketKind === 'spread' || (item.entity.type === 'game' && ((item.entity.details === 'Point Spread') || (typeof market === 'string' && /spread/i.test(market))))
            const sideTop = (isMoneyline || isSpread) && n?.sideMap?.away ? n!.sideMap!.away : (isMoneyline ? 'under' : 'over')
            const sideBottom = (isMoneyline || isSpread) && n?.sideMap?.home ? n!.sideMap!.home : (isMoneyline ? 'over' : 'under')
            const firstSide = sideTop
            const secondSide = sideBottom
            const firstData = (isMoneyline || isSpread) && n ? n.books?.[book.id]?.away : bookData.over
            const secondData = (isMoneyline || isSpread) && n ? n.books?.[book.id]?.home : bookData.under

            // Fallback when normalized not available (keep current over/under)
            const fd = firstData || (isMoneyline ? bookData.under : bookData.over)
            const sd = secondData || (isMoneyline ? bookData.over : bookData.under)

            return (
              <div className="space-y-1">
                {fd ? (
                  ((odds) => {
                    const isBestOdds = (() => {
                      if (!columnHighlighting) return false
                      const { userBest } = calculateUserBestOdds(item, firstSide, effectiveVisibleSportsbooks)
                      return !!userBest && odds.price === userBest.price && (odds.line ?? 0) === (userBest.line ?? 0)
                    })()
                    const cellKeyBase = `${item.id}|${book.id}|${firstSide}`
                    const cellKeyPrice = `${cellKeyBase}|price`
                    const cellKeyLine = `${cellKeyBase}|line`
                    const priceChanged = changedPriceCells.has(cellKeyPrice)
                    const lineChanged = changedLineCells.has(cellKeyLine)
                    const isPositiveChange = positiveOddsChanges.has(cellKeyBase)
                    const isNegativeChange = negativeOddsChanges.has(cellKeyBase)
                    const onClick = (e: React.MouseEvent) => {
                      e.stopPropagation()
                      if (typeof odds.link === 'string' && odds.link.length > 0) {
                        window.open(odds.link, '_blank', 'noopener,noreferrer')
                      } else {
                        onOddsClick?.(item, firstSide, book.id)
                      }
                    }
                    return (
                      <OddsCellButton
                        itemId={item.id}
                        sportsbookId={book.id}
                        sportsbookName={book.name}
                        side={firstSide}
                        odds={odds}
                        isHighlighted={isBestOdds}
                        priceChanged={priceChanged}
                        lineChanged={lineChanged}
                        isPositiveChange={isPositiveChange}
                        isNegativeChange={isNegativeChange}
                        isMoneyline={isMoneyline}
                        formatOdds={(p) => (p > 0 ? `+${p}` : `${p}`)}
                        formatLine={(ln, sd) => {
                          if (isMoneyline) return ''
                          // For spreads, use the actual line value from the data (already signed correctly)
                          if (isSpread && ln !== undefined && ln !== null) {
                            return ln > 0 ? `+${ln}` : `${ln}`
                          }
                          // Fallback for initial load if line is undefined
                          const baseLine = ln ?? item.odds.best?.over?.line ?? item.odds.best?.under?.line ?? 0
                          if (isSpread) {
                            return baseLine > 0 ? `+${baseLine}` : `${baseLine}`
                          }
                          return sd === 'over' ? `o${baseLine}` : `u${baseLine}`
                        }}
                        onClick={onClick}
                      />
                    )
                  })(fd)) : renderPlaceholder()}

                {sd ? (
                  ((odds) => {
                    const isBestOdds = (() => {
                      if (!columnHighlighting) return false
                      const { userBest } = calculateUserBestOdds(item, secondSide, effectiveVisibleSportsbooks)
                      return !!userBest && odds.price === userBest.price && (odds.line ?? 0) === (userBest.line ?? 0)
                    })()
                    const cellKeyBase = `${item.id}|${book.id}|${secondSide}`
                    const cellKeyPrice = `${cellKeyBase}|price`
                    const cellKeyLine = `${cellKeyBase}|line`
                    const priceChanged = changedPriceCells.has(cellKeyPrice)
                    const lineChanged = changedLineCells.has(cellKeyLine)
                    const isPositiveChange = positiveOddsChanges.has(cellKeyBase)
                    const isNegativeChange = negativeOddsChanges.has(cellKeyBase)
                    const onClick = (e: React.MouseEvent) => {
                      e.stopPropagation()
                      if (typeof odds.link === 'string' && odds.link.length > 0) {
                        window.open(odds.link, '_blank', 'noopener,noreferrer')
                      } else {
                        onOddsClick?.(item, secondSide, book.id)
                      }
                    }
                    return (
                      <OddsCellButton
                        itemId={item.id}
                        sportsbookId={book.id}
                        sportsbookName={book.name}
                        side={secondSide}
                        odds={odds}
                        isHighlighted={isBestOdds}
                        priceChanged={priceChanged}
                        lineChanged={lineChanged}
                        isPositiveChange={isPositiveChange}
                        isNegativeChange={isNegativeChange}
                        isMoneyline={isMoneyline}
                        formatOdds={(p) => (p > 0 ? `+${p}` : `${p}`)}
                        formatLine={(ln, sd) => {
                          if (isMoneyline) return ''
                          // For spreads, use the actual line value from the data (already signed correctly)
                          if (isSpread && ln !== undefined && ln !== null) {
                            return ln > 0 ? `+${ln}` : `${ln}`
                          }
                          // Fallback for initial load if line is undefined
                          const baseLine = ln ?? item.odds.best?.over?.line ?? item.odds.best?.under?.line ?? 0
                          if (isSpread) {
                            return baseLine > 0 ? `+${baseLine}` : `${baseLine}`
                          }
                          return sd === 'over' ? `o${baseLine}` : `u${baseLine}`
                        }}
                        onClick={onClick}
                      />
                    )
                  })(sd)) : renderPlaceholder()}
              </div>
            )
          }
        })
      )
    })

    return cols
  }, [orderedSportsbooks, effectiveVisibleSportsbooks, changedPriceCells, changedLineCells, isSmallScreen])

  const tableProps = useTable({
    data: sortedData,
    columns: tableColumns as any,
    getRowId: (row) => row.id,
    enableColumnResizing: false,
  })

  // Sort the data (deduplicated: single definition earlier for safe access)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const formatOdds = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`
  }

  const formatLine = (line: number | undefined, side: 'over' | 'under', item?: OddsTableItem) => {
    // Guard: return empty string if line is undefined or null
    if (line === undefined || line === null) return ''
    
    // For game markets, show contextual labels
    if (item?.entity.type === 'game') {
      const gameDetails = item.entity.details || ''
      
      if (
        gameDetails === 'Moneyline' ||
        ((item.odds?.best?.over?.line ?? 0) === 0 && (item.odds?.best?.under?.line ?? 0) === 0)
      ) {
        // For moneylines, show team abbreviations instead of o/u
        return side === 'over' ? item.event.awayTeam : item.event.homeTeam
      } else if (gameDetails === 'Point Spread') {
        // For spreads, show clean spread value without team abbreviation
        return line > 0 ? `+${line}` : `${line}`
      }
      // For all other game props (totals, team totals, etc.), use clean o/u format
    }
    
    // Default for player props and game totals - clean o/u format
    return side === 'over' ? `o${line}` : `u${line}`
  }

  const renderAverageOddsButton = (rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    const { userAverage, globalAverage, sampleSize } = calculateUserAverageOdds(rowItem, side, visibleSportsbooks)
    
    // Use user's average if available, otherwise fall back to global average
    const displayOdds = userAverage || globalAverage
    
    if (!displayOdds) {
      return (
        <div className="avg-line avg-line--sm text-neutral-400 dark:text-neutral-500">
          -
        </div>
      )
    }

    return (
      <div className="avg-line avg-line--sm">
        {rowItem.entity.type === 'game' && (rowItem.entity.details === 'Moneyline' || (typeof market === 'string' && market.toLowerCase().includes('moneyline'))) ? (
          <span>{formatOdds(displayOdds.price)}</span>
        ) : (
          <>
            <span className="opacity-75">{formatLine(displayOdds.line, side, rowItem)}</span>
            <span className="font-semibold">/{formatOdds(displayOdds.price)}</span>
          </>
        )}
      </div>
    )
  }

  const renderBestOddsButton = (rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    const { userBest, hasGlobalBetter, globalBest } = calculateUserBestOdds(rowItem, side, visibleSportsbooks)
    
    // Use user's best if available, otherwise fall back to global best
    const displayOdds = userBest || globalBest
    if (!displayOdds) {
      return (
        <div className="px-2 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-center min-w-fit mx-auto">
          -
        </div>
      )
    }

    const bookIds = displayOdds.book?.split(',').map(id => id.trim()).filter(Boolean) ?? []
    const logoElements = bookIds.map((bookId, index) => {
      const sportsbook = getSportsbookById(bookId)
      return sportsbook?.image?.light ? (
        <img
          key={`${bookId}-${index}`}
          src={sportsbook.image.light}
          alt={sportsbook.name}
          className="w-3 h-3 object-contain flex-shrink-0"
        />
      ) : null
    }).filter(Boolean)

    const showInlineLogos = logoElements.length > 0 && logoElements.length <= 3

    const logosInline = showInlineLogos ? (
      <div className="flex gap-0.5">
        {logoElements}
      </div>
    ) : null

    const logosTooltip = !showInlineLogos && bookIds.length >= 4 ? (
      <Tooltip
        content={
          <div className="flex flex-wrap gap-2 max-w-[200px] p-2">
              {bookIds.map((bookId, index) => {
                const sportsbook = getSportsbookById(bookId)
                return sportsbook?.image?.light ? (
                  <div key={`${bookId}-${index}`} className="flex items-center gap-1">
                    <img
                      src={sportsbook.image.light}
                      alt={sportsbook.name}
                      className="w-4 h-4 object-contain"
                    />
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {sportsbook.name}
                    </span>
                  </div>
                ) : null
              })}
            </div>
        }
      >
        <div className="text-[10px] text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 cursor-help select-none">
          {bookIds.length} books
        </div>
        </Tooltip>
    ) : null

    // Better odds indicator
    const betterOddsIndicator = hasGlobalBetter && globalBest ? (
      <Tooltip
        content={
          <div className="text-xs p-2">
              <div className="font-medium">Better odds available:</div>
            <div className="text-amber-600 dark:text-amber-400">
                {formatLine(globalBest.line, side, rowItem)}/{formatOdds(globalBest.price)}
              </div>
            <div className="text-neutral-500 dark:text-neutral-300 text-[10px] mt-1">
              {(() => {
                const sb = globalBest.book ? getSportsbookById(globalBest.book) : undefined
                return <>at {sb?.name ?? globalBest.book ?? '—'}</>
              })()}
              </div>
            </div>
        }
      >
        <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center cursor-help">
          <span className="text-[8px] text-white font-bold">!</span>
        </div>
        </Tooltip>
    ) : null

    const firstBookId = bookIds[0]

    // Build chip content similar to alternates styling (icon + label/odds)
    const isMoneyline = rowItem.entity.type === 'game' && (
      rowItem.entity.details === 'Moneyline' ||
      (((rowItem.odds?.best?.over?.line ?? 0) === 0) && ((rowItem.odds?.best?.under?.line ?? 0) === 0))
    )
    const label = isMoneyline
      ? (side === 'under' ? rowItem.event.awayTeam : rowItem.event.homeTeam)
      : formatLine(displayOdds.line, side, rowItem)

    const chip = (
      <div className="best-line best-line--sm">
        {(() => {
          if (showInlineLogos && logoElements.length > 0) return logoElements[0]
          if (firstBookId) {
            const sb = getSportsbookById(firstBookId)
            return sb?.image?.light ? (
              <img src={sb.image.light} alt={sb.name} className="w-3.5 h-3.5 object-contain" />
            ) : null
          }
          return null
        })()}
        <span>
          {label}/{formatOdds(displayOdds.price)}
        </span>
      </div>
    )

    const sbName = firstBookId ? (getSportsbookById(firstBookId)?.name ?? 'Sportsbook') : 'Sportsbook'
    const interactive = (
      displayOdds.link || firstBookId ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
              if (displayOdds.link) {
                window.open(displayOdds.link, '_blank', 'noopener,noreferrer')
            } else if (firstBookId) {
              onOddsClick?.(rowItem, side, firstBookId)
            }
          }}
          className="w-full hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
        >
          {chip}
        </button>
      ) : (
        chip
      )
    )

    return (
      <div className="flex items-center gap-1">
        <Tooltip content={`Place bet on ${sbName}`}>
          <div>{interactive}</div>
        </Tooltip>
        {betterOddsIndicator}
      </div>
    )
  }

  // Helper function to get team logo URL efficiently
  const getTeamLogoUrl = (teamName: string): string => {
    if (!teamName) return ''
    const abbr = getStandardAbbreviation(teamName, sport)
    return `/team-logos/${sport}/${abbr.toUpperCase()}.svg`
  }

  // Helper function to check if sport has team logos available
  const hasTeamLogos = (sportKey: string): boolean => {
    const sportsWithLogos = ['nfl', 'nhl', 'nba'] // Sports with team logos
    return sportsWithLogos.includes(sportKey.toLowerCase())
  }

  const handleOddsClick = (item: OddsTableItem, side: 'over' | 'under') => {
    const oddsData = side === 'over' ? item.odds.best.over : item.odds.best.under
    if (oddsData && onOddsClick) {
      onOddsClick(item, side, oddsData.book)
    }
  }

  // Handle all column reordering in a single handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Check if it's a main column
    const isMainColumn = filteredColumnOrder.includes(active.id as string)
    
    if (isMainColumn) {
      const oldIndex = filteredColumnOrder.indexOf(active.id as string)
      const newIndex = filteredColumnOrder.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(filteredColumnOrder, oldIndex, newIndex)
        setColumnOrder(newOrder)
        updatePreferences({ columnOrder: newOrder })
        onColumnOrderChange?.(newOrder)
      }
    } else {
      // It's a sportsbook column - use orderedSportsbooks to include ALL books
      const allBookIds = orderedSportsbooks.map(b => b.id)
      const oldIndex = allBookIds.indexOf(active.id as string)
      const newIndex = allBookIds.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(allBookIds, oldIndex, newIndex)
        setSportsbookOrder(newOrder)
        updatePreferences({ sportsbookOrder: newOrder })
      }
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" /> // Placeholder space
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  // Map react-table rows by id so we can interleave date separators with rows
  const tableRows = tableProps.table.getRowModel().rows
  const rowById = useMemo(() => {
    const map = new Map<string, (typeof tableRows)[number]>()
    tableRows.forEach((r) => map.set(r.id, r))
    return map
  }, [tableRows])

  // Compute total number of visible columns for proper colSpan on separators
  const totalColumns = useMemo(
    () =>
      (tableProps.table.getHeaderGroups()?.[0]?.headers?.length as number | undefined) ??
      (filteredColumnOrder.length + orderedSportsbooks.length),
    [tableProps.table, filteredColumnOrder.length, orderedSportsbooks.length]
  )

  // Determine the pixel width of the sticky left entity column so the date
  // separator can include a matching sticky cell for persistent visibility.
  const entityColWidth = useMemo(() => {
    try {
      const headers = tableProps.table.getHeaderGroups()?.[0]?.headers || []
      const entityHeader = headers.find((h: any) => h.column?.id === 'entity')
      const sz = entityHeader?.column?.columnDef?.size
      return typeof sz === 'number' && sz > 0 ? sz : 220
    } catch {
      return 220
    }
  }, [tableProps.table])

  // Error boundary state
  if (hasError) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Something went wrong
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          We&apos;re working to fix this issue. Please refresh the page.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Page
        </button>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden ${className}`}>
        <OddsTableSkeleton 
          rows={8}
          sportsbookCount={Math.min(orderedSportsbooks.length || 6, 8)}
          showBestLine={preferences?.showBestLine ?? true}
          showAverageLine={preferences?.showAverageLine ?? true}
        />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 font-medium mb-2">Error Loading Data</div>
            <div className="text-neutral-500 dark:text-neutral-400 text-sm">{error}</div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!groupedData || groupedData.length === 0) {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-neutral-900 dark:text-neutral-100 font-medium mb-2">No Data Available</div>
            <div className="text-neutral-500 dark:text-neutral-400 text-sm">
              No odds data found for {sport.toUpperCase()} {type} {market} ({scope})
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden ${className}`}>
        <div ref={containerRef} className="overflow-auto" style={{ maxHeight: height }}>
          {/* Single DndContext for all columns */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
                <SortableContext 
              items={[...filteredColumnOrder, ...orderedSportsbooks.map(b => b.id)]} 
                  strategy={horizontalListSortingStrategy}
                >
              {/* Custom Table with ExpandableRowWrapper */}
              <table className="w-full border-separate border-spacing-0">
                <thead className="table-header-gradient backdrop-blur supports-[backdrop-filter]:backdrop-blur">
                  {tableProps.table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        // Check if this is a sportsbook column (not entity, event, best-line, average-line)
                        const isBookColumn = !['entity', 'event', 'best-line', 'average-line'].includes(header.column.id)
                        return (
                        <th
                          key={header.id}
                          className={cn(
                            "bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-left font-medium text-xs",
                            header.column.id === 'average-line' && 'hidden sm:table-cell',
                            header.column.id === 'entity' && 'sticky left-0 z-20 bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-50/60 dark:supports-[backdrop-filter]:bg-neutral-900/60',
                            isBookColumn && 'books'
                          )}
                          style={{
                            minWidth: header.column.columnDef.minSize,
                            maxWidth: header.column.columnDef.maxSize,
                            width: header.column.columnDef.size || 'auto',
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                        )
                      })}
            </tr>
                  ))}
          </thead>
                <tbody>
                  {(isSmallScreen ? groupedData.slice(visibleRange.start, visibleRange.end) : groupedData).map((entry, localIdx) => {
                    const idx = isSmallScreen ? visibleRange.start + localIdx : localIdx
                    // Render a full-width date separator row
                    if (entry.type === 'separator') {
                      return (
                        <tr key={`date-${entry.date}-${idx}`}>
                          {/* Sticky left date cell so date stays visible while horizontally scrolling */}
                          <td
                            className="date-row sticky left-0 z-10"
                            style={{ width: entityColWidth, minWidth: entityColWidth }}
                          >
                            {entry.dateLabel}
                          </td>
                          {/* Fill the rest of the row with the same background so it reads like a single bar */}
                          <td
                            colSpan={Math.max(totalColumns - 1, 1)}
                            className="date-row"
                          />
                        </tr>
                      )
                    }

                    // Otherwise render the normal data row
                    const row = rowById.get(entry.item.id)
                    if (!row) return null
                    const item = row.original
                    const isMoneyline = item.entity.type === 'game' && item.entity.details === 'Moneyline'
                    const rowBg = idx % 2 === 0 ? 'table-row-even' : 'table-row-odd'
                    // Sticky column needs solid background that matches the zebra pattern
                    const stickyBg = idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-[#f0f9ff] dark:bg-[#17202B]'

                    const cells = row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-left text-sm',
                          rowBg,
                          cell.column.id === 'average-line' && 'hidden sm:table-cell',
                          cell.column.id === 'entity' && `sticky left-0 z-10 ${stickyBg}`
                        )}
                        style={{
                          minWidth: cell.column.columnDef.minSize,
                          maxWidth: cell.column.columnDef.maxSize,
                          width: cell.column.columnDef.size || 'auto',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))

                    if (isMoneyline) {
                      return (
                        <tr key={row.id} className={cn('group relative transition-colors', rowBg, 'hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]')}>
                          {cells}
                        </tr>
                      )
                    }

                    return (
                      <ExpandableRowWrapper
                        key={row.id}
                        sid={item.id}
                        sport={sport}
                        primaryLine={item.odds.best.over?.line || item.odds.best.under?.line}
                        columnOrder={filteredColumnOrder}
                        sportsbookOrder={orderedSportsbooks.map((b) => b.id)}
                        includeAlternates={preferences.includeAlternates}
                        isPro={isPro}
                        setShowProGate={setShowProGate}
                        rowClassName={rowBg}
                      >
                        {cells}
                      </ExpandableRowWrapper>
                    )
                  })}
                  {isSmallScreen && (
                    <>
                      {/* top spacer */}
                      {visibleRange.start > 0 && (
                        <tr>
                          <td colSpan={totalColumns} style={{ height: visibleRange.start * ROW_HEIGHT }} />
                        </tr>
                      )}
                      {/* bottom spacer */}
                      {visibleRange.end < groupedData.length && (
                        <tr>
                          <td colSpan={totalColumns} style={{ height: (groupedData.length - visibleRange.end) * ROW_HEIGHT }} />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
        </table>
            </SortableContext>
        </DndContext>
        </div>
      </div>
      
      {/* Pro Gate Modal for Deep Linking */}
      <ProGateModal 
        isOpen={showProGate} 
        onClose={() => setShowProGate(false)}
        feature="Deep Linking"
      />
    </TooltipProvider>
  )
}
