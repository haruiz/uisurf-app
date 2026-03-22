"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SessionAgentState = "working" | "completed" | "approval_required";

type ChatState = {
  selectedChatId: string | null;
  sidebarOpen: boolean;
  loadingViewerChatIds: string[];
  draftByChatId: Record<string, string | undefined>;
  sessionAgentStateById: Record<string, SessionAgentState | undefined>;
  resolvedApprovalKeyByChatId: Record<string, string | undefined>;
  setSelectedChatId: (chatId: string | null) => void;
  setViewerLoading: (chatId: string, loading: boolean) => void;
  clearViewerLoading: (chatId: string) => void;
  setChatDraft: (chatId: string, draft: string) => void;
  clearChatDraft: (chatId: string) => void;
  setSessionAgentState: (chatId: string, state: SessionAgentState) => void;
  clearSessionAgentState: (chatId: string) => void;
  setResolvedApprovalKey: (chatId: string, approvalKey: string) => void;
  clearResolvedApprovalKey: (chatId: string) => void;
  toggleSidebar: () => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      selectedChatId: null,
      sidebarOpen: true,
      loadingViewerChatIds: [],
      draftByChatId: {},
      sessionAgentStateById: {},
      resolvedApprovalKeyByChatId: {},
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
      setChatDraft: (chatId, draft) =>
        set((state) => ({
          draftByChatId:
            state.draftByChatId[chatId] === draft
              ? state.draftByChatId
              : {
                  ...state.draftByChatId,
                  [chatId]: draft,
                },
        })),
      clearChatDraft: (chatId) =>
        set((state) => {
          if (!(chatId in state.draftByChatId)) {
            return {};
          }

          const nextDrafts = { ...state.draftByChatId };
          delete nextDrafts[chatId];
          return {
            draftByChatId: nextDrafts,
          };
        }),
      setSessionAgentState: (chatId, sessionState) =>
        set((state) => ({
          sessionAgentStateById:
            state.sessionAgentStateById[chatId] === sessionState
              ? state.sessionAgentStateById
              : {
                  ...state.sessionAgentStateById,
                  [chatId]: sessionState,
                },
        })),
      clearSessionAgentState: (chatId) =>
        set((state) => {
          if (!(chatId in state.sessionAgentStateById)) {
            return {};
          }

          const nextState = { ...state.sessionAgentStateById };
          delete nextState[chatId];
          return {
            sessionAgentStateById: nextState,
          };
        }),
      setResolvedApprovalKey: (chatId, approvalKey) =>
        set((state) => ({
          resolvedApprovalKeyByChatId:
            state.resolvedApprovalKeyByChatId[chatId] === approvalKey
              ? state.resolvedApprovalKeyByChatId
              : {
                  ...state.resolvedApprovalKeyByChatId,
                  [chatId]: approvalKey,
                },
        })),
      clearResolvedApprovalKey: (chatId) =>
        set((state) => {
          if (!(chatId in state.resolvedApprovalKeyByChatId)) {
            return {};
          }

          const nextState = { ...state.resolvedApprovalKeyByChatId };
          delete nextState[chatId];
          return {
            resolvedApprovalKeyByChatId: nextState,
          };
        }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: "chat-approval-store",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        resolvedApprovalKeyByChatId: state.resolvedApprovalKeyByChatId,
      }),
    },
  ),
);
