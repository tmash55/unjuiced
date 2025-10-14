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
import { createColumnHelper } from '@tanstack/react-table'
import { Table, useTable } from '@/components/table'

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
  isMoneyline: boolean
  onClick: (e: React.MouseEvent) => void
  // Pass in formatters to avoid referencing outer scope (keeps memo stable)
  formatOdds: (price: number) => string
  formatLine: (line: number, side: 'over' | 'under') => string
}) {
  const { sportsbookName, side, odds, isHighlighted, priceChanged, lineChanged, isMoneyline, onClick, formatOdds, formatLine } = props
  return (
    <Tooltip content={`Place bet on ${sportsbookName}`}>
      <button
        onClick={onClick}
        className={`block w-full text-xs rounded-md px-2 py-1.5 mx-auto transition-all cursor-pointer font-medium min-w-fit ${
          isHighlighted
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-800/40'
            : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600'
        }`}
      >
        <div className="text-center">
          {isMoneyline ? (
            <>
              <div className="text-sm font-semibold">
                <span className={`${priceChanged ? 'bg-yellow-200 dark:bg-yellow-800/60 px-1 rounded transition-colors' : ''}`}>
                  {formatOdds(odds.price)}
                </span>
              </div>
              <div className="text-xs opacity-75">
                <span className={`${lineChanged ? 'bg-blue-200 dark:bg-blue-800/60 px-1 rounded transition-colors' : ''}`}>
                  {formatLine(odds.line, side)}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs font-medium">
              <span className={`opacity-75 ${lineChanged ? 'bg-blue-200 dark:bg-blue-800/60 px-1 rounded transition-colors' : ''}`}>{formatLine(odds.line, side)}</span>
              <span className={`ml-1 font-semibold ${priceChanged ? 'bg-yellow-200 dark:bg-yellow-800/60 px-1 rounded transition-colors' : ''}`}>{formatOdds(odds.price)}</span>
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
  
  const isMoneyline = item.entity.type === 'game' && item.entity.details === 'Moneyline'
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
  columnHighlighting: boolean = true
) => {
  const rowBg = altIndex % 2 === 0 ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-neutral-200 dark:bg-neutral-900'
  const borderColor = 'border-neutral-200 dark:border-neutral-700'
  return (
  <tr key={row.key} className={rowBg}>
    {columnOrder.map((columnId: string) => {
      switch (columnId) {
        case 'entity':
          return (
            <td
              key="entity"
              className={`px-4 py-3 text-xs text-blue-700 dark:text-blue-300 border-r ${borderColor} sticky left-0 z-10 ${rowBg}`}
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
            className={`block w-full text-xs rounded-md px-2 py-1.5 mx-auto transition-all cursor-pointer font-medium min-w-fit ${
              isBestAltOdds
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-800/40'
                : 'bg-neutral-50 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600'
            }`}
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
  maxSportsbookColumns = 14,
  onRowClick,
  onOddsClick,
  onColumnOrderChange,
  className = '',
  columnHighlighting = true,
  searchQuery = ''
}: OddsTableProps) {
  const [sortField, setSortField] = useState<SortField>('startTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { preferences, updatePreferences, isLoading } = useOddsPreferences()
  const allActiveSportsbooks = useMemo(() => getAllActiveSportsbooks(), [])

  // Track changes for visual feedback (SSE updates)
  const [changedRows, setChangedRows] = useState<Set<string>>(new Set())
  const [newRows, setNewRows] = useState<Set<string>>(new Set())
  const [changedPriceCells, setChangedPriceCells] = useState<Set<string>>(new Set())
  const [changedLineCells, setChangedLineCells] = useState<Set<string>>(new Set())
  const prevDataRef = useRef<Map<string, OddsTableItem>>(new Map())
  const isInitialMount = useRef(true)
  const activeSportsbookIds = useMemo(
    () => allActiveSportsbooks.map((book) => book.id),
    [allActiveSportsbooks]
  )

  // Detect changes for visual feedback (skip on initial mount and when not live)
  useEffect(() => {
    if (!data || data.length === 0) return
    if (!scope || scope !== 'live') {
      // Non-live scopes should not animate on data reloads
      prevDataRef.current = new Map(data.map((d) => [d.id, d]))
      isInitialMount.current = false
      return
    }

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
              if (curSide.price !== prevSide.price) priceChanged.add(`${baseKey}|price`)
              if ((curSide.line ?? 0) !== (prevSide.line ?? 0)) lineChanged.add(`${baseKey}|line`)
            } else if (curSide && !prevSide) {
              // newly added side -> treat as both price and line changed
              priceChanged.add(`${baseKey}|price`)
              lineChanged.add(`${baseKey}|line`)
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

    prevDataRef.current = currentMap
  }, [data])
  
  // Use visibleSportsbooks prop or fall back to user preferences
  const effectiveVisibleSportsbooks = useMemo(() => {
    return visibleSportsbooks || preferences?.selectedBooks || activeSportsbookIds
  }, [visibleSportsbooks, preferences?.selectedBooks, activeSportsbookIds])
  
  const [columnOrder, setColumnOrder] = useState<string[]>(preferences.columnOrder)
  
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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [alternatesCache, setAlternatesCache] = useState<Record<string, any>>({})
  const [alternatesLoading, setAlternatesLoading] = useState<Record<string, boolean>>({})
  const [alternateRows, setAlternateRows] = useState<Record<string, Record<string, AlternateRowData[]>>>({})

  // Helper function to get available lines from alternate data
  const getAvailableLines = (item: OddsTableItem): number[] => {
    const eventId = item.event.id
    const playerId = item.entity.id
    
    const altRows = type === 'player' && playerId
      ? alternateRows[eventId]?.[playerId] || []
      : type === 'game'
      ? alternateRows[eventId]?.['game'] || []
      : []
    
    // Extract unique line values and sort them
    const lines = altRows.map(row => row.lineValue).filter(line => line != null)
    const uniqueLines = Array.from(new Set(lines)).sort((a, b) => a - b)
    
    return uniqueLines
  }

  // Helper to check if alternates are being loaded for an event
  const isLoadingAlternates = (eventId: string): boolean => {
    return alternatesLoading[eventId] || false
  }

  // Helper function to get alternate data for a specific line
  const getAlternateDataForLine = (item: OddsTableItem, selectedLine: number): AlternateRowData | null => {
    const eventId = item.event.id
    const playerId = item.entity.id
    
    const altRows = type === 'player' && playerId
      ? alternateRows[eventId]?.[playerId] || []
      : type === 'game'
      ? alternateRows[eventId]?.['game'] || []
      : []
    
    // Find the alternate row that matches the selected line
    return altRows.find(row => row.lineValue === selectedLine) || null
  }

  // State to track custom line selections for each row
  const [customLineSelections, setCustomLineSelections] = useState<Record<string, number>>({})
  const [globalSelectedLine, setGlobalSelectedLine] = useState<number | 'primary'>('primary')

  // Memoized cache for processed row data to avoid expensive recalculations
  const processedRowCache = useMemo(() => new Map<string, OddsTableItem>(), [])

  // Function to fetch alternate odds data for a specific event
  const fetchAlternates = useCallback(async (eventId: string) => {
    if (alternatesCache[eventId] || alternatesLoading[eventId]) {
      return
    }

    setAlternatesLoading(prev => ({ ...prev, [eventId]: true }))
    try {
      const query = new URLSearchParams({ sport, type, market, scope, eventId })
      const response = await fetch(`/api/odds-screen/alternates?${query.toString()}`)
      const result = await response.json()
      if (result?.success) {
        const playersInPayload = Object.keys(result?.data?.players || {})
        console.log('[Alternates] cache set for event', eventId, 'players:', playersInPayload)
        setAlternatesCache(prev => ({ ...prev, [eventId]: result.data }))
      } else {
        console.error('Failed to fetch alternates', result?.error)
      }
    } catch (error) {
      console.error('Error fetching alternates', error)
    } finally {
      setAlternatesLoading(prev => ({ ...prev, [eventId]: false }))
    }
  }, [alternatesCache, alternatesLoading, sport, type, market, scope])

  // Helper function to update primary row data with selected line
  const updatePrimaryRowWithLine = useCallback(async (item: OddsTableItem, selectedLine: number) => {
    const rowKey = `${item.event.id}-${item.entity.id || 'game'}`
    
    // Performance tracking for interactions
    performanceRef.current.interactionStart = performance.now()
    
    // Ensure alternates are fetched before trying to update
    if (!alternatesCache[item.event.id]) {
      console.log(`[Line Selection] Fetching alternates for event ${item.event.id}`)
      await fetchAlternates(item.event.id)
    }
    
    const alternateData = getAlternateDataForLine(item, selectedLine)
    
    if (alternateData) {
      // Precompute and seed cache for the target line to avoid UI flicker
      const cacheKeyForNewLine = `${rowKey}-${selectedLine}`
      try {
        const merged: OddsTableItem = {
          ...item,
          odds: {
            ...item.odds,
            best: {
              over: alternateData.best.over ? { ...alternateData.best.over, line: selectedLine } : undefined,
              under: alternateData.best.under ? { ...alternateData.best.under, line: selectedLine } : undefined,
            },
            books: Object.fromEntries(
              Object.entries(alternateData.books).map(([bookId, bookData]) => [
                bookId,
                {
                  over: bookData.over ? { ...bookData.over, line: selectedLine } : undefined,
                  under: bookData.under ? { ...bookData.under, line: selectedLine } : undefined,
                },
              ])
            ),
          },
        }
        processedRowCache.set(cacheKeyForNewLine, merged)
      } catch {}

      // Store the custom line selection (will read from cache on next render)
      setCustomLineSelections(prev => {
        const newSelections = {
          ...prev,
          [rowKey]: selectedLine
        }
        // Track interaction performance
        const interactionTime = performance.now() - performanceRef.current.interactionStart
        if (interactionTime > 100) {
          console.warn(`[Performance] Slow interaction: ${interactionTime.toFixed(2)}ms`)
        }
        return newSelections
      })
    } else {
      console.warn(`[Line Selection] No alternate data found for line ${selectedLine} on event ${item.event.id}`)
    }
  }, [processedRowCache, alternatesCache, fetchAlternates, getAlternateDataForLine])

  // Helper function to reset to primary line
  const resetToPrimaryLine = useCallback((item: OddsTableItem) => {
    const rowKey = `${item.event.id}-${item.entity.id || 'game'}`
    
    // Performance tracking for reset operations
    
    // Seed cache with the BASE primary row from current data (not the processed/alt row)
    try {
      const base = data.find(
        (d) => (d.id && d.id === item.id) || (d.event.id === item.event.id && (d.entity.id || '') === (item.entity.id || ''))
      )
      if (base) processedRowCache.set(rowKey, base)
      else processedRowCache.delete(rowKey)
    } catch {}
    
    // Remove the custom line selection to revert to primary
    setCustomLineSelections(prev => {
      const newSelections = { ...prev }
      delete newSelections[rowKey]
      // Efficient state update
      return newSelections
    })
  }, [processedRowCache, data])

  // Eagerly fetch alternates for visible rows on mount to enable backfill on page load
  useEffect(() => {
    if (!preferences.includeAlternates || data.length === 0) return
    const uniqueEvents = Array.from(new Set(data.slice(0, 20).map(item => item.event.id)))
    uniqueEvents.forEach(eventId => {
      if (!alternatesCache[eventId] && !alternatesLoading[eventId]) {
        void fetchAlternates(eventId)
      }
    })
  }, [data, preferences.includeAlternates, alternatesCache, alternatesLoading, fetchAlternates])

  // Sort and merge data with missing sides filled from alternates, then group by date
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Optimized data processing with caching
    const dataWithFilledSides = data.map(item => {
      const rowKey = `${item.event.id}-${item.entity.id || 'game'}`
      const customLine = customLineSelections[rowKey]
      
      // Create cache key that includes custom line selection
      const cacheKey = customLine ? `${rowKey}-${customLine}` : rowKey
      
      // Check cache first to avoid expensive recalculations
      if (processedRowCache.has(cacheKey)) {
        return processedRowCache.get(cacheKey)!
      }
      
      const alternateData = alternatesCache[item.event.id]
      let processedItem = alternateData ? fillMissingSides(item, alternateData, type) : item
      // Also backfill missing books from alternates (nearest to primary line)
      if (alternateData) {
        const altRowsForEvent: Record<string, AlternateRowData[]> = (() => {
          const next: Record<string, AlternateRowData[]> = {}
          if (type === 'player') {
            const players = (alternateData as any)?.players || {}
            Object.keys(players).forEach((pid) => {
              const rows = parsePlayerAlternateRows(alternateData, pid)
              if (rows.length) next[pid] = rows
            })
          } else if (type === 'game') {
            const rows = parseGameAlternateRows(alternateData, item.event.id)
            if (rows.length) next['game'] = rows
          }
          return next
        })()
        processedItem = fillMissingBooksFromAlternates(processedItem, altRowsForEvent)
      }
      
      if (customLine && alternateData) {
        // Replace primary row data with selected alternate line data
        const alternateRowData = getAlternateDataForLine(item, customLine)
        if (alternateRowData) {
          // Applying custom line data transformation
          
          // Create new item with alternate line data
          processedItem = {
            ...processedItem,
            odds: {
              ...processedItem.odds,
              best: {
                over: alternateRowData.best.over ? { ...alternateRowData.best.over, line: customLine } : undefined,
                under: alternateRowData.best.under ? { ...alternateRowData.best.under, line: customLine } : undefined
              },
              books: Object.fromEntries(
                Object.entries(alternateRowData.books).map(([bookId, bookData]) => [
                  bookId,
                  {
                    over: bookData.over ? { ...bookData.over, line: customLine } : undefined,
                    under: bookData.under ? { ...bookData.under, line: customLine } : undefined
                  }
                ])
              )
            }
          }
          
          // Data transformation complete
        } else {
          // No alternate data available for selected line
        }
      }
      
      // Cache the result with the appropriate key
      processedRowCache.set(cacheKey, processedItem)
      return processedItem
    })

    // Apply search filtering if searchQuery is provided
    const filteredData = searchQuery.trim() 
      ? dataWithFilledSides.filter(item => {
          const query = searchQuery.toLowerCase().trim()
          
          // For player props, search in player name
          if (type === 'player' && item.entity?.name) {
            return item.entity.name.toLowerCase().includes(query)
          }
          
          // For game props, search in team names
          if (type === 'game') {
            const homeTeam = item.event?.homeTeam?.toLowerCase() || ''
            const awayTeam = item.event?.awayTeam?.toLowerCase() || ''
            return homeTeam.includes(query) || awayTeam.includes(query)
          }
          
          return false
        })
      : dataWithFilledSides

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
  }, [data, sortField, sortDirection, alternatesCache, type, customLineSelections, searchQuery])

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

  // Virtual scrolling optimization for large datasets
  const ITEMS_PER_PAGE = 100 // Optimized for better UX while maintaining performance
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: ITEMS_PER_PAGE })

  // Debounced updates for high-frequency interactions
  const debouncedUpdateLine = useCallback(
    (() => {
      let timeoutId: ReturnType<typeof setTimeout>
      return (item: OddsTableItem, line: number) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(async () => {
          await updatePrimaryRowWithLine(item, line)
        }, 150)
      }
    })(),
    [updatePrimaryRowWithLine]
  )
  
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

  useEffect(() => {
    if (!isLoading) {
      setColumnOrder(preferences.columnOrder)
      setSportsbookOrder(preferences.sportsbookOrder)
    }
  }, [isLoading, preferences.columnOrder, preferences.sportsbookOrder])



  // Cleanup cache when data changes to prevent memory leaks
  useEffect(() => {
    processedRowCache.clear()
    // Also cleanup custom selections for rows that no longer exist
    if (data.length > 0) {
      const currentRowKeys = new Set(data.map(item => `${item.event.id}-${item.entity.id || 'game'}`))
      setCustomLineSelections(prev => {
        const cleaned = Object.fromEntries(
          Object.entries(prev).filter(([key]) => currentRowKeys.has(key))
        )
        return Object.keys(cleaned).length !== Object.keys(prev).length ? cleaned : prev
      })
    }
  }, [data, processedRowCache])

  // Memoized calculation functions for better performance
  const memoizedCalculateUserBestOdds = useCallback((rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    return calculateUserBestOdds(rowItem, side, visibleSportsbooks)
  }, [])

  const memoizedCalculateUserAverageOdds = useCallback((rowItem: OddsTableItem, side: 'over' | 'under', visibleSportsbooks: string[]) => {
    return calculateUserAverageOdds(rowItem, side, visibleSportsbooks)
  }, [])

  // Optimized batch fetching of alternates for line selectors and missing sides
  useEffect(() => {
    if (!data || data.length === 0) return

    // Get unique event IDs from current data
    const eventIds = Array.from(new Set(data.map(item => item.event.id)))
    const eventsToFetch = eventIds.filter(eventId => 
      !alternatesCache[eventId] && !alternatesLoading[eventId]
    )
    
    if (eventsToFetch.length === 0) return

    // Batch fetch with intelligent prioritization
    const batchFetch = async () => {
      // Prioritize visible rows (first 20) for immediate dropdown population
      const visibleEventIds = eventIds.slice(0, 20)
      const priorityFetches = eventsToFetch.filter(id => visibleEventIds.includes(id))
      const backgroundFetches = eventsToFetch.filter(id => !visibleEventIds.includes(id))

      // Fetch priority events in parallel (max 5 concurrent)
      const priorityBatches = []
      for (let i = 0; i < priorityFetches.length; i += 5) {
        const batch = priorityFetches.slice(i, i + 5)
        priorityBatches.push(
          Promise.all(batch.map(eventId => fetchAlternates(eventId)))
        )
      }

      // Execute priority batches sequentially to avoid overwhelming the server
      for (const batchPromise of priorityBatches) {
        await batchPromise
      }

      // Then fetch remaining events in background with delay
      if (backgroundFetches.length > 0) {
        setTimeout(() => {
          backgroundFetches.forEach(eventId => {
            if (!alternatesCache[eventId] && !alternatesLoading[eventId]) {
              void fetchAlternates(eventId)
            }
          })
        }, 1000) // 1 second delay for background fetches
      }
    }

    void batchFetch()
  }, [data, alternatesCache, alternatesLoading, fetchAlternates])

  // Reset alternates when core parameters change (sport/type/market/scope)
  useEffect(() => {
    // Collapse immediately for snappy UX when the primary market switches
    setExpandedRows({})
    // Clear alternates caches so new market can fetch cleanly
    setAlternatesCache({})
    setAlternatesLoading({})
    setAlternateRows({})
  }, [sport, type, market, scope])

  useEffect(() => {
    const next: Record<string, Record<string, AlternateRowData[]>> = {}
    Object.entries(alternatesCache).forEach(([eventId, cache]) => {
      if (type === 'player') {
        // Handle player alternates
        const players = (cache as any)?.players || {}
        Object.keys(players).forEach((playerId) => {
          const rows = parsePlayerAlternateRows(cache, playerId)
          if (rows.length > 0) {
            if (!next[eventId]) next[eventId] = {}
            next[eventId][playerId] = rows
          }
        })
      } else if (type === 'game') {
        // Handle game alternates - use 'game' as the ID since there's only one per event
        const rows = parseGameAlternateRows(cache, eventId)
        if (rows.length > 0) {
          if (!next[eventId]) next[eventId] = {}
          next[eventId]['game'] = rows
        }
      }
    })
    setAlternateRows(next)
  }, [alternatesCache, type])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Determine which sportsbooks to show as columns
  const displaySportsbooks = useMemo(() => {
    const preferredSportsbooks = preferences.selectedBooks && preferences.selectedBooks.length
      ? preferences.selectedBooks
      : activeSportsbookIds
    const allSportsbooks = [...allActiveSportsbooks].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    )

    if (visibleSportsbooks && visibleSportsbooks.length > 0) {
      const filteredBooks = visibleSportsbooks
        .map((id) => getSportsbookById(id))
        .filter((book): book is SportsbookMeta => book !== undefined && (book.isActive ?? true))

      return filteredBooks.slice(0, maxSportsbookColumns)
    }

    const preferredBooks = preferredSportsbooks
      .map((id) => getSportsbookById(id))
      .filter((book): book is SportsbookMeta => book !== undefined && (book.isActive ?? true))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))

    return preferredBooks.slice(0, maxSportsbookColumns)
  }, [
    preferences.selectedBooks,
    activeSportsbookIds,
    visibleSportsbooks,
    maxSportsbookColumns,
    allActiveSportsbooks,
  ])

  // Get all sportsbooks (show all configured books, display "-" for missing data)
  const availableSportsbooks = useMemo(() => displaySportsbooks, [displaySportsbooks])

  // Initialize sportsbook order when availableSportsbooks changes
  React.useEffect(() => {
    if (availableSportsbooks.length > 0 && sportsbookOrder.length === 0) {
      setSportsbookOrder(availableSportsbooks.map(book => book.id))
    }
  }, [availableSportsbooks, sportsbookOrder.length])

  // Create ordered sportsbooks based on current order
  const orderedSportsbooks = useMemo(() => {
    if (!sportsbookOrder || sportsbookOrder.length === 0) return availableSportsbooks
    
    const ordered = sportsbookOrder
      .map(id => availableSportsbooks.find(book => book.id === id))
      .filter(Boolean) as SportsbookMeta[]
    
    // Add any new sportsbooks that aren't in the order yet
    const missingBooks = availableSportsbooks.filter(book => !sportsbookOrder.includes(book.id))
    return [...ordered, ...missingBooks]
  }, [availableSportsbooks, sportsbookOrder])

  // Build columns for Table component (Dub-style)
  const columnHelper = createColumnHelper<OddsTableItem>()

  const tableColumns = useMemo(() => {
    const cols: any[] = []

    cols.push(
      columnHelper.display({
        id: 'entity',
        header: 'Entity',
        size: 220,
        cell: (info) => {
          const item = info.row.original
          if (item.entity.type === 'game') {
            return (
              <div className="min-w-[200px]">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {item.event?.awayTeam} @ {item.event?.homeTeam}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {item.entity.details}
                </div>
              </div>
            )
          }
          return (
            <div className="min-w-[200px]">
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {item.entity?.name || 'Unknown'}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {item.entity?.details}
              </div>
            </div>
          )
        }
      }),

      columnHelper.display({
        id: 'event',
        header: 'Event',
        size: 110,
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

      columnHelper.display({
        id: 'best-line',
        header: 'Best Line',
        size: 140,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="space-y-1 text-center">
              {renderBestOddsButton(item, 'over', effectiveVisibleSportsbooks)}
              {renderBestOddsButton(item, 'under', effectiveVisibleSportsbooks)}
            </div>
          )
        }
      }),

      columnHelper.display({
        id: 'average-line',
        header: 'Avg Line',
        size: 140,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="space-y-1 text-center">
              {renderAverageOddsButton(item, 'over', effectiveVisibleSportsbooks)}
              {renderAverageOddsButton(item, 'under', effectiveVisibleSportsbooks)}
            </div>
          )
        }
      }),
    )

    // Dynamic sportsbook columns
    orderedSportsbooks.forEach((book) => {
      cols.push(
        columnHelper.display({
          id: book.id,
          header: () => (
            <div className="flex flex-col items-center space-y-1 min-w-[120px]">
              <img src={book.image.light} alt={book.name} className="h-6 w-auto object-contain" />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{book.name}</span>
            </div>
          ),
          size: 140,
          cell: (info) => {
            const item = info.row.original
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

            return (
              <div className="space-y-1">
                {bookData.over ? (
                  ((odds) => {
                    const isBestOdds = (() => {
                      const { userBest } = calculateUserBestOdds(item, 'over', effectiveVisibleSportsbooks)
                      return !!userBest && odds.price === userBest.price && (odds.line ?? 0) === (userBest.line ?? 0)
                    })()
                    const cellKeyPrice = `${item.id}|${book.id}|over|price`
                    const cellKeyLine = `${item.id}|${book.id}|over|line`
                    const priceChanged = changedPriceCells.has(cellKeyPrice)
                    const lineChanged = changedLineCells.has(cellKeyLine)
                    const onClick = (e: React.MouseEvent) => {
                      e.stopPropagation()
                      if (typeof odds.link === 'string' && odds.link.length > 0) {
                        window.open(odds.link, '_blank', 'noopener,noreferrer')
                      } else {
                        onOddsClick?.(item, 'over', book.id)
                      }
                    }
                    const moneyline = item.entity.type === 'game' && item.entity.details === 'Moneyline'
                    return (
                      <OddsCellButton
                        itemId={item.id}
                        sportsbookId={book.id}
                        sportsbookName={book.name}
                        side={'over'}
                        odds={odds}
                        isHighlighted={isBestOdds}
                        priceChanged={priceChanged}
                        lineChanged={lineChanged}
                        isMoneyline={moneyline}
                        formatOdds={(p) => (p > 0 ? `+${p}` : `${p}`)}
                        formatLine={(ln, sd) => {
                          if (moneyline) return sd === 'over' ? item.event.awayTeam : item.event.homeTeam
                          return sd === 'over' ? `o${ln}` : `u${ln}`
                        }}
                        onClick={onClick}
                      />
                    )
                  })(bookData.over)) : renderPlaceholder()}

                {bookData.under ? (
                  ((odds) => {
                    const isBestOdds = (() => {
                      const { userBest } = calculateUserBestOdds(item, 'under', effectiveVisibleSportsbooks)
                      return !!userBest && odds.price === userBest.price && (odds.line ?? 0) === (userBest.line ?? 0)
                    })()
                    const cellKeyPrice = `${item.id}|${book.id}|under|price`
                    const cellKeyLine = `${item.id}|${book.id}|under|line`
                    const priceChanged = changedPriceCells.has(cellKeyPrice)
                    const lineChanged = changedLineCells.has(cellKeyLine)
                    const onClick = (e: React.MouseEvent) => {
                      e.stopPropagation()
                      if (typeof odds.link === 'string' && odds.link.length > 0) {
                        window.open(odds.link, '_blank', 'noopener,noreferrer')
                      } else {
                        onOddsClick?.(item, 'under', book.id)
                      }
                    }
                    const moneyline = item.entity.type === 'game' && item.entity.details === 'Moneyline'
                    return (
                      <OddsCellButton
                        itemId={item.id}
                        sportsbookId={book.id}
                        sportsbookName={book.name}
                        side={'under'}
                        odds={odds}
                        isHighlighted={isBestOdds}
                        priceChanged={priceChanged}
                        lineChanged={lineChanged}
                        isMoneyline={moneyline}
                        formatOdds={(p) => (p > 0 ? `+${p}` : `${p}`)}
                        formatLine={(ln, sd) => {
                          if (moneyline) return sd === 'over' ? item.event.awayTeam : item.event.homeTeam
                          return sd === 'over' ? `o${ln}` : `u${ln}`
                        }}
                        onClick={onClick}
                      />
                    )
                  })(bookData.under)) : renderPlaceholder()}
              </div>
            )
          }
        })
      )
    })

    return cols
  }, [orderedSportsbooks, effectiveVisibleSportsbooks, changedPriceCells, changedLineCells])

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
    if (!line && line !== 0) return ''
    
    // For game markets, show contextual labels
    if (item?.entity.type === 'game') {
      const gameDetails = item.entity.details || ''
      
      if (gameDetails === 'Moneyline') {
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
        <div className="px-2 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-center min-w-fit mx-auto">
          -
        </div>
      )
    }

    return (
      <div className="px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-700 text-center min-w-fit mx-auto">
        {/* For moneylines only, show just odds (no team names in average). All other markets use horizontal layout */}
        {rowItem.entity.type === 'game' && rowItem.entity.details === 'Moneyline' ? (
          /* Moneylines: just show average odds */
          <div className="font-medium">
            {formatOdds(displayOdds.price)}
          </div>
        ) : (
          /* All other markets: horizontal layout (line + odds) */
          <div className="font-medium">
            <span className="opacity-75">{formatLine(displayOdds.line, side, rowItem)}</span>
            <span className="ml-1 font-semibold">{formatOdds(displayOdds.price)}</span>
          </div>
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

    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (displayOdds.link) {
              window.open(displayOdds.link, '_blank', 'noopener,noreferrer')
            } else if (firstBookId) {
              onOddsClick?.(rowItem, side, firstBookId)
            }
          }}
          className="text-xs flex items-center justify-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-2 py-1 transition-colors cursor-pointer"
        >
          <span className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            {formatLine(displayOdds.line, side, rowItem)}/{formatOdds(displayOdds.price)}
          </span>
          {logosInline}
          {logosTooltip}
        </button>
        {betterOddsIndicator}
      </div>
    )
  }

  // Helper function to get team logo URL efficiently
  const getTeamLogoUrl = (teamName: string): string => {
    if (!teamName) return ''
    const abbr = getStandardAbbreviation(teamName, sport)
    return `/images/team-logos/${sport}/${abbr.toUpperCase()}.svg`
  }

  // Helper function to check if sport has team logos available
  const hasTeamLogos = (sportKey: string): boolean => {
    const sportsWithLogos = ['nfl'] // Only NFL has logos currently
    return sportsWithLogos.includes(sportKey.toLowerCase())
  }

  const handleOddsClick = (item: OddsTableItem, side: 'over' | 'under') => {
    const oddsData = side === 'over' ? item.odds.best.over : item.odds.best.under
    if (oddsData && onOddsClick) {
      onOddsClick(item, side, oddsData.book)
    }
  }

  // Handle column reordering (main columns)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string)
      const newIndex = columnOrder.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(columnOrder, oldIndex, newIndex)
        setColumnOrder(newOrder)
        updatePreferences({ columnOrder: newOrder })
        onColumnOrderChange?.(newOrder)
      }
    }
  }

  // Handle sportsbook column reordering
  const handleSportsbookDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sportsbookOrder.indexOf(active.id as string)
      const newIndex = sportsbookOrder.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sportsbookOrder, oldIndex, newIndex)
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
        <div className="max-h-[82vh] overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {/* Dub-style Table component */}
          <Table
            {...tableProps}
            containerClassName="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            className="[&_th]:border-b [&_th]:border-neutral-200 [&_th]:dark:border-neutral-800 [&_td]:border-b [&_td]:border-neutral-200/50 [&_td]:dark:border-neutral-800/50"
            thClassName={() => "bg-neutral-50/50 dark:bg-neutral-900/50 font-medium text-xs uppercase tracking-wide"}
          />
          {/* Legacy header rendering retained for drag handles and controls; can be removed after full migration */}
          <table className="hidden">
            <thead>
              <tr>
                <SortableContext 
                  items={filteredColumnOrder} 
                  strategy={horizontalListSortingStrategy}
                >
                  {filteredColumnOrder.map((columnId) => {
                    switch (columnId) {
                      case 'entity':
                        return (
                          <SortableHeader
                            key="entity"
                            id="entity"
                          className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-default sticky left-0 bg-neutral-50 dark:bg-neutral-900 z-10 border-r border-neutral-200 dark:border-neutral-700"
                          >
                            <div className="flex items-center justify-between">
                              <span>{
                                type === 'game' 
                                  ? ((market.includes('home_team') || market.includes('home_total')) ? 'Home Team' : 
                                     (market.includes('away_team') || market.includes('away_total')) ? 'Away Team' : 'Game')
                                  : 'Player'
                              }</span>
                              {/* Global line selector (player markets only) */}
                              {type === 'player' && (
                                <div className="ml-2 flex items-center gap-2">
                                  <label className="text-[10px] text-neutral-400 dark:text-neutral-500">Line</label>
                                  <select
                                    onClick={(e) => e.stopPropagation()}
                                    value={globalSelectedLine}
                                    onChange={async (e) => {
                                      e.stopPropagation()
                                      const val = e.target.value
                                      if (val === 'primary') {
                                        setGlobalSelectedLine('primary')
                                        // reset all
                                        setCustomLineSelections({})
                                      } else {
                                        const num = parseFloat(val)
                                        if (!Number.isNaN(num)) {
                                          setGlobalSelectedLine(num)
                                          // apply to visible rows with available alternates
                                          const visibleEvents = Array.from(new Set(data.map(d => d.event.id)))
                                          // ensure alternates cached
                                          await Promise.all(visibleEvents.map(async (eid) => {
                                            if (!alternatesCache[eid] && !alternatesLoading[eid]) {
                                              await fetchAlternates(eid)
                                            }
                                          }))
                                          // set selections map
                                          setCustomLineSelections(prev => {
                                            const next: Record<string, number> = {}
                                            data.forEach(d => {
                                              if (d.entity.id) {
                                                // will be resolved per-row during render
                                                next[`${d.event.id}-${d.entity.id}`] = num
                                              }
                                            })
                                            return next
                                          })
                                        }
                                      }
                                    }}
                                    className="text-[11px] bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-neutral-700 dark:text-neutral-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="primary">Primary</option>
                                    {/* Populate with a merged set of available lines across visible rows (lightweight) */}
                                    {(() => {
                                      const lines = new Set<number>()
                                      data.slice(0, 50).forEach(d => {
                                        const rows = alternateRows[d.event.id]?.[d.entity.id || ''] || []
                                        rows.forEach((r: any) => lines.add(r.lineValue))
                                      })
                                      return Array.from(lines).sort((a,b)=>a-b).map(l => (
                                        <option key={l} value={l}>{l}</option>
                                      ))
                                    })()}
                                  </select>
                                </div>
                              )}
                              <SortIcon field="entity" />
                            </div>
                          </SortableHeader>
                        )
                      case 'event':
                        return (
                          <SortableHeader
                            key="event"
                            id="event"
                            className="px-3 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-r border-neutral-200 dark:border-neutral-700"
                            onClick={() => handleSort('startTime')}
                          >
                            <div className="flex items-center justify-between">
                              <span>Event</span>
                              <SortIcon field="startTime" />
                            </div>
                          </SortableHeader>
                        )
                      case 'best-line':
                        return (
                          <SortableHeader
                            key="best-line"
                            id="best-line"
                            className="px-3 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-default border-r border-neutral-200 dark:border-neutral-700"
                          >
                            <div className="flex items-center justify-center">
                              <span>Best Line</span>
                            </div>
                          </SortableHeader>
                        )
                      case 'average-line':
                        return (
                          <SortableHeader
                            key="average-line"
                            id="average-line"
                            className="px-3 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-default border-r border-neutral-200 dark:border-neutral-700"
                          >
                            <div className="flex items-center justify-center">
                              <span>Avg Line</span>
                            </div>
                          </SortableHeader>
                        )
                      default:
                        return null
                    }
                  })}
                </SortableContext>
              
              {/* Sportsbook columns - separate DnD context */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSportsbookDragEnd}
              >
                <SortableContext 
                  items={sportsbookOrder} 
                  strategy={horizontalListSortingStrategy}
                >
                  {orderedSportsbooks.map((sportsbook) => (
                    <SortableHeader
                      key={sportsbook.id}
                      id={sportsbook.id}
                      className="py-3 pl-4 pr-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[120px] border-r border-neutral-200 dark:border-neutral-700"
                      onClick={() => {
                        if (sportsbook.links.desktop) {
                          window.open(sportsbook.links.desktop, '_blank', 'noopener,noreferrer')
                        }
                      }}
                    >
                      <div className="flex flex-col items-center space-y-1 cursor-pointer hover:opacity-80 transition-opacity">
                        <img 
                          src={sportsbook.image.light} 
                          alt={sportsbook.name}
                          className="h-6 w-auto object-contain"
                        />
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{sportsbook.name}</span>
                      </div>
                    </SortableHeader>
                  ))}
                </SortableContext>
              </DndContext>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
            {groupedData.map((group, groupIndex) => {
              if (group.type === 'separator') {
                const totalColumns = columnOrder.length + orderedSportsbooks.length
                const columnsPerSection = Math.floor(totalColumns / 3)
                const remainder = totalColumns % 3
                
                return (
                  <tr key={`separator-${group.date}`} className="bg-neutral-600 dark:bg-neutral-700">
                    {/* Left section */}
                    <td 
                      colSpan={columnsPerSection + (remainder > 0 ? 1 : 0)} 
                      className="px-4 py-1.5 text-sm font-semibold text-white dark:text-neutral-200 border-t border-b border-neutral-500 dark:border-neutral-600 text-center"
                    >
                      {group.dateLabel}
                    </td>
                    {/* Middle section */}
                    <td 
                      colSpan={columnsPerSection + (remainder > 1 ? 1 : 0)} 
                      className="px-4 py-1.5 text-sm font-semibold text-white dark:text-neutral-200 border-t border-b border-neutral-500 dark:border-neutral-600 text-center"
                    >
                      {group.dateLabel}
                    </td>
                    {/* Right section */}
                    <td 
                      colSpan={columnsPerSection} 
                      className="px-4 py-1.5 text-sm font-semibold text-white dark:text-neutral-200 border-t border-b border-neutral-500 dark:border-neutral-600 text-center"
                    >
                      {group.dateLabel}
                    </td>
                  </tr>
                )
              }

              const { item, index } = group
              const rowBgClass = index % 2 === 0
                ? 'bg-white dark:bg-neutral-800'
                : 'bg-neutral-50 dark:bg-neutral-900'
              const rowKey = item.id || `${item.event.id}-${index}`
              const isExpanded = !!expandedRows[rowKey]
              const alternates = alternatesCache[item.event.id]
              const isAltLoading = !!alternatesLoading[item.event.id]
              const playerId = item.entity.id
              const altRows = type === 'player' && playerId
                ? alternateRows[item.event.id]?.[playerId] || []
                : type === 'game'
                ? alternateRows[item.event.id]?.['game'] || []
                : []
 
               const handleRowClick = () => {
                setExpandedRows(prev => ({
                  ...prev,
                  [rowKey]: !prev[rowKey]
                }))

                if (!expandedRows[rowKey] && preferences.includeAlternates) {
                   void fetchAlternates(item.event.id)
                 }
 
                 onRowClick?.(item)
               }
 
              const isNew = newRows.has(item.id)
              const isChanged = changedRows.has(item.id)

              return (
                <React.Fragment key={item.id || index}>
                  <tr 
                    className={`transition-all cursor-pointer ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                        : 'bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    } ${isNew ? 'animate-fade-in bg-green-50 dark:bg-green-900/10' : ''} ${
                      isChanged ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''
                    }`}
                     onClick={handleRowClick}
                   >
                 {/* Render columns in the same order as headers */}
                 {filteredColumnOrder.map((columnId) => {
                   switch (columnId) {
                    case 'entity':
                      return (
                        <td key="entity" className={`px-4 py-4 whitespace-nowrap sticky left-0 ${rowBgClass} hover:bg-neutral-50 dark:hover:bg-neutral-700 z-10 border-r border-neutral-200 dark:border-neutral-700`}>
                          {item.entity?.type === 'game' ? (
                             <div>
                               {/* For team-specific markets, show only the relevant team */}
                               {(market.includes('home_team') || market.includes('home_total')) ? (
                                 <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                   {hasTeamLogos(sport) && (
                                     <img 
                                       src={getTeamLogoUrl(item.event?.homeTeam || '')} 
                                       alt={item.event?.homeTeam || ''} 
                                       className="w-4 h-4 object-contain flex-shrink-0"
                                       onError={(e) => {
                                         e.currentTarget.style.display = 'none'
                                       }}
                                     />
                                   )}
                                   <span>{item.event?.homeTeam}</span>
                                 </div>
                               ) : (market.includes('away_team') || market.includes('away_total')) ? (
                                 <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                   {hasTeamLogos(sport) && (
                                     <img 
                                       src={getTeamLogoUrl(item.event?.awayTeam || '')} 
                                       alt={item.event?.awayTeam || ''} 
                                       className="w-4 h-4 object-contain flex-shrink-0"
                                       onError={(e) => {
                                         e.currentTarget.style.display = 'none'
                                       }}
                                     />
                                   )}
                                   <span>{item.event?.awayTeam}</span>
                                 </div>
                               ) : (
                                 /* For general game markets, show both teams */
                                 <>
                                   <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                     {hasTeamLogos(sport) && (
                                       <img 
                                         src={getTeamLogoUrl(item.event?.awayTeam || '')} 
                                         alt={item.event?.awayTeam || ''} 
                                         className="w-4 h-4 object-contain flex-shrink-0"
                                         onError={(e) => {
                                           e.currentTarget.style.display = 'none'
                                         }}
                                       />
                                     )}
                                     <span>{item.event?.awayTeam}</span>
                                   </div>
                                   <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                                     {hasTeamLogos(sport) && (
                                       <img 
                                         src={getTeamLogoUrl(item.event?.homeTeam || '')} 
                                         alt={item.event?.homeTeam || ''} 
                                         className="w-4 h-4 object-contain flex-shrink-0"
                                         onError={(e) => {
                                           e.currentTarget.style.display = 'none'
                                         }}
                                       />
                                     )}
                                     <span>{item.event?.homeTeam}</span>
                                   </div>
                                 </>
                               )}
                               
                              {/* Line Selector removed for game props - will be added later */}
                             </div>
                          ) : (
                            <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            <span>{item.entity?.name || 'Unknown'}</span>
                            {(() => {
                              const d = (item.entity?.details || '').toString().trim()
                              // Only show if it looks like a position (1–4 letters), not market keys like receiving_yards
                              if (!d || /_/g.test(d) || /yards|points|total|spread/i.test(d) || d.length > 4) return null
                              return (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">({d.toUpperCase()})</span>
                              )
                            })()}
                          </div>
                          {(() => {
                            const playerTeam = item.entity?.team
                            const homeTeamName = item.event?.homeTeam
                            const awayTeamName = item.event?.awayTeam
                            if (!playerTeam || !homeTeamName || !awayTeamName) return null

                            const isHome = playerTeam === homeTeamName
                            const opponentTeamName = isHome ? awayTeamName : homeTeamName
                            const sep = isHome ? 'vs' : '@'
                            // Prefer provided abbreviations from API via event names if they already are abbrs
                            const playerAbbr = (getStandardAbbreviation(playerTeam, sport) || playerTeam).toUpperCase()
                            const opponentAbbr = (getStandardAbbreviation(opponentTeamName, sport) || opponentTeamName).toUpperCase()

                            return (
                              <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                {hasTeamLogos(sport) && (
                                  <img
                                    src={getTeamLogoUrl(playerTeam)}
                                    alt={playerAbbr}
                                    className="w-4 h-4 object-contain flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                  />
                                )}
                                <span>{playerAbbr}</span>
                                <span>{sep}</span>
                                <span>{opponentAbbr}</span>
                                {hasTeamLogos(sport) && (
                                  <img
                                    src={getTeamLogoUrl(opponentTeamName)}
                                    alt={opponentAbbr}
                                    className="w-4 h-4 object-contain flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                  />
                                )}
                              </div>
                            )
                          })()}
                          {/* Player Line Selector and Expand Controls */}
                          <div className="mt-2 flex items-center gap-2">
                            <select
                              onClick={(e) => e.stopPropagation()}
                              onFocus={async (e) => {
                                e.stopPropagation()
                                if (!alternatesCache[item.event.id] && !alternatesLoading[item.event.id]) {
                                  await fetchAlternates(item.event.id)
                                }
                              }}
                              onChange={async (e) => {
                                e.stopPropagation()
                                const value = e.target.value
                                if (value === 'primary') {
                                  resetToPrimaryLine(item)
                                } else {
                                  const newLine = parseFloat(value)
                                  if (!isNaN(newLine)) {
                                    await updatePrimaryRowWithLine(item, newLine)
                                  }
                                }
                              }}
                              className={`text-xs bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[100px] ${isLoadingAlternates(item.event.id) ? 'opacity-75' : ''}`}
                              value={(() => {
                                const rowKey = `${item.event.id}-${item.entity.id || 'game'}`
                                return customLineSelections[rowKey] || 'primary'
                              })()}
                              disabled={isLoadingAlternates(item.event.id)}
                            >
                              <option value="primary">Primary Line</option>
                              {isLoadingAlternates(item.event.id) ? (
                                <option disabled>Loading...</option>
                              ) : (
                                getAvailableLines(item).map(line => (
                                  <option key={line} value={line}>
                                    {line}
                                  </option>
                                ))
                              )}
                            </select>

                            {preferences.includeAlternates && (
                              <Tooltip content={<span className="text-xs">{isExpanded ? 'Hide all alternates' : 'Show all alternates'}</span>}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedRows(prev => ({
                                      ...prev,
                                      [rowKey]: !prev[rowKey]
                                    }))
                                    if (!expandedRows[rowKey]) {
                                      void fetchAlternates(item.event.id)
                                    }
                                  }}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition text-blue-600 dark:text-blue-400"
                                  aria-label={isExpanded ? 'Hide all alternates' : 'Show all alternates'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                </button>
                              </Tooltip>
                            )}
                          </div>
                             </div>
                           )}
                         </td>
                       )
                     case 'event':
                       return (
                         <td key="event" className="px-3 py-4 whitespace-nowrap border-r border-neutral-200 dark:border-neutral-700">
                           <div className="text-sm text-neutral-500 dark:text-neutral-400">
                             {item.event?.startTime ? new Date(item.event.startTime).toLocaleDateString() : ''}
                           </div>
                           <div className="text-sm text-neutral-500 dark:text-neutral-400">
                             {item.event?.startTime ? new Date(item.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                           </div>
                         </td>
                       )
                     case 'best-line':
                       return (
                        <td key="best-line" className="px-3 py-4 whitespace-nowrap text-center border-r border-neutral-200 dark:border-neutral-700">
                           <div className="space-y-1">
                            {renderBestOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                            {renderBestOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                           </div>
                         </td>
                       )
                     case 'average-line':
                       return (
                        <td key="average-line" className="px-3 py-4 whitespace-nowrap text-center border-r border-neutral-200 dark:border-neutral-700">
                           <div className="space-y-1">
                            {renderAverageOddsButton(item, 'over', effectiveVisibleSportsbooks)}
                            {renderAverageOddsButton(item, 'under', effectiveVisibleSportsbooks)}
                           </div>
                         </td>
                       )
                     default:
                       return null
                   }
                 })}
                 
                 {/* Sportsbook columns */}
                 {orderedSportsbooks.map((sportsbook) => {
                   const bookData = item.odds.books?.[sportsbook.id] || 
                                    item.odds.books?.[sportsbook.id.replace('-', '_')] ||
                                    item.odds.books?.[sportsbook.id.replace('_', '-')] ||
                                    item.odds.books?.[sportsbook.id.toLowerCase()] ||
                                    item.odds.books?.[sportsbook.id.toUpperCase()]
 
                  // Check if this sportsbook has the best line+odds combination (matching Best Line column logic)
                  const isBestOdds = (odds: { price: number; line?: number }, side: 'over' | 'under') => {
                    const { userBest } = calculateUserBestOdds(item, side, effectiveVisibleSportsbooks)
                    if (!userBest) return false
                    
                    // Must match both price AND line to be highlighted (same logic as Best Line column)
                    return odds.price === userBest.price && 
                           (odds.line ?? 0) === (userBest.line ?? 0)
                  }

                  const renderOddsButton = (
                     odds: { line: number; price: number; link?: string | null },
                     side: 'over' | 'under'
                   ) => {
                     const isHighlighted = columnHighlighting && isBestOdds(odds, side)
                     const cellKeyPrice = `${item.id}|${sportsbook.id}|${side}|price`
                     const cellKeyLine = `${item.id}|${sportsbook.id}|${side}|line`
                     const priceChanged = changedPriceCells.has(cellKeyPrice)
                     const lineChanged = changedLineCells.has(cellKeyLine)

                     const onClick = (e: React.MouseEvent) => {
                       e.stopPropagation()
                       if (typeof odds.link === 'string' && odds.link.length > 0) {
                         window.open(odds.link, '_blank', 'noopener,noreferrer')
                       } else {
                         onOddsClick?.(item, side, sportsbook.id)
                       }
                     }

                     const moneyline = item.entity.type === 'game' && item.entity.details === 'Moneyline'

                     return (
                      <OddsCellButton
                        itemId={item.id}
                        sportsbookId={sportsbook.id}
                        sportsbookName={sportsbook.name}
                        side={side}
                        odds={odds}
                        isHighlighted={isHighlighted}
                        priceChanged={priceChanged}
                        lineChanged={lineChanged}
                        isMoneyline={moneyline}
                        formatOdds={(p) => (p > 0 ? `+${p}` : `${p}`)}
                        formatLine={(ln, sd) => {
                          if (moneyline) return sd === 'over' ? item.event.awayTeam : item.event.homeTeam
                          return sd === 'over' ? `o${ln}` : `u${ln}`
                        }}
                        onClick={onClick}
                      />
                     )
                   }

                  const renderPlaceholder = () => (
                    <div className="block w-full text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1.5 mx-auto text-center min-w-fit">
                      -
                    </div>
                  )
 
                   return (
                      <td key={sportsbook.id} className="border-r border-neutral-200 dark:border-neutral-700 px-1 py-2 w-auto whitespace-nowrap">
                        <div className="space-y-1">
                          {bookData?.over ? renderOddsButton(bookData.over, 'over') : renderPlaceholder()}
                          {bookData?.under ? renderOddsButton(bookData.under, 'under') : renderPlaceholder()}
                        </div>
                      </td>
                    )
                  })}
               </tr>
                  {isExpanded && preferences.includeAlternates && (
                    <React.Fragment>
                      {isAltLoading && (
                        <tr className={index % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-900'}>
                          <td colSpan={columnOrder.length + orderedSportsbooks.length} className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading alternate lines...
                            </div>
                          </td>
                        </tr>
                      )}
                      {!isAltLoading && altRows.length === 0 && (
                        <tr className={index % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-900'}>
                          <td colSpan={columnOrder.length + orderedSportsbooks.length} className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                            {type === 'game' 
                              ? 'Game alternates coming soon!' 
                              : 'No alternate lines available for this player.'}
                          </td>
                        </tr>
                      )}
                      {!isAltLoading && altRows.length > 0 && (
                        altRows.map((row, altIndex) => renderAlternateRow(
                          filteredColumnOrder,
                          orderedSportsbooks,
                          row,
                          
                          (bookId, side, odds) => {
                            const sportsbook = getSportsbookById(bookId)
                            if (odds.link) {
                              window.open(odds.link, '_blank', 'noopener,noreferrer')
                            } else if (sportsbook?.links?.desktop) {
                              window.open(sportsbook.links.desktop, '_blank', 'noopener,noreferrer')
                            }
                          },
                          altIndex,
                          columnHighlighting
                        ))
                      )}
                    </React.Fragment>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        </DndContext>
        </div>
      </div>
    </TooltipProvider>
  )
}
