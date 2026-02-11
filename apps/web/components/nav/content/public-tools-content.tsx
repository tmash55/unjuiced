"use client";

import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { CSSProperties } from "react";
import { Grid } from "@/components/grid";
import { getUtmParams, createHref } from "./shared";
import { Link2, TrendingUp, BarChart3, Target, Zap } from "lucide-react";
import { LinksGraphic } from "./graphics/links-graphic";
import { EdgeFinderGraphic } from "./graphics/edge-finder-graphic";
import { HitRatesGraphic } from "./graphics/hit-rates-graphic";
import Chart from "@/icons/chart";

/**
 * Public tools content - links to /tools/* preview pages
 * Used in the public navbar for unauthenticated users
 */

const tools = [
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-blue-400">
        <Link2 className="size-2.5 text-blue-900" />
      </div>
    ),
    title: "Arbitrage",
    description: "Risk-free opportunities across books with automatic leg matching and sizing.",
    href: "/tools/arbitrage",
    color: "#2563eb",
    graphicsContainerClassName: "px-2",
    graphic: <LinksGraphic className="absolute left-0 top-0 h-auto w-full" />,
  },
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-emerald-400">
        <Chart className="size-2.5 text-emerald-900" />
      </div>
    ),
    title: "Hit Rates",
    description: "Player prop hit rates with L5, L10, L20, season stats and matchup analysis.",
    href: "/tools/hit-rates",
    color: "#10b981",
    graphicsContainerClassName: "h-[170%] bottom-0 top-[unset]",
    graphic: (
      <HitRatesGraphic className="absolute bottom-0 left-0 size-full" />
    ),
    badge: "NEW",
  },
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-amber-400">
        <TrendingUp className="size-2.5 text-amber-900" />
      </div>
    ),
    title: "Edge Finder",
    description: "Find mispriced odds across every sportsbook in seconds.",
    href: "/tools/edge-finder",
    color: "#f59e0b",
    graphicsContainerClassName: "px-2",
    graphic: <EdgeFinderGraphic className="absolute left-0 top-0 h-auto w-full" />,
  },
];

const largeLinks = [
  {
    title: "Odds Screen",
    description: "Live market odds with fast updates, line movement, and best-price highlights.",
    href: "/tools/odds",
    graphic: null,
    color: "#00b4d8",
  },
  {
    title: "Positive EV",
    description: "Data-driven edges with expected ROI on every bet.",
    href: "/tools/positive-ev",
    graphic: null,
    color: "#8b5cf6",
  },
];

export function PublicToolsContent({ domain }: { domain: string }) {
  return (
    <div className="grid w-[1020px] grid-cols-1 gap-4 p-4">
      <div className="grid grid-cols-3 gap-4">
        {tools.map(
          ({
            title,
            description,
            icon,
            href,
            color,
            graphicsContainerClassName,
            graphic,
            badge,
          }) => (
            <NavigationMenuLink asChild key={title}>
              <Link
                href={createHref(
                  href,
                  domain,
                  getUtmParams({ domain, utm_content: title }),
                )}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 dark:border-white/20 dark:bg-white/10"
              >
                <Grid
                  className="[mask-image:linear-gradient(transparent,black,transparent)] dark:text-white/5"
                  cellSize={60}
                  patternOffset={[-51, -23]}
                />
                <div className="relative p-5 pb-0">
                  {icon}
                  <span className="mt-3 flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
                    {title}
                    {badge && (
                      <span className="rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        {badge}
                      </span>
                    )}
                  </span>
                  <p className="mt-2 max-w-56 text-sm text-neutral-500 dark:text-white/60">
                    {description}
                  </p>
                </div>
                <div className="relative mt-10 h-40 grow">
                  <div
                    className={cn(
                      "absolute left-0 top-0 size-full grow overflow-hidden [mask-image:linear-gradient(black_50%,transparent)]",
                      graphicsContainerClassName,
                    )}
                  >
                    <div className="relative size-full">{graphic}</div>
                  </div>
                </div>
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,var(--color),transparent)] opacity-[0.07] transition-opacity duration-150 group-hover:opacity-15"
                  style={
                    {
                      "--color": color,
                    } as CSSProperties
                  }
                />
              </Link>
            </NavigationMenuLink>
          ),
        )}
      </div>
      <div className="grid grow grid-cols-2 gap-4">
        {largeLinks.map(({ title, description, href, graphic, color }) => (
          <NavigationMenuLink asChild key={title}>
            <Link
              href={createHref(
                href,
                domain,
                getUtmParams({ domain, utm_content: title }),
              )}
              className="group relative flex flex-col justify-center rounded-xl border border-neutral-100 bg-neutral-50 transition-colors duration-150 hover:bg-neutral-100 active:bg-neutral-200 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15 dark:active:bg-white/20"
            >
              <Grid
                className="[mask-image:linear-gradient(90deg,transparent,black)] dark:text-white/5"
                cellSize={60}
                patternOffset={[-39, -49]}
              />
              {graphic && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                  {graphic}
                </div>
              )}
              {color && (
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,var(--color),transparent)] opacity-0 transition-opacity duration-150 group-hover:opacity-15"
                  style={
                    {
                      "--color": color,
                    } as CSSProperties
                  }
                />
              )}
              <div className="relative flex items-center justify-between px-5 py-4">
                <div>
                  <span className="text-sm font-medium leading-none text-neutral-900 dark:text-white">
                    {title}
                  </span>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-white/60">
                    {description}
                  </p>
                </div>
              </div>
            </Link>
          </NavigationMenuLink>
        ))}
      </div>
    </div>
  );
}
