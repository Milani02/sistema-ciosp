import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "biodinamica-theme";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): ThemeMode | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

/** Call once, synchronously, before the app renders (top of main.tsx) so the
 *  right theme is already on <html> for the very first paint — no flash. */
export function initTheme() {
  if (typeof document === "undefined") return;
  const theme = readStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme() ?? (systemPrefersDark() ? "dark" : "light"));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggle };
}
