"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type SpotlightPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "left-center"
  | "right-center"
  | "center";

export interface SpotlightConfig {
  /** Position of the spotlight origin */
  position: SpotlightPosition;
  /** Color - can be RGB tuple [r,g,b], hex string, or CSS variable like "var(--color-red-500)" */
  color: [number, number, number] | string;
  /** Intensity of the light (0-1+) */
  intensity?: number;
  /** Length of the ray/beam */
  size?: number;
  /** Spread angle of the cone in degrees (default: 45) */
  spread?: number;
  /** Custom angle override in degrees (default: auto based on position) */
  angle?: number;
  /** Custom offset from the calculated position [x, y] */
  offset?: [number, number];
}

export interface SpotlightShaderProps {
  /** CSS class name for the container */
  className?: string;
  /** Array of spotlight configurations */
  spotlights?: SpotlightConfig[];
  /** Ambient/background color - RGB tuple, hex, or CSS variable */
  ambientColor?: [number, number, number] | string;
  /** Animation speed multiplier */
  animationSpeed?: number;
  /** Enable subtle spotlight animation */
  enableAnimation?: boolean;
  /** Duration of the ease-in animation in seconds */
  easeInDuration?: number;
  /** Blur amount for softer edges (0-100, default: 20) */
  blur?: number;
}

