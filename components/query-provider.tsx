"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent unnecessary refetches during SSR/hydration
            staleTime: 60 * 1000, // 1 minute default
            refetchOnWindowFocus: false, // Only refetch on explicit user action
            refetchOnMount: false,
            retry: 1, // Only retry once on failure
          },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}


