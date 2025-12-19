"use client";
import React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// EDGE FINDER SKELETON
// Shows the +EV betting interface
// ============================================================================

export const EdgeFinderSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white">Edge Finder</div>
            <div className="text-xs text-neutral-500 mt-0.5">23 +EV opportunities found</div>
          </div>
          <div className="flex gap-2">
            {["+EV", "Boosts", "Arbitrage"].map((filter, i) => (
              <div 
                key={filter}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium",
                  i === 0 
                    ? "bg-green-500 text-white" 
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                )}
              >
                {filter}
              </div>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-xs text-neutral-500">Filters:</span>
          <div className="flex gap-2">
            <span className="px-2 py-1 rounded bg-brand/10 text-brand text-xs font-medium">EV ≥ 3%</span>
            <span className="px-2 py-1 rounded bg-brand/10 text-brand text-xs font-medium">Kelly ≥ 1%</span>
            <span className="px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs">All Sports</span>
          </div>
        </div>

        {/* EV Cards */}
        <div className="p-4 space-y-3">
          {[
            { player: "Jayson Tatum", prop: "Over 27.5 Points", ev: "+8.2%", kelly: "2.4%", odds: "+115", book: "FanDuel", noVig: "+105" },
            { player: "Luka Doncic", prop: "Over 8.5 Assists", ev: "+6.5%", kelly: "1.8%", odds: "+130", book: "DraftKings", noVig: "+118" },
            { player: "Nikola Jokic", prop: "Over 11.5 Rebounds", ev: "+5.1%", kelly: "1.5%", odds: "-105", book: "Caesars", noVig: "-112" },
          ].map((item, i) => (
            <div 
              key={i} 
              className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/20 dark:to-transparent border border-green-200 dark:border-green-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                  <div>
                    <div className="font-semibold text-neutral-900 dark:text-white">{item.player}</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">{item.prop}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-green-500">{item.ev}</div>
                  <div className="text-xs text-neutral-500">Expected Value</div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs text-neutral-500">Odds</div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white">{item.odds}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Kelly</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{item.kelly}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">No-Vig</div>
                    <div className="text-sm font-bold text-neutral-600 dark:text-neutral-400">{item.noVig}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{item.book}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ARBITRAGE SKELETON
// Shows the arbitrage betting interface
// ============================================================================

export const ArbitrageSkeleton = () => {
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-neutral-900 dark:text-white">Arbitrage Scanner</div>
              <div className="text-xs text-neutral-500 mt-0.5">Risk-free profit opportunities</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">3 live arbs</span>
            </div>
          </div>
        </div>

        {/* Arb Cards */}
        <div className="p-4 space-y-4">
          {[
            { 
              event: "Lakers vs Celtics",
              market: "Spread",
              profit: "2.4%",
              legs: [
                { side: "LAL +4.5", odds: "-105", book: "FanDuel", stake: "$512" },
                { side: "BOS -4.5", odds: "+110", book: "DraftKings", stake: "$488" },
              ]
            },
            { 
              event: "Anthony Edwards - Points",
              market: "Player Prop",
              profit: "1.8%",
              legs: [
                { side: "Over 26.5", odds: "+115", book: "Caesars", stake: "$475" },
                { side: "Under 26.5", odds: "-102", book: "BetMGM", stake: "$525" },
              ]
            },
          ].map((arb, i) => (
            <div 
              key={i} 
              className="rounded-xl border-2 border-green-500/30 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-neutral-900 overflow-hidden"
            >
              {/* Arb Header */}
              <div className="px-4 py-3 bg-green-500/10 dark:bg-green-900/30 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white">{arb.event}</div>
                  <div className="text-xs text-neutral-500">{arb.market}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-green-500">+{arb.profit}</div>
                  <div className="text-xs text-neutral-500">Guaranteed Profit</div>
                </div>
              </div>
              
              {/* Legs */}
              <div className="p-4 space-y-2">
                {arb.legs.map((leg, j) => (
                  <div key={j} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-500">
                        {j + 1}
                      </div>
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white">{leg.side}</div>
                        <div className="text-xs text-neutral-500">{leg.book}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-neutral-900 dark:text-white">{leg.odds}</div>
                      <div className="text-xs text-green-600 dark:text-green-400">Stake: {leg.stake}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total */}
              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">Total Stake: $1,000</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">Guaranteed Return: $1,024</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LIVE ODDS SKELETON
// Shows the real-time odds comparison screen
// ============================================================================

export const LiveOddsSkeleton = () => {
  const books = ["FD", "DK", "CZR", "MGM", "BR"];
  
  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-neutral-900 dark:text-white">Live Odds</div>
            <div className="text-xs text-neutral-500 mt-0.5">NFL • Week 15 • Updated 2s ago</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">LIVE</span>
          </div>
        </div>

        {/* Book Headers */}
        <div className="grid grid-cols-7 gap-2 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          <div className="col-span-2 text-xs font-semibold text-neutral-500">MATCHUP</div>
          {books.map((book) => (
            <div key={book} className="flex justify-center">
              <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-400">
                {book}
              </div>
            </div>
          ))}
        </div>

        {/* Games */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {[
            { 
              team1: "KC Chiefs", team2: "BUF Bills",
              odds: [
                ["-145", "+125"],
                ["-140", "+120"],
                ["-142", "+122"],
                ["-138", "+118"],
                ["-144", "+124"],
              ]
            },
            { 
              team1: "DET Lions", team2: "GB Packers",
              odds: [
                ["+105", "-125"],
                ["+110", "-130"],
                ["+108", "-128"],
                ["+112", "-132"],
                ["+106", "-126"],
              ]
            },
            { 
              team1: "SF 49ers", team2: "SEA Seahawks",
              odds: [
                ["-180", "+155"],
                ["-175", "+150"],
                ["-178", "+153"],
                ["-172", "+148"],
                ["-176", "+152"],
              ]
            },
          ].map((game, i) => (
            <div key={i} className="grid grid-cols-7 gap-2 px-6 py-3 items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
              <div className="col-span-2">
                <div className="text-sm font-medium text-neutral-900 dark:text-white">{game.team1}</div>
                <div className="text-sm text-neutral-500 mt-1">{game.team2}</div>
              </div>
              {game.odds.map((bookOdds, j) => {
                const isBest1 = bookOdds[0] === game.odds.reduce((best, curr) => 
                  parseInt(curr[0]) > parseInt(best[0]) ? curr : best
                )[0];
                const isBest2 = bookOdds[1] === game.odds.reduce((best, curr) => 
                  parseInt(curr[1]) > parseInt(best[1]) ? curr : best
                )[1];
                
                return (
                  <div key={j} className="flex flex-col items-center gap-1">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold tabular-nums",
                      isBest1 ? "bg-green-500 text-white" : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {bookOdds[0]}
                    </span>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold tabular-nums",
                      isBest2 ? "bg-green-500 text-white" : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {bookOdds[1]}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

