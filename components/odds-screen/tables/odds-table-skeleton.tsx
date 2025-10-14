import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface OddsTableSkeletonProps {
  rows?: number
  sportsbookCount?: number
  showBestLine?: boolean
  showAverageLine?: boolean
}

export function OddsTableSkeleton({ 
  rows = 8, 
  sportsbookCount = 6,
  showBestLine = true,
  showAverageLine = true
}: OddsTableSkeletonProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full border-collapse">
        {/* Header Skeleton */}
        <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900">
          <tr>
            {/* Entity Column */}
            <th className="px-4 py-3 text-left border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">
              <Skeleton className="h-4 w-16" />
            </th>
            
            {/* Event Column */}
            <th className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">
              <Skeleton className="h-4 w-20 mx-auto" />
            </th>
            
            {/* Best Line Column */}
            {showBestLine && (
              <th className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">
                <Skeleton className="h-4 w-16 mx-auto" />
              </th>
            )}
            
            {/* Average Line Column */}
            {showAverageLine && (
              <th className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">
                <Skeleton className="h-4 w-16 mx-auto" />
              </th>
            )}
            
            {/* Sportsbook Columns */}
            {Array.from({ length: sportsbookCount }).map((_, index) => (
              <th key={index} className="px-2 py-3 text-center border-r border-gray-200 dark:border-gray-700">
                <Skeleton className="h-6 w-8 mx-auto rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        
        {/* Body Skeleton */}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              {/* Entity Column */}
              <td className="px-4 py-4 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-200 dark:border-gray-700">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </td>
              
              {/* Event Column */}
              <td className="px-3 py-4 text-center border-r border-gray-200 dark:border-gray-700">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16 mx-auto" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
              </td>
              
              {/* Best Line Column */}
              {showBestLine && (
                <td className="px-3 py-4 text-center border-r border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-16 mx-auto rounded-md" />
                    <Skeleton className="h-6 w-16 mx-auto rounded-md" />
                  </div>
                </td>
              )}
              
              {/* Average Line Column */}
              {showAverageLine && (
                <td className="px-3 py-4 text-center border-r border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-16 mx-auto rounded-md" />
                    <Skeleton className="h-6 w-16 mx-auto rounded-md" />
                  </div>
                </td>
              )}
              
              {/* Sportsbook Columns */}
              {Array.from({ length: sportsbookCount }).map((_, colIndex) => (
                <td key={colIndex} className="px-1 py-2 border-r border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <Skeleton className="h-8 w-16 mx-auto rounded-md" />
                    <Skeleton className="h-8 w-16 mx-auto rounded-md" />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

