import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#110f0d",
        bone: "#f8f0df",
        mezcal: "#d76632",
        cactus: "#255f45",
        neon: "#d5ff5f",
        violet: "#6e42ff",
        night: "#080706"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        glow: "0 24px 80px rgba(215, 102, 50, 0.22)",
        card: "0 18px 50px rgba(0, 0, 0, 0.32)"
      }
    }
  },
  plugins: []
};

export default config;
