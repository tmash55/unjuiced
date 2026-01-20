"use client";

import { cn } from "@/lib/utils";
import { Zap, Sparkles, ExternalLink, Calculator, Info, Settings } from "lucide-react";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import Link from "next/link";
import { Tooltip } from "@/components/tooltip";

interface BetCardProps {
  player: string;
  team: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent?: number | null;
  edgePercent?: number | null;
  kelly?: number | null;
  fairOdds?: number | null;
  devigMethod?: string | null;
  deepLink?: string | null;
  startTime?: string | null;
  sport: string;
  compact?: boolean;
  isPro?: boolean;
  isFeatured?: boolean;
  badgeText?: string;
}

const SPORT_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  nba: { label: "NBA", bgClass: "bg-orange-500/10", textClass: "text-orange-600 dark:text-orange-400" },
  nfl: { label: "NFL", bgClass: "bg-green-600/10", textClass: "text-green-600 dark:text-green-400" },
  nhl: { label: "NHL", bgClass: "bg-blue-500/10", textClass: "text-blue-600 dark:text-blue-400" },
  mlb: { label: "MLB", bgClass: "bg-blue-500/10", textClass: "text-blue-600 dark:text-blue-400" },
  ncaaf: { label: "NCAAF", bgClass: "bg-green-600/10", textClass: "text-green-600 dark:text-green-400" },
  ncaab: { label: "NCAAB", bgClass: "bg-orange-500/10", textClass: "text-orange-600 dark:text-orange-400" },
};

