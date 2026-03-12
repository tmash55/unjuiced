import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import PageHeader from "@/src/components/PageHeader";
import TeamLogo from "@/src/components/TeamLogo";
import SportsbookPicker from "@/src/components/SportsbookPicker";
import StateView from "@/src/components/StateView";
import { useOddsAlternates, type OddsAlternateLine } from "@/src/hooks/use-odds-alternates";
import { usePlayerHeadshots } from "@/src/hooks/use-player-headshots";
import { useOddsEvents, type OddsEvent } from "@/src/hooks/use-odds-events";
import { useOddsTable, type OddsTableRow } from "@/src/hooks/use-odds-table";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getSportsbookLogoUrl, normalizeSportsbookId } from "@/src/lib/logos";
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

/**
 * Preview market keys used on the game list cards (moneyline, spread, total).
 * Each sport defines its own API keys so we fetch the right data.
 * Adding a new sport only requires adding an entry here.
 */
const PREVIEW_MARKETS: Record<string, { moneyline: string; spread: string; total: string }> = {
  nba:        { moneyline: "game_moneyline", spread: "game_spread",  total: "total_points" },
  ncaab:      { moneyline: "game_moneyline", spread: "game_spread",  total: "total_points" },
  nhl:        { moneyline: "game_moneyline", spread: "game_spread",  total: "game_total_goals" },
  nfl:        { moneyline: "game_moneyline", spread: "game_spread",  total: "total_points" },
  ncaaf:      { moneyline: "game_moneyline", spread: "game_spread",  total: "total_points" },
  mlb:        { moneyline: "game_moneyline", spread: "game_spread",  total: "game_total_runs" },
  soccer_epl: { moneyline: "game_moneyline", spread: "game_spread",  total: "match_total_goals" },
};

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
    { key: "game_total_goals", label: "Total Goals" },
    { key: "game_1p_moneyline", label: "1P ML" },
  ],
  soccer_epl: [
    { key: "game_moneyline", label: "Moneyline" },
    { key: "match_total_goals", label: "Goals O/U" },
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

const SPORT_ACCENTS: Record<string, string> = {
  nba: brandColors.primary,
  ncaab: brandColors.warning,
  nhl: "#10B981",
  soccer_epl: "#F97316",
};

const DAY_LABELS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/* ─── week helpers ─── */

function getWeekDays(weekOffset: number) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      dayNum: d.getDate(),
      iso: d.toISOString().slice(0, 10),
      isToday:
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate(),
    };
  });
}

function formatMonthYear(date: Date) {
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return { month, year: `${year}` };
}

