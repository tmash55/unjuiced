"use client";

/**
 * Edge Finder V2 - Native implementation using v2 API
 * 
 * Uses native Opportunity types and components - no adapters.
 * Compare to /edge-finder (v1) to validate.
 * 
 * URL: /edge-finder-v2
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw, Beaker, Filter } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { Tooltip } from "@/components/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// V2 Native imports
import { useOpportunities } from "@/hooks/use-opportunities";
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table";
import { type OpportunityFilters, type Sport, DEFAULT_FILTERS } from "@/lib/types/opportunities";

import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";

const SPORTS: { value: Sport; label: string }[] = [
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "ncaab", label: "NCAAB" },
  { value: "ncaaf", label: "NCAAF" },
  { value: "nhl", label: "NHL" },
  { value: "mlb", label: "MLB" },
];

const PRESETS = [
  { value: "pinnacle", label: "Pinnacle" },
  { value: "circa", label: "Circa Sports" },
  { value: "average", label: "Market Average" },
  { value: "sharp_consensus", label: "Sharp Consensus" },
];

export default function EdgeFinderV2Page() {
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
  const stablePlanRef = useRef(isPro);

  useEffect(() => {
    if (!planLoading) {
      stablePlanRef.current = isPro;
    }
  }, [planLoading, isPro]);

  const effectiveIsPro = planLoading ? stablePlanRef.current : isPro;

  // Filter state
  const [filters, setFilters] = useState<OpportunityFilters>({
    ...DEFAULT_FILTERS,
    sports: ["nba", "nfl"],
  });

  const [searchLocal, setSearchLocal] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Use v2 hook
  const {
    opportunities,
    totalScanned,
    timingMs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOpportunities({
    filters,
    isPro: effectiveIsPro,
    enabled: !planLoading,
  });

  // Apply search filter client-side
  const filteredOpportunities = useMemo(() => {
    if (!searchLocal.trim()) return opportunities;
    const q = searchLocal.toLowerCase();
    return opportunities.filter(
      (opp) =>
        opp.player.toLowerCase().includes(q) ||
        opp.homeTeam.toLowerCase().includes(q) ||
        opp.awayTeam.toLowerCase().includes(q) ||
        opp.market.toLowerCase().includes(q)
    );
  }, [opportunities, searchLocal]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const updateFilter = <K extends keyof OpportunityFilters>(
    key: K,
    value: OpportunityFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSport = (sport: Sport) => {
    setFilters((prev) => ({
      ...prev,
      sports: prev.sports.includes(sport)
        ? prev.sports.filter((s) => s !== sport)
        : [...prev.sports, sport],
    }));
  };

  if (planLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState text="Loading Edge Finder V2..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* V2 Test Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <Beaker className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-500">V2 Native Mode</p>
          <p className="text-xs text-muted-foreground truncate">
            Using native components with /api/v2/opportunities. Compare to{" "}
            <a href="/edge-finder" className="underline text-primary">
              /edge-finder (v1)
            </a>
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <p>Scanned: {totalScanned.toLocaleString()}</p>
          <p>Timing: {timingMs}ms</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <ToolHeading>
            <TrendingUp className="inline w-6 h-6 mr-2" />
            Edge Finder V2
          </ToolHeading>
          <ToolSubheading>
            {isLoading
              ? "Loading..."
              : `${filteredOpportunities.length} opportunities found`}
          </ToolSubheading>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className={cn(
            "p-2 rounded-md border transition-colors self-start md:self-auto",
            "hover:bg-muted/50 disabled:opacity-50"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", (refreshing || isFetching) && "animate-spin")} />
        </button>
      </div>

      {/* Filters */}
      <FiltersBar>
        <FiltersBarSection>
          {/* Search */}
          <div className="relative">
            <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players, teams..."
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Sports Toggle */}
          <div className="flex gap-1">
            {SPORTS.map((sport) => (
              <button
                key={sport.value}
                onClick={() => toggleSport(sport.value)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border",
                  filters.sports.includes(sport.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent hover:bg-muted/50 border-border"
                )}
              >
                {sport.label}
              </button>
            ))}
          </div>

          {/* Preset Selector */}
          <select
            value={filters.preset || "pinnacle"}
            onChange={(e) => updateFilter("preset", e.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Advanced Filters Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 px-3 py-2 text-sm rounded-md border hover:bg-muted/50 transition-colors">
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filter Options</DialogTitle>
                <DialogDescription>
                  Customize which opportunities appear
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Min Edge */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="minEdge">Min Edge %</Label>
                  <Input
                    id="minEdge"
                    type="number"
                    value={filters.minEdge}
                    onChange={(e) => updateFilter("minEdge", Number(e.target.value))}
                    className="w-20"
                    min={0}
                    step={1}
                  />
                </div>

                {/* Min EV */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="minEV">Min EV % (leave blank for edge only)</Label>
                  <Input
                    id="minEV"
                    type="number"
                    value={filters.minEV ?? ""}
                    onChange={(e) => 
                      updateFilter("minEV", e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-20"
                    placeholder="—"
                    step={0.5}
                  />
                </div>

                {/* Require Two-Way */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="twoWay">Require Two-Way Devig</Label>
                    <p className="text-xs text-muted-foreground">
                      Only show properly devigged opportunities
                    </p>
                  </div>
                  <Switch
                    id="twoWay"
                    checked={filters.requireTwoWay}
                    onCheckedChange={(v) => updateFilter("requireTwoWay", v)}
                  />
                </div>

                {/* Odds Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minOdds">Min Odds</Label>
                    <Input
                      id="minOdds"
                      type="number"
                      value={filters.minOdds}
                      onChange={(e) => updateFilter("minOdds", Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxOdds">Max Odds</Label>
                    <Input
                      id="maxOdds"
                      type="number"
                      value={filters.maxOdds}
                      onChange={(e) => updateFilter("maxOdds", Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div className="flex items-center justify-between">
                  <Label>Sort By</Label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter("sortBy", e.target.value as OpportunityFilters["sortBy"])}
                    className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="edge_pct">Edge %</option>
                    <option value="ev_pct">EV %</option>
                    <option value="best_decimal">Best Odds</option>
                    <option value="kelly_fraction">Kelly Stake</option>
                  </select>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </FiltersBarSection>
      </FiltersBar>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
          Error: {error.message}
        </div>
      )}

      {/* Table */}
      <OpportunitiesTable
        opportunities={filteredOpportunities}
        isLoading={isLoading}
        isPro={effectiveIsPro}
        showEV={filters.minEV !== null || filters.requireTwoWay}
      />

      {/* Pro Upgrade CTA */}
      {!effectiveIsPro && !isLoggedIn && (
        <div className="text-center py-8 border-t">
          <p className="text-muted-foreground mb-2">
            Sign up for Pro to unlock all opportunities and features
          </p>
          <a
            href="/pricing"
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  );
}
