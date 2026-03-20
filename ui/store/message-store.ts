"use client";

import { create } from "zustand";

import {
  getAgentActivityModel,
  type AgentActivityStatus,
  type LiveChatMessage,
} from "@/types/live-session";

type MessageStore = {
  currentChatId: string | null;
  messages: LiveChatMessage[];
  isLoadingHistory: boolean;
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  sendError: string | null;
  setCurrentChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: LiveChatMessage[]) => void;
  startLoadingHistory: () => void;
  stopLoadingHistory: () => void;
  addMessage: (message: LiveChatMessage) => void;
  upsertMessage: (message: LiveChatMessage) => void;
  startWaiting: () => void;
  stopWaiting: () => void;
  setSendError: (error: string | null) => void;
  startStreaming: (initialMessage: LiveChatMessage) => void;
  clearMessages: () => void;
  appendLastMessage: (textChunk: string) => void;
  stopStreaming: () => void;
  settlePendingFunctionCalls: (status: AgentActivityStatus, functionName?: string | null) => void;
};

export const useMessageStore = create<MessageStore>((set) => ({
  currentChatId: null,
  messages: [],
  isLoadingHistory: false,
  isStreaming: false,
  isWaitingForResponse: false,
  sendError: null,

  setCurrentChat: (chatId) =>
    set((state) => {
      if (state.currentChatId === chatId) {
        return {};
      }

      return {
        currentChatId: chatId,
        messages: [],
        isLoadingHistory: false,
        isStreaming: false,
        isWaitingForResponse: false,
        sendError: null,
      };
    }),

  setMessages: (chatId, messages) =>
    set((state) => {
      if (state.currentChatId !== chatId) {
        return {};
      }

      return {
        messages,
        isLoadingHistory: false,
        isStreaming: false,
        isWaitingForResponse: false,
      };
    }),

  startLoadingHistory: () => set({ isLoadingHistory: true, sendError: null }),
  stopLoadingHistory: () => set({ isLoadingHistory: false }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  upsertMessage: (message) =>
    set((state) => {
      const existingIndex = state.messages.findIndex((item) => item.id === message.id);
      if (existingIndex === -1) {
        return { messages: [...state.messages, message] };
      }

      const messages = [...state.messages];
      messages[existingIndex] = message;
      return { messages };
    }),

  startWaiting: () => set({ isWaitingForResponse: true, sendError: null }),
  stopWaiting: () => set({ isWaitingForResponse: false }),
  setSendError: (sendError) => set({ sendError }),

  startStreaming: (initialMessage) =>
    set((state) => ({
      messages: [...state.messages, initialMessage],
      isStreaming: true,
      isWaitingForResponse: false,
    })),

  clearMessages: () =>
    set({
      messages: [],
      isLoadingHistory: false,
      isStreaming: false,
      isWaitingForResponse: false,
      sendError: null,
    }),

  appendLastMessage: (textChunk) =>
    set((state) => {
      if (!state.isStreaming) {
        return {};
      }

      const lastMessageIndex = state.messages.findLastIndex(
        (message) => message.sender === "model" && message.type === "text",
      );

      if (lastMessageIndex === -1) {
        return {};
      }

      const messages = [...state.messages];
      const lastMessage = messages[lastMessageIndex];
      const currentContent =
        typeof lastMessage.data === "string"
          ? lastMessage.data
          : lastMessage.data && typeof lastMessage.data === "object" && "content" in lastMessage.data
            ? String(lastMessage.data.content ?? "")
            : "";
      let nextContent = `${currentContent}${textChunk}`;

      if (textChunk.startsWith(currentContent)) {
        nextContent = textChunk
      } else if (currentContent.startsWith(textChunk)) {
        nextContent = currentContent
      }

      messages[lastMessageIndex] = {
        ...lastMessage,
        data: {
          content: nextContent,
          mime_type: "text/plain",
        },
      };
      return { messages };
    }),

  stopStreaming: () => set({ isStreaming: false, isWaitingForResponse: false }),

  settlePendingFunctionCalls: (status, functionName) =>
    set((state) => {
      let hasChanges = false;
      const messages = state.messages.map((message) => {
        const activity = getAgentActivityModel(message);
        if (!activity || activity.kind !== "function_call") {
          return message;
        }

        if (message.status === "completed" || message.status === "failed") {
          return message;
        }

        if (functionName && activity.functionName !== functionName) {
          return message;
        }

        hasChanges = true;
        return {
          ...message,
          status,
        };
      });

      if (!hasChanges) {
        return {};
      }

      return { messages };
    }),
}));
