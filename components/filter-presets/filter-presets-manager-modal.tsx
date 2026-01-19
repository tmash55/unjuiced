"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, Filter, X, Copy, EyeOff, Layers } from "lucide-react";
import { Star } from "@/components/star";
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
import { usePreferences } from "@/context/preferences-context";

// Pre-built model templates for quick creation
type ModelTemplate = {
  id: string;
  name: string;
  description: string;
  sport: string; // comma-separated sports string (matches FilterPreset schema)
  market_type: "all" | "player" | "game";
  sharp_books: string[];
  book_weights: Record<string, number>;
  min_books_reference: number;
  min_odds: number;
  max_odds: number;
};

const MODEL_TEMPLATES: ModelTemplate[] = [
  {
    id: 'pinnacle-circa-props',
    name: 'Sharp Blend - Props',
    description: 'Pinnacle + Circa (50/50) • All sports player props',
    sport: 'nba,nfl,nhl,mlb',
    market_type: 'player' as const,
    sharp_books: ['pinnacle', 'circa'],
    book_weights: { pinnacle: 50, circa: 50 },
    min_books_reference: 2,
    min_odds: -300,
    max_odds: 300,
  },
  {
    id: 'pinnacle-only-props',
    name: 'Pinnacle Only - Props',
    description: 'Pinnacle sharp line • All sports player props',
    sport: 'nba,nfl,nhl,mlb',
    market_type: 'player' as const,
    sharp_books: ['pinnacle'],
    book_weights: { pinnacle: 100 },
    min_books_reference: 1,
    min_odds: -300,
    max_odds: 300,
  },
  {
    id: 'sharp-consensus-all',
    name: 'Sharp Consensus',
    description: 'Pinnacle + Circa + Bet365 • All markets',
    sport: 'nba,nfl,nhl,mlb',
    market_type: 'all' as const,
    sharp_books: ['pinnacle', 'circa', 'bet365'],
    book_weights: { pinnacle: 40, circa: 30, bet365: 30 },
    min_books_reference: 2,
    min_odds: -500,
    max_odds: 500,
  },
];

