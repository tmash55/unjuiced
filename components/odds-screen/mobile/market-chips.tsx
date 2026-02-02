"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MarketChipsProps {
  sport: string;
  type: "game" | "player";
  selectedMarket: string;
  onMarketChange: (market: string) => void;
}

// Define all markets by sport and type - matching desktop version
const ALL_MARKETS: Record<string, Record<"game" | "player", { apiKey: string; label: string }[]>> = {
  nba: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Spread" },
      { apiKey: "total_points", label: "Total" },
      { apiKey: "team_total", label: "Team Total" },
      // 1st Half
      { apiKey: "game_1h_moneyline", label: "1H ML" },
      { apiKey: "1st_half_point_spread", label: "1H Spread" },
      { apiKey: "1st_half_total_points", label: "1H Total" },
      // 1st Quarter
      { apiKey: "game_1q_moneyline", label: "1Q ML" },
      { apiKey: "1st_quarter_point_spread", label: "1Q Spread" },
      { apiKey: "1st_quarter_total_points", label: "1Q Total" },
    ],
    player: [
      // Core Stats
      { apiKey: "player_points", label: "Points" },
      { apiKey: "player_rebounds", label: "Rebounds" },
      { apiKey: "player_assists", label: "Assists" },
      { apiKey: "player_threes_made", label: "3PT" },
      // Combo Stats
      { apiKey: "player_pra", label: "PRA" },
      { apiKey: "player_pr", label: "Pts+Reb" },
      { apiKey: "player_pa", label: "Pts+Ast" },
      { apiKey: "player_ra", label: "Reb+Ast" },
      // Defense
      { apiKey: "player_steals", label: "Steals" },
      { apiKey: "player_blocks", label: "Blocks" },
      { apiKey: "player_turnovers", label: "TO" },
      // Special
      { apiKey: "player_double_double", label: "Double-Double" },
      { apiKey: "first_field_goal", label: "1st Basket" },
    ],
  },
  nfl: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Spread" },
      { apiKey: "total_points", label: "Total" },
      { apiKey: "home_team_total_points", label: "Home Total" },
      { apiKey: "away_team_total_points", label: "Away Total" },
      // 1st Half
      { apiKey: "game_1h_moneyline", label: "1H ML" },
      { apiKey: "1st_half_point_spread", label: "1H Spread" },
      { apiKey: "1st_half_total_points", label: "1H Total" },
      // 1st Quarter
      { apiKey: "1st_quarter_moneyline", label: "1Q ML" },
      { apiKey: "1st_quarter_point_spread", label: "1Q Spread" },
      { apiKey: "1st_quarter_total_points", label: "1Q Total" },
    ],
    player: [
      // Scoring
      { apiKey: "player_touchdowns", label: "Any TD" },
      { apiKey: "player_first_td", label: "1st TD" },
      // Passing
      { apiKey: "player_passing_yards", label: "Pass Yds" },
      { apiKey: "player_passing_tds", label: "Pass TDs" },
      { apiKey: "player_passing_completions", label: "Completions" },
      { apiKey: "player_passing_attempts", label: "Pass Att" },
      { apiKey: "player_interceptions_thrown", label: "INTs" },
      // Rushing
      { apiKey: "player_rushing_yards", label: "Rush Yds" },
      { apiKey: "player_rushing_attempts", label: "Rush Att" },
      // Receiving
      { apiKey: "player_receiving_yards", label: "Rec Yds" },
      { apiKey: "player_receptions", label: "Rec" },
      // Combo
      { apiKey: "player_rush_rec_yards", label: "Rush+Rec" },
      // Kicking
      { apiKey: "player_field_goals", label: "FGs Made" },
      { apiKey: "player_kicking_points", label: "Kick Pts" },
    ],
  },
  ncaaf: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Spread" },
      { apiKey: "total_points", label: "Total" },
      { apiKey: "home_team_total_points", label: "Home Total" },
      { apiKey: "away_team_total_points", label: "Away Total" },
      { apiKey: "game_1h_moneyline", label: "1H ML" },
      { apiKey: "1st_half_point_spread", label: "1H Spread" },
      { apiKey: "1st_half_total_points", label: "1H Total" },
    ],
    player: [
      { apiKey: "player_touchdowns", label: "Any TD" },
      { apiKey: "player_first_td", label: "1st TD" },
      { apiKey: "player_passing_yards", label: "Pass Yds" },
      { apiKey: "player_passing_tds", label: "Pass TDs" },
      { apiKey: "player_rushing_yards", label: "Rush Yds" },
      { apiKey: "player_receiving_yards", label: "Rec Yds" },
      { apiKey: "player_receptions", label: "Rec" },
    ],
  },
  nhl: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Puck Line" },
      { apiKey: "game_total_goals", label: "Total" },
      { apiKey: "moneyline_3_way", label: "ML 3-Way" },
      { apiKey: "home_team_total_goals", label: "Home Total" },
      { apiKey: "away_team_total_goals", label: "Away Total" },
      // 1st Period
      { apiKey: "game_1p_moneyline", label: "1P ML" },
      { apiKey: "game_1p_spread", label: "1P Puck Line" },
      { apiKey: "1st_period_total_goals", label: "1P Total" },
    ],
    player: [
      // Skater Props
      { apiKey: "player_points", label: "Points" },
      { apiKey: "player_goals", label: "Goals" },
      { apiKey: "player_assists", label: "Assists" },
      { apiKey: "player_shots_on_goal", label: "SOG" },
      { apiKey: "player_blocked_shots", label: "Blocks" },
      // Goalscorer
      { apiKey: "player_first_goal", label: "1st Goal" },
      { apiKey: "player_last_goal", label: "Last Goal" },
      { apiKey: "player_anytime_goal", label: "Any Goal" },
      // Goalie Props
      { apiKey: "goalie_saves", label: "Saves" },
      { apiKey: "goalie_goals_against", label: "GA" },
    ],
  },
  mlb: {
    game: [
      { apiKey: "h2h", label: "ML" },
      { apiKey: "spreads", label: "Run Line" },
      { apiKey: "totals", label: "Total" },
    ],
    player: [
      // Batter Props
      { apiKey: "batter_home_runs", label: "HR" },
      { apiKey: "batter_hits", label: "Hits" },
      { apiKey: "batter_total_bases", label: "Total Bases" },
      { apiKey: "batter_rbis", label: "RBI" },
      { apiKey: "batter_runs_scored", label: "Runs" },
      { apiKey: "batter_walks", label: "Walks" },
      { apiKey: "batter_stolen_bases", label: "SB" },
      // Pitcher Props
      { apiKey: "pitcher_strikeouts", label: "K" },
      { apiKey: "pitcher_hits_allowed", label: "Hits Allowed" },
      { apiKey: "pitcher_walks", label: "Walks" },
      { apiKey: "pitcher_outs", label: "Outs" },
    ],
  },
  ncaab: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Spread" },
      { apiKey: "total_points", label: "Total" },
      { apiKey: "team_total", label: "Team Total" },
      { apiKey: "game_1h_moneyline", label: "1H ML" },
      { apiKey: "1st_half_point_spread", label: "1H Spread" },
      { apiKey: "1st_half_total_points", label: "1H Total" },
    ],
    player: [],
  },
  wnba: {
    game: [
      { apiKey: "game_moneyline", label: "ML" },
      { apiKey: "game_spread", label: "Spread" },
      { apiKey: "total_points", label: "Total" },
      { apiKey: "team_total", label: "Team Total" },
    ],
    player: [
      { apiKey: "player_points", label: "Points" },
      { apiKey: "player_rebounds", label: "Rebounds" },
      { apiKey: "player_assists", label: "Assists" },
      { apiKey: "player_threes_made", label: "3PT" },
      { apiKey: "player_pra", label: "PRA" },
    ],
  },
};

export function MarketChips({ sport, type, selectedMarket, onMarketChange }: MarketChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Get markets for this sport and type
  const markets = useMemo(() => {
    const sportKey = sport.toLowerCase();
    return ALL_MARKETS[sportKey]?.[type] || [];
  }, [sport, type]);

  // Scroll selected market into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedMarket]);

  if (markets.length === 0) {
    return null;
  }

  return (
    <div 
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4"
    >
      {markets.map((market) => {
        const isSelected = selectedMarket === market.apiKey;
        return (
          <button
            key={market.apiKey}
            ref={isSelected ? selectedRef : null}
            onClick={() => onMarketChange(market.apiKey)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap active:scale-[0.95]",
              isSelected
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
          >
            {market.label}
          </button>
        );
      })}
    </div>
  );
}

// Export helper to get default market for a type
export function getDefaultMarketForType(sport: string, type: "game" | "player"): string {
  const sportKey = sport.toLowerCase();
  const markets = ALL_MARKETS[sportKey]?.[type] || [];
  return markets[0]?.apiKey || "game_moneyline";
}
