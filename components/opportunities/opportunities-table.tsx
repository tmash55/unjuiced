"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  type Opportunity,
  formatEdge,
  formatEV,
  formatKelly,
  formatMarketName,
  formatProbability,
  getOpportunityGrade,
} from "@/lib/types/opportunities";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  isLoading?: boolean;
  isPro?: boolean;
  showEV?: boolean;
  onRowClick?: (opp: Opportunity) => void;
}

const GRADE_COLORS = {
  A: "bg-green-500/20 text-green-500 border-green-500/30",
  B: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  D: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

/**
 * Format game time as relative or absolute
 */
function formatGameTime(gameStart: string): string {
  const date = new Date(gameStart);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return "Live";
  if (diffHours < 1) return `${Math.round(diffHours * 60)}m`;
  if (diffHours < 24) return `${Math.round(diffHours)}h`;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Single opportunity row
 */
function OpportunityRow({
  opp,
  showEV,
  onRowClick,
}: {
  opp: Opportunity;
  showEV: boolean;
  onRowClick?: (opp: Opportunity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const grade = getOpportunityGrade(opp);
  const sportsbook = getSportsbookById(opp.bestBook);

  const handleBetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opp.bestLink) {
      window.open(opp.bestLink, "_blank");
    }
  };

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "group cursor-pointer transition-colors",
          "hover:bg-muted/50",
          expanded && "bg-muted/30"
        )}
      >
        {/* Sport */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            <SportIcon sport={opp.sport} className="w-4 h-4" />
            <span className="text-xs text-muted-foreground uppercase">{opp.sport}</span>
          </div>
        </td>

        {/* Player & Market */}
        <td className="py-3 px-3">
          <div className="flex flex-col">
            <span className="font-medium text-sm">{opp.player}</span>
            <span className="text-xs text-muted-foreground">
              {formatMarketName(opp.market)} {opp.side === "over" ? "O" : "U"} {opp.line}
            </span>
          </div>
        </td>

        {/* Game */}
        <td className="py-3 px-3">
          <div className="flex flex-col">
            <span className="text-sm">{opp.awayTeam} @ {opp.homeTeam}</span>
            <span className="text-xs text-muted-foreground">{formatGameTime(opp.gameStart)}</span>
          </div>
        </td>

        {/* Best Book */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            {sportsbook?.icon && (
              <img src={sportsbook.icon} alt={sportsbook.name} className="w-5 h-5 rounded" />
            )}
            <span className="text-sm">{sportsbook?.name || opp.bestBook}</span>
          </div>
        </td>

        {/* Best Price */}
        <td className="py-3 px-3">
          <span className={cn(
            "font-mono font-semibold text-sm",
            opp.bestPrice.startsWith("+") ? "text-green-500" : "text-foreground"
          )}>
            {opp.bestPrice}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            ({opp.nBooks} books)
          </span>
        </td>

        {/* Sharp Price */}
        <td className="py-3 px-3">
          <Tooltip content={`Sharp books: ${opp.sharpBooks.join(", ") || "N/A"}`}>
            <span className="font-mono text-sm text-muted-foreground">
              {opp.sharpPrice || "—"}
            </span>
          </Tooltip>
        </td>

        {/* Edge % */}
        <td className="py-3 px-3">
          <span className={cn(
            "font-mono font-semibold text-sm",
            (opp.edgePct || 0) > 5 ? "text-green-500" : 
            (opp.edgePct || 0) > 0 ? "text-blue-500" : "text-muted-foreground"
          )}>
            {formatEdge(opp.edgePct)}
          </span>
        </td>

        {/* EV % (conditional) */}
        {showEV && (
          <td className="py-3 px-3">
            <div className="flex items-center gap-1">
              <span className={cn(
                "font-mono font-semibold text-sm",
                (opp.evPct || 0) > 3 ? "text-green-500" : 
                (opp.evPct || 0) > 0 ? "text-blue-500" : "text-muted-foreground"
              )}>
                {formatEV(opp.evPct)}
              </span>
              {opp.devigMethod === "proper" ? (
                <Tooltip content="Properly devigged using both sides">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                </Tooltip>
              ) : opp.devigMethod === "estimated" ? (
                <Tooltip content="Estimated (one-sided devig)">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                </Tooltip>
              ) : null}
            </div>
          </td>
        )}

        {/* Grade */}
        <td className="py-3 px-3">
          {grade && (
            <span className={cn(
              "px-2 py-0.5 rounded text-xs font-bold border",
              GRADE_COLORS[grade]
            )}>
              {grade}
            </span>
          )}
        </td>

        {/* Bet Button */}
        <td className="py-3 px-3">
          <button
            onClick={handleBetClick}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Bet <ExternalLink className="w-3 h-3" />
          </button>
        </td>

        {/* Expand Icon */}
        <td className="py-3 px-2">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </td>
      </tr>

      {/* Expanded Row */}
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={showEV ? 11 : 10} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ExpandedContent opp={opp} showEV={showEV} />
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Expanded row content
 */
function ExpandedContent({ opp, showEV }: { opp: Opportunity; showEV: boolean }) {
  return (
    <div className="bg-muted/20 border-t border-b border-border p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* All Books */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          All Books ({opp.nBooks})
        </h4>
        <div className="space-y-1">
          {opp.allBooks.slice(0, 8).map((book) => {
            const sb = getSportsbookById(book.book);
            return (
              <div key={book.book} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {sb?.icon && <img src={sb.icon} alt={sb.name} className="w-4 h-4 rounded" />}
                  <span>{sb?.name || book.book}</span>
                </div>
                <span className="font-mono">{book.priceFormatted}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* EV Details */}
      {showEV && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            +EV Analysis
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">True Probability</span>
              <span className="font-mono">{formatProbability(opp.trueProbability)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fair Odds</span>
              <span className="font-mono">{opp.fairAmerican || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kelly Stake</span>
              <span className="font-mono">{formatKelly(opp.kellyFraction)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Market Vig</span>
              <span className="font-mono">
                {opp.overround !== null ? `${(opp.overround * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Devig Method</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded",
                opp.devigMethod === "proper" 
                  ? "bg-green-500/20 text-green-500" 
                  : "bg-yellow-500/20 text-yellow-500"
              )}>
                {opp.devigMethod || "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Opposite Side */}
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Opposite Side ({opp.oppositeSide?.side || "—"})
        </h4>
        {opp.oppositeSide ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best Book</span>
              <span>{opp.oppositeSide.bestBook || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best Price</span>
              <span className="font-mono">{opp.oppositeSide.bestPrice || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sharp Price</span>
              <span className="font-mono">{opp.oppositeSide.sharpPrice || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Books Available</span>
              <span>{opp.oppositeSide.allBooks.length}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No opposite side data</p>
        )}
      </div>
    </div>
  );
}

/**
 * Main table component
 */
export function OpportunitiesTable({
  opportunities,
  isLoading,
  isPro = true,
  showEV = true,
  onRowClick,
}: OpportunitiesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading opportunities...</div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-1">No opportunities found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or check back later
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="py-3 px-3 font-medium">Sport</th>
            <th className="py-3 px-3 font-medium">Player / Market</th>
            <th className="py-3 px-3 font-medium">Game</th>
            <th className="py-3 px-3 font-medium">Best Book</th>
            <th className="py-3 px-3 font-medium">Best Price</th>
            <th className="py-3 px-3 font-medium">
              <Tooltip content="Sharp reference price (vs Pinnacle or blend)">
                <span className="flex items-center gap-1">
                  Sharp <Info className="w-3 h-3" />
                </span>
              </Tooltip>
            </th>
            <th className="py-3 px-3 font-medium">Edge %</th>
            {showEV && (
              <th className="py-3 px-3 font-medium">
                <Tooltip content="Expected Value after proper devigging">
                  <span className="flex items-center gap-1">
                    EV % <Info className="w-3 h-3" />
                  </span>
                </Tooltip>
              </th>
            )}
            <th className="py-3 px-3 font-medium">Grade</th>
            <th className="py-3 px-3 font-medium">Action</th>
            <th className="py-3 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {opportunities.map((opp) => (
            <OpportunityRow
              key={opp.id}
              opp={opp}
              showEV={showEV}
              onRowClick={onRowClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

