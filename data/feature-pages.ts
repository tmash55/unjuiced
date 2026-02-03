export type FeaturePage = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  screenshot?: string;
  category?: string;
  badge?: string;
  accentColor?: string;
  toolPath: string;
  benefits: string[];
  features: {
    title: string;
    description: string;
  }[];
  steps: {
    title: string;
    description: string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
  seo: {
    title: string;
    description: string;
  };
};

export const featurePages: FeaturePage[] = [
  {
    slug: "hit-rates",
    title: "Hit Rates",
    tagline: "Player prop analysis with historical performance data",
    description:
      "Make smarter player prop bets with L5, L10, L20, and season hit rates. Compare matchups, review game logs, and spot consistent performers faster.",
    category: "Player Props",
    badge: "NEW",
    accentColor: "#10b981",
    toolPath: "/hit-rates/nba",
    benefits: ["L5/L10/L20 data", "Game log context", "Matchup insights"],
    features: [
      {
        title: "Historical hit rates",
        description:
          "See L5, L10, L20, and season hit rates for every player prop to understand consistency at a glance.",
      },
      {
        title: "Game log analysis",
        description:
          "Review game-by-game performance to see why a player hit or missed their line.",
      },
      {
        title: "Matchup insights",
        description:
          "Defense vs position rankings highlight favorable matchups before you place a bet.",
      },
      {
        title: "Hit streaks",
        description:
          "Track current hit and miss streaks to identify hot and cold runs.",
      },
      {
        title: "Market coverage",
        description:
          "Points, rebounds, assists, 3-pointers, steals, blocks, and combo props.",
      },
      {
        title: "Player profiles",
        description:
          "Deep dive into any player with comprehensive stats and recent performance charts.",
      },
    ],
    steps: [
      {
        title: "Pick a player and market",
        description:
          "Start with the player prop you want to evaluate and instantly see historical hit rates.",
      },
      {
        title: "Validate with context",
        description:
          "Review game logs, opponent DvP data, and streaks to confirm the spot.",
      },
      {
        title: "Place with confidence",
        description:
          "Use the data to size your bet and build smarter slips.",
      },
    ],
    faqs: [
      {
        question: "How far back do hit rates go?",
        answer:
          "You get L5, L10, L20, and full season hit rates so you can compare short-term form vs. long-term trends.",
      },
      {
        question: "Do you include matchup context?",
        answer:
          "Yes. Defense vs position rankings and recent game logs are built into the tool.",
      },
      {
        question: "Can I use it for combo props?",
        answer:
          "Yep. Combo markets like points + rebounds + assists are supported.",
      },
    ],
    seo: {
      title: "Hit Rates | Unjuiced - Player Prop Hit Rate Analysis",
      description:
        "Analyze player prop hit rates with L5, L10, L20, and season data. Find consistent performers and matchup-based edges.",
    },
  },
  {
    slug: "edge-finder",
    title: "Edge Finder",
    tagline: "Spot soft lines and value before the market moves",
    description:
      "Compare sportsbook lines to projected odds and uncover edges worth betting. Prioritize the best value with fast filters and sharp alerts.",
    category: "Sharp Tools",
    accentColor: "#0ea5e9",
    toolPath: "/edge-finder/nba",
    benefits: ["Soft line detection", "Market comparison", "Fast filters"],
    features: [
      {
        title: "Line comparison",
        description:
          "See how each book stacks up against fair odds so you can spot value instantly.",
      },
      {
        title: "Edge ranking",
        description:
          "Sort and filter by edge percentage to focus on the highest EV bets.",
      },
      {
        title: "Book coverage",
        description:
          "Track multiple sportsbooks at once and find the best price.",
      },
      {
        title: "Market filters",
        description:
          "Filter by sport, league, market, and book to narrow the board quickly.",
      },
      {
        title: "Sharp alerts",
        description:
          "Catch lines that move fast and get in before the market corrects.",
      },
      {
        title: "Save your edges",
        description:
          "Favorite the best plays so you can revisit them later.",
      },
    ],
    steps: [
      {
        title: "Scan the board",
        description:
          "View all current markets and instantly see which lines are soft.",
      },
      {
        title: "Filter to your edge",
        description:
          "Use filters to isolate the best bets that match your strategy.",
      },
      {
        title: "Lock in value",
        description:
          "Place the bet before the line corrects or the edge disappears.",
      },
    ],
    faqs: [
      {
        question: "What is an edge?",
        answer:
          "An edge is when a sportsbook line differs from fair odds enough to create expected value.",
      },
      {
        question: "How often do lines update?",
        answer:
          "Odds refresh frequently so you can react to market moves quickly.",
      },
      {
        question: "Can I focus on specific books?",
        answer:
          "Yes. Filter by sportsbook to see the best price at your preferred book.",
      },
    ],
    seo: {
      title: "Edge Finder | Unjuiced - Find Soft Lines Fast",
      description:
        "Compare sportsbook lines to fair odds and identify the best betting edges before the market moves.",
    },
  },
  {
    slug: "positive-ev",
    title: "Positive EV",
    tagline: "Find +EV bets with the best long-term value",
    description:
      "Identify positive expected value bets across books and markets. Focus on high-confidence plays backed by true odds.",
    category: "Sharp Tools",
    accentColor: "#f97316",
    toolPath: "/positive-ev/nba",
    benefits: ["True odds modeling", "EV ranking", "Book filters"],
    features: [
      {
        title: "True odds modeling",
        description:
          "See the fair odds behind each market to evaluate real value.",
      },
      {
        title: "EV ranking",
        description:
          "Sort by expected value to focus on the strongest opportunities.",
      },
      {
        title: "Market coverage",
        description:
          "Props, totals, spreads, and more across top leagues.",
      },
      {
        title: "Confidence filters",
        description:
          "Focus on plays that match your EV thresholds and risk profile.",
      },
      {
        title: "Best book price",
        description:
          "Find the sportsbook offering the most favorable line for each bet.",
      },
      {
        title: "Track favorites",
        description:
          "Save your best +EV plays for later review.",
      },
    ],
    steps: [
      {
        title: "Review +EV plays",
        description:
          "Browse a live list of bets with positive expected value.",
      },
      {
        title: "Validate confidence",
        description:
          "Check true odds and filters to confirm the edge.",
      },
      {
        title: "Place at the best book",
        description:
          "Select the sportsbook with the strongest line and lock it in.",
      },
    ],
    faqs: [
      {
        question: "What makes a bet +EV?",
        answer:
          "A bet is +EV when the sportsbook price is better than the true odds estimate.",
      },
      {
        question: "Can I set minimum EV thresholds?",
        answer:
          "Yes. Use filters to focus on the EV ranges that match your strategy.",
      },
      {
        question: "Do you show the best sportsbook?",
        answer:
          "Yes. We surface the most favorable line across supported books.",
      },
    ],
    seo: {
      title: "Positive EV | Unjuiced - Find +EV Bets",
      description:
        "Identify positive expected value bets with true odds modeling, filters, and best-book pricing.",
    },
  },
  {
    slug: "arbitrage",
    title: "Arbitrage",
    tagline: "Lock in risk-free opportunities across sportsbooks",
    description:
      "Identify arbitrage opportunities by comparing lines across books. Capture guaranteed profit when the market misprices outcomes.",
    category: "Sharp Tools",
    accentColor: "#6366f1",
    toolPath: "/arbitrage/nba",
    benefits: ["Arb percentage", "Multi-book coverage", "Fast refresh"],
    features: [
      {
        title: "Arb scanner",
        description:
          "Find arbitrage opportunities across books in real time.",
      },
      {
        title: "Profit percentage",
        description:
          "See the exact arb percentage so you can prioritize the best returns.",
      },
      {
        title: "Multi-book coverage",
        description:
          "Compare odds across major sportsbooks to spot mispriced outcomes.",
      },
      {
        title: "Market filters",
        description:
          "Filter by league, sport, market, and book to move quickly.",
      },
      {
        title: "Fast refresh",
        description:
          "Stay ahead of line moves with frequent data updates.",
      },
      {
        title: "Save opportunities",
        description:
          "Bookmark arbs so you can return to them before they disappear.",
      },
    ],
    steps: [
      {
        title: "Scan for arbs",
        description:
          "View a live board of arbitrage opportunities across books.",
      },
      {
        title: "Confirm profit",
        description:
          "Validate the arb percentage and stake sizing before placing bets.",
      },
      {
        title: "Place both sides",
        description:
          "Lock in the bet on two books to secure the guaranteed edge.",
      },
    ],
    faqs: [
      {
        question: "Is arbitrage risk-free?",
        answer:
          "Arbitrage can be risk-free when both sides are placed at the listed lines before they move.",
      },
      {
        question: "How fast do arbs disappear?",
        answer:
          "Some opportunities move quickly, so faster execution improves success rate.",
      },
      {
        question: "Do you calculate stake sizing?",
        answer:
          "We show the profit percentage so you can size stakes correctly.",
      },
    ],
    seo: {
      title: "Arbitrage | Unjuiced - Risk-Free Opportunities",
      description:
        "Find real-time arbitrage opportunities across sportsbooks and lock in guaranteed profit.",
    },
  },
  {
    slug: "odds-screen",
    title: "Odds Screen",
    tagline: "Track markets across books in one clean view",
    description:
      "Monitor odds across multiple sportsbooks in real time. Compare prices, spot movement, and find the best lines fast.",
    screenshot: "/landing-page/odds-screen.png",
    category: "Markets",
    accentColor: "#38bdf8",
    toolPath: "/odds",
    benefits: ["Multi-book view", "Line movement", "Best price"],
    features: [
      {
        title: "Multi-book odds",
        description:
          "See prices from all major books in a single table.",
      },
      {
        title: "Line movement",
        description:
          "Track line changes to catch market shifts early.",
      },
      {
        title: "Best price highlight",
        description:
          "Instantly spot the most favorable line for each market.",
      },
      {
        title: "Market filters",
        description:
          "Filter by league, sport, market type, and book.",
      },
      {
        title: "Clean layout",
        description:
          "Compact, readable tables built for fast scanning.",
      },
      {
        title: "Favorites",
        description:
          "Save the markets you track most often.",
      },
    ],
    steps: [
      {
        title: "Open a market",
        description:
          "Choose the sport or league you want to monitor.",
      },
      {
        title: "Compare books",
        description:
          "See the best price across books and track movement over time.",
      },
      {
        title: "Place with confidence",
        description:
          "Lock in the strongest line when you are ready to bet.",
      },
    ],
    faqs: [
      {
        question: "Which sportsbooks are included?",
        answer:
          "We cover major regulated sportsbooks and keep odds updated throughout the day.",
      },
      {
        question: "How often do odds refresh?",
        answer:
          "Odds refresh frequently so you can stay on top of market movement.",
      },
      {
        question: "Can I track multiple markets at once?",
        answer:
          "Yes. The table view makes it easy to scan across multiple markets.",
      },
    ],
    seo: {
      title: "Odds Screen | Unjuiced - Live Sportsbook Odds",
      description:
        "Track live sportsbook odds across books in one clean view and find the best lines fast.",
    },
  },
];

export function getFeatureBySlug(slug: string) {
  return featurePages.find((feature) => feature.slug === slug);
}
