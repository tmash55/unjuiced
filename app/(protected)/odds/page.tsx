import { redirect } from 'next/navigation'

/**
 * Odds Root Page
 * 
 * Redirects to the default sport (NFL) for cleaner URL structure.
 * Users will be redirected to /odds/nfl with default filters.
 */
export default function OddsRootPage() {
  // Redirect to NFL odds as the default
  redirect('/odds/nfl')
}