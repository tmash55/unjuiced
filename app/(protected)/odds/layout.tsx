import { Metadata } from 'next'
import React from 'react'
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
 * Ensures full-height layout for the odds screen interface.
 */
export default function OddsLayout({ children }: OddsLayoutProps) {
  return (
    <div>
      {children}
    </div>
  )
}