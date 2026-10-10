import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../components/ThemeToggle";
import { THEME_STORAGE, ThemeProvider, themeForHour } from "./theme";

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
});

describe("day/night theme", () => {
  it("is night from 19:00 to 06:00 local time", () => {
    expect(themeForHour(18)).toBe("light");
    expect(themeForHour(19)).toBe("dark");
    expect(themeForHour(2)).toBe("dark");
    expect(themeForHour(5)).toBe("dark");
    expect(themeForHour(6)).toBe("light");
    expect(themeForHour(12)).toBe("light");
  });

  it("follows the clock, and the toggle overrides it until set back", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 10, 21, 30)); // 21:30 local → night
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass("dark");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch to day mode" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE)).toBe("light");

    // Choosing what the clock would pick clears the override.
    await act(() => user.click(screen.getByRole("button", { name: "Switch to night mode" })));
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE)).toBeNull();
  });
});
