import { redirect } from "next/navigation";

// Ladder Builder is temporarily disabled while we improve the feature.
// Redirect users to the Edge Finder.
export default function LaddersPage() {
  redirect("/edge-finder");
}
