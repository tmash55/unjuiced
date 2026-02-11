"use client";

import React, { useEffect, useState } from "react";

export function FlashCell({
  value,
  dir,
  children,
  ms = 800,
}: {
  value?: React.ReactNode;
  dir?: "up" | "down";
  children?: React.ReactNode;
  ms?: number;
}) {
  const [active, setActive] = useState(Boolean(dir));
  useEffect(() => {
    if (!dir) { setActive(false); return; }
    setActive(true);
    const t = setTimeout(() => setActive(false), ms);
    return () => clearTimeout(t);
  }, [dir, ms]);

  const bg = !active
    ? "transparent"
    : dir === "up"
      ? "rgba(16,185,129,0.25)"
      : "rgba(239,68,68,0.25)";

  return (
    <td style={{ background: bg, transition: "background 600ms ease-out" }}>
      {children ?? value}
    </td>
  );
}