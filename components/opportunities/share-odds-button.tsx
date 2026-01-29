"use client";

import React, { useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import { Share2, Check, Loader2, Image, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ShareOddsButtonProps {
  /** Content to render inside the share modal (captured as image) */
  shareContent: React.ReactNode;
  /** Text to copy */
  shareText: string;
  className?: string;
}

export function ShareOddsButton({
  shareContent,
  shareText,
  className,
}: ShareOddsButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [copySuccess, setCopySuccess] = useState<"image" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopySuccess("text");
      setTimeout(() => setCopySuccess(null), 2000);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to copy text:", err);
      setError("Failed to copy");
      setTimeout(() => setError(null), 2000);
    }
  };

  const captureAndCopy = async () => {
    if (isCapturing) return;

    setIsCapturing(true);
    setError(null);
    setCopySuccess(null);

    try {
      const captureTarget = captureRef.current;

      if (!captureTarget) {
        throw new Error("Nothing to capture");
      }

      // Wait for animations to complete
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Temporarily hide problematic elements instead of removing them
      const elementsToHide: HTMLElement[] = [];
      document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper], [data-state="open"][data-radix-tooltip-content]').forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.display !== "none") {
          elementsToHide.push(htmlEl);
          htmlEl.style.setProperty("display", "none", "important");
        }
      });

      const captureOptions = {
        backgroundColor: "#0a0a0a",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        foreignObjectRendering: false,
        ignoreElements: (element: Element) => {
          if (!element) return false;
          if (element.hasAttribute?.("data-hide-on-capture")) return true;
          if (element.tagName === "IFRAME") return true;
          if (element.hasAttribute?.("data-radix-popper-content-wrapper")) return true;
          if (element.getAttribute?.("role") === "tooltip") return true;
          return false;
        },
      };

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(captureTarget, captureOptions);
      } catch (captureError) {
        const message = captureError instanceof Error ? captureError.message : String(captureError);
        if (message.includes("cloned iframe")) {
          // Fallback: capture full page and crop to target rect
          const rect = captureTarget.getBoundingClientRect();
          const fullCanvas = await html2canvas(document.body, {
            ...captureOptions,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight,
            scrollX: -window.scrollX,
            scrollY: -window.scrollY,
          });

          const scaleX = fullCanvas.width / document.documentElement.scrollWidth;
          const scaleY = fullCanvas.height / document.documentElement.scrollHeight;
          const cropX = (rect.left + window.scrollX) * scaleX;
          const cropY = (rect.top + window.scrollY) * scaleY;
          const cropW = rect.width * scaleX;
          const cropH = rect.height * scaleY;

          const croppedCanvas = document.createElement("canvas");
          croppedCanvas.width = Math.max(1, Math.floor(cropW));
          croppedCanvas.height = Math.max(1, Math.floor(cropH));
          const croppedCtx = croppedCanvas.getContext("2d");
          if (!croppedCtx) {
            throw new Error("Could not create crop canvas context");
          }
          croppedCtx.drawImage(
            fullCanvas,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            croppedCanvas.width,
            croppedCanvas.height
          );
          canvas = croppedCanvas;
        } else {
          throw captureError;
        }
      } finally {
        // Restore hidden elements
        elementsToHide.forEach((el) => {
          el.style.removeProperty("display");
        });
      }

      // Verify canvas has dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Capture produced empty image");
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          1.0
        );
      });

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      setCopySuccess("image");
      setTimeout(() => setCopySuccess(null), 2000);
      setIsOpen(false);
    } catch (err) {
      console.error("Error capturing odds:", err);
      setError("Failed to capture");
      setTimeout(() => setError(null), 2000);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <Tooltip content={copySuccess ? (copySuccess === "image" ? "Image copied!" : "Text copied!") : "Share"}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isCapturing}
          className={cn(
            "hidden lg:block p-1 lg:p-1.5 rounded-lg transition-all duration-200",
            "hover:scale-110 active:scale-95",
            copySuccess
              ? "bg-emerald-500/10 text-emerald-500"
              : error
                ? "bg-red-500/10 text-red-500"
                : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400",
            isCapturing && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {isCapturing ? (
            <Loader2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
          ) : copySuccess ? (
            <Check className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          ) : (
            <Share2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          )}
        </button>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-auto max-w-[95vw] max-h-[95vh] overflow-auto border-0 bg-transparent p-0 shadow-none">
          <VisuallyHidden>
            <DialogTitle>Share Odds</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col items-center gap-4">
            {/* Capture target - the share card */}
            <div ref={captureRef} className="rounded-2xl overflow-hidden shadow-2xl">
              {shareContent}
            </div>

            {/* Action buttons - neutral colors for consistency across tools */}
            <div className="flex items-center gap-3 w-full max-w-[400px]" data-hide-on-capture>
              <button
                type="button"
                onClick={captureAndCopy}
                disabled={isCapturing}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold",
                  "bg-neutral-700 text-white hover:bg-neutral-600 border border-neutral-600 transition-colors",
                  isCapturing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCapturing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Image className="h-4 w-4" />
                )}
                {isCapturing ? "Copying..." : "Copy Image"}
              </button>
              <button
                type="button"
                onClick={copyText}
                disabled={isCapturing}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold",
                  "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700 transition-colors",
                  isCapturing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Type className="h-4 w-4" />
                Copy Text
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
