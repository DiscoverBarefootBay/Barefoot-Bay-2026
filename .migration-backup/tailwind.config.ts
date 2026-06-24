import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  important: true, // Ensure Tailwind styles take precedence in production
  theme: {
    extend: {
      fontFamily: {
        'advent-pro': ['Advent Pro', 'sans-serif'],
        'anchorage': ['Anchorage', 'sans-serif'],
        'nunito': ['Nunito', 'sans-serif'],
      },
      colors: {
        ocean: 'rgb(var(--ocean))',
        coral: 'rgb(var(--coral))',
        navy: 'rgb(var(--navy))',
        grey: 'rgb(var(--grey))',
        charcoal: 'rgb(var(--charcoal))',
        border: "rgb(var(--navy) / 0.1)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "rgb(var(--ocean))",
          foreground: "rgb(var(--charcoal))",
        },
        secondary: {
          DEFAULT: "rgb(var(--coral))",
          foreground: "rgb(var(--white))",
        },
        muted: {
          DEFAULT: "rgb(var(--grey))",
          foreground: "rgb(var(--charcoal))",
        },
        accent: {
          DEFAULT: "rgb(var(--coral))",
          foreground: "rgb(var(--white))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
        "pulse-slow": "pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;