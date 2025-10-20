import { Badge } from "@/components/badge";
import { Container } from "@/components/container";
import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { Heading } from "@/components/heading";
import { InformationBlock } from "@/components/information-block";
import { SectionHeading } from "@/components/seciton-heading";
import { SubHeading } from "@/components/subheading";

import { getSEOTags } from "@/lib/seo";
import Image from "next/image";

export const metadata = getSEOTags({
  title: "About Us - Unjuiced | Sports Betting Odds Comparison",
  description:
    "We're building the most transparent sports betting odds comparison platform. Founded by bettors for bettors, Unjuiced was born from a simple frustration: finding the best odds shouldn't require opening 20+ tabs. We built a platform that gives you real-time odds, arbitrage detection, and line shopping tools—all in one place.",
});

export default function AboutPage() {
  return (
    <main>
      <DivideX />
      <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-10 pb-10 md:px-8 md:pt-32 md:pb-20">
        <div className="grid grid-cols-1 gap-20 md:grid-cols-2">
          <div className="flex flex-col items-start justify-start">
            <Badge text="About Us" />
            <Heading className="mt-4 text-left">
              We're Building the Most{" "}
              <span 
                className="text-brand"
                style={{
                  textShadow: '0 0 40px rgba(14, 165, 233, 0.3), 0 0 20px rgba(14, 165, 233, 0.2)',
                }}
              >
                Transparent
              </span>{" "}
              Odds Comparison Platform
            </Heading>
            <SubHeading className="mt-6 mr-auto text-left">
              Founded by bettors for bettors, Unjuiced was born from a simple frustration: 
              finding the best odds shouldn't require opening 20+ tabs. We set out to change 
              that by creating a platform that gives you real-time odds, arbitrage detection, 
              and line shopping tools—all in one place.
              <br /> <br />
              Today, Unjuiced helps thousands of bettors—from casual players to sharp 
              professionals—find better odds, maximize ROI, and make smarter betting decisions. 
              No sponsored rankings. No conflicts of interest. Just real market data.
            </SubHeading>
          </div>
          <div className="border-divide rounded-3xl border p-2">
            <Image
              src="https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="About Us"
              width={1000}
              height={1000}
              className="h-full rounded-2xl object-cover"
            />
          </div>
        </div>
        <div className="mt-20 flex w-full flex-col items-center lg:flex-row">
          <h2 className="mb-4 min-w-40 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase lg:mb-0 lg:text-left dark:text-neutral-400">
            Trusted by bettors
          </h2>
          <div className="flex w-full items-center justify-center gap-8 lg:justify-start">
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">10K+</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Users</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">1M+</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Odds Compared</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">20+</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Sportsbooks</p>
            </div>
          </div>
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide border-x p-4 py-20 md:px-8 md:py-40">
        <div className="grid grid-cols-1 gap-10 md:gap-20 lg:grid-cols-2">
          <div className="flex flex-col items-start justify-start">
            <Badge text="Our Mission" />
            <SectionHeading className="mt-4 text-left">
              Empowering Bettors with Transparent Data
            </SectionHeading>
            <SubHeading className="mt-6 mr-auto text-left">
              We believe every bettor deserves access to the best odds without jumping through hoops. 
              Our platform removes the juice from sports betting by giving you real-time, unbiased odds 
              comparison across 20+ sportsbooks.
            </SubHeading>
            <div className="divide-divide mt-8 grid grid-cols-3 gap-6">
              <MetricBlock value="Sub-2s" label="Odds Updates" />
              <MetricBlock value="99.9%" label="Uptime" />
              <MetricBlock value="$500K+" label="Arbs Found" />
            </div>
          </div>
          <InformationBlock />
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x px-4 py-20 md:px-8">
        <Badge text="Our Values" />
        <SectionHeading className="mt-4">
          What Drives Us
        </SectionHeading>
        <SubHeading className="mx-auto mt-6 max-w-2xl text-center">
          Our core principles guide everything we build
        </SubHeading>
        <div className="mt-12 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <span className="text-brand text-xl">✓</span>
            </div>
            <h4 className="mt-4 font-semibold text-neutral-900 dark:text-white">Transparency First</h4>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              No sponsored rankings or hidden agendas. Just real market data.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <span className="text-brand text-xl">✓</span>
            </div>
            <h4 className="mt-4 font-semibold text-neutral-900 dark:text-white">Bettor-First</h4>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Built by bettors who understand the grind and what you need to win.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <span className="text-brand text-xl">✓</span>
            </div>
            <h4 className="mt-4 font-semibold text-neutral-900 dark:text-white">Data Integrity</h4>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Real-time, accurate odds you can trust with 99.9% uptime.
            </p>
          </div>
        </div>
      </Container>
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

const MetricBlock = ({ value, label }: { value: string; label: string }) => {
  return (
    <div className="flex flex-col items-start justify-start">
      <h3 className="text-brand text-3xl font-bold">
        {value}
      </h3>
      <p className="text-sm text-gray-600 dark:text-neutral-400">{label}</p>
    </div>
  );
};
