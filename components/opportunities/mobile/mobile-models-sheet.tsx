"use client";

import React, { useState } from "react";
import { 
  X, 
  Plus, 
  Sparkles, 
  Check, 
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
  Zap,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterPreset, parseSports } from "@/lib/types/filter-presets";
import { SportIcon } from "@/components/icons/sport-icons";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { motion, AnimatePresence } from "framer-motion";
import { useFilterPresets } from "@/hooks/use-filter-presets";

// Pie chart colors
const CHART_COLORS = [
  "#f472b6", // pink
  "#818cf8", // indigo
  "#60a5fa", // blue
  "#34d399", // emerald
  "#fbbf24", // amber
];

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Mini pie chart for model visualization
function MiniPieChart({ 
  books, 
  weights, 
  size = 56 
}: { 
  books: string[]; 
  weights: Record<string, number>; 
  size?: number;
}) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0) || books.length;
  const radius = size / 2;
  const center = size / 2;
  const innerRadius = radius * 0.6;

  let currentAngle = -90; // Start from top

  const segments = books.map((book, i) => {
    const weight = weights[book] || 100 / books.length;
    const percentage = weight / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const ix1 = center + innerRadius * Math.cos(startRad);
    const iy1 = center + innerRadius * Math.sin(startRad);
    const ix2 = center + innerRadius * Math.cos(endRad);
    const iy2 = center + innerRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");

    return (
      <path
        key={book}
        d={pathData}
        fill={CHART_COLORS[i % CHART_COLORS.length]}
        className="transition-opacity hover:opacity-80"
      />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments}
    </svg>
  );
}

// Render sport icons
const renderSportsIcons = (sports: string[], size = 16) => {
  const displaySports = sports.slice(0, 4);
  return (
    <div className="flex -space-x-1">
      {displaySports.map((sport) => (
        <div key={sport} className="rounded-full bg-white dark:bg-neutral-800">
          <span className="inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <SportIcon sport={sport} className="w-full h-full" />
          </span>
        </div>
      ))}
    </div>
  );
};

interface MobileModelsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: FilterPreset[];
  activePresets: FilterPreset[];
  onTogglePreset: (preset: FilterPreset) => void;
  onCreateNew: () => void;
  onEdit: (preset: FilterPreset) => void;
  onPresetsChange?: () => void;
}

