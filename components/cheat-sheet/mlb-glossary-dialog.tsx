"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── Glossary Data ────────────────────────────────────────────────────────────

interface GlossaryTerm {
  term: string;
  abbr?: string;
  definition: string;
  category: string;
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  // ── Batting ─────────────────────────────────────────────
  { term: "Batting Average", abbr: "AVG", definition: "Hits divided by at-bats. League average is around .250.", category: "Batting" },
  { term: "On-Base Percentage", abbr: "OBP", definition: "How often a batter reaches base (hits + walks + HBP). League average is around .320.", category: "Batting" },
  { term: "Slugging Percentage", abbr: "SLG", definition: "Total bases divided by at-bats. Measures raw power. League average is around .400.", category: "Batting" },
  { term: "On-Base Plus Slugging", abbr: "OPS", definition: "OBP + SLG combined. Quick measure of overall offensive value.", category: "Batting" },
  { term: "Isolated Power", abbr: "ISO", definition: "SLG minus AVG — measures extra-base hit power only. Elite: .250+, average: .140.", category: "Batting" },
  { term: "Weighted On-Base Average", abbr: "wOBA", definition: "Weights each way of reaching base by its actual run value. More accurate than OPS. Elite: .370+, average: .320.", category: "Batting" },
  { term: "Expected Batting Average", abbr: "xBA", definition: "Statcast-predicted batting average based on exit velocity and launch angle, removing luck and defense.", category: "Batting" },
  { term: "Expected Slugging", abbr: "xSLG", definition: "Statcast-predicted slugging based on exit velocity and launch angle. Shows true power output.", category: "Batting" },
  { term: "Contact Rate", abbr: "Contact%", definition: "Percentage of swings that make contact with the ball. High contact = harder to strike out.", category: "Batting" },
  { term: "Line Drive Rate", abbr: "LD%", definition: "Percentage of batted balls that are line drives. Line drives have the highest batting average.", category: "Batting" },
  { term: "Sprint Speed", abbr: "Sprint", definition: "Statcast sprint speed in feet/second. Elite: 30+, average: 27, slow: below 26.", category: "Batting" },
  { term: "Runs Batted In Rate", abbr: "RBI Rate", definition: "RBI per plate appearance. Measures how efficiently a batter drives in runners.", category: "Batting" },
  { term: "Batter vs Pitcher", abbr: "BvP", definition: "Historical stats of a specific batter against a specific pitcher. Bayesian-regressed with a 10+ PA threshold.", category: "Batting" },

  // ── Statcast / Batted Ball ──────────────────────────────
  { term: "Exit Velocity", abbr: "EV", definition: "Speed of the ball off the bat in mph. Elite: 93+, average: 88.", category: "Statcast" },
  { term: "Barrel Rate", abbr: "Barrel%", definition: "Percentage of batted balls with ideal exit velocity + launch angle combo. Barrels become hits/HRs at very high rates.", category: "Statcast" },
  { term: "Hard Hit Rate", abbr: "Hard Hit%", definition: "Percentage of batted balls with exit velocity of 95+ mph. Elite: 50%+, average: 35%.", category: "Statcast" },
  { term: "Sweet Spot Rate", abbr: "Sweet Spot%", definition: "Percentage of batted balls with launch angle between 8° and 32° — the productive zone.", category: "Statcast" },
  { term: "Launch Angle", abbr: "LA", definition: "Vertical angle of the ball off the bat. Ground balls: below 10°, line drives: 10-25°, fly balls: 25-50°.", category: "Statcast" },
  { term: "Expected ERA", abbr: "xERA", definition: "Statcast-predicted ERA based on quality of contact allowed, strikeouts, and walks.", category: "Statcast" },

