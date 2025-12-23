"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, Filter, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { 
  getSportLabel, 
  parseSports,
  formatSharpBooks,
  formatOddsRange,
  type FilterPreset 
} from "@/lib/types/filter-presets";
import { FilterPresetFormModal } from "./filter-preset-form-modal";
import { SportIcon } from "@/components/icons/sport-icons";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";

const renderSportsIcon = (sports: string[], sizePx = 16) => {
  if (!sports || sports.length === 0) return <SportIcon sport="nba" className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />;
  if (sports.length === 1) return <SportIcon sport={sports[0]} className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />;

  const first = sports[0];
  const second = sports[1];
  return (
    <div className="flex -space-x-1 items-center">
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <SportIcon sport={first} className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />
      </div>
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <SportIcon sport={second} className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />
      </div>
    </div>
  );
};

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.icon || null;
};

// Get sportsbook name
const getBookName = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

// Preset colors for pie chart segments
const CHART_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
];

interface MiniPieChartProps {
  books: string[];
  weights: Record<string, number>;
  size?: number;
}

function MiniPieChart({ books, weights, size = 44 }: MiniPieChartProps) {
  const center = size / 2;
  const radius = (size / 2) - 2;
  const innerRadius = radius * 0.5;

  // Single book - show solid ring
  if (books.length === 1) {
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={(radius + innerRadius) / 2}
            fill="none"
            stroke={CHART_COLORS[0]}
            strokeWidth={radius - innerRadius}
            className="transition-all duration-200"
          />
        </svg>
      </div>
    );
  }

  // Multiple books - calculate segments
  const segments = useMemo(() => {
    const result: { book: string; weight: number; color: string; startAngle: number; endAngle: number }[] = [];
    let currentAngle = -90; // Start from top
    
    // If no weights, distribute evenly
    const hasWeights = weights && Object.keys(weights).length > 0;
    
    books.forEach((book, index) => {
      const weight = hasWeights ? (weights[book] || 0) : (100 / books.length);
      const sweepAngle = (weight / 100) * 360;
      
      result.push({
        book,
        weight,
        color: CHART_COLORS[index % CHART_COLORS.length],
        startAngle: currentAngle,
        endAngle: currentAngle + sweepAngle,
      });
      
      currentAngle += sweepAngle;
    });
    
    return result;
  }, [books, weights]);

  // Create arc path
  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  if (books.length === 0) return null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg) => (
          <path
            key={seg.book}
            d={createArc(seg.startAngle, seg.endAngle)}
            fill={seg.color}
            className="transition-all duration-200"
          />
        ))}
        {/* Center hole for donut effect */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          className="fill-white dark:fill-neutral-800"
        />
      </svg>
    </div>
  );
}

interface BookLogosProps {
  books: string[];
  weights: Record<string, number>;
  maxDisplay?: number;
}

