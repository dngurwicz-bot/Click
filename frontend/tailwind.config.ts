import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Rubik", "Heebo", "Inter", "sans-serif"],
      },
      colors: {
        // Primary accent — teal from the logo dot (#00A896)
        brand: {
          50:  "#e6f7f5",
          100: "#b3e8e3",
          200: "#80d9d1",
          300: "#4dcabf",
          400: "#26bbad",
          500: "#00A896",
          600: "#008a7b",
          700: "#006b60",
          800: "#004d44",
          900: "#002e29",
        },
        // Dark navy — logo main text (#2C3E50)
        navy: {
          50:  "#eaecef",
          100: "#c5ccd3",
          200: "#9aaab5",
          300: "#6f8897",
          400: "#4d6478",
          500: "#2C3E50",
          600: "#243240",
          700: "#1c2831",
          800: "#141e24",
          900: "#0c1217",
        },
        // Muted grays — logo divider/subtitle (#BDC3C7, #7F8C8D)
        muted: {
          300: "#BDC3C7",
          500: "#7F8C8D",
          700: "#5D6D7E",
        },
      },
    },
  },
  plugins: [],
};

export default config;
