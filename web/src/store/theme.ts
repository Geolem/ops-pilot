import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "system";

const THEMES: Theme[] = ["dark", "light", "system"];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (t) => { set({ theme: t }); applyTheme(t); },
      cycle: () => {
        const cur = get().theme;
        const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: "ops-pilot-theme" }
  )
);

export { applyTheme, THEMES };
