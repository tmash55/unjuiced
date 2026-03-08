import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

/* ─── Shimmer bar (animated gradient-like pulse) ─── */

function ShimmerBar({ width, delay = 0 }: { width: number | string; delay?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={[
        s.shimmerBar,
        { width: width as any, opacity },
      ]}
    />
  );
}

/* ─── Skeleton loader (3 shimmer rows) ─── */

function SkeletonLoader({ count = 3 }: { count?: number }) {
  return (
    <View style={s.skeletonWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.skeletonCard}>
          <ShimmerBar width="45%" delay={i * 120} />
          <ShimmerBar width="70%" delay={i * 120 + 80} />
          <ShimmerBar width="55%" delay={i * 120 + 160} />
        </View>
      ))}
    </View>
  );
}

/* ─── Exported variants ─── */

type LoadingProps = {
  state: "loading";
  message?: string;
  skeletonCount?: number;
};

type ErrorProps = {
  state: "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
};

type EmptyProps = {
  state: "empty";
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
};

export type StateViewProps = LoadingProps | ErrorProps | EmptyProps;

export default function StateView(props: StateViewProps) {
  if (props.state === "loading") {
    return (
      <View style={s.root}>
        <SkeletonLoader count={props.skeletonCount ?? 3} />
        {props.message ? <Text style={s.loadingMsg}>{props.message}</Text> : null}
      </View>
    );
  }

  if (props.state === "error") {
    return (
      <View style={[s.root, s.errorRoot]}>
        <View style={s.errorIconWrap}>
          <Ionicons name="warning-outline" size={24} color="#F87171" />
        </View>
        <Text style={s.errorTitle}>{props.title ?? "Unable to load"}</Text>
        {props.message ? <Text style={s.errorBody}>{props.message}</Text> : null}
        {props.onRetry ? (
          <Pressable onPress={props.onRetry} style={s.retryBtn}>
            <Ionicons name="refresh-outline" size={14} color={brandColors.primary} />
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // Empty state
  return (
    <View style={s.root}>
      <Ionicons
        name={props.icon ?? "search-outline"}
        size={32}
        color={brandColors.textMuted}
        style={s.emptyIcon}
      />
      {props.title ? <Text style={s.emptyTitle}>{props.title}</Text> : null}
      <Text style={s.emptyMsg}>{props.message ?? "Nothing to show."}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    // Subtle depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 3,
  },

  /* ── Loading / skeleton ── */
  skeletonWrap: {
    width: "100%",
    gap: 8,
  },
  skeletonCard: {
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  shimmerBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  loadingMsg: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },

  /* ── Error ── */
  errorRoot: {
    borderColor: "rgba(248,113,113,0.15)",
    backgroundColor: "rgba(127,29,29,0.08)",
  },
  errorIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(248,113,113,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "700",
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    backgroundColor: "rgba(56,189,248,0.06)",
    marginTop: 4,
  },
  retryText: {
    color: brandColors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  /* ── Empty ── */
  emptyIcon: {
    marginBottom: 4,
    opacity: 0.6,
  },
  emptyTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyMsg: {
    color: brandColors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
