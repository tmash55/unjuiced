import { OddsLayoutClient } from "./odds-layout-client";

export default function OddsLayout({ children }: { children: React.ReactNode }) {
  return <OddsLayoutClient>{children}</OddsLayoutClient>;
}
