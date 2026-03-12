import { View, type ViewStyle } from "react-native";
import TEAM_LOGOS from "@/src/assets/team-logos-index";

const LOGO_SPORT_FOLDER: Record<string, string> = {
  nba: "nba",
  ncaab: "ncaaf",
  nhl: "nhl",
  nfl: "nfl",
  mlb: "mlb",
  wnba: "wnba",
  ncaaf: "ncaaf",
};

/**
 * Fixups map API abbreviations → bundled SVG filenames (lowercase).
 * Only add entries where the API abbreviation differs from the SVG filename.
 */
const TEAM_ABBR_FIXUPS: Record<string, Record<string, string>> = {
  nba:   { was: "wsh" },
  ncaab: { was: "wsh" },
  nhl:   {},
  nfl:   { la: "lar", was: "wsh" },
  mlb:   { ari: "az", cws: "chw" },
  wnba:  {},
};

type Props = {
  teamAbbr: string | null | undefined;
  sport: string;
  size: number;
  style?: ViewStyle;
};

/**
 * Renders a team logo from locally bundled SVG assets.
 * SVGs are imported as React components via react-native-svg-transformer.
 */
export default function TeamLogo({ teamAbbr, sport, size, style }: Props) {
  if (!teamAbbr) return null;

  const sportLower = sport.toLowerCase();
  const folder = LOGO_SPORT_FOLDER[sportLower];
  if (!folder) return null;

  const fixups = TEAM_ABBR_FIXUPS[sportLower] ?? {};
  const normalized = teamAbbr.toLowerCase().trim();
  const key = fixups[normalized] ?? normalized;
  const SvgLogo = TEAM_LOGOS[`${folder}/${key.toUpperCase()}`];
  if (!SvgLogo) return null;

  return (
    <View style={[{ width: size, height: size, overflow: "hidden" }, style]}>
      <SvgLogo width={size} height={size} />
    </View>
  );
}
