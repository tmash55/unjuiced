"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/seperator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { useArbitragePreferences } from "@/context/preferences-context";
import { Filter, Building2, Percent } from "lucide-react";

export function FiltersSheet({ children, pro = false }: { children?: React.ReactNode; pro?: boolean }) {
  const { filters, updateFilters } = useArbitragePreferences();
  const allBooks = useMemo(() => sportsbooks.filter(sb => sb.isActive !== false), []);
  const [open, setOpen] = useState(false);

  const [localBooks, setLocalBooks] = useState<string[]>(filters.selectedBooks || []);
  const [minArb, setMinArb] = useState<number>(filters.minArb ?? 0);
  const [maxArb, setMaxArb] = useState<number>(filters.maxArb ?? 20);
  const [totalBetAmount, setTotalBetAmount] = useState<number>(filters.totalBetAmount ?? 200);
  const [roundBets, setRoundBets] = useState<boolean>((filters as any).roundBets ?? false);

  // Keep local UI state in sync when preferences load or change
  useEffect(() => {
    setLocalBooks(filters.selectedBooks || []);
    setMinArb(filters.minArb ?? 0);
    setMaxArb(filters.maxArb ?? 20);
    setTotalBetAmount(filters.totalBetAmount ?? 200);
    setRoundBets((filters as any).roundBets ?? false);
  }, [filters]);

  const toggleBook = (id: string) => {
    setLocalBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const apply = async () => {
    await updateFilters({ selectedBooks: localBooks, minArb, maxArb, totalBetAmount, roundBets });
    setOpen(false);
  };

  const reset = async () => {
    const defaults = allBooks.map(b => b.id);
    setLocalBooks(defaults);
    setMinArb(0);
    setMaxArb(20);
    setTotalBetAmount(200);
    setRoundBets(false);
    await updateFilters({ selectedBooks: defaults, minArb: 0, maxArb: 20, totalBetAmount: 200, roundBets: false });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            className="h-9 inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
            title="Filters & Settings"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        )}
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
                <TabsTrigger value="roi" className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-brand dark:data-[state=active]:bg-neutral-900">
                  <Percent className="h-4 w-4" />
                  <span className="hidden sm:inline">ROI & Amount</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Choose sportsbooks to include in results</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setLocalBooks(allBooks.map(b => b.id))} 
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => setLocalBooks([])} 
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {allBooks.map((sb) => {
                    const checked = localBooks.includes(sb.id);
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
                        <img src={sb.logo} alt={sb.name} className="h-6 w-6 object-contain" />
                        <span className="text-sm font-medium leading-none">{sb.name}</span>
                      </label>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="roi" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min ROI %</Label>
                    <Input 
                      type="number" 
                      value={minArb} 
                      onChange={(e) => setMinArb(Number(e.target.value))}
                      className="h-10"
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Only show opportunities at or above this percent</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max ROI %</Label>
                    <Input
                      type="number"
                      value={pro ? maxArb : Math.min(maxArb, 2)}
                      onChange={(e) => setMaxArb(Number(e.target.value))}
                      disabled={!pro}
                      className="h-10"
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Hide outliers above this percent</p>
                    {!pro && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
                        🔒 Locked on Free plan (max 2%)
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Total Bet Amount ($)</Label>
                  <Input 
                    type="number" 
                    value={totalBetAmount} 
                    onChange={(e) => setTotalBetAmount(Number(e.target.value))}
                    className="h-10"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Default total stake for equal-profit splits</p>
                </div>
                
                <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Round Bet Sizes</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Round each side to whole dollars</div>
                  </div>
                  <Switch checked={roundBets} fn={(v: boolean) => setRoundBets(!!v)} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <button 
                onClick={reset}
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={apply}
                  className="h-10 rounded-lg border border-brand bg-brand px-5 text-sm font-medium text-white transition-all hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}