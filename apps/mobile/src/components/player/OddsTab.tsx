import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { brandColors } from "@/src/theme/brand";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { fmtPct, fmtLine, fmtOdds, hitColor } from "./constants";

interface LadderLine {
  line: number;
  bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
  bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
}

interface OddsTabProps {
  ladderLines: LadderLine[];
  lineHitRates: Map<number, { l5: number | null; l10: number | null; l20: number | null; szn: number | null }>;
  chartLine: number | null;
  onSelectLine: (line: number) => void;
}

export function OddsTab({ ladderLines, lineHitRates, chartLine, onSelectLine }: OddsTabProps) {
  if (ladderLines.length === 0) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyText}>No odds lines available.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.table}>
          {/* Header */}
          <View style={s.headerRow}>
            <Text style={[s.headerCell, s.lineCol]}>LINE</Text>
            <Text style={[s.headerCell, s.oddsCol]}>OVER</Text>
            <Text style={[s.headerCell, s.oddsCol]}>UNDER</Text>
            <Text style={[s.headerCell, s.hitCol]}>L5</Text>
            <Text style={[s.headerCell, s.hitCol]}>L10</Text>
            <Text style={[s.headerCell, s.hitCol]}>L20</Text>
            <Text style={[s.headerCell, s.hitCol]}>SZN</Text>
          </View>

          {/* Rows */}
          {ladderLines.map((item) => {
            const isActive = chartLine != null && item.line === chartLine;
            const rates = lineHitRates.get(item.line);
            const overLogo = item.bestOver?.book ? getSportsbookLogoUrl(item.bestOver.book) : null;
            const underLogo = item.bestUnder?.book ? getSportsbookLogoUrl(item.bestUnder.book) : null;

            return (
              <Pressable
                key={`line-${item.line}`}
                onPress={() => onSelectLine(item.line)}
                style={[s.row, isActive && s.rowActive]}
              >
                <Text style={[s.lineText, isActive && s.lineTextActive, s.lineCol]}>
                  {fmtLine(item.line)}
                </Text>
                <View style={[s.oddsCell, s.oddsCol]}>
                  {overLogo ? <Image source={{ uri: overLogo }} style={s.bookLogo} /> : null}
                  <Text style={s.priceText}>{item.bestOver ? fmtOdds(item.bestOver.price) : "—"}</Text>
                </View>
                <View style={[s.oddsCell, s.oddsCol]}>
                  {underLogo ? <Image source={{ uri: underLogo }} style={s.bookLogo} /> : null}
                  <Text style={s.priceText}>{item.bestUnder ? fmtOdds(item.bestUnder.price) : "—"}</Text>
                </View>
                <Text style={[s.hitText, { color: hitColor(rates?.l5) }, s.hitCol]}>
                  {fmtPct(rates?.l5)}
                </Text>
                <Text style={[s.hitText, { color: hitColor(rates?.l10) }, s.hitCol]}>
                  {fmtPct(rates?.l10)}
                </Text>
                <Text style={[s.hitText, { color: hitColor(rates?.l20) }, s.hitCol]}>
                  {fmtPct(rates?.l20)}
                </Text>
                <Text style={[s.hitText, { color: hitColor(rates?.szn) }, s.hitCol]}>
                  {fmtPct(rates?.szn)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 4 },

  table: {
    backgroundColor: brandColors.panelBackground,
    borderRadius: 12, borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  headerCell: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5
  },
  lineCol: { width: 52 },
  oddsCol: { width: 80, textAlign: "center" },
  hitCol: { width: 44, textAlign: "center" },

  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  rowActive: { backgroundColor: "rgba(34, 197, 94, 0.08)", borderRadius: 8, marginVertical: 1 },

  lineText: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "800" },
  lineTextActive: { color: "#22C55E" },

  oddsCell: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  bookLogo: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#0A0F1B" },
  priceText: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "600" },

  hitText: { fontSize: 13, fontWeight: "800", textAlign: "center" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
