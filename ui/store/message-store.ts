"use client";

import { create } from "zustand";

import {
  getAgentActivityModel,
  getLiveMessageText,
  type AgentActivityStatus,
  type LiveChatMessage,
} from "@/types/live-session";

type ChatViewState = {
  messages: LiveChatMessage[];
  isLoadingHistory: boolean;
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  sendError: string | null;
};

type MessageStore = {
  currentChatId: string | null;
  chatStateById: Record<string, ChatViewState | undefined>;
  messages: LiveChatMessage[];
  isLoadingHistory: boolean;
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  sendError: string | null;
  setCurrentChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: LiveChatMessage[]) => void;
  startLoadingHistory: (chatId?: string | null) => void;
  stopLoadingHistory: (chatId?: string | null) => void;
  addMessage: (message: LiveChatMessage) => void;
  upsertMessage: (message: LiveChatMessage) => void;
  startWaiting: (chatId?: string | null) => void;
  stopWaiting: (chatId?: string | null) => void;
  setSendError: (error: string | null, chatId?: string | null) => void;
  startStreaming: (initialMessage: LiveChatMessage) => void;
  clearMessages: () => void;
  appendLastMessage: (textChunk: string, chatId?: string | null) => void;
  stopStreaming: (chatId?: string | null) => void;
  settlePendingFunctionCalls: (
    status: AgentActivityStatus,
    functionName?: string | null,
    chatId?: string | null,
  ) => void;
};

function createEmptyChatViewState(): ChatViewState {
  return {
    messages: [],
    isLoadingHistory: false,
    isStreaming: false,
    isWaitingForResponse: false,
    sendError: null,
  };
}

function getChatViewState(
  chatStateById: Record<string, ChatViewState | undefined>,
  chatId: string | null,
): ChatViewState {
  if (!chatId) {
    return createEmptyChatViewState();
  }

  return chatStateById[chatId] ?? createEmptyChatViewState();
}

function syncVisibleChatState(
  currentChatId: string | null,
  targetChatId: string,
  nextChatState: ChatViewState,
) {
  if (currentChatId !== targetChatId) {
    return {};
  }

  return nextChatState;
}

function resolveTargetChatId(explicitChatId: string | null | undefined, currentChatId: string | null) {
  return explicitChatId ?? currentChatId;
}

function normalizeMessageSignatureText(message: LiveChatMessage) {
  const text = getLiveMessageText(message)?.trim();
  if (!text) {
    return null;
  }

  return text.replace(/\s+/g, " ");
}

function getLooseMessageSignature(message: LiveChatMessage) {
  if (message.type !== "text") {
    return null;
  }

  const normalizedText = normalizeMessageSignatureText(message);
  if (normalizedText) {
    return `${message.sender}:${message.type}:${normalizedText}`;
  }

  try {
    return `${message.sender}:${message.type}:${JSON.stringify(message.data)}`;
  } catch {
    return `${message.sender}:${message.type}:${String(message.data)}`;
  }
}

