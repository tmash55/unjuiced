"use client";
import React from "react";
import { TabbedFeatureSection } from "../tabbed-feature-section";
import { ArbOpportunitiesSkeleton, OneClickDualBetSkeleton, SmartFiltersSkeleton } from "./skeletons2";
import { SVGProps } from "react";

export const HowItWorks = () => {
  const tabs = [
    {
      title: "Opportunities",
      description: "Live and pregame arbitrage refreshed every second—see EV, hold, and books at a glance.",
      icon: FirstIcon,
      id: "opportunities",
      skeleton: <ArbOpportunitiesSkeleton />,
      learnMoreHref: "/arbitrage",
    },
    {
      title: "Smart Filters",
      description: "Dial in by league, market type, min EV/hold, and limits—stay focused on the edges that fit your profile.",
      icon: SecondIcon,
      id: "filters",
      skeleton: <SmartFiltersSkeleton />,
      learnMoreHref: "/arbitrage",
    },
    {
      title: "One-Click Dual Bet",
      description: "Open both legs in separate windows pre-filled to the right market for quick confirmation—no tab juggling.",
      icon: ThirdIcon,
      id: "dual-bet",
      skeleton: <OneClickDualBetSkeleton />,
      learnMoreHref: "/arbitrage",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Arbitrage"
      heading="Arbitrage, simplified."
      subheading="Live and pregame risk-free pairs refreshed every few seconds—with one-click to your bet slip."
      ctaText="Explore Arbitrage"
      ctaHref="/arbitrage"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={8000}
    />
  );
};

const FirstIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="17"
      viewBox="0 0 16 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.02287 8.95395C7.99883 8.89366 7.993 8.82765 8.00609 8.76407C8.01918 8.7005 8.05061 8.64216 8.09651 8.59626C8.1424 8.55037 8.20075 8.51893 8.26432 8.50584C8.32789 8.49276 8.39391 8.49859 8.45420 8.52262L14.4542 10.856C14.5185 10.8811 14.5735 10.9256 14.6114 10.9833C14.6493 11.041 14.6684 11.1091 14.666 11.1781C14.6636 11.2471 14.6398 11.3137 14.5979 11.3686C14.556 11.4235 14.4981 11.464 14.4322 11.4846L12.1362 12.1966C12.0326 12.2286 11.9384 12.2855 11.8617 12.3621C11.785 12.4388 11.7282 12.533 11.6962 12.6366L10.9849 14.932C10.9643 14.9979 10.9237 15.0558 10.8688 15.0977C10.8139 15.1396 10.7474 15.1634 10.6783 15.1658C10.6093 15.1682 10.5412 15.1491 10.4835 15.1112C10.4258 15.0732 10.3813 15.0183 10.3562 14.954L8.02287 8.95395Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 7.83333V3.83333C14 3.47971 13.8595 3.14057 13.6095 2.89052C13.3594 2.64048 13.0203 2.5 12.6667 2.5H3.33333C2.97971 2.5 2.64057 2.64048 2.39052 2.89052C2.14048 3.14057 2 3.47971 2 3.83333V13.1667C2 13.5203 2.14048 13.8594 2.39052 14.1095C2.64057 14.3595 2.97971 14.5 3.33333 14.5H7.33333"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SecondIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="17"
      viewBox="0 0 16 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 12.5V3.83337"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 9.16667C9.42320 8.99806 8.91656 8.64708 8.556 8.16633C8.19544 7.68558 8.00036 7.10058 8 6.49833V3.83333C7.99988 3.22996 8.19509 2.64371 8.55598 2.16233C8.91687 1.68095 9.42394 1.32968 10.0007 1.16C10.0002 1.61048 10.1231 2.05182 10.3568 2.43611C10.5906 2.8204 10.9261 3.13285 11.3253 3.33933L13.1667 4.22467C13.3953 4.33467 13.5933 4.49667 13.7447 4.69733C13.896 4.89933 14 5.13467 14 5.376V5.624C14 5.86533 13.896 6.10067 13.7447 6.30267C13.5933 6.50333 13.3947 6.66533 13.166 6.77533L8.00067 9.16667"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.00067 7.83337C5.42387 7.66476 4.91723 7.31378 4.55667 6.83303C4.19611 6.35228 4.00103 5.76728 4.00067 5.16503V2.50003C3.99988 1.89599 4.19509 1.30908 4.55598 0.827031C4.91687 0.344987 5.42394 -0.00695038 6.00067 -0.177017C5.99954 0.273797 6.12243 0.715804 6.35619 1.10076C6.58996 1.48571 6.92544 1.79881 7.32467 2.00603L9.16667 2.89137C9.39533 3.00137 9.59333 3.16337 9.74467 3.36403C9.896 3.56603 10 3.80137 10 4.04337V4.29137C10 4.5327 9.896 4.76803 9.74467 4.97003C9.59333 5.1707 9.39467 5.3327 9.166 5.4427L6 7.83337"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const ThirdIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="16"
      height="17"
      viewBox="0 0 16 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.66663 5.16671V2.50004C8.66663 2.32323 8.59639 2.15366 8.47137 2.02864C8.34635 1.90361 8.17677 1.83337 7.99996 1.83337H2.66663C2.48982 1.83337 2.32025 1.90361 2.19522 2.02864C2.0702 2.15366 1.99996 2.32323 1.99996 2.50004V10.5C1.99996 10.6769 2.0702 10.8464 2.19522 10.9714C2.32025 11.0965 2.48982 11.1667 2.66663 11.1667H3.99996"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.33337 14.5H13.3334C13.5102 14.5 13.6798 14.4298 13.8048 14.3047C13.9298 14.1797 14 14.0101 14 13.8333V6.5C14 6.32319 13.9298 6.15362 13.8048 6.0286C13.6798 5.90357 13.5102 5.83333 13.3334 5.83333H7.33337C7.15656 5.83333 6.98699 5.90357 6.86197 6.0286C6.73695 6.15362 6.66671 6.32319 6.66671 6.5V13.8333C6.66671 14.0101 6.73695 14.1797 6.86197 14.3047C6.98699 14.4298 7.15656 14.5 7.33337 14.5Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
