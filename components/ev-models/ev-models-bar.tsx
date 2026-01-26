"use client";

import { useState } from "react";
import { Plus, Settings2, X, ChevronDown, Check, Zap } from "lucide-react";
import { Star } from "@/components/star";
import { useEvModels } from "@/hooks/use-ev-models";
import { EvModelFormModal } from "./ev-model-form-modal";
import { EvModelsManagerModal } from "./ev-models-manager-modal";
import { formatEvSharpBooks, formatEvMarketType, type EvModel } from "@/lib/types/ev-models";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sharp presets for quick selection (built-in, not custom models)
type SharpPreset = {
  id: string;
  name: string;
  description: string;
  sharpBooks: string[];
  devigMethods: string[];
};

const SHARP_PRESETS: SharpPreset[] = [
  {
    id: "pinnacle",
    name: "Pinnacle",
    description: "100% Pinnacle sharp line",
    sharpBooks: ["pinnacle"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "circa",
    name: "Circa",
    description: "100% Circa sharp line",
    sharpBooks: ["circa"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "draftkings",
    name: "DraftKings",
    description: "DraftKings reference line",
    sharpBooks: ["draftkings"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "fanduel",
    name: "FanDuel",
    description: "FanDuel reference line",
    sharpBooks: ["fanduel"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "betmgm",
    name: "BetMGM",
    description: "BetMGM reference line",
    sharpBooks: ["betmgm"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "caesars",
    name: "Caesars",
    description: "Caesars reference line",
    sharpBooks: ["caesars"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "hard_rock",
    name: "Hard Rock",
    description: "Hard Rock reference line",
    sharpBooks: ["hard_rock"],
    devigMethods: ["power", "multiplicative"],
  },
  {
    id: "bet365",
    name: "Bet365",
    description: "Bet365 reference line",
    sharpBooks: ["bet365"],
    devigMethods: ["power", "multiplicative"],
  },
];

// Get sportsbook logo
const getBookLogo = (bookId: string) => {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.dark || sb?.image?.square || null;
};

interface EvModelsBarProps {
  selectedPreset: string | null;
  onSelectPreset: (presetId: string | null) => void;
  activeCustomModels: EvModel[];
  onToggleCustomModel: (modelId: string, isActive: boolean) => void;
  onModelsChanged?: () => void;
  className?: string;
}

export function EvModelsBar({
  selectedPreset,
  onSelectPreset,
  activeCustomModels,
  onToggleCustomModel,
  onModelsChanged,
  className,
}: EvModelsBarProps) {
  const { models, isLoading, toggleModel } = useEvModels();
  const [managerOpen, setManagerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [presetsDropdownOpen, setPresetsDropdownOpen] = useState(false);

  const handleSelectPreset = (presetId: string) => {
    // When selecting a preset, deactivate all custom models
    activeCustomModels.forEach(model => {
      onToggleCustomModel(model.id, false);
    });
    onSelectPreset(presetId);
  };

  const handleToggleCustomModel = async (model: EvModel) => {
    // When activating a custom model, clear the selected preset
    if (!model.is_active) {
      onSelectPreset(null);
    }
    
    try {
      await toggleModel(model.id, !model.is_active);
      onToggleCustomModel(model.id, !model.is_active);
    } catch (err) {
      console.error("Failed to toggle model:", err);
    }
  };

  const handleRemoveCustomModel = async (modelId: string) => {
    try {
      await toggleModel(modelId, false);
      onToggleCustomModel(modelId, false);
    } catch (err) {
      console.error("Failed to deactivate model:", err);
    }
  };

  // Find currently selected preset
  const currentPreset = SHARP_PRESETS.find(p => p.id === selectedPreset);

  return (
    <>
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {/* Preset Dropdown */}
        <DropdownMenu open={presetsDropdownOpen} onOpenChange={setPresetsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "h-9 px-3 rounded-lg border text-sm font-medium transition-all flex items-center gap-2",
                selectedPreset
                  ? "bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300"
                  : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600"
              )}
            >
              {currentPreset ? (
                <>
                  {getBookLogo(currentPreset.sharpBooks[0]) ? (
                    <img 
                      src={getBookLogo(currentPreset.sharpBooks[0])!} 
                      alt="" 
                      className="w-4 h-4 object-contain" 
                    />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {currentPreset.name}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Sharp Reference
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <div className="px-2 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Sharp Presets
            </div>
            {SHARP_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => {
                  handleSelectPreset(preset.id);
                  setPresetsDropdownOpen(false);
                }}
                className="flex items-center gap-3 px-2 py-2"
              >
                <div className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  {getBookLogo(preset.sharpBooks[0]) ? (
                    <img 
                      src={getBookLogo(preset.sharpBooks[0])!} 
                      alt="" 
                      className="w-4 h-4 object-contain" 
                    />
                  ) : (
                    <Zap className="w-3 h-3 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {preset.name}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {preset.description}
                  </p>
                </div>
                {selectedPreset === preset.id && (
                  <Check className="w-4 h-4 text-sky-500" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Separator */}
        {(selectedPreset || activeCustomModels.length > 0) && (
          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
        )}

        {/* Active Custom Models */}
        {activeCustomModels.map((model) => (
          <div
            key={model.id}
            className="h-9 px-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-300 dark:border-violet-700 flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5">
              {model.sharp_books.slice(0, 2).map((bookId) => {
                const logo = getBookLogo(bookId);
                return logo ? (
                  <img key={bookId} src={logo} alt="" className="w-4 h-4 object-contain" />
                ) : null;
              })}
            </div>
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              {model.name}
            </span>
            <button
              onClick={() => handleRemoveCustomModel(model.id)}
              className="ml-1 p-0.5 rounded hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-violet-500" />
            </button>
          </div>
        ))}

        {/* Custom Models Dropdown */}
        {models.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 px-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" />
                Add Model
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <div className="px-2 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Your Custom Models
              </div>
              {models.filter(m => !m.is_active).map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => handleToggleCustomModel(model)}
                  className="flex items-center gap-3 px-2 py-2"
                >
                  <div className="flex items-center gap-1">
                    {model.sharp_books.slice(0, 2).map((bookId) => {
                      const logo = getBookLogo(bookId);
                      return (
                        <div key={bookId} className="w-5 h-5 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                          {logo ? (
                            <img src={logo} alt="" className="w-3.5 h-3.5 object-contain" />
                          ) : (
                            <span className="text-[8px] font-bold text-neutral-500">{bookId.slice(0,2).toUpperCase()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {model.name}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {formatEvSharpBooks(model.sharp_books)} &bull; {formatEvMarketType(model.market_type)}
                    </p>
                  </div>
                  {model.is_favorite && (
                    <Star filled className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </DropdownMenuItem>
              ))}
              {models.filter(m => !m.is_active).length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-neutral-500">
                  All models are active
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 text-sky-600 dark:text-sky-400"
              >
                <Plus className="w-4 h-4" />
                Create New Model
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Manage Models Button */}
        <Tooltip content="Manage Models">
          <button
            onClick={() => setManagerOpen(true)}
            className="h-9 w-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Modals */}
      <EvModelsManagerModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onModelsChanged={onModelsChanged}
      />
      
      <EvModelFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          setFormOpen(false);
          onModelsChanged?.();
        }}
      />
    </>
  );
}
