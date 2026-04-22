import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  activeProjectId: string | null;
  activeEnvironmentId: string | null;
  setActiveProject: (id: string | null) => void;
  setActiveEnvironment: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeEnvironmentId: null,
      setActiveProject: (id) => set({ activeProjectId: id, activeEnvironmentId: null }),
      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
    }),
    { name: "ops-pilot-app" }
  )
);
