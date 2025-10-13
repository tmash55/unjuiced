"use client";

import { useEffect, useMemo, useState } from "react";
import { AutoToggle } from "@/components/arbs/auto-toggle";
import { Teaser } from "@/components/arbs/teaser";
import { ArbTableV2 } from "@/components/arbs/arb-table-v2";
import { useArbsView } from "@/hooks/use-arbs-view";
import { Button } from "@/components/button";
import { ButtonLink } from "@/components/button-link";
import { TrendingUp, Target, Zap, ArrowRight, AlertCircle } from "lucide-react";
import { useArbitragePreferences } from "@/context/preferences-context";
import { FiltersSheet } from "@/components/arbs/filters-sheet";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default function ArbsPage() {
  const [pro, setPro] = useState(false);
  const [auto, setAuto] = useState(false);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<"prematch" | "live">("prematch");
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [planLoading, setPlanLoading] = useState(true);

  // Load user plan on mount
  useEffect(() => {
    const loadPlan = async () => {
      try {
        setPlanLoading(true);
        const response = await fetch("/api/me/plan", { 
          cache: "no-store", 
          credentials: "include" 
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch plan");
        }
        
        const data = await response.json();
        
        // Check if user is authenticated
        const isAuthenticated = data.authenticated === true;
        setLoggedIn(isAuthenticated);
        
        // Check if user has pro or admin plan
        const isPro = data.plan === "pro" || data.plan === "admin";
        setPro(isPro);
        
        // Disable auto-refresh if not pro
        if (!isPro) {
          setAuto(false);
        }
        
        // Store in window for debugging
        if (typeof window !== 'undefined') {
          (window as any).__userPlan = {
            plan: data.plan,
            authenticated: isAuthenticated,
            isPro,
          };
        }
        
        console.log('✅ Plan loaded:', { 
          plan: data.plan, 
          authenticated: isAuthenticated, 
          isPro 
        });
      } catch (error) {
        console.error("❌ Error loading plan:", error);
        setLoggedIn(false);
        setPro(false);
        setAuto(false);
        
        if (typeof window !== 'undefined') {
          (window as any).__userPlan = { error: String(error) };
        }
      } finally {
        setPlanLoading(false);
      }
    };
    
    loadPlan();
  }, []);

  // Fetch all results at once (no pagination)
  const limit = pro ? 1000 : 100;
  
  const { rows, ids, changes, added, version, loading, connected, cursor, hasMore, nextPage, prevPage, refresh, prefs, prefsLoading, updateFilters, counts, authExpired, reconnectNow, hasActiveFilters } = useArbsView({ pro: pro, live: auto, eventId, limit, mode });
  const [refreshing, setRefreshing] = useState(false);
  const [searchLocal, setSearchLocal] = useState("");
  useEffect(() => { setSearchLocal(prefs.searchQuery || ""); }, [prefs.searchQuery]);
  useEffect(() => {
    const v = searchLocal;
    const t = setTimeout(() => {
      if (v !== prefs.searchQuery) {
        void updateFilters({ searchQuery: v });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchLocal]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const bestRoi = useMemo(() => rows.length ? Math.max(...rows.map(r => (r.roi_bps || 0) / 100)).toFixed(2) : "0.00", [rows]);
  const [freshFound, setFreshFound] = useState(false);
  const [freshBest, setFreshBest] = useState(false);
  const prevFoundRef = useState<number>(rows.length)[0];
  useEffect(() => {
    setFreshFound(true);
    const t = setTimeout(() => setFreshFound(false), 600);
    return () => clearTimeout(t);
  }, [rows.length]);
  useEffect(() => {
    setFreshBest(true);
    const t = setTimeout(() => setFreshBest(false), 600);
    return () => clearTimeout(t);
  }, [bestRoi]);

  // Preferences-based sportsbook filtering (client-side hide only)
  const { filters: arbFilters } = useArbitragePreferences();
  const allowed = new Set((arbFilters?.selectedBooks || []).map((s: string) => s.toLowerCase()));
  const norm = (s?: string) => (s || "").toLowerCase();
  const filteredPairs = rows.map((r, i) => ({ r, id: ids[i] }))
    .filter(({ r }) => {
      if (!arbFilters?.selectedBooks?.length) return true;
      const overOk = !r?.o?.bk || allowed.has(norm(r.o.bk));
      const underOk = !r?.u?.bk || allowed.has(norm(r.u.bk));
      return overOk && underOk;
    });
  const fRows = filteredPairs.map(p => p.r);
  const fIds = filteredPairs.map(p => p.id);

  // Show loading state while checking plan
  if (planLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white py-24 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
            <span className="text-sm font-medium">Loading your account...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              Arbitrage Opportunities
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Risk-free profit opportunities across sportsbooks
            </p>
          </div>
          {mounted && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Opportunities
                  {hasActiveFilters && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand" title="Filters active" />
                  )}
                </div>
                <div className={cn(
                  "mt-1 text-2xl font-bold text-neutral-900 transition-all duration-300 dark:text-white",
                  freshFound && "scale-110"
                )}>
                  {counts ? (mode === 'live' ? counts.live : counts.pregame) : rows.length}
                </div>
              </div>
              <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="text-center">
                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Best ROI
                </div>
                <div className={cn(
                  "mt-1 text-2xl font-bold text-emerald-600 transition-all duration-300 dark:text-emerald-400",
                  freshBest && "scale-110"
                )}>
                  +{bestRoi}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {authExpired && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Session expired. Please reconnect to resume live updates.
            </span>
          </div>
          <Button 
            variant="outline" 
            text="Reconnect"
            onClick={reconnectNow}
            className="shrink-0"
          />
        </div>
      )}

      {!pro && loggedIn && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-brand/20 bg-brand/5 p-4 dark:bg-brand/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 dark:bg-brand/20">
              <Zap className="h-5 w-5 text-brand" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                Upgrade to unlock all opportunities
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                Free plan limited to 2% ROI. Get unlimited access and live updates with Pro.
              </div>
            </div>
          </div>
          <ButtonLink 
            href="/pricing" 
            variant="primary"
            className="shrink-0 gap-2"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Mode Toggle */}
        <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setMode('prematch')}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              mode !== 'live'
                ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            )}
          >
            Pre-Match{counts ? ` (${counts.pregame})` : ''}
          </button>
          <button
            type="button"
            disabled={!pro}
            onClick={() => pro && setMode('live')}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              !pro && "cursor-not-allowed opacity-50",
              mode === 'live' && pro
                ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            )}
          >
            Live{counts ? ` (${counts.live})` : ''}
            {!pro && (
              <span className="ml-1 text-xs opacity-60">Pro</span>
            )}
          </button>
        </div>

        {/* Search */}
        <Input
          placeholder="Search player or team..."
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
          className="w-64"
        />

        {/* Right-aligned controls */}
        <div className="ml-auto flex items-center gap-2">
          <AutoToggle
            enabled={auto}
            setEnabled={setAuto}
            pro={pro}
            connected={connected}
            refreshing={refreshing}
            onManual={async () => {
              try { setRefreshing(true); await refresh(); } finally { setRefreshing(false); }
            }}
          />
          <FiltersSheet pro={pro} />
        </div>
      </div>

      {/* Content */}
      {!loggedIn && <Teaser />}
      
      {loggedIn && (
        loading || prefsLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white py-24 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
              <span className="text-sm font-medium">Loading opportunities...</span>
            </div>
          </div>
        ) : (
          <ArbTableV2 
            rows={fRows} 
            ids={fIds} 
            changes={changes} 
            added={added} 
            totalBetAmount={prefs.totalBetAmount} 
          />
        )
      )}
    </div>
  );
}