function formatDayHeader(date: Date) {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return `Today, ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** Check if an event's commence_time falls on the given local calendar date */
function eventMatchesDate(commenceTime: string, target: Date): boolean {
  const d = new Date(commenceTime);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

/* ─── time grouping ─── */

type TimeGroup = "morning" | "afternoon" | "evening";

function getTimeGroup(dateString: string): TimeGroup {
  const hour = new Date(dateString).getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function timeGroupLabel(group: TimeGroup): string {
  if (group === "morning") return "Morning";
  if (group === "afternoon") return "Afternoon";
  return "Evening";
}

/* ─── utility ─── */

function formatGameTime(dateString: string) {
  const d = new Date(dateString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const min = m.toString().padStart(2, "0");
  return { time: `${hour}:${min}`, ampm };
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

/**
 * Filter book entries to only include those whose line matches the expected line.
 * Books offering odds on a different line (alternates) are excluded.
 */
function filterBookEntriesByLine(
  booksMap: GenericBookMap | undefined,
  preferredBooks: string[],
  expectedLine: number | null | undefined
) {
  const books = filterBookEntries(booksMap, preferredBooks);
  if (expectedLine == null) return books;
  return books.filter(([, data]) => {
    const overOk = !data?.over || bookLineMatches(data.over as { price: number; line?: number }, expectedLine);
    const underOk = !data?.under || bookLineMatches(data.under as { price: number; line?: number }, expectedLine);
    return overOk || underOk;
  });
}

function openBooksForRow(row: OddsTableRow, preferredBooks: string[]) {
  return filterBookEntries(row.books, preferredBooks) as Array<[string, OddsBookEntry]>;
}

function openBooksForAlternateLine(line: OddsAlternateLine, preferredBooks: string[]) {
  return filterBookEntries(line.books, preferredBooks) as Array<[string, AlternateBookEntry]>;
}

/**
 * Check if a book entry's line matches the expected line for a given side.
 * Tolerates ±0.01 for floating point and treats missing line as a match (no alternate info).
 * Also matches by absolute value so spreads work (over=+1.5 vs under=-1.5 both match row.ln=1.5).
 */
function bookLineMatches(candidate: { price: number; line?: number }, expectedLine: number | null | undefined): boolean {
  if (expectedLine == null) return true;
  if (!("line" in candidate) || candidate.line == null) return true;
  return Math.abs(candidate.line - expectedLine) < 0.01
    || Math.abs(Math.abs(candidate.line) - Math.abs(expectedLine)) < 0.01;
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
    // Only consider books offering odds on the matching line
    if (!bookLineMatches(candidate as { price: number; line?: number }, line)) continue;
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
  // Only use the pre-computed best as fallback when we're NOT filtering by line,
  // since row.best doesn't carry line info and may reference an alternate.
  if (line == null) {
    const fallback = best?.[side];
    return {
      bookId: fallback?.bk ? normalizeSportsbookId(fallback.bk) : null,
      price: fallback?.price ?? null,
      line: null,
      link: null,
    };
  }
  return { bookId: null, price: null, line, link: null };
}

function getBestSide(row: OddsTableRow, side: "over" | "under", preferredBooks: string[]) {
  return getBestSideFromBooks(row.books, row.best, row.ln, side, preferredBooks);
}

function getBestSideForAlternateLine(line: OddsAlternateLine, side: "over" | "under", preferredBooks: string[]) {
  return getBestSideFromBooks(line.books, line.best, line.ln, side, preferredBooks);
}

/** Get the main/sharp line from Pinnacle → Circa → DraftKings fallback, then row.ln */
const SHARP_BOOK_PRIORITY = ["pinnacle", "circa", "draftkings"];

function getSharpLine(row: OddsTableRow | undefined): number | null {
  if (!row) return null;
  const books = row.books;
  if (books) {
    for (const sharpBook of SHARP_BOOK_PRIORITY) {
      for (const [bookId, data] of Object.entries(books)) {
        if (normalizeSportsbookId(bookId) === sharpBook) {
          const overLine = data?.over && "line" in data.over && typeof data.over.line === "number" ? data.over.line : null;
          const underLine = data?.under && "line" in data.under && typeof data.under.line === "number" ? data.under.line : null;
          if (overLine != null) return overLine;
          if (underLine != null) return underLine;
        }
      }
    }
  }
  return row.ln ?? null;
}

/**
 * Get the sharp line for a specific side (over=away, under=home).
 * For spreads/puck lines, the line stored on each side already has the correct sign
 * for that team. We must NOT negate — just read each side's line directly.
 */
function getSharpLineBySide(row: OddsTableRow | undefined, side: "over" | "under"): number | null {
  if (!row) return null;
  const books = row.books;
  if (books) {
    for (const sharpBook of SHARP_BOOK_PRIORITY) {
      for (const [bookId, data] of Object.entries(books)) {
        if (normalizeSportsbookId(bookId) === sharpBook) {
          const sideData = data?.[side];
          if (sideData && "line" in sideData && typeof sideData.line === "number") {
            return sideData.line;
          }
        }
      }
    }
  }
  return row.ln ?? null;
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

function getDeeplink(entry: GenericBookEntry | undefined, side: "over" | "under"): string | null {
  const sideData = entry?.[side];
  if (!sideData) return null;
  return ("m" in sideData ? sideData.m : null) ?? ("u" in sideData ? sideData.u : null) ?? null;
}

function getMarketStatLabel(market: string): string | null {
  const map: Record<string, string> = {
    player_points: "PPG",
    player_rebounds: "RPG",
    player_assists: "APG",
    player_pra: "PRA",
    player_threes_made: "3PM",
    player_steals: "SPG",
    player_blocks: "BPG",
    player_turnovers: "TPG",
  };
  return map[market] ?? null;
}

function supportsAlternates(market: string, entity: string) {
  const normalized = market.toLowerCase();
  if (normalized.includes("moneyline") || normalized.includes("3_way") || normalized.includes("odd_even")) return false;
  if (normalized.includes("spread") || normalized.includes("total")) return true;
  if (entity === "game" || entity.startsWith("team:")) return false;
  const excludedPlayerMarkets = new Set([
    "player_double_double", "player_triple_double", "first_field_goal",
    "player_first_td_scorer", "player_anytime_td",
  ]);
  return normalized.startsWith("player_") && !excludedPlayerMarkets.has(normalized);
}

function getAlternatePlayerKey(entity: string, playerName: string | null | undefined) {
  const trimmed = entity.trim();
  if (trimmed.startsWith("pid:")) {
    return trimmed.slice(4);
  }
  if (trimmed.startsWith("game:")) {
    return null;
  }
  if (trimmed) {
    return trimmed;
  }
  return playerName ? playerName.toLowerCase().replace(/\s+/g, "_") : null;
}

function getVisibleAlternateLines(lines: OddsAlternateLine[], primaryLine: number | null | undefined) {
  const sorted = [...lines].sort((a, b) => a.ln - b.ln);
  if (sorted.length <= 7) return sorted;
  const primaryIndex = sorted.findIndex((line) => line.ln === primaryLine);
  if (primaryIndex < 0) return sorted.slice(0, 7);
  const start = Math.max(0, Math.min(primaryIndex - 2, sorted.length - 7));
  return sorted.slice(start, start + 7);
}

/* ─── small components ─── */

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
    <View style={[s.valuePill, { alignItems: align }]}>
      <View style={s.valuePillMain}>
        <Text style={[s.valuePillPrice, { color: accentColor }]}>{formatOdds(price)}</Text>
        {logo ? <Image source={{ uri: logo }} style={s.bookLogo} /> : null}
      </View>
    </View>
  );
}

/* ─── Week Strip ─── */

function WeekStrip({
  weekOffset,
  selectedIso,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  accentColor,
}: {
  weekOffset: number;
  selectedIso: string;
  onSelectDay: (iso: string, date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  accentColor: string;
}) {
  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const { month, year } = formatMonthYear(days[0].date);

  return (
    <View style={s.weekSection}>
      <View style={s.monthRow}>
        <View style={s.monthLabel}>
          <Text style={s.monthText}>{month}</Text>
          <Text style={s.yearText}>{year}</Text>
        </View>
        <View style={s.weekNav}>
          <Pressable onPress={onPrevWeek} style={s.weekNavBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={18} color={brandColors.textSecondary} />
          </Pressable>
          <Pressable onPress={onNextWeek} style={s.weekNavBtn} hitSlop={12}>
            <Ionicons name="chevron-forward" size={18} color={brandColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={s.weekStrip}>
        {days.map((day, i) => {
          const selected = day.iso === selectedIso;
          return (
            <Pressable
              key={day.iso}
              onPress={() => {
                triggerSelectionHaptic();
                onSelectDay(day.iso, day.date);
              }}
              style={s.dayCell}
            >
              <Text style={s.dayLabel}>{DAY_LABELS[i]}</Text>
              <View style={[s.dayNumWrap, selected && { backgroundColor: accentColor }]}>
                <Text style={[s.dayNum, selected && s.dayNumSelected]}>{day.dayNum}</Text>
              </View>
              {day.isToday && !selected ? <View style={[s.todayDot, { backgroundColor: accentColor }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Odds Cell ─── */

function OddsCell({
  lineLabel,
  price,
  bookId,
  accentColor,
}: {
  lineLabel?: string;
  price: number | null;
  bookId: string | null;
  accentColor: string;
}) {
  const logo = bookId ? getSportsbookLogoUrl(bookId) : null;
  if (price == null) {
    return (
      <View style={s.oddsCell}>
        <Text style={s.oddsCellDash}>—</Text>
      </View>
    );
  }
  return (
    <View style={s.oddsCell}>
      {lineLabel ? <Text style={s.oddsCellLine}>{lineLabel}</Text> : null}
      <View style={s.oddsCellPriceRow}>
        <Text style={[s.oddsCellPrice, { color: accentColor }]}>{formatOdds(price)}</Text>
        {logo ? <Image source={{ uri: logo }} style={s.oddsCellBook} /> : null}
      </View>
    </View>
  );
}

/* ─── Game Card (DK-style grid) ─── */

function GameCard({
  event,
  ml,
  spread,
  total,
  sport,
  accentColor,
  preferredBooks,
  onPress,
}: {
  event: OddsEvent;
  ml: OddsTableRow | undefined;
  spread: OddsTableRow | undefined;
  total: OddsTableRow | undefined;
  sport: string;
  accentColor: string;
  preferredBooks: string[];
  onPress: () => void;
}) {
  const { time, ampm } = formatGameTime(event.commence_time);

  // Best price per side
  const mlAway = ml ? getBestSide(ml, "over", preferredBooks) : null;
  const mlHome = ml ? getBestSide(ml, "under", preferredBooks) : null;
  const spreadAway = spread ? getBestSide(spread, "over", preferredBooks) : null;
  const spreadHome = spread ? getBestSide(spread, "under", preferredBooks) : null;
  const totalOver = total ? getBestSide(total, "over", preferredBooks) : null;
  const totalUnder = total ? getBestSide(total, "under", preferredBooks) : null;

  // Sharp lines: for spreads, get each side separately (over=away, under=home)
  // so we display the correct signed line per team. For totals, one line is shared.
  const spreadLineAway = getSharpLineBySide(spread, "over");
  const spreadLineHome = getSharpLineBySide(spread, "under");
  const totalLine = getSharpLine(total);

  return (
    <Pressable
      onPress={() => { triggerLightImpactHaptic(); onPress(); }}
      style={({ pressed }) => [s.gameCard, pressed && s.gameCardPressed]}
    >
      {/* Time bar */}
      <View style={s.gameTimeBar}>
        <Text style={s.gameTimeText}>{time} {ampm}</Text>
        <Ionicons name="chevron-forward" size={14} color={brandColors.textMuted} />
      </View>

      {/* Column headers */}
      <View style={s.gridHeaderRow}>
        <View style={s.teamColHeader} />
        <Text style={s.gridHeaderText}>Spread</Text>
        <Text style={s.gridHeaderText}>Total</Text>
        <Text style={s.gridHeaderText}>ML</Text>
      </View>

      {/* Away team row */}
      <View style={s.gridRow}>
        <View style={s.teamCol}>
          <TeamLogo teamAbbr={event.away_team} sport={sport} size={26} style={s.gridTeamLogo} />
          <Text style={s.gridTeamName} numberOfLines={1}>{event.away_team}</Text>
        </View>
        <OddsCell
          lineLabel={spreadLineAway != null ? formatLine(spreadLineAway) : undefined}
          price={spreadAway?.price ?? null}
          bookId={spreadAway?.bookId ?? null}
          accentColor={accentColor}
        />
        <OddsCell
          lineLabel={totalLine != null ? `O ${totalLine}` : undefined}
          price={totalOver?.price ?? null}
          bookId={totalOver?.bookId ?? null}
          accentColor={accentColor}
        />
        <OddsCell
          price={mlAway?.price ?? null}
          bookId={mlAway?.bookId ?? null}
          accentColor={accentColor}
        />
      </View>

      {/* Divider */}
      <View style={s.gridDivider} />

      {/* Home team row */}
      <View style={s.gridRow}>
        <View style={s.teamCol}>
          <TeamLogo teamAbbr={event.home_team} sport={sport} size={26} style={s.gridTeamLogo} />
          <Text style={s.gridTeamName} numberOfLines={1}>{event.home_team}</Text>
        </View>
        <OddsCell
          lineLabel={spreadLineHome != null ? formatLine(spreadLineHome) : undefined}
          price={spreadHome?.price ?? null}
          bookId={spreadHome?.bookId ?? null}
          accentColor={accentColor}
        />
        <OddsCell
          lineLabel={totalLine != null ? `U ${totalLine}` : undefined}
          price={totalUnder?.price ?? null}
          bookId={totalUnder?.bookId ?? null}
          accentColor={accentColor}
        />
        <OddsCell
          price={mlHome?.price ?? null}
          bookId={mlHome?.bookId ?? null}
          accentColor={accentColor}
        />
      </View>
    </Pressable>
  );
}

/* ─── Alternate Line Scrubber ─── */

function AlternateLineScrubber({
  lines,
  selectedLine,
  primaryLine,
  isSpread,
  onSelectLine,
  accentColor,
}: {
  lines: OddsAlternateLine[];
  selectedLine: number;
  primaryLine: number;
  isSpread: boolean;
  onSelectLine: (ln: number) => void;
  accentColor: string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrubberContent}
    >
      {lines.map((line) => {
        const isSelected = line.ln === selectedLine;
        const isPrimary = line.ln === primaryLine;
        const label = isSpread ? formatLine(line.ln) : `${line.ln}`;

        return (
          <Pressable
            key={line.ln}
            onPress={() => {
              triggerSelectionHaptic();
              onSelectLine(line.ln);
            }}
            style={[
              s.scrubberChip,
              isSelected && { backgroundColor: accentColor, borderColor: accentColor },
              !isSelected && isPrimary && s.scrubberChipPrimary,
            ]}
          >
            <Text
              style={[
                s.scrubberChipText,
                isSelected && s.scrubberChipTextSelected,
                !isSelected && isPrimary && { color: accentColor },
              ]}
            >
              {label}
            </Text>
            {isPrimary && !isSelected ? <View style={[s.scrubberDot, { backgroundColor: accentColor }]} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ─── Book Comparison Table (EV card style) ─── */

function BookComparisonTable({
  books,
  overLabel,
  underLabel,
  accentColor,
}: {
  books: Array<[string, { over?: { price: number }; under?: { price: number } }]>;
  overLabel: string;
  underLabel: string;
  accentColor: string;
}) {
  // Find best prices
  const bestOverPrice = useMemo(() => {
    let best = -Infinity;
    for (const [, data] of books) {
      if (data.over && data.over.price > best) best = data.over.price;
    }
    return best === -Infinity ? null : best;
  }, [books]);

  const bestUnderPrice = useMemo(() => {
    let best = -Infinity;
    for (const [, data] of books) {
      if (data.under && data.under.price > best) best = data.under.price;
    }
    return best === -Infinity ? null : best;
  }, [books]);

  return (
    <View style={s.bookTable}>
      {/* Header */}
      <View style={s.bookTableHeader}>
        <Text style={[s.bookTableHeaderLabel, { color: accentColor }]}>{overLabel}</Text>
        <Text style={s.bookTableHeaderCenter}>Book</Text>
        <Text style={s.bookTableHeaderLabel}>{underLabel}</Text>
      </View>

      {/* Rows */}
      {books.map(([bookId, data]) => {
        const normalized = normalizeSportsbookId(bookId);
        const logo = getSportsbookLogoUrl(normalized);
        const isBestOver = data.over != null && data.over.price === bestOverPrice;
        const isBestUnder = data.under != null && data.under.price === bestUnderPrice;
        const overLink = getDeeplink(data, "over");
        const underLink = getDeeplink(data, "under");

        return (
          <View key={bookId} style={s.bookTableRow}>
            {/* Over cell */}
            <Pressable
              style={[s.bookTableCell, isBestOver && s.bookTableCellBest, overLink && s.bookTableCellTappable]}
              onPress={overLink ? () => { triggerLightImpactHaptic(); void Linking.openURL(overLink); } : undefined}
              disabled={!overLink}
            >
              <Text style={[s.bookTableCellText, isBestOver && { color: accentColor }]}>
                {data.over ? formatOdds(data.over.price) : "—"}
              </Text>
            </Pressable>

            {/* Book logo center */}
            <View style={s.bookTableCenter}>
              {logo ? (
                <Image source={{ uri: logo }} style={s.bookTableLogo} />
              ) : (
                <View style={s.bookTableLogoFallback}>
                  <Text style={s.bookTableLogoFallbackText}>{normalized.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>

            {/* Under cell */}
            <Pressable
              style={[s.bookTableCell, isBestUnder && s.bookTableCellBest, underLink && s.bookTableCellTappable]}
              onPress={underLink ? () => { triggerLightImpactHaptic(); void Linking.openURL(underLink); } : undefined}
              disabled={!underLink}
            >
              <Text style={[s.bookTableCellText, isBestUnder && { color: accentColor }]}>
                {data.under ? formatOdds(data.under.price) : "—"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Player Prop Row (screenshot-style) ─── */

// NHL counting stats where we always want 0.5 as default line
const NHL_ALWAYS_05_MARKETS = new Set(["player_goals", "player_points", "player_assists"]);

function PlayerPropRow({
  row,
  accentColor,
  selectedSportsbooks,
  expanded,
  onToggle,
  sport,
  headshotUrl,
}: {
  row: OddsTableRow;
  accentColor: string;
  selectedSportsbooks: string[];
  expanded: boolean;
  onToggle: () => void;
  sport: string;
  headshotUrl: string | null;
}) {
  const hasTeam = Boolean(row.team);
  const statLabel = getMarketStatLabel(row.mkt);

  const includeAlternates = supportsAlternates(row.mkt, row.ent);
  const alternatePlayerKey = useMemo(() => getAlternatePlayerKey(row.ent, row.player), [row.ent, row.player]);

  // For NHL counting stats, always fetch alternates so we can show the 0.5 line
  const needsHalfLine = sport === "nhl" && NHL_ALWAYS_05_MARKETS.has(row.mkt) && row.ln !== 0.5;

  const alternatesQuery = useOddsAlternates({
    sport,
    eventId: row.eid,
    market: row.mkt,
    playerKey: alternatePlayerKey,
    primaryLine: row.ln,
    enabled: (expanded && includeAlternates) || needsHalfLine,
  });

  const allLines = useMemo(
    () => (alternatesQuery.data?.all_lines ?? []).sort((a, b) => a.ln - b.ln),
    [alternatesQuery.data?.all_lines]
  );
  const primaryLine = alternatesQuery.data?.primary_ln ?? row.ln;

  // For NHL counting stats, auto-select 0.5 line when alternates load
  const halfLine = useMemo(
    () => needsHalfLine ? allLines.find((l) => l.ln === 0.5) ?? null : null,
    [needsHalfLine, allLines]
  );

  const [selectedAltLine, setSelectedAltLine] = useState<number | null>(null);
  const activeLine = selectedAltLine ?? (halfLine ? 0.5 : primaryLine);

  useEffect(() => {
    if (!expanded) setSelectedAltLine(null);
  }, [expanded]);

  // Get best odds — use 0.5 line data from alternates when available
  const over = useMemo(() => {
    if (halfLine && selectedAltLine == null) {
      return getBestSideFromBooks(halfLine.books, halfLine.best, 0.5, "over", selectedSportsbooks);
    }
    if (selectedAltLine != null && allLines.length > 0) {
      const alt = allLines.find((l) => l.ln === selectedAltLine);
      if (alt) return getBestSideFromBooks(alt.books, alt.best, selectedAltLine, "over", selectedSportsbooks);
    }
    return getBestSide(row, "over", selectedSportsbooks);
  }, [halfLine, selectedAltLine, allLines, row, selectedSportsbooks]);

  const under = useMemo(() => {
    if (halfLine && selectedAltLine == null) {
      return getBestSideFromBooks(halfLine.books, halfLine.best, 0.5, "under", selectedSportsbooks);
    }
    if (selectedAltLine != null && allLines.length > 0) {
      const alt = allLines.find((l) => l.ln === selectedAltLine);
      if (alt) return getBestSideFromBooks(alt.books, alt.best, selectedAltLine, "under", selectedSportsbooks);
    }
    return getBestSide(row, "under", selectedSportsbooks);
  }, [halfLine, selectedAltLine, allLines, row, selectedSportsbooks]);

  const activeBooks = useMemo(() => {
    if (selectedAltLine != null && allLines.length > 0) {
      const altLine = allLines.find((l) => l.ln === selectedAltLine);
      if (altLine) {
        return filterBookEntries(altLine.books, selectedSportsbooks) as Array<[string, { over?: { price: number }; under?: { price: number } }]>;
      }
    }
    if (halfLine) {
      return filterBookEntries(halfLine.books, selectedSportsbooks) as Array<[string, { over?: { price: number }; under?: { price: number } }]>;
    }
    // Filter to only books offering the primary line (not alternates)
    return filterBookEntriesByLine(row.books, selectedSportsbooks, row.ln) as Array<[string, { over?: { price: number }; under?: { price: number } }]>;
  }, [selectedAltLine, allLines, halfLine, row.books, selectedSportsbooks, row.ln]);

  const overLabel = `O ${activeLine}`;
  const underLabel = `U ${activeLine}`;

  function handleOddsPress(side: "over" | "under") {
    const best = side === "over" ? over : under;
    if (best.link) {
      triggerLightImpactHaptic();
      void Linking.openURL(best.link);
    }
  }

  return (
    <View style={s.propRow}>
      <Pressable
        style={s.propRowMain}
        onPress={() => { triggerLightImpactHaptic(); onToggle(); }}
      >
        {/* Player info */}
        <View style={s.propRowPlayer}>
          <View style={s.propRowAvatarWrap}>
            {headshotUrl ? (
              <Image source={{ uri: headshotUrl }} style={s.propRowAvatar} />
            ) : (
              <View style={[s.propRowAvatar, s.propRowAvatarFallback]}>
                <Ionicons name="person" size={18} color={brandColors.textMuted} />
              </View>
            )}
            {hasTeam ? (
              <View style={s.propRowTeamBadge}>
                <TeamLogo teamAbbr={row.team} sport={sport} size={14} />
              </View>
            ) : null}
          </View>
          <View style={s.propRowCopy}>
            <Text style={s.propRowName} numberOfLines={1}>{row.player ?? "Unknown"}</Text>
            {statLabel ? (
              <Text style={s.propRowStat}>
                <Text style={s.propRowStatLabel}>{statLabel}: </Text>
                <Text style={[s.propRowStatValue, { color: accentColor }]}>{activeLine}</Text>
              </Text>
            ) : (
              <Text style={s.propRowStat}>{marketLabelFromKey(row.mkt)} {activeLine}</Text>
            )}
          </View>
        </View>

        {/* Over / Under cells */}
        <View style={s.propRowCells}>
          <Pressable
            style={s.propRowCell}
            onPress={(e) => { e.stopPropagation(); handleOddsPress("over"); }}
          >
            <Text style={s.propRowCellLabel}>O {activeLine}</Text>
            <View style={s.propRowCellPriceRow}>
              <Text style={[s.propRowCellPrice, { color: accentColor }]}>{formatOdds(over.price)}</Text>
              {over.bookId ? <Image source={{ uri: getSportsbookLogoUrl(over.bookId)! }} style={s.propRowCellBook} /> : null}
            </View>
          </Pressable>
          <Pressable
            style={s.propRowCell}
            onPress={(e) => { e.stopPropagation(); handleOddsPress("under"); }}
          >
            <Text style={s.propRowCellLabel}>U {activeLine}</Text>
            <View style={s.propRowCellPriceRow}>
              <Text style={s.propRowCellPrice}>{formatOdds(under.price)}</Text>
              {under.bookId ? <Image source={{ uri: getSportsbookLogoUrl(under.bookId)! }} style={s.propRowCellBook} /> : null}
            </View>
          </Pressable>
        </View>
      </Pressable>

      {/* Expanded: alternates + book table */}
      {expanded ? (
        <View style={s.propRowExpanded}>
          {includeAlternates ? (
            alternatesQuery.isLoading ? (
              <View style={s.expandedStateRow}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={s.expandedStateText}>Loading lines…</Text>
              </View>
            ) : allLines.length > 1 ? (
              <AlternateLineScrubber
                lines={allLines}
                selectedLine={activeLine}
                primaryLine={primaryLine}
                isSpread={false}
                onSelectLine={setSelectedAltLine}
                accentColor={accentColor}
              />
            ) : null
          ) : null}

          {activeBooks.length > 0 ? (
            <BookComparisonTable
              books={activeBooks}
              overLabel={overLabel}
              underLabel={underLabel}
              accentColor={accentColor}
            />
          ) : (
            <Text style={s.expandedFootnote}>No book data available for this line.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

/* ─── Detail Market Card ─── */

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
  const isSpread = /spread|puck_line|run_line|handicap/i.test(row.mkt);
  const includeAlternates = supportsAlternates(row.mkt, row.ent);
  const alternatePlayerKey = useMemo(() => getAlternatePlayerKey(row.ent, row.player), [row.ent, row.player]);

  // Best odds for the primary line
  const over = getBestSide(row, "over", selectedSportsbooks);
  const under = getBestSide(row, "under", selectedSportsbooks);
  const sharpLine = isGameMarket ? getSharpLine(row) : null;
  const displayLine = sharpLine ?? row.ln;

  // Fetch alternates when expanded
  const alternatesQuery = useOddsAlternates({
    sport,
    eventId: row.eid,
    market: row.mkt,
    playerKey: alternatePlayerKey,
    primaryLine: row.ln,
    enabled: expanded && includeAlternates,
  });

  const allLines = useMemo(
    () => (alternatesQuery.data?.all_lines ?? []).sort((a, b) => a.ln - b.ln),
    [alternatesQuery.data?.all_lines]
  );

  const primaryLine = alternatesQuery.data?.primary_ln ?? row.ln;

  // Selected alternate line (defaults to primary)
  const [selectedAltLine, setSelectedAltLine] = useState<number | null>(null);
  const activeLine = selectedAltLine ?? primaryLine;

  // Reset selected alt when collapsing or switching markets
  useEffect(() => {
    if (!expanded) setSelectedAltLine(null);
  }, [expanded]);

  // Get the books for the active line (from alternates data or from the row itself)
  const activeBooks = useMemo(() => {
    if (selectedAltLine != null && allLines.length > 0) {
      const altLine = allLines.find((l) => l.ln === selectedAltLine);
      if (altLine) {
        return filterBookEntries(altLine.books, selectedSportsbooks) as Array<[string, { over?: { price: number }; under?: { price: number } }]>;
      }
    }
    // Filter to only books offering the primary line (not alternates)
    return filterBookEntriesByLine(row.books, selectedSportsbooks, row.ln) as Array<[string, { over?: { price: number }; under?: { price: number } }]>;
  }, [selectedAltLine, allLines, row.books, selectedSportsbooks, row.ln]);

  // Labels
  let overLabel: string;
  let underLabel: string;
  let titleLabel: string;
  let subtitleLabel: string;

  if (isGameMarket) {
    const ln = selectedAltLine ?? displayLine;
    if (isSpread) {
      // For spreads, read the line from each side's book data (over=away, under=home)
      // so the sign correctly reflects favorite/underdog per team
      const awayLine = selectedAltLine ?? getSharpLineBySide(row, "over") ?? ln;
      const homeLine = selectedAltLine != null ? -selectedAltLine : (getSharpLineBySide(row, "under") ?? (ln != null ? -ln : null));
      overLabel = `${row.ev.away.abbr} ${formatLine(awayLine)}`;
      underLabel = `${row.ev.home.abbr} ${formatLine(homeLine)}`;
    } else if (isTotal) {
      overLabel = `Over ${ln}`;
      underLabel = `Under ${ln}`;
    } else {
      overLabel = row.ev.away.abbr;
      underLabel = row.ev.home.abbr;
    }
    titleLabel = marketLabelFromKey(row.mkt);
    subtitleLabel = `${row.ev.away.abbr} @ ${row.ev.home.abbr}`;
  } else {
    const ln = selectedAltLine ?? row.ln;
    overLabel = `Over ${ln}`;
    underLabel = `Under ${ln}`;
    titleLabel = row.player || marketLabelFromKey(row.mkt);
    subtitleLabel = `${row.team ?? ""}${row.position ? ` · ${row.position}` : ""} · ${marketLabelFromKey(row.mkt)} ${ln}`;
  }

  return (
    <Pressable
      style={s.marketCard}
      onPress={() => { triggerLightImpactHaptic(); onToggle(); }}
    >
      {/* Header */}
      <View style={s.marketCardHeader}>
        <View style={s.marketCardCopy}>
          <Text style={s.marketCardTitle}>{titleLabel}</Text>
          <Text style={s.marketCardSubtitle}>{subtitleLabel}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={brandColors.textMuted} />
      </View>

      {/* Best odds summary (two cells) */}
      <View style={s.detailGridRow}>
        <View style={s.detailGridCell}>
          <Text style={s.detailGridLabel}>{overLabel}</Text>
          <View style={s.detailGridPriceRow}>
            <Text style={[s.detailGridPrice, { color: accentColor }]}>{formatOdds(over.price)}</Text>
            {over.bookId ? <Image source={{ uri: getSportsbookLogoUrl(over.bookId)! }} style={s.detailGridBook} /> : null}
          </View>
        </View>
        <View style={s.detailGridCell}>
          <Text style={s.detailGridLabel}>{underLabel}</Text>
          <View style={s.detailGridPriceRow}>
            <Text style={s.detailGridPrice}>{formatOdds(under.price)}</Text>
            {under.bookId ? <Image source={{ uri: getSportsbookLogoUrl(under.bookId)! }} style={s.detailGridBook} /> : null}
          </View>
        </View>
      </View>

      {/* Expanded: alt line scrubber + book table */}
      {expanded ? (
        <View style={s.expandedSection}>
          {/* Alternate line scrubber */}
          {includeAlternates ? (
            alternatesQuery.isLoading ? (
              <View style={s.expandedStateRow}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={s.expandedStateText}>Loading lines…</Text>
              </View>
            ) : allLines.length > 1 ? (
              <AlternateLineScrubber
                lines={allLines}
                selectedLine={activeLine}
                primaryLine={primaryLine}
                isSpread={isSpread}
                onSelectLine={setSelectedAltLine}
                accentColor={accentColor}
              />
            ) : null
          ) : null}

          {/* Book comparison table */}
          {activeBooks.length > 0 ? (
            <BookComparisonTable
              books={activeBooks}
              overLabel={overLabel}
              underLabel={underLabel}
              accentColor={accentColor}
            />
          ) : (
            <Text style={s.expandedFootnote}>No book data available for this line.</Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ─── Search overlay ─── */

function SearchOverlay({
  visible,
  query,
  onChangeQuery,
  onClose,
}: {
  visible: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, anim]);

  if (!visible) return null;

  return (
    <Animated.View style={[s.searchOverlay, { opacity: anim }]}>
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color={brandColors.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search games or teams..."
          placeholderTextColor={brandColors.textMuted}
          style={s.searchInput}
          returnKeyType="search"
        />
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close-circle" size={20} color={brandColors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* ─── Main Screen ─── */

export default function GamesScreen() {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedSport, setSelectedSport] = useState("nba");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [marketType, setMarketType] = useState<MarketType>("game");
  const [expandedPropId, setExpandedPropId] = useState<string | null>(null);
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const { preferences, savePreferences } = useUserPreferences();
  const [manualRefresh, setManualRefresh] = useState(false);

  const accentColor = SPORT_ACCENTS[selectedSport] ?? brandColors.primary;
  const selectedSportsbooks = preferences.preferredSportsbooks;
  const selectedIso = selectedDate.toISOString().slice(0, 10);

  // Fetch ALL events, filter by date client-side using device timezone
  const eventsQuery = useOddsEvents({
    sport: selectedSport,
  });

  const previewKeys = PREVIEW_MARKETS[selectedSport] ?? PREVIEW_MARKETS.nba;
  const moneylineQuery = useOddsTable({ sport: selectedSport, market: previewKeys.moneyline, scope: "pregame", limit: 400 });
  const spreadQuery = useOddsTable({ sport: selectedSport, market: previewKeys.spread, scope: "pregame", limit: 400 });
  const totalQuery = useOddsTable({ sport: selectedSport, market: previewKeys.total, scope: "pregame", limit: 400 });

  const playerMarkets = PLAYER_MARKETS[selectedSport] ?? [];
  const gameMarkets = GAME_MARKETS[selectedSport] ?? [];
  const [selectedGameMarket, setSelectedGameMarket] = useState(gameMarkets[0]?.key ?? "game_moneyline");
  const [selectedPlayerMarket, setSelectedPlayerMarket] = useState(playerMarkets[0]?.key ?? "player_points");

  useEffect(() => {
    setSelectedGameId(null);
    setSearchQuery("");
    setSearchOpen(false);
    setMarketType("game");
    setExpandedPropId(null);
    setSelectedGameMarket((GAME_MARKETS[selectedSport] ?? [])[0]?.key ?? "game_moneyline");
    setSelectedPlayerMarket((PLAYER_MARKETS[selectedSport] ?? [])[0]?.key ?? "player_points");
  }, [selectedSport, selectedDate]);

  const detailMarket = marketType === "game" ? selectedGameMarket : selectedPlayerMarket;

  const detailQuery = useOddsTable({
    sport: selectedSport,
    market: detailMarket,
    scope: "pregame",
    limit: 400,
    enabled: Boolean(selectedGameId),
  });

  const eventIds = useMemo(() => new Set((eventsQuery.data?.events ?? []).map((e) => e.event_id)), [eventsQuery.data?.events]);

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
    const allEvents = eventsQuery.data?.events ?? [];
    // Client-side date filter using device timezone
    const dateFiltered = allEvents.filter((e) => eventMatchesDate(e.commence_time, selectedDate));
    const query = searchQuery.trim().toLowerCase();
    if (!query || selectedGameId) return dateFiltered;
    return dateFiltered.filter((event) =>
      buildEventLabel(event).toLowerCase().includes(query) ||
      event.home_team_name.toLowerCase().includes(query) ||
      event.away_team_name.toLowerCase().includes(query)
    );
  }, [eventsQuery.data?.events, searchQuery, selectedGameId, selectedDate]);

  // Group events by time of day
  const groupedEvents = useMemo(() => {
    const groups: { key: TimeGroup; label: string; events: OddsEvent[] }[] = [];
    const groupMap = new Map<TimeGroup, OddsEvent[]>();

    for (const event of filteredEvents) {
      const group = getTimeGroup(event.commence_time);
      const existing = groupMap.get(group) ?? [];
      existing.push(event);
      groupMap.set(group, existing);
    }

    const order: TimeGroup[] = ["morning", "afternoon", "evening"];
    for (const key of order) {
      const events = groupMap.get(key);
      if (events && events.length > 0) {
        groups.push({ key, label: timeGroupLabel(key), events });
      }
    }
    return groups;
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => (eventsQuery.data?.events ?? []).find((e) => e.event_id === selectedGameId) ?? null,
    [eventsQuery.data?.events, selectedGameId]
  );

  const detailRows = useMemo(() => {
    const rows = detailQuery.data?.rows ?? [];
    let filtered = rows.filter((row) => row.eid === selectedGameId);

    // For player props, deduplicate by player — keep one row per player.
    // For NHL goals/points/assists, prefer 0.5 line as default.
    if (marketType === "player" && filtered.length > 0) {
      const NHL_05_MARKETS = new Set(["player_goals", "player_points", "player_assists"]);
      const preferHalf = selectedSport === "nhl" && NHL_05_MARKETS.has(detailMarket);

      const byPlayer = new Map<string, OddsTableRow>();
      for (const row of filtered) {
        const key = row.player ?? row.ent;
        const existing = byPlayer.get(key);
        if (!existing) {
          byPlayer.set(key, row);
        } else if (preferHalf && row.ln === 0.5 && existing.ln !== 0.5) {
          // Prefer 0.5 line for NHL counting stats
          byPlayer.set(key, row);
        }
        // Otherwise keep the first row (primary line from API)
      }
      filtered = Array.from(byPlayer.values());
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query || marketType === "game") return filtered;
    return filtered.filter((row) =>
      String(row.player || "").toLowerCase().includes(query) ||
      String(row.team || "").toLowerCase().includes(query) ||
      marketLabelFromKey(row.mkt).toLowerCase().includes(query)
    );
  }, [detailQuery.data?.rows, selectedGameId, searchQuery, marketType, selectedSport, detailMarket]);

  // Batch-fetch player headshots for visible player rows
  const playerNames = useMemo(
    () => marketType === "player" ? detailRows.map((r) => r.player).filter((n): n is string => Boolean(n)) : [],
    [detailRows, marketType]
  );
  const headshotsQuery = usePlayerHeadshots(playerNames);
  const headshotMap = headshotsQuery.data ?? {};

  const eventsFirstLoad = !eventsQuery.data && eventsQuery.isLoading;
  const previewFirstLoad = !moneylineQuery.data && moneylineQuery.isLoading;

  async function handleRefresh() {
    setManualRefresh(true);
    await Promise.all([
      eventsQuery.refetch(),
      moneylineQuery.refetch(),
      spreadQuery.refetch(),
      totalQuery.refetch(),
    ]);
    setManualRefresh(false);
  }

  const sportLabel = SPORTS.find((sp) => sp.key === selectedSport)?.label ?? "NBA";

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        {selectedGameId ? (
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setSelectedGameId(null);
              setExpandedPropId(null);
              setSearchQuery("");
            }}
            style={s.backBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={20} color={brandColors.textPrimary} />
          </Pressable>
        ) : null}

        <Text style={s.headerTitle}>{selectedGameId ? "Game Odds" : "Games"}</Text>

        <View style={s.headerActions}>
          {!selectedGameId ? (
            <>
              {/* Sport picker */}
              <Pressable
                onPress={() => {
                  triggerSelectionHaptic();
                  setSportPickerOpen(!sportPickerOpen);
                }}
                style={[s.sportBtn, sportPickerOpen && { borderColor: accentColor }]}
              >
                <Text style={[s.sportBtnText, { color: accentColor }]}>{sportLabel}</Text>
                <Ionicons name="chevron-down" size={12} color={accentColor} />
              </Pressable>

              {/* Search */}
              <Pressable
                onPress={() => {
                  triggerSelectionHaptic();
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setSearchQuery("");
                }}
                style={s.iconBtn}
              >
                <Ionicons name="search" size={18} color={brandColors.textSecondary} />
              </Pressable>
            </>
          ) : null}

          {/* Sportsbooks */}
          <Pressable
            onPress={() => { triggerSelectionHaptic(); setPickerVisible(true); }}
            style={s.iconBtn}
          >
            <Ionicons name="options-outline" size={18} color={brandColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Sport dropdown */}
      {sportPickerOpen && !selectedGameId ? (
        <View style={s.sportDropdown}>
          {SPORTS.map((sport) => {
            const active = sport.key === selectedSport;
            const sportAccent = SPORT_ACCENTS[sport.key] ?? brandColors.primary;
            return (
              <Pressable
                key={sport.key}
                onPress={() => {
                  triggerSelectionHaptic();
                  setSelectedSport(sport.key);
                  setSportPickerOpen(false);
                }}
                style={[s.sportDropdownItem, active && { backgroundColor: `${sportAccent}14` }]}
              >
                <View style={[s.sportDot, { backgroundColor: sportAccent }]} />
                <Text style={[s.sportDropdownText, active && { color: sportAccent, fontWeight: "800" }]}>{sport.label}</Text>
                {active ? <Ionicons name="checkmark" size={16} color={sportAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Search bar */}
      <SearchOverlay
        visible={searchOpen}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={manualRefresh}
            onRefresh={() => void handleRefresh()}
            tintColor={accentColor}
          />
        }
      >
        {!selectedGameId ? (
          <>
            {/* Week Strip */}
            <WeekStrip
              weekOffset={weekOffset}
              selectedIso={selectedIso}
              onSelectDay={(iso, date) => setSelectedDate(date)}
              onPrevWeek={() => { triggerSelectionHaptic(); setWeekOffset((o) => o - 1); }}
              onNextWeek={() => { triggerSelectionHaptic(); setWeekOffset((o) => o + 1); }}
              accentColor={accentColor}
            />

            {/* Day header */}
            <View style={s.dayHeaderRow}>
              <Text style={s.dayHeaderText}>{formatDayHeader(selectedDate)}</Text>
              <Text style={s.dayHeaderCount}>
                {filteredEvents.length} game{filteredEvents.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* Games list */}
            {eventsFirstLoad || previewFirstLoad ? (
              <View style={s.listArea}>
                <StateView state="loading" skeletonCount={3} />
              </View>
            ) : filteredEvents.length === 0 ? (
              <View style={s.listArea}>
                <StateView
                  state="empty"
                  icon="calendar-outline"
                  title="No games"
                  message={`No ${sportLabel} games scheduled for this date.`}
                />
              </View>
            ) : (
              <View style={s.listArea}>
                {groupedEvents.map((group) => (
                  <View key={group.key}>
                    <View style={s.timeGroupHeader}>
                      <Text style={s.timeGroupLabel}>{group.label}</Text>
                      <View style={s.timeGroupLine} />
                    </View>
                    {group.events.map((event) => (
                      <GameCard
                        key={event.event_id}
                        event={event}
                        ml={moneylineByEvent.get(event.event_id)?.[0]}
                        spread={spreadByEvent.get(event.event_id)?.[0]}
                        total={totalByEvent.get(event.event_id)?.[0]}
                        sport={selectedSport}
                        accentColor={accentColor}
                        preferredBooks={selectedSportsbooks}
                        onPress={() => {
                          setSelectedGameId(event.event_id);
                          setExpandedPropId(null);
                          setSearchQuery("");
                          setSearchOpen(false);
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : selectedEvent ? (
          <View style={s.detailArea}>
            {/* ─── Hero: logos + matchup ─── */}
            <View style={s.detailHero}>
              <View style={s.detailHeroMatchup}>
                <View style={s.detailHeroTeam}>
                  <View style={s.detailHeroLogo}>
                    <TeamLogo teamAbbr={selectedEvent.away_team} sport={selectedSport} size={56} />
                  </View>
                  <Text style={s.detailHeroAbbr}>{selectedEvent.away_team}</Text>
                </View>

                <View style={s.detailHeroCenter}>
                  <Text style={s.detailHeroDate}>
                    {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </Text>
                  <Text style={s.detailHeroTime}>
                    {formatGameTime(selectedEvent.commence_time).time} {formatGameTime(selectedEvent.commence_time).ampm}
                  </Text>
                </View>

                <View style={s.detailHeroTeam}>
                  <View style={s.detailHeroLogo}>
                    <TeamLogo teamAbbr={selectedEvent.home_team} sport={selectedSport} size={56} />
                  </View>
                  <Text style={s.detailHeroAbbr}>{selectedEvent.home_team}</Text>
                </View>
              </View>
            </View>

            {/* ─── Game / Player toggle ─── */}
            {hasPlayerMarkets(selectedSport) ? (
              <View style={s.typeToggle}>
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
                      style={[s.typeToggleBtn, active && s.typeToggleBtnActive]}
                    >
                      <Text style={[s.typeToggleText, active && s.typeToggleTextActive]}>
                        {value === "game" ? "Game Props" : "Player Props"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* ─── Market rail ─── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.marketRail}>
              {(marketType === "game" ? gameMarkets : playerMarkets).map((market) => {
                const active = detailMarket === market.key;
                return (
                  <Pressable
                    key={market.key}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setExpandedPropId(null);
                      if (marketType === "game") setSelectedGameMarket(market.key);
                      else setSelectedPlayerMarket(market.key);
                    }}
                    style={[s.marketChip, active && s.marketChipActive]}
                  >
                    <Text style={[s.marketChipText, active && s.marketChipTextActive]}>{market.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ─── Player search ─── */}
            {marketType === "player" ? (
              <View style={s.detailSearchBar}>
                <Ionicons name="search-outline" size={16} color={brandColors.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search players..."
                  placeholderTextColor={brandColors.textMuted}
                  style={s.detailSearchInput}
                />
              </View>
            ) : null}

            {/* ─── Market rows ─── */}
            {detailQuery.isLoading ? (
              <StateView state="loading" skeletonCount={3} />
            ) : detailRows.length === 0 ? (
              <StateView state="empty" icon="stats-chart-outline" title="No odds" message="No odds available for this market." />
            ) : marketType === "player" ? (
              <View style={s.propList}>
                {/* Column headers */}
                <View style={s.propColumnHeaders}>
                  <View style={{ flex: 1 }} />
                  <Text style={s.propColumnHeader}>Over</Text>
                  <Text style={s.propColumnHeader}>Under</Text>
                </View>
                {detailRows.map((row) => {
                  const expanded = expandedPropId === `${row.eid}-${row.ent}-${row.mkt}-${row.ln}`;
                  return (
                    <PlayerPropRow
                      key={`${row.eid}-${row.ent}-${row.mkt}-${row.ln}`}
                      row={row}
                      accentColor={accentColor}
                      selectedSportsbooks={selectedSportsbooks}
                      expanded={expanded}
                      onToggle={() => setExpandedPropId(expanded ? null : `${row.eid}-${row.ent}-${row.mkt}-${row.ln}`)}
                      sport={selectedSport}
                      headshotUrl={row.player ? headshotMap[row.player] ?? null : null}
                    />
                  );
                })}
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

/* ─── styles ─── */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  scrollContent: {
    paddingBottom: 90,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  sportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sportBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sport dropdown */
  sportDropdown: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
    overflow: "hidden",
  },
  sportDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sportDropdownText: {
    flex: 1,
    color: brandColors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },

  /* Search overlay */
  searchOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 15,
    paddingVertical: 10,
  },

  /* Week strip */
  weekSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthLabel: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  monthText: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  yearText: {
    color: brandColors.textMuted,
    fontSize: 20,
    fontWeight: "500",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  weekNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  weekStrip: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dayNumWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    color: brandColors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  dayNumSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: -2,
  },

  /* Day header */
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  dayHeaderText: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  dayHeaderCount: {
    color: brandColors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },

  /* Time groups */
  timeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  timeGroupLabel: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  timeGroupLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  /* Game list */
  listArea: {
    paddingHorizontal: 16,
    gap: 10,
  },

  /* Game card (DK grid) */
  gameCard: {
    borderRadius: 18,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: brandColors.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  gameCardPressed: {
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  gameTimeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  gameTimeText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  gridHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  teamColHeader: {
    flex: 1,
  },
  gridHeaderText: {
    width: 76,
    textAlign: "center",
    marginHorizontal: 2,
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  teamCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  gridTeamLogo: {
    borderRadius: 13,
    overflow: "hidden",
  },
  gridTeamName: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  gridDivider: {
    height: 1,
    marginHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  oddsCell: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    minHeight: 42,
    gap: 1,
  },
  oddsCellLine: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  oddsCellPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  oddsCellPrice: {
    fontSize: 13,
    fontWeight: "800",
  },
  oddsCellBook: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  oddsCellDash: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },

  /* Odds pills (used in detail) */
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

  /* Detail */
  detailArea: {
    paddingHorizontal: 16,
    gap: 12,
  },
  detailHero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  detailHeroMatchup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailHeroTeam: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  detailHeroLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  detailHeroAbbr: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  detailHeroCenter: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  detailHeroDate: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  detailHeroTime: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Detail grid cells (used in game/player prop cards) */
  detailGridRow: {
    flexDirection: "row",
    gap: 8,
  },
  detailGridCell: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  detailGridLabel: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  detailGridPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailGridPrice: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  detailGridBook: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  detailSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    minHeight: 40,
  },
  detailSearchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 14,
    paddingVertical: 8,
  },

  /* Type toggle */
  typeToggle: {
    flexDirection: "row",
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: brandColors.border,
    borderRadius: 14,
    padding: 3,
  },
  typeToggleBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  typeToggleBtnActive: {
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

  /* Market rail */
  marketRail: {
    gap: 8,
    paddingRight: 16,
  },
  marketChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 14,
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

  /* Market cards */
  marketCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  /* Expanded section */
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 10,
    gap: 10,
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
    paddingVertical: 4,
  },
  expandedStateText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  expandedFootnote: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 6,
  },

  /* Alternate line scrubber */
  scrubberContent: {
    gap: 6,
    paddingVertical: 2,
  },
  scrubberChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    minWidth: 50,
  },
  scrubberChipPrimary: {
    borderColor: "rgba(56,189,248,0.20)",
    backgroundColor: "rgba(56,189,248,0.06)",
  },
  scrubberChipText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  scrubberChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  scrubberDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },

  /* Book comparison table (EV card style) */
  bookTable: {
    gap: 3,
  },
  bookTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  bookTableHeaderLabel: {
    flex: 1,
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  bookTableHeaderCenter: {
    width: 36,
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  bookTableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  bookTableCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  bookTableCellBest: {
    backgroundColor: "rgba(56,189,248,0.08)",
    borderColor: "rgba(56,189,248,0.22)",
  },
  bookTableCellTappable: {
    // subtle visual hint that the cell is tappable (no-op, used for pressed state)
  },
  bookTableCellText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  bookTableCenter: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  bookTableLogo: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  bookTableLogoFallback: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookTableLogoFallbackText: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700",
  },

  /* Player prop list */
  propList: {
    gap: 0,
  },
  propColumnHeaders: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  propColumnHeader: {
    width: 90,
    textAlign: "center",
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  /* Player prop row */
  propRow: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  propRowMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  propRowPlayer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  propRowAvatarWrap: {
    width: 44,
    height: 44,
    position: "relative",
  },
  propRowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  propRowAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  propRowTeamBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: brandColors.appBackground,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  propRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  propRowName: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  propRowStat: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  propRowStatLabel: {
    color: brandColors.textMuted,
    fontWeight: "700",
  },
  propRowStatValue: {
    fontWeight: "800",
  },
  propRowCells: {
    flexDirection: "row",
    gap: 6,
  },
  propRowCell: {
    width: 86,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 2,
  },
  propRowCellLabel: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  propRowCellPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  propRowCellPrice: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  propRowCellBook: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  propRowExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
});
