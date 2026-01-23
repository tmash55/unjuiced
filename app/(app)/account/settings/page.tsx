import { Metadata } from "next";
import SettingsClient from "./settings-client";


export const metadata: Metadata = {
  title: "Settings | Unjuiced",
  description: "Manage your account settings and preferences",
};

export default function SettingsPage() {
  return <SettingsClient />;
}

