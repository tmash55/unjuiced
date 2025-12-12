import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { CSSProperties } from "react";
import { Grid } from "@/components/grid";
import { getUtmParams, createHref, contentHeadingClassName } from "./shared";
import { Trophy, TrendingUp, BarChart3, Shield } from "lucide-react";
import { Crown } from "@/components/icons/crown";

const stats = [
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-yellow-400">
        <Crown className="size-2.5 text-yellow-900" />
      </div>
    ),
    title: "NBA • King of the Court",
    description: "Live PRA leaderboard with real-time stats and betting odds.",
    href: "/stats/nba/king-of-the-court",
    color: "#fbbf24", // Yellow
    comingSoon: false,
    badge: null,
  },
  {
    icon: (
      <div className="flex size-4 items-center justify-center rounded bg-blue-400">
        <Shield className="size-2.5 text-blue-900" />
      </div>
    ),
    title: "NBA • Defense vs Position",
    description: "Team defensive rankings by position. Find the best matchups.",
    href: "/stats/nba/defense-vs-position",
    color: "#60a5fa", // Blue
    comingSoon: false,
    badge: "NEW",
  },
];

export function StatsContent({ domain }: { domain: string }) {
  return (
    <div className="w-[1020px] p-4">
      <p className={cn(contentHeadingClassName, "mb-4 ml-2")}>Live Stats & Analysis</p>
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon, title, description, href, color, comingSoon, badge }) =>
          comingSoon ? (
            <div
              key={title}
              className="relative flex flex-col justify-center rounded-xl border border-neutral-100 bg-neutral-50 opacity-60 grayscale transition-colors duration-150 dark:border-white/20 dark:bg-white/10"
            >
              <Grid
                className="[mask-image:linear-gradient(90deg,transparent,black)] dark:text-white/5"
                cellSize={60}
                patternOffset={[-39, -49]}
              />
              <div className="relative flex items-center justify-between px-5 py-4">
                <div>
                  <div className="mb-3">{icon}</div>
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
                    <div className="mb-3">{icon}</div>
                    <span className="flex items-center gap-2 text-sm font-medium leading-none text-neutral-900 dark:text-white">
                      {title}
                      {badge && (
                        <span className="rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          {badge}
                        </span>
                      )}
                    </span>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-white/60">
                      {description}
                    </p>
                  </div>
                </div>
              </Link>
            </NavigationMenuLink>
          )
        )}
      </div>
    </div>
  );
}

