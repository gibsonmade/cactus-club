import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1D1D1F",
        bone: "#F5F5F7",
        mezcal: "#A3E635",
        cactus: "#1F7A4D",
        neon: "#30D158",
        violet: "#6E5CFF",
        night: "#111113"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 24px 80px rgba(48, 209, 88, 0.24)",
        card: "0 18px 60px rgba(0, 0, 0, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
