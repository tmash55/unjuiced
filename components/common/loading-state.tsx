"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const oddsMessages = [
  "Scanning sportsbooks...",
  "Finding sharp lines...",
  "Calculating fair odds...",
  "Analyzing markets...",
  "Syncing real-time data...",
];

const accountMessages = [
  "Loading your preferences...",
  "Syncing filters...",
  "Preparing your dashboard...",
];

type LoadingType = 'odds' | 'account';

// Premium animated logo with elegant pulse
function PremiumLogo({ size = 48 }: { size?: number }) {
  return (
    <motion.div 
      className="relative"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Outer glow ring */}
      <motion.div 
        className="absolute -inset-4 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)",
        }}
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.5, 0.8, 0.5] 
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
      />
      
      {/* Inner glow */}
      <motion.div 
        className="absolute -inset-2 rounded-full bg-sky-400/10 blur-md"
        animate={{ 
          opacity: [0.3, 0.6, 0.3] 
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
      />
      
      {/* Logo container with subtle scale pulse */}
      <motion.div 
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
        animate={{ 
          scale: [1, 1.02, 1],
        }}
        transition={{ 
          duration: 2.5, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
      >
        <Image
          src="/logo.png"
          alt="Unjuiced"
          width={size}
          height={size}
          className="object-contain drop-shadow-lg"
          priority
        />
      </motion.div>
    </motion.div>
  );
}

// Elegant loading dots
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-sky-400/70"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function LoadingState({ 
  message, 
  type = 'odds',
  showSkeleton = false, // Default to false now
  minimal = false,
  compact = false,
}: { 
  message?: string;
  type?: LoadingType;
  showSkeleton?: boolean;
  minimal?: boolean;
  compact?: boolean;
}) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const messages = type === 'account' ? accountMessages : oddsMessages;

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, [messages.length]);

  if (minimal) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <LoadingDots />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</span>
        </div>
      </div>
    );
  }

  const logoSize = compact ? 44 : 56;
  const containerClass = compact ? "min-h-[200px]" : "min-h-[400px]";

  return (
    <div className={cn("flex items-center justify-center", containerClass)}>
      <motion.div 
        className={cn("flex flex-col items-center", compact ? "gap-6" : "gap-8")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Premium Logo */}
        <PremiumLogo size={logoSize} />

        {/* Loading indicator + message */}
        <div className="flex flex-col items-center gap-3">
          <LoadingDots />
          
          {/* Animated Message */}
          <div className="text-center h-5 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentMessage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-neutral-400 dark:text-neutral-500"
              >
                {message || messages[currentMessage]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Compact inline loader for use in smaller spaces
export function InlineLoader({ text = "Loading" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-neutral-500 dark:text-neutral-400">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-1 rounded-full bg-sky-400/70"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.12,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span>{text}</span>
    </div>
  );
}

// Page-level loading overlay
export function PageLoader() {
  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <PremiumLogo size={64} />
        <LoadingDots />
      </motion.div>
    </motion.div>
  );
}

// Export the components for use elsewhere
export { PremiumLogo, LoadingDots };
