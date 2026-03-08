import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import PageHeader from "@/src/components/PageHeader";
import SportsbookPicker from "@/src/components/SportsbookPicker";
import { useOddsAlternates, type OddsAlternateLine } from "@/src/hooks/use-odds-alternates";
import { useOddsEvents, type OddsEvent } from "@/src/hooks/use-odds-events";
import { useOddsTable, type OddsTableRow } from "@/src/hooks/use-odds-table";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl, normalizeSportsbookId } from "@/src/lib/logos";
import {
  triggerLightImpactHaptic,
  triggerSelectionHaptic
} from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

type Scope = "pregame" | "live";
type MarketType = "game" | "player";

type SportConfig = {
  key: string;
  label: string;
};

type MarketChip = {
  key: string;
  label: string;
};

type OddsBookEntry = NonNullable<OddsTableRow["books"]>[string];
type AlternateBookEntry = OddsAlternateLine["books"][string];
type GenericBookEntry = OddsBookEntry | AlternateBookEntry;
type GenericBookMap = Record<string, GenericBookEntry>;
type GenericBest = {
  over?: { bk: string; price: number };
  under?: { bk: string; price: number };
};

const SPORTS: SportConfig[] = [
  { key: "nba", label: "NBA" },
  { key: "ncaab", label: "NCAAB" },
  { key: "nhl", label: "NHL" },
  { key: "soccer_epl", label: "EPL" },
];

const GAME_MARKETS: Record<string, MarketChip[]> = {
  nba: [
    { key: "game_moneyline", label: "Moneyline" },
    { key: "game_spread", label: "Spread" },
    { key: "total_points", label: "Total O/U" },
    { key: "1st_half_point_spread", label: "1H Spread" },
    { key: "1st_half_total_points", label: "1H Total" },
    { key: "game_1h_moneyline", label: "1H ML" },
  ],
  ncaab: [
    { key: "game_moneyline", label: "Moneyline" },
    { key: "game_spread", label: "Spread" },
    { key: "total_points", label: "Total O/U" },
    { key: "1st_half_point_spread", label: "1H Spread" },
    { key: "1st_half_total_points", label: "1H Total" },
  ],
  nhl: [
    { key: "game_moneyline", label: "Moneyline" },
    { key: "game_spread", label: "Puck Line" },
    { key: "total_points", label: "Total Goals" },
    { key: "game_1p_moneyline", label: "1P ML" },
  ],
  soccer_epl: [
    { key: "game_moneyline", label: "Moneyline" },
    { key: "total_points", label: "Goals O/U" },
    { key: "moneyline_3_way", label: "3-Way ML" },
    { key: "1st_half_moneyline_3_way", label: "1H 3-Way" },
  ],
};

const PLAYER_MARKETS: Record<string, MarketChip[]> = {
  nba: [
    { key: "player_points", label: "PTS" },
    { key: "player_rebounds", label: "REB" },
    { key: "player_assists", label: "AST" },
    { key: "player_pra", label: "PRA" },
    { key: "player_threes_made", label: "3PM" },
    { key: "player_double_double", label: "DD" },
    { key: "first_field_goal", label: "1st Basket" },
  ],
  ncaab: [
    { key: "player_points", label: "PTS" },
    { key: "player_rebounds", label: "REB" },
    { key: "player_assists", label: "AST" },
    { key: "player_pra", label: "PRA" },
    { key: "player_threes_made", label: "3PM" },
    { key: "first_field_goal", label: "1st Basket" },
  ],
  nhl: [
    { key: "player_goals", label: "Goals" },
    { key: "player_assists", label: "Assists" },
    { key: "player_points", label: "Points" },
    { key: "player_shots_on_goal", label: "SOG" },
    { key: "player_saves", label: "Saves" },
  ],
  soccer_epl: [
    { key: "player_goals", label: "Goals" },
    { key: "player_shots_on_target", label: "SOT" },
    { key: "player_assists", label: "Assists" },
    { key: "player_shots", label: "Shots" },
  ],
};

const PREVIEW_MARKETS = [
  { key: "game_moneyline", label: "Moneyline" },
  { key: "game_spread", label: "Spread" },
  { key: "total_points", label: "Total O/U" },
];

const SPORT_ACCENTS: Record<string, string> = {
  nba: brandColors.primary,
  ncaab: brandColors.warning,
  nhl: "#10B981",
  soccer_epl: "#F97316",
};

