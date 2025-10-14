import { redirect } from 'next/navigation'

/**
 * Legacy Player Props Redirect
 * 
 * Redirects users from the old /odds/[sport]/player-props route 
 * to the new unified odds screen with equivalent filters
 */
export default function PlayerPropsPage({ 
  params 
}: { 
  params: { sport: string } 
}) {
  // Redirect to unified odds screen with player props filters
  redirect(`/odds?sport=${params.sport}&type=player&market=passing_tds&scope=pregame`)
}