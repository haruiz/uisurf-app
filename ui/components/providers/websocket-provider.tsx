"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { useChatStore, type SessionAgentState } from "@/store/chat-store";
import { useMessageStore } from "@/store/message-store";
import {
  createLiveChatMessage,
  getActiveApprovalRequest,
  getAgentActivityModel,
  isStructuredActivityPayload,
  isLiveSessionEnvelope,
  type LiveChatMessage,
  type LiveSessionEnvelope,
} from "@/types/live-session";

type SessionConnectionConfig = {
  chatId: string;
  controlMode?: "agent" | "manual" | null;
  ticketExpiresAt?: string | null;
  refreshTicket?: (() => Promise<void> | void) | null;
  wsUrl?: string | null;
  params?: Record<string, string | number | boolean | null | undefined>;
};

type WebSocketProviderProps = {
  children: ReactNode;
  selectedChatId?: string | null;
  connections?: SessionConnectionConfig[];
};

type WebSocketContextValue = {
  sendJsonMessage: (message: unknown, keep?: boolean) => void;
  connectionStatus: string;
  reconnect: () => void;
};

type SessionSocketHandle = {
  sendJsonMessage: (message: unknown, keep?: boolean) => void;
  connectionStatus: string;
  reconnect: () => void;
};

type SessionSocketConnectionProps = SessionConnectionConfig & {
  registerHandle: (chatId: string, handle: SessionSocketHandle) => void;
  unregisterHandle: (chatId: string) => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

function getConnectionStatus(readyState: ReadyState) {
  return (
    {
      [ReadyState.CONNECTING]: "Connecting",
      [ReadyState.OPEN]: "Open",
      [ReadyState.CLOSING]: "Closing",
      [ReadyState.CLOSED]: "Closed",
      [ReadyState.UNINSTANTIATED]: "Uninstantiated",
    }[readyState] || "Uninstantiated"
  );
}

function deriveSessionAgentState(
  chatId: string,
  messages: LiveChatMessage[],
  isWaitingForResponse: boolean,
  isStreaming: boolean,
  controlMode: "agent" | "manual" | null,
  resolvedApprovalKey: string | null,
): SessionAgentState | null {
  if (getActiveApprovalRequest(messages, chatId, controlMode, resolvedApprovalKey)) {
    return "approval_required";
  }

  for (const message of [...messages].reverse()) {
    if (message.type === "error") {
      return null;
    }

    if (message.type === "turn_complete" || message.type === "interrupted") {
      return "completed";
    }

    const activity = getAgentActivityModel(message, message.status ?? "running");
    if (
      activity &&
      activity.status === "running" &&
      (activity.kind === "function_call" ||
        activity.kind === "progress" ||
        activity.kind === "task_update" ||
        activity.requiresConfirmation)
    ) {
      return "working";
    }

    if (message.sender === "model") {
      return "completed";
    }

    if (message.sender === "user") {
      return "working";
    }
  }

  if (isWaitingForResponse || isStreaming) {
    return "working";
  }

  return null;
}

function SessionSocketConnection({
  chatId,
  controlMode = null,
  ticketExpiresAt = null,
  refreshTicket = null,
  wsUrl,
  params,
  registerHandle,
  unregisterHandle,
}: SessionSocketConnectionProps) {
  const [nonce, setNonce] = useState(Date.now());
  const lastHandledMessageRef = useRef<unknown>(null);
  const isRefreshingTicketRef = useRef(false);
  const addMessage = useMessageStore((state) => state.addMessage);
  const startStreaming = useMessageStore((state) => state.startStreaming);
  const appendLastMessage = useMessageStore((state) => state.appendLastMessage);
  const stopStreaming = useMessageStore((state) => state.stopStreaming);
  const stopWaiting = useMessageStore((state) => state.stopWaiting);
  const setSendError = useMessageStore((state) => state.setSendError);
  const settlePendingFunctionCalls = useMessageStore((state) => state.settlePendingFunctionCalls);
  const chatViewState = useMessageStore((state) => state.chatStateById[chatId] ?? null);
  const setSessionAgentState = useChatStore((state) => state.setSessionAgentState);
  const clearSessionAgentState = useChatStore((state) => state.clearSessionAgentState);
  const resolvedApprovalKey = useChatStore((state) => state.resolvedApprovalKeyByChatId[chatId] ?? null);

  const socketUrl = useMemo(() => {
    if (!wsUrl) {
      return null;
    }

    const url = new URL(wsUrl, window.location.href);

    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          url.searchParams.delete(key);
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    url.searchParams.set("_reconnect", String(nonce));
    return url.toString();
  }, [nonce, params, wsUrl]);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    socketUrl,
    {
      shouldReconnect: () => Boolean(socketUrl),
      reconnectInterval: 3000,
    },
    Boolean(socketUrl),
  );

  const reconnect = useCallback(() => {
    if (!refreshTicket) {
      setNonce(Date.now());
      return;
    }

    if (isRefreshingTicketRef.current) {
      return;
    }

    isRefreshingTicketRef.current = true;
    void Promise.resolve(refreshTicket())
      .finally(() => {
        isRefreshingTicketRef.current = false;
        setNonce(Date.now());
      });
  }, [refreshTicket]);
  const connectionStatus = getConnectionStatus(readyState);

  useEffect(() => {
    if (!refreshTicket || isRefreshingTicketRef.current) {
      return;
    }

    const expiresAtMs = ticketExpiresAt ? Date.parse(ticketExpiresAt) : Number.NaN;
    const isTicketExpiredOrExpiring =
      Number.isNaN(expiresAtMs) || expiresAtMs - Date.now() <= 30_000;
    if (!isTicketExpiredOrExpiring) {
      return;
    }

    if (
      readyState !== ReadyState.CONNECTING &&
      readyState !== ReadyState.CLOSED &&
      readyState !== ReadyState.UNINSTANTIATED
    ) {
      return;
    }

    isRefreshingTicketRef.current = true;
    void Promise.resolve(refreshTicket())
      .finally(() => {
        isRefreshingTicketRef.current = false;
        setNonce(Date.now());
      });
  }, [readyState, refreshTicket, ticketExpiresAt]);

  useEffect(() => {
    if (!socketUrl) {
      unregisterHandle(chatId);
      return;
    }

    registerHandle(chatId, { sendJsonMessage, connectionStatus, reconnect });
    return () => {
      unregisterHandle(chatId);
    };
  }, [chatId, connectionStatus, reconnect, registerHandle, sendJsonMessage, socketUrl, unregisterHandle]);

  useEffect(() => {
    const nextState = deriveSessionAgentState(
      chatId,
      chatViewState?.messages ?? [],
      chatViewState?.isWaitingForResponse ?? false,
      chatViewState?.isStreaming ?? false,
      controlMode,
      resolvedApprovalKey,
    );

    if (nextState) {
      setSessionAgentState(chatId, nextState);
      return;
    }

    clearSessionAgentState(chatId);
  }, [chatId, chatViewState, clearSessionAgentState, controlMode, resolvedApprovalKey, setSessionAgentState]);

  useEffect(() => {
    if (!isLiveSessionEnvelope(lastJsonMessage)) {
      return;
    }

    if (lastHandledMessageRef.current === lastJsonMessage) {
      return;
    }
    lastHandledMessageRef.current = lastJsonMessage;

    const payload = lastJsonMessage as LiveSessionEnvelope;
    const isStreaming = useMessageStore.getState().chatStateById[chatId]?.isStreaming ?? false;

    if (payload.type === "text" && payload.sender === "model") {
      const content =
        typeof payload.data === "string"
          ? payload.data
          : payload.data && typeof payload.data === "object" && "content" in payload.data
            ? String(payload.data.content ?? "")
            : "";

      if (!content) {
        return;
      }

      if (isStructuredActivityPayload(content)) {
        stopStreaming(chatId);
        stopWaiting(chatId);
        const activityMessage = createLiveChatMessage(
          chatId,
          {
            ...payload,
            data: {
              content,
              mime_type: "application/json",
            },
          },
        );
        addMessage(activityMessage);
        const activity = getAgentActivityModel(activityMessage);
        if (activity?.kind === "function_response") {
          settlePendingFunctionCalls(activity.status, activity.functionName, chatId);
        }
        return;
      }

      if (!isStreaming) {
        startStreaming(
          createLiveChatMessage(
            chatId,
            {
              ...payload,
              data: {
                content,
                mime_type: "text/plain",
              },
            },
          ),
        );
      } else {
        appendLastMessage(content, chatId);
      }
      return;
    }

    if (payload.type === "turn_complete") {
      settlePendingFunctionCalls("completed", undefined, chatId);
      stopStreaming(chatId);
      stopWaiting(chatId);
      return;
    }

    if (payload.type === "turn_start") {
      setSendError(null, chatId);
      return;
    }

    if (payload.type === "debug") {
      if (isStructuredActivityPayload(payload.data)) {
        stopStreaming(chatId);
        const activityMessage = createLiveChatMessage(
          chatId,
          payload,
        );
        addMessage(activityMessage);
        const activity = getAgentActivityModel(activityMessage);
        if (activity?.kind === "function_response") {
          settlePendingFunctionCalls(activity.status, activity.functionName, chatId);
        }
      }
      return;
    }

    if (payload.type === "error") {
      const text =
        typeof payload.data === "string"
          ? payload.data
          : payload.data && typeof payload.data === "object" && "content" in payload.data
            ? String(payload.data.content ?? "")
            : "An unexpected error occurred";
      setSendError(text, chatId);
      addMessage(createLiveChatMessage(chatId, payload));
      settlePendingFunctionCalls("failed", undefined, chatId);
      stopStreaming(chatId);
      stopWaiting(chatId);
      return;
    }

    const liveMessage = createLiveChatMessage(chatId, payload);
    addMessage(liveMessage);
    const activity = getAgentActivityModel(liveMessage);
    if (activity?.kind === "function_response") {
      settlePendingFunctionCalls(activity.status, activity.functionName, chatId);
    }

    if (payload.type !== "info") {
      setSendError(null, chatId);
    }

    if (payload.type === "function_response") {
      stopWaiting(chatId);
    }
  }, [
    addMessage,
    appendLastMessage,
    chatId,
    lastJsonMessage,
    setSendError,
    settlePendingFunctionCalls,
    startStreaming,
    stopStreaming,
    stopWaiting,
  ]);

  return null;
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return ctx;
}

