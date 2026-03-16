"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

type WebSocketProviderProps = {
  children: ReactNode;
  wsUrl?: string | null;
  params?: Record<string, string | number | boolean | null | undefined>;
};

type WebSocketContextValue = {
  sendJsonMessage: (message: unknown, keep?: boolean) => void;
  lastJsonMessage: unknown;
  connectionStatus: string;
  reconnect: () => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return ctx;
}

export function WebSocketProvider({
  children,
  wsUrl,
  params,
}: WebSocketProviderProps) {
  const [nonce, setNonce] = useState(Date.now());

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

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: () => Boolean(socketUrl),
    reconnectInterval: 3000,
  }, Boolean(socketUrl));

  const reconnect = useCallback(() => setNonce(Date.now()), []);

  const connectionStatus =
    {
      [ReadyState.CONNECTING]: "Connecting",
      [ReadyState.OPEN]: "Open",
      [ReadyState.CLOSING]: "Closing",
      [ReadyState.CLOSED]: "Closed",
      [ReadyState.UNINSTANTIATED]: "Uninstantiated",
    }[readyState] || "Uninstantiated";

  const value = useMemo(
    () => ({ sendJsonMessage, lastJsonMessage, connectionStatus, reconnect }),
    [connectionStatus, lastJsonMessage, reconnect, sendJsonMessage],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}
