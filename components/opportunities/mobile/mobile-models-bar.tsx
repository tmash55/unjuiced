"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Filter, 
  Plus, 
  ChevronRight, 
  Check, 
  Settings,
  X,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { parseSports, FilterPreset } from "@/lib/types/filter-presets";
import { SportIcon } from "@/components/icons/sport-icons";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { motion, AnimatePresence } from "framer-motion";
import { FilterPresetFormModal } from "@/components/filter-presets/filter-preset-form-modal";
import { MobileModelsSheet } from "./mobile-models-sheet";

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Render sport icons
const renderSportsIcons = (sports: string[], size = 14) => {
  const displaySports = sports.slice(0, 3);
  return (
    <div className="flex -space-x-1">
      {displaySports.map((sport) => (
        <div key={sport} className="rounded-full bg-white dark:bg-neutral-800 ring-1 ring-white dark:ring-neutral-900">
          <span className="inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <SportIcon sport={sport} className="w-full h-full" />
          </span>
        </div>
      ))}
      {sports.length > 3 && (
        <span className="text-[10px] font-medium text-neutral-500 ml-1">
          +{sports.length - 3}
        </span>
      )}
    </div>
  );
};

interface MobileModelsBarProps {
  onPresetsChange?: () => void;
  onPresetHover?: (preset: FilterPreset) => void;
}

export function MobileModelsBar({ onPresetsChange, onPresetHover }: MobileModelsBarProps) {
  const {
    presets,
    activePresets,
    isLoading,
    togglePreset,
  } = useFilterPresets();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManagerSheet, setShowManagerSheet] = useState(false);
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null);

  const isCustomMode = activePresets.length > 0;

  // Handle preset toggle
  const handleTogglePreset = async (preset: FilterPreset) => {
    const isCurrentlyActive = activePresets.some(p => p.id === preset.id);
    await togglePreset(preset.id, !isCurrentlyActive);
    onPresetsChange?.();
  };

  // Handle preset created/updated
  const handlePresetChange = () => {
    onPresetsChange?.();
    setShowCreateModal(false);
    setEditingPreset(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Empty state - no presets yet
  if (presets.length === 0) {
    return (
      <>
        <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
              "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
              "border border-emerald-200/50 dark:border-emerald-800/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Create a Custom Model
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Compare against specific sharp books
                </p>
              </div>
            </div>
            <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>

        <FilterPresetFormModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={handlePresetChange}
        />
      </>
    );
  }

  return (
    <>
      <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        {/* Main Row: Mode Toggle + Active Models */}
        <div className="flex items-center gap-2">
          {/* Mode Badge */}
          <button
            onClick={() => setShowManagerSheet(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
              "active:scale-[0.98]",
              isCustomMode
                ? "bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 dark:from-pink-900/30 dark:via-purple-900/30 dark:to-blue-900/30 text-purple-700 dark:text-purple-300"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            )}
          >
            {isCustomMode ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Filter className="w-4 h-4" />
            )}
            <span>{isCustomMode ? "Custom" : "Preset"}</span>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>

          {/* Active Models - Horizontal Scroll */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2">
              {isCustomMode ? (
                // Show active custom models
                activePresets.map((preset) => {
                  const sports = parseSports(preset.sport);
                  const books = preset.sharp_books || [];
                  
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleTogglePreset(preset)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl",
                        "bg-white dark:bg-neutral-800",
                        "border border-purple-200 dark:border-purple-800",
                        "shadow-sm",
                        "active:scale-[0.98] transition-transform"
                      )}
                    >
                      {/* Book logos */}
                      <div className="flex -space-x-1.5">
                        {books.slice(0, 2).map((book) => {
                          const logo = getBookLogo(book);
                          return (
                            <div 
                              key={book} 
                              className="w-5 h-5 rounded bg-white dark:bg-neutral-700 flex items-center justify-center ring-1 ring-white dark:ring-neutral-800"
                            >
                              {logo ? (
                                <img src={logo} alt={book} className="w-3.5 h-3.5 object-contain" />
                              ) : (
                                <span className="text-[8px] font-bold text-neutral-500">{book.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap max-w-[80px] truncate">
                        {preset.name}
                      </span>
                      
                      <X className="w-3.5 h-3.5 text-neutral-400" />
                    </button>
                  );
                })
              ) : (
                // Quick preset buttons
                presets.slice(0, 3).map((preset) => {
                  const sports = parseSports(preset.sport);
                  
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleTogglePreset(preset)}
                      onMouseEnter={() => onPresetHover?.(preset)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl",
                        "bg-neutral-50 dark:bg-neutral-800/50",
                        "border border-neutral-200 dark:border-neutral-700",
                        "active:scale-[0.98] transition-transform"
                      )}
                    >
                      {renderSportsIcons(sports, 12)}
                      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 whitespace-nowrap max-w-[80px] truncate">
                        {preset.name}
                      </span>
                    </button>
                  );
                })
              )}
              
              {/* Manage/Add Button */}
              <button
                onClick={() => setShowManagerSheet(true)}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-xl",
                  "bg-neutral-100 dark:bg-neutral-800",
                  "border border-neutral-200 dark:border-neutral-700",
                  "active:scale-[0.98] transition-transform"
                )}
              >
                <Settings className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Models Sheet */}
      <MobileModelsSheet
        open={showManagerSheet}
        onOpenChange={setShowManagerSheet}
        presets={presets}
        activePresets={activePresets}
        onTogglePreset={handleTogglePreset}
        onCreateNew={() => {
          setShowManagerSheet(false);
          setShowCreateModal(true);
        }}
        onEdit={(preset) => {
          setShowManagerSheet(false);
          setEditingPreset(preset);
        }}
        onPresetsChange={onPresetsChange}
      />

      {/* Create/Edit Modal */}
      <FilterPresetFormModal
        open={showCreateModal || !!editingPreset}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingPreset(null);
          }
        }}
        preset={editingPreset || undefined}
        onSuccess={handlePresetChange}
      />
    </>
  );
}

