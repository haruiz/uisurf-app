"use client";

import { useEffect } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import { useWebSocketContext } from "@/components/providers/websocket-provider";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { clearChatMessages, getChatMessages } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";
import { useMessageStore } from "@/store/message-store";
import {
  createLiveChatMessage,
  createLiveMessageId,
  normalizeHistoryMessage,
} from "@/types/live-session";

import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatToolBox } from "./chat-toolbox";

function getControlModeLabel(controlMode: "agent" | "manual") {
  return controlMode === "manual" ? "Manual" : "Agent";
}

export function Chat({ token }: { token?: string }) {
  const { selectedChatId } = useChatStore();
  const { connectionStatus, reconnect, sendJsonMessage } = useWebSocketContext();
  const sessionsQuery = useChatSessions(token);
  const queryClient = useQueryClient();
  const setCurrentChat = useMessageStore((state) => state.setCurrentChat);
  const setMessages = useMessageStore((state) => state.setMessages);
  const startLoadingHistory = useMessageStore((state) => state.startLoadingHistory);
  const stopLoadingHistory = useMessageStore((state) => state.stopLoadingHistory);
  const clearMessages = useMessageStore((state) => state.clearMessages);
  const setSendError = useMessageStore((state) => state.setSendError);
  const addMessage = useMessageStore((state) => state.addMessage);
  const startWaiting = useMessageStore((state) => state.startWaiting);
  const clearResolvedApprovalKey = useChatStore((state) => state.clearResolvedApprovalKey);
  const selectedChat = sessionsQuery.data?.items.find((session) => session.id === selectedChatId) ?? null;

  useEffect(() => {
    setCurrentChat(selectedChatId);
  }, [selectedChatId, setCurrentChat]);

  async function handleClearMessages() {
    if (!selectedChatId || !token) {
      if (selectedChatId) {
        clearResolvedApprovalKey(selectedChatId);
      }
      clearMessages();
      return;
    }

    try {
      await clearChatMessages(selectedChatId, token);
      clearMessages();
      clearResolvedApprovalKey(selectedChatId);
      void queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to clear chat history");
    }
  }

  function handleResendMessage(messageText: string) {
    if (!selectedChatId || connectionStatus !== "Open") {
      return;
    }

    const timestamp = Date.now();
    addMessage(
      createLiveChatMessage(
        selectedChatId,
        {
          type: "text",
          sender: "user",
          data: messageText,
          timestamp,
        },
        createLiveMessageId("user_text"),
      ),
    );
    startWaiting();
    setSendError(null);
    sendJsonMessage({
      type: "text",
      sender: "user",
      data: messageText,
      timestamp,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!selectedChatId || !token) {
        clearMessages();
        return;
      }

      try {
        startLoadingHistory();
        const response = await getChatMessages(selectedChatId, token);
        if (!cancelled) {
          setMessages(
            selectedChatId,
            response.items.map((message) => normalizeHistoryMessage(selectedChatId, message)),
          );
        }
      } catch (error) {
        if (!cancelled) {
          stopLoadingHistory();
          setSendError(error instanceof Error ? error.message : "Unable to load chat history");
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [clearMessages, selectedChatId, setMessages, setSendError, startLoadingHistory, stopLoadingHistory, token]);

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column", gap: 2 }}>
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          minHeight: 0,
          flex: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          p: 3,
        }}
      >
        <Stack spacing={2} sx={{ height: "100%", width: "100%", minHeight: 0 }}>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.18em" }}>
              Conversation
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Agent chat
              </Typography>
              {selectedChat ? (
                <Chip
                  size="small"
                  label={`${getControlModeLabel(selectedChat.control_mode)} session`}
                  color={selectedChat.control_mode === "manual" ? "warning" : "success"}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              ) : null}
            </Stack>
            {selectedChat ? (
              <Typography variant="body2" color="text.secondary">
                {selectedChat.control_mode === "manual"
                  ? "Manual mode: approval cards appear in the conversation when the browser or desktop agent pauses for confirmation."
                  : "Agent mode: confirmations are auto-approved, so no approval card is expected in this session."}
              </Typography>
            ) : null}
          </Box>

          <ChatToolBox
            connectionStatus={connectionStatus}
            onRestartConnection={reconnect}
            onClearMessages={() => void handleClearMessages()}
          />

          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ChatHistory
              chatId={selectedChatId}
              controlMode={selectedChat?.control_mode ?? null}
              onResendMessage={handleResendMessage}
              canResend={connectionStatus === "Open"}
            />
          </Box>
        </Stack>
      </Paper>

      <ChatInput chatId={selectedChatId} token={token} controlMode={selectedChat?.control_mode ?? null} />
    </Box>
  );
}
