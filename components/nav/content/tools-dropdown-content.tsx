"use client";

import { cn } from "@/lib/utils";
import { Link as NavigationMenuLink } from "@radix-ui/react-navigation-menu";
import Link from "next/link";
import { createHref } from "./shared";
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Zap,
  ArrowRight,
  Activity,
  LineChart,
  Scale,
  Percent,
  BookOpen,
  Shield
} from "lucide-react";

/**
 * Beehiiv-style Tools dropdown content
 * Two columns: Research (data analysis) and Sharp (betting edge tools)
 */

const researchTools = [
  {
    icon: BarChart3,
    title: "Hit Rates",
    href: "/tools/hit-rates",
    badge: "NEW",
  },
  {
    icon: BookOpen,
    title: "Cheat Sheets",
    href: "/tools/cheat-sheets",
  },
  {
    icon: Activity,
    title: "Stats",
    href: "/tools/stats",
  },
  {
    icon: Shield,
    title: "Defense vs Position",
    href: "/tools/dvp",
  },
];

const sharpTools = [
  {
    icon: LineChart,
    title: "Odds Screen",
    href: "/tools/odds",
  },
  {
    icon: Target,
    title: "Edge Finder",
    href: "/tools/edge-finder",
  },
  {
    icon: Percent,
    title: "Positive EV",
    href: "/tools/positive-ev",
  },
  {
    icon: Scale,
    title: "Arbitrage",
    href: "/tools/arbitrage",
  },
];

function ToolLink({ 
  icon: Icon, 
  title, 
  href, 
  badge,
  domain 
}: { 
  icon: typeof BarChart3; 
  title: string; 
  href: string; 
  badge?: string;
  domain: string;
}) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={createHref(href, domain, {})}
        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10"
      >
        <Icon className="h-4 w-4 text-[#38BDF8]" />
        <span className="text-sm font-medium text-white/90 group-hover:text-white">
          {title}
        </span>
        {badge && (
          <span className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </Link>
    </NavigationMenuLink>
  );
}

function CategoryHeader({ title, href, domain }: { title: string; href?: string; domain: string }) {
  if (href) {
    return (
      <Link 
        href={createHref(href, domain, {})}
        className="group flex items-center gap-1.5 text-sm font-semibold text-white hover:text-[#38BDF8] transition-colors"
      >
        {title}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
      {title}
      <ArrowRight className="h-3.5 w-3.5 text-white/50" />
    </span>
  );
}

export function ToolsDropdownContent({ domain }: { domain: string }) {
  return (
    <div className="w-[480px] rounded-xl bg-[#0f172a] p-5 shadow-2xl border border-white/10">
      <div className="grid grid-cols-2 gap-8">
        {/* Research Column */}
        <div>
          <div className="mb-4 pb-3 border-b border-white/10">
            <CategoryHeader title="Research" domain={domain} />
            <p className="mt-1 text-xs text-white/50">Data-driven analysis</p>
          </div>
          <div className="space-y-1">
            {researchTools.map((tool) => (
              <ToolLink key={tool.title} {...tool} domain={domain} />
            ))}
          </div>
        </div>

        {/* Sharp Column */}
        <div>
          <div className="mb-4 pb-3 border-b border-white/10">
            <CategoryHeader title="Sharp" domain={domain} />
            <p className="mt-1 text-xs text-white/50">Find your edge</p>
          </div>
          <div className="space-y-1">
            {sharpTools.map((tool) => (
              <ToolLink key={tool.title} {...tool} domain={domain} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <Link
          href={createHref("/pricing", domain, {})}
          className="group flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
        >
          <div>
            <span className="text-sm font-medium text-white">Start your free trial</span>
            <p className="text-xs text-white/50">Access all tools for 7 days</p>
          </div>
          <ArrowRight className="h-4 w-4 text-[#38BDF8] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
