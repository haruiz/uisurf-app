"use client";

import { create } from "zustand";

type VncState = {
  activeSessionId: string | null;
  connectionStatus: "idle" | "connecting" | "connected" | "error";
  panelOpen: boolean;
  setActiveSessionId: (sessionId: string | null) => void;
  setConnectionStatus: (status: VncState["connectionStatus"]) => void;
  togglePanel: () => void;
};

export const useVncStore = create<VncState>((set) => ({
  activeSessionId: null,
  connectionStatus: "idle",
  panelOpen: true,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
}));
