"use client";

import { useState } from "react";
import { ChevronDown, Filter, Layers, Plus, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEvModels } from "@/hooks/use-ev-models";
import { EvModelsManagerModal } from "@/components/ev-models/ev-models-manager-modal";
import { DEFAULT_MODEL_COLOR, type EvModel } from "@/lib/types/ev-models";
import { SHARP_PRESETS } from "@/lib/ev/constants";
import type { SharpPreset } from "@/lib/ev/types";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileEvModelsBarProps {
  sharpPreset: SharpPreset;
  onSharpPresetChange?: (preset: SharpPreset) => void;
  onModelsChanged?: () => void;
}

export function MobileEvModelsBar({
  sharpPreset,
  onSharpPresetChange,
  onModelsChanged,
}: MobileEvModelsBarProps) {
  const { activeModels, toggleModel, deactivateAll } = useEvModels();
  const [managerOpen, setManagerOpen] = useState(false);

  const currentPreset = SHARP_PRESETS[sharpPreset];
  const isCustomMode = activeModels.length > 0;

  const handleSelectPreset = async (preset: SharpPreset) => {
    if (activeModels.length > 0) {
      await deactivateAll();
    }
    onSharpPresetChange?.(preset);
    onModelsChanged?.();
  };

  const handleRemoveModel = async (model: EvModel) => {
    if (!model.is_active) return;
    await toggleModel(model.id, false);
    onModelsChanged?.();
  };

  const getBookLogo = (bookId: string) => {
    const sb = getSportsbookById(bookId);
    return sb?.image?.light || sb?.image?.dark || sb?.image?.square || null;
  };

  return (
    <>
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Mode badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0",
              isCustomMode
                ? "bg-violet-100/70 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            )}
          >
            {isCustomMode ? (
              <Layers className="w-3.5 h-3.5" />
            ) : (
              <Filter className="w-3.5 h-3.5" />
            )}
            <span>{isCustomMode ? "Custom" : "Preset"}</span>
          </div>

          {/* Preset selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 shrink-0">
                {currentPreset?.books?.[0]?.bookId && getBookLogo(currentPreset.books[0].bookId) ? (
                  <img
                    src={getBookLogo(currentPreset.books[0].bookId)!}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-neutral-500" />
                )}
                <span className="max-w-[110px] truncate">
                  {currentPreset?.label || "Sharp Preset"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Sharp Presets
              </div>
              {Object.values(SHARP_PRESETS)
                .filter((preset) => preset.id !== "custom")
                .map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  className="flex items-center gap-3 px-2 py-2"
                >
                  <div className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    {preset.books[0]?.bookId && getBookLogo(preset.books[0].bookId) ? (
                      <img
                        src={getBookLogo(preset.books[0].bookId)!}
                        alt=""
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <Zap className="w-3 h-3 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {preset.label}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {preset.description}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setManagerOpen(true)}
                className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300"
              >
                <Layers className="w-4 h-4" />
                Manage Models
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active custom models */}
          {activeModels.map((model) => (
            <button
              key={model.id}
              onClick={() => handleRemoveModel(model)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-800 shrink-0"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: model.color || DEFAULT_MODEL_COLOR }}
              />
              <span className="max-w-[90px] truncate">{model.name}</span>
              <X className="w-3 h-3 text-violet-500" />
            </button>
          ))}

          {/* Add / Manage */}
          <button
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Models
          </button>
        </div>
      </div>

      {/* Modals */}
      <EvModelsManagerModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onModelsChanged={onModelsChanged}
      />
    </>
  );
}
