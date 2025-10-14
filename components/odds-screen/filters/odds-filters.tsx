"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/button'
import { Filter, Building2, Settings } from 'lucide-react'
import { useOddsPreferences } from '@/context/preferences-context'
import { getAllActiveSportsbooks } from '@/lib/data/sportsbooks'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface OddsFiltersProps {
  className?: string
}

export function OddsFilters({ className = '' }: OddsFiltersProps) {
  const { preferences, updatePreferences, isLoading } = useOddsPreferences()
  const [open, setOpen] = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<string[]>([])
  const [includeAlternates, setIncludeAlternates] = useState(false)
  const [columnHighlighting, setColumnHighlighting] = useState(true)
  const [showBestLine, setShowBestLine] = useState(true)
  const [showAverageLine, setShowAverageLine] = useState(true)

  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), [])

  useEffect(() => {
    if (!isLoading && preferences) {
      setSelectedBooks(preferences.selectedBooks)
      setIncludeAlternates(preferences.includeAlternates)
      setColumnHighlighting(preferences.columnHighlighting)
      setShowBestLine(preferences.showBestLine)
      setShowAverageLine(preferences.showAverageLine)
    }
  }, [isLoading, preferences])

  const toggleBook = (id: string) => {
    setSelectedBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  const apply = async () => {
    await updatePreferences({
      selectedBooks,
      includeAlternates,
      columnHighlighting,
      showBestLine,
      showAverageLine
    })
    setOpen(false)
  }

  const reset = async () => {
    const defaults = allSportsbooks.map(b => b.id)
    setSelectedBooks(defaults)
    setIncludeAlternates(false)
    setColumnHighlighting(true)
    setShowBestLine(true)
    setShowAverageLine(true)
    await updatePreferences({
      selectedBooks: defaults,
      includeAlternates: false,
      columnHighlighting: true,
      showBestLine: true,
      showAverageLine: true
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          className="h-9 w-auto"
          icon={<Filter className="h-4 w-4" />}
          text={<span className="hidden sm:inline">Filters</span>}
          title="Filters & Settings"
        />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-900 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <SheetTitle className="text-lg font-semibold">Filters & Settings</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-1 bg-neutral-100 p-1 dark:bg-neutral-800">
                <TabsTrigger value="books" className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-brand dark:data-[state=active]:bg-neutral-900">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Sportsbooks</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-brand dark:data-[state=active]:bg-neutral-900">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Display</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Choose sportsbooks to include in results</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedBooks(allSportsbooks.map(b => b.id))}
                      className="h-8 w-auto border-transparent px-3 text-xs font-medium text-brand hover:bg-brand/10"
                      text="Select All"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => setSelectedBooks([])}
                      className="h-8 w-auto px-3 text-xs"
                      text="Clear"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {allSportsbooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      const checked = selectedBooks.includes(sb.id)
                      return (
                        <label
                          key={sb.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm ${
                            checked 
                              ? 'border-brand bg-brand/5 dark:border-brand dark:bg-brand/10' 
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleBook(sb.id)} />
                          {sb.image?.light && (
                            <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                          )}
                          <span className="text-sm font-medium leading-none">{sb.name}</span>
                        </label>
                      )
                    })}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-6 space-y-4">
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
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <Button 
                variant="outline"
                onClick={reset}
                className="h-10 w-auto px-4"
                text="Reset All"
              />
              <div className="flex gap-2">
                <Button 
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  className="h-10 w-auto px-5"
                  text="Cancel"
                />
                <Button 
                  variant="primary"
                  onClick={apply}
                  className="h-10 w-auto bg-brand border-brand px-5 hover:bg-brand/90"
                  text="Apply Filters"
                />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