  // ── Pitching ────────────────────────────────────────────
  { term: "Earned Run Average", abbr: "ERA", definition: "Earned runs allowed per 9 innings. Lower is better. Elite: below 3.00, average: around 4.00.", category: "Pitching" },
  { term: "Fielding Independent Pitching", abbr: "FIP", definition: "ERA estimator using only strikeouts, walks, and home runs — removes defense. More predictive than ERA.", category: "Pitching" },
  { term: "Walks + Hits per Inning", abbr: "WHIP", definition: "Baserunners allowed per inning. Elite: below 1.00, average: around 1.25.", category: "Pitching" },
  { term: "Strikeouts per 9 Innings", abbr: "K/9", definition: "Strikeout rate scaled to 9 innings. Elite: 10+, average: 8.", category: "Pitching" },
  { term: "Strikeout Rate", abbr: "K%", definition: "Percentage of plate appearances ending in a strikeout. Elite: 28%+, average: 22%.", category: "Pitching" },
  { term: "Walk Rate", abbr: "BB%", definition: "Percentage of plate appearances ending in a walk. Lower is better. Elite: below 5%, average: 8%.", category: "Pitching" },
  { term: "K Minus BB Rate", abbr: "K-BB%", definition: "Strikeout rate minus walk rate. Most stable single pitcher metric. Elite: 20%+, average: 12%.", category: "Pitching" },
  { term: "Hits per 9 Innings", abbr: "H/9", definition: "Hits allowed per 9 innings pitched. Lower is better.", category: "Pitching" },
  { term: "Home Runs per 9 Innings", abbr: "HR/9", definition: "Home runs allowed per 9 innings. Lower is better. Elite: below 0.8.", category: "Pitching" },
  { term: "Projected Innings Pitched", abbr: "Proj IP", definition: "Expected innings the starter will pitch based on recent workload and pitch counts.", category: "Pitching" },

  // ── Pitch Data ──────────────────────────────────────────
  { term: "Called Strike + Whiff Rate", abbr: "CSW%", definition: "Percentage of pitches that are either called strikes or swinging strikes. Best single pitch-quality metric. Computed from individual pitch data.", category: "Pitch Data" },
  { term: "Whiff Rate", abbr: "Whiff%", definition: "Swings and misses divided by total swings. Measures how hard a pitcher is to make contact against.", category: "Pitch Data" },
  { term: "Chase Rate", abbr: "Chase%", definition: "How often batters swing at pitches outside the zone. High chase rate = pitcher induces bad swings.", category: "Pitch Data" },
  { term: "Ground Ball Rate", abbr: "GB%", definition: "Percentage of batted balls that are ground balls. High GB% pitchers allow fewer home runs.", category: "Pitch Data" },
  { term: "Fly Ball Rate", abbr: "FB%", definition: "Percentage of batted balls that are fly balls. High FB% pitchers are more HR-prone.", category: "Pitch Data" },

  // ── Defense & Baserunning ───────────────────────────────
  { term: "Outs Above Average", abbr: "OAA", definition: "Statcast fielding metric. Positive = above-average defense. Used to assess team defense behind pitchers.", category: "Defense" },
  { term: "Stolen Base Attempt Rate", abbr: "SB Att%", definition: "Percentage of games where a runner attempts at least one stolen base.", category: "Defense" },
  { term: "Stolen Base Success Rate", abbr: "SB Success%", definition: "Percentage of stolen base attempts that succeed. Elite: 85%+.", category: "Defense" },
  { term: "Catcher Pop Time", abbr: "Pop Time", definition: "Time from pitch hitting the catcher's mitt to the ball arriving at 2nd base. Faster = harder to steal on.", category: "Defense" },
  { term: "Caught Stealing Rate", abbr: "CS%", definition: "Percentage of steal attempts thrown out by the catcher.", category: "Defense" },

  // ── Scoring & Models ────────────────────────────────────
  { term: "Composite Score", abbr: "Score", definition: "Our 0-100 matchup quality score. Combines 10-15 weighted factors per market into a single number.", category: "Our Scoring" },
  { term: "Letter Grade", abbr: "Grade", definition: "S (90+, elite), A (75-89, strong), B (60-74, solid), C (40-59, average), D (0-39, weak).", category: "Our Scoring" },
  { term: "Model Probability", abbr: "Model Prob", definition: "Our model's predicted probability that the prop goes over. Based on Poisson, binomial, or calibrated sigmoid models.", category: "Our Scoring" },
  { term: "Implied Probability", abbr: "Implied", definition: "The probability implied by the sportsbook odds. For example, -150 odds imply ~60% probability.", category: "Our Scoring" },
  { term: "Edge", abbr: "Edge%", definition: "Model probability minus implied probability. Positive edge = our model thinks the over is more likely than the odds suggest.", category: "Our Scoring" },
  { term: "Factor Scores", abbr: "Factors", definition: "Individual 0-100 scores for each component (power, pitcher, park, weather, etc.) that make up the composite score.", category: "Our Scoring" },

