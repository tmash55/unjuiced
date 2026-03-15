import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { PositiveEVOpportunity } from "@unjuiced/types";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { formatOdds, normalizeBookLabel } from "./helpers";

type Props = {
  opp: PositiveEVOpportunity;
  fairValue: number | null;
};

export default function SingleSideGrid({ opp, fairValue }: Props) {
  const books = opp.allBooks ?? [];
  const bestBookId = opp.book?.bookId;

  const { sharpBooks, softBooks } = useMemo(() => {
    const sharp = books.filter((b) => b.isSharpRef);
    const soft = books.filter((b) => !b.isSharpRef);
    return { sharpBooks: sharp, softBooks: soft };
  }, [books]);

  const beatsFV = (price: number) => {
    if (fairValue == null) return false;
    return price > fairValue;
  };

  const renderBook = (book: typeof books[0], isSharp: boolean) => {
    const logo = getSportsbookLogoUrl(book.bookId);
    const isBest = !isSharp && book.bookId === bestBookId;
    const isBeatsFV = !isSharp && beatsFV(book.price);
    const url = book.mobileLink || book.link;

    return (
      <Pressable
        key={book.bookId}
        onPress={() => url && Linking.openURL(url)}
        style={[
          s.row,
          isBest && s.rowBest,
          isBeatsFV && !isBest && s.rowBeatsFV,
          isSharp && s.rowSharp,
        ]}
      >
        {logo ? <Image source={{ uri: logo }} style={s.logo} /> : null}
        <Text style={[s.name, isBest && s.nameBest]} numberOfLines={1}>
          {book.bookName || normalizeBookLabel(book.bookId)}
        </Text>
        <Text style={[s.price, isBest && s.priceBest]}>{formatOdds(book.price)}</Text>
        {book.limits?.max ? (
          <Text style={s.limitsText}>max ${book.limits.max.toLocaleString()}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={12} color={brandColors.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={s.list}>
      {/* Sharp books */}
      {sharpBooks.map((book) => renderBook(book, true))}

      {/* Divider */}
      {sharpBooks.length > 0 && softBooks.length > 0 ? (
        <View style={s.sectionDivider} />
      ) : null}

      {/* Soft books */}
      {softBooks.map((book) => renderBook(book, false))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rowBest: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.30)",
  },
  rowBeatsFV: {
    backgroundColor: "rgba(34,197,94,0.05)",
    borderColor: "rgba(34,197,94,0.15)",
  },
  rowSharp: {
    opacity: 0.7,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 1,
  },
  logo: { width: 18, height: 18, borderRadius: 4 },
  name: { flex: 1, color: brandColors.textSecondary, fontSize: 11, fontWeight: "600" },
  nameBest: { color: brandColors.success },
  price: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  priceBest: { color: brandColors.success },
  limitsText: { color: brandColors.textMuted, fontSize: 8, fontWeight: "500" },
});
