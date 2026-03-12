import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

/* ── Collapsible section wrapper ── */
function Section({
  icon,
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Pressable onPress={onToggle} style={s.sectionHeader}>
        <View style={s.sectionHeaderLeft}>
          <Ionicons name={icon} size={15} color={brandColors.textMuted} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        <View style={s.sectionHeaderRight}>
          {!expanded && <Text style={s.sectionSummary} numberOfLines={1}>{summary}</Text>}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={brandColors.textMuted}
          />
        </View>
      </Pressable>
      {expanded && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

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
  const sheetHeight = useRef(DRAWER_MAX);

  const [openSection, setOpenSection] = useState<string | null>(null);

  function toggle(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((prev) => (prev === key ? null : key));
  }

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
    if (visible) {
      setOpenSection(null);
      animateOpen();
    }
  }, [visible, animateOpen]);

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

  function handleTogglePlayerProps() {
    if (playerProps && !gameProps) return;
    onTogglePlayerProps();
  }

  function handleToggleGameProps() {
    if (gameProps && !playerProps) return;
    onToggleGameProps();
  }

  /* ── Summaries ── */
  const presetName = presets.find((p) => p.id === selectedPreset)?.label
    ?? presets.find((p) => p.id === selectedPreset)?.name
    ?? selectedPreset;
  const sportsSummary =
    selectedSports.length === SPORT_OPTIONS.length || selectedSports.length === 0
      ? "All sports"
      : selectedSports.map((id) => id.toUpperCase()).join(", ");
  const propTypeSummary = playerProps && gameProps ? "Player & Game" : playerProps ? "Player" : "Game";
  const devigSummary = selectedDevigMethods.length === DEVIG_METHOD_OPTIONS.length
    ? "All methods"
    : selectedDevigMethods.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ");
  const evSummary =
    (minEv === 0 ? "Any" : `${formatPercent(minEv)}%`) +
    " – " +
    (maxEv === undefined ? "No cap" : `${maxEv}%`);
  const modeSummary = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
  const stakeSummary = `$${bankroll >= 1000 ? `${bankroll / 1000}k` : bankroll} · ${kellyPercent}% Kelly`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
      </Animated.View>

      <Animated.View
        style={[s.sheet, { transform: [{ translateY }] }]}
        onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
      >
        {/* Drag handle */}
        <View {...handlePanResponder.panHandlers} style={s.handleZone}>
          <View style={s.handleBar} />
        </View>

        {/* Header */}
        <View {...handlePanResponder.panHandlers} style={s.header}>
          <Pressable onPress={animateClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={brandColors.textMuted} />
          </Pressable>
          <Text style={s.headerTitle}>Filters</Text>
          <Pressable
            onPress={onReset}
            disabled={!isNonDefault}
            hitSlop={10}
            style={[s.clearBtn, !isNonDefault && s.clearBtnDisabled]}
          >
            <Text style={[s.clearBtnText, !isNonDefault && s.clearBtnTextDisabled]}>Clear</Text>
          </Pressable>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Prop Type (always visible, compact) ── */}
          <View style={s.propTypeRow}>
            <Pressable
              onPress={handleTogglePlayerProps}
              style={[s.propTypeBtn, playerProps && s.propTypeBtnActive]}
            >
              <Ionicons
                name="person-outline"
                size={14}
                color={playerProps ? brandColors.primary : brandColors.textMuted}
              />
              <Text style={[s.propTypeText, playerProps && s.propTypeTextActive]}>Player</Text>
            </Pressable>
            <Pressable
              onPress={handleToggleGameProps}
              style={[s.propTypeBtn, gameProps && s.propTypeBtnActive]}
            >
              <Ionicons
                name="american-football-outline"
                size={14}
                color={gameProps ? brandColors.primary : brandColors.textMuted}
              />
              <Text style={[s.propTypeText, gameProps && s.propTypeTextActive]}>Game</Text>
            </Pressable>
          </View>

          {/* ── Sharp Source ── */}
          <Section
            icon="shield-checkmark-outline"
            title="Sharp Source"
            summary={presetName}
            expanded={openSection === "source"}
            onToggle={() => toggle("source")}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.presetRail}
            >
              {presets.map((preset) => {
                const active = preset.id === selectedPreset;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => onSelectPreset(preset.id as SharpPreset)}
                    style={[s.presetCard, active && s.presetCardActive]}
                  >
                    <Text style={[s.presetMeta, active && s.presetMetaActive]}>Sharp</Text>
                    <Text style={[s.presetText, active && s.presetTextActive]}>
                      {preset.label || preset.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          {/* ── Sports ── */}
          <Section
            icon="trophy-outline"
            title="Sports"
            summary={sportsSummary}
            expanded={openSection === "sports"}
            onToggle={() => toggle("sports")}
          >
            <View style={s.chipRow}>
              {SPORT_OPTIONS.map((opt) => {
                const active = selectedSports.includes(opt.id);
                const sportColor = SPORT_COLORS[opt.id] ?? brandColors.textMuted;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onToggleSport(opt.id)}
                    style={[s.sportChip, active && { backgroundColor: `${sportColor}18`, borderColor: sportColor }]}
                  >
                    {SPORT_ICONS[opt.id] ? (
                      <Ionicons
                        name={SPORT_ICONS[opt.id]}
                        size={13}
                        color={active ? sportColor : brandColors.textMuted}
                      />
                    ) : null}
                    <Text style={[s.sportChipText, active && { color: sportColor }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Devig Method ── */}
          <Section
            icon="calculator-outline"
            title="Devig Method"
            summary={devigSummary}
            expanded={openSection === "devig"}
            onToggle={() => toggle("devig")}
          >
            <View style={s.devigGrid}>
              {DEVIG_METHOD_OPTIONS.map((opt) => {
                const active = selectedDevigMethods.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => onToggleDevigMethod(opt.value)}
                    style={[s.devigCell, active && s.devigCellActive]}
                  >
                    <Text style={[s.devigLabel, active && s.devigLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[s.devigDesc, active && s.devigDescActive]}>
                      {opt.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── EV Range ── */}
          <Section
            icon="trending-up-outline"
            title="EV Range"
            summary={evSummary}
            expanded={openSection === "ev"}
            onToggle={() => toggle("ev")}
          >
            <View style={s.rangeRow}>
              <View style={s.rangeCol}>
                <Text style={s.rangeLabel}>Min EV</Text>
                <View style={s.chipRow}>
                  {MIN_EV_OPTIONS.map((val) => {
                    const active = minEv === val;
                    return (
                      <Pressable
                        key={`min-${val}`}
                        onPress={() => onSetMinEv(val)}
                        style={[s.chip, active && s.chipActive]}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                          {val === 0 ? "Any" : `${formatPercent(val)}%`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={s.rangeDivider} />
              <View style={s.rangeCol}>
                <Text style={s.rangeLabel}>Max EV</Text>
                <View style={s.chipRow}>
                  {MAX_EV_OPTIONS.map((opt) => {
                    const active = maxEv === opt.value;
                    return (
                      <Pressable
                        key={`max-${opt.label}`}
                        onPress={() => onSetMaxEv(opt.value)}
                        style={[s.chip, active && s.chipActive]}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                          {opt.value === undefined ? "None" : opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Section>

          {/* ── Mode ── */}
          <Section
            icon="time-outline"
            title="Mode"
            summary={modeSummary}
            expanded={openSection === "mode"}
            onToggle={() => toggle("mode")}
          >
            <View style={s.segmentRow}>
              {MODE_OPTIONS.map((opt) => {
                const active = mode === opt.value;
                const disabled = opt.value === "live" || opt.value === "all";
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => !disabled && onSetMode(opt.value)}
                    style={[s.segmentBtn, active && s.segmentBtnActive, disabled && s.segmentBtnDisabled]}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextActive, disabled && s.segmentTextDisabled]}>
                      {opt.label}
                    </Text>
                    {disabled && <Text style={s.segmentSoon}>Soon</Text>}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Stake Sizing ── */}
          <Section
            icon="cash-outline"
            title="Stake Sizing"
            summary={stakeSummary}
            expanded={openSection === "stake"}
            onToggle={() => toggle("stake")}
          >
            {/* Bankroll */}
            <Text style={s.rangeLabel}>Bankroll</Text>
            <View style={s.bankrollInputRow}>
              <Text style={s.bankrollDollar}>$</Text>
              <TextInput
                style={s.bankrollInput}
                value={String(bankroll)}
                onChangeText={(text) => {
                  const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > 0) onSetBankroll(num);
                  else if (text === "") onSetBankroll(0);
                }}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholderTextColor={brandColors.textMuted}
                selectionColor={brandColors.primary}
              />
            </View>
            <View style={s.chipRow}>
              {BANKROLL_OPTIONS.map((val) => {
                const active = bankroll === val;
                return (
                  <Pressable
                    key={`br-${val}`}
                    onPress={() => onSetBankroll(val)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      ${val >= 1000 ? `${val / 1000}k` : val}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Kelly */}
            <Text style={[s.rangeLabel, { marginTop: 14 }]}>Kelly %</Text>
            <View style={s.chipRow}>
              {KELLY_OPTIONS.map((val) => {
                const active = kellyPercent === val;
                return (
                  <Pressable
                    key={`kelly-${val}`}
                    onPress={() => onSetKellyPercent(val)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {val}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={s.applyWrap}>
          <View style={s.applyRow}>
            <Pressable
              onPress={onReset}
              disabled={!isNonDefault}
              style={[s.resetBtn, !isNonDefault && s.resetBtnDisabled]}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={isNonDefault ? brandColors.textSecondary : brandColors.textMuted}
              />
              <Text style={[s.resetBtnText, !isNonDefault && s.resetBtnTextDisabled]}>Reset</Text>
            </Pressable>
            <Pressable onPress={animateClose} style={s.applyBtn}>
              <Text style={s.applyBtnText}>Show {resultCount} results</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    width: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    minWidth: 60,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearBtnDisabled: { opacity: 0.45 },
  clearBtnText: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "700" },
  clearBtnTextDisabled: { color: brandColors.textMuted },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },

  /* ── Prop type toggle (always visible) ── */
  propTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  propTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  propTypeBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  propTypeText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  propTypeTextActive: { color: brandColors.primary, fontWeight: "700" },

  /* ── Collapsible sections ── */
  section: {
    marginBottom: 6,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  sectionTitle: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionSummary: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 160,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },

  /* ── Preset rail ── */
  presetRail: { gap: 8, paddingRight: 4 },
  presetCard: {
    width: 136,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackground,
    justifyContent: "space-between",
  },
  presetCardActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  presetMeta: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  presetMetaActive: { color: brandColors.primary },
  presetText: { color: brandColors.textPrimary, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  presetTextActive: { color: brandColors.textPrimary, fontWeight: "700" },

  /* ── Chip rows ── */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
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

  /* ── Devig method grid ── */
  devigGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  devigCell: {
    width: "48%" as any,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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

  /* ── Range row (EV) ── */
  rangeRow: {
    flexDirection: "row",
    gap: 0,
  },
  rangeCol: { flex: 1 },
  rangeLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rangeDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 12,
  },

  /* ── Bankroll input ── */
  bankrollInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 38,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bankrollDollar: {
    color: brandColors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 2,
  },
  bankrollInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },

  /* ── Segmented control (mode) ── */
  segmentRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: brandColors.panelBackground,
  },
  segmentBtnActive: {
    backgroundColor: brandColors.primarySoft,
  },
  segmentText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  segmentTextActive: { color: brandColors.primary, fontWeight: "700" },
  segmentBtnDisabled: { opacity: 0.4 },
  segmentTextDisabled: { color: brandColors.textMuted },
  segmentSoon: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 1,
  },

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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  resetBtnDisabled: { opacity: 0.45 },
  resetBtnText: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "600" },
  resetBtnTextDisabled: { color: brandColors.textMuted },
  applyBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
