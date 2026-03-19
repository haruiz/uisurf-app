"use client";

import { useEffect, useRef } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import { useWebSocketContext } from "@/components/providers/websocket-provider";
import { clearChatMessages, getChatMessages } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";
import { useMessageStore } from "@/store/message-store";
import {
  createLiveChatMessage,
  createLiveMessageId,
  isLiveSessionEnvelope,
  normalizeHistoryMessage,
  type LiveSessionEnvelope,
} from "@/types/live-session";

import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatToolBox } from "./chat-toolbox";

export function Chat({ token }: { token?: string }) {
  const { selectedChatId } = useChatStore();
  const { connectionStatus, reconnect, lastJsonMessage, sendJsonMessage } = useWebSocketContext();
  const queryClient = useQueryClient();
  const setCurrentChat = useMessageStore((state) => state.setCurrentChat);
  const setMessages = useMessageStore((state) => state.setMessages);
  const startLoadingHistory = useMessageStore((state) => state.startLoadingHistory);
  const stopLoadingHistory = useMessageStore((state) => state.stopLoadingHistory);
  const clearMessages = useMessageStore((state) => state.clearMessages);
  const setSendError = useMessageStore((state) => state.setSendError);
  const addMessage = useMessageStore((state) => state.addMessage);
  const startStreaming = useMessageStore((state) => state.startStreaming);
  const appendLastMessage = useMessageStore((state) => state.appendLastMessage);
  const stopStreaming = useMessageStore((state) => state.stopStreaming);
  const startWaiting = useMessageStore((state) => state.startWaiting);
  const stopWaiting = useMessageStore((state) => state.stopWaiting);
  const isStreaming = useMessageStore((state) => state.isStreaming);
  const lastHandledMessageRef = useRef<unknown>(null);

  useEffect(() => {
    setCurrentChat(selectedChatId);
  }, [selectedChatId, setCurrentChat]);

  async function handleClearMessages() {
    if (!selectedChatId || !token) {
      clearMessages();
      return;
    }

    try {
      await clearChatMessages(selectedChatId, token);
      clearMessages();
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

  useEffect(() => {
    if (!selectedChatId || !isLiveSessionEnvelope(lastJsonMessage)) {
      return;
    }

    if (lastHandledMessageRef.current === lastJsonMessage) {
      return;
    }
    lastHandledMessageRef.current = lastJsonMessage;

    const payload = lastJsonMessage as LiveSessionEnvelope;

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

      if (!isStreaming) {
        startStreaming(
          createLiveChatMessage(
            selectedChatId,
            {
              ...payload,
              data: {
                content,
                mime_type: "text/plain",
              },
            },
            createLiveMessageId("model_text"),
          ),
        );
      } else {
        appendLastMessage(content);
      }
      return;
    }

    if (payload.type === "turn_complete") {
      stopStreaming();
      stopWaiting();
      return;
    }

    if (payload.type === "turn_start") {
      setSendError(null);
      return;
    }

    if (payload.type === "debug") {
      return;
    }

    if (payload.type === "error") {
      const text =
        typeof payload.data === "string"
          ? payload.data
          : payload.data && typeof payload.data === "object" && "content" in payload.data
            ? String(payload.data.content ?? "")
            : "An unexpected error occurred";
      setSendError(text);
      addMessage(createLiveChatMessage(selectedChatId, payload));
      stopStreaming();
      stopWaiting();
      return;
    }

    const liveMessage = createLiveChatMessage(selectedChatId, payload);
    addMessage(liveMessage);

    if (payload.type !== "info") {
      setSendError(null);
    }

    if (payload.type === "function_response") {
      stopWaiting();
    }
  }, [
    addMessage,
    appendLastMessage,
    isStreaming,
    lastJsonMessage,
    selectedChatId,
    setSendError,
    startStreaming,
    startWaiting,
    stopStreaming,
    stopWaiting,
  ]);

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
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Agent chat
            </Typography>
          </Box>

          <ChatToolBox
            connectionStatus={connectionStatus}
            onRestartConnection={reconnect}
            onClearMessages={() => void handleClearMessages()}
          />

          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ChatHistory
              chatId={selectedChatId}
              onResendMessage={handleResendMessage}
              canResend={connectionStatus === "Open"}
            />
          </Box>
        </Stack>
      </Paper>

      <ChatInput chatId={selectedChatId} token={token} />
    </Box>
  );
}
