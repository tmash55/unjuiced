import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'King of the Court - NBA PRA Leaderboard | Live Stats & Rankings',
  description:
    'Track the King of the Court with our live NBA PRA (Points + Rebounds + Assists) leaderboard. Real-time player stats, historical data, and elite performances updated every 20 seconds.',
  keywords: [
    'NBA PRA',
    'King of the Court',
    'NBA leaderboard',
    'Points Rebounds Assists',
    'NBA live stats',
    'NBA player stats',
    'basketball stats',
    'NBA PRA leaders',
    'KOTC',
    'NBA stats tracker',
    'live NBA stats',
    'NBA box scores',
  ],
  openGraph: {
    title: 'King of the Court - NBA PRA Leaderboard',
    description:
      'Live NBA PRA (Points + Rebounds + Assists) leaderboard with real-time updates, historical data, and elite performances.',
    type: 'website',
    url: 'https://unjuiced.io/stats/nba',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'King of the Court - NBA PRA Leaderboard',
    description:
      'Live NBA PRA stats updated every 20 seconds. Track points, rebounds, and assists leaders in real-time.',
  },
  alternates: {
    canonical: 'https://unjuiced.io/stats/nba',
  },
};

export default function NBAStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

