import { Button, MantineProvider, PasswordInput, Select, TextInput, createTheme } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

import { createQueryClient, queryKeys } from "../shared/api/queryKeys";

const theme = createTheme({
  primaryColor: "forest",
  colors: { forest: ["#edf7f0", "#d7eade", "#b1d5bf", "#87bfa0", "#64ab85", "#4b9e74", "#3d936b", "#2f805a", "#236e4b", "#145f3e"] },
  defaultRadius: "md",
  fontFamily: '"Noto Sans TC", system-ui, sans-serif',
  components: {
    Button: Button.extend({ defaultProps: { mih: 44 } }),
    TextInput: TextInput.extend({ styles: { input: { minHeight: 44 } } }),
    PasswordInput: PasswordInput.extend({ styles: { input: { minHeight: 44 } } }),
    Select: Select.extend({ styles: { input: { minHeight: 44 } } }),
  },
});

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
