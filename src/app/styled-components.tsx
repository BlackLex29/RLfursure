// app/providers.tsx
"use client";
import { ReactNode } from "react";
import { ThemeProvider } from "styled-components";

const theme = {
  colors: {
    primary: "#34b89c",
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
