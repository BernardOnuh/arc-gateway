import { IconMoon, IconSun } from "./art";
import { useTheme } from "../lib/theme";

/** Sun/moon switch. Shows what you'd switch to; follows the clock until used. */
export function ThemeToggle({ onSky = false }: { onSky?: boolean }) {
  const { theme, auto, toggle } = useTheme();
  const next = theme === "dark" ? "day" : "night";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={auto ? `Following your clock · switch to ${next} mode` : `Switch to ${next} mode`}
      className={`grid h-9 w-9 place-items-center rounded-full transition ${
        onSky
          ? "bg-snow/15 text-snow ring-1 ring-snow/30 backdrop-blur hover:bg-snow/25"
          : "bg-white/70 text-ink-900 hover:bg-white"
      }`}
    >
      {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}
