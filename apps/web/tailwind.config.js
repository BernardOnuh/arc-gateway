/** @type {import('tailwindcss').Config} */

// Palette colors are CSS variables (src/index.css) so `.dark` on <html> can
// swap the whole app at once. `snow` and `night` never change: snow is text
// on the sky, night is code blocks and other always-dark surfaces.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]));

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("white"),
        snow: "#ffffff",
        night: "#161a3a",
        brand: scale("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        ink: scale("ink", [950, 900, 800, 700, 600, 400, 300]),
        mist: scale("mist", [50, 100, 200, 300]),
      },
      fontFamily: {
        sans: ["Geist Variable", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Geist Variable", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono Variable", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "card-sheen": "var(--card-sheen)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18,20,43,0.05), 0 12px 32px -16px rgba(18,20,43,0.22)",
        float: "0 40px 80px -30px rgba(18,20,43,0.5)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        drift: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        twinkle: { "0%,100%": { opacity: "0.25" }, "50%": { opacity: "1" } },
        rise: { "0%": { opacity: "0", transform: "translateY(18px)" }, "100%": { opacity: "1", transform: "none" } },
        packet: {
          "0%": { transform: "translateX(-6px)", opacity: "0" },
          "25%, 75%": { opacity: "1" },
          "100%": { transform: "translateX(22px)", opacity: "0" },
        },
      },
      animation: {
        drift: "drift 70s linear infinite",
        "drift-slow": "drift 120s linear infinite",
        float: "float 7s ease-in-out infinite",
        twinkle: "twinkle 3.2s ease-in-out infinite",
        rise: "rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};
