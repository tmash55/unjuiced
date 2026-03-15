import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTripleDoubleSheet } from "@/src/hooks/use-triple-double-sheet";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { triggerLightImpactHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";
import type { TripleDoubleSheetRow, TripleDoubleBestPrice } from "@unjuiced/api";

function formatOdds(price: number | null | undefined): string {
  if (typeof price !== "number" || !Number.isFinite(price)) return "—";
  return price > 0 ? `+${price}` : String(price);
}

function openBookLink(price: TripleDoubleBestPrice | null) {
  if (!price) return;
  const url = price.mobileLink || price.link;
  if (url) {
    triggerLightImpactHaptic();
    void Linking.openURL(url);
  }
}

function PriceCell({ label, price }: { label: string; price: TripleDoubleBestPrice | null }) {
  const bookLogo = price?.book ? getSportsbookLogoUrl(price.book) : null;
  const hasLink = !!(price?.mobileLink || price?.link);

  return (
    <Pressable style={styles.priceCol} onPress={() => openBookLink(price)} disabled={!hasLink}>
      <Text style={styles.priceLabel}>{label}</Text>
      {price ? (
        <View style={styles.priceValue}>
          <Text style={[styles.priceText, hasLink && styles.priceTappable]}>
            {price.priceFormatted || formatOdds(price.price)}
          </Text>
          {bookLogo && <Image source={{ uri: bookLogo }} style={styles.bookLogo} />}
        </View>
      ) : (
        <Text style={styles.priceNa}>—</Text>
      )}
    </Pressable>
  );
}

/* ── All Books Modal ── */

function AllBooksModal({
  row,
  visible,
  onClose
}: {
  row: TripleDoubleSheetRow;
  visible: boolean;
  onClose: () => void;
}) {
  const allBooks = new Set<string>();
  for (const q of row.allSgpRa ?? []) allBooks.add(q.book);
  for (const q of row.allSgpPra ?? []) allBooks.add(q.book);
  for (const q of row.allTd ?? []) allBooks.add(q.book);

  const raMap = new Map((row.allSgpRa ?? []).map((q) => [q.book, q]));
  const praMap = new Map((row.allSgpPra ?? []).map((q) => [q.book, q]));
  const tdMap = new Map((row.allTd ?? []).map((q) => [q.book, q]));

  const bestRa = row.sgp_ra?.price ?? null;
  const bestPra = row.sgp_pra?.price ?? null;
  const bestTd = row.td?.price ?? null;

  const bookList = [...allBooks].sort((a, b) => {
    const aRa = raMap.get(a)?.price ?? -Infinity;
    const bRa = raMap.get(b)?.price ?? -Infinity;
    if (bRa !== aRa) return bRa - aRa;
    const aPra = praMap.get(a)?.price ?? -Infinity;
    const bPra = praMap.get(b)?.price ?? -Infinity;
    return bPra - aPra;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={ms.sheet}>
        <View style={ms.handle} />
        <Text style={ms.title}>{row.player}</Text>
        <Text style={ms.subtitle}>{row.matchup}</Text>

        {/* Header row */}
        <View style={ms.headerRow}>
          <Text style={[ms.headerCell, ms.bookCol]}>Book</Text>
          <Text style={[ms.headerCell, ms.priceCol]}>R+A</Text>
          <Text style={[ms.headerCell, ms.priceCol]}>PRA</Text>
          <Text style={[ms.headerCell, ms.priceCol]}>TD</Text>
        </View>

        <ScrollView style={ms.scrollBody} showsVerticalScrollIndicator={false}>
          {bookList.map((book, idx) => {
            const logo = getSportsbookLogoUrl(book);
            const ra = raMap.get(book) ?? null;
            const pra = praMap.get(book) ?? null;
            const td = tdMap.get(book) ?? null;

            return (
              <View key={book} style={[ms.dataRow, idx % 2 === 0 && ms.dataRowAlt]}>
                <View style={[ms.bookCol, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  {logo ? <Image source={{ uri: logo }} style={ms.bookLogo} /> : null}
                  <Text style={ms.bookName} numberOfLines={1}>{book}</Text>
                </View>
                <ModalPriceCell price={ra} isBest={bestRa !== null && ra?.price === bestRa} />
                <ModalPriceCell price={pra} isBest={bestPra !== null && pra?.price === bestPra} />
                <ModalPriceCell price={td} isBest={bestTd !== null && td?.price === bestTd} />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ModalPriceCell({ price, isBest }: { price: TripleDoubleBestPrice | null; isBest: boolean }) {
  const hasLink = !!(price?.mobileLink || price?.link);

  if (!price) {
    return <Text style={[ms.priceCol, ms.priceDash]}>—</Text>;
  }

  return (
    <Pressable style={ms.priceCol} onPress={() => openBookLink(price)} disabled={!hasLink}>
      <Text style={[ms.priceText, isBest && ms.priceBest, hasLink && ms.priceTappable]}>
        {price.priceFormatted || formatOdds(price.price)}
      </Text>
    </Pressable>
  );
}

/* ── Card ── */

const Card = ({
  row,
  onPress,
  onAllBooks
}: {
  row: TripleDoubleSheetRow;
  onPress: () => void;
  onAllBooks: () => void;
}) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <View style={styles.cardNameBlock}>
          <Text style={styles.playerName} numberOfLines={1}>{row.player}</Text>
          <Text style={styles.subInfo}>{row.matchup}</Text>
        </View>
        {row.hasAllThreeLegs && (
          <View style={styles.allLegsBadge}>
            <Text style={styles.allLegsText}>3 Legs</Text>
          </View>
        )}
      </View>

      <View style={styles.priceRow}>
        <PriceCell label="SGP R+A" price={row.sgp_ra} />
        <View style={styles.priceDivider} />
        <PriceCell label="SGP PRA" price={row.sgp_pra} />
        <View style={styles.priceDivider} />
        <PriceCell label="Triple Dbl" price={row.td} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.booksText}>
          {row.booksWithRa} R+A / {row.booksWithPra} PRA books
        </Text>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onAllBooks(); }}
          hitSlop={8}
          style={styles.allBooksBtn}
        >
          <Text style={styles.allBooksText}>All Books</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

/* ── Main Component ── */

export default function TripleDoubleSheet() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useTripleDoubleSheet();
  const [allBooksRow, setAllBooksRow] = useState<TripleDoubleSheetRow | null>(null);

  const rows = useMemo(() => data?.data?.rows ?? [], [data]);

  const renderItem = useCallback(
    ({ item }: { item: TripleDoubleSheetRow }) => (
      <Card
        row={item}
        onPress={() => router.push({ pathname: "/player/[id]", params: { id: item.playerId } })}
        onAllBooks={() => setAllBooksRow(item)}
      />
    ),
    [router]
  );

  const keyExtractor = useCallback((item: TripleDoubleSheetRow) => item.id, []);

  const listEmpty = isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading triple double sheet...</Text>
    </View>
  ) : (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No triple double data available.</Text>
    </View>
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.countText}>{rows.length} players</Text>
      {isRefetching && <ActivityIndicator size="small" color={brandColors.primary} />}
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        progressViewOffset={0}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
      {allBooksRow && (
        <AllBooksModal
          row={allBooksRow}
          visible={!!allBooksRow}
          onClose={() => setAllBooksRow(null)}
        />
      )}
    </>
  );
}

/* ── Card Styles ── */

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  listHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 2
  },
  countText: { color: brandColors.textMuted, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: brandColors.panelBackground, borderColor: brandColors.border, borderWidth: 1,
    borderRadius: 14, padding: 12, marginBottom: 8, gap: 10
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardNameBlock: { flex: 1, gap: 1 },
  playerName: { color: brandColors.textPrimary, fontSize: 15, fontWeight: "700" },
  subInfo: { color: brandColors.textMuted, fontSize: 12 },
  allLegsBadge: {
    borderRadius: 6, backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8, paddingVertical: 3
  },
  allLegsText: { color: "#22C55E", fontSize: 10, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "stretch" },
  priceCol: { flex: 1, alignItems: "center", gap: 4 },
  priceDivider: { width: 1, backgroundColor: brandColors.border },
  priceLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  priceValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  priceText: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "800" },
  priceTappable: { color: brandColors.primary },
  priceNa: { color: brandColors.textMuted, fontSize: 14, fontWeight: "600" },
  bookLogo: { width: 14, height: 14, borderRadius: 3 },
  footerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },
  booksText: { color: brandColors.textMuted, fontSize: 10 },
  allBooksBtn: {
    borderRadius: 6, borderWidth: 1, borderColor: brandColors.border,
    paddingHorizontal: 8, paddingVertical: 3
  },
  allBooksText: { color: brandColors.textSecondary, fontSize: 10, fontWeight: "600" },
  stateCard: {
    borderRadius: 14, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt, paddingHorizontal: 14, paddingVertical: 24,
    alignItems: "center", gap: 8, marginTop: 8
  },
  stateText: { color: brandColors.textSecondary, fontSize: 14, textAlign: "center" }
});

/* ── Modal Styles ── */

const ms = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)"
  },
  sheet: {
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 34, maxHeight: "70%"
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: brandColors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 12
  },
  title: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: brandColors.textMuted, fontSize: 12, marginBottom: 12 },
  headerRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: brandColors.border,
    paddingBottom: 6
  },
  headerCell: {
    color: brandColors.textMuted, fontSize: 9, fontWeight: "700",
    textTransform: "uppercase", textAlign: "center"
  },
  bookCol: { width: 90, textAlign: "left" },
  priceCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollBody: { marginTop: 4 },
  dataRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: brandColors.border
  },
  dataRowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  bookLogo: { width: 18, height: 18, borderRadius: 4 },
  bookName: { color: brandColors.textPrimary, fontSize: 11, fontWeight: "600", flex: 1 },
  priceText: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  priceBest: { color: brandColors.primary },
  priceTappable: { textDecorationLine: "underline" },
  priceDash: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
