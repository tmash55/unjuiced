"use client";

import type { ReactNode } from "react";
import { Heart, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import {
  HeaderHitRateStrip,
  type HeaderGameCountFilter,
  type HeaderHitRateStripItem,
} from "@/components/hit-rates/header-hit-rate-strip";

interface HeaderLineEditorConfig {
  enabled: boolean;
  isEditing: boolean;
  editValue: string;
  placeholder?: string;
  tooltipContent?: ReactNode;
  showReset?: boolean;
  resetTitle?: string;
  onStartEditing: () => void;
  onEditValueChange: (value: string) => void;
  onCommitEditing: () => void;
  onCancelEditing: () => void;
  onReset?: () => void;
}

interface HeaderOddsFavoriteConfig {
  active: boolean;
  tooltip: string;
  disabled?: boolean;
  onToggle: () => void;
}

export interface HeaderOddsCardConfig {
  sideLabel: "O" | "U";
  bookLogoSrc?: string | null;
  bookName?: string | null;
  bookFallbackLabel?: string | null;
  priceText?: string | null;
  priceClassName?: string;
  onClick?: () => void;
  favorite?: HeaderOddsFavoriteConfig;
}

interface DrilldownHeaderRightPanelProps {
  primaryColor?: string | null;
  lineText: string;
  lineEditor?: HeaderLineEditorConfig;
  oddsCards: [HeaderOddsCardConfig, HeaderOddsCardConfig];
  stripItems: HeaderHitRateStripItem[];
  selectedStrip: HeaderGameCountFilter;
  onSelectStrip: (count: HeaderGameCountFilter) => void;
}

function OddsCard({ card }: { card: HeaderOddsCardConfig }) {
  const content = (
    <>
      {card.bookLogoSrc ? (
        <img src={card.bookLogoSrc} alt={card.bookName || card.sideLabel} className="h-4 w-4 object-contain" />
      ) : card.bookFallbackLabel ? (
        <span className="text-[10px] font-medium text-neutral-500">{card.bookFallbackLabel}</span>
      ) : null}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">{card.sideLabel}</span>
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            card.priceText == null
              ? "text-neutral-400 dark:text-neutral-500"
              : card.priceClassName ?? "text-neutral-700 dark:text-neutral-300"
          )}
        >
          {card.priceText ?? "-"}
        </span>
      </div>
    </>
  );

  if (card.onClick) {
    return (
      <button
        type="button"
        onClick={card.onClick}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-brand/40 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      {content}
    </div>
  );
}

export function DrilldownHeaderRightPanel({
  primaryColor,
  lineText,
  lineEditor,
  oddsCards,
  stripItems,
  selectedStrip,
  onSelectStrip,
}: DrilldownHeaderRightPanelProps) {
  const chip = (
    <div
      className={cn(
        "relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg",
        lineEditor?.enabled &&
          "transition-all cursor-pointer hover:shadow-xl hover:scale-[1.02]",
        lineEditor?.showReset &&
          !lineEditor.isEditing &&
          "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
      )}
      style={{ backgroundColor: primaryColor || "#6366f1" }}
      onClick={lineEditor?.enabled ? lineEditor.onStartEditing : undefined}
    >
      {lineEditor?.enabled && lineEditor.isEditing ? (
        <input
          type="number"
          step="0.5"
          value={lineEditor.editValue}
          onChange={(e) => lineEditor.onEditValueChange(e.target.value)}
          onBlur={lineEditor.onCommitEditing}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              lineEditor.onCommitEditing();
            } else if (e.key === "Escape") {
              lineEditor.onCancelEditing();
            }
          }}
          autoFocus
          className="w-16 text-lg font-black text-center bg-white/20 text-white rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50"
          placeholder={lineEditor.placeholder || "0"}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-lg font-black text-white tracking-tight">{lineText}</span>
      )}

      {lineEditor?.enabled && !lineEditor.isEditing && <Pencil className="h-3.5 w-3.5 text-white/50" />}

      {lineEditor?.enabled && lineEditor.showReset && !lineEditor.isEditing && lineEditor.onReset && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            lineEditor.onReset?.();
          }}
          className="ml-1 p-0.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          title={lineEditor.resetTitle || "Reset line"}
        >
          <X className="h-3 w-3 text-white" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 pl-6 pr-5 py-4 border-l border-neutral-200/60 dark:border-neutral-800/60 bg-gradient-to-l from-white/40 to-transparent dark:from-neutral-900/40 dark:to-transparent">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {lineEditor?.tooltipContent ? (
            <Tooltip content={lineEditor.tooltipContent} side="bottom">
              {chip}
            </Tooltip>
          ) : (
            chip
          )}

          <div className="flex items-center gap-2">
            {oddsCards.map((card) => (
              <div key={card.sideLabel} className="flex items-center gap-1">
                <OddsCard card={card} />
                {card.favorite && (
                  <Tooltip content={card.favorite.tooltip} side="bottom">
                    <button
                      type="button"
                      onClick={card.favorite.onToggle}
                      disabled={card.favorite.disabled}
                      className={cn(
                        "p-2 rounded-lg border transition-all",
                        card.favorite.active
                          ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-500"
                          : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-700",
                        card.favorite.disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Heart className={cn("h-4 w-4", card.favorite.active && "fill-current")} />
                    </button>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </div>

        <HeaderHitRateStrip items={stripItems} selected={selectedStrip} onSelect={onSelectStrip} />
      </div>
    </div>
  );
}
