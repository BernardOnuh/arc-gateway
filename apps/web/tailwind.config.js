/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Periwinkle primary.
        brand: {
          50: "#f3f4fd",
          100: "#e6e9fb",
          200: "#d0d6f6",
          300: "#b2bbef",
          400: "#8d99e4",
          500: "#6b78d6",
          600: "#5461c4",
          700: "#4450a6",
          800: "#363f82",
          900: "#272d5c",
        },
        // Deep navy for text, primary buttons and the logo.
        ink: {
          950: "#12142b",
          900: "#1c1f3f",
          800: "#262a52",
          700: "#3a3f6b",
          600: "#555b88",
          400: "#8a8fb3",
          300: "#b4b8d4",
        },
        // Lavender page surfaces.
        mist: {
          50: "#f7f8fd",
          100: "#eef0fa",
          200: "#e3e6f6",
          300: "#d5d9f0",
        },
      },
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope Variable", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono Variable", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        sky: "linear-gradient(180deg, #3d5fae 0%, #5b7fc9 38%, #8eaae0 72%, #c3d3f1 100%)",
        "card-sheen": "linear-gradient(135deg, #c7cff6 0%, #dfe3fb 55%, #eef0fd 100%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,31,63,0.04), 0 12px 32px -16px rgba(28,31,63,0.18)",
        float: "0 40px 80px -30px rgba(28,31,63,0.45)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        drift: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        drift: "drift 140s linear infinite",
        "drift-slow": "drift 220s linear infinite",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
