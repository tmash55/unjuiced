import React from "react";
import { Container } from "./container";
import { DivideX } from "./divide";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";
import { ButtonLink } from "./button-link";
import { Zap, Activity, ShieldCheck } from "lucide-react";

const trustPoints = [
  {
    icon: Zap,
    label: "Live refresh",
    description: "Sub-second updates and automated error recovery.",
  },
  {
    icon: Activity,
    label: "99.9% uptime",
    description: "Monitored infrastructure built for betting-desk reliability.",
  },
  {
    icon: ShieldCheck,
    label: "Read-only design",
    description: "We never access your accounts or betting balances.",
  },
];

export const Security = () => {
  return (
    <>
      <Container className="border-divide border-x">
        <h2 className="pt-10 pb-5 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase md:pt-20 md:pb-10 dark:text-neutral-400">
          Why Pros Trust Unjuiced
        </h2>
      </Container>
      <DivideX />
      <Container className="border-divide grid grid-cols-1 border-x bg-gray-100 px-8 py-12 md:grid-cols-2 gap-8 dark:bg-neutral-900">
        <div>
          <SectionHeading className="text-left">
            Win with trusted data. Every second counts.
          </SectionHeading>
          <SubHeading as="p" className="mt-4 text-left">
            Live lines from verified feeds, refreshed in real time with enterprise-grade reliability — no sponsored rankings, no conflicts of interest.
          </SubHeading>
          <ButtonLink
            className="mt-6 mb-8 inline-block w-full md:w-auto"
            href="/pricing"
          >
            Start for free
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-6">
          {trustPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand/10 to-brand/5">
                  <Icon className="h-6 w-6 text-brand" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {point.label}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {point.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </>
  );
};
