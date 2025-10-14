"use client";
import React, { useState } from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";
import { Scale } from "./scale";
import { motion } from "motion/react";
  
  export default function SportsbookGridSection() {
  const sportsbooks = [
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "betrivers",
  ];

  return (
    <section className="w-full border-t border-gray-300 dark:border-neutral-800 py-12 bg-[#0A1F44] text-white">
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-semibold mb-8">
          Trusted by Top Sportsbooks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {sportsbooks.map((book) => (
            <div key={book} className="flex items-center justify-center">
              <img
                src={`/images/sports-books/${book}.png`}
                alt={book}
                className="h-12 object-contain grayscale hover:grayscale-0 transition"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
