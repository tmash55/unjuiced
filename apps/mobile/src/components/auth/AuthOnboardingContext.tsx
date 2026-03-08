import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type OnboardingPlan = "standard" | "sharp";

type AuthOnboardingContextValue = {
  selectedSports: string[];
  selectedBooks: string[];
  selectedPlan: OnboardingPlan;
  toggleSport: (sport: string) => void;
  toggleBook: (book: string) => void;
  setPlan: (plan: OnboardingPlan) => void;
  reset: () => void;
};

const AuthOnboardingContext = createContext<AuthOnboardingContextValue | null>(null);

export function AuthOnboardingProvider({ children }: { children: ReactNode }) {
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "mlb"]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>(["draftkings", "fanduel", "betmgm"]);
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlan>("sharp");

  const value = useMemo<AuthOnboardingContextValue>(
    () => ({
      selectedSports,
      selectedBooks,
      selectedPlan,
      toggleSport: (sport) => {
        setSelectedSports((current) =>
          current.includes(sport)
            ? current.filter((item) => item !== sport)
            : [...current, sport]
        );
      },
      toggleBook: (book) => {
        setSelectedBooks((current) =>
          current.includes(book)
            ? current.filter((item) => item !== book)
            : [...current, book]
        );
      },
      setPlan: setSelectedPlan,
      reset: () => {
        setSelectedSports(["nba", "mlb"]);
        setSelectedBooks(["draftkings", "fanduel", "betmgm"]);
        setSelectedPlan("sharp");
      },
    }),
    [selectedBooks, selectedPlan, selectedSports]
  );

  return (
    <AuthOnboardingContext.Provider value={value}>
      {children}
    </AuthOnboardingContext.Provider>
  );
}

export function useAuthOnboarding() {
  const context = useContext(AuthOnboardingContext);
  if (!context) {
    throw new Error("useAuthOnboarding must be used within AuthOnboardingProvider");
  }
  return context;
}
