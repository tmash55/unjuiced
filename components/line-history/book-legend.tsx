"use client";

import { getSportsbookById } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";

interface BookLegendProps {
  bookIds: string[];
  hiddenBookIds: Set<string>;
  loadingBookIds: Set<string>;
  onToggle: (bookId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  isMobile: boolean;
}

export function BookLegend({
  bookIds,
  hiddenBookIds,
  loadingBookIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  isMobile,
}: BookLegendProps) {
  const allVisible = bookIds.every((id) => !hiddenBookIds.has(id));
  const noneVisible = bookIds.every((id) => hiddenBookIds.has(id));

  return (
    <div className="flex items-center gap-1.5">
      {(onSelectAll || onDeselectAll) && (
        <button
          type="button"
          onClick={allVisible ? onDeselectAll : onSelectAll}
          className={cn(
            "inline-flex items-center rounded-md font-semibold border transition-all select-none cursor-pointer shrink-0",
            isMobile ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]",
            "border-neutral-300 dark:border-neutral-600",
            "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300",
            "hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          {allVisible ? "Hide All" : noneVisible ? "Show All" : "Show All"}
        </button>
      )}
      <div
        className={cn(
          "gap-1.5",
          isMobile
            ? "flex overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex flex-wrap"
        )}
      >
        {bookIds.map((bookId) => {
          const meta = getSportsbookById(bookId);
          const name = meta?.name || bookId;
          const color = meta?.brandColor || "#16a34a";
          const logo = meta?.image?.square || meta?.image?.light || null;
          const hidden = hiddenBookIds.has(bookId);
          const loading = loadingBookIds.has(bookId);

          return (
            <button
              key={bookId}
              type="button"
              onClick={() => onToggle(bookId)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md font-medium border transition-all select-none cursor-pointer shrink-0",
                isMobile ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]",
                "border-neutral-200 dark:border-neutral-700/80",
                hidden
                  ? "opacity-40 bg-neutral-100/50 dark:bg-neutral-800/30"
                  : "bg-white dark:bg-neutral-800/60",
                loading && "animate-pulse"
              )}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hidden ? "transparent" : color, border: `2px solid ${color}` }}
              />
              {logo && <img src={logo} alt="" className="w-3.5 h-3.5 object-contain" />}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
