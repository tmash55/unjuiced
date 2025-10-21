"use client";
import Image from "next/image";
import React from "react";
import { motion } from "motion/react";
import { Container } from "./container";

export function LogoCloud2() {
  const logos = [
    {
      title: "Open AI",
      src: "https://assets.aceternity.com/logos/openai.png",
    },
    {
      title: "Hello Patient",
      src: "https://assets.aceternity.com/logos/hello-patient.png",
    },
    {
      title: "Granola",
      src: "https://assets.aceternity.com/logos/granola.png",
    },
    {
      title: "Character AI",
      src: "https://assets.aceternity.com/logos/characterai.png",
    },
    {
      title: "Oracle",
      src: "https://assets.aceternity.com/logos/oracle.png",
    },
    {
      title: "Portola",
      src: "https://assets.aceternity.com/logos/portola.png",
    },
  ];
  return (
    <Container className="border-divide border-x">
      <h2 className="mx-auto max-w-xl text-center text-lg font-medium text-neutral-600 dark:text-neutral-400 py-8">
        Trusted by modern operators across industries.{" "}
        <br className="hidden sm:block" />{" "}
        <span className="text-neutral-400 dark:text-neutral-600">
          {" "}
          From pilot to scale without chaos.
        </span>
      </h2>
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 md:grid-cols-3">
        {logos.map((logo, index) => (
          <motion.div
            key={logo.title}
            initial={{
              y: -10,
              opacity: 0,
              filter: "blur(10px)",
            }}
            whileInView={{
              y: 0,
              opacity: 1,
              filter: "blur(0px)",
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
              delay: index * 0.1,
            }}
            className="flex items-center justify-center"
          >
            <img
              key={logo.title}
              src={logo.src}
              width={100}
              height={100}
              alt={logo.title}
              className="size-20 object-contain dark:invert dark:filter"
            />
          </motion.div>
        ))}
      </div>
    </Container>
  );
}
