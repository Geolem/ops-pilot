import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RunStatus {
  status: number; // HTTP status, 0 = network/script error
  ts: number;
}

interface AppState {
  // ─── persisted ────────────────────────────────────────────────
  activeProjectId: string | null;
  activeEnvironmentId: string | null;
  /** Set by CommandPalette so EndpointsPage can auto-select the endpoint. */
  pendingEndpointId: string | null;

  // ─── transient (not persisted) ────────────────────────────────
  /** Last run result per endpointId — shown as a status dot in the list. */
  endpointRunStatus: Record<string, RunStatus>;

  // ─── actions ──────────────────────────────────────────────────
  setActiveProject: (id: string | null) => void;
  setActiveEnvironment: (id: string | null) => void;
  setPendingEndpointId: (id: string | null) => void;
  setEndpointRunStatus: (id: string, status: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeEnvironmentId: null,
      pendingEndpointId: null,
      endpointRunStatus: {},

      setActiveProject: (id) =>
        set({ activeProjectId: id, activeEnvironmentId: null, pendingEndpointId: null }),
      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
      setPendingEndpointId: (id) => set({ pendingEndpointId: id }),
      setEndpointRunStatus: (id, status) =>
        set((s) => ({
          endpointRunStatus: {
            ...s.endpointRunStatus,
            [id]: { status, ts: Date.now() },
          },
        })),
    }),
    {
      name: "ops-pilot-app",
      // Only persist project/environment selections & pending navigation
      partialize: (s) => ({
        activeProjectId: s.activeProjectId,
        activeEnvironmentId: s.activeEnvironmentId,
        pendingEndpointId: s.pendingEndpointId,
      }),
    }
  )
);