export const SpotlightShader: React.FC<SpotlightShaderProps> = ({
  className,
  spotlights = [
    {
      position: "top-left",
      color: "var(--primary)",
      intensity: 0.8,
      size: 420,
      spread: 50,
    },
  ],
  ambientColor = "var(--color-neutral-900)",
  animationSpeed = 0.2,
  enableAnimation = true,
  easeInDuration = 1.2,
  blur = 20,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stopped = false;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Parse color from various formats (including Tailwind v4 CSS variables)
    const parseColor = (
      color: [number, number, number] | string,
    ): [number, number, number] => {
      if (Array.isArray(color)) {
        return color;
      }

      if (color.startsWith("#")) {
        const hex = color.slice(1);
        if (hex.length === 3) {
          return [
            parseInt(hex[0] + hex[0], 16),
            parseInt(hex[1] + hex[1], 16),
            parseInt(hex[2] + hex[2], 16),
          ];
        }
        if (hex.length === 6) {
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ];
        }
      }

      let colorToResolve = color;
      if (color.startsWith("var(")) {
        const varName = color.match(/var\(([^)]+)\)/)?.[1]?.trim();
        if (varName) {
          const rawValue = getComputedStyle(container)
            .getPropertyValue(varName)
            .trim();
          if (rawValue) {
            colorToResolve = rawValue;
          }
        }
      }

      try {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.fillStyle = colorToResolve;
          tempCtx.fillRect(0, 0, 1, 1);
          const imageData = tempCtx.getImageData(0, 0, 1, 1).data;
          return [imageData[0], imageData[1], imageData[2]];
        }
      } catch {
        // Fallback below
      }

      return [100, 100, 100];
    };

    const resolvedSpotlights = spotlights.map((s) => ({
      ...s,
      resolvedColor: parseColor(s.color),
    }));
    const resolvedAmbient = parseColor(ambientColor);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        startTimeRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Get spotlight origin position based on preset
    const getSpotlightOrigin = (
      position: SpotlightPosition,
      width: number,
      height: number,
    ): { x: number; y: number } => {
      const margin = -50; // Slightly outside viewport for better beam effect
      switch (position) {
        case "top-left":
          return { x: margin, y: margin };
        case "top-right":
          return { x: width - margin, y: margin };
        case "bottom-left":
          return { x: margin, y: height - margin };
        case "bottom-right":
          return { x: width - margin, y: height - margin };
        case "top-center":
          return { x: width / 2, y: margin };
        case "left-center":
          return { x: margin, y: height / 2 };
        case "right-center":
          return { x: width - margin, y: height / 2 };
        case "center":
          return { x: width / 2, y: height / 2 };
        default:
          return { x: margin, y: margin };
      }
    };

    // Get default beam angle based on position (pointing towards center/opposite)
    const getDefaultAngle = (position: SpotlightPosition): number => {
      switch (position) {
        case "top-left":
          return 45; // diagonal down-right
        case "top-right":
          return 135; // diagonal down-left
        case "bottom-left":
          return -45; // diagonal up-right
        case "bottom-right":
          return -135; // diagonal up-left
        case "top-center":
          return 90; // straight down
        case "left-center":
          return 0; // straight right
        case "right-center":
          return 180; // straight left
        case "center":
          return 90; // default down
        default:
          return 45;
      }
    };

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const draw = (timestamp: number) => {
      if (stopped) return;

      if (startTimeRef.current === 0) {
        startTimeRef.current = timestamp;
      }

      const elapsed = (timestamp - startTimeRef.current) * 0.001;
      const time = elapsed;
      const { width, height } = container.getBoundingClientRect();

      const easeInProgress = Math.min(1, elapsed / easeInDuration);
      const easeInFactor = easeOutCubic(easeInProgress);

      // Fill with ambient color
      const [ambR, ambG, ambB] = resolvedAmbient;
      ctx.fillStyle = `rgb(${ambR}, ${ambG}, ${ambB})`;
      ctx.fillRect(0, 0, width, height);

      // Draw each spotlight as a ray/beam
      for (let i = 0; i < resolvedSpotlights.length; i++) {
        const spotlight = resolvedSpotlights[i];
        const intensity = (spotlight.intensity ?? 0.8) * easeInFactor;
        const baseSize = spotlight.size ?? 400;
        const spreadDegrees = spotlight.spread ?? 45;
        const spreadRad = (spreadDegrees * Math.PI) / 180;
        const baseAngle =
          spotlight.angle ?? getDefaultAngle(spotlight.position);
        const offset = spotlight.offset ?? [0, 0];

        const origin = getSpotlightOrigin(spotlight.position, width, height);
        origin.x += offset[0];
        origin.y += offset[1];

        // Animation
        let animX = 0;
        let animY = 0;
        let animatedIntensity = intensity;
        let animatedSize = baseSize;
        let animatedAngle = (baseAngle * Math.PI) / 180;

        if (enableAnimation) {
          const phase = i * 2.1;
          animX = Math.sin(time * animationSpeed * 0.2 + phase) * 20;
          animY = Math.cos(time * animationSpeed * 0.15 + phase) * 15;
          animatedIntensity =
            intensity *
            (0.92 + 0.08 * Math.sin(time * animationSpeed * 0.4 + phase));
          animatedSize =
            baseSize *
            (0.96 + 0.04 * Math.sin(time * animationSpeed * 0.3 + phase));
          // Subtle angle wobble
          animatedAngle += Math.sin(time * animationSpeed * 0.2 + phase) * 0.03;
        }

        const [r, g, b] = spotlight.resolvedColor;
        const originX = origin.x + animX;
        const originY = origin.y + animY;

        // Calculate beam length based on canvas diagonal
        const beamLength = Math.max(width, height) * 1.5;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Draw multiple cone layers for soft, diffused effect
        const layers = 6;
        for (let layer = layers - 1; layer >= 0; layer--) {
          const layerProgress = layer / (layers - 1);
          // Each layer gets progressively wider
          const layerSpread = spreadRad * (1 + layerProgress * 0.8);
          // Outer layers are more transparent
          const layerOpacity =
            animatedIntensity * (0.25 - layerProgress * 0.15);

          // Calculate cone edge points
          const angle1 = animatedAngle - layerSpread / 2;
          const angle2 = animatedAngle + layerSpread / 2;

          const endX1 = originX + Math.cos(angle1) * beamLength;
          const endY1 = originY + Math.sin(angle1) * beamLength;
          const endX2 = originX + Math.cos(angle2) * beamLength;
          const endY2 = originY + Math.sin(angle2) * beamLength;

          // Create gradient along the beam with smoother falloff
          const gradEndX =
            originX + Math.cos(animatedAngle) * animatedSize * 2.5;
          const gradEndY =
            originY + Math.sin(animatedAngle) * animatedSize * 2.5;

          const gradient = ctx.createLinearGradient(
            originX,
            originY,
            gradEndX,
            gradEndY,
          );

          // Smoother gradient stops for softer look
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${layerOpacity})`);
          gradient.addColorStop(
            0.15,
            `rgba(${r}, ${g}, ${b}, ${layerOpacity * 0.8})`,
          );
          gradient.addColorStop(
            0.35,
            `rgba(${r}, ${g}, ${b}, ${layerOpacity * 0.5})`,
          );
          gradient.addColorStop(
            0.55,
            `rgba(${r}, ${g}, ${b}, ${layerOpacity * 0.25})`,
          );
          gradient.addColorStop(
            0.75,
            `rgba(${r}, ${g}, ${b}, ${layerOpacity * 0.1})`,
          );
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(endX1, endY1);
          ctx.lineTo(endX2, endY2);
          ctx.closePath();
          ctx.fill();
        }

        // Add larger, softer glow at origin
        const glowRadius = animatedSize * 0.5;
        const glow = ctx.createRadialGradient(
          originX,
          originY,
          0,
          originX,
          originY,
          glowRadius,
        );
        glow.addColorStop(
          0,
          `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)}, ${animatedIntensity * 0.3})`,
        );
        glow.addColorStop(
          0.3,
          `rgba(${r}, ${g}, ${b}, ${animatedIntensity * 0.2})`,
        );
        glow.addColorStop(
          0.6,
          `rgba(${r}, ${g}, ${b}, ${animatedIntensity * 0.08})`,
        );
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(originX, originY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ro.disconnect();
    };
  }, [
    spotlights,
    ambientColor,
    animationSpeed,
    enableAnimation,
    easeInDuration,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-black", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          display: "block",
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      />
    </div>
  );
};
