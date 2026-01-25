"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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

// Animated logo component with subtle pulse
function AnimatedLogo() {
  return (
    <motion.div 
      className="relative"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Glow effect behind logo */}
      <motion.div 
        className="absolute inset-0 rounded-xl bg-sky-400/20 blur-xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
      />
      
      {/* Logo */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Unjuiced"
          width={40}
          height={40}
          className="object-contain"
        />
      </div>
    </motion.div>
  );
}

// Premium progress bar
function ProgressBar() {
  return (
    <div className="w-48 h-1 bg-neutral-200/50 dark:bg-neutral-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-400 rounded-full"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ width: "50%" }}
      />
    </div>
  );
}

// Skeleton table preview
function TableSkeleton() {
  return (
    <motion.div 
      className="w-full max-w-lg mt-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {/* Header row skeleton */}
      <div className="flex gap-3 mb-3 px-2">
        {[80, 60, 50, 70, 55].map((width, i) => (
          <motion.div
            key={i}
            className="h-3 bg-neutral-200/60 dark:bg-neutral-800/60 rounded"
            style={{ width: `${width}px` }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>
      
      {/* Row skeletons */}
      {[0, 1, 2].map((row) => (
        <div 
          key={row} 
          className="flex gap-3 py-2.5 px-2 border-t border-neutral-100 dark:border-neutral-800/50"
        >
          {[80, 60, 50, 70, 55].map((width, i) => (
            <motion.div
              key={i}
              className="h-2.5 bg-neutral-100 dark:bg-neutral-800/40 rounded"
              style={{ width: `${width}px` }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: (row * 0.15) + (i * 0.08) }}
            />
          ))}
        </div>
      ))}
    </motion.div>
  );
}

export function LoadingState({ 
  message, 
  type = 'odds',
  showSkeleton = true,
  minimal = false
}: { 
  message?: string;
  type?: LoadingType;
  showSkeleton?: boolean;
  minimal?: boolean;
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
          <motion.div 
            className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-sky-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900/50 py-16 px-8">
      <div className="flex flex-col items-center gap-5 max-w-lg w-full">
        {/* Animated Logo */}
        <AnimatedLogo />

        {/* Progress Bar */}
        <ProgressBar />

        {/* Animated Message */}
        <div className="text-center h-5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              {message || messages[currentMessage]}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Table Skeleton Preview */}
        {showSkeleton && <TableSkeleton />}
      </div>
    </div>
  );
}

// Compact inline loader for use in smaller spaces
export function InlineLoader({ text = "Loading" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
      <motion.div 
        className="w-4 h-4 border-2 border-neutral-300 dark:border-neutral-600 border-t-sky-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
      <span>{text}</span>
    </div>
  );
}

// Page-level loading overlay
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <AnimatedLogo />
        <ProgressBar />
      </div>
    </div>
  );
}

