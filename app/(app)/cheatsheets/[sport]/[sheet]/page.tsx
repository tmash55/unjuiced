"use client";

import { use } from "react";
import { AppPageLayout } from "@/components/layout/app-page-layout";

export default function CheatSheetPage({ params }: { params: Promise<{ sport: string; sheet: string }> }) {
  const { sport, sheet } = use(params);
  
  return (
    <AppPageLayout
      title={`${sport.toUpperCase()} ${sheet.replace('-', ' ')}`}
      subtitle="Cheat sheets feature coming soon"
    >
      <div className="text-center py-12 text-neutral-500">
        This feature is under development
      </div>
    </AppPageLayout>
  );
}
