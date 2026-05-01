export interface FeatureAnnouncement {
  id: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  imageFit?: "cover" | "contain";
  imageHeightClass?: string;
  imageObjectPosition?: string;
  ctaHref?: string;
  ctaLabel?: string;
  badge?: string;
  bullets?: string[];
  enabled?: boolean;
}

// Ordered newest-first. Add new announcements to the top.
export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  {
    id: "sharp-intel-launch-2026-03",
    title: "New: Sharp Intel",
    description: "Real-time insider tracking from prediction markets — matched to the best legal sportsbook odds.",
    imageSrc: "/sharp-intel-announcement.png",
    imageAlt: "Sharp Intel — real-time insider tracking",
    imageFit: "cover",
    imageHeightClass: "h-52",
    imageObjectPosition: "top left",
    ctaHref: "/sharp-intel",
    ctaLabel: "Try Sharp Intel",
    badge: "NEW TOOL",
    bullets: [
      "Track 80+ of the sharpest Polymarket wallets in real time",
      "Every signal scored 0-100 based on history, bet size, and timing",
      "Live odds from 15+ legal US sportsbooks — matched to each signal",
      "Follow your favorite sharps and build a personalized feed",
      "65% win rate, +14% ROI across tracked consensus picks",
    ],
    enabled: true,
  },
  {
    id: "double-double-sheet-2026-03",
    title: "New: Double Double Sheet",
    description: "Compare SGP (P+R / P+R+A) pricing against double-double odds in one view.",
    imageSrc: "/DD_announcement.png",
    imageAlt: "Double Double Sheet announcement",
    imageFit: "cover",
    imageHeightClass: "h-44",
    imageObjectPosition: "center",
    ctaHref: "/cheatsheets/nba/double-double-sheet",
    ctaLabel: "Open Double Double Sheet",
    badge: "NEW",
    bullets: [
      "Best available book and price surfaced per column",
      "Direct deep links to the selected sportsbook",
      "Built to quickly spot SGP vs DD pricing gaps",
    ],
    enabled: true,
  },
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
