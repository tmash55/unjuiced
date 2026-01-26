"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, X, Zap, Layers } from "lucide-react";
import { Star } from "@/components/star";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEvModels } from "@/hooks/use-ev-models";
import { 
  EV_MODEL_TEMPLATES,
  formatEvSharpBooks,
  formatEvMarketType,
  formatEvSports,
  type EvModel,
  type EvModelCreate,
} from "@/lib/types/ev-models";
import { EvModelFormModal } from "./ev-model-form-modal";
import { SportIcon } from "@/components/icons/sport-icons";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || null;
};

// Mini pie chart for book weights
const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", 
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function MiniPieChart({ books, weights, size = 40 }: { 
  books: string[]; 
  weights: Record<string, number> | null; 
  size?: number;
}) {
  const center = size / 2;
  const radius = (size / 2) - 2;
  const innerRadius = radius * 0.5;

  if (books.length === 0) return null;

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
          />
        </svg>
      </div>
    );
  }

  const segments = useMemo(() => {
    const result: { startAngle: number; endAngle: number; color: string }[] = [];
    let currentAngle = -90;
    const hasWeights = weights && Object.keys(weights).length > 0;
    
    books.forEach((book, index) => {
      const weight = hasWeights ? (weights[book] || 0) : (100 / books.length);
      const sweepAngle = (weight / 100) * 360;
      result.push({
        startAngle: currentAngle,
        endAngle: currentAngle + sweepAngle,
        color: CHART_COLORS[index % CHART_COLORS.length],
      });
      currentAngle += sweepAngle;
    });
    
    return result;
  }, [books, weights]);

  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => (
          <path key={i} d={createArc(seg.startAngle, seg.endAngle)} fill={seg.color} />
        ))}
      </svg>
    </div>
  );
}

interface EvModelsManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelsChanged?: () => void;
}

