"use client";

import { useState } from "react";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import PresentToAllRoundedIcon from "@mui/icons-material/PresentToAllRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import { Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useSession } from "next-auth/react";

import { useWebSocketContext } from "@/components/providers/websocket-provider";
import { refinePrompt } from "@/lib/api";
import { messageInputSchema } from "@/lib/validators";
import { useChatStore } from "@/store/chat-store";
import { useMessageStore } from "@/store/message-store";
import { createLiveChatMessage, createLiveMessageId } from "@/types/live-session";

type ChatInputProps = {
  chatId: string | null;
  token?: string;
  controlMode?: "agent" | "manual" | null;
};

export function ChatInput({ chatId, token, controlMode = null }: ChatInputProps) {
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const { data: session } = useSession();
  const { sendJsonMessage, connectionStatus } = useWebSocketContext();
  const content = useChatStore((state) => (chatId ? state.draftByChatId[chatId] ?? "" : ""));
  const setChatDraft = useChatStore((state) => state.setChatDraft);
  const clearChatDraft = useChatStore((state) => state.clearChatDraft);
  const sendError = useMessageStore((state) => state.sendError);
  const setSendError = useMessageStore((state) => state.setSendError);
  const addMessage = useMessageStore((state) => state.addMessage);
  const startWaiting = useMessageStore((state) => state.startWaiting);
  const stopWaiting = useMessageStore((state) => state.stopWaiting);
  const hasChat = Boolean(chatId);
  const canSend = hasChat && connectionStatus === "Open";

  async function submitMessage() {
    const parsed = messageInputSchema.safeParse({ content });
    if (!parsed.success || !chatId || connectionStatus !== "Open") {
      return;
    }

    try {
      setSendError(null);
      startWaiting();
      addMessage(
        createLiveChatMessage(
          chatId,
          {
            type: "text",
            sender: "user",
            data: parsed.data.content,
            timestamp: Date.now(),
          },
          createLiveMessageId("user_text"),
        ),
      );
      sendJsonMessage({
        type: "text",
        sender: "user",
        data: parsed.data.content,
        timestamp: Date.now(),
      });
      clearChatDraft(chatId);
    } catch (error) {
      stopWaiting();
      setSendError(error instanceof Error ? error.message : "Unable to send message");
    }
  }

  async function handleRefinePrompt() {
    const prompt = content.trim();
    const accessToken = token ?? session?.accessToken;
    if (!prompt || !accessToken) {
      return;
    }

    try {
      setSendError(null);
      setIsRefiningPrompt(true);
      const response = await refinePrompt(prompt, accessToken);
      if (chatId) {
        setChatDraft(chatId, response.refined_prompt);
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to refine prompt");
    } finally {
      setIsRefiningPrompt(false);
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack spacing={2}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          placeholder="Describe the task, the desired outcome, and any constraints the agent should respect."
          value={content}
          onChange={(event) => {
            if (chatId) {
              setChatDraft(chatId, event.target.value);
            }
          }}
          disabled={!hasChat}
        />

        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Improve prompt">
              <Button
                variant="outlined"
                color="inherit"
                aria-label="Refine prompt"
                onClick={() => void handleRefinePrompt()}
                disabled={!hasChat || !content.trim() || isRefiningPrompt}
                loading={isRefiningPrompt}
                loadingPosition="start"
                startIcon={<AutoFixHighRoundedIcon />}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.primary",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.12),
                  minWidth: 0,
                  px: 1.25,
                }}
              >
                Improve
              </Button>
            </Tooltip>
            <Tooltip title="Video">
              <IconButton
                color="inherit"
                aria-label="Video input"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <VideocamRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Microphone">
              <IconButton
                color="inherit"
                aria-label="Microphone input"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <MicRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share screen">
              <IconButton
                color="inherit"
                aria-label="Share screen"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.02 : 0.04),
                }}
              >
                <PresentToAllRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Tooltip title="Send message">
            <span>
              <IconButton
                color="primary"
                aria-label="Send message"
                onClick={() => void submitMessage()}
                disabled={!canSend}
                sx={{
                  border: "1px solid",
                  borderColor: "primary.main",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.16),
                }}
              >
                <SendRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Stack spacing={0.5}>
          {sendError ? (
            <Typography variant="caption" color="error.main">
              {sendError}
            </Typography>
          ) : hasChat && connectionStatus !== "Open" ? (
            <Typography variant="caption" color="text.secondary">
              {connectionStatus === "Connecting"
                ? "Connecting to the agent. You can type while the session opens."
                : "The agent connection is not open yet. You can type, but sending is unavailable until it reconnects."}
            </Typography>
          ) : null}
          {hasChat && controlMode === "agent" ? (
            <Typography variant="caption" color="text.secondary">
              Agent session: the agent keeps control, so approval cards will not appear.
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
