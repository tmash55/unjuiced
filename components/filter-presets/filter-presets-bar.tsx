"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Settings, X, Sparkles, Filter, ChevronDown, Pencil, ArrowLeftRight } from "lucide-react";
import Logout from "@/icons/logout";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { parseSports, formatSharpBooks, FilterPreset } from "@/lib/types/filter-presets";
import { FilterPresetFormModal } from "./filter-preset-form-modal";
import { FilterPresetsManagerModal } from "./filter-presets-manager-modal";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// localStorage key for last active presets
const LAST_ACTIVE_PRESETS_KEY = "edge-finder-last-active-presets";

// CSS for static gradient border in custom mode
const customModeStyles = `
.custom-mode-glow {
  position: relative;
}
.custom-mode-glow::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 14px;
  padding: 1px;
  background: linear-gradient(
    90deg,
    #f472b6,
    #c084fc,
    #818cf8,
    #60a5fa,
    #34d399,
    #fbbf24,
    #fb923c,
    #f472b6
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.6;
}
`;

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || sb?.image?.long || null;
};

// Render single or multi-sport icon cluster
const renderSportsIcon = (sports: string[], sizePx = 14) => {
  if (!sports || sports.length === 0) {
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{ width: sizePx, height: sizePx }}
      >
        <SportIcon sport="nba" className="w-full h-full" />
      </span>
    );
  }

  if (sports.length === 1) {
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{ width: sizePx, height: sizePx }}
      >
        <SportIcon sport={sports[0]} className="w-full h-full" />
      </span>
    );
  }

  const first = sports[0];
  const second = sports[1];

  return (
    <div className="flex -space-x-1 items-center">
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <span
          className="inline-flex items-center justify-center"
          style={{ width: sizePx, height: sizePx }}
        >
          <SportIcon sport={first} className="w-full h-full" />
        </span>
      </div>
      <div className="rounded-full ring-1 ring-white dark:ring-neutral-800">
        <span
          className="inline-flex items-center justify-center"
          style={{ width: sizePx, height: sizePx }}
        >
          <SportIcon sport={second} className="w-full h-full" />
        </span>
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
  /** Called when hovering over a preset (for prefetching data) */
  onPresetHover?: (preset: FilterPreset) => void;
}

