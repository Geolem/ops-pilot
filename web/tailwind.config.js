/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "rgb(var(--c-bg-base)    / <alpha-value>)",
          panel:   "rgb(var(--c-bg-panel)   / <alpha-value>)",
          elevated:"rgb(var(--c-bg-elevated)/ <alpha-value>)",
          hover:   "rgb(var(--c-bg-hover)   / <alpha-value>)",
        },
        brand: {
          DEFAULT: "#F97316",
          glow:    "#FB923C",
        },
        accent: {
          DEFAULT: "#FBBF24",
        },
      },
      boxShadow: {
        glow:  "0 0 20px rgba(249,115,22,0.4)",
        soft:  "0 4px 24px rgba(120,80,20,0.08)",
        float: "0 8px 32px rgba(120,80,20,0.16)",
        card:  "0 2px 12px rgba(120,80,20,0.06)",
      },
      animation: {
        "fade-in":  "fadeIn  0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      fontFamily: {
        sans: ['"Poppins"', '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
