import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { ShotZone } from "@unjuiced/api";
import { brandColors } from "@/src/theme/brand";

// ── Layout constants ──
const SCREEN_W = Dimensions.get("window").width;
const COURT_W = Math.min(SCREEN_W - 32, 380);
// SVG viewBox is 500 wide x 400 tall (half court, baseline at top)
const VB_W = 500;
const VB_H = 400;
const COURT_H = Math.round(COURT_W * (VB_H / VB_W));

// ── NBA court proportions (10 units = 1 foot) ──
const BASELINE_Y = 8;
const BASKET_X = 250;
const BASKET_Y = 51; // ~4.3 ft from baseline
const PAINT_LEFT = 170;
const PAINT_RIGHT = 330;
const PAINT_BOTTOM = 195;
const FT_RADIUS = 60;
const RESTRICTED_R = 40;
const THREE_RADIUS = 238;
const CORNER_X_LEFT = 30;
const CORNER_X_RIGHT = 470;
const CORNER_Y_BOTTOM = 139; // where the arc meets the corners

// ── Colors ──
const COURT_LINE = "rgba(255,255,255,0.30)";

function zoneGradientId(rating: string): string {
  switch (rating) {
    case "favorable": return "url(#favorableGrad)";
    case "tough": return "url(#toughGrad)";
    case "neutral": return "url(#neutralGrad)";
    default: return "url(#neutralGrad)";
  }
}

function zoneBorderColor(rating: string): string {
  switch (rating) {
    case "favorable": return "rgba(34,197,94,0.65)";
    case "tough": return "rgba(239,68,68,0.65)";
    case "neutral": return "rgba(245,158,11,0.65)";
    default: return "rgba(255,255,255,0.15)";
  }
}

function ratingColor(rating: string): string {
  switch (rating) {
    case "favorable": return "#34D399";
    case "tough": return "#F87171";
    case "neutral": return "#FBBF24";
    default: return brandColors.textMuted;
  }
}

function findZone(zones: ShotZone[], key: string): ShotZone | undefined {
  return zones.find((z) => z.zone.toLowerCase().includes(key));
}

interface ShotZoneCourtProps {
  zones: ShotZone[];
  oppAbbr: string | null;
}

