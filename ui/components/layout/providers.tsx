"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

import { createQueryClient } from "@/lib/query-client";
import { buildAppTheme, type AppThemeMode } from "@/lib/theme";

type ThemeModeContextValue = {
  mode: AppThemeMode;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within Providers");
  }
  return context;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [mode, setMode] = useState<AppThemeMode>("dark");

  useEffect(() => {
    const storedMode = window.localStorage.getItem("theme-mode");
    if (storedMode === "light" || storedMode === "dark") {
      setMode(storedMode);
    }
  }, []);

  const theme = useMemo(() => buildAppTheme(mode), [mode]);
  const value = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((currentMode) => {
          const nextMode = currentMode === "dark" ? "light" : "dark";
          window.localStorage.setItem("theme-mode", nextMode);
          return nextMode;
        }),
    }),
    [mode],
  );

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <SessionProvider>
        <ThemeModeContext.Provider value={value}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </ThemeProvider>
        </ThemeModeContext.Provider>
      </SessionProvider>
    </AppRouterCacheProvider>
  );
}