function getDateChoices() {
  const labels: Array<{ key: string; title: string; sublabel: string }> = [];
  for (let i = 0; i < 5; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = i === 0 ? "today" : date.toISOString().slice(0, 10);
    labels.push({
      key,
      title: i === 0 ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sublabel: date.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return labels;
}

function formatGameTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatOdds(price: number | null | undefined) {
  if (price == null) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

function formatLine(line: number | null | undefined) {
  if (line == null) return "";
  return line > 0 ? `+${line}` : `${line}`;
}

function hasPlayerMarkets(sport: string) {
  return (PLAYER_MARKETS[sport] ?? []).length > 0;
}

function isNbaLikeSport(sport: string) {
  return sport === "nba" || sport === "ncaab";
}

function getTeamLogoUri(teamAbbr: string, sport: string) {
  if (!isNbaLikeSport(sport)) return null;
  return getNbaTeamLogoUrl(teamAbbr);
}

function marketLabelFromKey(market: string) {
  return market
    .replace(/^player_/, "")
    .replace(/^game_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function filterBookEntries(booksMap: GenericBookMap | undefined, preferredBooks: string[]) {
  const books: Array<[string, GenericBookEntry]> = booksMap ? (Object.entries(booksMap) as Array<[string, GenericBookEntry]>) : [];
  if (preferredBooks.length === 0) return books;

  const preferredSet = new Set(preferredBooks.map((book) => normalizeSportsbookId(book)));
  const filtered = books.filter(([bookId]) => preferredSet.has(normalizeSportsbookId(bookId)));
  return filtered.length > 0 ? filtered : books;
}

function openBooksForRow(row: OddsTableRow, preferredBooks: string[]) {
  return filterBookEntries(row.books, preferredBooks) as Array<[string, OddsBookEntry]>;
}

function openBooksForAlternateLine(line: OddsAlternateLine, preferredBooks: string[]) {
  return filterBookEntries(line.books, preferredBooks) as Array<[string, AlternateBookEntry]>;
}

function getBestSideFromBooks(
  booksMap: GenericBookMap | undefined,
  best: GenericBest | undefined,
  line: number | null | undefined,
  side: "over" | "under",
  preferredBooks: string[]
): { bookId: string | null; price: number | null; line: number | null; link: string | null } {
  const books = filterBookEntries(booksMap, preferredBooks);
  let bestSide: { bookId: string | null; price: number | null; line: number | null; link: string | null } = {
    bookId: null,
    price: null,
    line: line ?? null,
    link: null,
  };

  for (const [bookId, data] of books) {
    const candidate = data?.[side];
    if (!candidate || typeof candidate.price !== "number") continue;
    if (bestSide.price == null || candidate.price > bestSide.price) {
      bestSide = {
        bookId: normalizeSportsbookId(bookId),
        price: candidate.price,
        line: "line" in candidate && typeof candidate.line === "number" ? candidate.line : line ?? null,
        link: ("m" in candidate ? candidate.m : null) ?? ("u" in candidate ? candidate.u : null) ?? ("link" in candidate ? candidate.link : null) ?? null,
      };
    }
  }

  if (bestSide.price != null) return bestSide;

  const fallback = best?.[side];
  return {
    bookId: fallback?.bk ? normalizeSportsbookId(fallback.bk) : null,
    price: fallback?.price ?? null,
    line: line ?? null,
    link: null,
  };
}

function getBestSide(
  row: OddsTableRow,
  side: "over" | "under",
  preferredBooks: string[]
): { bookId: string | null; price: number | null; line: number | null; link: string | null } {
  return getBestSideFromBooks(row.books, row.best, row.ln, side, preferredBooks);
}

function getBestSideForAlternateLine(
  line: OddsAlternateLine,
  side: "over" | "under",
  preferredBooks: string[]
) {
  return getBestSideFromBooks(line.books, line.best, line.ln, side, preferredBooks);
}

function groupRowsByEvent(rows: OddsTableRow[]) {
  const map = new Map<string, OddsTableRow[]>();
  for (const row of rows) {
    const current = map.get(row.eid) ?? [];
    current.push(row);
    map.set(row.eid, current);
  }
  return map;
}

function buildEventLabel(event: OddsEvent) {
  return `${event.away_team} @ ${event.home_team}`;
}

function supportsAlternates(market: string, entity: string) {
  const normalized = market.toLowerCase();
  if (normalized.includes("moneyline") || normalized.includes("3_way") || normalized.includes("odd_even")) {
    return false;
  }
  if (normalized.includes("spread") || normalized.includes("total")) {
    return true;
  }

  if (entity === "game" || entity.startsWith("team:")) {
    return false;
  }

  const excludedPlayerMarkets = new Set([
    "player_double_double",
    "player_triple_double",
    "first_field_goal",
    "player_first_td_scorer",
    "player_anytime_td",
  ]);

  return normalized.startsWith("player_") && !excludedPlayerMarkets.has(normalized);
}

function getVisibleAlternateLines(lines: OddsAlternateLine[], primaryLine: number | null | undefined) {
  const sorted = [...lines].sort((a, b) => a.ln - b.ln);
  if (sorted.length <= 7) return sorted;

  const primaryIndex = sorted.findIndex((line) => line.ln === primaryLine);
  if (primaryIndex < 0) return sorted.slice(0, 7);

  const start = Math.max(0, Math.min(primaryIndex - 2, sorted.length - 7));
  return sorted.slice(start, start + 7);
}

function OddsValuePill({
  price,
  bookId,
  accentColor,
  align = "flex-start",
}: {
  price: number | null;
  bookId: string | null;
  accentColor: string;
  align?: "flex-start" | "flex-end";
}) {
  const logo = getSportsbookLogoUrl(bookId);

  return (
    <View style={[styles.valuePill, { alignItems: align }]}>
      <View style={styles.valuePillMain}>
        <Text style={[styles.valuePillPrice, { color: accentColor }]}>{formatOdds(price)}</Text>
        {logo ? <Image source={{ uri: logo }} style={styles.bookLogo} /> : null}
      </View>
    </View>
  );
}

function GameMarketPreview({
  row,
  label,
  preferredBooks,
  accentColor,
}: {
  row: OddsTableRow | undefined;
  label: string;
  preferredBooks: string[];
  accentColor: string;
}) {
  if (!row) {
    return (
      <View style={styles.previewRow}>
        <Text style={styles.previewRowLabel}>{label}</Text>
        <Text style={styles.previewEmpty}>No line</Text>
      </View>
    );
  }

  const over = getBestSide(row, "over", preferredBooks);
  const under = getBestSide(row, "under", preferredBooks);
  const isTotal = row.mkt.includes("total");
  const awayLabel = isTotal
    ? `Over ${row.ln}`
    : `${row.ev.away.abbr}${row.mkt.includes("spread") ? ` ${formatLine(over.line ?? row.ln)}` : ""}`;
  const homeLabel = isTotal
    ? `Under ${row.ln}`
    : `${row.ev.home.abbr}${row.mkt.includes("spread") ? ` ${formatLine(under.line ?? row.ln)}` : ""}`;

  return (
    <View style={styles.previewRow}>
      <View style={styles.previewRowHeader}>
        <Text style={styles.previewRowLabel}>{label}</Text>
        <Text style={styles.previewRowMeta}>Best</Text>
      </View>
      <View style={styles.previewRowBody}>
        <View style={styles.previewTeamSide}>
          <Text style={styles.previewTeamLabel}>{awayLabel}</Text>
          <OddsValuePill price={over.price} bookId={over.bookId} accentColor={accentColor} />
        </View>
        <View style={styles.previewRowDivider} />
        <View style={[styles.previewTeamSide, styles.previewTeamSideRight]}>
          <Text style={styles.previewTeamLabel}>{homeLabel}</Text>
          <OddsValuePill price={under.price} bookId={under.bookId} accentColor={accentColor} align="flex-end" />
        </View>
      </View>
    </View>
  );
}

function DetailMarketCard({
  row,
  marketType,
  accentColor,
  selectedSportsbooks,
  expanded,
  onToggle,
  sport,
}: {
  row: OddsTableRow;
  marketType: MarketType;
  accentColor: string;
  selectedSportsbooks: string[];
  expanded: boolean;
  onToggle: () => void;
  sport: string;
}) {
  const isGameMarket = marketType === "game";
  const isTotal = row.mkt.includes("total");
  const books = openBooksForRow(row, selectedSportsbooks);
  const over = getBestSide(row, "over", selectedSportsbooks);
  const under = getBestSide(row, "under", selectedSportsbooks);
  const includeAlternates = supportsAlternates(row.mkt, row.ent);

  const alternatesQuery = useOddsAlternates({
    sport,
    eventId: row.eid,
    market: row.mkt,
    playerKey: row.ent,
    primaryLine: row.ln,
    enabled: expanded && includeAlternates,
  });

  const alternateLines = useMemo(
    () => getVisibleAlternateLines(alternatesQuery.data?.all_lines ?? [], alternatesQuery.data?.primary_ln ?? row.ln),
    [alternatesQuery.data?.all_lines, alternatesQuery.data?.primary_ln, row.ln]
  );

  const primaryLine = alternatesQuery.data?.primary_ln ?? row.ln;

  return (
    <Pressable
      style={styles.marketCard}
      onPress={() => {
        triggerLightImpactHaptic();
        onToggle();
      }}
    >
      <View style={styles.marketCardHeader}>
        <View style={styles.marketCardCopy}>
          <Text style={styles.marketCardTitle}>
            {isGameMarket
              ? marketLabelFromKey(row.mkt)
              : row.player || marketLabelFromKey(row.mkt)}
          </Text>
          <Text style={styles.marketCardSubtitle}>
            {isGameMarket
              ? `${row.ev.away.abbr} @ ${row.ev.home.abbr}`
              : `${row.team ?? ""}${row.position ? ` · ${row.position}` : ""} · ${marketLabelFromKey(row.mkt)} ${row.ln}`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={brandColors.textMuted}
        />
      </View>

      <View style={styles.marketOddsRow}>
        <View style={styles.marketOddsSide}>
          <Text style={styles.marketOddsLabel}>
            {isTotal ? `Over ${row.ln}` : isGameMarket ? `${row.ev.away.abbr}${row.mkt.includes("spread") ? ` ${formatLine(over.line ?? row.ln)}` : ""}` : `Over ${row.ln}`}
          </Text>
          <View style={styles.marketOddsValueRow}>
            <Text style={[styles.marketOddsPrice, { color: accentColor }]}>{formatOdds(over.price)}</Text>
            {over.bookId ? (
              <Image source={{ uri: getSportsbookLogoUrl(over.bookId)! }} style={styles.bookLogo} />
            ) : null}
          </View>
        </View>

        <View style={styles.marketOddsDivider} />

        <View style={styles.marketOddsSide}>
          <Text style={styles.marketOddsLabel}>
            {isTotal ? `Under ${row.ln}` : isGameMarket ? `${row.ev.home.abbr}${row.mkt.includes("spread") ? ` ${formatLine(under.line ?? row.ln)}` : ""}` : `Under ${row.ln}`}
          </Text>
          <View style={styles.marketOddsValueRow}>
            <Text style={styles.marketOddsPrice}>{formatOdds(under.price)}</Text>
            {under.bookId ? (
              <Image source={{ uri: getSportsbookLogoUrl(under.bookId)! }} style={styles.bookLogo} />
            ) : null}
          </View>
        </View>
      </View>

      {expanded ? (
        <View style={styles.expandedSection}>
          {includeAlternates ? (
            alternatesQuery.isLoading ? (
              <View style={styles.expandedStateRow}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={styles.expandedStateText}>Loading alternate lines…</Text>
              </View>
            ) : alternateLines.length > 1 ? (
              <>
                <View style={styles.expandedSectionHeader}>
                  <Text style={styles.expandedSectionTitle}>Alternate Lines</Text>
                  <Text style={styles.expandedSectionMeta}>{alternatesQuery.data?.all_lines?.length ?? alternateLines.length} lines</Text>
                </View>

                <View style={styles.alternateLinesStack}>
                  {alternateLines.map((line) => {
                    const altOver = getBestSideForAlternateLine(line, "over", selectedSportsbooks);
                    const altUnder = getBestSideForAlternateLine(line, "under", selectedSportsbooks);
                    const isPrimary = line.ln === primaryLine;
                    const lineLabel = row.mkt.includes("spread") ? formatLine(line.ln) : `${line.ln}`;

                    return (
                      <View key={`${row.eid}-${row.ent}-${row.mkt}-${line.ln}`} style={[styles.alternateLineRow, isPrimary && styles.alternateLineRowPrimary]}>
                        <View style={styles.alternateLineTag}>
                          <Text style={[styles.alternateLineTagText, isPrimary && styles.alternateLineTagTextPrimary]}>
                            {isPrimary ? `Main ${lineLabel}` : `Alt ${lineLabel}`}
                          </Text>
                        </View>
                        <View style={styles.alternateLinePrices}>
                          <View style={styles.alternatePriceCell}>
                            <Text style={styles.alternatePriceLabel}>{isTotal ? "O" : isGameMarket ? row.ev.away.abbr : "O"}</Text>
                            <Text style={[styles.alternatePriceValue, { color: accentColor }]}>{formatOdds(altOver.price)}</Text>
                            {altOver.bookId ? <Image source={{ uri: getSportsbookLogoUrl(altOver.bookId)! }} style={styles.altBookLogo} /> : null}
                          </View>
                          <View style={styles.alternatePriceCell}>
                            <Text style={styles.alternatePriceLabel}>{isTotal ? "U" : isGameMarket ? row.ev.home.abbr : "U"}</Text>
                            <Text style={styles.alternatePriceValue}>{formatOdds(altUnder.price)}</Text>
                            {altUnder.bookId ? <Image source={{ uri: getSportsbookLogoUrl(altUnder.bookId)! }} style={styles.altBookLogo} /> : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {(alternatesQuery.data?.all_lines?.length ?? 0) > alternateLines.length ? (
                  <Text style={styles.expandedFootnote}>
                    +{(alternatesQuery.data?.all_lines?.length ?? 0) - alternateLines.length} more lines available
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.expandedFootnote}>No alternate lines available.</Text>
            )
          ) : null}

          {(!includeAlternates || alternateLines.length <= 1) && books.length > 0 ? (
            <>
              <View style={styles.expandedSectionHeader}>
                <Text style={styles.expandedSectionTitle}>Books</Text>
                <Text style={styles.expandedSectionMeta}>{Math.min(books.length, 6)} shown</Text>
              </View>
              <View style={styles.expandedBooks}>
                {books.slice(0, 6).map(([bookId, data]) => {
                  const normalized = normalizeSportsbookId(bookId);
                  const logo = getSportsbookLogoUrl(normalized);
                  return (
                    <View key={bookId} style={styles.expandedBookRow}>
                      <View style={styles.expandedBookLeft}>
                        {logo ? <Image source={{ uri: logo }} style={styles.altBookLogo} /> : null}
                        <Text style={styles.expandedBookName}>{normalized.replace(/[-_]/g, " ")}</Text>
                      </View>
                      <View style={styles.expandedBookOdds}>
                        <Text style={styles.expandedBookPrice}>O {formatOdds(data.over?.price ?? null)}</Text>
                        <Text style={styles.expandedBookPrice}>U {formatOdds(data.under?.price ?? null)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function GamesScreen() {
  const dateChoices = useMemo(() => getDateChoices(), []);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedSport, setSelectedSport] = useState("nba");
  const [selectedDate, setSelectedDate] = useState(dateChoices[0]?.key ?? "today");
  const [scope, setScope] = useState<Scope>("pregame");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [marketType, setMarketType] = useState<MarketType>("game");
  const [expandedPropId, setExpandedPropId] = useState<string | null>(null);
  const { preferences, savePreferences } = useUserPreferences();

  const accentColor = SPORT_ACCENTS[selectedSport] ?? brandColors.primary;
  const selectedSportsbooks = preferences.preferredSportsbooks;

  const eventsQuery = useOddsEvents({
    sport: selectedSport,
    date: selectedDate,
    includeStarted: scope === "live",
  });

  const moneylineQuery = useOddsTable({
    sport: selectedSport,
    market: "game_moneyline",
    scope,
    limit: 400,
  });

  const spreadQuery = useOddsTable({
    sport: selectedSport,
    market: "game_spread",
    scope,
    limit: 400,
  });

  const totalQuery = useOddsTable({
    sport: selectedSport,
    market: "total_points",
    scope,
    limit: 400,
  });

  const playerMarkets = PLAYER_MARKETS[selectedSport] ?? [];
  const gameMarkets = GAME_MARKETS[selectedSport] ?? [];
  const [selectedGameMarket, setSelectedGameMarket] = useState(gameMarkets[0]?.key ?? "game_moneyline");
  const [selectedPlayerMarket, setSelectedPlayerMarket] = useState(playerMarkets[0]?.key ?? "player_points");

  useEffect(() => {
    setSelectedGameId(null);
    setSearchQuery("");
    setMarketType("game");
    setExpandedPropId(null);
    setSelectedGameMarket((GAME_MARKETS[selectedSport] ?? [])[0]?.key ?? "game_moneyline");
    setSelectedPlayerMarket((PLAYER_MARKETS[selectedSport] ?? [])[0]?.key ?? "player_points");
  }, [selectedSport, selectedDate, scope]);

  const detailMarket = marketType === "game" ? selectedGameMarket : selectedPlayerMarket;

  const detailQuery = useOddsTable({
    sport: selectedSport,
    market: detailMarket,
    scope,
    limit: 400,
    enabled: Boolean(selectedGameId),
  });

  const eventIds = useMemo(() => new Set((eventsQuery.data?.events ?? []).map((event) => event.event_id)), [eventsQuery.data?.events]);

  const moneylineByEvent = useMemo(
    () => groupRowsByEvent((moneylineQuery.data?.rows ?? []).filter((row) => eventIds.has(row.eid))),
    [moneylineQuery.data?.rows, eventIds]
  );
  const spreadByEvent = useMemo(
    () => groupRowsByEvent((spreadQuery.data?.rows ?? []).filter((row) => eventIds.has(row.eid))),
    [spreadQuery.data?.rows, eventIds]
  );
  const totalByEvent = useMemo(
    () => groupRowsByEvent((totalQuery.data?.rows ?? []).filter((row) => eventIds.has(row.eid))),
    [totalQuery.data?.rows, eventIds]
  );

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const events = eventsQuery.data?.events ?? [];
    if (!query || selectedGameId) return events;
    return events.filter((event) =>
      buildEventLabel(event).toLowerCase().includes(query) ||
      event.home_team_name.toLowerCase().includes(query) ||
      event.away_team_name.toLowerCase().includes(query)
    );
  }, [eventsQuery.data?.events, searchQuery, selectedGameId]);

  const selectedEvent = useMemo(
    () => (eventsQuery.data?.events ?? []).find((event) => event.event_id === selectedGameId) ?? null,
    [eventsQuery.data?.events, selectedGameId]
  );

  const detailRows = useMemo(() => {
    const rows = detailQuery.data?.rows ?? [];
    const filtered = rows.filter((row) => row.eid === selectedGameId);
    const query = searchQuery.trim().toLowerCase();

    if (!query || marketType === "game") return filtered;
    return filtered.filter((row) =>
      String(row.player || "").toLowerCase().includes(query) ||
      String(row.team || "").toLowerCase().includes(query) ||
      marketLabelFromKey(row.mkt).toLowerCase().includes(query)
    );
  }, [detailQuery.data?.rows, selectedGameId, searchQuery, marketType]);

  const previewLoading =
    moneylineQuery.isLoading ||
    spreadQuery.isLoading ||
    totalQuery.isLoading;

  const listRefreshing =
    eventsQuery.isFetching ||
    moneylineQuery.isFetching ||
    spreadQuery.isFetching ||
    totalQuery.isFetching;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PageHeader
        title={selectedGameId ? "Odds" : "Games"}
        accentColor={accentColor}
        onSportsbooksPress={() => setPickerVisible(true)}
        selectedSportsbooks={selectedSportsbooks}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.toolbar}>
          {selectedGameId ? (
            <Pressable
              style={styles.backButton}
              onPress={() => {
                triggerSelectionHaptic();
                setSelectedGameId(null);
                setExpandedPropId(null);
                setSearchQuery("");
              }}
            >
              <Ionicons name="chevron-back" size={16} color={brandColors.textPrimary} />
              <Text style={styles.backButtonText}>All games</Text>
            </Pressable>
          ) : null}

          <View style={styles.scopeToggle}>
            {(["pregame", "live"] as Scope[]).map((value) => {
              const active = scope === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    if (scope !== value) triggerSelectionHaptic();
                    setScope(value);
                  }}
                  style={[styles.scopeChip, active && styles.scopeChipActive]}
                >
                  <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                    {value === "pregame" ? "Pre-Game" : "Live"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!selectedGameId ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRail}>
              {SPORTS.map((sport) => {
                const active = sport.key === selectedSport;
                return (
                  <Pressable
                    key={sport.key}
                    onPress={() => {
                      if (!active) triggerSelectionHaptic();
                      setSelectedSport(sport.key);
                    }}
                    style={[styles.sportChip, active && [styles.sportChipActive, { borderColor: accentColor }]]}
                  >
                    <Text style={[styles.sportChipText, active && { color: accentColor }]}>{sport.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRail}>
              {dateChoices.map((choice) => {
                const active = choice.key === selectedDate;
                return (
                  <Pressable
                    key={choice.key}
                    onPress={() => {
                      if (!active) triggerSelectionHaptic();
                      setSelectedDate(choice.key);
                    }}
                    style={styles.dateChip}
                  >
                    <Text style={[styles.dateChipTitle, active && styles.dateChipTitleActive]}>{choice.title}</Text>
                    <Text style={[styles.dateChipSubtitle, active && styles.dateChipSubtitleActive]}>{choice.sublabel}</Text>
                    <View style={[styles.dateUnderline, active && [styles.dateUnderlineActive, { backgroundColor: accentColor }]]} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={18} color={brandColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={selectedGameId && marketType === "player" ? "Search players..." : "Search games..."}
            placeholderTextColor={brandColors.textMuted}
            style={styles.searchInput}
          />
        </View>

        {!selectedGameId ? (
          <View style={styles.listArea}>
            {eventsQuery.isLoading || previewLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={styles.stateText}>Loading games and odds...</Text>
              </View>
            ) : filteredEvents.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>No games available for this date.</Text>
              </View>
            ) : (
              filteredEvents.map((event) => {
                const ml = moneylineByEvent.get(event.event_id)?.[0];
                const spread = spreadByEvent.get(event.event_id)?.[0];
                const total = totalByEvent.get(event.event_id)?.[0];
                const homeLogo = getTeamLogoUri(event.home_team, selectedSport);
                const awayLogo = getTeamLogoUri(event.away_team, selectedSport);

                return (
                  <Pressable
                    key={event.event_id}
                    style={styles.gameCard}
                    onPress={() => {
                      triggerLightImpactHaptic();
                      setSelectedGameId(event.event_id);
                      setExpandedPropId(null);
                      setSearchQuery("");
                    }}
                  >
                    <View style={styles.gameCardTopRow}>
                      <View style={styles.gameMetaPill}>
                        <Text style={styles.gameMetaText}>{formatGameTime(event.commence_time)}</Text>
                        <Text style={styles.gameMetaDivider}>·</Text>
                        <Text style={styles.gameMetaText}>{selectedDate === "today" ? "Today" : selectedDate}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={brandColors.textMuted} />
                    </View>

                    <View style={styles.matchupRows}>
                      <View style={styles.matchupRow}>
                        <View style={styles.teamIdentity}>
                          {awayLogo ? <Image source={{ uri: awayLogo }} style={styles.teamLogo} /> : null}
                          <View style={styles.teamCopy}>
                            <Text numberOfLines={1} style={styles.teamName}>{event.away_team_name}</Text>
                            <Text style={styles.teamSub}>{event.away_team}</Text>
                          </View>
                        </View>
                        <Text style={styles.matchupMarker}>AWAY</Text>
                      </View>

                      <View style={styles.matchupRow}>
                        <View style={styles.teamIdentity}>
                          {homeLogo ? <Image source={{ uri: homeLogo }} style={styles.teamLogo} /> : null}
                          <View style={styles.teamCopy}>
                            <Text numberOfLines={1} style={styles.teamName}>{event.home_team_name}</Text>
                            <Text style={styles.teamSub}>{event.home_team}</Text>
                          </View>
                        </View>
                        <View style={styles.homeBadge}>
                          <Text style={styles.homeBadgeText}>HOME</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.previewStack}>
                      {PREVIEW_MARKETS.map((preview) => (
                        <GameMarketPreview
                          key={preview.key}
                          row={
                            preview.key === "game_moneyline"
                              ? ml
                              : preview.key === "game_spread"
                                ? spread
                                : total
                          }
                          label={preview.label}
                          preferredBooks={selectedSportsbooks}
                          accentColor={accentColor}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })
            )}
            {listRefreshing && !eventsQuery.isLoading ? (
              <Text style={styles.refreshHint}>Refreshing lines…</Text>
            ) : null}
          </View>
        ) : selectedEvent ? (
          <View style={styles.detailArea}>
            <View style={styles.detailHero}>
              <Text style={styles.detailEyebrow}>{formatGameTime(selectedEvent.commence_time)} · {selectedDate === "today" ? "Today" : selectedDate}</Text>
              <Text style={styles.detailTitle}>{selectedEvent.away_team_name} @ {selectedEvent.home_team_name}</Text>
              <Text style={styles.detailSubtitle}>{selectedEvent.away_team} at {selectedEvent.home_team}</Text>
            </View>

            {hasPlayerMarkets(selectedSport) ? (
              <View style={styles.typeToggle}>
                {(["game", "player"] as MarketType[]).map((value) => {
                  const active = marketType === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        if (marketType !== value) triggerSelectionHaptic();
                        setMarketType(value);
                        setExpandedPropId(null);
                      }}
                      style={[styles.typeToggleButton, active && styles.typeToggleButtonActive]}
                    >
                      <Text style={[styles.typeToggleText, active && styles.typeToggleTextActive]}>
                        {value === "game" ? "Game Props" : "Player Props"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketRail}>
              {(marketType === "game" ? gameMarkets : playerMarkets).map((market) => {
                const active = detailMarket === market.key;
                return (
                  <Pressable
                    key={market.key}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setExpandedPropId(null);
                      if (marketType === "game") {
                        setSelectedGameMarket(market.key);
                      } else {
                        setSelectedPlayerMarket(market.key);
                      }
                    }}
                    style={[styles.marketChip, active && styles.marketChipActive]}
                  >
                    <Text style={[styles.marketChipText, active && styles.marketChipTextActive]}>{market.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {detailQuery.isLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={styles.stateText}>Loading market odds...</Text>
              </View>
            ) : detailRows.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>No odds available for this market.</Text>
              </View>
            ) : (
              detailRows.map((row) => {
                const expanded = expandedPropId === `${row.eid}-${row.ent}-${row.mkt}-${row.ln}`;

                return (
                  <DetailMarketCard
                    key={`${row.eid}-${row.ent}-${row.mkt}-${row.ln}`}
                    row={row}
                    marketType={marketType}
                    accentColor={accentColor}
                    selectedSportsbooks={selectedSportsbooks}
                    expanded={expanded}
                    onToggle={() => setExpandedPropId(expanded ? null : `${row.eid}-${row.ent}-${row.mkt}-${row.ln}`)}
                    sport={selectedSport}
                  />
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      <SportsbookPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        selected={selectedSportsbooks}
        onSave={(books) => void savePreferences({ preferred_sportsbooks: books })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButtonText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  scopeToggle: {
    flexDirection: "row",
    backgroundColor: brandColors.panelBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    padding: 3,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  scopeChipActive: {
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  scopeChipText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  scopeChipTextActive: {
    color: brandColors.textPrimary,
  },
  sportRail: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 10,
  },
  sportChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sportChipActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sportChipText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  dateRail: {
    paddingHorizontal: 16,
    gap: 22,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  dateChip: {
    paddingBottom: 10,
    position: "relative",
  },
  dateChipTitle: {
    color: brandColors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  dateChipTitleActive: {
    color: brandColors.textPrimary,
  },
  dateChipSubtitle: {
    marginTop: 2,
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  dateChipSubtitleActive: {
    color: brandColors.textSecondary,
  },
  dateUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  dateUnderlineActive: {
    backgroundColor: brandColors.primary,
  },
  searchShell: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 16,
    paddingVertical: 12,
  },
  listArea: {
    paddingHorizontal: 16,
    gap: 14,
  },
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  refreshHint: {
    color: brandColors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  gameCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  gameCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  gameMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gameMetaText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  gameMetaDivider: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  matchupRows: {
    gap: 8,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  teamIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamCopy: {
    flex: 1,
    minWidth: 0,
  },
  teamLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0A0F1B",
  },
  teamName: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  teamSub: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  matchupMarker: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  homeBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  homeBadgeText: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  previewStack: {
    gap: 8,
  },
  previewRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  previewRowLabel: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  previewRowMeta: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  previewRowBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewTeamSide: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  previewTeamSideRight: {
    alignItems: "flex-end",
  },
  previewTeamLabel: {
    color: brandColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  previewRowDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "stretch",
  },
  previewEmpty: {
    color: brandColors.textMuted,
    fontSize: 13,
  },
  valuePill: {
    minHeight: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    justifyContent: "center",
  },
  valuePillMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valuePillPrice: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  bookLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  detailArea: {
    paddingHorizontal: 16,
    gap: 14,
  },
  detailHero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  detailEyebrow: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  detailTitle: {
    color: brandColors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
  },
  detailSubtitle: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: brandColors.border,
    borderRadius: 16,
    padding: 4,
  },
  typeToggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  typeToggleButtonActive: {
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  typeToggleText: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  typeToggleTextActive: {
    color: brandColors.textPrimary,
  },
  marketRail: {
    gap: 10,
    paddingRight: 16,
  },
  marketChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  marketChipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  marketChipText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  marketChipTextActive: {
    color: brandColors.primary,
  },
  marketCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  marketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  marketCardCopy: {
    flex: 1,
    gap: 2,
  },
  marketCardTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  marketCardSubtitle: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  marketOddsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  marketOddsSide: {
    flex: 1,
    gap: 4,
  },
  marketOddsDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 12,
  },
  marketOddsLabel: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  marketOddsValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  marketOddsPrice: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    gap: 8,
  },
  expandedSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  expandedSectionTitle: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  expandedSectionMeta: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  expandedStateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  expandedStateText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  alternateLinesStack: {
    gap: 6,
  },
  alternateLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  alternateLineRowPrimary: {
    borderColor: "rgba(56, 189, 248, 0.18)",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  alternateLineTag: {
    minWidth: 62,
  },
  alternateLineTagText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  alternateLineTagTextPrimary: {
    color: brandColors.textPrimary,
  },
  alternateLinePrices: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alternatePriceCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  alternatePriceLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  alternatePriceValue: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  altBookLogo: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  expandedFootnote: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  expandedBooks: {
    gap: 8,
  },
  expandedBookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandedBookLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandedBookName: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  expandedBookOdds: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  expandedBookPrice: {
    color: brandColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
});
