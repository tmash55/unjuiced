"use client";

import React, { useState, useMemo } from "react";
import { X, Search, BookOpen, TrendingUp, Target, Percent, BarChart3, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

interface GlossaryTerm {
  term: string;
  abbreviation?: string;
  definition: string;
  example?: string;
}

interface GlossaryCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  terms: GlossaryTerm[];
}

const GLOSSARY_DATA: GlossaryCategory[] = [
  {
    name: "Hit Rates",
    icon: Percent,
    color: "emerald",
    terms: [
      {
        term: "Hit Rate",
        definition: "The percentage of games where a player exceeded (hit the over on) a specific stat line.",
        example: "80% hit rate on 20.5 PTS means the player scored 21+ points in 80% of games."
      },
      {
        term: "Last 5 Games",
        abbreviation: "L5",
        definition: "Hit rate calculated from the player's 5 most recent games.",
        example: "L5: 100% means they hit in all of their last 5 games."
      },
      {
        term: "Last 10 Games",
        abbreviation: "L10",
        definition: "Hit rate calculated from the player's 10 most recent games. Often considered the most reliable recent form indicator.",
      },
      {
        term: "Last 20 Games",
        abbreviation: "L20",
        definition: "Hit rate calculated from the player's 20 most recent games. Provides a larger sample size.",
      },
      {
        term: "Season",
        abbreviation: "SZN",
        definition: "Hit rate calculated from all games played in the current season.",
      },
      {
        term: "Head to Head",
        abbreviation: "H2H",
        definition: "Hit rate calculated only from games against the current opponent this season.",
        example: "H2H: 100% vs LAL means they hit every time they played the Lakers."
      },
      {
        term: "Season Average",
        abbreviation: "Avg",
        definition: "The player's average stat output per game across the season.",
        example: "Season Avg of 22.5 PTS means the player averages 22.5 points per game."
      },
    ],
  },
  {
    name: "Matchup Analysis",
    icon: Target,
    color: "blue",
    terms: [
      {
        term: "Defense vs Position",
        abbreviation: "DvP",
        definition: "Ranks how a team's defense performs against a specific position (PG, SG, SF, PF, C) for a given stat.",
        example: "1st DvP = worst defense (allows most), 30th = best defense (allows least)."
      },
      {
        term: "Matchup Rank",
        definition: "The opponent's defensive ranking for the player's position and stat. Lower ranks (1-10) indicate favorable matchups.",
      },
      {
        term: "Good Matchup",
        definition: "When the opponent ranks 1-10 in DvP, meaning they allow more of that stat to the position. Highlighted in green.",
      },
      {
        term: "Bad Matchup",
        definition: "When the opponent ranks 21-30 in DvP, meaning they're strong defensively against the position. Highlighted in red.",
      },
      {
        term: "Points Per Possession",
        abbreviation: "PPP",
        definition: "Efficiency metric measuring points scored per offensive possession. Higher PPP indicates more efficient scoring.",
        example: "1.2 PPP means the player scores 1.2 points on average each time they have the ball."
      },
      {
        term: "Usage Rate",
        abbreviation: "USG%",
        definition: "Percentage of team plays used by a player while on the court. Higher usage means more involvement in the offense.",
        example: "30% USG means the player is involved in 30% of plays when on court."
      },
    ],
  },
  {
    name: "Stats & Markets",
    icon: BarChart3,
    color: "violet",
    terms: [
      {
        term: "Points",
        abbreviation: "PTS",
        definition: "Total points scored by the player in a game.",
      },
      {
        term: "Rebounds",
        abbreviation: "REB",
        definition: "Total rebounds (offensive + defensive) grabbed by the player.",
      },
      {
        term: "Assists",
        abbreviation: "AST",
        definition: "Passes that directly lead to a made basket by a teammate.",
      },
      {
        term: "Three Pointers Made",
        abbreviation: "3PM",
        definition: "Number of successful three-point shots made.",
      },
      {
        term: "Steals",
        abbreviation: "STL",
        definition: "Number of times the player took the ball from an opponent.",
      },
      {
        term: "Blocks",
        abbreviation: "BLK",
        definition: "Number of opponent shot attempts blocked.",
      },
      {
        term: "Turnovers",
        abbreviation: "TO",
        definition: "Number of times the player lost possession to the other team.",
      },
      {
        term: "Minutes",
        abbreviation: "MIN",
        definition: "Total minutes played in a game. Key context for understanding stat output.",
      },
      {
        term: "Field Goal Percentage",
        abbreviation: "FG%",
        definition: "Percentage of field goal attempts made. Measures shooting efficiency.",
      },
      {
        term: "Free Throws Made",
        abbreviation: "FTM",
        definition: "Number of successful free throw shots made.",
      },
    ],
  },
  {
    name: "Combo Stats",
    icon: Zap,
    color: "amber",
    terms: [
      {
        term: "Points + Rebounds + Assists",
        abbreviation: "PRA",
        definition: "Combined total of points, rebounds, and assists in a single game.",
        example: "25 PTS + 8 REB + 6 AST = 39 PRA"
      },
      {
        term: "Points + Rebounds",
        abbreviation: "P+R",
        definition: "Combined total of points and rebounds.",
      },
      {
        term: "Points + Assists",
        abbreviation: "P+A",
        definition: "Combined total of points and assists.",
      },
      {
        term: "Rebounds + Assists",
        abbreviation: "R+A",
        definition: "Combined total of rebounds and assists.",
      },
      {
        term: "Blocks + Steals",
        abbreviation: "B+S",
        definition: "Combined total of blocks and steals. Often called 'stocks' (steals + blocks).",
      },
      {
        term: "Double-Double",
        abbreviation: "DD",
        definition: "When a player reaches double digits (10+) in two statistical categories in a single game.",
        example: "20 PTS + 12 REB = Double-Double"
      },
    ],
  },
  {
    name: "Betting Terms",
    icon: TrendingUp,
    color: "rose",
    terms: [
      {
        term: "Line",
        definition: "The threshold number set by sportsbooks. Player must exceed this number for an 'over' bet to win.",
        example: "Line of 24.5 PTS means player needs 25+ points for over to hit."
      },
      {
        term: "Over",
        abbreviation: "O",
        definition: "A bet that the player will exceed the line. Shown with green indicators.",
      },
      {
        term: "Under",
        abbreviation: "U",
        definition: "A bet that the player will stay below the line.",
      },
      {
        term: "Odds",
        definition: "The payout multiplier for a bet. Negative odds (e.g., -115) mean you bet more to win less. Positive odds (e.g., +105) mean you win more than you bet.",
      },
      {
        term: "Streak",
        definition: "Number of consecutive games the player has hit (positive) or missed (negative) the current line.",
        example: "+5 streak means hit in last 5 straight games."
      },
      {
        term: "Alternate Lines",
        abbreviation: "Alt Lines",
        definition: "Different line options for the same stat, each with different odds. Lower lines have worse odds, higher lines have better odds.",
      },
      {
        term: "Juice / Vig",
        definition: "The commission sportsbooks charge on bets, built into the odds. Standard juice is -110 on both sides.",
        example: "-110 odds means you bet $110 to win $100."
      },
      {
        term: "Sharp Line",
        definition: "Lines from professional sportsbooks (Pinnacle, Circa) considered more accurate. Used to find value.",
      },
    ],
  },
  {
    name: "Correlations",
    icon: Target,
    color: "cyan",
    terms: [
      {
        term: "Teammate Correlation",
        definition: "How a player's stats change when a specific teammate plays well or poorly. Positive correlation means both succeed together.",
        example: "When Teammate A scores 25+, Player B averages +5 more assists."
      },
      {
        term: "With/Without",
        definition: "Comparison of a player's stats when a teammate is in or out of the lineup due to injury.",
      },
      {
        term: "Pace",
        definition: "The number of possessions a team uses per game. Higher pace = more opportunities for stats.",
        example: "Teams with fast pace often lead to higher totals."
      },
    ],
  },
];

