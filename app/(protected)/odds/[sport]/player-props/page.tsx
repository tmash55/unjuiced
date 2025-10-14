import { redirect } from 'next/navigation';

type Params = Promise<{ sport: string }>;

export default async function PlayerPropsPage({ params }: { params: Params }) {
  const { sport } = await params; // ✅ Await the promise and destructure sport

  // Redirect to unified odds screen with player props filters
  redirect(`/odds?sport=${sport}&type=player&market=passing_tds&scope=pregame`);
}
