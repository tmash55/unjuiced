"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  TrendingUp, 
  UserMinus 
} from "lucide-react";

interface CheatSheetTab {
  slug: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  comingSoon?: boolean;
}

const CHEAT_SHEET_TABS: CheatSheetTab[] = [
  {
    slug: "hit-rates",
    label: "Hit Rates",
    shortLabel: "Hit Rates",
    icon: BarChart3,
    description: "High-confidence props",
  },
  {
    slug: "alt-hit-matrix",
    label: "Alt Hit Matrix",
    shortLabel: "Alt Matrix",
    icon: TrendingUp,
    description: "Best alternate lines",
  },
  {
    slug: "injury-impact",
    label: "Injury Impact",
    shortLabel: "Injuries",
    icon: UserMinus,
    description: "Injury-affected props",
  },
];

interface CheatSheetNavProps {
  sport: string;
  currentSheet: string;
  isMobile?: boolean;
}

export function CheatSheetNav({ sport, currentSheet, isMobile = false }: CheatSheetNavProps) {
  if (isMobile) {
    return (
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex overflow-x-auto scrollbar-hide">
          {CHEAT_SHEET_TABS.map((tab) => {
            const isActive = currentSheet === tab.slug;
            const href = `/cheatsheets/${sport}/${tab.slug}`;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.slug}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 px-3 py-2.5 text-center border-b-2 transition-all min-w-[100px]",
                  isActive
                    ? "border-brand text-brand bg-brand/5"
                    : "border-transparent text-neutral-500"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold whitespace-nowrap">
                  {tab.shortLabel}
                </span>
                {tab.comingSoon && (
                  <span className="text-[9px] text-neutral-400">Soon</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="container mx-auto px-4">
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {CHEAT_SHEET_TABS.map((tab) => {
            const isActive = currentSheet === tab.slug;
            const href = `/cheatsheets/${sport}/${tab.slug}`;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.slug}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.comingSoon && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    SOON
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

