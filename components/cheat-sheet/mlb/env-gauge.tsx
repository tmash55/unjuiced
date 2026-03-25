"use client";

import { useId } from "react";
import { getScoreTier } from "./env-score";

interface EnvGaugeProps {
  score: number;
  size?: number;
}

export function EnvGauge({ score, size = 160 }: EnvGaugeProps) {
  const tier = getScoreTier(score);
  const id = useId();

  // Fixed internal coordinate system for clean math
  const W = 200;
  const H = 140;
  const cx = W / 2;
  const cy = 100;
  const radius = 72;
  const strokeWidth = 14;

  const halfCircumference = Math.PI * radius;
  const filledLength = (score / 100) * halfCircumference;
  const unfilledLength = halfCircumference - filledLength;

  // Score needle position
  const scoreAngle = Math.PI * (1 - score / 100);
  const needleX = cx + radius * Math.cos(scoreAngle);
  const needleY = cy - radius * Math.sin(scoreAngle);

  // Arc endpoints
  const arcStartX = cx - radius;
  const arcEndX = cx + radius;
  const arcPath = `M ${arcStartX} ${cy} A ${radius} ${radius} 0 0 1 ${arcEndX} ${cy}`;

  const tierColor =
    score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : score >= 31 ? "#F97316" : "#EF4444";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <defs>
          <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="30%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          className="stroke-neutral-200 dark:stroke-white/[0.08]"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {score > 0 && (
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#${id}-grad)`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${unfilledLength}`}
          />
        )}

        {/* Needle dot */}
        <circle
          cx={needleX}
          cy={needleY}
          r={6}
          className="fill-neutral-900 dark:fill-white"
          stroke={tierColor}
          strokeWidth={2}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="font-bold fill-neutral-900 dark:fill-white"
          fontSize="36"
        >
          {score}
        </text>

        {/* Tier label — sits below the arc baseline with enough room */}
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.1em"
          fill={tierColor}
        >
          {tier.label.toUpperCase()}
        </text>

        {/* Min/max labels */}
        <text
          x={arcStartX - 2}
          y={cy + 14}
          textAnchor="middle"
          fontSize="9"
          className="fill-neutral-400 dark:fill-white/30"
        >
          0
        </text>
        <text
          x={arcEndX + 2}
          y={cy + 14}
          textAnchor="middle"
          fontSize="9"
          className="fill-neutral-400 dark:fill-white/30"
        >
          100
        </text>
      </svg>
    </div>
  );
}
