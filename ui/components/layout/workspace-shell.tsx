"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useSession } from "next-auth/react";

import { Chat } from "@/components/chat/chat";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { VncPanel } from "@/components/vnc/vnc-panel";
import { WebSocketProvider } from "@/components/providers/websocket-provider";
import useAccessToken from "@/hooks/use-access-token";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { createWebSocketTicket } from "@/lib/api";
import { getWebSocketBaseUrl } from "@/lib/env.client";
import { useChatStore } from "@/store/chat-store";
import { useVncStore } from "@/store/vnc-store";

type ResizeTarget = "left" | "right" | null;

const LEFT_OPEN_WIDTH = 320;
const LEFT_CLOSED_WIDTH = 92;
const RIGHT_OPEN_WIDTH = 800;
const RIGHT_CLOSED_WIDTH = 92;
const MIN_LEFT_WIDTH = 260;
const MAX_LEFT_WIDTH = 520;
const MIN_RIGHT_WIDTH = 620;
const MAX_RIGHT_WIDTH = 1200;
const WEBSOCKET_TICKET_REFRESH_LEEWAY_MS = 30_000;

type WebSocketTicketState = {
  ticket: string;
  expiresAt: string;
};

function isTicketExpiredOrExpiring(
  ticketState: WebSocketTicketState | undefined,
  leewayMs = WEBSOCKET_TICKET_REFRESH_LEEWAY_MS,
) {
  if (!ticketState) {
    return true;
  }

  const expiresAtMs = Date.parse(ticketState.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= leewayMs;
}

export function WorkspaceShell({ token }: { token?: string }) {
  const { data: session } = useSession();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const selectedChatId = useChatStore((state) => state.selectedChatId);
  const setViewerLoading = useChatStore((state) => state.setViewerLoading);
  const vncPanelOpen = useVncStore((state) => state.panelOpen);
  const userId = session?.user?.id;

  const [leftWidth, setLeftWidth] = useState(LEFT_OPEN_WIDTH);
  const [rightWidth, setRightWidth] = useState(RIGHT_OPEN_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeTarget>(null);
  const [wsTicketByChatId, setWsTicketByChatId] = useState<Record<string, WebSocketTicketState | undefined>>({});
  const pendingTicketChatIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeResize) {
      return;
    }

    function handlePointerMove(event: MouseEvent) {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      if (activeResize === "left") {
        setLeftWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, event.clientX - bounds.left)));
        return;
      }

      setRightWidth(Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, bounds.right - event.clientX)));
    }

    function handlePointerUp() {
      setActiveResize(null);
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [activeResize]);


  const leftColumnWidth = sidebarOpen ? leftWidth : LEFT_CLOSED_WIDTH;
  const rightColumnWidth = vncPanelOpen ? rightWidth : RIGHT_CLOSED_WIDTH;
  const clientAccessToken = useAccessToken();
  const accessToken = token ?? clientAccessToken ?? undefined;
  const chatSessionsQuery = useChatSessions(accessToken);
  const sessions = chatSessionsQuery.data?.items ?? [];
  const selectedChat = chatSessionsQuery.data?.items.find((session) => session.id === selectedChatId) ?? null;

  const requestWebSocketTicket = useCallback(async (chatId: string) => {
    if (!accessToken || pendingTicketChatIdsRef.current.has(chatId)) {
      return;
    }

    pendingTicketChatIdsRef.current.add(chatId);
    try {
      const response = await createWebSocketTicket(chatId, accessToken);
      setWsTicketByChatId((current) => {
        const currentTicket = current[chatId];
        if (
          currentTicket?.ticket === response.ticket &&
          currentTicket.expiresAt === response.expires_at
        ) {
          return current;
        }

        return {
          ...current,
          [chatId]: {
            ticket: response.ticket,
            expiresAt: response.expires_at,
          },
        };
      });
    } catch {
      setWsTicketByChatId((current) => {
        if (current[chatId] !== undefined) {
          return current;
        }

        return {
          ...current,
          [chatId]: undefined,
        };
      });
    } finally {
      pendingTicketChatIdsRef.current.delete(chatId);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !userId) {
      pendingTicketChatIdsRef.current.clear();
      setWsTicketByChatId({});
      return;
    }

    const sessionIds = new Set(sessions.map((session) => session.id));
    pendingTicketChatIdsRef.current.forEach((chatId) => {
      if (!sessionIds.has(chatId)) {
        pendingTicketChatIdsRef.current.delete(chatId);
      }
    });

    setWsTicketByChatId((current) => {
      const nextEntries = Object.entries(current).filter(([chatId]) => sessionIds.has(chatId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });

    for (const session of sessions) {
      if (wsTicketByChatId[session.id] || pendingTicketChatIdsRef.current.has(session.id)) {
        continue;
      }

      void requestWebSocketTicket(session.id);
    }
  }, [accessToken, requestWebSocketTicket, sessions, userId, wsTicketByChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const selectedTicket = wsTicketByChatId[selectedChatId];
    if (!selectedTicket || isTicketExpiredOrExpiring(selectedTicket)) {
      void requestWebSocketTicket(selectedChatId);
    }
  }, [requestWebSocketTicket, selectedChatId, wsTicketByChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const timer = window.setInterval(() => {
      const selectedTicket = wsTicketByChatId[selectedChatId];
      if (isTicketExpiredOrExpiring(selectedTicket)) {
        void requestWebSocketTicket(selectedChatId);
      }
    }, 15_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [requestWebSocketTicket, selectedChatId, wsTicketByChatId]);

  const socketConnections =
    userId && accessToken
      ? sessions.map((session) => ({
          chatId: session.id,
          controlMode: session.control_mode,
          wsUrl: wsTicketByChatId[session.id]?.ticket
            ? `${getWebSocketBaseUrl()}/${encodeURIComponent(userId)}/${encodeURIComponent(session.id)}`
            : null,
          ticketExpiresAt: wsTicketByChatId[session.id]?.expiresAt ?? null,
          refreshTicket: () => requestWebSocketTicket(session.id),
          params: {
            ticket: wsTicketByChatId[session.id]?.ticket ?? null,
            vnc_url: session.vnc_url ?? null,
          },
        }))
      : [];

  const content = (
    <Box
      ref={containerRef}
      sx={{
        display: "grid",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        gap: 1.5,
        gridTemplateColumns: `${leftColumnWidth}px 10px minmax(0, 1fr) 10px ${rightColumnWidth}px`,
      }}
    >
      <ChatSidebar token={accessToken} />

      <Box sx={{ display: "flex", alignItems: "stretch", justifyContent: "center" }}>
        {sidebarOpen ? (
          <Box
            component="button"
            type="button"
            aria-label="Resize browser session panel"
            onMouseDown={() => setActiveResize("left")}
            sx={{
              width: 6,
              border: 0,
              borderRadius: 1.5,
              bgcolor: activeResize === "left" ? "primary.main" : "divider",
              opacity: activeResize === "left" ? 0.6 : 1,
              cursor: "col-resize",
            }}
          />
        ) : (
          <Box sx={{ width: 6 }} />
        )}
      </Box>

      <Chat token={accessToken} />

      <Box sx={{ display: "flex", alignItems: "stretch", justifyContent: "center" }}>
        {vncPanelOpen ? (
          <Box
            component="button"
            type="button"
            aria-label="Resize VNC panel"
            onMouseDown={() => setActiveResize("right")}
            sx={{
              width: 6,
              border: 0,
              borderRadius: 1.5,
              bgcolor: activeResize === "right" ? "primary.main" : "divider",
              opacity: activeResize === "right" ? 0.6 : 1,
              cursor: "col-resize",
            }}
          />
        ) : (
          <Box sx={{ width: 6 }} />
        )}
      </Box>

      <VncPanel
        chatId={selectedChatId}
        viewerUrl={selectedChat?.vnc_url ?? null}
        viewerPending={selectedChat?.vnc_pending ?? false}
        onRefreshRequest={() => {
          void chatSessionsQuery.refetch();
        }}
        onStatusChange={(status) => {
          if (!selectedChatId) {
            return;
          }
          setViewerLoading(selectedChatId, status === "probing");
        }}
      />
    </Box>
  );

  return (
    <WebSocketProvider selectedChatId={selectedChatId} connections={socketConnections}>
      <Box sx={{ position: "relative", height: "100%", minHeight: 0 }}>
        {content}
      </Box>
    </WebSocketProvider>
  );
}
