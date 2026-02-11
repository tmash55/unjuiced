"use client";

import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Link from "next/link";

import { Grid } from "@/components/grid";
import {
  IconScale,
  IconPlus,
  IconRocket,
  IconTable,
  IconFileText,
  IconHeart,
} from "@tabler/icons-react";
import Chart from "@/icons/chart";
import {
  contentHeadingClassName,
  ContentLinkCard,
  getUtmParams,
  createHref,
} from "./shared";

const researchTools = [
  {
    icon: ({ className }: { className?: string }) => <Chart className={className} />,
    title: "Hit Rates",
    description: "L5, L10, L20 player prop analysis",
    href: "/features/hit-rates",
  },
  {
    icon: IconFileText,
    title: "Cheat Sheets",
    description: "Pre-built game-day research pages",
    href: "/features/cheat-sheets",
  },
  {
    icon: IconTable,
    title: "Odds Screen",
    description: "Compare lines across 20+ books",
    href: "/features/odds-screen",
  },
  {
    icon: IconHeart,
    title: "My Slips",
    description: "Saved plays and bet tracking",
    href: "/features/my-slips",
  },
];

const sharpTools = [
  {
    icon: IconRocket,
    title: "Edge Finder",
    description: "Spot soft lines and value bets",
    href: "/features/edge-finder",
  },
  {
    icon: IconPlus,
    title: "Positive EV",
    description: "Find +EV bets with true odds",
    href: "/features/positive-ev",
  },
  {
    icon: IconScale,
    title: "Arbitrage",
    description: "Risk-free opportunities across books",
    href: "/features/arbitrage",
  },
];

export function ToolsDropdownContent({ domain }: { domain: string }) {
  return (
    <div className="grid w-[1020px] grid-cols-[1fr_1fr_auto] divide-x divide-neutral-200 dark:divide-white/20">
      {/* Research Column */}
      <div className="flex h-full flex-col p-4 pr-6">
        <p className={cn(contentHeadingClassName, "mb-3 ml-2")}>Research</p>
        <div className="flex flex-col gap-0.5">
          {researchTools.map(({ icon: Icon, title, description, href }) => (
            <ContentLinkCard
              key={href}
              className="-mx-2"
              href={createHref(href, domain, getUtmParams({ domain, utm_content: title }))}
              icon={
                <div className="shrink-0 rounded-md border border-neutral-200 bg-white/50 p-2.5 dark:border-white/20 dark:bg-white/10">
                  <Icon className="size-4 text-[#0EA5E9] transition-colors dark:text-[#7DD3FC]" />
                </div>
              }
              title={title}
              description={description}
            />
          ))}
        </div>
      </div>

      {/* Sharp Column */}
      <div className="flex h-full flex-col p-4 pr-6 pl-6">
        <p className={cn(contentHeadingClassName, "mb-3 ml-2")}>Sharp Tools</p>
        <div className="flex flex-col gap-0.5">
          {sharpTools.map(({ icon: Icon, title, description, href }) => (
            <ContentLinkCard
              key={href}
              className="-mx-2"
              href={createHref(href, domain, getUtmParams({ domain, utm_content: title }))}
              icon={
                <div className="shrink-0 rounded-md border border-neutral-200 bg-white/50 p-2.5 dark:border-white/20 dark:bg-white/10">
                  <Icon className="size-4 text-[#0EA5E9] transition-colors dark:text-[#7DD3FC]" />
                </div>
              }
              title={title}
              description={description}
            />
          ))}
        </div>
      </div>

      {/* CTA Column */}
      <div className="w-[240px] px-6 py-4">
        <p className={cn(contentHeadingClassName, "mb-3")}>Get Started</p>
        <NavigationMenuLink asChild>
          <Link
            href={createHref("/register", domain, {})}
            className={cn(
              "group relative isolate z-0 flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 px-5 py-4 transition-colors duration-75",
              "dark:border-white/20 dark:bg-neutral-900",
            )}
          >
            <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <div className="absolute -inset-[25%] -skew-y-12 [mask-image:linear-gradient(225deg,black,transparent_50%)]">
                <Grid
                  cellSize={46}
                  patternOffset={[0, -14]}
                  className="translate-y-2 text-[#38BDF855] transition-transform duration-150 ease-out group-hover:translate-y-0"
                />
              </div>
              <div
                className={cn(
                  "absolute -inset-[10%] opacity-10 blur-[50px] dark:brightness-150",
                  "bg-[conic-gradient(#38BDF8_0deg,#38BDF8_117deg,#10b981_180deg,#8b5cf6_240deg,#38BDF8_360deg)]",
                )}
              />
            </div>
            <div className="relative">
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                Start Free Trial
              </span>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-white/60">
                Access all tools free for 3 days.
              </p>
            </div>
          </Link>
        </NavigationMenuLink>
      </div>
    </div>
  );
}
