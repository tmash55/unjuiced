"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MobileNavContextType {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavContextType>({
  isMenuOpen: false,
  setIsMenuOpen: () => {},
});

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <MobileNavContext.Provider value={{ isMenuOpen, setIsMenuOpen }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}