function formatTime(startTime: string | null | undefined): string {
  if (!startTime) return "";
  const date = new Date(startTime);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOdds(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : String(price);
}

export function BetCard({
  player,
  team,
  homeTeam,
  awayTeam,
  market,
  marketDisplay,
  line,
  side,
  bestOdds,
  bestOddsFormatted,
  book,
  evPercent,
  edgePercent,
  kelly,
  fairOdds,
  devigMethod,
  deepLink,
  startTime,
  sport,
  compact = false,
  isPro = true,
  isFeatured = false,
  badgeText,
}: BetCardProps) {
  const sportConfig = SPORT_CONFIG[sport.toLowerCase()] || SPORT_CONFIG.nba;
  const bookMeta = getSportsbookById(book);
  const bookName = bookMeta?.name || book;
  const bookLogo = bookMeta?.image?.light;

  // Show blur on EV/Edge if not pro
  const showValueBlur = !isPro && (evPercent != null || edgePercent != null);
  
  // Determine team logos
  let primaryTeamLogo = null;
  let secondaryTeamLogo = null;

  if (team) {
    primaryTeamLogo = getTeamLogoUrl(team, sport);
  } else if (homeTeam && awayTeam) {
    primaryTeamLogo = getTeamLogoUrl(awayTeam, sport);
    secondaryTeamLogo = getTeamLogoUrl(homeTeam, sport);
  }

  // Kelly units (fraction * 4 for display as "units")
  const kellyUnits = kelly ? (kelly * 4).toFixed(1) : null;

  return (
    <div className={cn(
      "group relative flex flex-col justify-between rounded-xl transition-all duration-200 h-full",
      compact ? "p-3" : "p-4",
      isFeatured 
        ? "bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-700 shadow-xl shadow-black/20" 
        : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
    )}>
      
      {/* Featured Badge */}
      {isFeatured && badgeText && (
        <div className="absolute -top-2.5 left-3 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-md flex items-center gap-1 z-10">
          <Sparkles className="w-2.5 h-2.5" />
          {badgeText}
        </div>
      )}

      {/* Non-featured Badge */}
      {!isFeatured && badgeText && (
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[9px] font-semibold text-neutral-500 dark:text-neutral-400">
          {badgeText}
        </div>
      )}

      <div className={cn("space-y-2 flex-1", compact && "space-y-1.5")}>
        {/* Header: Sport & Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide",
              isFeatured 
                ? "bg-white/10 text-white" 
                : cn(sportConfig.bgClass, sportConfig.textClass)
            )}>
              {sportConfig.label}
            </span>
            {startTime && (
              <span className={cn(
                "text-[10px]",
                isFeatured ? "text-neutral-400" : "text-neutral-400 dark:text-neutral-500"
              )}>
                {formatTime(startTime)}
              </span>
            )}
          </div>
        </div>

        {/* Main Content: Player & Market */}
        <div className="flex items-start gap-2">
          {/* Team Logo(s) */}
          <div className="flex items-center -space-x-1 shrink-0">
            {primaryTeamLogo && (
              <div className="w-5 h-5 bg-white dark:bg-neutral-800 rounded-full p-0.5 ring-1 ring-neutral-200 dark:ring-neutral-700 z-10">
                <img src={primaryTeamLogo} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            {secondaryTeamLogo && (
              <div className="w-5 h-5 bg-white dark:bg-neutral-800 rounded-full p-0.5 ring-1 ring-neutral-200 dark:ring-neutral-700">
                <img src={secondaryTeamLogo} alt="" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              "font-bold leading-tight truncate",
              isFeatured ? "text-base text-white" : compact ? "text-sm text-neutral-900 dark:text-neutral-100" : "text-base text-neutral-900 dark:text-neutral-100"
            )}>
              {player}
            </h3>
            
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
              <span className={cn(
                isFeatured ? "text-neutral-300" : "text-neutral-500 dark:text-neutral-400"
              )}>
                {marketDisplay}
              </span>
              {team && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600">·</span>
                  <span className={cn(
                    "uppercase tracking-wide font-medium",
                    isFeatured ? "text-neutral-400" : "text-neutral-400 dark:text-neutral-500"
                  )}>
                    {team}
                  </span>
                </>
              )}
            </div>
            
            {/* Edge Reason Line - Tightened */}
            {evPercent && evPercent > 0 && (
              <div className={cn(
                "text-[10px] mt-1 font-semibold",
                isFeatured ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                +{evPercent.toFixed(1)}% vs {devigMethod === "Pinnacle" ? "PIN" : devigMethod || "PIN"}
              </div>
            )}
          </div>
        </div>

        {/* The Bet: Line & Odds with Book Logo */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border",
          compact ? "p-2" : "px-3 py-2",
          isFeatured 
            ? "bg-white/5 border-white/10" 
            : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800"
        )}>
          <span className={cn(
            "font-bold",
            compact ? "text-xs" : "text-sm",
            side === "over" ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
          )}>
            {side === "over" ? "O" : "U"} {line}
          </span>
          
          <div className="flex items-center gap-2">
            {bookLogo && (
              <img 
                src={bookLogo} 
                alt={bookName} 
                className="h-5 w-auto object-contain opacity-90"
              />
            )}
            <span className={cn(
              "font-bold tabular-nums",
              compact ? "text-sm" : "text-base",
              isFeatured ? "text-white" : "text-neutral-900 dark:text-neutral-100"
            )}>
              {bestOddsFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Fair + Kelly + CTA */}
      <div className={cn(
        "mt-2 pt-2 border-t relative",
        isFeatured ? "border-white/10" : "border-neutral-100 dark:border-neutral-800"
      )}>
        <div className="flex items-center justify-between gap-2">
          
          {/* Left: Fair & Kelly */}
          <div className="flex items-center gap-3">
            {fairOdds != null && (
              <div className="flex flex-col">
                <span className={cn(
                  "text-[8px] font-medium uppercase tracking-wide",
                  isFeatured ? "text-neutral-500" : "text-neutral-400 dark:text-neutral-500"
                )}>
                  Fair
                </span>
                <span className={cn(
                  "text-xs font-semibold tabular-nums leading-none",
                  isFeatured ? "text-neutral-300" : "text-neutral-600 dark:text-neutral-300"
                )}>
                  {formatOdds(fairOdds)}
                </span>
              </div>
            )}
            
            {kellyUnits && (
              <div className="flex flex-col">
                <Tooltip content={
                  <div className="text-xs">
                    <p className="font-medium mb-1">Recommended wager</p>
                    <p className="text-neutral-400">Based on bankroll & risk settings.</p>
                    <Link href="/account/settings" className="text-blue-400 hover:underline mt-1 inline-flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      Edit in settings
                    </Link>
                  </div>
                }>
                  <div className="cursor-help">
                    <span className={cn(
                      "text-[8px] font-medium uppercase tracking-wide flex items-center gap-0.5",
                      isFeatured ? "text-neutral-500" : "text-neutral-400 dark:text-neutral-500"
                    )}>
                      Kelly
                      <Info className="w-2 h-2" />
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Calculator className="w-2.5 h-2.5 text-blue-500" />
                      <span className={cn(
                        "text-xs font-semibold tabular-nums leading-none",
                        isFeatured ? "text-blue-400" : "text-blue-600 dark:text-blue-400"
                      )}>
                        {kellyUnits}u
                      </span>
                    </div>
                  </div>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Right: Bet Now CTA - Tinted Button */}
          {deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                isFeatured 
                  ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-md shadow-emerald-500/20" 
                  : "bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm"
              )}
            >
              Bet Now
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium",
              isFeatured 
                ? "bg-white/10 text-neutral-400" 
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
            )}>
              No link
            </span>
          )}
        </div>

        {/* EV Bar - Bottom aligned, subtle */}
        {evPercent != null && (
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden h-px mt-2">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                isFeatured ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(Math.max(evPercent * 6, 8), 100)}%` }}
            />
          </div>
        )}

        {/* Blur overlay for non-pro users */}
        {showValueBlur && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center backdrop-blur-sm rounded-b-xl z-20",
            isFeatured ? "bg-neutral-900/70" : "bg-white/70 dark:bg-neutral-900/70"
          )}>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg text-[10px] font-bold">
              <Sparkles className="w-2.5 h-2.5" />
              PRO
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
