// New sportsbook metadata structure
export type SportsbookId = string;

export interface SportsbookLink {
  desktop?: string;
  mobile?: string;
  deeplinkScheme?: string;
}

export interface SportsbookMeta {
  id: SportsbookId;
  name: string;
  sgp: boolean;
  legalStates: string[];
  links: SportsbookLink;
  image: {
    light: string;
    dark?: string;
    square?: string;
    long?: string;
  };
  brandColor?: string;
  priority?: number;
  affiliate?: boolean;
  affiliateLink?: string;
  requiresState?: boolean;
  isActive?: boolean;
  regions?: string[];
}

// Legacy interface for backward compatibility
export interface Sportsbook {
  id: string;
  name: string;
  logo: string;
  logo_long: string;
  regions?: string[];
  isActive?: boolean;
  url?: string;
  requiresState?: boolean;
  affiliate?: boolean;
  affiliateLink?: string;
  appLinkTemplate?: string;
}

// Import from the new structure
const SPORTSBOOKS_META: Record<SportsbookId, SportsbookMeta> = {
  "draftkings": {
    id: "draftkings",
    name: "DraftKings", 
    sgp: true,
    legalStates: ["AZ","CO","CT","IA","IL","IN","KS","KY","LA","MA","MD","MI","NJ","NY","OH","PA","TN","VA","WV","WY","NC"],
    links: {
      desktop: "https://sportsbook.draftkings.com/",
      mobile: "https://m.draftkings.com/sportsbook",
      deeplinkScheme: "dksb://sb/addselection_name/{sid}"
    },
    image: {
      light: "/images/sports-books/draftkings.png",
      long: "/images/sports-books/draftkings_long.png"
    },
    brandColor: "#046A38",
    priority: 10,
    isActive: true,
    requiresState: false
  },
  
  "fanduel": {
    id: "fanduel",
    name: "FanDuel",
    sgp: true,
    legalStates: ["AZ","CO","CT","IA","IL","IN","KS","KY","LA","MA","MD","MI","NJ","NY","OH","PA","TN","VA","WV","WY"],
    links: {
      desktop: "https://sportsbook.fanduel.com/",
      mobile: "https://m.fanduel.com/sportsbook"
    },
    image: {
      light: "/images/sports-books/fanduel.png",
      long: "/images/sports-books/fanduel_long.png"
    },
    brandColor: "#1E3A8A",
    priority: 9,
    isActive: true,
    requiresState: false
  },

  "betmgm": {
    id: "betmgm", 
    name: "BetMGM",
    sgp: true,
    legalStates: ["AZ","CO","DC","IA","IL","IN","KS","KY","LA","MA","MD","MI","NJ","NV","NY","OH","PA","TN","VA","WV","WY"],
    links: {
      desktop: "https://sports.{state}.betmgm.com/en/sports",
      mobile: "https://sports.{state}.betmgm.com/en/sports"
    },
    image: {
      light: "/images/sports-books/betmgm.png",
      long: "/images/sports-books/betmgm_long.png"
    },
    brandColor: "#FFD700",
    priority: 8,
    isActive: true,
    requiresState: true
  },

  "betrivers": {
    id: "betrivers",
    name: "BetRivers", 
    sgp: false,
    legalStates: ["AZ","CO","IL","IN","IA","LA","MD","MI","NJ","NY","OH","PA","VA","WV"],
    links: {
      desktop: "https://www.betrivers.com/",
      mobile: "https://www.betrivers.com/"
    },
    image: {
      light: "/images/sports-books/betrivers.png",
      long: "/images/sports-books/betrivers_long.png"
    },
    priority: 7,
    isActive: true,
    requiresState: true
  },

  "caesars": {
    id: "caesars",
    name: "Caesars",
    sgp: true, 
    legalStates: ["AZ","CO","IA","IL","IN","KS","LA","MD","MI","NJ","NY","OH","PA","TN","VA","WV","WY"],
    links: {
      desktop: "https://www.caesars.com/sportsbook/",
      mobile: "https://www.caesars.com/sportsbook/"
    },
    image: {
      light: "/images/sports-books/caesars.png",
      long: "/images/sports-books/caesars_long.png"
    },
    brandColor: "#FFD700",
    priority: 6,
    isActive: true,
    requiresState: false
  },

  

  "espn": {
    id: "espn",
    name: "ESPN BET",
    sgp: true,
    legalStates: ["AZ","CO","IL","IN","IA","KS","KY","LA","MA","MD","MI","NJ","NY","OH","PA","TN","VA","WV"],
    links: {
      desktop: "https://espnbet.com/",
      mobile: "https://espnbet.com/"
    },
    image: {
      light: "/images/sports-books/espnbet.png", 
      long: "/images/sports-books/espnbet_long.png"
    },
    brandColor: "#FF0000",
    priority: 4,
    isActive: true,
    requiresState: false
  },

  

  "fanatics": {
    id: "fanatics",
    name: "Fanatics",
    sgp: false,
    legalStates: ["AZ","CO","IL","IN","IA","KS","KY","LA","MA","MD","MI","NJ","NY","OH","PA","TN","VA","WV"],
    links: {
      desktop: "https://sportsbook.fanatics.com/",
      mobile: "https://sportsbook.fanatics.com/"
    },
    image: {
      light: "/images/sports-books/fanatics.png",
      long: "/images/sports-books/fanatics_long.png"
    },
    priority: 3,
    isActive: true,
    requiresState: false
  },

  "hard-rock": {
    id: "hard-rock",
    name: "Hard Rock",
    sgp: true,
    legalStates: ["AZ","FL","IA","IL","IN","NJ","NY","OH","PA","TN","VA"],
    links: {
      desktop: "https://www.hardrock.bet/",
      mobile: "https://www.hardrock.bet/"
    },
    image: {
      light: "/images/sports-books/hardrockbet.png",
      long: "/images/sports-books/hardrockbet_long.png"
    },
    priority: 2,
    isActive: true,
    requiresState: true
  },

  "hard-rock-indiana": {
    id: "hard-rock-indiana",
    name: "Hard Rock (Indiana)", 
    sgp: true,
    legalStates: ["IN"],
    links: {
      desktop: "https://www.hardrock.bet/",
      mobile: "https://www.hardrock.bet/"
    },
    image: {
      light: "/images/sports-books/hardrockbet.png",
      long: "/images/sports-books/hardrockbet_long.png"
    },
    priority: 2,
    isActive: true,
    requiresState: true
  },


  "novig": {
    id: "novig",
    name: "Novig",
    sgp: false,
    legalStates: ["AZ","CO","CT","IL","IN","IA","KS","KY","LA","MA","MD","MI","NJ","NY","OH","PA","TN","VA","WV"],
    links: {
      desktop: "https://www.novig.us/",
      mobile: "https://www.novig.us/"
    },
    image: {
      light: "/images/sports-books/novig.png",
      long: "/images/sports-books/novig_long.png"
    },
    priority: 1,
    isActive: false,
    requiresState: false,
    affiliate: true,
    affiliateLink: "https://novig.onelink.me/JHQQ/qh47vqcj"
  },

  "betparx": {
    id: "betparx",
    name: "BetPARX",
    sgp: false,
    legalStates: ["NJ","PA"],
    links: {
      desktop: "https://www.betparx.com/",
      mobile: "https://www.betparx.com/"
    },
    image: {
      light: "/images/sports-books/betparx.png",
      long: "/images/sports-books/betparx_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  "bally-bet": {
    id: "bally-bet",
    name: "Bally Bet",
    sgp: false,
    legalStates: ["AZ","CO","IA","IL","IN","NY","VA"],
    links: {
      desktop: "https://www.ballybet.com/",
      mobile: "https://www.ballybet.com/"
    },
    image: {
      light: "/images/sports-books/ballybet.png",
      long: "/images/sports-books/ballybet_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  "bwin": {
    id: "bwin",
    name: "bwin",
    sgp: true,
    legalStates: ["NJ","PA","MI","WV"],
    links: {
      desktop: "https://www.bwin.com/",
      mobile: "https://www.bwin.com/"
    },
    image: {
      light: "/images/sports-books/bwin.png",
      long: "/images/sports-books/bwin_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  "circa": {
    id: "circa",
    name: "Circa",
    sgp: false,
    legalStates: ["NV","CO","IA","IL"],
    links: {
      desktop: "https://www.circa.com/",
      mobile: "https://www.circa.com/"
    },
    image: {
      light: "/images/sports-books/circa.png",
      long: "/images/sports-books/circa_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  "sports-interaction": {
    id: "sports-interaction",
    name: "Sports Interaction", 
    sgp: true,
    legalStates: ["ON"],
    links: {
      desktop: "https://www.sportsinteraction.com/",
      mobile: "https://www.sportsinteraction.com/"
    },
    image: {
      light: "/images/sports-books/sportsinteraction.png",
      long: "/images/sports-books/sportsinteraction_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  "thescore": {
    id: "thescore",
    name: "theScore",
    sgp: true,
    legalStates: ["ON"],
    links: {
      desktop: "https://www.thescore.com/",
      mobile: "https://www.thescore.com/"
    },
    image: {
      light: "/images/sports-books/thescore.png",
      long: "/images/sports-books/thescore_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },

  // Legacy entries for backward compatibility
  "prophetx": {
    id: "prophetx",
    name: "Prophetx",
    sgp: false,
    legalStates: ["US"],
    links: {
      desktop: "https://www.getprophetx.co/",
      mobile: "https://www.getprophetx.co/"
    },
    image: {
      light: "/images/sports-books/prophetx.png",
      long: "/images/sports-books/prophetx_long.png"
    },
    priority: 1,
    isActive: false,
    requiresState: false
  },


  "fliff": {
    id: "fliff",
    name: "Fliff",
    sgp: false,
    legalStates: ["EU"],
    links: {
      desktop: "https://www.getfliff.com/",
      mobile: "https://www.getfliff.com/"
    },
    image: {
      light: "/images/sports-books/fliff.png",
      long: "/images/sports-books/fliff_long.png"
    },
    priority: 1,
    isActive: true,
    requiresState: false,
    regions: ["eu"]
  },

  "pinnacle": {
    id: "pinnacle",
    name: "Pinnacle",
    sgp: false,
    legalStates: ["EU"],
    links: {
      desktop: "https://www.pinnacle.com/en/",
      mobile: "https://www.pinnacle.com/en/"
    },
    image: {
      light: "/images/sports-books/pinnacle.png",
      long: "/images/sports-books/pinnacle_long.png"
    },
    priority: 1,
    isActive: false,
    requiresState: false,
    regions: ["eu"]
  },

  "bet365": {
    id: "bet365",
    name: "Bet365",
    sgp: false,
    legalStates: ["US"],
    links: {
      desktop: "https://www.bet365.com/",
      mobile: "https://www.bet365.com/"
    },
    image: {
      light: "/images/sports-books/bet365.png",
      long: "/images/sports-books/bet365_long.png"
    },
    priority: 1,
    isActive: false,
    requiresState: false
  },

  "betonline": {
    id: "betonline",
    name: "BetOnline",
    sgp: false,
    legalStates: ["US"], // Available nationwide (offshore)
    links: {
      desktop: "https://www.betonline.ag/sportsbook",
      mobile: "https://www.betonline.ag/sportsbook"
    },
    image: {
      light: "/images/sports-books/betonline.png",
      long: "/images/sports-books/betonline_long.png"
    },
    brandColor: "#FF6B35",
    priority: 5,
    isActive: true,
    requiresState: false
  },
  "bovada": {
    id: "bovada",
    name: "Bovada",
    sgp: false,
    legalStates: ["US"],
    links: {
      desktop: "https://www.bovada.lv/",
      mobile: "https://www.bovada.lv/"
    },
    image: {
      light: "/images/sports-books/bovada.png",
      long: "/images/sports-books/bovada_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  },
  "bodog": {
    id: "bodog",
    name: "Bodog",
    sgp: false,
    legalStates: ["US"],
    links: {
      desktop: "https://www.bodog.lv/",
      mobile: "https://www.bodog.lv/"
    },
    image: {
      light: "/images/sports-books/bodog.png",
      long: "/images/sports-books/bodog_long.png"
    },
    priority: 5,
    isActive: true,
    requiresState: false
  }
};


// Convert to legacy format for backward compatibility
export const sportsbooks: Sportsbook[] = Object.values(SPORTSBOOKS_META).map(sb => ({
  id: sb.id,
  name: sb.name,
  logo: sb.image.light,
  logo_long: sb.image.long || sb.image.light,
  regions: sb.regions || (sb.legalStates.length > 0 ? ["us"] : []),
  isActive: sb.isActive,
  url: sb.links.desktop,
  requiresState: sb.requiresState,
  affiliate: sb.affiliate,
  affiliateLink: sb.affiliateLink,
  appLinkTemplate: sb.links.deeplinkScheme
}));

// Helper functions for the new structure
export function getSportsbookById(id: SportsbookId): SportsbookMeta | undefined {
  return SPORTSBOOKS_META[id];
}

export function getAllActiveSportsbooks(): SportsbookMeta[] {
  return Object.values(SPORTSBOOKS_META).filter(sb => sb.isActive);
}

export function getSportsbooksByState(state: string): SportsbookMeta[] {
  return Object.values(SPORTSBOOKS_META).filter(sb => 
    sb.isActive && sb.legalStates.includes(state.toUpperCase())
  );
}

// Export the structured data as well
export { SPORTSBOOKS_META as sportsbooksNew };