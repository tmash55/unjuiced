import React from 'react'

interface OddsTableSkeletonProps {
  rows?: number
  sportsbookCount?: number
  showBestLine?: boolean
  showAverageLine?: boolean
  showLineColumn?: boolean
}

// Individual cell skeleton with staggered animation
function CellSkeleton({ delay = 0, className = "" }: { delay?: number; className?: string }) {
  return (
    <div 
      className={`animate-pulse ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

// Sportsbook logo skeleton in header
function SportsbookLogoSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <CellSkeleton 
        delay={delay} 
        className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-700/60" 
      />
    </div>
  )
}

// Odds cell skeleton (mimics the actual odds badges)
function OddsCellSkeleton({ delay = 0, single = false }: { delay?: number; single?: boolean }) {
  if (single) {
    return (
      <div className="flex justify-center">
        <CellSkeleton 
          delay={delay} 
          className="w-14 h-5 rounded bg-neutral-200/80 dark:bg-neutral-700/50" 
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <CellSkeleton 
        delay={delay} 
        className="w-14 h-5 rounded bg-neutral-200/80 dark:bg-neutral-700/50" 
      />
      <CellSkeleton 
        delay={delay + 50} 
        className="w-14 h-5 rounded bg-neutral-200/60 dark:bg-neutral-700/40" 
      />
    </div>
  )
}

// Best odds cell skeleton with book logo
function BestOddsCellSkeleton({ delay = 0, single = false }: { delay?: number; single?: boolean }) {
  if (single) {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-1">
          <CellSkeleton 
            delay={delay} 
            className="w-4 h-4 rounded bg-emerald-200/60 dark:bg-emerald-500/20" 
          />
          <CellSkeleton 
            delay={delay} 
            className="w-10 h-5 rounded bg-emerald-200/80 dark:bg-emerald-500/30" 
          />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <CellSkeleton 
          delay={delay} 
          className="w-4 h-4 rounded bg-emerald-200/60 dark:bg-emerald-500/20" 
        />
        <CellSkeleton 
          delay={delay} 
          className="w-10 h-5 rounded bg-emerald-200/80 dark:bg-emerald-500/30" 
        />
      </div>
      <div className="flex items-center gap-1">
        <CellSkeleton 
          delay={delay + 50} 
          className="w-4 h-4 rounded bg-emerald-200/40 dark:bg-emerald-500/15" 
        />
        <CellSkeleton 
          delay={delay + 50} 
          className="w-10 h-5 rounded bg-emerald-200/60 dark:bg-emerald-500/20" 
        />
      </div>
    </div>
  )
}

// Average odds cell skeleton
function AvgOddsCellSkeleton({ delay = 0, single = false }: { delay?: number; single?: boolean }) {
  if (single) {
    return (
      <div className="flex justify-center">
        <CellSkeleton 
          delay={delay} 
          className="w-12 h-5 rounded border border-sky-200 dark:border-sky-500/30 bg-transparent" 
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <CellSkeleton 
        delay={delay} 
        className="w-12 h-5 rounded border border-sky-200 dark:border-sky-500/30 bg-transparent" 
      />
      <CellSkeleton 
        delay={delay + 50} 
        className="w-12 h-5 rounded border border-sky-200/60 dark:border-sky-500/20 bg-transparent" 
      />
    </div>
  )
}

// Player row skeleton
function PlayerRowSkeleton({ 
  delay = 0, 
  sportsbookCount = 6, 
  showBestLine = true, 
  showAverageLine = true,
  showLineColumn = false,
  singleLine = false
}: { 
  delay?: number
  sportsbookCount?: number
  showBestLine?: boolean
  showAverageLine?: boolean
  showLineColumn?: boolean
  singleLine?: boolean
}) {
  return (
    <tr 
      className="border-b border-neutral-200/30 dark:border-neutral-800/30"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Player Name Column */}
      <td className="px-2 py-2 sticky left-0 z-10 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <CellSkeleton delay={delay} className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700/60" />
          <div className="flex flex-col gap-1">
            <CellSkeleton delay={delay} className="h-3.5 w-24 rounded bg-neutral-200 dark:bg-neutral-700/60" />
            <div className="flex items-center gap-1">
              <CellSkeleton delay={delay + 30} className="w-4 h-4 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
              <CellSkeleton delay={delay + 30} className="h-2.5 w-8 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
            </div>
          </div>
        </div>
      </td>
      
      {/* Line Column (for single-line markets) */}
      {showLineColumn && (
        <td className="px-1 py-2 text-center">
          <CellSkeleton delay={delay} className="h-3 w-6 mx-auto rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
        </td>
      )}
      
      {/* Best Line Column */}
      {showBestLine && (
        <td className="px-1 py-2">
          <BestOddsCellSkeleton delay={delay + 50} single={singleLine} />
        </td>
      )}
      
      {/* Average Line Column */}
      {showAverageLine && (
        <td className="px-1 py-2 hidden sm:table-cell">
          <AvgOddsCellSkeleton delay={delay + 100} single={singleLine} />
        </td>
      )}
      
      {/* Sportsbook Columns */}
      {Array.from({ length: sportsbookCount }).map((_, colIndex) => (
        <td key={colIndex} className="px-1 py-2">
          <OddsCellSkeleton delay={delay + 150 + colIndex * 30} single={singleLine} />
        </td>
      ))}
    </tr>
  )
}

// Game header skeleton
function GameHeaderSkeleton({ delay = 0, colSpan = 10 }: { delay?: number; colSpan?: number }) {
  return (
    <tr className="bg-neutral-800/90 dark:bg-neutral-800/90">
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-3" style={{ animationDelay: `${delay}ms` }}>
          {/* Away Team */}
          <div className="flex items-center gap-2 animate-pulse">
            <CellSkeleton delay={delay} className="w-6 h-6 rounded bg-neutral-600/60" />
            <CellSkeleton delay={delay} className="h-4 w-8 rounded bg-neutral-600/60" />
          </div>
          
          <span className="text-neutral-500 text-xs">@</span>
          
          {/* Home Team */}
          <div className="flex items-center gap-2 animate-pulse">
            <CellSkeleton delay={delay + 30} className="w-6 h-6 rounded bg-neutral-600/60" />
            <CellSkeleton delay={delay + 30} className="h-4 w-8 rounded bg-neutral-600/60" />
          </div>
          
          {/* Time */}
          <CellSkeleton delay={delay + 60} className="h-3 w-14 rounded bg-neutral-600/40 ml-2 animate-pulse" />
        </div>
      </td>
    </tr>
  )
}

// Team header skeleton
function TeamHeaderSkeleton({ delay = 0, colSpan = 10 }: { delay?: number; colSpan?: number }) {
  return (
    <tr className="bg-neutral-100/80 dark:bg-neutral-800/40">
      <td colSpan={colSpan} className="px-3 py-1.5">
        <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: `${delay}ms` }}>
          <CellSkeleton delay={delay} className="w-5 h-5 rounded bg-neutral-300/60 dark:bg-neutral-600/40" />
          <CellSkeleton delay={delay} className="h-3 w-28 rounded bg-neutral-300/60 dark:bg-neutral-600/40" />
        </div>
      </td>
    </tr>
  )
}

export function OddsTableSkeleton({ 
  rows = 8, 
  sportsbookCount = 6,
  showBestLine = true,
  showAverageLine = true,
  showLineColumn = false
}: OddsTableSkeletonProps) {
  const totalColumns = 1 + (showLineColumn ? 1 : 0) + (showBestLine ? 1 : 0) + (showAverageLine ? 1 : 0) + sportsbookCount
  
  return (
    <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: '90vh' }}>
        <table className="w-full border-separate border-spacing-0">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-900/95 backdrop-blur">
            <tr>
              {/* Player Header */}
              <th className="px-2 py-2 text-left border-b border-r border-neutral-200/30 dark:border-neutral-800/30 sticky left-0 z-10 bg-neutral-50/95 dark:bg-neutral-900/95">
                <CellSkeleton className="h-3 w-14 rounded bg-neutral-300/60 dark:bg-neutral-700/50 animate-pulse" />
              </th>
              
              {/* Line Header */}
              {showLineColumn && (
                <th className="px-1 py-2 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                  <CellSkeleton className="h-3 w-8 mx-auto rounded bg-neutral-300/60 dark:bg-neutral-700/50 animate-pulse" />
                </th>
              )}
              
              {/* Best Header */}
              {showBestLine && (
                <th className="px-1 py-2 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                  <div className="flex items-center justify-center gap-1 animate-pulse">
                    <CellSkeleton className="w-3 h-3 rounded bg-amber-300/60 dark:bg-amber-500/40" />
                    <CellSkeleton className="h-3 w-8 rounded bg-neutral-300/60 dark:bg-neutral-700/50" />
                  </div>
                </th>
              )}
              
              {/* Avg Header */}
              {showAverageLine && (
                <th className="px-1 py-2 text-center border-b border-r-2 border-neutral-200/30 dark:border-neutral-800/30 border-r-neutral-300 dark:border-r-neutral-700 hidden sm:table-cell">
                  <div className="flex items-center justify-center gap-1 animate-pulse">
                    <CellSkeleton className="w-3 h-3 rounded bg-sky-300/60 dark:bg-sky-500/40" />
                    <CellSkeleton className="h-3 w-6 rounded bg-neutral-300/60 dark:bg-neutral-700/50" />
                  </div>
                </th>
              )}
              
              {/* Sportsbook Headers */}
              {Array.from({ length: sportsbookCount }).map((_, index) => (
                <th key={index} className="px-2 py-2 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                  <SportsbookLogoSkeleton delay={index * 50} />
                </th>
              ))}
            </tr>
          </thead>
          
          {/* Body */}
          <tbody className="divide-y divide-neutral-200/30 dark:divide-neutral-800/30">
            {/* Date Separator */}
            <tr>
              <td 
                colSpan={totalColumns} 
                className="px-4 py-2 bg-neutral-100/80 dark:bg-neutral-800/60 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
              >
                <CellSkeleton className="h-3 w-12 rounded bg-neutral-300/60 dark:bg-neutral-600/50 animate-pulse" />
              </td>
            </tr>
            
            {/* Game Header 1 */}
            <GameHeaderSkeleton delay={0} colSpan={totalColumns} />
            
            {/* Team 1 Header */}
            <TeamHeaderSkeleton delay={50} colSpan={totalColumns} />
            
            {/* Player Rows for Team 1 */}
            {Array.from({ length: Math.ceil(rows / 2) }).map((_, index) => (
              <PlayerRowSkeleton 
                key={`team1-${index}`} 
                delay={100 + index * 80}
                sportsbookCount={sportsbookCount}
                showBestLine={showBestLine}
                showAverageLine={showAverageLine}
                showLineColumn={showLineColumn}
                singleLine={showLineColumn}
              />
            ))}
            
            {/* Team 2 Header */}
            <TeamHeaderSkeleton delay={400} colSpan={totalColumns} />
            
            {/* Player Rows for Team 2 */}
            {Array.from({ length: Math.floor(rows / 2) }).map((_, index) => (
              <PlayerRowSkeleton 
                key={`team2-${index}`} 
                delay={450 + index * 80}
                sportsbookCount={sportsbookCount}
                showBestLine={showBestLine}
                showAverageLine={showAverageLine}
                showLineColumn={showLineColumn}
                singleLine={showLineColumn}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
