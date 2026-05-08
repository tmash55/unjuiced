import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { createHref, getUtmParams } from "./shared";
import { SportIcon } from "@/components/icons/sport-icons";

interface NavTool {
  title: string;
  description: string;
  href: string;
  badge?: string;
  free?: boolean;
}

const NBA_TOOLS: NavTool[] = [
  { title: "Hit Rates", description: "L5, L10, L20 player prop analysis", href: "/hit-rates/nba" },
  { title: "Cheat Sheets", description: "Pre-built game-day research pages", href: "/cheatsheets/nba/hit-rates" },
  { title: "Odds Screen", description: "Compare lines across 20+ books", href: "/odds/nba" },
];

const MLB_TOOLS: NavTool[] = [
  { title: "Game Center", description: "Unified MLB matchup research hub", href: "/cheatsheets/mlb/game-center", badge: "NEW" },
  { title: "HR Command Center", description: "5-layer HR scoring with live odds", href: "/cheatsheets/mlb/hr-command-center", badge: "NEW" },
  { title: "NRFI", description: "No Run First Inning grades & odds", href: "/cheatsheets/mlb/nrfi", badge: "NEW" },
  { title: "Exit Velocity", description: "Statcast hard-hit leaders", href: "/cheatsheets/mlb/exit-velocity", badge: "NEW" },
  { title: "Weather Report", description: "Park & weather impact scores", href: "/cheatsheets/mlb/weather-report", free: true },
  { title: "Odds Screen", description: "MLB lines across 20+ books", href: "/odds/mlb" },
];

const SHARP_TOOLS: NavTool[] = [
  { title: "Edge Finder", description: "Spot soft lines and value bets", href: "/edge-finder" },
  { title: "Positive EV", description: "Find +EV bets with true odds", href: "/positive-ev" },
  { title: "Arbitrage", description: "Risk-free opportunities across books", href: "/arbitrage" },
  { title: "Sharp Intel", description: "Real-time insider signals from prediction markets", href: "/sharp-intel" },
  { title: "My Slips", description: "Saved plays and bet tracking", href: "/my-slips" },
];

function NavSection({ title, icon, tools, domain }: { title: string; icon?: React.ReactNode; tools: NavTool[]; domain: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 mb-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {title}
        </span>
      </div>
      <div className="space-y-0.5">
        {tools.map((tool) => (
          <NavigationMenuLink asChild key={tool.title}>
            <Link
              href={createHref(tool.href, domain, getUtmParams({ domain, utm_content: tool.title }))}
              className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-white/5"
            >
              <div className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
                  {tool.title}
                  {tool.badge && (
                    <span className="rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                      {tool.badge}
                    </span>
                  )}
                  {tool.free && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                      FREE
                    </span>
                  )}
                </span>
                <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5 leading-snug">
                  {tool.description}
                </p>
              </div>
            </Link>
          </NavigationMenuLink>
        ))}
      </div>
    </div>
  );
}

export function ProductContent({ domain }: { domain: string }) {
  return (
    <div className="grid w-[720px] grid-cols-3 gap-6 p-5">
      {/* Column 1: NBA */}
      <NavSection
        title="NBA"
        icon={<SportIcon sport="nba" className="h-3.5 w-3.5 text-orange-500" />}
        tools={NBA_TOOLS}
        domain={domain}
      />

      {/* Column 2: MLB */}
      <NavSection
        title="MLB"
        icon={<SportIcon sport="mlb" className="h-3.5 w-3.5 text-red-500" />}
        tools={MLB_TOOLS}
        domain={domain}
      />

      {/* Column 3: Sharp Tools */}
      <NavSection
        title="Sharp Tools"
        tools={SHARP_TOOLS}
        domain={domain}
      />
    </div>
  );
}