export function WebSocketProvider({
  children,
  selectedChatId = null,
  connections = [],
}: WebSocketProviderProps) {
  const [handlesByChatId, setHandlesByChatId] = useState<Record<string, SessionSocketHandle | undefined>>({});

  const registerHandle = useCallback((chatId: string, handle: SessionSocketHandle) => {
    setHandlesByChatId((current) => {
      const existing = current[chatId];
      if (
        existing?.sendJsonMessage === handle.sendJsonMessage &&
        existing.connectionStatus === handle.connectionStatus &&
        existing.reconnect === handle.reconnect
      ) {
        return current;
      }

      return {
        ...current,
        [chatId]: handle,
      };
    });
  }, []);

  const unregisterHandle = useCallback((chatId: string) => {
    setHandlesByChatId((current) => {
      if (!(chatId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[chatId];
      return next;
    });
  }, []);

  const selectedHandle = selectedChatId ? handlesByChatId[selectedChatId] : undefined;
  const selectedConnection = selectedChatId
    ? connections.find((connection) => connection.chatId === selectedChatId) ?? null
    : null;
  const selectedConnectionStatus =
    selectedHandle?.connectionStatus ?? (selectedConnection ? "Connecting" : "Uninstantiated");

  const value = useMemo<WebSocketContextValue>(
    () => ({
      sendJsonMessage: (message, keep) => {
        selectedHandle?.sendJsonMessage(message, keep);
      },
      connectionStatus: selectedConnectionStatus,
      reconnect: () => {
        selectedHandle?.reconnect();
      },
    }),
    [selectedConnectionStatus, selectedHandle],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {connections.map((connection) => (
        <SessionSocketConnection
          key={connection.chatId}
          {...connection}
          registerHandle={registerHandle}
          unregisterHandle={unregisterHandle}
        />
      ))}
      {children}
    </WebSocketContext.Provider>
  );
}
