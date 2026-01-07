import { Metadata } from 'next'
import React, { Suspense } from 'react'
import { OddsLayoutClient } from './odds-layout-client'

export const metadata: Metadata = {
  title: 'Odds Screen | OddSmash',
  description: 'Unified odds screen for player props and game lines across all sports. Compare odds, find value, and customize your view.',
}

interface OddsLayoutProps {
  children: React.ReactNode
}

/**
 * Odds Section Layout
 * 
 * Provides consistent layout and styling for all odds-related pages.
 * The OddsLayoutClient handles the navigation that persists across sport changes.
 */
export default function OddsLayout({ children }: OddsLayoutProps) {
  return (
    <Suspense fallback={<div className="min-h-screen">{children}</div>}>
      <OddsLayoutClient>
        {children}
      </OddsLayoutClient>
    </Suspense>
  )
}