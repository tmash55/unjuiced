"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Sport configuration with icons
interface SportConfig {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  disabledReason?: string;
}

const SPORTS: SportConfig[] = [
  { id: "nba", label: "NBA", icon: "🏀" },
  { id: "nfl", label: "NFL", icon: "🏈" },
  { id: "nhl", label: "NHL", icon: "🏒" },
  { id: "ncaab", label: "NCAAB", icon: "🏀" },
  { id: "ncaaf", label: "NCAAF", icon: "🏈" },
  { id: "mlb", label: "MLB", icon: "⚾", disabled: true, disabledReason: "Off Season" },
];

// Market quick-access tabs configuration by sport
const MARKET_TABS: Record<string, Array<{ id: string; label: string; apiKey: string; type: "game" | "player" }>> = {
  nba: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
    { id: "pts", label: "PTS", apiKey: "player_points", type: "player" },
    { id: "reb", label: "REB", apiKey: "player_rebounds", type: "player" },
    { id: "ast", label: "AST", apiKey: "player_assists", type: "player" },
    { id: "3pm", label: "3PM", apiKey: "player_threes_made", type: "player" },
    { id: "1st", label: "1st", apiKey: "first_field_goal", type: "player" },
    { id: "1st_tm", label: "1st Tm", apiKey: "player_first_team_basket", type: "player" },
    { id: "dd", label: "DD", apiKey: "player_double_double", type: "player" },
    { id: "td", label: "TD", apiKey: "player_triple_double", type: "player" },
    { id: "pra", label: "PRA", apiKey: "player_points_rebounds_assists", type: "player" },
    { id: "pr", label: "P+R", apiKey: "player_points_rebounds", type: "player" },
    { id: "pa", label: "P+A", apiKey: "player_points_assists", type: "player" },
    { id: "ra", label: "R+A", apiKey: "player_rebounds_assists", type: "player" },
  ],
  nfl: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
    { id: "pass_yds", label: "Pass Yds", apiKey: "player_pass_yds", type: "player" },
    { id: "pass_tds", label: "Pass TDs", apiKey: "player_pass_tds", type: "player" },
    { id: "rush_yds", label: "Rush Yds", apiKey: "player_rush_yds", type: "player" },
    { id: "rec_yds", label: "Rec Yds", apiKey: "player_reception_yds", type: "player" },
    { id: "receptions", label: "Rec", apiKey: "player_receptions", type: "player" },
    { id: "atd", label: "ATD", apiKey: "player_anytime_td", type: "player" },
    { id: "1st_td", label: "1st TD", apiKey: "player_1st_td", type: "player" },
    { id: "int", label: "INT", apiKey: "player_interceptions", type: "player" },
  ],
  nhl: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
    { id: "goals", label: "Goals", apiKey: "player_goals", type: "player" },
    { id: "assists", label: "Assists", apiKey: "player_assists", type: "player" },
    { id: "points", label: "Points", apiKey: "player_points", type: "player" },
    { id: "shots", label: "SOG", apiKey: "player_shots_on_goal", type: "player" },
    { id: "saves", label: "Saves", apiKey: "player_saves", type: "player" },
    { id: "ags", label: "AGS", apiKey: "player_anytime_goalscorer", type: "player" },
  ],
  ncaab: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
    // NCAAB has limited player props
  ],
  ncaaf: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
    { id: "pass_yds", label: "Pass Yds", apiKey: "player_pass_yds", type: "player" },
    { id: "rush_yds", label: "Rush Yds", apiKey: "player_rush_yds", type: "player" },
    { id: "rec_yds", label: "Rec Yds", apiKey: "player_reception_yds", type: "player" },
    { id: "atd", label: "ATD", apiKey: "player_anytime_td", type: "player" },
  ],
  mlb: [
    { id: "game", label: "Game", apiKey: "moneyline", type: "game" },
  ],
};

interface OddsNavigationProps {
  sport: string;
  market: string;
  type: "game" | "player";
  onSportChange: (sport: string) => void;
  onMarketChange: (market: string, type: "game" | "player") => void;
  className?: string;
}

export function OddsNavigation({
  sport,
  market,
  type,
  onSportChange,
  onMarketChange,
  className,
}: OddsNavigationProps) {
  const marketTabs = useMemo(() => MARKET_TABS[sport] || MARKET_TABS.nba, [sport]);
  
  // Find the active market tab
  const activeMarketTab = useMemo(() => {
    // First check if we're on game props
    if (type === "game") return "game";
    // Find matching market tab
    const match = marketTabs.find(tab => tab.apiKey === market);
    return match?.id || "game";
  }, [market, type, marketTabs]);

  return (
    <div className={cn("w-full", className)}>
      {/* Sport Tabs Row */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => !s.disabled && onSportChange(s.id)}
              disabled={s.disabled}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                sport === s.id
                  ? "text-brand"
                  : s.disabled
                  ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
              title={s.disabled ? s.disabledReason : undefined}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.label}</span>
              {sport === s.id && (
                <motion.div
                  layoutId="sport-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Market Tabs Row */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-0.5 px-4 py-1.5 overflow-x-auto scrollbar-hide">
          {marketTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onMarketChange(tab.apiKey, tab.type)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                activeMarketTab === tab.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export sports for use elsewhere
export { SPORTS, MARKET_TABS };