const renderSportsIcon = (sports: string[], sizePx = 16) => {
  if (!sports || sports.length === 0)
    return (
      <span className="inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
        <SportIcon sport="nba" className="w-full h-full" />
      </span>
    );
  if (sports.length === 1)
    return (
      <span className="inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
        <SportIcon sport={sports[0]} className="w-full h-full" />
      </span>
    );

  const first = sports[0];
  const second = sports[1];
  return (
    <div className="flex -space-x-1 items-center">
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <span className="inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
          <SportIcon sport={first} className="w-full h-full" />
        </span>
      </div>
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <span className="inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
          <SportIcon sport={second} className="w-full h-full" />
        </span>
      </div>
    </div>
  );
};

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || sb?.image?.long || null;
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
    toggleFavorite,
    deletePreset,
    createPreset,
    isDeleting,
    isCreating,
  } = useFilterPresets();

  const { preferences, updatePreference } = usePreferences();
  const hideTemplates = preferences?.hide_model_templates ?? false;

  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<FilterPreset | null>(null);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [localHideTemplates, setLocalHideTemplates] = useState(false); // Local state for immediate hide
  
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

  // Check if a template already exists (by name)
  const isTemplateCreated = (templateName: string) => {
    return presets.some(p => p.name === templateName);
  };

  // Create model from template
  const handleCreateFromTemplate = async (template: typeof MODEL_TEMPLATES[0]) => {
    if (isTemplateCreated(template.name)) return;
    
    setCreatingTemplateId(template.id);
    try {
      await createPreset({
        name: template.name,
        sport: template.sport,
        markets: null, // all markets
        market_type: template.market_type,
        sharp_books: template.sharp_books,
        book_weights: template.book_weights,
        min_books_reference: template.min_books_reference,
        min_odds: template.min_odds,
        max_odds: template.max_odds,
        fallback_mode: 'hide',
        fallback_weights: null,
      });
    } catch (error) {
      console.error("Failed to create model from template:", error);
    } finally {
      setCreatingTemplateId(null);
    }
  };

  // Hide templates section permanently
  const handleHideTemplates = async () => {
    setLocalHideTemplates(true); // Immediate UI feedback
    try {
      await updatePreference('hide_model_templates', true);
    } catch (error) {
      console.error("Failed to hide templates:", error);
      setLocalHideTemplates(false); // Revert on error
    }
  };

  // Check if templates should be shown
  const shouldShowTemplates = !hideTemplates && !localHideTemplates && MODEL_TEMPLATES.some(t => !isTemplateCreated(t.name));

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
          className="w-full sm:max-w-6xl max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl rounded-2xl"
        >
          {/* Premium Header with gradient accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
          
          <DialogHeader className="border-b border-neutral-200/80 dark:border-neutral-800/80 px-6 py-5 bg-gradient-to-r from-white via-purple-50/20 to-pink-50/20 dark:from-neutral-900 dark:via-purple-950/10 dark:to-pink-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/25">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    Custom Models
                  </DialogTitle>
                  <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Create and manage your edge-finding models
                  </DialogDescription>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Select Favorites button */}
                {presets.some(p => p.is_favorite) && (
                  <button
                    onClick={() => {
                      const favoriteIds = new Set(presets.filter(p => p.is_favorite).map(p => p.id));
                      setLocalSelection(favoriteIds);
                    }}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-700/50 transition-colors"
                  >
                    <Star className="w-4 h-4" />
                    Favorites
                  </button>
                )}
                
                {/* Select All button */}
                {presets.length > 0 && (
                  <button
                    onClick={() => {
                      const allIds = new Set(presets.map(p => p.id));
                      setLocalSelection(allIds);
                    }}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Select All
                  </button>
                )}
                
                {/* New Model button */}
                <button
                  onClick={onCreateNew}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  New Model
                </button>
                
                {/* Close button */}
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center h-10 w-10 rounded-xl text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Active Models Section - Always visible when there are active models */}
            {selectedCount > 0 && (
              <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-r from-purple-50/60 via-pink-50/40 to-rose-50/30 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-rose-950/10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Active Models ({selectedCount})
                      </span>
                    </div>
                    <button
                      onClick={() => setLocalSelection(new Set())}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {presets.filter(p => localSelection.has(p.id)).map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800 shadow-sm"
                      >
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          {preset.name}
                        </span>
                        <button
                          onClick={() => {
                            setLocalSelection(prev => {
                              const next = new Set(prev);
                              next.delete(preset.id);
                              return next;
                            });
                          }}
                          className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Templates Section - Premium gradient background */}
            {shouldShowTemplates && (
              <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-r from-amber-50/60 via-orange-50/40 to-yellow-50/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/10">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25">
                        <Layers className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white">Quick Start Templates</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Add pre-built models with one click</p>
                      </div>
                    </div>
                    <Tooltip content="Don't show this section again">
                      <button
                        onClick={handleHideTemplates}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-white/50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Hide</span>
                      </button>
                    </Tooltip>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {MODEL_TEMPLATES.map((template) => {
                      const alreadyCreated = isTemplateCreated(template.name);
                      const isCreatingThis = creatingTemplateId === template.id;
                      const templateBooks = template.sharp_books;
                      const templateWeights = template.book_weights;
                      
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleCreateFromTemplate(template)}
                          disabled={alreadyCreated || isCreatingThis}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                            alreadyCreated
                              ? "bg-neutral-100/80 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed"
                              : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer hover:ring-1 hover:ring-amber-500/20"
                          )}
                        >
                          {/* Mini pie chart */}
                          <MiniPieChart 
                            books={templateBooks} 
                            weights={templateWeights}
                            size={44}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                                {template.name}
                              </span>
                              {alreadyCreated && (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                              {template.description}
                            </p>
                          </div>
                          
                          {/* Add button */}
                          {!alreadyCreated && (
                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                              {isCreatingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {presets.length === 0 ? (
              /* Premium Empty state */
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
                    <Layers className="w-9 h-9 text-purple-500 dark:text-purple-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="font-bold text-xl text-neutral-900 dark:text-white mb-2 tracking-tight">
                  Create Your First Model
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 max-w-md leading-relaxed">
                  Build custom models to find the best edges using your preferred sharp books, weighted blends, and market filters.
                </p>
                <button
                  onClick={onCreateNew}
                  className="h-11 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Model
                </button>
              </div>
            ) : (
              /* Presets list */
              <div className="p-6 space-y-10">
                {sortedSports.map((sport) => (
                  <div key={sport}>
                    {/* Sport section header */}
                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200/50 dark:from-neutral-800 dark:to-neutral-700/50 text-neutral-600 dark:text-neutral-400 shadow-sm">
                        {sport === 'multi' ? (
                          renderSportsIcon(['nba', 'nfl'], 18)
                        ) : (
                          <SportIcon sport={sport} className="w-5 h-5" />
                        )}
                      </div>
                      <h3 className="font-semibold text-lg text-neutral-900 dark:text-white tracking-tight">
                        {getSportGroupLabel(sport)}
                      </h3>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-700/50">
                        {presetsBySport[sport].length} {presetsBySport[sport].length === 1 ? 'model' : 'models'}
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
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        {presetsBySport[sport].every(p => localSelection.has(p.id)) ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    {/* Filter cards grid - sort favorites first */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {[...presetsBySport[sport]].sort((a, b) => {
                        // Sort favorites first
                        if (a.is_favorite && !b.is_favorite) return -1;
                        if (!a.is_favorite && b.is_favorite) return 1;
                        return 0;
                      }).map((preset) => {
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
                              "group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden",
                              isSelected
                                ? "bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-300 dark:border-emerald-700 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                                : "bg-white dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md ring-1 ring-black/[0.02] dark:ring-white/[0.02]"
                            )}
                          >
                            {/* Selection indicator */}
                            <div className={cn(
                              "absolute left-0 top-0 bottom-0 w-1.5 transition-all",
                              isSelected ? "bg-gradient-to-b from-emerald-400 to-teal-500" : "bg-transparent"
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
                                  {preset.is_favorite && (
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                                  )}
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
                                className="flex items-center gap-1 flex-shrink-0"
                              >
                                {/* Favorite button - always visible */}
                                <Tooltip content={preset.is_favorite ? "Remove favorite" : "Add to favorites"}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(preset.id, !preset.is_favorite);
                                    }}
                                    className={cn(
                                      "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                                      preset.is_favorite
                                        ? "bg-amber-100 dark:bg-amber-900/50 text-amber-500"
                                        : "bg-neutral-100 dark:bg-neutral-700 text-neutral-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                    )}
                                  >
                                    <Star className={cn("w-3.5 h-3.5", preset.is_favorite && "fill-current")} />
                                  </button>
                                </Tooltip>
                                
                                {/* Edit/Delete - show on hover */}
                                <div className={cn(
                                  "flex items-center gap-1 transition-opacity",
                                  isHovered ? "opacity-100" : "opacity-0"
                                )}>
                                  <Tooltip content="Edit model">
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
                                  <Tooltip content="Delete model">
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

          {/* Premium Footer with Apply/Cancel */}
          {presets.length > 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 bg-neutral-50 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {selectedCount} selected
                    </span>
                  </div>
                  {pendingChanges.hasChanges && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                      {changeCount} unsaved changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    className="h-10 px-5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !pendingChanges.hasChanges}
                    className={cn(
                      "h-10 px-6 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2",
                      pendingChanges.hasChanges
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02]"
                        : "bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Apply Changes
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

      {/* Premium Delete confirmation */}
      <Dialog open={!!deletingPreset} onOpenChange={(open) => !open && setDeletingPreset(null)}>
        <DialogContent className="sm:max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl rounded-2xl overflow-hidden">
          {/* Red accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-600" />
          
          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 shadow-lg ring-1 ring-red-200/50 dark:ring-red-800/50">
                <Trash2 className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <DialogTitle className="mb-2 text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                Delete Model?
              </DialogTitle>
              <DialogDescription className="mb-6 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">&quot;{deletingPreset?.name}&quot;</span> will be permanently removed. This action cannot be undone.
              </DialogDescription>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPreset(null)}
                className="flex-1 h-11 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25 transition-all hover:shadow-red-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete Model"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
