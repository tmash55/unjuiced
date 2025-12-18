"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X, TrendingUp, Clock, Target, Activity, Zap, Users } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";

interface StatBoostData {
  // Core stats
  games: number;
  hits: number;
  hitRate: number | null;
  avgStatWhenOut: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  // Minutes
  avgMinutesWhenOut: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  // Usage & Shooting
  usageWhenOut: number;
  usageOverall: number;
  usageBoost: number;
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  // Rebounds
  orebWhenOut: number;
  orebOverall: number;
  orebBoost: number;
  drebWhenOut: number;
  drebOverall: number;
  drebBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  // Playmaking
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
}

interface InjuryImpactStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerId: number;
  teamAbbr: string;
  teammateNames: string[];
  market: string;
  line: number;
  stats: StatBoostData;
}

// Helper to format boost with + sign and color
function formatBoost(boost: number, decimals: number = 1): { text: string; color: string } {
  const formatted = boost > 0 ? `+${boost.toFixed(decimals)}` : boost.toFixed(decimals);
  const color = boost > 0 ? "text-emerald-500" : boost < 0 ? "text-red-500" : "text-neutral-500";
  return { text: formatted, color };
}

// Helper to format usage (multiply by 100 for percentage)
function formatUsageBoost(boost: number): { text: string; color: string } {
  const pct = boost * 100;
  const formatted = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
  const color = pct > 0 ? "text-emerald-500" : pct < 0 ? "text-red-500" : "text-neutral-500";
  return { text: formatted, color };
}

// Stat row component
function StatRow({ 
  label, 
  seasonAvg, 
  whenOut, 
  boost,
  isPercentage = false,
  decimals = 1
}: { 
  label: string; 
  seasonAvg: number; 
  whenOut: number; 
  boost: number;
  isPercentage?: boolean;
  decimals?: number;
}) {
  const boostData = isPercentage ? formatUsageBoost(boost) : formatBoost(boost, decimals);
  
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400 tabular-nums w-10 text-right">
          {isPercentage ? `${(seasonAvg * 100).toFixed(0)}%` : seasonAvg.toFixed(decimals)}
        </span>
        <span className="text-xs font-semibold text-neutral-900 dark:text-white tabular-nums w-10 text-right">
          {isPercentage ? `${(whenOut * 100).toFixed(0)}%` : whenOut.toFixed(decimals)}
        </span>
        <span className={cn("text-xs font-bold tabular-nums w-14 text-right", boostData.color)}>
          {boostData.text}
        </span>
      </div>
    </div>
  );
}

// Stat category header
function StatCategory({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-neutral-200 dark:border-neutral-700">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-xs font-bold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      
      {/* Column Headers */}
      <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
        <span>Stat</span>
        <div className="flex items-center gap-3">
          <span className="w-10 text-right">Szn</span>
          <span className="w-10 text-right">W/O</span>
          <span className="w-14 text-right">Boost</span>
        </div>
      </div>
      
      {children}
    </div>
  );
}

export function InjuryImpactStatsModal({
  isOpen,
  onClose,
  playerName,
  playerId,
  teamAbbr,
  teammateNames,
  market,
  line,
  stats,
}: InjuryImpactStatsModalProps) {
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

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const marketDisplay = market.replace("player_", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const hitRate = stats.hitRate !== null ? (stats.hitRate * 100).toFixed(0) : "—";
  const mainBoost = formatBoost(stats.statBoost);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <PlayerHeadshot 
              nbaPlayerId={playerId} 
              name={playerName} 
              size="tiny"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {playerName}
                </h2>
                <span className="text-xs text-neutral-400">•</span>
                <span className="text-xs text-neutral-500">{teamAbbr}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {marketDisplay} O{line}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">
                  w/o {teammateNames.length > 1 ? `${teammateNames.length} players` : teammateNames[0]?.split(" ").pop()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Summary Stats */}
        <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-500">{hitRate}%</div>
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Hit Rate</div>
          </div>
          <div className="text-center">
            <div className={cn("text-xl font-bold", mainBoost.color)}>
              {mainBoost.text} <span className="text-xs font-medium text-neutral-500">{marketDisplay.toLowerCase()}</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Avg Boost</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-neutral-900 dark:text-white">{stats.games}</div>
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">Sample</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Minutes & Usage */}
          <StatCategory icon={Clock} title="Playing Time & Usage">
            <StatRow label="Minutes" seasonAvg={stats.avgMinutesOverall} whenOut={stats.avgMinutesWhenOut} boost={stats.minutesBoost} />
            <StatRow label="Usage Rate" seasonAvg={stats.usageOverall} whenOut={stats.usageWhenOut} boost={stats.usageBoost} isPercentage />
          </StatCategory>

          {/* Shooting */}
          <StatCategory icon={Target} title="Shooting Volume">
            <StatRow label="Field Goal Attempts" seasonAvg={stats.fgaOverall} whenOut={stats.fgaWhenOut} boost={stats.fgaBoost} />
            <StatRow label="3-Point Attempts" seasonAvg={stats.fg3aOverall} whenOut={stats.fg3aWhenOut} boost={stats.fg3aBoost} />
          </StatCategory>

          {/* Rebounding */}
          <StatCategory icon={Activity} title="Rebounding">
            <StatRow label="Offensive Rebounds" seasonAvg={stats.orebOverall} whenOut={stats.orebWhenOut} boost={stats.orebBoost} />
            <StatRow label="Defensive Rebounds" seasonAvg={stats.drebOverall} whenOut={stats.drebWhenOut} boost={stats.drebBoost} />
            <StatRow label="Total Rebounds" seasonAvg={stats.rebOverall} whenOut={stats.rebWhenOut} boost={stats.rebBoost} />
          </StatCategory>

          {/* Playmaking */}
          <StatCategory icon={Zap} title="Playmaking">
            <StatRow label="Passes Made" seasonAvg={stats.passesOverall} whenOut={stats.passesWhenOut} boost={stats.passesBoost} />
            <StatRow label="Potential Assists" seasonAvg={stats.potentialAstOverall} whenOut={stats.potentialAstWhenOut} boost={stats.potentialAstBoost} />
          </StatCategory>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 shrink-0">
          <p className="text-[9px] text-neutral-400 text-center">
            Based on {stats.games} games when {teammateNames.join(" & ")} {teammateNames.length > 1 ? "were" : "was"} out • 2024-25 season
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

