"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  UserMinus,
  LayoutGrid,
  Trophy,
  Medal,
  CloudSun,
  Zap,
  Target,
  ShieldOff,
  Crosshair,
} from "lucide-react";
import Chart from "@/icons/chart";

interface CheatSheetTab {
  slug: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  href?: string; // Override for non-cheatsheet routes (e.g. hit-rates)
  comingSoon?: boolean;
}

const NBA_TABS: CheatSheetTab[] = [
  {
    slug: "hit-rates",
    label: "Hit Rates",
    shortLabel: "Hit Rates",
    icon: Chart,
    href: "/hit-rates/nba",
  },
  {
    slug: "hit-rates-sheet",
    label: "Top Props",
    shortLabel: "Top Props",
    icon: BarChart3,
    href: "/cheatsheets/nba/hit-rates",
  },
  {
    slug: "hit-rate-matrix",
    label: "Hit Rate Matrix",
    shortLabel: "Matrix",
    icon: LayoutGrid,
  },
  {
    slug: "alt-hit-matrix",
    label: "Alt Hit Matrix",
    shortLabel: "Alt Matrix",
    icon: TrendingUp,
  },
  {
    slug: "injury-impact",
    label: "Injury Impact",
    shortLabel: "Injuries",
    icon: UserMinus,
  },
  {
    slug: "triple-double-sheet",
    label: "Triple Double",
    shortLabel: "TD Sheet",
    icon: Trophy,
  },
  {
    slug: "double-double-sheet",
    label: "Double Double",
    shortLabel: "DD Sheet",
    icon: Medal,
  },
  {
    slug: "dvp",
    label: "Def vs Position",
    shortLabel: "DVP",
    icon: ShieldOff,
  },
  {
    slug: "king-of-the-court",
    label: "King of the Court",
    shortLabel: "KOTC",
    icon: Trophy,
    href: "/stats/nba/king-of-the-court",
  },
];

const MLB_TABS: CheatSheetTab[] = [
  {
    slug: "hit-rates",
    label: "Hit Rates",
    shortLabel: "Hit Rates",
    icon: Chart,
    href: "/hit-rates/mlb",
    comingSoon: true,
  },
  {
    slug: "slate-insights",
    label: "Slate Insights",
    shortLabel: "Slate",
    icon: BarChart3,
  },
  {
    slug: "hr-command-center",
    label: "HR Command Center",
    shortLabel: "HR Center",
    icon: Target,
  },
  {
    slug: "nrfi",
    label: "NRFI",
    shortLabel: "NRFI",
    icon: ShieldOff,
  },
  {
    slug: "exit-velocity",
    label: "Exit Velocity",
    shortLabel: "Exit Velo",
    icon: Zap,
  },
  {
    slug: "weather-report",
    label: "Weather Report",
    shortLabel: "Weather",
    icon: CloudSun,
  },
];

const SPORT_TABS: Record<string, CheatSheetTab[]> = {
  nba: NBA_TABS,
  mlb: MLB_TABS,
};

interface CheatSheetNavProps {
  sport: string;
  currentSheet: string;
  isMobile?: boolean;
  /** Set to true when rendering on a /cheatsheets/ page (maps "hit-rates" to "hit-rates-sheet" tab) */
  isCheatSheetPage?: boolean;
}

export function CheatSheetNav({ sport, currentSheet, isMobile = false, isCheatSheetPage = false }: CheatSheetNavProps) {
  const tabs = SPORT_TABS[sport] ?? [];
  if (tabs.length === 0) return null;

  // On cheat sheet pages, "hit-rates" in the URL is the Top Props sheet (slug "hit-rates-sheet")
  // On the hit rates tool page, "hit-rates" should stay as-is to highlight the Hit Rates tab
  const activeSlug = isCheatSheetPage && currentSheet === "hit-rates" ? "hit-rates-sheet" : currentSheet;

  // Preserve date param across tab navigation
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const appendDate = (url: string) => dateParam ? `${url}?date=${dateParam}` : url;

  if (isMobile) {
    return (
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = activeSlug === tab.slug;
            const href = appendDate(tab.href ?? `/cheatsheets/${sport}/${tab.slug}`);
            const Icon = tab.icon;

            if (tab.comingSoon) {
              return (
                <div
                  key={tab.slug}
                  className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 text-center border-b-2 border-transparent text-neutral-400 min-w-[80px] cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {tab.shortLabel}
                  </span>
                  <span className="text-[9px] text-neutral-400">Soon</span>
                </div>
              );
            }

            return (
              <Link
                key={tab.slug}
                href={href}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 text-center border-b-2 transition-all min-w-[80px]",
                  isActive
                    ? "border-brand text-brand bg-brand/5"
                    : "border-transparent text-neutral-500"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold whitespace-nowrap">
                  {tab.shortLabel}
                </span>
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
      <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide px-4">
        {tabs.map((tab) => {
          const isActive = activeSlug === tab.slug;
          const href = appendDate(tab.href ?? `/cheatsheets/${sport}/${tab.slug}`);
          const Icon = tab.icon;

          if (tab.comingSoon) {
            return (
              <div
                key={tab.slug}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent text-neutral-400 whitespace-nowrap cursor-not-allowed"
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  SOON
                </span>
              </div>
            );
          }

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
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
