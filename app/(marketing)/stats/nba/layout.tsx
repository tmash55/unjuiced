import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NBA Stats | Unjuiced',
  description:
    'NBA statistics, leaderboards, and defensive analysis. Track live PRA leaders, defense vs position rankings, and more.',
  keywords: [
    'NBA stats',
    'NBA statistics',
    'NBA leaderboard',
    'NBA defense',
    'basketball stats',
  ],
};

export default function NBAStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
