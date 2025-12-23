"use client";

import { useState } from "react";
import { Plus, Settings, X, Sparkles, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { parseSports, formatSharpBooks } from "@/lib/types/filter-presets";
import { FilterPresetFormModal } from "./filter-preset-form-modal";
import { FilterPresetsManagerModal } from "./filter-presets-manager-modal";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.icon || null;
};

// Render single or multi-sport icon cluster
const renderSportsIcon = (sports: string[], sizePx = 14) => {
  if (!sports || sports.length === 0) {
    return <SportIcon sport="nba" className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />;
  }

  if (sports.length === 1) {
    return <SportIcon sport={sports[0]} className="w-4 h-4" style={{ width: sizePx, height: sizePx }} />;
  }

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

// Colors for mini pie chart segments
const CHART_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

const MiniPieChart = ({
  books,
  weights,
  size = 72,
}: {
  books: string[];
  weights: Record<string, number>;
  size?: number;
}) => {
  if (books.length === 0) return null;
  const center = size / 2;
  const outer = (size / 2) - 4;
  const inner = outer * 0.55;
  const strokeWidth = outer - inner;

  // Single book - render as solid donut ring
  if (books.length === 1) {
    const midRadius = (outer + inner) / 2;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={midRadius}
          fill="none"
          stroke={CHART_COLORS[0]}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  // Build segments for multiple books
  const hasWeights = weights && Object.keys(weights).length > 0;
  let currentAngle = -90;
  const segments = books.map((book, i) => {
    const value = hasWeights ? (weights[book] || 0) : (100 / books.length);
    const sweep = (value / 100) * 360;
    const seg = {
      book,
      color: CHART_COLORS[i % CHART_COLORS.length],
      start: currentAngle,
      end: currentAngle + sweep,
    };
    currentAngle += sweep;
    return seg;
  });

  const arcPath = (start: number, end: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sr = toRad(start);
    const er = toRad(end);
    const x1 = center + outer * Math.cos(sr);
    const y1 = center + outer * Math.sin(sr);
    const x2 = center + outer * Math.cos(er);
    const y2 = center + outer * Math.sin(er);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${center} ${center} L ${x1} ${y1} A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg) => (
        <path key={seg.book} d={arcPath(seg.start, seg.end)} fill={seg.color} />
      ))}
      <circle cx={center} cy={center} r={inner} className="fill-white dark:fill-neutral-900" />
    </svg>
  );
};

interface FilterPresetsBarProps {
  className?: string;
  onPresetsChange?: () => void;
}

