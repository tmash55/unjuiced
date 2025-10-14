import { redirect } from 'next/navigation'



 type Params = Promise<{ sport: string }>
export default function PlayerPropsPage({ params }: { params: Params }) {
  // Redirect to unified odds screen with player props filters
  redirect(`/odds?sport=${sport}&type=player&market=passing_tds&scope=pregame`)
}