import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Grape violet, matching the app icon (icon gradient runs brand-600 → accent-500).
        brand: {
          50: "#f7f3ff",
          100: "#efe7ff",
          200: "#e0d1ff",
          300: "#c9adfd",
          400: "#ae84f8",
          500: "#9459ef",
          600: "#7a35e0",
          700: "#6528bf",
          800: "#521f99",
          900: "#3f1a74",
          950: "#26104a",
        },
        accent: {
          100: "#fde4ee",
          300: "#f7a3c3",
          500: "#ec4f8b",
          700: "#b42a63",
        },
        // The app's neutrals: a plum-tinted grey replacing Tailwind's zinc, so every
        // `zinc-*` class (text, borders, cards, dark mode) follows the theme.
        zinc: {
          50: "#faf8fc",
          100: "#f3f0f7",
          200: "#e7e2ef",
          300: "#d2cadf",
          400: "#a59cb6",
          500: "#736a85",
          600: "#585168",
          700: "#423c50",
          800: "#2c2739",
          900: "#1c1827",
          950: "#110e19",
        },
      },
    },
  },
  plugins: [],
};

export default config;