export function FilterPresetsBar({ className, onPresetsChange }: FilterPresetsBarProps) {
  const {
    presets,
    activePresets,
    isLoading,
    togglePreset,
  } = useFilterPresets();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);

  // Handle preset created/updated
  const handlePresetChange = () => {
    onPresetsChange?.();
  };

  // Check if we're in custom mode (any active presets)
  const isCustomMode = activePresets.length > 0;

  // New user / no presets state
  if (!isLoading && presets.length === 0) {
    return (
      <>
        <div className={cn(
          "flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30",
          className
        )}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Create custom models for better edge finding
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Compare against specific sharp books
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            icon={<Plus className="w-4 h-4" />}
            text="Create Model"
            className="h-8 text-xs"
          />
        </div>

        <FilterPresetFormModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={handlePresetChange}
        />
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-3 h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800", className)}>
        <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        <div className="h-6 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all",
        "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50",
        className
      )}>
        {/* Mode Badge */}
        <div className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
          isCustomMode 
            ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100" 
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
        )}>
          <Filter className="w-3 h-3" />
          <span>{isCustomMode ? "Custom" : "Preset"}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />

        {isCustomMode ? (
          /* Custom Mode: Active Filters */
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
            {activePresets.map((preset) => {
              const sports = parseSports(preset.sport);
              const sharpBooks = preset.sharp_books || [];
              const weights = preset.book_weights || {};

              return (
                <Tooltip
                  key={preset.id}
                  content={
                    <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md min-w-[200px]">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        <MiniPieChart books={sharpBooks} weights={weights} size={20} />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{preset.name}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {sharpBooks.slice(0, 4).map((book, i) => {
                          const logo = getBookLogo(book);
                          const weight = Object.keys(weights).length > 0 ? (weights[book] || 0) : Math.round(100 / sharpBooks.length);
                          return (
                            <div key={book} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                              {logo ? (
                                <img src={logo} alt={book} className="h-4 w-4 object-contain rounded-sm" />
                              ) : (
                                <span className="h-4 w-4 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                              )}
                              <span className="capitalize flex-1">{book}</span>
                              <span className="font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{weight}%</span>
                            </div>
                          );
                        })}
                        {sharpBooks.length > 4 && (
                          <span className="text-[11px] text-neutral-400">+{sharpBooks.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  }
                >
                  <div
                    className="group flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors flex-shrink-0"
                  >
                    {/* Sport Icon (multi-sport aware) */}
                    <div className="text-neutral-500 dark:text-neutral-300">
                      {renderSportsIcon(sports, 14)}
                    </div>
                    
                    {/* Filter Name */}
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200 max-w-[100px] truncate">
                      {preset.name}
                    </span>

                    {/* Book Logos */}
                    {sharpBooks.length > 0 && (
                      <div className="flex items-center -space-x-1 ml-1">
                        {sharpBooks.slice(0, 2).map((book) => {
                          const logo = getBookLogo(book);
                          return logo ? (
                            <img 
                              key={book}
                              src={logo} 
                              alt={book} 
                              className="h-4 w-4 object-contain rounded-sm ring-1 ring-white dark:ring-neutral-800"
                            />
                          ) : null;
                        })}
                        {sharpBooks.length > 2 && (
                          <span className="text-[10px] text-neutral-400 ml-1">+{sharpBooks.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreset(preset.id, false);
                      }}
                      className="flex items-center justify-center w-5 h-5 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </Tooltip>
              );
            })}

            {/* Add More */}
            <button
              onClick={() => setShowManagerModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors flex-shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        ) : (
          /* Preset Mode: Quick Filter Selection */
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
              Filters:
            </span>
            {presets.slice(0, 5).map((preset) => {
              const sports = parseSports(preset.sport);
              const sharpBooks = preset.sharp_books || [];
              const weights = preset.book_weights || {};
              return (
                <Tooltip
                  key={preset.id}
                  content={
                    <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md min-w-[200px]">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        {sharpBooks.length > 0 ? (
                          <MiniPieChart books={sharpBooks} weights={weights} size={20} />
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            {renderSportsIcon(sports, 16)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{preset.name}</span>
                      </div>
                      {sharpBooks.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {sharpBooks.slice(0, 4).map((book, i) => {
                            const logo = getBookLogo(book);
                            const weight = Object.keys(weights).length > 0 ? (weights[book] || 0) : Math.round(100 / sharpBooks.length);
                            return (
                              <div key={book} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                                {logo ? (
                                  <img src={logo} alt={book} className="h-4 w-4 object-contain rounded-sm" />
                                ) : (
                                  <span className="h-4 w-4 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
                                )}
                                <span className="capitalize flex-1">{book}</span>
                                <span className="font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{weight}%</span>
                              </div>
                            );
                          })}
                          {sharpBooks.length > 4 && (
                            <span className="text-[11px] text-neutral-400">+{sharpBooks.length - 4} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">No sharp books set</span>
                      )}
                    </div>
                  }
                >
                  <button
                    onClick={() => togglePreset(preset.id, true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-100 transition-all flex-shrink-0"
                  >
                  {renderSportsIcon(sports, 14)}
                    <span className="max-w-[80px] truncate">{preset.name}</span>
                  </button>
                </Tooltip>
              );
            })}
            {presets.length > 5 && (
              <button
                onClick={() => setShowManagerModal(true)}
                className="text-xs font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors flex-shrink-0"
              >
                +{presets.length - 5}
              </button>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tooltip content="Manage models">
            <button
              onClick={() => setShowManagerModal(true)}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-lg transition-colors",
                "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="New model">
            <button
              onClick={() => setShowCreateModal(true)}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-lg transition-colors",
                "text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Exit Custom Mode */}
        {isCustomMode && (
          <>
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
            <Tooltip content="Exit custom mode">
              <button
                onClick={() => activePresets.forEach(p => togglePreset(p.id, false))}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-3 h-3" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </Tooltip>
          </>
        )}
      </div>

      {/* Modals */}
      <FilterPresetFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handlePresetChange}
      />
      <FilterPresetsManagerModal
        open={showManagerModal}
        onOpenChange={setShowManagerModal}
        onCreateNew={() => {
          setShowManagerModal(false);
          setShowCreateModal(true);
        }}
      />
    </>
  );
}