export function ShotZoneCourt({ zones }: ShotZoneCourtProps) {
  const rim = findZone(zones, "rim") ?? findZone(zones, "restricted");
  const paint = findZone(zones, "paint") ?? findZone(zones, "key");
  const mid = findZone(zones, "mid");
  const leftCorner = findZone(zones, "left") ?? findZone(zones, "corner_left");
  const rightCorner = findZone(zones, "right") ?? findZone(zones, "corner_right");
  const aboveBreak = findZone(zones, "above") ?? findZone(zones, "arc");

  // Build 3-point arc path (from left corner up and around to right corner)
  const arcPath = buildThreePointArc();

  return (
    <View style={s.wrapper}>
      <View style={[s.courtContainer, { width: COURT_W, height: COURT_H }]}>
        <Svg
          width={COURT_W}
          height={COURT_H}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
        >
          <Defs>
            {/* Favorable (green) */}
            <LinearGradient id="favorableGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#34d399" stopOpacity="0.50" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0.60" />
            </LinearGradient>
            {/* Tough (red) */}
            <LinearGradient id="toughGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.50" />
              <Stop offset="100%" stopColor="#dc2626" stopOpacity="0.60" />
            </LinearGradient>
            {/* Neutral (amber) */}
            <LinearGradient id="neutralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
            </LinearGradient>
          </Defs>

          {/* Court background */}
          <Rect x="0" y="0" width={VB_W} height={VB_H} rx="12" fill="rgba(196,129,61,0.12)" />

          {/* Wood grain lines */}
          {Array.from({ length: 16 }, (_, i) => (
            <Line
              key={`grain-${i}`}
              x1="0" y1={25 * (i + 1)}
              x2={VB_W} y2={25 * (i + 1)}
              stroke="rgba(255,255,255,0.025)" strokeWidth="0.8"
            />
          ))}

          {/* ─── Zone fills ─── */}
          {/* Draw order: mid-range first (full interior), then corners/paint/rim on top */}

          {/* Above Break 3 (outside the arc) */}
          {aboveBreak ? (
            <Path
              d={buildAboveBreakPath()}
              fill={zoneGradientId(aboveBreak.matchup_rating)}
              stroke={zoneBorderColor(aboveBreak.matchup_rating)}
              strokeWidth="2"
            />
          ) : null}

          {/* Mid-Range — fills entire interior of 3pt boundary (corners/paint/rim draw on top) */}
          {mid ? (
            <Path
              d={buildFullInteriorPath()}
              fill={zoneGradientId(mid.matchup_rating)}
              stroke={zoneBorderColor(mid.matchup_rating)}
              strokeWidth="1.5"
            />
          ) : null}

          {/* Left Corner 3 (on top of mid-range) */}
          {leftCorner ? (
            <Rect
              x={0} y={BASELINE_Y}
              width={CORNER_X_LEFT} height={CORNER_Y_BOTTOM - BASELINE_Y}
              fill={zoneGradientId(leftCorner.matchup_rating)}
              stroke={zoneBorderColor(leftCorner.matchup_rating)}
              strokeWidth="2"
            />
          ) : null}

          {/* Right Corner 3 (on top of mid-range) */}
          {rightCorner ? (
            <Rect
              x={CORNER_X_RIGHT} y={BASELINE_Y}
              width={VB_W - CORNER_X_RIGHT} height={CORNER_Y_BOTTOM - BASELINE_Y}
              fill={zoneGradientId(rightCorner.matchup_rating)}
              stroke={zoneBorderColor(rightCorner.matchup_rating)}
              strokeWidth="2"
            />
          ) : null}

          {/* Paint — full lane rectangle with restricted area cut out */}
          {paint ? (
            <Path
              d={buildPaintPath()}
              fill={zoneGradientId(paint.matchup_rating)}
              stroke={zoneBorderColor(paint.matchup_rating)}
              strokeWidth="1.5"
              fillRule="evenodd"
            />
          ) : null}

          {/* Restricted area / Rim (on top of everything) */}
          {rim ? (
            <Path
              d={buildRestrictedPath()}
              fill={zoneGradientId(rim.matchup_rating)}
              stroke={zoneBorderColor(rim.matchup_rating)}
              strokeWidth="1.5"
            />
          ) : null}

          {/* ─── Court lines (drawn on top of zones) ─── */}
          <G opacity="0.7">
            {/* Baseline */}
            <Line
              x1="0" y1={BASELINE_Y} x2={VB_W} y2={BASELINE_Y}
              stroke={COURT_LINE} strokeWidth="2"
            />

            {/* 3-Point line */}
            <Path d={arcPath} fill="none" stroke={COURT_LINE} strokeWidth="1.5" />

            {/* Paint / Key */}
            <Rect
              x={PAINT_LEFT} y={BASELINE_Y}
              width={PAINT_RIGHT - PAINT_LEFT} height={PAINT_BOTTOM - BASELINE_Y}
              fill="none" stroke={COURT_LINE} strokeWidth="1.5"
            />

            {/* Free throw circle */}
            <Circle
              cx={BASKET_X} cy={PAINT_BOTTOM} r={FT_RADIUS}
              fill="none" stroke={COURT_LINE} strokeWidth="1.5"
              strokeDasharray="6,6"
            />
            {/* Solid bottom half of FT circle */}
            <Path
              d={`M ${BASKET_X - FT_RADIUS} ${PAINT_BOTTOM} A ${FT_RADIUS} ${FT_RADIUS} 0 0 0 ${BASKET_X + FT_RADIUS} ${PAINT_BOTTOM}`}
              fill="none" stroke={COURT_LINE} strokeWidth="1.5"
            />

            {/* Restricted area arc */}
            <Path
              d={`M ${BASKET_X - RESTRICTED_R} ${BASKET_Y} A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 0 ${BASKET_X + RESTRICTED_R} ${BASKET_Y}`}
              fill="none" stroke={COURT_LINE} strokeWidth="1.5"
            />

            {/* Backboard */}
            <Line
              x1={BASKET_X - 30} y1={BASKET_Y - 7}
              x2={BASKET_X + 30} y2={BASKET_Y - 7}
              stroke="rgba(255,255,255,0.4)" strokeWidth="3"
            />

            {/* Rim */}
            <Circle
              cx={BASKET_X} cy={BASKET_Y}
              r="8" fill="none" stroke="#f97316" strokeWidth="2" opacity="0.8"
            />
            {/* Rim center dot */}
            <Circle cx={BASKET_X} cy={BASKET_Y} r="2" fill="#f97316" opacity="0.6" />
          </G>
        </Svg>

        {/* ─── Badge overlays (positioned absolutely over the SVG) ─── */}

        {/* Rim / Net badge */}
        {rim ? (
          <View style={[s.badgeCenter, { top: "3%" }]}>
            <ZoneBadge zone={rim} label="NET" />
          </View>
        ) : null}

        {/* Paint badge */}
        {paint ? (
          <View style={[s.badgeCenter, { top: "28%" }]}>
            <ZoneBadge zone={paint} label="PAINT" />
          </View>
        ) : null}

        {/* Mid-Range badge */}
        {mid ? (
          <View style={[s.badgeCenter, { top: "52%" }]}>
            <ZoneBadge zone={mid} label="MID-RANGE" />
          </View>
        ) : null}

        {/* Left Corner 3 badge */}
        {leftCorner ? (
          <View style={[s.badgeWrap, { top: "6%", left: 2 }]}>
            <ZoneBadge zone={leftCorner} label="L CORNER" />
          </View>
        ) : null}

        {/* Right Corner 3 badge */}
        {rightCorner ? (
          <View style={[s.badgeWrap, { top: "6%", right: 2 }]}>
            <ZoneBadge zone={rightCorner} label="R CORNER" />
          </View>
        ) : null}

        {/* Above Break 3 badge */}
        {aboveBreak ? (
          <View style={[s.badgeCenter, { bottom: "3%" }]}>
            <ZoneBadge zone={aboveBreak} label="THREE" />
          </View>
        ) : null}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <LegendItem color="#34D399" label="Favorable (21-30)" />
        <LegendItem color="#FBBF24" label="Neutral (11-20)" />
        <LegendItem color="#F87171" label="Tough (1-10)" />
      </View>
    </View>
  );
}

