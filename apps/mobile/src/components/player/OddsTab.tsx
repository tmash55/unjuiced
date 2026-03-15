import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { fmtPct, fmtLine, fmtOdds, hitColor } from "./constants";

interface BookOdds {
  price: number;
  url: string | null;
  mobileUrl: string | null;
  sgp: string | null;
}

interface LadderLine {
  line: number;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
  books: Record<string, { over?: BookOdds; under?: BookOdds }>;
}

interface OddsTabProps {
  ladderLines: LadderLine[];
  lineHitRates: Map<number, { l5: number | null; l10: number | null; l20: number | null; szn: number | null }>;
  chartLine: number | null;
  onSelectLine: (line: number) => void;
}

const BOOK_DISPLAY_ORDER = [
  "draftkings", "fanduel", "betmgm", "caesars", "fanatics",
  "espnbet", "bet365", "hardrock", "betrivers", "betparx",
  "fliff", "novig", "pinnacle", "bovada", "kalshi",
];

function bookLabel(id: string): string {
  const labels: Record<string, string> = {
    draftkings: "DraftKings", fanduel: "FanDuel", betmgm: "BetMGM",
    caesars: "Caesars", fanatics: "Fanatics", espnbet: "ESPN BET",
    bet365: "bet365", hardrock: "Hard Rock", betrivers: "BetRivers",
    betparx: "BetParx", fliff: "Fliff", novig: "Novig",
    pinnacle: "Pinnacle", bovada: "Bovada", kalshi: "Kalshi",
    rebet: "Rebet", circa: "Circa", thescore: "theScore",
    ballybet: "Bally Bet", polymarket: "Polymarket", prophetx: "ProphetX",
  };
  return labels[id] ?? id;
}

function priceColor(price: number, isBest: boolean): string {
  if (isBest) return "#22C55E";
  return brandColors.textSecondary;
}

function openBookLink(odds: BookOdds | undefined) {
  if (!odds) return;
  const url = odds.mobileUrl || odds.url;
  if (url) void Linking.openURL(url);
}

