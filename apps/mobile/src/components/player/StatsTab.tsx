import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PlayerBoxScoreGame } from "@unjuiced/types";
import { brandColors } from "@/src/theme/brand";
import { fmtDate, BAR_HIT, BAR_MISS } from "./constants";

type SortKey = "date" | "opp" | "min" | "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "tov" | "fgPct" | "plusMinus";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; width: number }[] = [
  { key: "date", label: "DATE", width: 56 },
  { key: "opp", label: "OPP", width: 52 },
  { key: "min", label: "MIN", width: 40 },
  { key: "pts", label: "PTS", width: 40 },
  { key: "reb", label: "REB", width: 40 },
  { key: "ast", label: "AST", width: 40 },
  { key: "fg3m", label: "3PM", width: 40 },
  { key: "stl", label: "STL", width: 38 },
  { key: "blk", label: "BLK", width: 38 },
  { key: "tov", label: "TOV", width: 38 },
  { key: "fgPct", label: "FG%", width: 48 },
  { key: "plusMinus", label: "+/-", width: 44 }
];

interface StatsTabProps {
  allGames: PlayerBoxScoreGame[];
  chartMarket: string;
  chartLine: number | null;
}

function getStatValue(game: PlayerBoxScoreGame, key: SortKey): number | string {
  switch (key) {
    case "date": return game.date;
    case "opp": return game.opponentAbbr;
    case "min": return Math.round(game.minutes);
    case "pts": return game.pts;
    case "reb": return game.reb;
    case "ast": return game.ast;
    case "fg3m": return game.fg3m;
    case "stl": return game.stl;
    case "blk": return game.blk;
    case "tov": return game.tov;
    case "fgPct": return game.fga > 0 ? Math.round(game.fgPct * 100) : 0;
    case "plusMinus": return game.plusMinus;
    default: return 0;
  }
}

export function StatsTab({ allGames, chartMarket, chartLine }: StatsTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedGames = useMemo(() => {
    return [...allGames].sort((a, b) => {
      const av = getStatValue(a, sortKey);
      const bv = getStatValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av);
      const nb = Number(bv);
      return sortDir === "asc" ? na - nb : nb - na;
    });
  }, [allGames, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Box Scores</Text>
        <Text style={s.subtitle}>{allGames.length} games</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.table}>
          {/* Header */}
          <View style={s.headerRow}>
            {COLUMNS.map((col) => {
              const isActive = col.key === sortKey;
              return (
                <Pressable key={col.key} onPress={() => handleSort(col.key)} style={[s.headerCell, { width: col.width }]}>
                  <Text style={[s.headerText, isActive && s.headerTextActive]}>
                    {col.label}
                    {isActive ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Rows */}
          {sortedGames.map((game) => (
            <View key={game.gameId} style={s.row}>
              <View style={[s.cell, { width: 56 }]}>
                <Text style={s.cellText}>{fmtDate(game.date)}</Text>
              </View>
              <View style={[s.cell, { width: 52 }]}>
                <Text style={s.cellText}>
                  {game.homeAway === "H" ? "v" : "@"}{game.opponentAbbr}
                </Text>
              </View>
              <View style={[s.cell, { width: 40 }]}>
                <Text style={s.cellTextDim}>{Math.round(game.minutes)}</Text>
              </View>
              <View style={[s.cell, { width: 40 }]}>
                <Text style={s.cellTextBold}>{game.pts}</Text>
              </View>
              <View style={[s.cell, { width: 40 }]}>
                <Text style={s.cellTextBold}>{game.reb}</Text>
              </View>
              <View style={[s.cell, { width: 40 }]}>
                <Text style={s.cellTextBold}>{game.ast}</Text>
              </View>
              <View style={[s.cell, { width: 40 }]}>
                <Text style={s.cellTextBold}>{game.fg3m}</Text>
              </View>
              <View style={[s.cell, { width: 38 }]}>
                <Text style={s.cellTextDim}>{game.stl}</Text>
              </View>
              <View style={[s.cell, { width: 38 }]}>
                <Text style={s.cellTextDim}>{game.blk}</Text>
              </View>
              <View style={[s.cell, { width: 38 }]}>
                <Text style={s.cellTextDim}>{game.tov}</Text>
              </View>
              <View style={[s.cell, { width: 48 }]}>
                <Text style={s.cellText}>
                  {game.fga > 0 ? `${Math.round(game.fgPct * 100)}%` : "—"}
                </Text>
              </View>
              <View style={[s.cell, { width: 44 }]}>
                <Text style={[s.cellText, { color: game.plusMinus >= 0 ? brandColors.success : brandColors.error }]}>
                  {game.plusMinus > 0 ? "+" : ""}{game.plusMinus}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingTop: 4 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, marginBottom: 8
  },
  title: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: brandColors.textMuted, fontSize: 12, fontWeight: "600" },

  table: {
    marginHorizontal: 16,
    backgroundColor: brandColors.panelBackground,
    borderRadius: 12, borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  headerRow: {
    flexDirection: "row", backgroundColor: brandColors.panelBackgroundAlt,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  headerCell: { paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" },
  headerText: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.3
  },
  headerTextActive: { color: brandColors.primary },

  row: {
    flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  cell: { paddingVertical: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  cellText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "500" },
  cellTextDim: { color: brandColors.textMuted, fontSize: 12, fontWeight: "500" },
  cellTextBold: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "700" }
});
