"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/button'
import { ButtonLink } from '@/components/button-link'
import { Filter, Building2 } from 'lucide-react'
import { useOddsPreferences } from '@/context/preferences-context'
import { getAllActiveSportsbooks } from '@/lib/data/sportsbooks'
import Lock from '@/icons/lock'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Gear } from '@/icons/gear'
import { useAuth } from '@/components/auth/auth-provider'
import { useEntitlements } from '@/hooks/use-entitlements'

interface OddsFiltersProps {
  className?: string
  isPro?: boolean
  liveUpdatesEnabled?: boolean
  onLiveUpdatesChange?: (enabled: boolean) => void
  embedded?: boolean
  onClose?: () => void
}

export function OddsFilters({ className = '', isPro = false, liveUpdatesEnabled = false, onLiveUpdatesChange, embedded = false, onClose }: OddsFiltersProps) {
  const { preferences, updatePreferences, isLoading } = useOddsPreferences()
  const [open, setOpen] = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<string[]>([])
  const [includeAlternates, setIncludeAlternates] = useState(false)
  const [columnHighlighting, setColumnHighlighting] = useState(true)
  const [showBestLine, setShowBestLine] = useState(true)
  const [showAverageLine, setShowAverageLine] = useState(true)
  const [localLiveUpdatesEnabled, setLocalLiveUpdatesEnabled] = useState(liveUpdatesEnabled)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), [])
  
  const { user } = useAuth()
  const { data: entitlements } = useEntitlements()

  // Determine if user can access trial
  const canUseTrial = !user || (entitlements?.trial?.trial_used === false)

  useEffect(() => {
    if (!isLoading && preferences) {
      setSelectedBooks(preferences.selectedBooks)
      setIncludeAlternates(preferences.includeAlternates)
      setColumnHighlighting(preferences.columnHighlighting)
      setShowBestLine(preferences.showBestLine)
      setShowAverageLine(preferences.showAverageLine)
      setHasUnsavedChanges(false)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsFilters] Loaded preferences:', {
          selectedBooks: preferences.selectedBooks.length,
          includeAlternates: preferences.includeAlternates,
          columnHighlighting: preferences.columnHighlighting,
          showBestLine: preferences.showBestLine,
          showAverageLine: preferences.showAverageLine
        })
      }
    }
  }, [isLoading, preferences])

  // Sync local SSE state with parent prop when it changes
  useEffect(() => {
    setLocalLiveUpdatesEnabled(liveUpdatesEnabled)
  }, [liveUpdatesEnabled])

  // Track changes to mark as unsaved
  useEffect(() => {
    if (preferences && !isLoading) {
      const preferencesChanged = 
        selectedBooks.length !== preferences.selectedBooks.length ||
        selectedBooks.some(id => !preferences.selectedBooks.includes(id)) ||
        includeAlternates !== preferences.includeAlternates ||
        columnHighlighting !== preferences.columnHighlighting ||
        showBestLine !== preferences.showBestLine ||
        showAverageLine !== preferences.showAverageLine
      
      // Also check if SSE toggle changed
      const sseChanged = isPro && localLiveUpdatesEnabled !== liveUpdatesEnabled
      
      setHasUnsavedChanges(preferencesChanged || sseChanged)
    }
  }, [selectedBooks, includeAlternates, columnHighlighting, showBestLine, showAverageLine, localLiveUpdatesEnabled, preferences, isLoading, isPro, liveUpdatesEnabled])

  const toggleBook = (id: string) => {
    setSelectedBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  const apply = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[OddsFilters] Applying preferences:', {
        selectedBooks: selectedBooks.length,
        includeAlternates,
        columnHighlighting,
        showBestLine,
        showAverageLine,
        autoRefresh: localLiveUpdatesEnabled
      })
    }
    
    try {
      // Save database preferences
      await updatePreferences({
        selectedBooks,
        includeAlternates,
        columnHighlighting,
        showBestLine,
        showAverageLine
      })
      
      // Apply SSE toggle change (not saved to DB, runtime only)
      if (isPro && localLiveUpdatesEnabled !== liveUpdatesEnabled) {
        onLiveUpdatesChange?.(localLiveUpdatesEnabled)
      }
      
      setHasUnsavedChanges(false)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsFilters] Preferences saved successfully')
      }
      
      setOpen(false)
    } catch (error) {
      console.error('[OddsFilters] Failed to save preferences:', error)
    }
  }

  const reset = async () => {
    const defaults = allSportsbooks.map(b => b.id)
    setSelectedBooks(defaults)
    setIncludeAlternates(false)
    setColumnHighlighting(true)
    setShowBestLine(true)
    setShowAverageLine(true)
    
    // Reset SSE toggle to on (default for Pro users)
    if (isPro) {
      setLocalLiveUpdatesEnabled(true)
    }
    
    try {
      await updatePreferences({
        selectedBooks: defaults,
        includeAlternates: false,
        columnHighlighting: true,
        showBestLine: true,
        showAverageLine: true
      })
      
      // Apply SSE reset
      if (isPro && liveUpdatesEnabled !== true) {
        onLiveUpdatesChange?.(true)
      }
      
      setHasUnsavedChanges(false)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[OddsFilters] Reset to defaults')
      }
    } catch (error) {
      console.error('[OddsFilters] Failed to reset preferences:', error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset local SSE state when closing without applying
      setLocalLiveUpdatesEnabled(liveUpdatesEnabled)
    }
    setOpen(newOpen)
  }

  const handleClose = () => {
    setLocalLiveUpdatesEnabled(liveUpdatesEnabled)
    if (embedded && onClose) {
      onClose()
    } else {
      setOpen(false)
    }
  }

  const handleApply = async () => {
    await apply()
    if (embedded && onClose) {
      onClose()
    }
  }

  // Filter content (shared between embedded and sheet modes)
  const filterContent = (
    <div className={cn("flex flex-col", embedded ? "h-full" : "flex-1")}>
      <div className={cn("flex-1 overflow-y-auto", embedded ? "" : "px-6 py-6")}>
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="filter-tabs grid w-full grid-cols-2">
                <TabsTrigger value="books" className="flex items-center justify-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Sportsbooks</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center justify-center gap-2">
                  <Gear className="h-4 w-4" />
                  <span className="hidden sm:inline">Display</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="filter-section">
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Choose sportsbooks to include in results</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedBooks(allSportsbooks.map(b => b.id))} 
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => setSelectedBooks([])} 
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
                      const checked = selectedBooks.includes(sb.id)
                      return (
                        <label
                          key={sb.id}
                          className={cn(
                            "filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm",
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
              </TabsContent>

              <TabsContent value="settings" className="mt-6 space-y-4">
                {/* Pro Gate for Free Users */}
                {!isPro && (
                  <div className="rounded-lg border border-[var(--tertiary)]/30 bg-[var(--tertiary)]/5 p-6 dark:bg-[var(--tertiary)]/10">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--tertiary)]/10 dark:bg-[var(--tertiary)]/20">
                        <Lock className="h-6 w-6 text-[var(--tertiary-strong)]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
                          Unlock Display Settings
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                          Upgrade to Pro to customize your odds display with auto refresh, column highlighting, and more advanced settings.
                        </p>
                        <ButtonLink
                          href="/pricing"
                          variant="pro"
                          className="inline-flex items-center gap-2 text-sm h-auto py-2"
                        >
                          {canUseTrial ? "Start Free Trial" : "Get Pro Now"}
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                )}

                {/* Display Settings - Pro Only */}
                {isPro && (
                  <>
                    {/* Auto Refresh Toggle */}
                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Auto Refresh</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Automatically refresh odds in real-time without manual refresh</div>
                      </div>
                      <Switch checked={localLiveUpdatesEnabled} fn={(v: boolean) => setLocalLiveUpdatesEnabled(!!v)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Include Alternate Lines</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Show alternate spreads, totals, and props when available</div>
                      </div>
                      <Switch checked={includeAlternates} fn={(v: boolean) => setIncludeAlternates(!!v)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Column Highlighting</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Highlight the best odds with color backgrounds</div>
                      </div>
                      <Switch checked={columnHighlighting} fn={(v: boolean) => setColumnHighlighting(!!v)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Show Best Line Column</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Display optimal odds from selected sportsbooks</div>
                      </div>
                      <Switch checked={showBestLine} fn={(v: boolean) => setShowBestLine(!!v)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Show Average Line Column</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Display market consensus from selected sportsbooks</div>
                      </div>
                      <Switch checked={showAverageLine} fn={(v: boolean) => setShowAverageLine(!!v)} />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className={cn("filter-footer", embedded && "border-t border-neutral-200 dark:border-neutral-800 mt-4 pt-4")}>
            <div className="flex items-center justify-between gap-3">
              <button 
                onClick={reset}
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={handleClose}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApply}
                  disabled={!hasUnsavedChanges}
                  className={cn(
                    "apply-btn h-10 rounded-lg border px-5 text-sm font-medium",
                    hasUnsavedChanges && "active",
                    hasUnsavedChanges
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
  )

  // If embedded, just return the content
  if (embedded) {
    return filterContent
  }

  // Otherwise, wrap in Sheet
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm font-medium transition-all",
            "text-neutral-500 dark:text-neutral-400",
            "hover:text-neutral-700 dark:hover:text-neutral-200",
            "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            "border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700",
            className
          )}
          title="Filters & Settings"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:max-w-0 sm:overflow-hidden sm:group-hover:max-w-[60px] sm:transition-all sm:duration-200 sm:inline-block">Filters</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-900 p-0">
        <SheetHeader className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <SheetTitle className="text-lg font-semibold">Filters & Settings</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-6">
          {filterContent}
        </div>
      </SheetContent>
    </Sheet>
  )
}