function mergeChatMessages(historyMessages: LiveChatMessage[], currentMessages: LiveChatMessage[]) {
  if (currentMessages.length === 0) {
    return historyMessages;
  }

  const mergedMessages = [...historyMessages];
  const seenIds = new Set(historyMessages.map((message) => message.id));
  const seenLooseSignatures = new Set(
    historyMessages
      .map((message) => getLooseMessageSignature(message))
      .filter((signature): signature is string => Boolean(signature)),
  );

  for (const message of currentMessages) {
    if (seenIds.has(message.id)) {
      continue;
    }

    const looseSignature = getLooseMessageSignature(message);
    if (looseSignature && seenLooseSignatures.has(looseSignature)) {
      continue;
    }

    seenIds.add(message.id);
    if (looseSignature) {
      seenLooseSignatures.add(looseSignature);
    }
    mergedMessages.push(message);
  }

  return mergedMessages.sort((left, right) => {
    const leftTimestamp = Date.parse(left.createdAt);
    const rightTimestamp = Date.parse(right.createdAt);

    if (!Number.isNaN(leftTimestamp) && !Number.isNaN(rightTimestamp) && leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export const useMessageStore = create<MessageStore>((set) => ({
  currentChatId: null,
  chatStateById: {},
  ...createEmptyChatViewState(),

  setCurrentChat: (chatId) =>
    set((state) => {
      if (state.currentChatId === chatId) {
        return {};
      }

      return {
        currentChatId: chatId,
        ...getChatViewState(state.chatStateById, chatId),
      };
    }),

  setMessages: (chatId, messages) =>
    set((state) => {
      const currentChatState = getChatViewState(state.chatStateById, chatId);
      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages: mergeChatMessages(messages, currentChatState.messages),
        isLoadingHistory: false,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [chatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, chatId, nextChatState),
      };
    }),

  startLoadingHistory: (chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return {
          isLoadingHistory: true,
          sendError: null,
        };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        isLoadingHistory: true,
        sendError: null,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),
  stopLoadingHistory: (chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return { isLoadingHistory: false };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        isLoadingHistory: false,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),

  addMessage: (message) =>
    set((state) => {
      const currentChatState = getChatViewState(state.chatStateById, message.chatId);
      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages: [...currentChatState.messages, message],
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [message.chatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, message.chatId, nextChatState),
      };
    }),

  upsertMessage: (message) =>
    set((state) => {
      const currentChatState = getChatViewState(state.chatStateById, message.chatId);
      const existingIndex = currentChatState.messages.findIndex((item) => item.id === message.id);
      if (existingIndex === -1) {
        const nextChatState: ChatViewState = {
          ...currentChatState,
          messages: [...currentChatState.messages, message],
        };
        return {
          chatStateById: {
            ...state.chatStateById,
            [message.chatId]: nextChatState,
          },
          ...syncVisibleChatState(state.currentChatId, message.chatId, nextChatState),
        };
      }

      const messages = [...currentChatState.messages];
      messages[existingIndex] = message;
      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages,
      };
      return {
        chatStateById: {
          ...state.chatStateById,
          [message.chatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, message.chatId, nextChatState),
      };
    }),

  startWaiting: (chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return {
          isWaitingForResponse: true,
          sendError: null,
        };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        isWaitingForResponse: true,
        sendError: null,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),
  stopWaiting: (chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return { isWaitingForResponse: false };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        isWaitingForResponse: false,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),
  setSendError: (sendError, chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return { sendError };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        sendError,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),

  startStreaming: (initialMessage) =>
    set((state) => {
      const currentChatState = getChatViewState(state.chatStateById, initialMessage.chatId);
      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages: [...currentChatState.messages, initialMessage],
        isStreaming: true,
        isWaitingForResponse: false,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [initialMessage.chatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, initialMessage.chatId, nextChatState),
      };
    }),

  clearMessages: () =>
    set((state) => {
      if (!state.currentChatId) {
        return {
          ...createEmptyChatViewState(),
        };
      }

      const nextChatState = createEmptyChatViewState();
      return {
        chatStateById: {
          ...state.chatStateById,
          [state.currentChatId]: nextChatState,
        },
        ...nextChatState,
      };
    }),

  appendLastMessage: (textChunk, chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return {};
      }

      const currentChatState = getChatViewState(state.chatStateById, targetChatId);
      if (!currentChatState.isStreaming) {
        return {};
      }

      const lastMessageIndex = currentChatState.messages.findLastIndex(
        (message) => message.sender === "model" && message.type === "text",
      );

      if (lastMessageIndex === -1) {
        return {};
      }

      const messages = [...currentChatState.messages];
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
      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages,
      };
      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),

  stopStreaming: (chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return {
          isStreaming: false,
          isWaitingForResponse: false,
        };
      }

      const nextChatState: ChatViewState = {
        ...getChatViewState(state.chatStateById, targetChatId),
        isStreaming: false,
        isWaitingForResponse: false,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),

  settlePendingFunctionCalls: (status, functionName, chatId) =>
    set((state) => {
      const targetChatId = resolveTargetChatId(chatId, state.currentChatId);
      if (!targetChatId) {
        return {};
      }

      const currentChatState = getChatViewState(state.chatStateById, targetChatId);
      const targetMessageId = functionName
        ? currentChatState.messages.find((message) => {
            const activity = getAgentActivityModel(message);
            if (!activity || activity.kind !== "function_call" || activity.functionName !== functionName) {
              return false;
            }

            return message.status !== "completed" && message.status !== "failed";
          })?.id ?? null
        : null;

      let hasChanges = false;
      const messages = currentChatState.messages.map((message) => {
        const activity = getAgentActivityModel(message);
        if (!activity || activity.kind !== "function_call") {
          return message;
        }

        if (message.status === "completed" || message.status === "failed") {
          return message;
        }

        if (functionName) {
          if (message.id !== targetMessageId) {
            return message;
          }
        } else if (activity.functionName && status !== "failed") {
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

      const nextChatState: ChatViewState = {
        ...currentChatState,
        messages,
      };

      return {
        chatStateById: {
          ...state.chatStateById,
          [targetChatId]: nextChatState,
        },
        ...syncVisibleChatState(state.currentChatId, targetChatId, nextChatState),
      };
    }),
}));
