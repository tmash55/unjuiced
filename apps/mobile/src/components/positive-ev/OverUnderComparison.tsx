import { useMemo } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { BookOffer, PositiveEVOpportunity } from "@unjuiced/types";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { formatOdds } from "./helpers";

type Props = {
  opp: PositiveEVOpportunity;
  fairValue: number | null;
};

export default function OverUnderComparison({ opp, fairValue }: Props) {
  const overBooks = opp.side === "over" ? opp.allBooks : (opp.oppositeBooks ?? []);
  const underBooks = opp.side === "under" ? opp.allBooks : (opp.oppositeBooks ?? []);

  // Separate sharp ref books from soft books
  const { sharpPairs, softPairs, bestOverPrice, bestUnderPrice } = useMemo(() => {
    const allIds = new Set([...overBooks.map((b) => b.bookId), ...underBooks.map((b) => b.bookId)]);

    const paired = Array.from(allIds).map((id) => ({
      bookId: id,
      over: overBooks.find((b) => b.bookId === id),
      under: underBooks.find((b) => b.bookId === id),
      isSharp: overBooks.find((b) => b.bookId === id)?.isSharpRef || underBooks.find((b) => b.bookId === id)?.isSharpRef || false,
    }));

    const sharp = paired.filter((p) => p.isSharp);
    const soft = paired
      .filter((p) => !p.isSharp)
      .sort((a, b) => (b.over?.price ?? -9999) - (a.over?.price ?? -9999));

    const bestOver = Math.max(...overBooks.filter((b) => !b.isSharpRef).map((b) => b.price), -Infinity);
    const bestUnder = Math.max(...underBooks.filter((b) => !b.isSharpRef).map((b) => b.price), -Infinity);

    return { sharpPairs: sharp, softPairs: soft, bestOverPrice: bestOver, bestUnderPrice: bestUnder };
  }, [overBooks, underBooks]);

  const openLink = (book: Pick<BookOffer, "mobileLink" | "link"> | undefined) => {
    const url = book?.mobileLink || book?.link;
    if (url) void Linking.openURL(url);
  };

  // Determine if a price beats fair value (for highlighting)
  const beatsFV = (price: number, side: "over" | "under") => {
    if (fairValue == null) return false;
    // If this opp is "over", the fair value applies to the over side
    // A book beats FV if its price > fair value price (less negative or more positive)
    if ((opp.side === "over" && side === "over") || (opp.side === "under" && side === "under")) {
      return price > fairValue;
    }
    return false;
  };

  const renderRow = (pair: typeof softPairs[0], isSharpRow: boolean) => {
    const logo = getSportsbookLogoUrl(pair.bookId);
    const isBestOver = !isSharpRow && pair.over && pair.over.price === bestOverPrice;
    const isBestUnder = !isSharpRow && pair.under && pair.under.price === bestUnderPrice;
    const overBeatsFV = pair.over ? beatsFV(pair.over.price, "over") : false;
    const underBeatsFV = pair.under ? beatsFV(pair.under.price, "under") : false;

    return (
      <View key={pair.bookId} style={[s.row, isSharpRow && s.sharpRow]}>
        <Pressable
          onPress={() => openLink(pair.over)}
          disabled={!pair.over}
          style={[
            s.cell,
            isBestOver && s.cellBest,
            overBeatsFV && !isBestOver && s.cellBeatsFV,
            !pair.over && s.cellDisabled,
          ]}
        >
          <Text style={[s.cellText, isBestOver && s.cellTextBest]}>
            {pair.over ? formatOdds(pair.over.price) : "\u2014"}
          </Text>
          {pair.over?.limits?.max ? (
            <Text style={s.limitsText}>max ${pair.over.limits.max.toLocaleString()}</Text>
          ) : null}
        </Pressable>
        <View style={s.bookCenter}>
          {logo ? (
            <Image source={{ uri: logo }} style={s.bookLogo} />
          ) : (
            <View style={s.bookPlaceholder}>
              <Text style={s.bookPlaceholderText}>{pair.bookId.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => openLink(pair.under)}
          disabled={!pair.under}
          style={[
            s.cell,
            isBestUnder && s.cellBest,
            underBeatsFV && !isBestUnder && s.cellBeatsFV,
            !pair.under && s.cellDisabled,
          ]}
        >
          <Text style={[s.cellText, isBestUnder && s.cellTextBest]}>
            {pair.under ? formatOdds(pair.under.price) : "\u2014"}
          </Text>
          {pair.under?.limits?.max ? (
            <Text style={s.limitsText}>max ${pair.under.limits.max.toLocaleString()}</Text>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.overLabel}>Over {opp.line}</Text>
        <Text style={s.bookLabel}>Book</Text>
        <Text style={s.underLabel}>Under {opp.line}</Text>
      </View>

      {/* Sharp rows (if any) */}
      {sharpPairs.map((pair) => renderRow(pair, true))}

      {/* Divider between sharp and soft */}
      {sharpPairs.length > 0 && softPairs.length > 0 ? (
        <View style={s.sectionDivider} />
      ) : null}

      {/* Soft book rows */}
      {softPairs.map((pair) => renderRow(pair, false))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 3 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  overLabel: {
    flex: 1,
    color: brandColors.success,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  bookLabel: {
    width: 32,
    color: brandColors.textMuted,
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  underLabel: {
    flex: 1,
    color: brandColors.primary,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  sharpRow: {
    opacity: 0.7,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 2,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cellBest: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  cellBeatsFV: {
    backgroundColor: "rgba(34,197,94,0.05)",
    borderColor: "rgba(34,197,94,0.15)",
  },
  cellDisabled: { opacity: 0.3 },
  cellText: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  cellTextBest: { color: brandColors.success },
  limitsText: { color: brandColors.textMuted, fontSize: 8, marginTop: 1 },
  bookCenter: { width: 32, alignItems: "center", justifyContent: "center" },
  bookLogo: { width: 20, height: 20, borderRadius: 4 },
  bookPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  bookPlaceholderText: { color: brandColors.textMuted, fontSize: 7, fontWeight: "700" },
});
