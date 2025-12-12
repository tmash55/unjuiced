import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Defense vs Position - NBA DvP Rankings | Team Defensive Analysis',
  description:
    'Analyze NBA team defensive rankings by position (DvP). Find favorable matchups, identify betting edges, and understand how teams defend each position.',
  keywords: [
    'NBA DvP',
    'Defense vs Position',
    'NBA defensive rankings',
    'NBA matchup analysis',
    'basketball defense stats',
    'NBA position defense',
    'NBA betting edges',
    'DvP rankings',
    'NBA team defense',
    'player matchups',
  ],
  openGraph: {
    title: 'Defense vs Position - NBA DvP Rankings',
    description:
      'NBA team defensive rankings by position. Find favorable matchups and betting edges with detailed DvP analysis.',
    type: 'website',
    url: 'https://unjuiced.io/stats/nba/defense-vs-position',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Defense vs Position - NBA DvP Rankings',
    description:
      'NBA team defensive rankings by position. Find favorable matchups and betting edges.',
  },
  alternates: {
    canonical: 'https://unjuiced.io/stats/nba/defense-vs-position',
  },
};

export default function DefenseVsPositionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

