"use client";
import React, { useState } from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";
import { Scale } from "./scale";
import { motion } from "motion/react";
import { 
  Target, 
  Wallet, 
  Scale as ScaleIcon, 
  Search, 
  BarChart3, 
  Zap 
} from "lucide-react";

export const UseCases = () => {
  const useCases = [
    {
      title: "Sharp Bettors",
      description:
        "Find +EV opportunities across 20+ books in seconds with real-time odds comparison and no-vig consensus pricing",
      icon: <Target className="text-brand size-6" />,
    },
    {
      title: "Casual Bettors",
      description:
        "Never leave money on the table. Get the best available odds on every bet with instant price comparisons",
      icon: <Wallet className="text-brand size-6" />,
    },
    {
      title: "Arbitrage Traders",
      description:
        "Lock in guaranteed profits with automated arb detection and precise bet sizing calculations",
      icon: <ScaleIcon className="text-brand size-6" />,
    },
    {
      title: "Line Shoppers",
      description:
        "Compare every line, every book, every game in one place. Save 5-10 cents per bet to maximize long-term ROI",
      icon: <Search className="text-brand size-6" />,
    },
    {
      title: "Prop Specialists",
      description:
        "Track player props and alternate lines across all markets with comprehensive coverage and live updates",
      icon: <BarChart3 className="text-brand size-6" />,
    },
    {
      title: "Live Bettors",
      description:
        "React instantly to in-game opportunities with sub-second odds updates and automated error recovery",
      icon: <Zap className="text-brand size-6" />,
    },
  ];
  const [activeUseCase, setActiveUseCase] = useState<number | null>(null);
  return (
    <Container className="border-divide relative overflow-hidden border-x px-4 md:px-8">
      <div className="relative flex flex-col items-center py-20">
        <Badge text="Who Uses Unjuiced" />
        <SectionHeading className="mt-4">
          Built for Every Type of Bettor
        </SectionHeading>

        <SubHeading as="p" className="mx-auto mt-6 max-w-lg text-center">
          From casual players to professional arbitrage traders, Unjuiced delivers the edge you need to win more and bet smarter
        </SubHeading>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase, index) => (
            <div
              onMouseEnter={() => setActiveUseCase(index)}
              key={useCase.title}
              className="relative"
            >
              {activeUseCase === index && (
                <motion.div
                  layoutId="scale"
                  className="absolute inset-0 z-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                >
                  <Scale />
                </motion.div>
              )}
              <div className="relative z-10 rounded-lg bg-gray-50 p-4 transition duration-200 hover:bg-transparent md:p-5 dark:bg-neutral-800">
                <div className="flex items-center gap-2">{useCase.icon}</div>
                <h3 className="mt-4 mb-2 text-lg font-medium text-neutral-900 dark:text-white">
                  {useCase.title}
                </h3>
                <p className="text-gray-600 dark:text-neutral-300">{useCase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};