export function FilterPresetsBar({ className, onPresetsChange, onPresetHover }: FilterPresetsBarProps) {
  const {
    presets,
    activePresets,
    isLoading,
    togglePreset,
  } = useFilterPresets();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<typeof presets[0] | null>(null);
  const [lastActivePresetIds, setLastActivePresetIds] = useState<string[]>([]);

  // Load last active presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_ACTIVE_PRESETS_KEY);
      if (stored) {
        setLastActivePresetIds(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Handle preset created/updated
  const handlePresetChange = () => {
    onPresetsChange?.();
  };

  // Check if we're in custom mode (any active presets)
  const isCustomMode = activePresets.length > 0;

  // Exit custom mode - save current presets and deactivate all
  const handleExitCustomMode = useCallback(async () => {
    // Save current active preset IDs to localStorage
    const currentIds = activePresets.map(p => p.id);
    setLastActivePresetIds(currentIds);
    try {
      localStorage.setItem(LAST_ACTIVE_PRESETS_KEY, JSON.stringify(currentIds));
    } catch {
      // Ignore localStorage errors
    }
    // Deactivate all presets
    await Promise.all(activePresets.map(p => togglePreset(p.id, false)));
  }, [activePresets, togglePreset]);

  // Switch back to custom mode - reactivate last active presets
  const handleSwitchToCustom = useCallback(async () => {
    // Find presets that still exist and reactivate them
    const validIds = lastActivePresetIds.filter(id => presets.some(p => p.id === id));
    if (validIds.length > 0) {
      await Promise.all(validIds.map(id => togglePreset(id, true)));
    }
  }, [lastActivePresetIds, presets, togglePreset]);

  // Check if we have saved presets to switch back to
  const hasSavedPresets = lastActivePresetIds.length > 0 && 
    lastActivePresetIds.some(id => presets.some(p => p.id === id));

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
      {/* Inject styles for animated gradient border */}
      {isCustomMode && <style>{customModeStyles}</style>}
      
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all",
        isCustomMode 
          ? "custom-mode-glow border-transparent bg-white dark:bg-neutral-900/80"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50",
        className
      )}>
        {/* Mode Badge */}
        <div className={cn(
          "flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
          isCustomMode 
            ? "bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 dark:from-pink-900/30 dark:via-purple-900/30 dark:to-blue-900/30 text-purple-700 dark:text-purple-300" 
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
        )}>
          {isCustomMode ? (
            <Sparkles className="w-3 h-3" />
          ) : (
            <Filter className="w-3 h-3" />
          )}
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
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg min-w-[220px]">
                      {/* Header with name */}
                      <div className="text-center mb-3">
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{preset.name}</span>
                      </div>
                      
                      {/* Pie Chart with Book Logos */}
                      <div className="flex items-center justify-center mb-4">
                        <MiniPieChart books={sharpBooks} weights={weights} size={72} />
                      </div>

                      {/* Book logos row */}
                      <div className="flex items-center justify-center gap-3 mb-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                        {sharpBooks.slice(0, 5).map((book, i) => {
                          const logo = getBookLogo(book);
                          const color = CHART_COLORS[i % CHART_COLORS.length];
                          return (
                            <div key={book} className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                                {logo ? (
                                  <img src={logo} alt={book} className="h-5 w-5 object-contain" />
                                ) : (
                                  <span className="text-[10px] font-medium text-neutral-500 uppercase">{book.slice(0, 2)}</span>
                                )}
                              </div>
                              {/* Color indicator dot */}
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            </div>
                          );
                        })}
                        {sharpBooks.length > 5 && (
                          <span className="text-[10px] text-neutral-400 font-medium">+{sharpBooks.length - 5}</span>
                        )}
                      </div>

                      {/* Sports list */}
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">Sports:</span>
                        <div className="flex items-center gap-1.5">
                          {sports.map((sport) => (
                            <div key={sport} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                              <SportIcon sport={sport} className="h-3 w-3 text-neutral-600 dark:text-neutral-300" />
                              <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300 uppercase">{sport}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPreset(preset);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit Model
                      </button>
                    </div>
                  }
                >
                  <div
                    className="group flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors flex-shrink-0"
                    onMouseEnter={() => onPresetHover?.(preset)}
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
                    <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg min-w-[220px]">
                      {/* Header with name */}
                      <div className="text-center mb-3">
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{preset.name}</span>
                      </div>
                      
                      {sharpBooks.length > 0 ? (
                        <>
                          {/* Pie Chart with Book Logos */}
                          <div className="flex items-center justify-center mb-4">
                            <MiniPieChart books={sharpBooks} weights={weights} size={72} />
                          </div>

                          {/* Book logos row */}
                          <div className="flex items-center justify-center gap-3 mb-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                            {sharpBooks.slice(0, 5).map((book, i) => {
                              const logo = getBookLogo(book);
                              const color = CHART_COLORS[i % CHART_COLORS.length];
                              return (
                                <div key={book} className="flex flex-col items-center gap-1">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                                    {logo ? (
                                      <img src={logo} alt={book} className="h-5 w-5 object-contain" />
                                    ) : (
                                      <span className="text-[10px] font-medium text-neutral-500 uppercase">{book.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  {/* Color indicator dot */}
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                </div>
                              );
                            })}
                            {sharpBooks.length > 5 && (
                              <span className="text-[10px] text-neutral-400 font-medium">+{sharpBooks.length - 5}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center mb-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-xs text-neutral-500">No sharp books configured</span>
                        </div>
                      )}

                      {/* Sports list */}
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">Sports:</span>
                        <div className="flex items-center gap-1.5">
                          {sports.map((sport) => (
                            <div key={sport} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                              <SportIcon sport={sport} className="h-3 w-3 text-neutral-600 dark:text-neutral-300" />
                              <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300 uppercase">{sport}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPreset(preset);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit Model
                      </button>
                    </div>
                  }
                >
                  <button
                    onClick={() => togglePreset(preset.id, true)}
                    onMouseEnter={() => onPresetHover?.(preset)}
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

        {/* Mode Toggle - Exit or Switch */}
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
        {isCustomMode ? (
          <Tooltip content="Switch to default preset mode">
            <button
              onClick={handleExitCustomMode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Default</span>
            </button>
          </Tooltip>
        ) : hasSavedPresets ? (
          <Tooltip content="Switch back to custom models">
            <button
              onClick={handleSwitchToCustom}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Custom</span>
            </button>
          </Tooltip>
        ) : null}
      </div>

      {/* Modals */}
      <FilterPresetFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handlePresetChange}
      />
      <FilterPresetFormModal
        open={!!editingPreset}
        onOpenChange={(open) => !open && setEditingPreset(null)}
        preset={editingPreset || undefined}
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
