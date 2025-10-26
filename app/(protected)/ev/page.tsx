import { Metadata } from "next";
import EVContent from "./ev-content";

export const metadata: Metadata = {
  title: "Positive EV",
  description: "Find positive expected value betting opportunities across all sportsbooks.",
};

export default function EVPage() {
  return <EVContent />;
}


