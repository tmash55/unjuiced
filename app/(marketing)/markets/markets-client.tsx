"use client";

import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { Badge } from "@/components/badge";
import { SectionHeading } from "@/components/seciton-heading";
import { SubHeading } from "@/components/subheading";
import { SPORT_MARKETS, type SportMarket } from "@/lib/data/markets";
import { SportIcon } from "@/components/icons/sport-icons";
import { 
  Trophy, 
  Users, 
  TrendingUp,
  ChevronDown
} from "lucide-react";
import { useState, useEffect } from "react";

// Ordered by popularity: NFL, NBA, MLB, NHL, NCAAB, WNBA, NCAAF
const SPORT_INFO_ORDERED = [
  {
    key: "football_nfl",
    name: "NFL",
    sportKey: "americanfootball",
    description: "Professional football betting markets including game lines, player props, and team totals.",
  },
  {
    key: "basketball_nba",
    name: "NBA",
    sportKey: "basketball",
    description: "Professional basketball markets including quarters, halves, and player performances.",
  },
  {
    key: "baseball_mlb",
    name: "MLB",
    sportKey: "baseball",
    description: "Baseball markets covering game lines, run totals, and batter/pitcher props.",
  },
  {
    key: "icehockey_nhl",
    name: "NHL",
    sportKey: "icehockey",
    description: "Hockey betting markets including periods, puck lines, and player stats.",
  },
  {
    key: "basketball_ncaab",
    name: "NCAAB",
    sportKey: "basketball",
    description: "College basketball betting with full game and player prop markets.",
  },
  {
    key: "basketball_wnba",
    name: "WNBA",
    sportKey: "basketball",
    description: "Women's professional basketball markets with comprehensive coverage.",
  },
  {
    key: "football_ncaaf",
    name: "NCAAF",
    sportKey: "americanfootball",
    description: "College football markets with comprehensive game and player prop coverage.",
  },
];

// Create lookup object for backward compatibility
const SPORT_INFO = Object.fromEntries(
  SPORT_INFO_ORDERED.map(sport => [sport.key, sport])
) as Record<string, typeof SPORT_INFO_ORDERED[0]>;

function groupMarketsByType(markets: SportMarket[]) {
  const gameMarkets: SportMarket[] = [];
  const playerMarkets: SportMarket[] = [];
  
  // Game-level group names (team/game outcomes, not individual player performance)
  const gameGroups = new Set([
    'Game',
    'Halves',
    'Quarters',
    'Team Totals',
    '1st Period',
    '2nd Period',
    '3rd Period',
    'Races',
    'Field Goals',
    'Touchdowns',
    'Special',
    'Other'
  ]);
  
  // Player-specific group names that should never be game markets
  const playerGroups = new Set([
    'Scoring',
    'Defense',
    'Combo',
    'Passing',
    'Receiving',
    'Rushing',
    'Kicking',
    'Skater',
    'Goalie',
    'Batter',
    'Pitcher'
  ]);
  
  markets.forEach(market => {
    const group = market.group || 'Other';
    
    // If explicitly a player group, it's a player prop
    if (playerGroups.has(group)) {
      playerMarkets.push(market);
    }
    // If explicitly a game group, it's a game market
    else if (gameGroups.has(group)) {
      gameMarkets.push(market);
    }
    // Default to player props for unknown groups
    else {
      playerMarkets.push(market);
    }
  });
  
  return { gameMarkets, playerMarkets };
}

function groupByCategory(markets: SportMarket[]) {
  const grouped: Record<string, SportMarket[]> = {};
  
  markets.forEach(market => {
    const category = market.group || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(market);
  });
  
  return grouped;
}

