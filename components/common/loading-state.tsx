"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const oddsMessages = [
  "Removing the juice...",
  "Finding sharp lines...",
  "Tracking line movement...",
  "Scanning sportsbooks...",
  "Calculating no-vig odds...",
  "Loading live markets...",
  "Analyzing closing lines...",
  "Syncing real-time data...",
];

const accountMessages = [
  "Loading your account...",
  "Syncing preferences...",
  "Fetching account settings...",
  "Loading saved filters...",
  "Retrieving display settings...",
  "Loading sportsbook preferences...",
  "Syncing your data...",
];

type LoadingType = 'odds' | 'account';

export function LoadingState({ 
  message, 
  type = 'odds' 
}: { 
  message?: string;
  type?: LoadingType;
}) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const messages = type === 'account' ? accountMessages : oddsMessages;

  useEffect(() => {
    // Rotate messages every 2 seconds
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => {
      clearInterval(messageInterval);
    };
  }, [messages.length]);

  return (
    <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white py-24 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col items-center gap-6 max-w-md">
        {/* Simple Spinning Loader */}
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-brand dark:border-neutral-700 dark:border-t-brand" />
        </div>

        {/* Animated Message */}
        <div className="text-center">
          <div className="h-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-medium text-neutral-600 dark:text-neutral-400"
              >
                {message || messages[currentMessage]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

