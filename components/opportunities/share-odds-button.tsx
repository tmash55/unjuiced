"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import html2canvas from "html2canvas-pro";
import { Share2, Check, Loader2, Image, Type, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";

interface ShareOddsButtonProps {
  /** Content to render inside the share modal (captured as image) */
  shareContent: React.ReactNode;
  /** Text to copy */
  shareText: string;
  /** Show button on mobile (default false) */
  showOnMobile?: boolean;
  /** Show toast on copy (default false) */
  toastOnCopy?: boolean;
  className?: string;
}

/** Detect if running on a real mobile/touch device (not desktop devtools) */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return hasTouch && mobileUA;
}

/** Check if the Web Share API supports sharing files */
function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;
}

export function ShareOddsButton({
  shareContent,
  shareText,
  showOnMobile = false,
  toastOnCopy = false,
  className,
}: ShareOddsButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [copySuccess, setCopySuccess] = useState<"image" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Pre-captured blob for instant sharing (avoids losing user gesture context)
  const preCapturedBlobRef = useRef<Blob | null>(null);
  const [isPreCapturing, setIsPreCapturing] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopySuccess("text");
      if (toastOnCopy) {
        toast.success("Copied share text");
      }
      setTimeout(() => setCopySuccess(null), 2000);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to copy text:", err);
      setError("Failed to copy");
      if (toastOnCopy) {
        toast.error("Failed to copy text");
      }
      setTimeout(() => setError(null), 2000);
    }
  };

  /** Capture the share card to a PNG blob */
  const captureToBlob = useCallback(async (): Promise<Blob> => {
    const captureTarget = captureRef.current;
    if (!captureTarget) {
      throw new Error("Nothing to capture");
    }

    // Wait for animations to complete
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Temporarily hide problematic elements
    const elementsToHide: HTMLElement[] = [];
    document
      .querySelectorAll(
        '[role="tooltip"], [data-radix-popper-content-wrapper], [data-state="open"][data-radix-tooltip-content]'
      )
      .forEach((el) => {
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
      const message =
        captureError instanceof Error ? captureError.message : String(captureError);
      if (message.includes("cloned iframe")) {
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
      elementsToHide.forEach((el) => {
        el.style.removeProperty("display");
      });
    }

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

    return blob;
  }, []);

  // Pre-capture the image when modal opens so share can be called synchronously from user gesture
  useEffect(() => {
    if (!isOpen) {
      preCapturedBlobRef.current = null;
      return;
    }
    let cancelled = false;
    const doCapture = async () => {
      // Wait for the card to render
      await new Promise((r) => setTimeout(r, 600));
      if (cancelled) return;
      try {
        setIsPreCapturing(true);
        const blob = await captureToBlob();
        if (!cancelled) {
          preCapturedBlobRef.current = blob;
        }
      } catch (err) {
        console.warn("Pre-capture failed, will capture on demand:", err);
      } finally {
        if (!cancelled) setIsPreCapturing(false);
      }
    };
    doCapture();
    return () => {
      cancelled = true;
    };
  }, [isOpen, captureToBlob]);

  /** Share image using the native Web Share API (mobile).
   *  Uses pre-captured blob so navigator.share() is called synchronously from user gesture. */
  const shareImageNative = async () => {
    if (isCapturing) return;
    setError(null);
    setCopySuccess(null);

    const blob = preCapturedBlobRef.current;

    if (blob) {
      // We have a pre-captured blob — call navigator.share() immediately (same microtask as click)
      const file = new File([blob], "unjuiced-odds.png", { type: "image/png" });
      try {
        if (canUseWebShare() && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Unjuiced Odds",
            text: shareText,
          });
          setCopySuccess("image");
          if (toastOnCopy) toast.success("Shared successfully");
          setTimeout(() => setCopySuccess(null), 2000);
          setIsOpen(false);
          return;
        }
        // Web Share not available, download instead
        downloadBlob(blob);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Share failed, falling back to download:", err);
        downloadBlob(blob);
        return;
      }
    }

    // No pre-captured blob yet — fall back to capture-then-download
    // (navigator.share won't work here since we'll lose the gesture, so download instead)
    setIsCapturing(true);
    try {
      const freshBlob = await captureToBlob();
      downloadBlob(freshBlob);
    } catch {
      setError("Failed to capture");
      if (toastOnCopy) toast.error("Failed to capture image");
      setTimeout(() => setError(null), 2000);
    } finally {
      setIsCapturing(false);
    }
  };

  /** Download a blob as a file */
  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unjuiced-odds.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopySuccess("image");
    if (toastOnCopy) {
      toast.success("Image saved");
    }
    setTimeout(() => setCopySuccess(null), 2000);
    setIsOpen(false);
  };

  /** Copy image to clipboard (desktop) or share natively (mobile) */
  const captureAndCopy = async () => {
    if (isCapturing) return;

    // On mobile, use native share (needs synchronous call from gesture)
    if (isMobile) {
      return shareImageNative();
    }

    // Desktop: clipboard copy (async is fine here, clipboard API is more lenient)
    setIsCapturing(true);
    setError(null);
    setCopySuccess(null);

    try {
      // Use pre-captured blob if available, otherwise capture fresh
      const blob = preCapturedBlobRef.current || (await captureToBlob());

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopySuccess("image");
      if (toastOnCopy) toast.success("Image copied");
      setTimeout(() => setCopySuccess(null), 2000);
      setIsOpen(false);
    } catch (err) {
      console.error("Error copying image:", err);
      // Fallback: download the image
      try {
        const blob = preCapturedBlobRef.current || (await captureToBlob());
        downloadBlob(blob);
      } catch {
        setError("Failed to capture");
        if (toastOnCopy) toast.error("Failed to capture image");
        setTimeout(() => setError(null), 2000);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  // Button labels based on platform
  const imageButtonLabel = isMobile ? "Share Image" : "Copy Image";
  const imageButtonIcon = isMobile ? (
    <Share2 className="h-4 w-4" />
  ) : (
    <Image className="h-4 w-4" />
  );

  const modal = isOpen && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col">
          {/* Dark backdrop - tap to close */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-neutral-800/80 text-white/70 hover:text-white hover:bg-neutral-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Scrollable content area */}
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center px-4 py-14 sm:py-8 min-h-0">
            {/* Capture target - the share card */}
            <div ref={captureRef} className="rounded-2xl overflow-hidden shadow-2xl shrink-0">
              {shareContent}
            </div>
          </div>

          {/* Sticky bottom action buttons */}
          <div
            className="relative shrink-0 px-4 pb-6 pt-3 sm:pb-4 flex justify-center bg-gradient-to-t from-black/80 to-transparent"
            data-hide-on-capture
          >
            <div className="flex items-center gap-2.5 w-full max-w-[min(400px,calc(100vw-2rem))]">
              <button
                type="button"
                onClick={captureAndCopy}
                disabled={isCapturing || (isMobile && isPreCapturing)}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold",
                  "bg-neutral-700 text-white hover:bg-neutral-600 border border-neutral-600 transition-colors",
                  (isCapturing || (isMobile && isPreCapturing)) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCapturing || (isMobile && isPreCapturing) ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <span className="shrink-0">{imageButtonIcon}</span>
                )}
                <span>{isCapturing ? "Processing..." : isPreCapturing ? "Preparing..." : imageButtonLabel}</span>
              </button>
              <button
                type="button"
                onClick={copyText}
                disabled={isCapturing}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold",
                  "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700 transition-colors",
                  isCapturing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Type className="h-4 w-4 shrink-0" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Tooltip content={copySuccess ? (copySuccess === "image" ? "Image copied!" : "Text copied!") : "Share"}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isCapturing}
          className={cn(
            showOnMobile ? "block p-1.5 rounded-lg transition-all duration-200" : "hidden lg:block p-1 lg:p-1.5 rounded-lg transition-all duration-200",
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

      {modal}
    </>
  );
}