export function OddsTab({ ladderLines, lineHitRates, chartLine, onSelectLine }: OddsTabProps) {
  const [expandedLine, setExpandedLine] = useState<number | null>(null);

  if (ladderLines.length === 0) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyText}>No odds lines available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
      {ladderLines.map((item) => {
        const isActive = chartLine != null && item.line === chartLine;
        const isExpanded = expandedLine === item.line;
        const rates = lineHitRates.get(item.line);
        const overLogo = item.bestOver?.book ? getSportsbookLogoUrl(item.bestOver.book) : null;
        const underLogo = item.bestUnder?.book ? getSportsbookLogoUrl(item.bestUnder.book) : null;

        // Sort books by display order, then alphabetically for unknown books
        const bookEntries = Object.entries(item.books);
        const sortedBooks = bookEntries.sort(([a], [b]) => {
          const ai = BOOK_DISPLAY_ORDER.indexOf(a);
          const bi = BOOK_DISPLAY_ORDER.indexOf(b);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.localeCompare(b);
        });

        return (
          <View key={`line-${item.line}`} style={[s.lineCard, isActive && s.lineCardActive]}>
            {/* Summary row */}
            <Pressable
              style={s.summaryRow}
              onPress={() => {
                onSelectLine(item.line);
                setExpandedLine(isExpanded ? null : item.line);
              }}
            >
              <Text style={[s.lineText, isActive && s.lineTextActive]}>
                {fmtLine(item.line)}
              </Text>

              <View style={s.bestOddsWrap}>
                <View style={s.bestOddsCol}>
                  <Text style={s.bestLabel}>OVER</Text>
                  <View style={s.bestOddsRow}>
                    {overLogo ? <Image source={{ uri: overLogo }} style={s.bookLogoSm} /> : null}
                    <Text style={[s.bestPrice, item.bestOver && { color: "#22C55E" }]}>
                      {item.bestOver ? fmtOdds(item.bestOver.price) : "—"}
                    </Text>
                  </View>
                </View>
                <View style={s.bestOddsCol}>
                  <Text style={s.bestLabel}>UNDER</Text>
                  <View style={s.bestOddsRow}>
                    {underLogo ? <Image source={{ uri: underLogo }} style={s.bookLogoSm} /> : null}
                    <Text style={[s.bestPrice, item.bestUnder && { color: "#22C55E" }]}>
                      {item.bestUnder ? fmtOdds(item.bestUnder.price) : "—"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Hit rates */}
              <View style={s.hitRatesWrap}>
                {(["l5", "l10", "l20", "szn"] as const).map((period) => (
                  <View key={period} style={s.hitRateChip}>
                    <Text style={s.hitRateLabel}>{period.toUpperCase()}</Text>
                    <Text style={[s.hitRateVal, { color: hitColor(rates?.[period] ?? null) }]}>
                      {fmtPct(rates?.[period] ?? null)}
                    </Text>
                  </View>
                ))}
              </View>

              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={brandColors.textMuted}
              />
            </Pressable>

            {/* Expanded book odds */}
            {isExpanded && sortedBooks.length > 0 ? (
              <View style={s.booksContainer}>
                {/* Book header */}
                <View style={s.bookHeader}>
                  <Text style={[s.bookHeaderText, { flex: 1 }]}>BOOK</Text>
                  <Text style={[s.bookHeaderText, s.bookOddsCol]}>OVER</Text>
                  <Text style={[s.bookHeaderText, s.bookOddsCol]}>UNDER</Text>
                </View>

                {sortedBooks.map(([bookId, odds]) => {
                  const logo = getSportsbookLogoUrl(bookId);
                  const isBestOver = item.bestOver?.book === bookId;
                  const isBestUnder = item.bestUnder?.book === bookId;
                  const hasOverLink = !!(odds.over?.mobileUrl || odds.over?.url);
                  const hasUnderLink = !!(odds.under?.mobileUrl || odds.under?.url);

                  return (
                    <View key={bookId} style={s.bookRow}>
                      <View style={s.bookNameCol}>
                        {logo ? <Image source={{ uri: logo }} style={s.bookLogo} /> : null}
                        <Text style={s.bookName} numberOfLines={1}>{bookLabel(bookId)}</Text>
                      </View>
                      <Pressable
                        style={[s.bookOddsCol, s.bookOddsCell, isBestOver && s.bookOddsBest]}
                        onPress={() => openBookLink(odds.over)}
                        disabled={!hasOverLink}
                      >
                        <Text style={[s.bookPrice, { color: priceColor(odds.over?.price ?? 0, isBestOver) }]}>
                          {odds.over ? fmtOdds(odds.over.price) : "—"}
                        </Text>
                        {hasOverLink ? (
                          <Ionicons name="open-outline" size={10} color={brandColors.textMuted} />
                        ) : null}
                      </Pressable>
                      <Pressable
                        style={[s.bookOddsCol, s.bookOddsCell, isBestUnder && s.bookOddsBest]}
                        onPress={() => openBookLink(odds.under)}
                        disabled={!hasUnderLink}
                      >
                        <Text style={[s.bookPrice, { color: priceColor(odds.under?.price ?? 0, isBestUnder) }]}>
                          {odds.under ? fmtOdds(odds.under.price) : "—"}
                        </Text>
                        {hasUnderLink ? (
                          <Ionicons name="open-outline" size={10} color={brandColors.textMuted} />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 4 },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" },

  lineCard: {
    backgroundColor: brandColors.panelBackground,
    borderRadius: 12, borderWidth: 1, borderColor: brandColors.border,
    marginBottom: 8, overflow: "hidden",
  },
  lineCardActive: {
    borderColor: "rgba(34, 197, 94, 0.3)",
  },

  summaryRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },

  lineText: { color: brandColors.textPrimary, fontSize: 20, fontWeight: "900", width: 44 },
  lineTextActive: { color: "#22C55E" },

  bestOddsWrap: { flexDirection: "row", gap: 12 },
  bestOddsCol: { alignItems: "center", gap: 2 },
  bestLabel: { color: brandColors.textMuted, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  bestOddsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookLogoSm: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#0A0F1B" },
  bestPrice: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "700" },

  hitRatesWrap: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 4 },
  hitRateChip: { alignItems: "center", minWidth: 30 },
  hitRateLabel: { color: brandColors.textMuted, fontSize: 8, fontWeight: "700" },
  hitRateVal: { fontSize: 12, fontWeight: "800" },

  // Expanded books section
  booksContainer: {
    borderTopWidth: 1, borderTopColor: brandColors.border,
    paddingBottom: 4,
  },
  bookHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  bookHeaderText: {
    color: brandColors.textMuted, fontSize: 9, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  bookOddsCol: { width: 70, textAlign: "center" },

  bookRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  bookNameCol: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  bookLogo: { width: 20, height: 20, borderRadius: 4, backgroundColor: "#0A0F1B" },
  bookName: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },

  bookOddsCell: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 4, borderRadius: 6,
  },
  bookOddsBest: { backgroundColor: "rgba(34, 197, 94, 0.08)" },
  bookPrice: { fontSize: 14, fontWeight: "700" },
});