// Get color classes for category
function getCategoryColors(color: string) {
  const colors: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    emerald: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20 dark:border-emerald-500/30",
      iconBg: "bg-emerald-500/20 dark:bg-emerald-500/30",
    },
    blue: {
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/20 dark:border-blue-500/30",
      iconBg: "bg-blue-500/20 dark:bg-blue-500/30",
    },
    violet: {
      bg: "bg-violet-500/10 dark:bg-violet-500/20",
      text: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500/20 dark:border-violet-500/30",
      iconBg: "bg-violet-500/20 dark:bg-violet-500/30",
    },
    amber: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20 dark:border-amber-500/30",
      iconBg: "bg-amber-500/20 dark:bg-amber-500/30",
    },
    rose: {
      bg: "bg-rose-500/10 dark:bg-rose-500/20",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20 dark:border-rose-500/30",
      iconBg: "bg-rose-500/20 dark:bg-rose-500/30",
    },
  };
  return colors[color] || colors.emerald;
}

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlossaryModal({ isOpen, onClose }: GlossaryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Handle Esc key to close
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter terms based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return GLOSSARY_DATA;

    const query = searchQuery.toLowerCase();
    return GLOSSARY_DATA.map(category => ({
      ...category,
      terms: category.terms.filter(term =>
        term.term.toLowerCase().includes(query) ||
        term.abbreviation?.toLowerCase().includes(query) ||
        term.definition.toLowerCase().includes(query)
      ),
    })).filter(category => category.terms.length > 0);
  }, [searchQuery]);

  // Count total terms
  const totalTerms = useMemo(() => 
    GLOSSARY_DATA.reduce((acc, cat) => acc + cat.terms.length, 0),
    []
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[101] sm:w-full sm:max-w-2xl sm:max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800">
              {/* Title Row */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 dark:from-brand/30 dark:to-brand/20">
                    <BookOpen className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                      Glossary
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {totalTerms} terms & abbreviations
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search terms..."
                    className={cn(
                      "w-full pl-10 pr-4 py-2.5 rounded-xl",
                      "bg-neutral-100 dark:bg-neutral-800",
                      "border border-transparent focus:border-brand",
                      "text-sm text-neutral-900 dark:text-white",
                      "placeholder:text-neutral-500",
                      "outline-none transition-colors"
                    )}
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 px-6 pb-4 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    activeCategory === null
                      ? "bg-brand text-white shadow-sm"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                >
                  All
                </button>
                {GLOSSARY_DATA.map((category) => {
                  const colors = getCategoryColors(category.color);
                  const isActive = activeCategory === category.name;
                  return (
                    <button
                      key={category.name}
                      onClick={() => setActiveCategory(isActive ? null : category.name)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                        isActive
                          ? `${colors.bg} ${colors.text} ${colors.border} border`
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      )}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-3" />
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    No terms found
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Try a different search term
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredData
                    .filter(cat => !activeCategory || cat.name === activeCategory)
                    .map((category) => {
                      const colors = getCategoryColors(category.color);
                      const Icon = category.icon;

                      return (
                        <div key={category.name}>
                          {/* Category Header */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", colors.iconBg)}>
                              <Icon className={cn("h-3.5 w-3.5", colors.text)} />
                            </div>
                            <h3 className={cn("text-sm font-semibold", colors.text)}>
                              {category.name}
                            </h3>
                            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700 ml-2" />
                          </div>

                          {/* Terms */}
                          <div className="space-y-2">
                            {category.terms.map((term, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "p-3 rounded-xl border transition-colors",
                                  "bg-neutral-50 dark:bg-neutral-800/50",
                                  "border-neutral-200/60 dark:border-neutral-700/60",
                                  "hover:border-neutral-300 dark:hover:border-neutral-600"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                                        {term.term}
                                      </span>
                                      {term.abbreviation && (
                                        <span className={cn(
                                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                          colors.bg, colors.text
                                        )}>
                                          {term.abbreviation}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                                      {term.definition}
                                    </p>
                                    {term.example && (
                                      <p className="text-[11px] text-neutral-500 dark:text-neutral-500 mt-1.5 italic">
                                        Example: {term.example}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer - hidden on mobile since Esc key doesn't apply */}
            <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-6 py-3 hidden sm:block">
              <p className="text-[10px] text-center text-neutral-400 dark:text-neutral-500">
                Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Trigger button component for use in headers
interface GlossaryButtonProps {
  onClick: () => void;
  className?: string;
}

export function GlossaryButton({ onClick, className }: GlossaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
        "bg-neutral-100 dark:bg-neutral-800",
        "border border-neutral-200 dark:border-neutral-700",
        "text-xs font-medium text-neutral-600 dark:text-neutral-400",
        "hover:bg-neutral-200 dark:hover:bg-neutral-700",
        "hover:text-neutral-900 dark:hover:text-neutral-200",
        "transition-all active:scale-95",
        className
      )}
    >
      <BookOpen className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Glossary</span>
    </button>
  );
}

