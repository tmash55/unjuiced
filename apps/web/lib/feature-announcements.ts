export interface FeatureAnnouncement {
  id: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  ctaHref?: string;
  ctaLabel?: string;
  badge?: string;
  bullets?: string[];
  enabled?: boolean;
}

// Ordered newest-first. Add new announcements to the top.
export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  {
    id: "triple-double-sheet-2026-02",
    title: "New: Triple Double Sheet",
    description: "Compare SGP (R+A / P+R+A) pricing against triple-double odds in one view.",
    imageSrc: "/TD_announcement.png",
    imageAlt: "Triple Double Sheet announcement",
    ctaHref: "/cheatsheets/nba/triple-double-sheet",
    ctaLabel: "Open Triple Double Sheet",
    badge: "NEW",
    bullets: [
      "Best available book and price surfaced per column",
      "Direct deep links to the selected sportsbook",
      "Built to quickly spot SGP vs TD pricing gaps",
    ],
    enabled: true,
  },
];

export function getActiveFeatureAnnouncements(): FeatureAnnouncement[] {
  return FEATURE_ANNOUNCEMENTS.filter((item) => item.enabled !== false);
}
