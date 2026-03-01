"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OddsScreenItem, OddsScreenEvent } from "../types/odds-screen-types";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";

interface MobileOddsCardProps {
  game: OddsScreenEvent;
  items: OddsScreenItem[];
  sport: string;
  onTap: () => void;
}

// Format American odds
function formatOdds(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
}

// Format time
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true,
  }).replace(" ", "");
}

// Check if sport has team logos
function hasTeamLogos(sport: string): boolean {
  const sportsWithLogos = ["nfl", "nhl", "nba", "mlb"];
  return sportsWithLogos.includes(sport.toLowerCase());
}

// Get team logo URL
function getTeamLogoUrl(teamName: string, sport: string): string {
  if (!teamName) return "";
  const abbr = getStandardAbbreviation(teamName, sport);
  return `/team-logos/${sport}/${abbr.toUpperCase()}.svg`;
}

function shouldUseFullMatchupNames(sport: string): boolean {
  const normalized = sport.toLowerCase();
  return normalized.startsWith("soccer_") || normalized.startsWith("tennis_");
}

// Get sportsbook logo
function getBookLogo(bookId: string): string | null {
  const book = getSportsbookById(bookId);
  return book?.image?.square || book?.image?.light || null;
}

export function MobileOddsCard({ game, items, sport, onTap }: MobileOddsCardProps) {
  const showLogos = hasTeamLogos(sport);
  const useFullNames = shouldUseFullMatchupNames(sport);
  const awayDisplay = useFullNames ? (game.awayName || game.awayTeam) : game.awayTeam;
  const homeDisplay = useFullNames ? (game.homeName || game.homeTeam) : game.homeTeam;

  // Get the moneyline item (first item should be the moneyline data)
  const moneylineItem = items[0];

  // For moneyline: over = away team, under = home team
  const awayOdds = moneylineItem?.odds?.best?.over;
  const homeOdds = moneylineItem?.odds?.best?.under;

  return (
    <button
      onClick={onTap}
      className="w-full bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="p-4">
        {/* Header: Time */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {formatTime(game.startTime)}
          </span>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>

        {/* Teams with Moneyline */}
        <div className="space-y-2">
          {/* Away Team Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {showLogos && (
                <img
                  src={getTeamLogoUrl(game.awayTeam, sport)}
                  alt={awayDisplay}
                  className="w-7 h-7 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="text-base font-semibold text-neutral-900 dark:text-white">
                {awayDisplay}
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg min-w-[80px] justify-center",
              awayOdds?.price 
                ? "bg-neutral-100 dark:bg-neutral-800" 
                : "bg-neutral-50 dark:bg-neutral-800/50"
            )}>
              {awayOdds?.book && getBookLogo(awayOdds.book) && (
                <img
                  src={getBookLogo(awayOdds.book)!}
                  alt={awayOdds.book}
                  className="w-4 h-4 object-contain opacity-60"
                />
              )}
              <span className={cn(
                "text-sm font-bold tabular-nums",
                awayOdds?.price 
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-400"
              )}>
                {formatOdds(awayOdds?.price)}
              </span>
            </div>
          </div>

          {/* Home Team Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {showLogos && (
                <img
                  src={getTeamLogoUrl(game.homeTeam, sport)}
                  alt={homeDisplay}
                  className="w-7 h-7 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="text-base font-semibold text-neutral-900 dark:text-white">
                {homeDisplay}
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg min-w-[80px] justify-center",
              homeOdds?.price 
                ? "bg-neutral-100 dark:bg-neutral-800" 
                : "bg-neutral-50 dark:bg-neutral-800/50"
            )}>
              {homeOdds?.book && getBookLogo(homeOdds.book) && (
                <img
                  src={getBookLogo(homeOdds.book)!}
                  alt={homeOdds.book}
                  className="w-4 h-4 object-contain opacity-60"
                />
              )}
              <span className={cn(
                "text-sm font-bold tabular-nums",
                homeOdds?.price 
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-400"
              )}>
                {formatOdds(homeOdds?.price)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