// ── Zone Badge ──
function ZoneBadge({ zone, label }: { zone: ShotZone; label: string }) {
  const color = ratingColor(zone.matchup_rating);
  const indicator = zone.matchup_rating === "favorable" ? "\u25B2" :
    zone.matchup_rating === "tough" ? "\u25BC" : "\u25CF";

  const shotPct = zone.player_pct_of_total != null
    ? `${Math.round(zone.player_pct_of_total)}%`
    : "—";

  const defRank = zone.opponent_def_rank != null
    ? getOrdinal(zone.opponent_def_rank)
    : "—";

  return (
    <View style={s.badge}>
      <Text style={s.badgeLabel}>{label}</Text>
      <Text style={[s.badgeValue, { color }]}>
        {indicator} {shotPct} <Text style={s.badgePipe}>|</Text> {defRank}
      </Text>
    </View>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Legend Item ──
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

// ── Path builders ──

function buildThreePointArc(): string {
  // Left corner line up, then arc across, then right corner line down
  const arcStartX = CORNER_X_LEFT;
  const arcEndX = CORNER_X_RIGHT;
  const arcStartY = CORNER_Y_BOTTOM;

  // Calculate arc endpoints on the circle
  // Arc from left corner going down and around to right corner
  const dx = arcStartX - BASKET_X;
  const dy = arcStartY - BASKET_Y;

  return [
    // Left corner vertical line
    `M ${arcStartX} ${BASELINE_Y}`,
    `L ${arcStartX} ${arcStartY}`,
    // Arc from left to right (large arc, sweep clockwise going down)
    `A ${THREE_RADIUS} ${THREE_RADIUS} 0 0 0 ${arcEndX} ${arcStartY}`,
    // Right corner vertical line
    `L ${arcEndX} ${BASELINE_Y}`
  ].join(" ");
}

function buildAboveBreakPath(): string {
  // The region beyond the 3-point arc (below it in our view)
  // Goes edge-to-edge; container overflow:hidden handles clipping
  return [
    `M ${CORNER_X_LEFT} ${CORNER_Y_BOTTOM}`,
    `A ${THREE_RADIUS} ${THREE_RADIUS} 0 0 0 ${CORNER_X_RIGHT} ${CORNER_Y_BOTTOM}`,
    `L ${VB_W} ${CORNER_Y_BOTTOM}`,
    `L ${VB_W} ${VB_H}`,
    `L 0 ${VB_H}`,
    `L 0 ${CORNER_Y_BOTTOM}`,
    `Z`
  ].join(" ");
}

function buildFullInteriorPath(): string {
  // The entire area inside the 3-pt boundary (from baseline to arc).
  // Corners, paint, and rim draw on top with their own colors.
  return [
    `M ${CORNER_X_LEFT} ${BASELINE_Y}`,
    `L ${CORNER_X_RIGHT} ${BASELINE_Y}`,
    `L ${CORNER_X_RIGHT} ${CORNER_Y_BOTTOM}`,
    `A ${THREE_RADIUS} ${THREE_RADIUS} 0 0 1 ${CORNER_X_LEFT} ${CORNER_Y_BOTTOM}`,
    `Z`
  ].join(" ");
}

function buildPaintPath(): string {
  // Paint rectangle (clockwise) with restricted area cut out (counterclockwise)
  return [
    // Outer: full paint lane
    `M ${PAINT_LEFT} ${BASELINE_Y}`,
    `L ${PAINT_RIGHT} ${BASELINE_Y}`,
    `L ${PAINT_RIGHT} ${PAINT_BOTTOM}`,
    `L ${PAINT_LEFT} ${PAINT_BOTTOM}`,
    `Z`,
    // Inner cutout: restricted area (counterclockwise to punch hole)
    `M ${BASKET_X + RESTRICTED_R} ${BASELINE_Y}`,
    `L ${BASKET_X + RESTRICTED_R} ${BASKET_Y}`,
    `A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 1 ${BASKET_X - RESTRICTED_R} ${BASKET_Y}`,
    `L ${BASKET_X - RESTRICTED_R} ${BASELINE_Y}`,
    `Z`
  ].join(" ");
}

function buildRestrictedPath(): string {
  // Semicircle below the basket
  return [
    `M ${BASKET_X - RESTRICTED_R} ${BASELINE_Y}`,
    `L ${BASKET_X - RESTRICTED_R} ${BASKET_Y}`,
    `A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 0 ${BASKET_X + RESTRICTED_R} ${BASKET_Y}`,
    `L ${BASKET_X + RESTRICTED_R} ${BASELINE_Y}`,
    `Z`
  ].join(" ");
}

// ── Styles ──

const s = StyleSheet.create({
  wrapper: { gap: 10 },

  courtContainer: {
    alignSelf: "center",
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.3)"
  },

  /* Badge overlay */
  badgeCenter: {
    position: "absolute",
    left: 0, right: 0,
    zIndex: 10,
    alignItems: "center"
  },
  badgeWrap: {
    position: "absolute",
    zIndex: 10
  },

  badge: {
    alignItems: "center",
    gap: 1,
    backgroundColor: "rgba(10, 10, 20, 0.70)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)"
  },
  badgeLabel: {
    color: "rgba(255,255,255,0.50)", fontSize: 8, fontWeight: "700",
    letterSpacing: 0.4, textTransform: "uppercase"
  },
  badgeValue: { fontSize: 12, fontWeight: "800" },
  badgePipe: { fontSize: 10, fontWeight: "400", color: "rgba(255,255,255,0.3)" },

  /* Legend */
  legend: { flexDirection: "row", justifyContent: "center", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: brandColors.textMuted, fontSize: 10, fontWeight: "600" }
});
