/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Violet primary; most components use brand-500/600.
        brand: {
          50: "#f3f0ff",
          100: "#e8e2ff",
          200: "#d2c6ff",
          300: "#b3a0ff",
          400: "#9175ff",
          500: "#7552ff",
          600: "#623cf2",
          700: "#502fcc",
          800: "#3f26a1",
          900: "#2b1c6c",
        },
        // Cyan accent for gradients, live states and highlights.
        accent: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
        },
        // Deep navy surfaces (hero, sidebar, auth panels, code).
        ink: {
          950: "#050816",
          900: "#0a1024",
          800: "#111a36",
          700: "#1b264a",
          600: "#2a3766",
          400: "#7d8bb5",
          300: "#a9b4d6",
        },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk Variable", "Space Grotesk", "Inter Variable", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono Variable", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7552ff 0%, #4f7dff 50%, #22d3ee 100%)",
        "grid-faint":
          "linear-gradient(rgba(148,163,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,255,0.07) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "44px 44px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(117,82,255,0.35), 0 10px 40px -10px rgba(117,82,255,0.55)",
        card: "0 1px 2px rgba(10,16,36,0.04), 0 8px 24px -12px rgba(10,16,36,0.12)",
      },
      keyframes: {
        dash: { to: { strokeDashoffset: "-40" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        pulseRing: { "0%": { opacity: "0.6", transform: "scale(1)" }, "100%": { opacity: "0", transform: "scale(1.8)" } },
      },
      animation: {
        dash: "dash 1.6s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulseRing 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
