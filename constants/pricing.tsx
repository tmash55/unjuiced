import { CheckIcon } from "@/icons/card-icons";
import { CloseIcon } from "@/icons/general";

export enum TierName {
  FREE = "Free",
  PRO = "Pro",
}

export const tiers = [
  {
    title: TierName.FREE,
    subtitle: "For casual bettors",
    monthly: 0,
    yearly: 0,
    ctaText: "Get Started",
    ctaLink: "/register",
    features: [
      "20+ sportsbooks",
      "Basic odds comparison",
      "Manual refresh",
      "Standard support",
      "Limited arbitrage detection",
      "View main lines only",
    ],
  },
  {
    title: TierName.PRO,
    subtitle: "For serious bettors",
    monthly: 29,
    yearly: 290,
    ctaText: "Start Free Trial",
    ctaLink: "/register",
    features: [
      "Everything in Free",
      "Real-time odds updates (sub-2s)",
      "Auto-refresh with SSE",
      "Deep linking to sportsbooks",
      "Customizable odds screens",
      "Unlimited arbitrage detection",
      "Alternate lines & player props",
      "EV calculations & consensus pricing",
      "Priority support",
      "Advanced filters & sorting",
    ],
    featured: true,
    badge: "Most Popular",
  },
];

// Legacy pricing table - kept for backwards compatibility but not actively used
export const pricingTable: Array<{
  title: string;
  tiers: Array<{ title: TierName; value: string | React.ReactNode }>;
}> = [
  {
    title: "Sportsbooks",
    tiers: [
      {
        title: TierName.FREE,
        value: "20+",
      },
      {
        title: TierName.PRO,
        value: "20+",
      },
    ],
  },
  {
    title: "Two-factor authentication",
    tiers: [
      {
        title: TierName.FREE,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Pay-per-task billing",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Static IP",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Record Limit",
    tiers: [
      {
        title: TierName.FREE,
        value: "1,000",
      },
      {
        title: TierName.PRO,
        value: "10,000",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
  {
    title: "Folder Permissions",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Teams",
    tiers: [
      {
        title: TierName.FREE,
        value: "1",
      },
      {
        title: TierName.PRO,
        value: "3",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
  {
    title: "Shared Nodes",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Shared app connections",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Agents",
    tiers: [
      {
        title: TierName.FREE,
        value: "5",
      },
      {
        title: TierName.PRO,
        value: "25",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
  {
    title: "Chatbots",
    tiers: [
      {
        title: TierName.FREE,
        value: "2",
      },
      {
        title: TierName.PRO,
        value: "10",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
  {
    title: "Nodus MCP",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Nodus Canvas",
    tiers: [
      {
        title: TierName.FREE,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.PRO,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Tables",
    tiers: [
      {
        title: TierName.FREE,
        value: "5",
      },
      {
        title: TierName.PRO,
        value: "50",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
  {
    title: "Access Permissions",
    tiers: [
      {
        title: TierName.FREE,
        value: "Basic",
      },
      {
        title: TierName.PRO,
        value: "Advanced",
      },
      {
        title: TierName.PRO,
        value: "Enterprise",
      },
    ],
  },
  {
    title: "Record Templates",
    tiers: [
      {
        title: TierName.FREE,
        value: "10",
      },
      {
        title: TierName.PRO,
        value: "100",
      },
      {
        title: TierName.PRO,
        value: "Unlimited",
      },
    ],
  },
];
