"use client";
import { cn } from "@/lib/utils";
import { FeatureHeader } from "./FeatureHeader";
import { FeatureDisplay, type FeatureCard } from "./FeatureDisplay";

export function FeatureSection({
  header,
  cards,
  className,
}: {
  header: React.ComponentProps<typeof FeatureHeader>;
  cards: FeatureCard[];
  className?: string;
}) {
  return (
    <section className={cn("border-divide border-x px-4 py-12 md:py-20", className)}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 md:grid-cols-[0.9fr,1.1fr]">
        <FeatureHeader {...header} />
        <FeatureDisplay cards={cards} className="md:ml-auto" />
      </div>
    </section>
  );
}


