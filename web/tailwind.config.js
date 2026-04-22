/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0b0f1a",
          panel: "#111827",
          elevated: "#1a2234",
          hover: "#222b40",
        },
        brand: {
          DEFAULT: "#6366f1",
          glow: "#818cf8",
        },
        accent: {
          DEFAULT: "#22d3ee",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(99, 102, 241, 0.35)",
        soft: "0 4px 24px rgba(15, 23, 42, 0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
