import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { createQueryClient, queryKeys } from "../shared/api/queryKeys";
import { theme } from "./theme";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => {
    const clear = () => { void (async () => {
      // Keep the observed auth query alive so its guard can render the redirect.
      // Removing it while /me is resolving leaves its observer pending.
      const operational = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== queryKeys.auth.all[0] };
      await queryClient.cancelQueries(operational);
      queryClient.removeQueries(operational);
      queryClient.setQueryData(queryKeys.auth.all, null);
    })(); };
    window.addEventListener("foodflow:unauthorized", clear);
    return () => window.removeEventListener("foodflow:unauthorized", clear);
  }, [queryClient]);
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MantineProvider>
  );
}
