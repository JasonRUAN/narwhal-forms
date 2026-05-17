"use client";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { getDAppKit } from "@/lib/dapp-kit";

export function Providers({ children }: { children: ReactNode }) {
  const [dAppKit] = useState(() => getDAppKit());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        {children}
        <Toaster richColors position="top-center" />
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
