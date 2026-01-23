"use client";

import React from "react";
import { motion } from "motion/react";
import { Container } from "@/components/container";
import { ButtonLink } from "@/components/button-link";
import { DivideX } from "@/components/divide";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface ToolFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export interface ToolBenefit {
  text: string;
}

export interface ToolPreviewLayoutProps {
  /**
   * Tool name displayed in the hero
   */
  title: string;
  
  /**
   * Short tagline for the tool
   */
  tagline: string;
  
  /**
   * Longer description of the tool
   */
  description: string;
  
  /**
   * Path to screenshot image (relative to public folder)
   */
  screenshot?: string;
  
  /**
   * Alternative: Custom component to render instead of screenshot
   */
  screenshotComponent?: React.ReactNode;
  
  /**
   * List of key features
   */
  features: ToolFeature[];
  
  /**
   * Short benefit statements shown in hero
   */
  benefits?: ToolBenefit[];
  
  /**
   * Primary CTA button text
   */
  ctaText?: string;
  
  /**
   * Primary CTA button href (defaults to /register with redirect)
   */
  ctaHref?: string;
  
  /**
   * Secondary CTA button text
   */
  secondaryCtaText?: string;
  
  /**
   * Secondary CTA button href
   */
  secondaryCtaHref?: string;
  
  /**
   * Brand color for accents (hex)
   */
  accentColor?: string;
  
  /**
   * Badge text (e.g., "NEW", "BETA")
   */
  badge?: string;
  
  /**
   * Sport/category tag
   */
  category?: string;
  
  /**
   * URL path to the actual tool (used for auth redirect)
   */
  toolPath: string;
}

export function ToolPreviewLayout({
  title,
  tagline,
  description,
  screenshot,
  screenshotComponent,
  features,
  benefits = [],
  ctaText = "Get Started Free",
  ctaHref,
  secondaryCtaText = "View Pricing",
  secondaryCtaHref = "/pricing",
  accentColor = "#0ea5e9",
  badge,
  category,
  toolPath,
}: ToolPreviewLayoutProps) {
  const finalCtaHref = ctaHref || `/register?redirect=${encodeURIComponent(toolPath)}`;
  
  return (
    <>
      {/* Hero Section */}
      <Container className="border-divide border-x">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-white px-4 pb-12 pt-12 md:pb-20 md:pt-20 dark:bg-black">
          {/* Background gradient */}
          <div 
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              background: `radial-gradient(circle at 50% 0%, ${accentColor}, transparent 70%)`,
            }}
          />
          
          <div className="relative z-10 mx-auto w-full max-w-4xl">
            {/* Category & Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-2"
            >
              {category && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {category}
                </span>
              )}
              {badge && (
                <span 
                  className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {badge}
                </span>
              )}
            </motion.div>
            
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-6 text-center text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl dark:text-neutral-100"
            >
              {title}
            </motion.h1>
            
            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-4 text-center text-xl font-medium md:text-2xl"
              style={{ color: accentColor }}
            >
              {tagline}
            </motion.p>
            
            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="mx-auto mt-6 max-w-2xl text-center text-base text-neutral-600 sm:text-lg dark:text-neutral-400"
            >
              {description}
            </motion.p>
            
            {/* Benefits badges */}
            {benefits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-500 dark:text-neutral-400"
              >
                {benefits.map((benefit, index) => (
                  <React.Fragment key={benefit.text}>
                    <div className="flex items-center gap-2">
                      <Check className="size-4" style={{ color: accentColor }} />
                      <span>{benefit.text}</span>
                    </div>
                    {index < benefits.length - 1 && (
                      <div className="hidden h-4 w-px bg-neutral-300 sm:block dark:bg-neutral-600" />
                    )}
                  </React.Fragment>
                ))}
              </motion.div>
            )}
            
            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="mt-10 flex w-full flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:px-0"
            >
              <ButtonLink 
                href={finalCtaHref} 
                variant="primary"
                className="w-full justify-center text-center rounded-lg px-8 py-3 text-base font-medium text-white hover:ring-4 sm:w-auto"
                style={{ 
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                }}
              >
                {ctaText}
                <ArrowRight className="ml-2 size-4" />
              </ButtonLink>
              <ButtonLink 
                href={secondaryCtaHref} 
                variant="secondary"
                className="w-full justify-center text-center rounded-lg border-transparent bg-transparent px-6 py-3 text-base font-medium hover:bg-neutral-100 sm:w-auto dark:hover:bg-neutral-800"
              >
                {secondaryCtaText}
              </ButtonLink>
            </motion.div>
          </div>
        </div>
      </Container>
      
      <DivideX />
      
      {/* Screenshot Section */}
      {(screenshot || screenshotComponent) && (
        <>
          <Container className="border-divide border-x">
            <div className="relative bg-neutral-50 px-4 py-12 md:px-8 md:py-16 dark:bg-neutral-900/50">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mx-auto max-w-6xl"
              >
                {screenshotComponent ? (
                  screenshotComponent
                ) : screenshot ? (
                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
                    <Image
                      src={screenshot}
                      alt={`${title} screenshot`}
                      width={1920}
                      height={1080}
                      className="w-full"
                      priority
                    />
                  </div>
                ) : null}
              </motion.div>
            </div>
          </Container>
          <DivideX />
        </>
      )}
      
      {/* Features Section */}
      <Container className="border-divide border-x">
        <div className="bg-white px-4 py-16 md:px-8 md:py-24 dark:bg-black">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-100">
                Powerful Features
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
                Everything you need to find and capitalize on betting value.
              </p>
            </motion.div>
            
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="group relative rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition-all hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700"
                >
                  {feature.icon && (
                    <div 
                      className="mb-4 inline-flex size-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${accentColor}20` }}
                    >
                      {feature.icon}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Container>
      
      <DivideX />
      
      {/* Bottom CTA Section */}
      <Container className="border-divide border-x">
        <div className="relative flex min-h-60 flex-col items-center justify-center overflow-hidden bg-white px-4 py-16 md:min-h-80 dark:bg-black">
          {/* Background gradient */}
          <div 
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              background: `radial-gradient(circle at 50% 100%, ${accentColor}, transparent 70%)`,
            }}
          />
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="relative z-10 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl dark:text-neutral-100">
              Ready to find your edge?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
              Join thousands of smart bettors using {title} to maximize their profits.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <ButtonLink 
                href={finalCtaHref} 
                variant="primary"
                className="w-full justify-center text-center rounded-lg px-8 py-3 text-base font-medium text-white hover:ring-4 sm:w-auto"
                style={{ 
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                }}
              >
                {ctaText}
                <ArrowRight className="ml-2 size-4" />
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-500">
              Free 3-day trial • No credit card required
            </p>
          </motion.div>
        </div>
      </Container>
    </>
  );
}
