import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useTripleDoubleSheet } from "@/src/hooks/use-triple-double-sheet";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import type { TripleDoubleSheetRow, TripleDoubleBestPrice } from "@unjuiced/api";

function formatOdds(price: number | null | undefined): string {
  if (typeof price !== "number" || !Number.isFinite(price)) return "—";
  return price > 0 ? `+${price}` : String(price);
}

function PriceCell({ label, price }: { label: string; price: TripleDoubleBestPrice | null }) {
  const bookLogo = price?.book ? getSportsbookLogoUrl(price.book) : null;

  return (
    <View style={styles.priceCol}>
      <Text style={styles.priceLabel}>{label}</Text>
      {price ? (
        <View style={styles.priceValue}>
          <Text style={styles.priceText}>{price.priceFormatted || formatOdds(price.price)}</Text>
          {bookLogo && <Image source={{ uri: bookLogo }} style={styles.bookLogo} />}
        </View>
      ) : (
        <Text style={styles.priceNa}>—</Text>
      )}
    </View>
  );
}

const Card = ({ row, onPress }: { row: TripleDoubleSheetRow; onPress: () => void }) => {
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

      <View style={styles.booksRow}>
        <Text style={styles.booksText}>
          {row.booksWithRa} R+A books / {row.booksWithPra} PRA books
        </Text>
      </View>
    </Pressable>
  );
};

export default function TripleDoubleSheet() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useTripleDoubleSheet();

  const rows = useMemo(() => {
    return data?.data?.rows ?? [];
  }, [data]);

  const renderItem = useCallback(
    ({ item }: { item: TripleDoubleSheetRow }) => (
      <Card
        row={item}
        onPress={() =>
          router.push({ pathname: "/player/[id]", params: { id: item.playerId } })
        }
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
  );
}

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
  priceNa: { color: brandColors.textMuted, fontSize: 14, fontWeight: "600" },
  bookLogo: { width: 14, height: 14, borderRadius: 3 },
  booksRow: { alignItems: "center" },
  booksText: { color: brandColors.textMuted, fontSize: 10 },
  stateCard: {
    borderRadius: 14, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt, paddingHorizontal: 14, paddingVertical: 24,
    alignItems: "center", gap: 8, marginTop: 8
  },
  stateText: { color: brandColors.textSecondary, fontSize: 14, textAlign: "center" }
});
