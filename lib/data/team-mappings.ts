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
        return NFL_TEAM_MAP[upperAbbr] || upperAbbr
      case "basketball_wnba":
        return WNBA_TEAM_MAP[upperAbbr] || upperAbbr
      case "baseball_mlb":
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
  
    if (normalizedSport === "baseball_mlb" && mlbVariationMap[teamName]) {
      return mlbVariationMap[teamName]
    }
    
    if (normalizedSport === "football_nfl" && nflVariationMap[teamName]) {
      return nflVariationMap[teamName]
    }
  
    // If no match found, check if it's already a valid abbreviation
    const validAbbrs = new Set(Object.values(teamMaps[normalizedSport] || {}))
    if (validAbbrs.has(teamName.toUpperCase())) {
      return teamName.toUpperCase()
    }
  
    // Last resort: take first 3 letters
    return teamName.slice(0, 3).toUpperCase()
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