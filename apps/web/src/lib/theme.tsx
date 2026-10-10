import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { readStored, writeStored } from "./storage";

/**
 * Day/night theme. By default it follows the visitor's local clock: night
 * (dark mode, starry sky) from 19:00 to 06:00. The toggle stores an explicit
 * choice; choosing the mode the clock would pick anyway clears it, so the
 * theme goes back to following the time. index.html applies the same rule
 * before first paint.
 */
export const THEME_STORAGE = "arc-gateway.theme";

export type Theme = "light" | "dark";

export function themeForHour(hour: number): Theme {
  return hour >= 19 || hour < 6 ? "dark" : "light";
}

function storedChoice(): Theme | null {
  const v = readStored(THEME_STORAGE);
  return v === "light" || v === "dark" ? v : null;
}

interface ThemeState {
  theme: Theme;
  /** True while the theme follows the clock (no explicit choice). */
  auto: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "light", auto: true, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Theme | null>(storedChoice);
  const [clockTheme, setClockTheme] = useState<Theme>(() => themeForHour(new Date().getHours()));

  // Re-check the clock every minute so an open tab turns to night at 19:00.
  useEffect(() => {
    const id = setInterval(() => setClockTheme(themeForHour(new Date().getHours())), 60_000);
    return () => clearInterval(id);
  }, []);

  const theme = choice ?? clockTheme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const value = next === clockTheme ? null : next;
    writeStored(THEME_STORAGE, value);
    setChoice(value);
  }, [theme, clockTheme]);

  return <ThemeContext.Provider value={{ theme, auto: choice === null, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
