"use client";

import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas-pro";
import { Share2, Check, Loader2, Download, Image, Type, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { formatMarketLabel } from "@/lib/data/markets";

interface ShareStats {
  hitRate: number | null;
  avg: number | null;
  gamesCount: number;
  line: number | null;
}

interface ActiveFilter {
  type: "quick" | "injury" | "chart" | "playType" | "shotZone";
  label: string;
}

interface ShareChartButtonProps {
  /** Ref to the element to capture */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Player name for the filename */
  playerName?: string;
  /** Market type for context */
  market?: string | null;
  /** Additional class name */
  className?: string;
  /** Compact mode - icon only */
  compact?: boolean;
  /** Callback to notify parent that capture is starting (to hide elements) */
  onCaptureStart?: () => void;
  /** Callback to notify parent that capture is complete */
  onCaptureEnd?: () => void;
  /** Game range selected (L5, L10, L20, Season, H2H) */
  gameRange?: string;
  /** Stats for the text share */
  stats?: ShareStats;
  /** Active filters for text share */
  activeFilters?: ActiveFilter[];
}

export function ShareChartButton({
  targetRef,
  playerName = "Player",
  market = "stats",
  className,
  compact = false,
  onCaptureStart,
  onCaptureEnd,
  gameRange = "L10",
  stats,
  activeFilters = [],
}: ShareChartButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [copySuccess, setCopySuccess] = useState<"image" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // Generate shareable text
  const generateShareText = () => {
    const marketLabel = market ? formatMarketLabel(market) : "Stats";
    const lines: string[] = [];
    
    // Header
    lines.push(`📊 ${playerName} - ${marketLabel}`);
    lines.push("");
    
    // Stats
    if (stats) {
      if (stats.hitRate !== null && stats.line !== null) {
        lines.push(`✅ ${stats.hitRate.toFixed(0)}% Hit Rate (${gameRange})`);
        lines.push(`📈 Line: ${stats.line} | Avg: ${stats.avg?.toFixed(1) ?? "—"}`);
        lines.push(`🎯 ${stats.gamesCount} games analyzed`);
      } else if (stats.avg !== null) {
        lines.push(`📈 Average: ${stats.avg.toFixed(1)} (${gameRange})`);
        lines.push(`🎯 ${stats.gamesCount} games analyzed`);
      }
    } else {
      lines.push(`📈 Range: ${gameRange}`);
    }
    
    // Active filters
    if (activeFilters.length > 0) {
      lines.push("");
      lines.push(`🔍 Filters: ${activeFilters.map(f => f.label).join(", ")}`);
    }
    
    // Footer
    lines.push("");
    lines.push("via unjuiced.bet");
    
    return lines.join("\n");
  };

  const copyText = async () => {
    const text = generateShareText();
    
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess("text");
      setTimeout(() => setCopySuccess(null), 2000);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Failed to copy text:", err);
      setError("Failed to copy");
      setTimeout(() => setError(null), 2000);
    }
  };

  const captureAndCopy = async () => {
    if (!targetRef.current || isCapturing) return;

    setIsCapturing(true);
    setError(null);
    setCopySuccess(null);
    setIsMenuOpen(false);

    // Notify parent to hide elements
    onCaptureStart?.();

    // Small delay to let DOM update
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Capture the element
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0a0a0a", // Dark background
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        ignoreElements: (element) => {
          // Ignore elements with data-hide-on-capture attribute
          return element.hasAttribute?.("data-hide-on-capture");
        },
      });

      // Create a new canvas with subtle branding
      const watermarkedCanvas = document.createElement("canvas");
      const ctx = watermarkedCanvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Could not create canvas context");
      }

      // Set dimensions with padding
      const padding = 20;
      const brandingHeight = 28;
      watermarkedCanvas.width = canvas.width + padding * 2;
      watermarkedCanvas.height = canvas.height + padding * 2 + brandingHeight;

      // Fill background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, watermarkedCanvas.width, watermarkedCanvas.height);

      // Draw the captured image
      ctx.drawImage(canvas, padding, padding);

      // Add subtle branding in bottom left - just "unjuiced.com"
      const brandingY = canvas.height + padding + brandingHeight - 8;
      
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#525252"; // Very subtle gray
      ctx.textBaseline = "middle";
      ctx.fillText("unjuiced.com", padding, brandingY);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          1.0
        );
      });

      // Try to copy to clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        setCopySuccess("image");
        setTimeout(() => setCopySuccess(null), 2000);
      } catch (clipboardError) {
        // Fallback: download the image
        console.warn("Clipboard API not available, downloading instead:", clipboardError);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${playerName.replace(/\s+/g, "-").toLowerCase()}-${market}-unjuiced.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setCopySuccess("image");
        setTimeout(() => setCopySuccess(null), 2000);
      }
    } catch (err) {
      console.error("Error capturing chart:", err);
      setError("Failed to capture");
      setTimeout(() => setError(null), 2000);
    } finally {
      setIsCapturing(false);
      onCaptureEnd?.();
    }
  };

  // Compact mode with dropdown
  if (compact) {
    return (
      <div className="relative" ref={menuRef}>
        <Tooltip content={copySuccess ? (copySuccess === "image" ? "Image copied!" : "Text copied!") : "Share chart"}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            disabled={isCapturing}
            className={cn(
              "p-2 rounded-lg border transition-all flex items-center gap-1",
              copySuccess
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : error
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-brand hover:border-brand/30",
              isCapturing && "opacity-50 cursor-not-allowed",
              className
            )}
          >
            {isCapturing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : copySuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </Tooltip>

        {/* Dropdown Menu */}
        {isMenuOpen && !isCapturing && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <button
              type="button"
              onClick={captureAndCopy}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <Image className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">Copy as Image</div>
                <div className="text-[10px] text-neutral-500">Chart screenshot</div>
              </div>
            </button>
            <button
              type="button"
              onClick={copyText}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors border-t border-neutral-100 dark:border-neutral-700"
            >
              <Type className="h-4 w-4 text-neutral-500" />
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">Copy as Text</div>
                <div className="text-[10px] text-neutral-500">Stats summary</div>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full button mode with dropdown
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={isCapturing}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
          copySuccess
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            : error
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-brand hover:border-brand/30",
          isCapturing && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {isCapturing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : copySuccess ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
        <span>
          {isCapturing ? "Capturing..." : copySuccess ? "Copied!" : error || "Share"}
        </span>
        {!isCapturing && !copySuccess && !error && (
          <ChevronDown className="h-3 w-3 ml-0.5" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && !isCapturing && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <button
            type="button"
            onClick={captureAndCopy}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <Image className="h-4 w-4 text-neutral-500" />
            <div>
              <div className="font-medium text-neutral-900 dark:text-white">Copy as Image</div>
              <div className="text-[10px] text-neutral-500">Chart screenshot</div>
            </div>
          </button>
          <button
            type="button"
            onClick={copyText}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors border-t border-neutral-100 dark:border-neutral-700"
          >
            <Type className="h-4 w-4 text-neutral-500" />
            <div>
              <div className="font-medium text-neutral-900 dark:text-white">Copy as Text</div>
              <div className="text-[10px] text-neutral-500">Stats summary</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// Download variant - always downloads instead of copying
export function DownloadChartButton({
  targetRef,
  playerName = "Player",
  market = "stats",
  className,
  compact = false,
  onCaptureStart,
  onCaptureEnd,
}: ShareChartButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [success, setSuccess] = useState(false);

  const captureAndDownload = async () => {
    if (!targetRef.current || isCapturing) return;

    setIsCapturing(true);
    setSuccess(false);
    onCaptureStart?.();
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        ignoreElements: (element) => {
          return element.hasAttribute?.("data-hide-on-capture");
        },
      });

      // Create canvas with subtle branding
      const watermarkedCanvas = document.createElement("canvas");
      const ctx = watermarkedCanvas.getContext("2d");
      
      if (!ctx) throw new Error("Could not create canvas context");

      const padding = 20;
      const brandingHeight = 28;
      watermarkedCanvas.width = canvas.width + padding * 2;
      watermarkedCanvas.height = canvas.height + padding * 2 + brandingHeight;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, watermarkedCanvas.width, watermarkedCanvas.height);
      ctx.drawImage(canvas, padding, padding);

      // Subtle branding
      const brandingY = canvas.height + padding + brandingHeight - 8;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#525252";
      ctx.textBaseline = "middle";
      ctx.fillText("unjuiced.com", padding, brandingY);

      // Download
      const link = document.createElement("a");
      link.download = `${playerName.replace(/\s+/g, "-").toLowerCase()}-${market}-unjuiced.png`;
      link.href = watermarkedCanvas.toDataURL("image/png", 1.0);
      link.click();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Error capturing chart:", err);
    } finally {
      setIsCapturing(false);
      onCaptureEnd?.();
    }
  };

  if (compact) {
    return (
      <Tooltip content="Download chart as image">
        <button
          type="button"
          onClick={captureAndDownload}
          disabled={isCapturing}
          className={cn(
            "p-2 rounded-lg border transition-all",
            success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-brand hover:border-brand/30",
            isCapturing && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {isCapturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : success ? (
            <Check className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={captureAndDownload}
      disabled={isCapturing}
      className={cn(
        "flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
        success
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
          : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-brand hover:border-brand/30",
        isCapturing && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {isCapturing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : success ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      <span className="ml-1.5">
        {isCapturing ? "Saving..." : success ? "Saved!" : "Download"}
      </span>
    </button>
  );
}