  // ── Environment ─────────────────────────────────────────
  { term: "Park Factor", abbr: "Park", definition: "How much a ballpark inflates or suppresses a stat relative to average. 100 = neutral, 110 = 10% boost.", category: "Environment" },
  { term: "Park HR Factor", abbr: "HR Park", definition: "Park factor specifically for home runs. Coors Field and Great American are hitter-friendly; Oracle Park suppresses.", category: "Environment" },
  { term: "Roof Type", abbr: "Roof", definition: "Open, retractable, or dome. Domed stadiums get neutral weather scores — no wind or temperature penalty.", category: "Environment" },
  { term: "Platoon Advantage", abbr: "Platoon", definition: "Batters hit better vs opposite-hand pitchers (lefty batter vs righty pitcher). Our models weight lineup handedness composition.", category: "Environment" },

  // ── Odds & Betting ──────────────────────────────────────
  { term: "American Odds", abbr: "Odds", definition: "+150 means $100 bet wins $150. -150 means you bet $150 to win $100. We show the best available across sportsbooks.", category: "Odds" },
  { term: "Consensus Line", abbr: "Line", definition: "The most commonly offered line across sportsbooks (e.g., 0.5 for HR, 4.5 for K's).", category: "Odds" },
  { term: "No Run First Inning", abbr: "NRFI", definition: "A bet that neither team scores in the first inning. Driven by starting pitcher quality and top-of-order matchups.", category: "Odds" },
  { term: "Positive Expected Value", abbr: "+EV", definition: "A bet where the true probability exceeds the implied odds — a long-term winning play.", category: "Odds" },
  { term: "Vegas Game Total", abbr: "O/U", definition: "The over/under total runs set by sportsbooks. Higher totals correlate with more RBI and scoring opportunities.", category: "Odds" },
  { term: "H+R+RBI", abbr: "HRR", definition: "Combined hits, runs, and RBIs for a batter. Our model scores contact quality, power, RBI opportunity, runs opportunity, and pitcher vulnerability.", category: "Our Scoring" },
];

const CATEGORIES = ["Batting", "Statcast", "Pitching", "Pitch Data", "Defense", "Our Scoring", "Environment", "Odds"] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function MlbGlossaryDialog() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let terms = GLOSSARY_TERMS;
    if (activeCategory) {
      terms = terms.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      terms = terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          (t.abbr && t.abbr.toLowerCase().includes(q)) ||
          t.definition.toLowerCase().includes(q)
      );
    }
    return terms;
  }, [search, activeCategory]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    filtered.forEach((t) => {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    });
    return map;
  }, [filtered]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Glossary</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl h-[85vh] sm:h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-bold text-neutral-900 dark:text-white">
            MLB Glossary
          </DialogTitle>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Stats, metrics, and terms used across our baseball tools
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search terms (e.g. CSW%, barrel, FIP)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                !activeCategory
                  ? "bg-brand text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              All ({GLOSSARY_TERMS.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = GLOSSARY_TERMS.filter((t) => t.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                    activeCategory === cat
                      ? "bg-brand text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60 shrink-0" />

        {/* Terms list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-400">No terms match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-5">
              {[...grouped.entries()].map(([category, terms]) => (
                <div key={category}>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">{category}</h3>
                  <div className="space-y-0.5">
                    {terms.map((t) => (
                      <div key={t.term} className="group rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">{t.term}</span>
                          {t.abbr && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-mono">
                              {t.abbr}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{t.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60 px-5 py-2.5 shrink-0">
          <p className="text-[10px] text-neutral-400 text-center">
            {filtered.length} term{filtered.length !== 1 ? "s" : ""}
            {search || activeCategory ? " matching" : " total"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
