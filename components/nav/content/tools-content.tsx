import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Image from "next/image";
import Link from "next/link";
import { CSSProperties } from "react";
import { Grid } from "@/components/grid";
import { getUtmParams, createHref } from "./shared";
import { Link2, BarChart3, Handshake, TrendingUp } from "lucide-react";
import { LinksGraphic } from "./graphics/links-graphic";
import { AnalyticsGraphic } from "./graphics/analytics-graphics";
import { PartnersGraphic } from "./graphics/partners-graphic";
import { EdgeFinderGraphic } from "./graphics/edge-finder-graphic";


const tools = [
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-green-400">
        <Link2 className="size-2.5 text-green-900" />
      </div>
    ),
    title: "Arbitrage",
    description: "Risk-free opportunities across books with automatic leg matching and sizing.",
    href: "/arbitrage",
    color: "#35c97d",   //Neon Blue
    graphicsContainerClassName: "px-2",
    graphic: <LinksGraphic className="absolute left-0 top-0 h-auto w-full" />,
    comingSoon: false,
  },
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-blue-400">
        <BarChart3 className="size-2.5 text-blue-900" />
      </div>
    ),
    title: "Odds Screen",
    description: "Live market odds with fast updates, line movement, and best-price highlights.",
    href: "/odds/nfl",
    color: "#00b4d8",
    graphicsContainerClassName: "h-[170%] bottom-0 top-[unset]",
    graphic: (
      <AnalyticsGraphic className="absolute bottom-0 left-0 size-full" />
    ),
    comingSoon: false,
  },
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-amber-400">
        <TrendingUp className="size-2.5 text-amber-900" />
      </div>
    ),
    title: "Edge Finder",
    description: "Find mispriced odds across every sportsbook in seconds.",
    href: "/edge-finder",
    color: "#f59e0b",
    graphicsContainerClassName: "px-2",
    graphic: <EdgeFinderGraphic className="absolute left-0 top-0 h-auto w-full" />,
    comingSoon: false,
  },
];

const largeLinks = [
  {
    title: "Ladder Builder",
    description: "Build and track custom multi-line prop ladders — stack alternate lines, compare odds, and visualize potential payouts across every rung",
    href: "/ladders",
    comingSoon: false,
    graphic: null, // No graphic for now
    color: "#f97316", // Orange color for hover effect
  },
  {
    title: "Parlay Builder",
    description: "Build SGPs and SGP+ with the highest available prices across major books.",
    href: "/parlay-builder",
    comingSoon: true,
    graphic: (
      <div className="absolute -right-4 top-1/2 h-[180px] w-[240px] -translate-y-1/2 [mask-image:linear-gradient(90deg,black_50%,transparent_95%)] dark:opacity-80">
        <Image src="/illustrations/native-tools-integration.svg" alt="" fill />
      </div>
    ),
  },
];

export function ProductContent({ domain }: { domain: string }) {
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
            comingSoon,
          }) => (
            comingSoon ? (
              <div
                key={title}
                aria-disabled
                className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 opacity-80 grayscale cursor-not-allowed dark:border-white/20 dark:bg-white/10"
              >
                <Grid
                  className="[mask-image:linear-gradient(transparent,black,transparent)] dark:text-white/5"
                  cellSize={60}
                  patternOffset={[-51, -23]}
                />
                <div className="relative p-5 pb-0">
                  {icon}
                  <span className="mt-3 block text-sm font-medium text-neutral-900 dark:text-white">
                    {title}
                  </span>
                  <p className="mt-2 max-w-56 text-sm text-neutral-500 dark:text-white/60">
                    {description}
                  </p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-white/20 dark:text-white/80">
                    Coming soon
                  </span>
                </div>
                {/* graphic intentionally removed for coming soon */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,var(--color),transparent)] opacity-[0.07]"
                  style={
                    {
                      "--color": color,
                    } as CSSProperties
                  }
                />
              </div>
            ) : (
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
                    <span className="mt-3 block text-sm font-medium text-neutral-900 dark:text-white">
                      {title}
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
            )
          ),
        )}
      </div>
      <div className="grid grow grid-cols-2 gap-4">
        {largeLinks.map(({ title, description, href, graphic, comingSoon, color }) => (
          comingSoon ? (
            <div
              key={title}
              aria-disabled
              className="group relative flex flex-col justify-center rounded-xl border border-neutral-100 bg-neutral-50 opacity-80 grayscale cursor-not-allowed dark:border-white/20 dark:bg-white/10"
            >
              <Grid
                className="[mask-image:linear-gradient(90deg,transparent,black)] dark:text-white/5"
                cellSize={60}
                patternOffset={[-39, -49]}
              />
              {/* graphic intentionally removed for coming soon */}
              <div className="relative flex items-center justify-between px-5 py-4">
                <div>
                  <span className="text-sm font-medium leading-none text-neutral-900 dark:text-white">
                    {title}
                  </span>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-white/60">
                    {description}
                  </p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-white/20 dark:text-white/80">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
          ) : (
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
          )
        ))}
      </div>
    </div>
  );
}