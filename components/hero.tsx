"use client";
import React from "react";
import { Container } from "./container";
import { Heading } from "./heading";
import { ShimmerText } from "./shimmer-text";
import { SubHeading } from "./subheading";
import { GartnerLogo, GartnerLogoText, Star } from "@/icons/general";
import { motion } from "motion/react";
import { Button } from "@/components/button";
import { Badge } from "./badge";
import Link from "next/link";
import { ButtonLink } from "./button-link";

export const Hero = () => {
  return (
    <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-6 pb-10 md:pt-20 md:pb-20">
      <Badge text="Built for value bettors." />
      <Heading className="mt-4">
        Find the <span className="text-brand">edge.</span> Lose the vig.{" "}
        
      </Heading>

      <SubHeading className="mx-auto mt-6 max-w-lg text-center">
      Unjuiced is a modern sports-betting platform for finding value.
Real-time arbitrage, full odds coverage, and one-click to bet slip.
      </SubHeading>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <ButtonLink variant="primary" href="/register" className="w-full sm:w-auto">
          Start for Free
        </ButtonLink>
        <ButtonLink variant="secondary" href="/pricing" className="w-full sm:w-auto">
          Get a Demo
        </ButtonLink>
      </div>
      
    </Container>
  );
};
