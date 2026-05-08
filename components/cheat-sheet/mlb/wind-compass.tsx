"use client";

interface WindCompassProps {
  windRelativeDeg: number;
  windSpeedMph: number;
  windLabel: string;
}

export function WindCompass({ windRelativeDeg, windSpeedMph, windLabel }: WindCompassProps) {
  const label = (windLabel ?? "").toLowerCase();
  const isOut = label.includes("blowing out") || label.includes("out to");
  const isIn = label.includes("blowing in") || (label.includes("in from") && !label.includes("cross"));

  // Arrow color based on direction
  const arrowColor = isOut ? "#10B981" : isIn ? "#EF4444" : "#F59E0B";
  const arrowColorFaded = isOut ? "rgba(16,185,129,0.3)" : isIn ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";

  // Wind direction vector
  const rad = ((windRelativeDeg - 90) * Math.PI) / 180;
  const vx = Math.cos(rad);
  const vy = Math.sin(rad);

  const cx = 50;
  const cy = 50;
  const arrowLen = 22;

  const tipX = cx + vx * arrowLen;
  const tipY = cy + vy * arrowLen;
  const tailX = cx - vx * arrowLen;
  const tailY = cy - vy * arrowLen;

  const perpX = -vy;
  const perpY = vx;
  const baseX = cx + vx * (arrowLen - 7);
  const baseY = cy + vy * (arrowLen - 7);
  const headPath = `M${tipX.toFixed(1)},${tipY.toFixed(1)} L${(baseX + perpX * 5).toFixed(1)},${(baseY + perpY * 5).toFixed(1)} L${(baseX - perpX * 5).toFixed(1)},${(baseY - perpY * 5).toFixed(1)} Z`;

  const fieldPoints = `${cx},${cy - 36} ${cx + 30},${cy - 4} ${cx},${cy + 28} ${cx - 30},${cy - 4}`;

  const desc = windSpeedMph > 0 ? `${Math.round(windSpeedMph)} mph` : "Calm";
  const shortLabel = isOut ? "Blowing Out" : isIn ? "Blowing In" : label.includes("cross") ? "Crosswind" : windSpeedMph < 3 ? "Calm" : "Variable";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Diamond field outline */}
        <polygon
          points={fieldPoints}
          className="fill-neutral-100/50 stroke-neutral-300 dark:fill-white/[0.03] dark:stroke-white/15"
          strokeWidth="1"
        />

        {/* Direction labels */}
        <text x={cx} y={cy - 38} textAnchor="middle" fontSize="7" fontWeight="600" className="fill-neutral-400 dark:fill-white/40">CF</text>
        <text x={cx + 34} y={cy - 2} textAnchor="middle" fontSize="7" fontWeight="600" className="fill-neutral-400 dark:fill-white/40">RF</text>
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize="7" fontWeight="600" className="fill-neutral-400 dark:fill-white/40">HP</text>
        <text x={cx - 34} y={cy - 2} textAnchor="middle" fontSize="7" fontWeight="600" className="fill-neutral-400 dark:fill-white/40">LF</text>

        {/* Wind glow behind arrow */}
        {windSpeedMph > 0 && (
          <line
            x1={tailX} y1={tailY} x2={tipX} y2={tipY}
            stroke={arrowColorFaded}
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}

        {/* Wind arrow shaft */}
        <line
          x1={tailX} y1={tailY} x2={baseX} y2={baseY}
          stroke={arrowColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={windSpeedMph > 0 ? 1 : 0.25}
        />

        {/* Wind arrow head */}
        <path d={headPath} fill={arrowColor} opacity={windSpeedMph > 0 ? 1 : 0.25} />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2.5" className="fill-neutral-400 dark:fill-white/50" />
      </svg>
      <p className="text-[11px] text-center leading-tight">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">{desc}</span>
        {" "}
        <span className="text-neutral-500">{shortLabel}</span>
      </p>
    </div>
  );
}
