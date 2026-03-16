"use client";

import { useEffect, useRef, useState } from "react";
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
  const [wsTicket, setWsTicket] = useState<string | null>(null);

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
  const selectedChat = chatSessionsQuery.data?.items.find((session) => session.id === selectedChatId) ?? null;
  const socketUrl =
    userId && selectedChatId && wsTicket
      ? `${getWebSocketBaseUrl()}/${encodeURIComponent(userId)}/${encodeURIComponent(selectedChatId)}`
      : null;

  useEffect(() => {
    let cancelled = false;

    async function loadWebSocketTicket() {
      if (!selectedChatId || !accessToken) {
        setWsTicket(null);
        return;
      }

      try {
        const response = await createWebSocketTicket(selectedChatId, accessToken);
        if (!cancelled) {
          setWsTicket(response.ticket);
        }
      } catch {
        if (!cancelled) {
          setWsTicket(null);
        }
      }
    }

    void loadWebSocketTicket();

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedChatId]);

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
    <WebSocketProvider wsUrl={socketUrl} params={{ ticket: wsTicket, vnc_url: selectedChat?.vnc_url ?? null }}>
      {content}
    </WebSocketProvider>
  );
}
