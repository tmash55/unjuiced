"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter } from 'lucide-react'
import { getAllActiveSportsbooks } from '@/lib/data/sportsbooks'
import { cn } from '@/lib/utils'

interface LaddersFiltersProps {
  className?: string
  selectedBooks: string[]
  onSelectedBooksChange: (books: string[]) => void
  ladderGap: number
  onLadderGapChange: (gap: number) => void
  multiBookOnly: boolean
  onMultiBookOnlyChange: (value: boolean) => void
}

export function LaddersFilters({ 
  className = '', 
  selectedBooks, 
  onSelectedBooksChange,
  ladderGap,
  onLadderGapChange,
  multiBookOnly,
  onMultiBookOnlyChange
}: LaddersFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localSelectedBooks, setLocalSelectedBooks] = useState<string[]>(selectedBooks)
  const [localLadderGap, setLocalLadderGap] = useState<number>(ladderGap)
  const [localMultiBookOnly, setLocalMultiBookOnly] = useState<boolean>(multiBookOnly)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Exclude Bodog and Bovada from Ladders due to data accuracy issues
  const allSportsbooks = useMemo(() => 
    getAllActiveSportsbooks().filter(book => 
      book.id !== 'bodog' && book.id !== 'bovada'
    ), 
  [])

  // Sync local state with props
  useEffect(() => {
    setLocalSelectedBooks(selectedBooks)
    setLocalLadderGap(ladderGap)
    setLocalMultiBookOnly(multiBookOnly)
  }, [selectedBooks, ladderGap, multiBookOnly])

  // Track changes
  useEffect(() => {
    const changed = 
      localSelectedBooks.length !== selectedBooks.length ||
      localSelectedBooks.some(id => !selectedBooks.includes(id)) ||
      localLadderGap !== ladderGap ||
      localMultiBookOnly !== multiBookOnly
    setHasUnsavedChanges(changed)
  }, [localSelectedBooks, selectedBooks, localLadderGap, ladderGap, localMultiBookOnly, multiBookOnly])

  const toggleBook = (id: string) => {
    setLocalSelectedBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  const apply = () => {
    onSelectedBooksChange(localSelectedBooks)
    onLadderGapChange(localLadderGap)
    onMultiBookOnlyChange(localMultiBookOnly)
    setHasUnsavedChanges(false)
    setOpen(false)
  }

  const reset = () => {
    const defaults = allSportsbooks.map(b => b.id)
    setLocalSelectedBooks(defaults)
    setLocalLadderGap(0)
    setLocalMultiBookOnly(false)
    onSelectedBooksChange(defaults)
    onLadderGapChange(0)
    onMultiBookOnlyChange(false)
    setHasUnsavedChanges(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      // Reset local state when closing without applying
      setLocalSelectedBooks(selectedBooks)
      setLocalLadderGap(ladderGap)
      setLocalMultiBookOnly(multiBookOnly)
      setHasUnsavedChanges(false)
    }
    setOpen(newOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "filters-btn flex items-center gap-2 h-9 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all",
            className
          )}
          title="Filter Sportsbooks"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-900 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <SheetTitle className="text-lg font-semibold">Ladder Filters</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Display Options */}
            <div className="filter-section">
              <div className="filter-section-header mb-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Display Options</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Control which lines to show
                </p>
              </div>
              
              {/* Multi-Book Filter */}
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox 
                  checked={localMultiBookOnly} 
                  onCheckedChange={(checked) => setLocalMultiBookOnly(checked as boolean)} 
                />
                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Show only lines with multiple books
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Hide lines that only have one sportsbook offering
                  </div>
                </div>
              </label>
            </div>

            {/* Sportsbooks Section */}
            <div className="filter-section">
              <div className="filter-section-header flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Sportsbooks</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Select sportsbooks to include in results
                    </p>
                  </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setLocalSelectedBooks(allSportsbooks.map(b => b.id))} 
                    className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => setLocalSelectedBooks([])} 
                    className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="filter-grid">
                {allSportsbooks
                  .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                  .map((sb) => {
                    const checked = localSelectedBooks.includes(sb.id)
                    return (
                      <label
                        key={sb.id}
                        className={cn(
                          "filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-all",
                          checked && "active",
                          !checked && "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleBook(sb.id)} />
                        {sb.image?.light && (
                          <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                        )}
                        <span className="text-sm leading-none">{sb.name}</span>
                      </label>
                    )
                  })}
              </div>

              {localSelectedBooks.length === 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                  ⚠️ No sportsbooks selected. Please select at least one sportsbook to view odds.
                </div>
              )}
            </div>
          </div>

          {/* Footer with action buttons */}
          <div className="filter-footer">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={reset}
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenChange(false)}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={apply}
                  disabled={localSelectedBooks.length === 0 || !hasUnsavedChanges}
                  className={cn(
                    "apply-btn h-10 rounded-lg border px-5 text-sm font-medium",
                    hasUnsavedChanges && localSelectedBooks.length > 0 && "active",
                    hasUnsavedChanges && localSelectedBooks.length > 0
                      ? "border-brand bg-brand text-white hover:bg-brand/90"
                      : "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-800"
                  )}
                >
                  {hasUnsavedChanges ? 'Apply Changes' : 'No Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

