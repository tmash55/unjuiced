"use client";

import React, { useState } from "react";
import html2canvas from "html2canvas-pro";
import { Download, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";

interface ExportChartButtonProps {
  chartRef: React.RefObject<HTMLElement | null>;
  selectionTitle?: string;
  className?: string;
}

export function ExportChartButton({ chartRef, selectionTitle = "line-history", className }: ExportChartButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [success, setSuccess] = useState(false);

  const captureChart = async () => {
    if (!chartRef.current || isCapturing) return;
    setIsCapturing(true);
    setSuccess(false);

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        ignoreElements: (element) => element.hasAttribute?.("data-hide-on-capture"),
      });

      // Add padding and branding
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

      const brandingY = canvas.height + padding + brandingHeight - 8;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#525252";
      ctx.textBaseline = "middle";
      ctx.fillText("unjuiced.com", padding, brandingY);

      const blob = await new Promise<Blob>((resolve, reject) => {
        watermarkedCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          "image/png",
          1.0
        );
      });

      // Try clipboard first, fallback to download
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectionTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-line-history-unjuiced.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Error capturing chart:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Tooltip content={success ? "Copied to clipboard!" : "Export chart as image"}>
      <button
        type="button"
        onClick={captureChart}
        disabled={isCapturing}
        className={cn(
          "p-1.5 rounded-md border transition-all",
          success
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
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
      </button>
    </Tooltip>
  );
}