export function MobileModelsSheet({
  open,
  onOpenChange,
  presets,
  activePresets,
  onTogglePreset,
  onCreateNew,
  onEdit,
  onPresetsChange,
}: MobileModelsSheetProps) {
  const { deletePreset, createPreset } = useFilterPresets();
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const isActive = (presetId: string) => activePresets.some(p => p.id === presetId);

  const handleDelete = async (preset: FilterPreset) => {
    setDeletingId(preset.id);
    try {
      await deletePreset(preset.id);
      onPresetsChange?.();
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (preset: FilterPreset) => {
    setDuplicatingId(preset.id);
    try {
      // Create a new preset with the same configuration but a different name
      await createPreset({
        name: `${preset.name} (Copy)`,
        sport: preset.sport,
        markets: preset.markets,
        market_type: preset.market_type,
        sharp_books: preset.sharp_books,
        book_weights: preset.book_weights,
        fallback_mode: preset.fallback_mode,
        fallback_weights: preset.fallback_weights,
        min_books_reference: preset.min_books_reference,
        min_odds: preset.min_odds,
        max_odds: preset.max_odds,
        is_default: false, // Don't copy default status
      });
      onPresetsChange?.();
    } finally {
      setDuplicatingId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-black/50 z-[100]"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[101]",
          "bg-white dark:bg-neutral-900",
          "rounded-t-3xl",
          "max-h-[85vh] overflow-hidden",
          "flex flex-col"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Custom Models
              </h2>
              <p className="text-xs text-neutral-500">
                {activePresets.length > 0 
                  ? `${activePresets.length} active` 
                  : "Select models to compare"}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={onCreateNew}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                "bg-gradient-to-r from-emerald-500 to-teal-500",
                "text-white font-semibold text-sm",
                "active:scale-[0.98] transition-transform"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>New Model</span>
            </button>
            
            {activePresets.length > 0 && (
              <button
                onClick={() => {
                  activePresets.forEach(p => onTogglePreset(p));
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                  "bg-neutral-100 dark:bg-neutral-800",
                  "text-neutral-700 dark:text-neutral-300 font-medium text-sm",
                  "active:scale-[0.98] transition-transform"
                )}
              >
                <Filter className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Models List */}
          {presets.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-neutral-400" />
                </div>
              </div>
              <p className="text-neutral-500 font-medium mb-1">No models yet</p>
              <p className="text-sm text-neutral-400">Create your first custom model above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const sports = parseSports(preset.sport);
                const books = preset.sharp_books || [];
                const weights = preset.book_weights || {};
                const active = isActive(preset.id);
                const expanded = expandedPresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    className={cn(
                      "rounded-2xl border overflow-hidden transition-all",
                      active
                        ? "border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    )}
                  >
                    {/* Main Row - using div to avoid nested button issue */}
                    <div
                      onClick={() => onTogglePreset(preset)}
                      className="w-full flex items-center gap-3 p-4 text-left cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
                    >
                      {/* Pie Chart */}
                      <div className="flex-shrink-0">
                        <MiniPieChart books={books} weights={weights} size={48} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-neutral-900 dark:text-white truncate">
                            {preset.name}
                          </span>
                          {active && (
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Books & Sports */}
                        <div className="flex items-center gap-3 mt-1.5">
                          {/* Book logos */}
                          <div className="flex -space-x-1">
                            {books.slice(0, 3).map((book, i) => {
                              const logo = getBookLogo(book);
                              return (
                                <div 
                                  key={book}
                                  className="w-5 h-5 rounded bg-white dark:bg-neutral-800 flex items-center justify-center ring-1 ring-white dark:ring-neutral-900"
                                  style={{ borderColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                >
                                  {logo ? (
                                    <img src={logo} alt={book} className="w-3.5 h-3.5 object-contain" />
                                  ) : (
                                    <span className="text-[7px] font-bold text-neutral-400">{book.slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                              );
                            })}
                            {books.length > 3 && (
                              <span className="text-[10px] font-medium text-neutral-400 ml-1">
                                +{books.length - 3}
                              </span>
                            )}
                          </div>
                          
                          <div className="w-px h-3 bg-neutral-200 dark:bg-neutral-700" />
                          
                          {/* Sports */}
                          {renderSportsIcons(sports, 14)}
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPresetId(expanded ? null : preset.id);
                        }}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <MoreHorizontal className="w-4 h-4 text-neutral-400" />
                      </button>
                    </div>

                    {/* Expanded Actions */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                              onClick={() => onEdit(preset)}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl",
                                "bg-neutral-100 dark:bg-neutral-800",
                                "text-neutral-700 dark:text-neutral-300 text-sm font-medium",
                                "active:scale-[0.98] transition-transform"
                              )}
                            >
                              <Pencil className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                            
                            <button
                              onClick={() => handleDuplicate(preset)}
                              disabled={duplicatingId === preset.id}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl",
                                "bg-neutral-100 dark:bg-neutral-800",
                                "text-neutral-700 dark:text-neutral-300 text-sm font-medium",
                                "active:scale-[0.98] transition-transform",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              <Copy className="w-4 h-4" />
                              <span>{duplicatingId === preset.id ? "Duplicating..." : "Duplicate"}</span>
                            </button>
                            
                            <button
                              onClick={() => handleDelete(preset)}
                              disabled={deletingId === preset.id}
                              className={cn(
                                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                                "bg-red-50 dark:bg-red-900/20",
                                "text-red-600 dark:text-red-400 text-sm font-medium",
                                "active:scale-[0.98] transition-transform",
                                "disabled:opacity-50"
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Apply Button */}
        {activePresets.length > 0 && (
          <div className="px-4 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <button
              onClick={() => onOpenChange(false)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-4 rounded-xl",
                "bg-gradient-to-r from-purple-500 to-pink-500",
                "text-white font-bold text-base",
                "shadow-lg shadow-purple-500/20",
                "active:scale-[0.98] transition-transform"
              )}
            >
              <Zap className="w-5 h-5" />
              <span>Apply {activePresets.length} Model{activePresets.length > 1 ? "s" : ""}</span>
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

