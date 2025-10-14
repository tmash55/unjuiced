// app/(protected)/odds/[sport]/game-lines/page.tsx
import { redirect } from 'next/navigation'

type Params = Promise<{ sport: string }>

export default async function GameLinesPage({ params }: { params: Params }) {
  const { sport } = await params
  // Use '&' (not &amp;) in the URL
  redirect(`/odds?sport=${sport}&type=game&market=total&scope=pregame`)
}