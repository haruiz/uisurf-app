"use client";

import { create } from "zustand";

type ChatState = {
  selectedChatId: string | null;
  sidebarOpen: boolean;
  loadingViewerChatIds: string[];
  setSelectedChatId: (chatId: string | null) => void;
  setViewerLoading: (chatId: string, loading: boolean) => void;
  clearViewerLoading: (chatId: string) => void;
  toggleSidebar: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  selectedChatId: null,
  sidebarOpen: true,
  loadingViewerChatIds: [],
  setSelectedChatId: (selectedChatId) => set({ selectedChatId }),
  setViewerLoading: (chatId, loading) =>
    set((state) => ({
      loadingViewerChatIds: loading
        ? state.loadingViewerChatIds.includes(chatId)
          ? state.loadingViewerChatIds
          : [...state.loadingViewerChatIds, chatId]
        : state.loadingViewerChatIds.filter((id) => id !== chatId),
    })),
  clearViewerLoading: (chatId) =>
    set((state) => ({
      loadingViewerChatIds: state.loadingViewerChatIds.filter((id) => id !== chatId),
    })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
