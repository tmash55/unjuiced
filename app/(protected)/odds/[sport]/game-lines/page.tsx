import { redirect } from 'next/navigation'

/**
 * Legacy Game Lines Redirect
 * 
 * Redirects users from the old /odds/[sport]/game-lines route 
 * to the new unified odds screen with equivalent filters
 */
export default function GameLinesPage({ 
  params 
}: { 
  params: { sport: string } 
}) {
  // Redirect to unified odds screen with game props filters
  redirect(`/odds?sport=${params.sport}&type=game&market=total&scope=pregame`)
}