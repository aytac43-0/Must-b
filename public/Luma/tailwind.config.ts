import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        background: "#02040a",
        foreground: "#ededed",
        navy: {
          800: "#0a1128",
          900: "#02040a",
          950: "#010205",
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        sidebar: "#050505",
        "sidebar-border": "#1a1a1a",
        primary: "#3b82f6",
      },
      animation: {
        "glow-pulse": "glow-pulse 4s infinite ease-in-out",
        "float": "float 6s infinite ease-in-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.8", filter: "brightness(1) blur(20px)" },
          "50%": { opacity: "1", filter: "brightness(1.5) blur(30px)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

