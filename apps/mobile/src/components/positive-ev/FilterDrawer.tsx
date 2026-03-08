import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SharpPreset } from "@unjuiced/types";
import { brandColors } from "@/src/theme/brand";
import {
  MIN_EV_OPTIONS,
  MAX_EV_OPTIONS,
  MODE_OPTIONS,
  SPORT_OPTIONS,
  SPORT_ICONS,
  SPORT_COLORS,
  DEVIG_METHOD_OPTIONS,
  type EVModeOption,
  type DevigMethodOption,
} from "./constants";
import { formatPercent } from "./helpers";

const BANKROLL_OPTIONS = [500, 1000, 2500, 5000, 10000];
const KELLY_OPTIONS = [10, 25, 50, 100];

const SCREEN_H = Dimensions.get("window").height;
const DRAWER_MAX = SCREEN_H * 0.85;
const DISMISS_VY = 0.5;
const DISMISS_DY_PCT = 0.35;

type PresetItem = { id: string; label?: string; name: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  // Preset
  presets: PresetItem[];
  selectedPreset: SharpPreset;
  onSelectPreset: (id: SharpPreset) => void;
  // Sports
  selectedSports: string[];
  onToggleSport: (id: string) => void;
  // Market type
  playerProps: boolean;
  gameProps: boolean;
  onTogglePlayerProps: () => void;
  onToggleGameProps: () => void;
  // Devig methods
  selectedDevigMethods: DevigMethodOption[];
  onToggleDevigMethod: (m: DevigMethodOption) => void;
  // EV range
  minEv: number;
  onSetMinEv: (v: number) => void;
  maxEv: number | undefined;
  onSetMaxEv: (v: number | undefined) => void;
  // Mode
  mode: EVModeOption;
  onSetMode: (v: EVModeOption) => void;
  // Bankroll / Kelly
  bankroll: number;
  onSetBankroll: (v: number) => void;
  kellyPercent: number;
  onSetKellyPercent: (v: number) => void;
  // Actions
  resultCount: number;
  isNonDefault: boolean;
  onReset: () => void;
};

