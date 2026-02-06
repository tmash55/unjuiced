export type FeaturePage = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  screenshot?: string;
  heroImage?: string;
  mobileImage?: string;
  category?: string;
  badge?: string;
  accentColor?: string;
  toolPath: string;
  benefits: string[];
  features: {
    title: string;
    description: string;
    image?: string;
    isMobile?: boolean;
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
      "Make smarter player prop bets with L5, L10, L20, and season hit rates. Compare matchups, review game logs, and spot consistent performers faster. Save plays to My Slips and build SGP/SGP+ or normal parlays — then place them with one tap.",
    heroImage: "/landing-page/hit-rates-feature.png",
    mobileImage: "/landing-page/hr-mobile.png",
    category: "Player Props",
    accentColor: "#0EA5E9",
    toolPath: "/hit-rates/nba",
    benefits: ["L5/L10/L20 data", "Save to My Slips", "Build SGP & parlays"],
    features: [
      {
        title: "Hit rates & deep filters",
        description:
          "See L5, L10, L20, and season hit rates for every player prop, then drill into game logs with powerful filters to understand why a player hit or missed — surface great opportunities with deep stats at your fingertips.",
        image: "/landing-page/hit-rates-feature.png",
      },
      {
        title: "Matchup insights",
        description:
          "Defense vs position rankings highlight favorable matchups before you place a bet.",
        image: "/landing-page/hr-play-types.png",
      },
      {
        title: "Shooting zone breakdowns",
        description:
          "Visualize where players score against each opponent with shot zone heat maps and percentile ranks.",
        image: "/landing-page/hr-defensive-analysis.png",
      },
      {
        title: "Play type analysis",
        description:
          "See how players score by play type — PNR, transition, isolation, spot up — and how the opponent defends each.",
        image: "/landing-page/hr-shooting-zones.png",
      },
      {
        title: "Teammate correlations",
        description:
          "Discover which teammates' props hit together. See hot, warm, and cold correlation data across sample sizes.",
        image: "/landing-page/hr-correlations.png",
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
        title: "Save & place",
        description:
          "Save plays to My Slips, build SGP/SGP+ or normal parlays, and place bets directly at your sportsbook with one tap.",
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
          "Yes. Defense vs position rankings and recent game logs are built into the tool so you can see how a player performs against specific opponents.",
      },
      {
        question: "Can I use it for combo props?",
        answer:
          "Yep. Combo markets like points + rebounds + assists are supported.",
      },
      {
        question: "What are shooting zones?",
        answer:
          "Shooting zones break down where a player scores on the court — paint, mid-range, three-point corners, above the break — with percentile rankings against each opponent so you can spot favorable matchups at a glance.",
      },
      {
        question: "How do teammate correlations work?",
        answer:
          "We track how often teammates' props hit together across recent games. You'll see hot, warm, and cold correlation tags so you can build smarter same-game parlays with props that actually move together.",
      },
      {
        question: "What does Defense vs Position show?",
        answer:
          "It ranks every team's defense by position across stats like points, rebounds, assists, threes, and more. Use it to quickly find soft matchups where a player is likely to exceed their line.",
      },
      {
        question: "What play types are tracked?",
        answer:
          "We cover PNR ball handler, transition, isolation, spot up, handoff, off screen, post up, cuts, and more — along with how the opponent ranks defensively against each play type.",
      },
      {
        question: "Can I save plays and build parlays?",
        answer:
          "Yes. Save any play to My Slips, then build SGP, SGP+, or normal parlays and place them directly at your sportsbook through deeplinks — all without leaving the tool.",
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
    tagline: "Find soft lines and outlier odds on one-way markets",
    description:
      "The Edge Finder surfaces soft odds and outlier lines — especially useful for longshot props and one-way markets like first TD scorer or goal scorer that don't offer both sides. Compare against market average, next best price, sharp books, or build custom weighted models. Set bankroll, Kelly criterion risk tolerance, and get recommended stake amounts. Available on Sharp and Elite plans.",
    heroImage: "/landing-page/ef-main.png",
    mobileImage: "/landing-page/ef-mobile.png",
    category: "Sharp & Elite",
    accentColor: "#0EA5E9",
    toolPath: "/edge-finder/nba",
    benefits: ["Custom models", "Kelly criterion stakes", "Sportsbook deeplinks"],
    features: [
      {
        title: "Spot soft lines & outlier odds",
        description:
          "Hundreds of opportunities ranked by edge percentage, updated in real time. See the best book, model price, fair odds, and recommended stake for every play. Particularly powerful for longshot and one-way markets like first TD, goal scorer, and player props that typically don't offer both sides of the bet.",
        image: "/landing-page/ef-main.png",
      },
      {
        title: "Compare against any benchmark",
        description:
          "Choose what you're comparing against — market average (averages all books), next best price, or specific sharp and retail books like Pinnacle, Circa, BetOnline, DraftKings, FanDuel, BetMGM, and more. Sharp plan users get access to all preset comparison models.",
        image: "/landing-page/ef-compare-against.png",
        isMobile: true,
      },
      {
        title: "Deep odds comparison",
        description:
          "Expand any edge to see a full odds comparison across every tracked sportsbook — best price, over and under lines, and deeplinks to place directly. Instantly see where the value is and which book to bet at.",
        image: "/landing-page/ef-expanded.png",
      },
      {
        title: "Custom models (Elite)",
        description:
          "Elite users can create custom edge-finding models with weighted book contributions, reference book selection, odds ranges, and sport/market filters. Use quick-start templates like Sharp Blend or Pinnacle Only, save favorites, and run multiple models at once to find edges others miss.",
        image: "/landing-page/ef-create-model.png",
      },
      {
        title: "Mobile edge finding",
        description:
          "Find and act on edges from anywhere. The mobile experience gives you the full Edge Finder — sort by edge %, apply filters, view recommended stakes, and place bets with deeplinks. Share plays with friends or your betting community in one tap.",
        image: "/landing-page/ef-mobile.png",
        isMobile: true,
      },
    ],
    steps: [
      {
        title: "Choose your model",
        description:
          "Pick a preset comparison (market average, sharp books, specific book) or create a custom weighted model on the Elite plan.",
      },
      {
        title: "Filter & research",
        description:
          "Set bankroll, Kelly criterion risk tolerance, and boost filters. Sort by edge % and expand any play to see odds across all books.",
      },
      {
        title: "Place & share",
        description:
          "Use deeplinks to bet at the best book, save to My Slips for parlay building, or share with friends and betting communities.",
      },
    ],
    faqs: [
      {
        question: "What is an edge?",
        answer:
          "An edge is when a sportsbook's odds are better than the fair price — meaning you have positive expected value on that bet over time.",
      },
      {
        question: "What's the difference between Sharp and Elite?",
        answer:
          "Sharp gives you access to all preset comparison models (market average, next best price, specific books). Elite unlocks custom models where you can set weighted book contributions, build your own benchmarks, and run multiple models simultaneously.",
      },
      {
        question: "What markets does Edge Finder work best for?",
        answer:
          "It's especially useful for longshot and one-way markets like first TD scorer, goal scorer, and player props where books don't always offer both sides — these markets tend to have the softest lines and biggest edges.",
      },
      {
        question: "How does Kelly criterion staking work?",
        answer:
          "Set your bankroll and risk tolerance, and the Edge Finder recommends a stake amount for each edge based on Kelly criterion — so you're sizing bets optimally based on your edge and confidence level.",
      },
      {
        question: "What is the boost filter?",
        answer:
          "If a sportsbook is offering a profit boost (e.g. 30%), toggle the boost filter and it will adjust the edge percentage and recommended stake to account for the boosted payout.",
      },
      {
        question: "Can I share edges with friends?",
        answer:
          "Yes. Share any play with friends or sports betting communities with one tap — on desktop or mobile.",
      },
      {
        question: "How often does the Edge Finder update?",
        answer:
          "Odds refresh in real time so you can catch edges before the market corrects. You'll see a timestamp showing when data was last updated.",
      },
      {
        question: "Can I save edges to My Slips?",
        answer:
          "Yes. Add any edge to My Slips to track it, build parlays, or place later through sportsbook deeplinks.",
      },
    ],
    seo: {
      title: "Edge Finder | Unjuiced - Find Soft Lines & Outlier Odds",
      description:
        "Find soft lines on longshot and one-way markets. Compare against market average, sharp books, or custom weighted models. Kelly criterion staking and sportsbook deeplinks.",
    },
  },
  {
    slug: "positive-ev",
    title: "Positive EV",
    tagline: "True devigging for mathematically +EV bets",
    description:
      "Find positive expected value bets using true devigging methods that require both sides of the market. We use Pinnacle as the default devig book, but Sharp users can switch to Circa, BetOnline, exchanges, prediction markets, or any sportsbook. Elite users can create custom weighted models. Set your bankroll, Kelly criterion risk tolerance, devig method, and boost filters — and get recommended stake amounts for every play.",
    heroImage: "/landing-page/ev-main.png",
    mobileImage: "/landing-page/ev-mobile.png",
    category: "Sharp & Elite",
    accentColor: "#0EA5E9",
    toolPath: "/positive-ev/nba",
    benefits: ["True devig methods", "Kelly criterion stakes", "Custom models (Elite)"],
    features: [
      {
        title: "True devigging with real fair odds",
        description:
          "Unlike the Edge Finder, Positive EV uses true devigging methods that require both sides of a bet to calculate fair odds. See every +EV opportunity ranked by EV %, with the best book, sharp price, fair odds, and a recommended stake based on your bankroll and risk tolerance. Save plays to My Slips or place directly through deeplinks.",
        image: "/landing-page/ev-main.png",
      },
      {
        title: "Advanced settings & filters",
        description:
          "Fine-tune everything — set min/max EV thresholds, choose between worst-case and best-case EV calculations, pick your devig method (Power, Multiplicative, Additive, Probit), set min books per side and min liquidity. Configure Kelly criterion with your bankroll and risk tolerance (10%, 25%, 50%, 100%, or custom) to get precise stake recommendations.",
        image: "/landing-page/ev-settings.png",
      },
      {
        title: "Full odds comparison",
        description:
          "Expand any play to see over and under odds across every tracked sportsbook. Instantly compare the best price, average, and each book's line — with limit alerts and line movement indicators so you can place at the right book at the right time.",
        image: "/landing-page/ev-expanded.png",
      },
      {
        title: "Custom models (Elite)",
        description:
          "Elite users can create custom +EV detection models — choose which sharp books to use as your fair-odds source, set weighted contributions, configure min books required, filter by sport and market, and name/color-code your models. Run presets like Pinnacle-only or build something completely custom.",
        image: "/landing-page/ev-create-model.png",
      },
      {
        title: "Mobile +EV finder",
        description:
          "Find and act on +EV plays from anywhere. The mobile experience shows every opportunity with EV %, recommended stakes, BET deeplinks, and full odds breakdowns by book. Switch between preset and custom models, apply boost filters, and share plays with your betting community.",
        image: "/landing-page/ev-mobile.png",
        isMobile: true,
      },
    ],
    steps: [
      {
        title: "Choose your devig source",
        description:
          "Use the default Pinnacle devig, switch to another sharp book on the Sharp plan, or create a custom weighted model on Elite.",
      },
      {
        title: "Configure & filter",
        description:
          "Set bankroll, Kelly criterion %, devig method, EV thresholds, liquidity minimums, and boost filters to match your strategy.",
      },
      {
        title: "Place & track",
        description:
          "Place at the best book through deeplinks, save to My Slips for parlay building, or share with friends.",
      },
    ],
    faqs: [
      {
        question: "What makes a bet +EV?",
        answer:
          "A bet is +EV when the sportsbook price is better than the true fair odds. We calculate fair odds by devigging both sides of the market from a sharp source like Pinnacle.",
      },
      {
        question: "How is this different from the Edge Finder?",
        answer:
          "The Edge Finder works on one-way markets (like first TD scorer) where only one side is offered. Positive EV requires both sides of a bet to mathematically devig and calculate true fair odds — giving you a more precise EV calculation for two-way markets.",
      },
      {
        question: "What devig methods are available?",
        answer:
          "We support Power, Multiplicative, Additive, and Probit devig methods. You can also choose between worst-case and best-case EV calculations depending on your risk preference.",
      },
      {
        question: "What's the difference between Sharp and Elite?",
        answer:
          "Sharp users can switch the devig source to any supported book, exchange, or prediction market and adjust all settings. Elite users additionally get custom weighted models where you set book contributions, min books required, and sport/market filters.",
      },
      {
        question: "How does Kelly criterion staking work?",
        answer:
          "Enter your bankroll and choose a Kelly percentage (10%, 25%, 50%, 100%, or custom). The tool calculates a recommended stake for each +EV play based on the size of your edge and your risk tolerance.",
      },
      {
        question: "What is the boost filter?",
        answer:
          "If a sportsbook offers a profit boost (e.g. 30%), enable the boost filter and it adjusts the EV % and recommended stake to account for the boosted payout — so you can see if a boosted bet is actually +EV.",
      },
      {
        question: "Can I save +EV plays to My Slips?",
        answer:
          "Yes. Add any +EV play to My Slips to track it, build parlays, or place later through sportsbook deeplinks.",
      },
      {
        question: "How often does Positive EV update?",
        answer:
          "Odds and EV calculations refresh in real time. Auto-refresh keeps the board current so you can catch +EV plays as soon as they appear.",
      },
    ],
    seo: {
      title: "Positive EV | Unjuiced - True Devig +EV Bet Finder",
      description:
        "Find mathematically +EV bets using true devigging methods. Pinnacle default, custom models, Kelly criterion staking, and sportsbook deeplinks.",
    },
  },
  {
    slug: "arbitrage",
    title: "Arbitrage",
    tagline: "Guaranteed profit from market discrepancies between books",
    description:
      "Find risk-free profits by spotting price discrepancies between two sportsbooks. Place bets on opposite sides of the same market — no matter the outcome, you're guaranteed profit. You win on one book and lose on the other, but the math ensures you come out ahead every time. Built for speed with one-click betting to open both sportsbooks simultaneously.",
    heroImage: "/landing-page/arb-main.png",
    mobileImage: "/landing-page/arb-mobile.png",
    category: "Sharp & Elite",
    accentColor: "#0EA5E9",
    toolPath: "/arbitrage/nba",
    benefits: ["Guaranteed profit", "One-click both books", "Auto stake sizing"],
    features: [
      {
        title: "Find guaranteed profit opportunities",
        description:
          "Scan for market discrepancies across sportsbooks in real time. Every opportunity shows the ROI %, both sides of the bet with odds and best book, and the exact profit you'll make. Pregame arbitrage is available on the Sharp plan, while Elite unlocks live arbs and auto-refresh to catch opportunities the moment they appear.",
        image: "/landing-page/arb-main.png",
      },
      {
        title: "Arb calculator & auto stake sizing",
        description:
          "Input your total bet size and the calculator automatically splits your stake across both books to maximize profit. See the exact odds, stake per side, total payout, profit amount, and ROI % — then use the deeplinks to open both sportsbooks and place instantly. Apply the calculated stakes to the full table with one click.",
        image: "/landing-page/arb-calculator.png",
      },
      {
        title: "Settings & filters",
        description:
          "Configure min/max ROI %, total stake amount, market types (player props and game lines), min liquidity, and which books to include. Filter by league and sportsbook to focus on the opportunities that match your setup.",
        image: "/landing-page/arb-settings.png",
      },
      {
        title: "Mobile arbitrage",
        description:
          "Execute arbs on the go with a mobile-first design. See every opportunity with ROI %, both sides with BET deeplinks, profit per play, and split bets — all optimized for fast execution from your phone. Toggle between pre-match and live arbs on the Elite plan.",
        image: "/landing-page/arb-mobile.png",
        isMobile: true,
      },
    ],
    steps: [
      {
        title: "Scan for arbs",
        description:
          "Browse a live board of arbitrage opportunities ranked by ROI %. Sharp gets pregame arbs, Elite gets live arbs with auto-refresh.",
      },
      {
        title: "Calculate your stakes",
        description:
          "Input your total bet size and the arb calculator splits it optimally across both books. See your exact profit before placing.",
      },
      {
        title: "Place both sides",
        description:
          "Use one-click deeplinks to open both sportsbooks simultaneously and place your bets before the lines move.",
      },
    ],
    faqs: [
      {
        question: "Is arbitrage really risk-free?",
        answer:
          "Yes — as long as both sides are placed at the listed lines before they move, your profit is guaranteed regardless of the outcome. Speed is key, which is why we built one-click betting to open both books at the same time.",
      },
      {
        question: "What's the difference between Sharp and Elite?",
        answer:
          "Sharp gives you access to pregame arbitrage opportunities. Elite unlocks live arbitrage (in-game arbs), auto-refresh so you catch opportunities instantly, and priority access to the fastest-moving markets.",
      },
      {
        question: "How does the arb calculator work?",
        answer:
          "Enter your total bet size ($100, $200, $300, $500, or custom) and the calculator tells you exactly how much to stake on each side at each book to guarantee profit. It shows the total payout, profit amount, and ROI %.",
      },
      {
        question: "How fast do arbs disappear?",
        answer:
          "Arbs can disappear in seconds as books adjust their lines. That's why we built one-click betting to open both sportsbooks simultaneously, and auto-refresh on Elite to catch new opportunities the moment they appear.",
      },
      {
        question: "Which sportsbooks are covered?",
        answer:
          "We track all major regulated sportsbooks. You can filter by book to focus only on the ones you have accounts with.",
      },
      {
        question: "Can I filter by market type?",
        answer:
          "Yes. Filter between player props and game lines, set min/max ROI %, total stake, min liquidity, and which leagues and books to include.",
      },
      {
        question: "Does arbitrage work on mobile?",
        answer:
          "Yes. The mobile experience is built for speed — see both sides with BET deeplinks, profit calculations, and split bet breakdowns all from your phone.",
      },
    ],
    seo: {
      title: "Arbitrage | Unjuiced - Risk-Free Guaranteed Profit",
      description:
        "Find risk-free arbitrage opportunities across sportsbooks. Auto stake sizing, one-click betting, and guaranteed profit from market discrepancies.",
    },
  },
  {
    slug: "odds-screen",
    title: "Odds Screen",
    tagline: "Free real-time odds comparison across 20+ sportsbooks",
    description:
      "Line shop like a pro with pregame and live odds that update in real time. Compare player props, game lines, and alternate lines across every major book. Customize your view by hiding books you don't use and reordering columns with drag and drop — then save plays to My Slips and place bets with one tap. Free for all users.",
    heroImage: "/landing-page/os-main.png",
    mobileImage: "/landing-page/os-mobile.png",
    category: "Free Tool",
    accentColor: "#0EA5E9",
    toolPath: "/odds",
    benefits: ["Free for everyone", "Live & pregame odds", "Save to My Slips"],
    features: [
      {
        title: "Pregame & live odds",
        description:
          "Compare real-time odds across 20+ sportsbooks for every game and player prop — pregame and live. Best prices are highlighted so you always know where to get the most value.",
        image: "/landing-page/os-main.png",
      },
      {
        title: "Alternate lines",
        description:
          "Expand any player prop to see alternate lines across every book. Find the exact threshold and price you want, then add it to My Slips to build SGP/SGP+ or normal parlays.",
        image: "/landing-page/os-alt-lines.png",
      },
      {
        title: "Player profiles",
        description:
          "Tap any player to see a quick-glance profile with hit rates, game logs, matchup data, and play style breakdowns pulled from our Hit Rate tool. Expand to view their full profile in a new tab. Currently available for NBA with more sports coming soon.",
        image: "/landing-page/os-player-profile.png",
      },
      {
        title: "Mobile-first design",
        description:
          "Odds screens are notoriously hard to use on mobile. Our responsive design lets you quickly find and compare odds on any device — swipe between books, filter by market, and place bets without pinching and zooming.",
        image: "/landing-page/os-mobile.png",
        isMobile: true,
      },
    ],
    steps: [
      {
        title: "Pick a sport & market",
        description:
          "Choose from NBA, NFL, NHL, NCAAB and more. Toggle between game lines and player props.",
      },
      {
        title: "Compare & research",
        description:
          "See odds across every book, explore alternate lines, and tap into player profiles for deeper context.",
      },
      {
        title: "Save & place",
        description:
          "Add plays to My Slips, build SGP/SGP+ or normal parlays, and place bets at your sportsbook with one tap.",
      },
    ],
    faqs: [
      {
        question: "Is the Odds Screen free?",
        answer:
          "Yes. The Odds Screen is completely free for all users — no subscription or trial required.",
      },
      {
        question: "Which sportsbooks are included?",
        answer:
          "We cover 20+ major regulated sportsbooks including DraftKings, FanDuel, BetMGM, Caesars, BetRivers, Fanatics, and many more.",
      },
      {
        question: "Do you have live odds?",
        answer:
          "Yes. Toggle between pregame and live odds — both update in real time so you can line shop during games.",
      },
      {
        question: "What are alternate lines?",
        answer:
          "Alternate lines let you see every available threshold for a player prop (e.g. points from 9.5 to 23.5) with odds from each book, so you can find the exact line and price you want.",
      },
      {
        question: "How do player profiles work?",
        answer:
          "Click any player to see a quick profile with season averages, hit rates, game logs, and matchup data. You can expand to their full Hit Rate profile in a new tab for deeper research. Currently available for NBA.",
      },
      {
        question: "Can I use the Odds Screen on mobile?",
        answer:
          "Absolutely. We built a responsive mobile experience from the ground up so you can compare odds, browse alternate lines, and save plays on any device.",
      },
      {
        question: "Can I save plays from the Odds Screen?",
        answer:
          "Yes. Add any player prop or game line to My Slips, then build SGP, SGP+, or normal parlays and place them through sportsbook deeplinks.",
      },
      {
        question: "Can I customize the Odds Screen?",
        answer:
          "Yes. Hide sportsbooks you don't use, drag and drop columns to reorder them, and set your preferred layout. Your customizations are saved so the screen is ready to go every time you come back.",
      },
    ],
    seo: {
      title: "Odds Screen | Unjuiced - Free Real-Time Odds Comparison",
      description:
        "Compare live and pregame odds across 20+ sportsbooks for free. Line shop player props, explore alternate lines, and place bets with one tap.",
    },
  },
  {
    slug: "cheat-sheets",
    title: "Cheat Sheets",
    tagline: "Pre-built research pages for every game on the slate",
    description:
      "Four powerful cheat sheets to research today's slate — hit rates, injury impact, hit rate matrix, and defense vs position. Save plays to My Slips, build SGP/SGP+ or normal parlays, and place bets with one tap through deeplinks.",
    heroImage: "/landing-page/cs-hit-rate.png",
    mobileImage: "/landing-page/cs-mobile.png",
    category: "Research",
    accentColor: "#0EA5E9",
    toolPath: "/cheatsheets/nba/props",
    benefits: ["4 cheat sheets", "Save to My Slips", "Build SGP & parlays"],
    features: [
      {
        title: "Hit Rate Cheat Sheet",
        description:
          "Quick research on today's slate — see who's been hitting consistently, their confidence grades, DvP rankings, L5/L10/L20 hit rates, and live odds. Filter and sort by market, time window, grade, or DvP to find the best plays fast. Save any play to My Slips or build SGP/SGP+ parlays with one tap.",
        image: "/landing-page/cs-hit-rate.png",
      },
      {
        title: "Injury Impact",
        description:
          "See how players perform when a teammate is out. When injuries hit, props shift — this sheet shows you exactly how missing players affect usage, minutes, and stat lines so you can capitalize on lineup changes before the market catches up.",
        image: "/landing-page/cs-injury-impact.png",
      },
      {
        title: "Hit Rate Matrix",
        description:
          "View every player on today's slate and their hit rates across a wide scope — from 5 points to 50+ points in 5-point increments with live odds. Spot the sweet spot where a player is consistently clearing thresholds and find the best value at every line.",
        image: "/landing-page/cs-hit-rate-matrix.png",
      },
      {
        title: "Defense vs Position",
        description:
          "A free cheat sheet showing how every team defends each position. See rankings across FG%, 3P%, rebounds, assists, steals, blocks, and more — with toggles for basic, advanced, and trend views so you can spot soft matchups instantly.",
        image: "/landing-page/cs-dvp.png",
      },
    ],
    steps: [
      {
        title: "Pick a cheat sheet",
        description:
          "Choose from Hit Rate, Injury Impact, Hit Rate Matrix, or Defense vs Position to start your research.",
      },
      {
        title: "Filter & research",
        description:
          "Use filters for markets, time windows, grades, and positions to narrow down the best opportunities on today's slate.",
      },
      {
        title: "Save & place",
        description:
          "Save plays to My Slips, build SGP/SGP+ or normal parlays, and place bets directly through sportsbook deeplinks.",
      },
    ],
    faqs: [
      {
        question: "What sports are cheat sheets available for?",
        answer:
          "Cheat sheets are currently available for NBA with more sports being added regularly.",
      },
      {
        question: "How often are cheat sheets updated?",
        answer:
          "Cheat sheets are generated fresh for each game day with the latest data, odds, and injury reports.",
      },
      {
        question: "Is Defense vs Position free?",
        answer:
          "Yes. The Defense vs Position cheat sheet is completely free for all users — no subscription required.",
      },
      {
        question: "Can I build parlays from cheat sheets?",
        answer:
          "Absolutely. Save any play to My Slips, then build SGP, SGP+, or normal parlays and place them directly at your sportsbook through deeplinks.",
      },
      {
        question: "What does the Hit Rate Matrix show?",
        answer:
          "It displays every player on today's slate with their hit rates across all point thresholds (5, 10, 15, 20+ etc.) with live odds — so you can see at a glance where each player consistently clears lines.",
      },
      {
        question: "How does Injury Impact work?",
        answer:
          "When a player is ruled out, we show how their teammates' stats change — usage, minutes, key stats, and hit rates — so you can find boosted props before the market adjusts.",
      },
      {
        question: "Can I use cheat sheets on mobile?",
        answer:
          "Yes. Cheat sheets are fully responsive and work great on any device.",
      },
    ],
    seo: {
      title: "Cheat Sheets | Unjuiced - Game-Day Research Pages",
      description:
        "Four pre-built cheat sheets for every game day — hit rates, injury impact, hit rate matrix, and defense vs position. Save plays and build parlays.",
    },
  },
  {
    slug: "my-slips",
    title: "My Slips",
    tagline: "Track plays, compare parlay odds, and place bets across books",
    description:
      "Keep track of plays you like for today and upcoming games. Odds update in real time with a full comparison across every sportsbook for each saved selection. Create new slips and parlays from your selections, compare parlay odds across all books, and place bets directly through deeplinks.",
    heroImage: "/landing-page/slips-main.png",
    mobileImage: "/landing-page/slips-mobile.png",
    category: "All Plans",
    accentColor: "#0EA5E9",
    toolPath: "/my-slips",
    benefits: ["Real-time odds updates", "Parlay odds comparison", "Sportsbook deeplinks"],
    features: [
      {
        title: "Save & track plays with live odds",
        description:
          "Save any player prop or game line from any Unjuiced tool. Every saved selection shows real-time odds from all tracked sportsbooks with the best price highlighted — so you always know where to place your bet. Expand any play to see a full best-price-by-book breakdown with live odds and deeplinks.",
        image: "/landing-page/slips-main.png",
      },
      {
        title: "Create slips & organize plays",
        description:
          "Create new betslips to organize your plays — group by day, strategy, or sport. Add selections to existing slips or start fresh. Your slips stay organized so you can quickly find and manage your plays.",
        image: "/landing-page/slips-add-to-betslip.png",
      },
      {
        title: "Compare parlay odds across books",
        description:
          "Build parlays from your saved plays and instantly compare the combined odds across every sportsbook. See which book offers the best price for your exact combo — with deeplinks to place directly at DraftKings, FanDuel, theScore, and more.",
        image: "/landing-page/slips-parlay-compare.png",
        isMobile: true,
      },
      {
        title: "Full mobile experience",
        description:
          "Manage your slips on the go with a mobile-first design. Browse saved plays, view real-time odds comparisons, sort by edge, and place bets — all from your phone. Filter by best price, DraftKings, Bet365, or any book you use.",
        image: "/landing-page/slips-mobile.png",
        isMobile: true,
      },
    ],
    steps: [
      {
        title: "Save plays you like",
        description:
          "From any Unjuiced tool, tap save on any player prop or game line. It's added to My Slips with live odds tracking across all books.",
      },
      {
        title: "Build slips & parlays",
        description:
          "Organize plays into betslips, then combine selections into parlays. Compare parlay odds across every sportsbook instantly.",
      },
      {
        title: "Place at the best book",
        description:
          "Find the best price and tap the deeplink to open your sportsbook with your bet ready to confirm.",
      },
    ],
    faqs: [
      {
        question: "Which tools can I save plays from?",
        answer:
          "You can save plays from every Unjuiced tool — Hit Rates, Odds Screen, Cheat Sheets, Edge Finder, Positive EV, and Arbitrage.",
      },
      {
        question: "Do odds update in real time?",
        answer:
          "Yes. Every saved play shows live odds from all tracked sportsbooks so you always see the current best price without switching between apps.",
      },
      {
        question: "Can I compare parlay odds across sportsbooks?",
        answer:
          "Yes. Build a parlay from your saved plays and instantly see the combined odds at every book — so you can place at the one offering the best price.",
      },
      {
        question: "What sportsbooks support deeplinks?",
        answer:
          "We support deeplinks for DraftKings, FanDuel, theScore, and more. The list is always growing. For other books, you can copy your selections to place manually.",
      },
      {
        question: "Can I create multiple slips?",
        answer:
          "Yes. Create as many betslips as you want to organize plays by day, sport, strategy, or however you like to work.",
      },
      {
        question: "Is My Slips available on mobile?",
        answer:
          "Yes. My Slips is fully responsive with a mobile-first design — browse plays, compare odds, sort by edge, and place bets all from your phone.",
      },
      {
        question: "Do saved plays expire?",
        answer:
          "Plays are tied to game times. Once a game starts or ends, those plays are moved to your history so your active slip stays clean.",
      },
    ],
    seo: {
      title: "My Slips | Unjuiced - Track Plays & Compare Parlay Odds",
      description:
        "Save plays from any tool, track real-time odds across books, build parlays, compare prices, and place bets with sportsbook deeplinks.",
    },
  },
];

export function getFeatureBySlug(slug: string) {
  return featurePages.find((feature) => feature.slug === slug);
}
