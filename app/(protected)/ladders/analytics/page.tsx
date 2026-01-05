import { redirect } from "next/navigation";

// Ladder Builder analytics is temporarily disabled while we improve the feature.
export default function LadderAnalyticsPage() {
  redirect("/edge-finder");
}