export default function FilterDrawer({
  visible,
  onClose,
  presets,
  selectedPreset,
  onSelectPreset,
  selectedSports,
  onToggleSport,
  playerProps,
  gameProps,
  onTogglePlayerProps,
  onToggleGameProps,
  selectedDevigMethods,
  onToggleDevigMethod,
  minEv,
  onSetMinEv,
  maxEv,
  onSetMaxEv,
  mode,
  onSetMode,
  bankroll,
  onSetBankroll,
  kellyPercent,
  onSetKellyPercent,
  resultCount,
  isNonDefault,
  onReset,
}: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const sheetHeight = useRef(DRAWER_MAX);

  const animateOpen = useCallback(() => {
    translateY.setValue(SCREEN_H);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 28,
        stiffness: 300,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) animateOpen();
  }, [visible, animateOpen]);

  // Content PanResponder — only intercepts when scrolled to top
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && scrollY.current <= 0,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(0, gs.dy);
        translateY.setValue(clamped);
        backdropOpacity.setValue(Math.max(0, 1 - clamped / sheetHeight.current));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.vy > DISMISS_VY || gs.dy > sheetHeight.current * DISMISS_DY_PCT) {
          animateClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 300 }),
            Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  // Drag handle — always captures
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(0, gs.dy);
        translateY.setValue(clamped);
        backdropOpacity.setValue(Math.max(0, 1 - clamped / sheetHeight.current));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.vy > DISMISS_VY || gs.dy > sheetHeight.current * DISMISS_DY_PCT) {
          animateClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 300 }),
            Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      {/* Backdrop */}
      <Animated.View style={[ds.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[ds.sheet, { transform: [{ translateY }] }]}
        onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
      >
        {/* Drag handle */}
        <View {...handlePanResponder.panHandlers} style={ds.handleZone}>
          <View style={ds.handleBar} />
        </View>

        {/* Header */}
        <View {...handlePanResponder.panHandlers} style={ds.header}>
          <Text style={ds.headerTitle}>Filters</Text>
          <Pressable onPress={animateClose} hitSlop={10} style={ds.closeBtn}>
            <Ionicons name="close" size={20} color={brandColors.textMuted} />
          </Pressable>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={ds.body}
          contentContainerStyle={ds.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          {...panResponder.panHandlers}
        >
          {/* ── Section: Sharp Source ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Sharp Source</Text>
            </View>
            <View style={ds.presetGrid}>
              {presets.map((preset) => {
                const active = preset.id === selectedPreset;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => onSelectPreset(preset.id as SharpPreset)}
                    style={[ds.presetCell, active && ds.presetCellActive]}
                  >
                    <Text style={[ds.presetText, active && ds.presetTextActive]}>
                      {preset.label || preset.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Section: Devig Method ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="calculator-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Devig Method</Text>
            </View>
            <View style={ds.devigGrid}>
              {DEVIG_METHOD_OPTIONS.map((opt) => {
                const active = selectedDevigMethods.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onToggleDevigMethod(opt.value)}
                    style={[ds.devigCell, active && ds.devigCellActive]}
                  >
                    <Text style={[ds.devigLabel, active && ds.devigLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[ds.devigDesc, active && ds.devigDescActive]}>
                      {opt.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Section: Sports ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="trophy-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Sports</Text>
            </View>
            <View style={ds.chipRow}>
              {SPORT_OPTIONS.map((opt) => {
                const active = selectedSports.includes(opt.id);
                const sportColor = SPORT_COLORS[opt.id] ?? brandColors.textMuted;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onToggleSport(opt.id)}
                    style={[ds.sportChip, active && { backgroundColor: `${sportColor}18`, borderColor: sportColor }]}
                  >
                    {SPORT_ICONS[opt.id] ? (
                      <Ionicons
                        name={SPORT_ICONS[opt.id]}
                        size={13}
                        color={active ? sportColor : brandColors.textMuted}
                      />
                    ) : null}
                    <Text style={[ds.sportChipText, active && { color: sportColor }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Section: Market Type ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="grid-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Market Type</Text>
            </View>
            <View style={ds.marketTypeRow}>
              <Pressable
                onPress={onTogglePlayerProps}
                style={[ds.marketTypeBtn, playerProps && ds.marketTypeBtnActive]}
              >
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={playerProps ? brandColors.primary : brandColors.textMuted}
                />
                <Text style={[ds.marketTypeText, playerProps && ds.marketTypeTextActive]}>
                  Player Props
                </Text>
              </Pressable>
              <Pressable
                onPress={onToggleGameProps}
                style={[ds.marketTypeBtn, gameProps && ds.marketTypeBtnActive]}
              >
                <Ionicons
                  name="football-outline"
                  size={15}
                  color={gameProps ? brandColors.primary : brandColors.textMuted}
                />
                <Text style={[ds.marketTypeText, gameProps && ds.marketTypeTextActive]}>
                  Game Props
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Section: EV Range (side by side) ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="trending-up-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>EV Range</Text>
            </View>
            <View style={ds.evRangeRow}>
              <View style={ds.evRangeCol}>
                <Text style={ds.evRangeLabel}>Min</Text>
                <View style={ds.chipRow}>
                  {MIN_EV_OPTIONS.map((val) => {
                    const active = minEv === val;
                    return (
                      <Pressable
                        key={`min-${val}`}
                        onPress={() => onSetMinEv(val)}
                        style={[ds.chipCompact, active && ds.chipActive]}
                      >
                        <Text style={[ds.chipText, active && ds.chipTextActive]}>
                          {val === 0 ? "Any" : `${formatPercent(val)}%`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={ds.evRangeDivider} />
              <View style={ds.evRangeCol}>
                <Text style={ds.evRangeLabel}>Max</Text>
                <View style={ds.chipRow}>
                  {MAX_EV_OPTIONS.map((opt) => {
                    const active = maxEv === opt.value;
                    return (
                      <Pressable
                        key={`max-${opt.label}`}
                        onPress={() => onSetMaxEv(opt.value)}
                        style={[ds.chipCompact, active && ds.chipActive]}
                      >
                        <Text style={[ds.chipText, active && ds.chipTextActive]}>
                          {opt.value === undefined ? "None" : opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* ── Section: Mode ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="time-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Mode</Text>
            </View>
            <View style={ds.segmentRow}>
              {MODE_OPTIONS.map((opt) => {
                const active = mode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onSetMode(opt.value)}
                    style={[ds.segmentBtn, active && ds.segmentBtnActive]}
                  >
                    <Text style={[ds.segmentText, active && ds.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Section: Stake Sizing ── */}
          <View style={ds.section}>
            <View style={ds.sectionHeader}>
              <Ionicons name="cash-outline" size={14} color={brandColors.textMuted} />
              <Text style={ds.sectionTitle}>Stake Sizing</Text>
            </View>
            <View style={ds.stakeRow}>
              <View style={ds.stakeCol}>
                <Text style={ds.evRangeLabel}>Bankroll</Text>
                <View style={ds.chipRow}>
                  {BANKROLL_OPTIONS.map((val) => {
                    const active = bankroll === val;
                    return (
                      <Pressable
                        key={`br-${val}`}
                        onPress={() => onSetBankroll(val)}
                        style={[ds.chipCompact, active && ds.chipActive]}
                      >
                        <Text style={[ds.chipText, active && ds.chipTextActive]}>
                          ${val >= 1000 ? `${val / 1000}k` : val}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={ds.evRangeDivider} />
              <View style={ds.stakeCol}>
                <Text style={ds.evRangeLabel}>Kelly %</Text>
                <View style={ds.chipRow}>
                  {KELLY_OPTIONS.map((val) => {
                    const active = kellyPercent === val;
                    return (
                      <Pressable
                        key={`kelly-${val}`}
                        onPress={() => onSetKellyPercent(val)}
                        style={[ds.chipCompact, active && ds.chipActive]}
                      >
                        <Text style={[ds.chipText, active && ds.chipTextActive]}>
                          {val}%
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={ds.applyWrap}>
          <View style={ds.applyRow}>
            {isNonDefault ? (
              <Pressable onPress={onReset} style={ds.resetBtn}>
                <Ionicons name="refresh-outline" size={16} color={brandColors.textSecondary} />
                <Text style={ds.resetBtnText}>Reset</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={animateClose} style={[ds.applyBtn, !isNonDefault && { flex: 1 }]}>
              <Text style={ds.applyBtnText}>Show Results ({resultCount})</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const ds = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: DRAWER_MAX,
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: brandColors.border,
  },
  handleZone: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  headerTitle: { color: brandColors.textPrimary, fontSize: 17, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  /* ── Sections ── */
  section: {
    marginTop: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  /* ── Preset grid (3-col) ── */
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  presetCell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
    minWidth: "30%" as any,
    alignItems: "center",
  },
  presetCellActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  presetText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  presetTextActive: { color: brandColors.primary, fontWeight: "700" },

  /* ── Devig method grid (2-col) ── */
  devigGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  devigCell: {
    width: "48.5%" as any,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
  },
  devigCellActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  devigLabel: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  devigLabelActive: { color: brandColors.primary },
  devigDesc: {
    color: brandColors.textMuted,
    fontSize: 10,
    lineHeight: 13,
  },
  devigDescActive: { color: `${brandColors.primary}99` },

  /* ── Chip rows ── */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
  },
  chipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  chipText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: brandColors.primary, fontWeight: "700" },

  /* ── Sport chips ── */
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
  },
  sportChipText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },

  /* ── Market type toggle ── */
  marketTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  marketTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
  },
  marketTypeBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  marketTypeText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  marketTypeTextActive: {
    color: brandColors.primary,
    fontWeight: "700",
  },

  /* ── EV Range side-by-side ── */
  evRangeRow: {
    flexDirection: "row",
    gap: 0,
  },
  evRangeCol: {
    flex: 1,
  },
  evRangeLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  evRangeDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 12,
  },

  /* ── Stake sizing side-by-side ── */
  stakeRow: {
    flexDirection: "row",
    gap: 0,
  },
  stakeCol: {
    flex: 1,
  },

  /* ── Segmented control (mode) ── */
  segmentRow: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: brandColors.panelBackground,
  },
  segmentBtnActive: {
    backgroundColor: brandColors.primarySoft,
  },
  segmentText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  segmentTextActive: { color: brandColors.primary, fontWeight: "700" },

  /* ── Bottom actions ── */
  applyWrap: {
    borderTopWidth: 1,
    borderTopColor: brandColors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: brandColors.panelBackground,
  },
  applyRow: {
    flexDirection: "row",
    gap: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  resetBtnText: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "600" },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
