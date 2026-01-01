"use client";

import React, { useState } from "react";
import { 
  X, 
  Plus, 
  Sparkles, 
  Check, 
  Pencil,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Filter,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterPreset, parseSports } from "@/lib/types/filter-presets";
import { SportIcon } from "@/components/icons/sport-icons";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { motion, AnimatePresence } from "framer-motion";
import { useFilterPresets } from "@/hooks/use-filter-presets";

// Chart colors - matches desktop filter preset form modal
const CHART_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

// Get sportsbook info
const getBookInfo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return {
    name: sb?.name || bookId,
    logo: sb?.image?.square || sb?.image?.light || null,
  };
};

// Format odds display
const formatOdds = (odds: number | null | undefined) => {
  if (odds === null || odds === undefined) return "—";
  return odds >= 0 ? `+${odds}` : `${odds}`;
};

// Donut chart with book colors
function ModelDonutChart({ 
  books, 
  weights, 
  size = 64 
}: { 
  books: string[]; 
  weights: Record<string, number>; 
  size?: number;
}) {
  if (books.length === 0) {
    return (
      <div 
        className="rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-neutral-400 text-xs">—</span>
      </div>
    );
  }

  const total = Object.values(weights).reduce((sum, w) => sum + w, 0) || books.length * 100;
  const radius = size / 2;
  const center = size / 2;
  const strokeWidth = size * 0.18;
  const innerRadius = radius - strokeWidth / 2;

  let currentAngle = -90;

  const segments = books.map((book, i) => {
    const weight = weights[book] || 100;
    const percentage = weight / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const color = CHART_COLORS[i % CHART_COLORS.length];
    const circumference = 2 * Math.PI * innerRadius;
    const strokeDasharray = `${(percentage * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
    const rotation = startAngle;

    return (
      <circle
        key={book}
        cx={center}
        cy={center}
        r={innerRadius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${center} ${center})`}
        className="transition-all duration-300"
      />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={innerRadius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-neutral-100 dark:text-neutral-800"
      />
      {segments}
      {/* Center text */}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-neutral-600 dark:fill-neutral-300 font-bold"
        style={{ fontSize: size * 0.2 }}
      >
        {books.length}
      </text>
    </svg>
  );
}

// Sport badge
const SportBadge = ({ sport }: { sport: string }) => (
  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800">
    <SportIcon sport={sport} className="w-4 h-4" />
  </div>
);

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
        is_default: false,
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[101]",
          "bg-white dark:bg-neutral-950",
          "rounded-t-3xl",
          "max-h-[90vh] overflow-hidden",
          "flex flex-col"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              Custom Models
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              {activePresets.length > 0 
                ? `${activePresets.length} model${activePresets.length > 1 ? 's' : ''} active` 
                : "Tap to select models"}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onCreateNew}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl",
              "bg-emerald-500 hover:bg-emerald-600",
              "text-white font-semibold text-sm",
              "active:scale-[0.98] transition-all"
            )}
          >
            <Plus className="w-5 h-5" />
            <span>New Model</span>
          </button>
          
          {activePresets.length > 0 && (
            <button
              onClick={() => {
                activePresets.forEach(p => onTogglePreset(p));
              }}
              className={cn(
                "flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl",
                "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                "text-neutral-700 dark:text-neutral-300 font-medium text-sm",
                "active:scale-[0.98] transition-all"
              )}
            >
              <Filter className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {presets.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-purple-500" />
                </div>
              </div>
              <p className="text-neutral-900 dark:text-white font-semibold text-lg mb-1">No models yet</p>
              <p className="text-sm text-neutral-500">Create your first custom model to get started</p>
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
                      "rounded-2xl overflow-hidden transition-all duration-200",
                      "border-2",
                      active
                        ? "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/30"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    )}
                  >
                    {/* Main Card Content */}
                    <div
                      onClick={() => onTogglePreset(preset)}
                      className="p-4 cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
                    >
                      {/* Top Row: Chart + Name + Active Badge */}
                      <div className="flex items-start gap-3 mb-3">
                        <ModelDonutChart books={books} weights={weights} size={56} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                              {preset.name}
                            </h3>
                            {active && (
                              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          
                          {/* Sports Row */}
                          <div className="flex items-center gap-1.5">
                            {sports.map((sport) => (
                              <SportBadge key={sport} sport={sport} />
                            ))}
                            {sports.length === 0 && (
                              <span className="text-xs text-neutral-400">All sports</span>
                            )}
                          </div>
                        </div>

                        {/* Expand/Collapse */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPresetId(expanded ? null : preset.id);
                          }}
                          className={cn(
                            "p-2 rounded-xl transition-colors",
                            expanded 
                              ? "bg-neutral-200 dark:bg-neutral-700" 
                              : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          )}
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4 text-neutral-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-xs">
                        {/* Books Count */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-400">Books:</span>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                            {books.length}
                          </span>
                        </div>
                        
                        {/* Min Odds */}
                        {preset.min_odds !== null && preset.min_odds !== undefined && (
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-neutral-400" />
                            <span className="font-semibold text-neutral-700 dark:text-neutral-200 tabular-nums">
                              {formatOdds(preset.min_odds)}
                            </span>
                          </div>
                        )}
                        
                        {/* Max Odds */}
                        {preset.max_odds !== null && preset.max_odds !== undefined && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-neutral-400" />
                            <span className="font-semibold text-neutral-700 dark:text-neutral-200 tabular-nums">
                              {formatOdds(preset.max_odds)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-neutral-100 dark:border-neutral-800">
                            {/* Books with Weights */}
                            <div className="pt-3 pb-3">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                Reference Books
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {books.map((book, bookIndex) => {
                                  const bookInfo = getBookInfo(book);
                                  const weight = weights[book] || 100;
                                  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || books.length * 100;
                                  const percentage = Math.round((weight / totalWeight) * 100);
                                  const color = CHART_COLORS[bookIndex % CHART_COLORS.length];
                                  
                                  return (
                                    <div 
                                      key={book}
                                      className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50"
                                    >
                                      <div 
                                        className="w-1 h-8 rounded-full"
                                        style={{ backgroundColor: color }}
                                      />
                                      {bookInfo.logo ? (
                                        <img 
                                          src={bookInfo.logo} 
                                          alt={bookInfo.name} 
                                          className="w-5 h-5 object-contain"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                                          <span className="text-[8px] font-bold text-neutral-500">
                                            {book.slice(0, 2).toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate block">
                                          {bookInfo.name}
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold text-neutral-500 tabular-nums">
                                        {percentage}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(preset);
                                }}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl",
                                  "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                                  "text-neutral-700 dark:text-neutral-300 text-sm font-medium",
                                  "active:scale-[0.98] transition-all"
                                )}
                              >
                                <Pencil className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicate(preset);
                                }}
                                disabled={duplicatingId === preset.id}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl",
                                  "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                                  "text-neutral-700 dark:text-neutral-300 text-sm font-medium",
                                  "active:scale-[0.98] transition-all",
                                  "disabled:opacity-50"
                                )}
                              >
                                <Copy className="w-4 h-4" />
                                <span>{duplicatingId === preset.id ? "..." : "Copy"}</span>
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(preset);
                                }}
                                disabled={deletingId === preset.id}
                                className={cn(
                                  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                                  "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30",
                                  "text-red-600 dark:text-red-400 text-sm font-medium",
                                  "active:scale-[0.98] transition-all",
                                  "disabled:opacity-50"
                                )}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
          <div className="px-4 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <button
              onClick={() => onOpenChange(false)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-4 rounded-2xl",
                "bg-gradient-to-r from-purple-600 to-pink-600",
                "text-white font-bold text-base",
                "shadow-xl shadow-purple-500/25",
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
