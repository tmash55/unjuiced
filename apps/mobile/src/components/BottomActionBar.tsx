import { useCallback, useRef } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

/* ─── Types ─── */

export type BottomPill = {
  key: string;
  label: string;
  active?: boolean;
  /** Override colors for special pills (e.g. preset indicator) */
  color?: string;
  colorBg?: string;
  colorBorder?: string;
  onPress?: () => void;
};

type Props = {
  /** Number of active filters; shown as badge on filter button */
  filterCount?: number;
  /** Optional label to display on the filter button instead of just the icon */
  filterLabel?: string;
  onFilterPress?: () => void;
  pills: BottomPill[];
  children?: React.ReactNode;
};

/* ─── Scroll-hide hook ─── */

export function useScrollHideBar() {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const visible = useRef(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (!visible.current) {
      visible.current = true;
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [translateY]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const goingDown = y > lastY.current && y > 20;
      lastY.current = y;

      if (idleTimer.current) clearTimeout(idleTimer.current);

      if (goingDown && visible.current) {
        visible.current = false;
        Animated.timing(translateY, {
          toValue: 80,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (!goingDown && !visible.current) {
        show();
      }

      idleTimer.current = setTimeout(show, 300);
    },
    [translateY, show]
  );

  return { translateY, onScroll };
}

/* ─── Component ─── */

export default function BottomActionBar({
  filterCount = 0,
  filterLabel,
  onFilterPress,
  pills,
  children,
}: Props) {
  return (
    <>
      {/* Filter button */}
      {onFilterPress ? (
        <Pressable onPress={onFilterPress} style={s.filterBtn}>
          <Ionicons
            name="options-outline"
            size={18}
            color={filterCount > 0 || filterLabel ? brandColors.primary : brandColors.textSecondary}
          />
          {filterLabel ? (
            <Text style={s.filterLabelText}>{filterLabel}</Text>
          ) : filterCount > 0 ? (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* Quick pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillScroll}
      >
        {pills.map((pill) => {
          const hasCustomColor = !!(pill.color || pill.colorBg || pill.colorBorder);
          return (
            <Pressable
              key={pill.key}
              onPress={pill.onPress}
              disabled={!pill.onPress}
              style={[
                s.pill,
                pill.active && !hasCustomColor && s.pillActive,
                hasCustomColor && {
                  borderColor: pill.colorBorder ?? pill.color ?? brandColors.border,
                  backgroundColor: pill.colorBg ?? "transparent",
                },
              ]}
            >
              <Text
                style={[
                  s.pillText,
                  pill.active && !hasCustomColor && s.pillTextActive,
                  hasCustomColor && pill.color ? { color: pill.color } : undefined,
                ]}
                numberOfLines={1}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
        {children}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: brandColors.panelBackground,
  },
  filterLabelText: {
    color: brandColors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  filterBadge: {
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: "#020617",
    fontSize: 10,
    fontWeight: "800",
  },
  pillScroll: {
    gap: 6,
    paddingRight: 8,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: brandColors.panelBackground,
  },
  pillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primary,
  },
  pillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#020617",
    fontWeight: "700",
  },
});