export function EvModelsManagerModal({
  open,
  onOpenChange,
  onModelsChanged,
}: EvModelsManagerModalProps) {
  const {
    models,
    isLoading,
    createModel,
    deleteModel,
    toggleModel,
    toggleFavorite,
    isCreating,
    isDeleting,
  } = useEvModels();

  const [editingModel, setEditingModel] = useState<EvModel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort models: favorites first, then by created date
  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [models]);

  const handleCreateFromTemplate = async (templateKey: keyof typeof EV_MODEL_TEMPLATES) => {
    const template = EV_MODEL_TEMPLATES[templateKey];
    const data: EvModelCreate = {
      name: template.name,
      sport: template.sport,
      markets: template.markets,
      market_type: template.market_type,
      sharp_books: [...template.sharp_books],
      book_weights: template.book_weights ? { ...template.book_weights } : null,
      min_books_reference: template.min_books_reference,
    };
    
    try {
      await createModel(data);
      onModelsChanged?.();
    } catch (err) {
      console.error("Failed to create model from template:", err);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteModel(id);
      onModelsChanged?.();
    } catch (err) {
      console.error("Failed to delete model:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (model: EvModel) => {
    try {
      await toggleModel(model.id, !model.is_active);
      onModelsChanged?.();
    } catch (err) {
      console.error("Failed to toggle model:", err);
    }
  };

  const handleToggleFavorite = async (model: EvModel) => {
    try {
      await toggleFavorite(model.id, !model.is_favorite);
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          showCloseButton={false}
          className="w-full sm:max-w-6xl max-h-[85vh] overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl rounded-2xl"
        >
          {/* Premium gradient accent bar - GREEN theme */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
          
          {/* Header */}
          <DialogHeader className="border-b border-neutral-200/80 dark:border-neutral-800/80 px-6 py-5 shrink-0 bg-gradient-to-r from-white via-emerald-50/20 to-green-50/20 dark:from-neutral-900 dark:via-emerald-950/10 dark:to-green-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    Manage EV Models
                  </DialogTitle>
                  <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Create and manage your custom +EV models
                  </DialogDescription>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Favorites quick select */}
                {models.some(m => m.is_favorite) && (
                  <button
                    onClick={async () => {
                      const favoriteModels = models.filter(m => m.is_favorite && !m.is_active);
                      for (const model of favoriteModels) {
                        await toggleModel(model.id, true);
                      }
                      onModelsChanged?.();
                    }}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-700/50 transition-colors"
                  >
                    <Star filled className="w-4 h-4 text-amber-500" />
                    Favorites
                  </button>
                )}
                
                {/* New Model button */}
                <button
                  onClick={() => {
                    setEditingModel(null);
                    setFormOpen(true);
                  }}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02]"
                >
                  <Plus className="h-4 w-4" />
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
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Favorites Section - Always at the top when there are favorites */}
            {models.some(m => m.is_favorite) && (
              <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-r from-amber-50/60 via-orange-50/40 to-yellow-50/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/10">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25">
                        <Star filled className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white">Favorites</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Quick access to your favorite models</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {models.filter(m => m.is_favorite).map((model) => (
                      <div
                        key={model.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-action]')) return;
                          handleToggleActive(model);
                        }}
                        className={cn(
                          "group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden",
                          model.is_active
                            ? "bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-300 dark:border-emerald-700 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                            : "bg-white dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700/80 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
                        )}
                      >
                        {/* Selection indicator bar */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1.5 transition-all",
                          model.is_active ? "bg-gradient-to-b from-emerald-400 to-teal-500" : "bg-transparent"
                        )} />

                        <div className="flex items-start gap-3 p-4">
                          <MiniPieChart books={model.sharp_books} weights={model.book_weights} size={44} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Star filled className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <h4 className={cn(
                                "font-medium truncate transition-colors",
                                model.is_active ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-900 dark:text-white"
                              )}>
                                {model.name}
                              </h4>
                              {model.is_active && (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              {model.sharp_books.slice(0, 4).map((bookId) => {
                                const logo = getBookLogo(bookId);
                                return logo ? (
                                  <img key={bookId} src={logo} alt={bookId} className="w-5 h-5 object-contain rounded-sm" />
                                ) : (
                                  <div key={bookId} className="w-5 h-5 rounded-sm bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500">
                                    {bookId.slice(0, 2).toUpperCase()}
                                  </div>
                                );
                              })}
                              {model.sharp_books.length > 4 && (
                                <span className="text-[10px] font-medium text-neutral-400">+{model.sharp_books.length - 4}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Stats footer */}
                        <div className={cn(
                          "flex items-center justify-between px-4 py-2.5 border-t text-[11px]",
                          model.is_active 
                            ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20" 
                            : "border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30"
                        )}>
                          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                            <span>{formatEvSharpBooks(model.sharp_books)}</span>
                            <span className="text-neutral-300 dark:text-neutral-600">•</span>
                            <span>{formatEvMarketType(model.market_type)}</span>
                          </div>
                          {model.sport && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300">
                              {formatEvSports(model.sport)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-4 sm:p-6">
              {/* Quick Templates */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
                  Quick Templates
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(EV_MODEL_TEMPLATES) as Array<keyof typeof EV_MODEL_TEMPLATES>).slice(0, 3).map((key) => {
                    const template = EV_MODEL_TEMPLATES[key];
                    return (
                      <button
                        key={key}
                        onClick={() => handleCreateFromTemplate(key)}
                        disabled={isCreating}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 flex items-center justify-center group-hover:from-emerald-500/20 group-hover:to-green-500/20">
                            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {template.name}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {template.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Models List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    All Models
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {models.length} model{models.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : models.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                      <Layers className="w-8 h-8 text-neutral-400" />
                    </div>
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                      No custom models yet
                    </p>
                    <p className="text-xs text-neutral-500 mb-4">
                      Create your first model using a template above or from scratch
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sortedModels.map((model) => (
                      <div
                        key={model.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-action]')) return;
                          handleToggleActive(model);
                        }}
                        className={cn(
                          "group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden",
                          model.is_active
                            ? "bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-300 dark:border-emerald-700 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                            : "bg-white dark:bg-neutral-800/60 border-neutral-200/80 dark:border-neutral-700/80 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
                        )}
                      >
                        {/* Selection indicator bar */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1.5 transition-all",
                          model.is_active ? "bg-gradient-to-b from-emerald-400 to-teal-500" : "bg-transparent"
                        )} />

                        <div className="flex items-start gap-3 p-4">
                          <MiniPieChart books={model.sharp_books} weights={model.book_weights} size={44} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {model.is_favorite && (
                                <Star filled className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              )}
                              <h4 className={cn(
                                "font-medium truncate transition-colors",
                                model.is_active ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-900 dark:text-white"
                              )}>
                                {model.name}
                              </h4>
                              {model.is_active && (
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              {model.sharp_books.slice(0, 4).map((bookId) => {
                                const logo = getBookLogo(bookId);
                                return logo ? (
                                  <img key={bookId} src={logo} alt={bookId} className="w-5 h-5 object-contain rounded-sm" />
                                ) : (
                                  <div key={bookId} className="w-5 h-5 rounded-sm bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500">
                                    {bookId.slice(0, 2).toUpperCase()}
                                  </div>
                                );
                              })}
                              {model.sharp_books.length > 4 && (
                                <span className="text-[10px] font-medium text-neutral-400">+{model.sharp_books.length - 4}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0" data-action>
                            <Tooltip content={model.is_favorite ? "Remove from favorites" : "Add to favorites"}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(model);
                                }}
                                className={cn(
                                  "h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
                                  model.is_favorite
                                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-500"
                                    : "bg-neutral-100 dark:bg-neutral-700 text-neutral-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                )}
                              >
                                <Star filled={model.is_favorite} className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            <Tooltip content="Edit">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingModel(model);
                                  setFormOpen(true);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-neutral-600 dark:text-neutral-300"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>

                            <Tooltip content="Delete">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(model.id);
                                }}
                                disabled={deletingId === model.id}
                                className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-red-600 dark:text-red-400"
                              >
                                {deletingId === model.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                        
                        {/* Stats footer */}
                        <div className={cn(
                          "flex items-center justify-between px-4 py-2.5 border-t text-[11px]",
                          model.is_active 
                            ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20" 
                            : "border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30"
                        )}>
                          <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                            <span>{formatEvSharpBooks(model.sharp_books)}</span>
                            <span className="text-neutral-300 dark:text-neutral-600">•</span>
                            <span>{formatEvMarketType(model.market_type)}</span>
                          </div>
                          {model.sport && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-200/50 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300">
                              {formatEvSports(model.sport)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-4 bg-neutral-50 dark:bg-neutral-900 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-xs text-neutral-500">
                {models.filter(m => m.is_active).length} active model{models.filter(m => m.is_active).length !== 1 ? "s" : ""}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Modal */}
      <EvModelFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingModel(null);
        }}
        model={editingModel || undefined}
        onSuccess={() => {
          setFormOpen(false);
          setEditingModel(null);
          onModelsChanged?.();
        }}
      />
    </>
  );
}
