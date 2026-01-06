// MLB Team Mappings
export const MLB_TEAM_MAP: Record<string, string> = {
    // American League
    LAA: "LAA", // Los Angeles Angels
    BAL: "BAL", // Baltimore Orioles
    BOS: "BOS", // Boston Red Sox
    CWS: "CHW", // Chicago White Sox
    CHW: "CHW", // Chicago White Sox (alternative)
    CLE: "CLE", // Cleveland Guardians
    DET: "DET", // Detroit Tigers
    HOU: "HOU", // Houston Astros
    KC: "KC", // Kansas City Royals
    MIN: "MIN", // Minnesota Twins
    NYY: "NYY", // New York Yankees
    OAK: "OAK", // Oakland Athletics
    A: "OAK", // Oakland Athletics (alternative)
    ATH: "OAK", // Oakland Athletics (alternative)
    Athletics: "OAK", // Oakland Athletics (full name)
    SEA: "SEA", // Seattle Mariners
    TB: "TB", // Tampa Bay Rays
    TEX: "TEX", // Texas Rangers
    TOR: "TOR", // Toronto Blue Jays
    // National League
    ARI: "AZ", // Arizona Diamondbacks
    ATL: "ATL", // Atlanta Braves
    CHC: "CHC", // Chicago Cubs
    CIN: "CIN", // Cincinnati Reds
    COL: "COL", // Colorado Rockies
    LAD: "LAD", // Los Angeles Dodgers
    MIA: "MIA", // Miami Marlins
    MIL: "MIL", // Milwaukee Brewers
    NYM: "NYM", // New York Mets
    PHI: "PHI", // Philadelphia Phillies
    PIT: "PIT", // Pittsburgh Pirates
    SD: "SD", // San Diego Padres
    SF: "SF", // San Francisco Giants
    STL: "STL", // St. Louis Cardinals
    WSH: "WSH", // Washington Nationals
  }
  
  export const teamAbbreviations: Record<string, string> = {
    "New York Yankees": "NYY",
    "New York Mets": "NYM",
    "Boston Red Sox": "BOS",
    "Los Angeles Dodgers": "LAD",
    "Los Angeles Angels": "LAA",
    "Chicago Cubs": "CHC",
    "Chicago White Sox": "CHW",
    "Milwaukee Brewers": "MIL",
    "Atlanta Braves": "ATL",
    "Houston Astros": "HOU",
    "Philadelphia Phillies": "PHI",
    "San Francisco Giants": "SF",
    "San Diego Padres": "SD",
    "Toronto Blue Jays": "TOR",
    "Texas Rangers": "TEX",
    "Cleveland Guardians": "CLE",
    "Detroit Tigers": "DET",
    "Minnesota Twins": "MIN",
    "Kansas City Royals": "KC",
    "Colorado Rockies": "COL",
    "Arizona Diamondbacks": "ARI",
    "Seattle Mariners": "SEA",
    "Tampa Bay Rays": "TB",
    "Miami Marlins": "MIA",
    "Baltimore Orioles": "BAL",
    "Washington Nationals": "WSH",
    "Pittsburgh Pirates": "PIT",
    "Cincinnati Reds": "CIN",
    "Oakland Athletics": "OAK",
    "St. Louis Cardinals": "STL",
  }
  
  export function getTeamAbbreviation(teamName: string): string {
    if (!teamName) return ""
    
    if (teamAbbreviations[teamName]) {
      return teamAbbreviations[teamName]
    }
  
    return teamName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
  }
  
  // NFL Team Mappings
  export const NFL_TEAM_MAP: Record<string, string> = {
    ARI: "ARI", // Arizona Cardinals
    ATL: "ATL", // Atlanta Falcons
    BAL: "BAL", // Baltimore Ravens
    BUF: "BUF", // Buffalo Bills
    CAR: "CAR", // Carolina Panthers
    CHI: "CHI", // Chicago Bears
    CIN: "CIN", // Cincinnati Bengals
    CLE: "CLE", // Cleveland Browns
    DAL: "DAL", // Dallas Cowboys
    DEN: "DEN", // Denver Broncos
    DET: "DET", // Detroit Lions
    GB: "GB",   // Green Bay Packers
    HOU: "HOU", // Houston Texans
    IND: "IND", // Indianapolis Colts
    JAX: "JAX", // Jacksonville Jaguars
    KC: "KC",   // Kansas City Chiefs
    LV: "LV",   // Las Vegas Raiders
    LAC: "LAC", // Los Angeles Chargers
    LAR: "LAR", // Los Angeles Rams
    LA: "LAR",  // Los Angeles Rams (alternative from Redis)
    MIA: "MIA", // Miami Dolphins
    MIN: "MIN", // Minnesota Vikings
    NE: "NE",   // New England Patriots
    NO: "NO",   // New Orleans Saints
    NYG: "NYG", // New York Giants
    NYJ: "NYJ", // New York Jets
    PHI: "PHI", // Philadelphia Eagles
    PIT: "PIT", // Pittsburgh Steelers
    SF: "SF",   // San Francisco 49ers
    SEA: "SEA", // Seattle Seahawks
    TB: "TB",   // Tampa Bay Buccaneers
    TEN: "TEN", // Tennessee Titans
    // Washington: logo files use WSH; accept both WAS and WSH inputs
    WAS: "WSH",
    WSH: "WSH"
  }
  
  // NHL Team Mappings
  export const NHL_TEAM_MAP: Record<string, string> = {
    // Eastern Conference - Atlantic Division
    BOS: "BOS", // Boston Bruins
    BUF: "BUF", // Buffalo Sabres
    DET: "DET", // Detroit Red Wings
    FLA: "FLA", // Florida Panthers
    MTL: "MTL", // Montreal Canadiens
    OTT: "OTT", // Ottawa Senators
    TB: "TB",   // Tampa Bay Lightning
    TOR: "TOR", // Toronto Maple Leafs
    // Eastern Conference - Metropolitan Division
    CAR: "CAR", // Carolina Hurricanes
    CBJ: "CBJ", // Columbus Blue Jackets
    NJ: "NJ",   // New Jersey Devils
    NYI: "NYI", // New York Islanders
    NYR: "NYR", // New York Rangers
    PHI: "PHI", // Philadelphia Flyers
    PIT: "PIT", // Pittsburgh Penguins
    WSH: "WSH", // Washington Capitals
    // Western Conference - Central Division
    ARI: "ARI", // Arizona Coyotes (relocated to Utah, may need updating)
    UTA: "UTA", // Utah Hockey Club
    CHI: "CHI", // Chicago Blackhawks
    COL: "COL", // Colorado Avalanche
    DAL: "DAL", // Dallas Stars
    MIN: "MIN", // Minnesota Wild
    NSH: "NSH", // Nashville Predators
    STL: "STL", // St. Louis Blues
    WPG: "WPG", // Winnipeg Jets
    // Western Conference - Pacific Division
    ANA: "ANA", // Anaheim Ducks
    CGY: "CGY", // Calgary Flames
    EDM: "EDM", // Edmonton Oilers
    LA: "LA",   // Los Angeles Kings
    LAK: "LA",  // Los Angeles Kings (alternative)
    SJ: "SJ",   // San Jose Sharks
    SEA: "SEA", // Seattle Kraken
    VAN: "VAN", // Vancouver Canucks
    VGK: "VGK", // Vegas Golden Knights
    LV: "VGK",  // Vegas Golden Knights (alternative)
  }
  
  // NBA Team Mappings
  export const NBA_TEAM_MAP: Record<string, string> = {
    ATL: "ATL", // Atlanta Hawks
    BKN: "BKN", // Brooklyn Nets
    BOS: "BOS", // Boston Celtics
    CHA: "CHA", // Charlotte Hornets
    CHI: "CHI", // Chicago Bulls
    CLE: "CLE", // Cleveland Cavaliers
    DAL: "DAL", // Dallas Mavericks
    DEN: "DEN", // Denver Nuggets
    DET: "DET", // Detroit Pistons
    GSW: "GSW", // Golden State Warriors
    HOU: "HOU", // Houston Rockets
    IND: "IND", // Indiana Pacers
    LAC: "LAC", // Los Angeles Clippers
    LAL: "LAL", // Los Angeles Lakers
    MEM: "MEM", // Memphis Grizzlies
    MIA: "MIA", // Miami Heat
    MIL: "MIL", // Milwaukee Bucks
    MIN: "MIN", // Minnesota Timberwolves
    NOP: "NOP", // New Orleans Pelicans
    NYK: "NYK", // New York Knicks
    OKC: "OKC", // Oklahoma City Thunder
    ORL: "ORL", // Orlando Magic
    PHI: "PHI", // Philadelphia 76ers
    PHX: "PHX", // Phoenix Suns
    POR: "POR", // Portland Trail Blazers
    SAC: "SAC", // Sacramento Kings
    SAS: "SAS", // San Antonio Spurs
    TOR: "TOR", // Toronto Raptors
    UTA: "UTA", // Utah Jazz
    WAS: "WAS", // Washington Wizards
  }
  
  // NBA Team IDs (database IDs) - maps abbreviation to official NBA team_id
  export const NBA_TEAM_IDS: Record<string, number> = {
    ATL: 1610612737, // Atlanta Hawks
    BOS: 1610612738, // Boston Celtics
    BKN: 1610612751, // Brooklyn Nets
    CHA: 1610612766, // Charlotte Hornets
    CHI: 1610612741, // Chicago Bulls
    CLE: 1610612739, // Cleveland Cavaliers
    DAL: 1610612742, // Dallas Mavericks
    DEN: 1610612743, // Denver Nuggets
    DET: 1610612765, // Detroit Pistons
    GSW: 1610612744, // Golden State Warriors
    HOU: 1610612745, // Houston Rockets
    IND: 1610612754, // Indiana Pacers
    LAC: 1610612746, // Los Angeles Clippers
    LAL: 1610612747, // Los Angeles Lakers
    MEM: 1610612763, // Memphis Grizzlies
    MIA: 1610612748, // Miami Heat
    MIL: 1610612749, // Milwaukee Bucks
    MIN: 1610612750, // Minnesota Timberwolves
    NOP: 1610612740, // New Orleans Pelicans
    NYK: 1610612752, // New York Knicks
    OKC: 1610612760, // Oklahoma City Thunder
    ORL: 1610612753, // Orlando Magic
    PHI: 1610612755, // Philadelphia 76ers
    PHX: 1610612756, // Phoenix Suns
    POR: 1610612757, // Portland Trail Blazers
    SAC: 1610612758, // Sacramento Kings
    SAS: 1610612759, // San Antonio Spurs
    TOR: 1610612761, // Toronto Raptors
    UTA: 1610612762, // Utah Jazz
    WAS: 1610612764, // Washington Wizards
  }
  
  // Helper to get NBA team ID from abbreviation
  export function getNBATeamId(abbr: string): number | null {
    if (!abbr) return null;
    return NBA_TEAM_IDS[abbr.toUpperCase()] ?? null;
  }

  // WNBA Team Mappings
  export const WNBA_TEAM_MAP: Record<string, string> = {
    ATL: "ATL", // Atlanta Dream
    CHI: "CHI", // Chicago Sky
    CON: "CTN", // Connecticut Sun (changed from CON due to Windows reserved name)
    DAL: "DAL", // Dallas Wings
    IND: "IND", // Indiana Fever
    LAS: "LAS", // Los Angeles Sparks
    LVA: "LVA", // Las Vegas Aces
    MIN: "MIN", // Minnesota Lynx
    NYL: "NYL", // New York Liberty
    PHO: "PHO", // Phoenix Mercury
    SEA: "SEA", // Seattle Storm
    WAS: "WAS"  // Washington Mystics
  }
  
  // Get team logo filename based on abbreviation and sport
  export function getTeamLogoFilename(abbr: string, sport: string = "baseball_mlb"): string {
    if (!abbr) return "default"
    const upperAbbr = abbr.toUpperCase()
    
    switch(sport) {
      case "football_nfl":
      case "nfl":
        return NFL_TEAM_MAP[upperAbbr] || upperAbbr
      case "icehockey_nhl":
      case "nhl":
        return NHL_TEAM_MAP[upperAbbr] || upperAbbr
      case "basketball_nba":
      case "nba":
        return NBA_TEAM_MAP[upperAbbr] || upperAbbr
      case "basketball_wnba":
        return WNBA_TEAM_MAP[upperAbbr] || upperAbbr
      case "baseball_mlb":
      case "mlb":
      default:
        return MLB_TEAM_MAP[upperAbbr] || upperAbbr
    }
  }
  
  // Get standardized team abbreviation
  export function getStandardAbbreviation(teamName: string, sport: string = "baseball_mlb"): string {
    if (!teamName) return ""
    
    // Normalize sport name - handle both 'mlb' and 'baseball_mlb'
    const normalizedSport = sport === "mlb" ? "baseball_mlb" : sport
    
    // First, check if it's a full team name
    const teamMaps: Record<string, Record<string, string>> = {
      baseball_mlb: {
        "Los Angeles Angels": "LAA",
        "Baltimore Orioles": "BAL",
        "Boston Red Sox": "BOS",
        "Chicago White Sox": "CHW",
        "Cleveland Guardians": "CLE",
        "Detroit Tigers": "DET",
        "Houston Astros": "HOU",
        "Kansas City Royals": "KC",
        "Minnesota Twins": "MIN",
        "New York Yankees": "NYY",
        "Oakland Athletics": "OAK",
        "Seattle Mariners": "SEA",
        "Tampa Bay Rays": "TB",
        "Texas Rangers": "TEX",
        "Toronto Blue Jays": "TOR",
        "Arizona Diamondbacks": "AZ",
        "Atlanta Braves": "ATL",
        "Chicago Cubs": "CHC",
        "Cincinnati Reds": "CIN",
        "Colorado Rockies": "COL",
        "Los Angeles Dodgers": "LAD",
        "Miami Marlins": "MIA",
        "Milwaukee Brewers": "MIL",
        "New York Mets": "NYM",
        "Philadelphia Phillies": "PHI",
        "Pittsburgh Pirates": "PIT",
        "San Diego Padres": "SD",
        "San Francisco Giants": "SF",
        "St. Louis Cardinals": "STL",
        "Washington Nationals": "WSH",
      },
      football_nfl: {
        "Arizona Cardinals": "ARI",
        "Atlanta Falcons": "ATL",
        "Baltimore Ravens": "BAL",
        "Buffalo Bills": "BUF",
        "Carolina Panthers": "CAR",
        "Chicago Bears": "CHI",
        "Cincinnati Bengals": "CIN",
        "Cleveland Browns": "CLE",
        "Dallas Cowboys": "DAL",
        "Denver Broncos": "DEN",
        "Detroit Lions": "DET",
        "Green Bay Packers": "GB",
        "Houston Texans": "HOU",
        "Indianapolis Colts": "IND",
        "Jacksonville Jaguars": "JAX",
        "Kansas City Chiefs": "KC",
        "Las Vegas Raiders": "LV",
        "Los Angeles Chargers": "LAC",
        "Los Angeles Rams": "LAR",
        "Miami Dolphins": "MIA",
        "Minnesota Vikings": "MIN",
        "New England Patriots": "NE",
        "New Orleans Saints": "NO",
        "New York Giants": "NYG",
        "New York Jets": "NYJ",
        "Philadelphia Eagles": "PHI",
        "Pittsburgh Steelers": "PIT",
        "San Francisco 49ers": "SF",
        "Seattle Seahawks": "SEA",
        "Tampa Bay Buccaneers": "TB",
        "Tennessee Titans": "TEN",
        "Washington Commanders": "WAS",
      },
      icehockey_nhl: {
        "Anaheim Ducks": "ANA",
        "Arizona Coyotes": "ARI",
        "Boston Bruins": "BOS",
        "Buffalo Sabres": "BUF",
        "Calgary Flames": "CGY",
        "Carolina Hurricanes": "CAR",
        "Chicago Blackhawks": "CHI",
        "Colorado Avalanche": "COL",
        "Columbus Blue Jackets": "CBJ",
        "Dallas Stars": "DAL",
        "Detroit Red Wings": "DET",
        "Edmonton Oilers": "EDM",
        "Florida Panthers": "FLA",
        "Los Angeles Kings": "LA",
        "Minnesota Wild": "MIN",
        "Montreal Canadiens": "MTL",
        "Nashville Predators": "NSH",
        "New Jersey Devils": "NJ",
        "New York Islanders": "NYI",
        "New York Rangers": "NYR",
        "Ottawa Senators": "OTT",
        "Philadelphia Flyers": "PHI",
        "Pittsburgh Penguins": "PIT",
        "San Jose Sharks": "SJ",
        "Seattle Kraken": "SEA",
        "St. Louis Blues": "STL",
        "Tampa Bay Lightning": "TB",
        "Toronto Maple Leafs": "TOR",
        "Utah Hockey Club": "UTA",
        "Vancouver Canucks": "VAN",
        "Vegas Golden Knights": "VGK",
        "Washington Capitals": "WSH",
        "Winnipeg Jets": "WPG",
      },
      nhl: { // Also support short 'nhl' key
        "Anaheim Ducks": "ANA",
        "Arizona Coyotes": "ARI",
        "Boston Bruins": "BOS",
        "Buffalo Sabres": "BUF",
        "Calgary Flames": "CGY",
        "Carolina Hurricanes": "CAR",
        "Chicago Blackhawks": "CHI",
        "Colorado Avalanche": "COL",
        "Columbus Blue Jackets": "CBJ",
        "Dallas Stars": "DAL",
        "Detroit Red Wings": "DET",
        "Edmonton Oilers": "EDM",
        "Florida Panthers": "FLA",
        "Los Angeles Kings": "LA",
        "Minnesota Wild": "MIN",
        "Montreal Canadiens": "MTL",
        "Nashville Predators": "NSH",
        "New Jersey Devils": "NJ",
        "New York Islanders": "NYI",
        "New York Rangers": "NYR",
        "Ottawa Senators": "OTT",
        "Philadelphia Flyers": "PHI",
        "Pittsburgh Penguins": "PIT",
        "San Jose Sharks": "SJ",
        "Seattle Kraken": "SEA",
        "St. Louis Blues": "STL",
        "Tampa Bay Lightning": "TB",
        "Toronto Maple Leafs": "TOR",
        "Utah Hockey Club": "UTA",
        "Vancouver Canucks": "VAN",
        "Vegas Golden Knights": "VGK",
        "Washington Capitals": "WSH",
        "Winnipeg Jets": "WPG",
      },
      basketball_wnba: {
        "Atlanta Dream": "ATL",
        "Chicago Sky": "CHI",
        "Connecticut Sun": "CTN", // Changed from CON to CTN to match WNBA_TEAM_MAP
        "Dallas Wings": "DAL",
        "Indiana Fever": "IND",
        "Los Angeles Sparks": "LAS",
        "Las Vegas Aces": "LVA",
        "Minnesota Lynx": "MIN",
        "New York Liberty": "NYL",
        "Phoenix Mercury": "PHO",
        "Seattle Storm": "SEA",
        "Washington Mystics": "WAS"
      }
    }
  
    // Check if it's a full team name first
    if (teamMaps[normalizedSport]?.[teamName]) {
      return teamMaps[normalizedSport][teamName]
    }
    
    // If not a full name, check for abbreviation variations
    const mlbVariationMap: Record<string, string> = {
      ATH: "OAK",
      Athletics: "OAK",
      "A's": "OAK",
      CWS: "CHW",
      "White Sox": "CHW",
      CHI: "CHC", // Add this to handle "CHI" -> "CHC" for Cubs
    }
    
    const nflVariationMap: Record<string, string> = {
      LA: "LAR", // Los Angeles Rams (Redis sends "LA" but logo file is "LAR.svg")
    }

    const nhlVariationMap: Record<string, string> = {
      LAK: "LA",  // Los Angeles Kings (alternative abbreviation)
      LV: "VGK",  // Vegas Golden Knights (alternative abbreviation)
      VEG: "VGK", // Vegas Golden Knights (alternative abbreviation)
    }

    if (normalizedSport === "baseball_mlb" && mlbVariationMap[teamName]) {
      return mlbVariationMap[teamName]
    }
    
    if (normalizedSport === "football_nfl" && nflVariationMap[teamName]) {
      return nflVariationMap[teamName]
    }

    if ((normalizedSport === "icehockey_nhl" || normalizedSport === "nhl") && nhlVariationMap[teamName]) {
      return nhlVariationMap[teamName]
    }
  
  // If no match found, check if it's already a valid abbreviation
  const validAbbrs = new Set(Object.values(teamMaps[normalizedSport] || {}))
  if (validAbbrs.has(teamName.toUpperCase())) {
    return teamName.toUpperCase()
  }

  // Last resort: return the team name as-is (uppercase)
  // This prevents partial matches like "UNCW" -> "UNC"
  return teamName.toUpperCase()
}
  
  // Get team logo URL
  export function getTeamLogoUrl(teamName: string, sport: string): string {
    if (!teamName) return "";
    const abbr = getStandardAbbreviation(teamName, sport);
    // NCAAB shares logos with NCAAF (same schools)
    const logoSport = sport.toLowerCase() === 'ncaab' ? 'ncaaf' : sport;
    return `/team-logos/${logoSport}/${abbr.toUpperCase()}.svg`;
  }

  // Get player image URL based on sport and player ID
  export function getPlayerImageUrl(playerId: string, sport: string): string {
    switch(sport) {
      case 'football_nfl':
        return `https://static.www.nfl.com/image/private/t_player_profile_landscape/f_auto/league/${playerId}`
      case 'baseball_mlb':
        return `https://img.mlbstatic.com/mlb-photos/image/upload/w_48,q_100/v1/people/${playerId}/headshot/silo/current`
      default:
        return ''
    }
  }
  
  // Format game date and time based on sport
  export function formatGameDateTime(date: string, sport: string): string {
    const gameTime = new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    
    if (sport === 'football_nfl') {
      const day = new Date(date).toLocaleDateString("en-US", {
        weekday: "short"
      })
      return `${day} ${gameTime}`
    }
    
    return gameTime
  }
  
  // Get sport-specific styling
  export function getSportSpecificStyles(sport: string): Record<string, string> {
    return {
      football_nfl: {
        tableRowHeight: "h-16", // Taller rows for NFL
        avatarSize: "h-12 w-12", // Larger avatars
        teamLogoSize: "h-6 w-6", // Larger team logos
      },
      baseball_mlb: {
        tableRowHeight: "h-14",
        avatarSize: "h-10 w-10",
        teamLogoSize: "h-5 w-5",
      }
    }[sport] || {
      tableRowHeight: "h-14",
      avatarSize: "h-10 w-10",
      teamLogoSize: "h-5 w-5",
    }
  }
  
  // Get market display name based on sport and market key
  export function getMarketDisplay(market: string, sport: string): string {
    const marketMaps: Record<string, Record<string, string>> = {
      football_nfl: {
        passing_yards: "Passing Yards",
        rushing_yards: "Rushing Yards",
        receiving_yards: "Receiving Yards",
        receptions: "Receptions",
        passing_touchdowns: "Passing TDs",
        rushing_touchdowns: "Rushing TDs",
        receiving_touchdowns: "Receiving TDs",
        interceptions: "Interceptions",
        completions: "Completions",
        attempts: "Pass Attempts",
        sacks: "Sacks",
      },
      baseball_mlb: {
        hits: "Hits",
        strikeouts: "Strikeouts",
        runs: "Runs",
        home_runs: "Home Runs",
        rbis: "RBIs",
        total_bases: "Total Bases",
        walks: "Walks",
        pitching_outs: "Outs",
      }
    }
  
    return marketMaps[sport]?.[market] || 
      market.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
  } 