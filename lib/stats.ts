export const STAT_KEYS = [
  "nba-kotc",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STATS: {
  name: string;
  key: StatKey;
  description: string;
}[] = [
  {
    name: "NBA • King of the Court",
    key: "nba-kotc",
    description: "Live PRA leaderboard and betting odds",
  },
];