export default function MarketsClient() {
  const [selectedSport, setSelectedSport] = useState(SPORT_INFO_ORDERED[0]);
  const [activeSport, setActiveSport] = useState(SPORT_INFO_ORDERED[0].key);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Intersection Observer to track which sport section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sportKey = entry.target.id.replace('sport-', '');
            setActiveSport(sportKey);
            // Also update selected sport for mobile dropdown
            const sport = SPORT_INFO_ORDERED.find(s => s.key === sportKey);
            if (sport) {
              setSelectedSport(sport);
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px', // Trigger when section is in the top 40% of viewport
        threshold: 0
      }
    );

    // Observe all sport sections
    SPORT_INFO_ORDERED.forEach((info) => {
      const element = document.getElementById(`sport-${info.key}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSport = (sportKey: string) => {
    const element = document.getElementById(`sport-${sportKey}`);
    if (element) {
      const navHeight = 140; // Approximate height of nav + sport nav
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth'
      });
    }
    // Update selected sport for mobile dropdown
    const sport = SPORT_INFO_ORDERED.find(s => s.key === sportKey);
    if (sport) {
      setSelectedSport(sport);
      setIsDropdownOpen(false);
    }
  };

  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      {/* Hero Section */}
      <Container className="border-divide border-x">
        <div className="flex flex-col items-center py-20 px-4">
          <Badge text="Betting Markets" />
          <SectionHeading className="mt-4">
            Every Market. Every Sport.
          </SectionHeading>
          <SubHeading as="p" className="mx-auto mt-6 max-w-2xl text-center">
            Compare odds across hundreds of betting markets for NFL, NBA, NHL, MLB, NCAAF, and NCAAB. 
            From game lines to player props, find the best value for every bet.
          </SubHeading>
        </div>
      </Container>

      <DivideX />

      {/* Sport Navigation */}
      <div className="sticky top-[60px] z-40 bg-white/95 backdrop-blur-xl dark:bg-black/95 border-b border-neutral-200 dark:border-neutral-800">
        <Container className="border-divide border-x">
          {/* Mobile Dropdown */}
          <div className="md:hidden px-4 py-3">
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800">
                    <SportIcon sport={selectedSport.sportKey} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {selectedSport.name}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 z-20 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
                    {SPORT_INFO_ORDERED.map((info) => (
                      <button
                        key={info.key}
                        onClick={() => scrollToSport(info.key)}
                        className={`flex w-full items-center gap-3 px-4 py-3 transition-all hover:bg-brand/5 dark:hover:bg-brand/10 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 ${
                          selectedSport.key === info.key ? 'bg-brand/5 dark:bg-brand/10' : ''
                        }`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800">
                          <SportIcon sport={info.sportKey} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                        </div>
                        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                          {info.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop Horizontal Navigation */}
          <div className="hidden md:flex items-center justify-center gap-1 px-4 py-3">
            {SPORT_INFO_ORDERED.map((info) => {
              const isActive = activeSport === info.key;
              return (
                <button
                  key={info.key}
                  onClick={() => scrollToSport(info.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all group min-w-fit border ${
                    isActive
                      ? 'bg-brand/10 dark:bg-brand/20 border-brand/30 dark:border-brand/40'
                      : 'border-transparent hover:bg-brand/5 dark:hover:bg-brand/10 hover:border-brand/20 dark:hover:border-brand/30'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                    isActive
                      ? 'bg-brand/20 dark:bg-brand/30 scale-105'
                      : 'bg-neutral-100 dark:bg-neutral-800 group-hover:bg-brand/10 dark:group-hover:bg-brand/20 group-hover:scale-105'
                  }`}>
                    <SportIcon 
                      sport={info.sportKey} 
                      className={`h-4 w-4 transition-colors ${
                        isActive
                          ? 'text-brand'
                          : 'text-neutral-600 dark:text-neutral-400 group-hover:text-brand'
                      }`}
                    />
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-brand'
                      : 'text-neutral-700 dark:text-neutral-300 group-hover:text-brand'
                  }`}>
                    {info.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Container>
      </div>

      <DivideX />

      {/* Markets by Sport */}
      {SPORT_INFO_ORDERED.map((sportInfo, sportIndex) => {
        const markets = SPORT_MARKETS[sportInfo.key];
        if (!markets) return null;

        const { gameMarkets, playerMarkets } = groupMarketsByType(markets);
        const gameGroups = groupByCategory(gameMarkets);
        const playerGroups = groupByCategory(playerMarkets);

        return (
          <div key={sportInfo.key} id={`sport-${sportInfo.key}`}>
            {/* Sport Header */}
            <Container className="border-divide border-x bg-neutral-50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-4 py-8 px-4 md:px-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <SportIcon sport={sportInfo.sportKey} className="h-7 w-7 text-brand" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {sportInfo.name}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {sportInfo.description}
                  </p>
                </div>
              </div>
            </Container>

            <DivideX />

            {/* Game Markets */}
            {gameMarkets.length > 0 && (
              <>
                <Container className="border-divide border-x px-4 py-12 md:px-8">
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-5 w-5 text-brand" />
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
                        Game Markets
                      </h3>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Bet on game outcomes, totals, and team performances
                    </p>
                  </div>

                  {Object.entries(gameGroups).map(([category, categoryMarkets]) => (
                    <div key={category} className="mb-8 last:mb-0">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4 uppercase tracking-wide">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryMarkets.map((market) => (
                          <div
                            key={market.apiKey}
                            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-all hover:border-brand/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/10">
                              <TrendingUp className="h-4 w-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                {market.label}
                              </p>
                              {market.hasAlternates && (
                                <p className="text-xs text-brand">Alternates Available</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Container>

                <DivideX />
              </>
            )}

            {/* Player Props */}
            {playerMarkets.length > 0 && (
              <>
                <Container className="border-divide border-x px-4 py-12 md:px-8">
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-brand" />
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
                        Player Props
                      </h3>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Individual player performance markets and statistics
                    </p>
                  </div>

                  {Object.entries(playerGroups).map(([category, categoryMarkets]) => (
                    <div key={category} className="mb-8 last:mb-0">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4 uppercase tracking-wide">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryMarkets.map((market) => (
                          <div
                            key={market.apiKey}
                            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-all hover:border-brand/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/10">
                              <Users className="h-4 w-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                {market.label}
                              </p>
                              {market.hasAlternates && (
                                <p className="text-xs text-brand">Alternates Available</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Container>

                {sportIndex < SPORT_INFO_ORDERED.length - 1 && <DivideX />}
              </>
            )}
          </div>
        );
      })}
    </main>
  );
}

