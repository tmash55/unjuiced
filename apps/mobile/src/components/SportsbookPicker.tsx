import { useCallback, useEffect, useRef, useState } from "react";
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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { ALL_SPORTSBOOKS } from "@/src/lib/sportsbooks";
import { triggerSelectionHaptic, triggerSuccessHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

const SCREEN_H = Dimensions.get("window").height;
const DRAWER_MAX = SCREEN_H * 0.85;
const DISMISS_VY = 0.5;
const DISMISS_DY_PCT = 0.35;

type Props = {
  visible: boolean;
  onClose: () => void;
  selected: string[];
  onSave: (books: string[]) => void;
};

export default function SportsbookPicker({ visible, onClose, selected, onSave }: Props) {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(DRAWER_MAX);

  // Sync local state when opened
  useEffect(() => {
    if (visible) setLocalSelected(selected);
  }, [visible, selected]);

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

  // Drag handle PanResponder — only on handle + header, not the scroll content
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

  const isAllBooks = localSelected.length === 0;

  function toggleBook(bookId: string) {
    triggerSelectionHaptic();
    setLocalSelected((prev) => {
      if (prev.length === 0) {
        // Currently "all" — select only the others (deselect this one)
        return ALL_SPORTSBOOKS.filter((b) => b.id !== bookId).map((b) => b.id);
      }
      if (prev.includes(bookId)) {
        const next = prev.filter((id) => id !== bookId);
        // If nothing left, revert to all
        return next.length === 0 ? [] : next;
      }
      const next = [...prev, bookId];
      // If all selected, revert to empty (= all)
      return next.length === ALL_SPORTSBOOKS.length ? [] : next;
    });
  }

  function selectAll() {
    triggerSelectionHaptic();
    setLocalSelected([]);
  }

  function handleSave() {
    triggerSuccessHaptic();
    onSave(localSelected);
    animateClose();
  }

  const saveLabel =
    isAllBooks
      ? "Save \u00B7 All books"
      : `Save \u00B7 ${localSelected.length} book${localSelected.length !== 1 ? "s" : ""}`;

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
          <Text style={s.headerTitle}>My Sportsbooks</Text>
          <Pressable onPress={animateClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={brandColors.textMuted} />
          </Pressable>
        </View>

        {/* Scrollable book list */}
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          showsVerticalScrollIndicator
          bounces={false}
        >
          {/* All Books row */}
          <Pressable onPress={selectAll} style={[s.bookRow, isAllBooks && s.bookRowActive]}>
            <Text style={[s.bookText, isAllBooks && s.bookTextActive]}>All Books</Text>
            {isAllBooks ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
          </Pressable>

          {/* Individual book rows */}
          {ALL_SPORTSBOOKS.map((book) => {
            const active = isAllBooks || localSelected.includes(book.id);
            const logo = getSportsbookLogoUrl(book.id);
            return (
              <Pressable
                key={book.id}
                onPress={() => toggleBook(book.id)}
                style={[s.bookRow, active && s.bookRowActive]}
              >
                <View style={s.bookRowLeft}>
                  {logo ? <Image source={{ uri: logo }} style={s.bookLogo} /> : null}
                  <Text style={[s.bookText, active && s.bookTextActive]}>{book.name}</Text>
                </View>
                {active ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Save button */}
        <View style={s.footer}>
          <Pressable onPress={handleSave} style={s.saveBtn}>
            <Text style={s.saveBtnText}>{saveLabel}</Text>
          </Pressable>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  bookRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  bookRowActive: { backgroundColor: brandColors.primarySoft },
  bookRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookLogo: { width: 22, height: 22, borderRadius: 6 },
  bookText: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "500" },
  bookTextActive: { color: brandColors.primary, fontWeight: "700" },

  footer: {
    borderTopWidth: 1,
    borderTopColor: brandColors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: brandColors.panelBackground,
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
