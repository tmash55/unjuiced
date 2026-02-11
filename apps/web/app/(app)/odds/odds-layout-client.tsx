"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { OddsNavigation } from "@/components/odds-screen/odds-navigation";
import { getDefaultMarket } from "@/lib/data/markets";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { OddsUtilityProvider, useOddsUtilityOptional } from "./odds-utility-context";
import { useOddsPreferences } from "@/context/preferences-context";
import { useIsMobile } from "@/hooks/use-media-query";

interface OddsLayoutClientProps {
  children: React.ReactNode;
}

// Sport display names
const SPORT_NAMES: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  nhl: "NHL",
  ncaab: "NCAAB",
  ncaaf: "NCAAF",
  mlb: "MLB",
  wnba: "WNBA",
};

/**
 * Inner layout component that uses the utility context
 */
function OddsLayoutInner({ children }: OddsLayoutClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const utility = useOddsUtilityOptional();
  const { preferences, updatePreferences } = useOddsPreferences();
  const isMobile = useIsMobile();
  
  // Extract sport from pathname (e.g., /odds/nba -> nba)
  const sport = useMemo(() => {
    const match = pathname.match(/\/odds\/([^\/]+)/);
    return match ? match[1].toLowerCase() : "nfl";
  }, [pathname]);
  
  // Get type and market from search params
  const type = searchParams.get("type") || "game";
  const market = searchParams.get("market") || getDefaultMarket(sport, type as "game" | "player");
  const scope = (searchParams.get("scope") || "pregame") as "pregame" | "live";
  
  // Track if we're transitioning to show loading state
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Reset transitioning state when pathname changes (navigation complete)
  useEffect(() => {
    setIsTransitioning(false);
  }, [pathname, searchParams]);
  
  const handleSportChange = useCallback((newSport: string) => {
    if (newSport === sport) return;
    setIsTransitioning(true);
    // Reset to "game" type for sports without player props (mlb, wnba)
    const sportsWithoutPlayerProps = ['mlb', 'wnba'];
    const newType = sportsWithoutPlayerProps.includes(newSport.toLowerCase()) ? 'game' : type;
    const newMarket = getDefaultMarket(newSport, newType as "game" | "player");
    router.push(`/odds/${newSport}?type=${newType}&market=${newMarket}&scope=${scope}`, { scroll: false });
  }, [sport, type, scope, router]);
  
  const handleMarketChange = useCallback((newMarket: string, newType: "game" | "player") => {
    setIsTransitioning(true);
    if (newType !== type) {
      router.replace(`/odds/${sport}?type=${newType}&market=${newMarket}&scope=${scope}`, { scroll: false });
    } else {
      router.replace(`/odds/${sport}?type=${type}&market=${newMarket}&scope=${scope}`, { scroll: false });
    }
  }, [sport, type, scope, router]);
  
  const handleScopeChange = useCallback((newScope: "pregame" | "live") => {
    if (newScope === scope) return;
    setIsTransitioning(true);
    router.replace(`/odds/${sport}?type=${type}&market=${market}&scope=${newScope}`, { scroll: false });
  }, [sport, type, market, scope, router]);
  
  const handleTableViewChange = useCallback((newView: 'compact' | 'relaxed') => {
    updatePreferences({ tableView: newView });
  }, [updatePreferences]);
  
  // Only show navigation on sport-specific pages (not /odds main page) and not on mobile
  const showNavigation = pathname.startsWith("/odds/") && pathname !== "/odds" && !isMobile;
  const sportName = SPORT_NAMES[sport] || sport.toUpperCase();
  
  return (
    <div className="min-h-screen">
      {showNavigation && (
        <>
          {/* Header - persists but updates with sport */}
          <div className="px-4 sm:px-6 pt-6 pb-4">
            <ToolHeading>{sportName} Odds</ToolHeading>
            <ToolSubheading>
              Compare real-time odds across top sportsbooks and find the best value for {sportName} games and player props.
            </ToolSubheading>
          </div>
          
          {/* Navigation Tabs - sticky below header */}
          <div className="sticky top-14 z-50 bg-white dark:bg-neutral-950">
            <OddsNavigation
              sport={sport}
              market={market}
              type={type as "game" | "player"}
              scope={scope}
              onSportChange={handleSportChange}
              onMarketChange={handleMarketChange}
              onScopeChange={handleScopeChange}
              // Utility controls from context
              searchQuery={utility?.searchQuery}
              onSearchChange={utility?.setSearchQuery}
              onFiltersClick={utility?.openFilters}
              connectionStatus={utility?.connectionStatus}
              // View toggle
              tableView={preferences.tableView}
              onTableViewChange={handleTableViewChange}
              // Game selector
              games={utility?.games}
              onGameSelect={utility?.onGameSelect}
            />
          </div>
        </>
      )}
      
      {/* Pass transitioning state to children via CSS class for loading states */}
      <div className={isTransitioning ? "odds-transitioning" : ""}>
        {children}
      </div>
    </div>
  );
}

/**
 * Client-side odds layout that persists navigation across sport changes.
 * This prevents the navigation from re-mounting when switching sports.
 */
export function OddsLayoutClient({ children }: OddsLayoutClientProps) {
  return (
    <OddsUtilityProvider>
      <OddsLayoutInner>{children}</OddsLayoutInner>
    </OddsUtilityProvider>
  );
}