function BookLogosRow({ books, weights, maxDisplay = 4 }: BookLogosProps) {
  const displayBooks = books.slice(0, maxDisplay);
  const remaining = books.length - maxDisplay;
  const hasWeights = weights && Object.keys(weights).length > 0;

  return (
    <div className="flex items-center gap-0.5">
      {displayBooks.map((book, index) => {
        const logo = getBookLogo(book);
        const weight = hasWeights ? (weights[book] || 0) : Math.round(100 / books.length);
        
        return (
          <Tooltip key={book} content={`${getBookName(book)} (${weight}%)`}>
            <div className="relative">
              {logo ? (
                <img 
                  src={logo} 
                  alt={getBookName(book)} 
                  className="h-5 w-5 object-contain rounded-sm"
                />
              ) : (
                <div 
                  className="h-5 w-5 rounded-sm flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                >
                  {book.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </Tooltip>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] font-medium text-neutral-400 ml-1">
          +{remaining}
        </span>
      )}
    </div>
  );
}

interface FilterPresetsManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNew?: () => void;
}

export function FilterPresetsManagerModal({
  open,
  onOpenChange,
  onCreateNew,
}: FilterPresetsManagerModalProps) {
  const {
    presets,
    presetsBySport,
    togglePreset,
    deletePreset,
    isDeleting,
  } = useFilterPresets();

  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<FilterPreset | null>(null);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local selection state - tracks which presets are selected
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set());

  // Initialize local selection from current active presets when modal opens
  useEffect(() => {
    if (open) {
      const activeIds = new Set(presets.filter(p => p.is_active).map(p => p.id));
      setLocalSelection(activeIds);
    }
  }, [open, presets]);

  // Calculate if there are pending changes
  const pendingChanges = useMemo(() => {
    const currentActive = new Set(presets.filter(p => p.is_active).map(p => p.id));
    const toActivate: string[] = [];
    const toDeactivate: string[] = [];

    // Find presets to activate (in local but not in current)
    localSelection.forEach(id => {
      if (!currentActive.has(id)) toActivate.push(id);
    });

    // Find presets to deactivate (in current but not in local)
    currentActive.forEach(id => {
      if (!localSelection.has(id)) toDeactivate.push(id);
    });

    return { toActivate, toDeactivate, hasChanges: toActivate.length > 0 || toDeactivate.length > 0 };
  }, [localSelection, presets]);

  const handleDelete = async () => {
    if (!deletingPreset) return;
    try {
      await deletePreset(deletingPreset.id);
      // Also remove from local selection
      setLocalSelection(prev => {
        const next = new Set(prev);
        next.delete(deletingPreset.id);
        return next;
      });
      setDeletingPreset(null);
    } catch (error) {
      console.error("Failed to delete preset:", error);
    }
  };

  const handleCardClick = (preset: FilterPreset, e: React.MouseEvent) => {
    // Don't toggle if clicking on action buttons
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    
    setLocalSelection(prev => {
      const next = new Set(prev);
      if (next.has(preset.id)) {
        next.delete(preset.id);
      } else {
        next.add(preset.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!pendingChanges.hasChanges) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      // Apply all changes
      const promises: Promise<void>[] = [];
      
      pendingChanges.toActivate.forEach(id => {
        promises.push(togglePreset(id, true));
      });
      
      pendingChanges.toDeactivate.forEach(id => {
        promises.push(togglePreset(id, false));
      });

      await Promise.all(promises);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset local selection to current state
    const activeIds = new Set(presets.filter(p => p.is_active).map(p => p.id));
    setLocalSelection(activeIds);
    onOpenChange(false);
  };

  const sportOrder = ['multi', 'nba', 'nfl', 'nhl', 'mlb', 'ncaab', 'ncaaf', 'wnba', 'other'];
  const sortedSports = Object.keys(presetsBySport).sort(
    (a, b) => sportOrder.indexOf(a) - sportOrder.indexOf(b)
  );

  // Get display label for sport group
  const getSportGroupLabel = (sport: string): string => {
    if (sport === 'multi') return 'Multi-Sport';
    if (sport === 'other') return 'Other';
    return getSportLabel(sport);
  };

  const selectedCount = localSelection.size;
  const changeCount = pendingChanges.toActivate.length + pendingChanges.toDeactivate.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen && pendingChanges.hasChanges) {
          // If closing with pending changes, reset local state
          const activeIds = new Set(presets.filter(p => p.is_active).map(p => p.id));
          setLocalSelection(activeIds);
        }
        onOpenChange(newOpen);
      }}>
        <DialogContent 
          showCloseButton={false}
          className="w-full sm:max-w-6xl max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl"
        >
          {/* Header with New Filter button */}
          <DialogHeader className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                  <Filter className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Filter Presets
                  </DialogTitle>
                  <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Select filters to activate, then save
                  </DialogDescription>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* New Filter button */}
                <button
                  onClick={onCreateNew}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Filter
                </button>
                
                {/* Close button */}
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center h-9 w-9 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {presets.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="font-semibold text-lg text-neutral-900 dark:text-white mb-2">
                  Create Your First Filter
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
                  Build custom filters to find the best edges using your preferred sharp books and settings.
                </p>
                <button
                  onClick={onCreateNew}
                  className="h-10 px-5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Filter
                </button>
              </div>
            ) : (
              /* Presets list */
              <div className="p-6 space-y-8">
                {sortedSports.map((sport) => (
                  <div key={sport}>
                    {/* Sport section header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {sport === 'multi' ? (
                          renderSportsIcon(['nba', 'nfl'], 16)
                        ) : (
                          <SportIcon sport={sport} className="w-4 h-4" />
                        )}
                      </div>
                      <h3 className="font-medium text-neutral-900 dark:text-white">
                        {getSportGroupLabel(sport)}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                        {presetsBySport[sport].length}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => {
                          const sportPresets = presetsBySport[sport];
                          const allSelected = sportPresets.every(p => localSelection.has(p.id));
                          setLocalSelection(prev => {
                            const next = new Set(prev);
                            sportPresets.forEach(p => {
                              if (allSelected) {
                                next.delete(p.id);
                              } else {
                                next.add(p.id);
                              }
                            });
                            return next;
                          });
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        {presetsBySport[sport].every(p => localSelection.has(p.id)) ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    {/* Filter cards grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {presetsBySport[sport].map((preset) => {
                        const sports = parseSports(preset.sport);
                        const isHovered = hoveredPreset === preset.id;
                        const isSelected = localSelection.has(preset.id);
                        const bookWeights = preset.book_weights || {};
                        const sharpBooks = preset.sharp_books || [];
                        
                        return (
                          <div
                            key={preset.id}
                            onClick={(e) => handleCardClick(preset, e)}
                            onMouseEnter={() => setHoveredPreset(preset.id)}
                            onMouseLeave={() => setHoveredPreset(null)}
                            className={cn(
                              "group relative flex flex-col rounded-xl border cursor-pointer transition-all duration-150",
                              isSelected
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                                : "bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                            )}
                          >
                            {/* Selection indicator */}
                            <div className={cn(
                              "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors",
                              isSelected ? "bg-emerald-500" : "bg-transparent"
                            )} />

                            {/* Top section with pie chart and info */}
                            <div className="flex items-start gap-3 p-4">
                              {/* Pie chart visualization */}
                              <div className="flex-shrink-0">
                                {sharpBooks.length > 0 ? (
                                  <MiniPieChart 
                                    books={sharpBooks} 
                                    weights={bookWeights}
                                    size={48}
                                  />
                                ) : (
                                  <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                    isSelected 
                                      ? "bg-emerald-100 dark:bg-emerald-900/50" 
                                      : "bg-neutral-100 dark:bg-neutral-700"
                                  )}>
                                    <SportIcon 
                                      sport={sports[0] || 'nba'} 
                                      className={cn(
                                        "w-5 h-5 transition-colors",
                                        isSelected 
                                          ? "text-emerald-600 dark:text-emerald-400" 
                                          : "text-neutral-400 dark:text-neutral-500"
                                      )} 
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Name and selection */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className={cn(
                                    "font-medium truncate transition-colors",
                                    isSelected 
                                      ? "text-emerald-700 dark:text-emerald-300" 
                                      : "text-neutral-900 dark:text-white"
                                  )}>
                                    {preset.name}
                                  </h4>
                                  {isSelected && (
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                                
                                {/* Book logos row */}
                                <div className="mt-2">
                                  <BookLogosRow 
                                    books={sharpBooks} 
                                    weights={bookWeights}
                                    maxDisplay={5}
                                  />
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div 
                                data-action="true"
                                className={cn(
                                  "flex items-center gap-1 transition-opacity flex-shrink-0",
                                  isHovered ? "opacity-100" : "opacity-0"
                                )}
                              >
                                <Tooltip content="Edit filter">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPreset(preset);
                                    }}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-neutral-600 dark:text-neutral-300"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                                <Tooltip content="Delete filter">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingPreset(preset);
                                    }}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-red-600 dark:text-red-400"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>

                            {/* Bottom section with stats */}
                            <div className={cn(
                              "flex items-center justify-between px-4 py-2.5 border-t text-[11px]",
                              isSelected 
                                ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20" 
                                : "border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30"
                            )}>
                              <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400">
                                {/* Sports */}
                                <div className="flex items-center gap-1">
                                  {sports.slice(0, 2).map((s, i) => (
                                    <SportIcon 
                                      key={i} 
                                      sport={s} 
                                      className={cn(
                                        "w-3.5 h-3.5",
                                        isSelected 
                                          ? "text-emerald-600 dark:text-emerald-400" 
                                          : "text-neutral-400"
                                      )} 
                                    />
                                  ))}
                                  {sports.length > 2 && (
                                    <span className="text-[10px] font-medium">
                                      +{sports.length - 2}
                                    </span>
                                  )}
                                </div>
                                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                <span className="font-medium">
                                  {formatOddsRange(preset.min_odds, preset.max_odds)}
                                </span>
                                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                <span>
                                  Min {preset.min_books_reference} {preset.min_books_reference === 1 ? 'book' : 'books'}
                                </span>
                              </div>
                              {preset.market_type && preset.market_type !== 'all' && (
                                <span className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                                  isSelected 
                                    ? "bg-emerald-200/50 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-300" 
                                    : "bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300"
                                )}>
                                  {preset.market_type === 'player' ? 'Props' : 'Lines'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Save/Cancel */}
          {presets.length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {selectedCount} selected
                  </span>
                  {pendingChanges.hasChanges && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      {changeCount} unsaved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    className="h-9 px-4 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                      "h-9 px-5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2",
                      !pendingChanges.hasChanges && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <FilterPresetFormModal
        open={!!editingPreset}
        onOpenChange={(open) => !open && setEditingPreset(null)}
        preset={editingPreset || undefined}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deletingPreset} onOpenChange={(open) => !open && setDeletingPreset(null)}>
        <DialogContent className="sm:max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-xl">
          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <DialogTitle className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
                Delete Filter?
              </DialogTitle>
              <DialogDescription className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
                &quot;{deletingPreset?.name}&quot; will be permanently removed.
              </DialogDescription>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPreset(null)}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
